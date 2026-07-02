const express = require('express');
const multer = require('multer');
const { getDb, getAuth } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { superuserMiddleware } = require('../middleware/superuser');
const { sendInvitationEmail } = require('../services/emailService');
const companyMembers = require('../services/companyMembers');
const companySubscription = require('../utils/companySubscription');
const adminSecurity = require('../services/adminSecurity');
const aiProvider = require('../services/aiProvider');
const pdfParser = require('../services/pdfParser');
const citiesService = require('../services/citiesService');
const locationService = require('../services/locationService');
const { normalizeZona } = require('../utils/constants');
const { getDocMapByIds } = require('../utils/firestore');

const router = express.Router();

// Parte un array en lotes de `size` (para `in` <=10 o auth.getUsers <=100).
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Apply auth and superuser middleware to all routes
router.use(authMiddleware);
router.use(superuserMiddleware);

// Límite de miembros por defecto al crear una empresa (incluye al dueño).
const DEFAULT_COMPANY_MAX_MEMBERS = 3;

// GET /api/admin/stats - General statistics
router.get('/stats', async (req, res, next) => {
  try {
    const db = getDb();

    // Conteos vía agregación count() en paralelo, en vez de leer las colecciones
    // enteras a memoria. Cada count() se factura como pocas lecturas y no trae
    // los documentos. "Activos" = total - (active == false) para conservar la
    // semántica original (una oferta sin el campo `active` cuenta como activa).
    const usersCol = db.collection('users');
    const matchesCol = db.collection('matches');
    const offersCol = db.collection('jobOffers');
    const countOf = (q) => q.count().get().then(s => s.data().count);

    const [
      totalUsers,
      workerCount,
      employerCount,
      companyCount,
      superuserCount,
      totalMatches,
      pendingCount,
      acceptedCount,
      rejectedCount,
      totalJobOffers,
      inactiveJobOffers
    ] = await Promise.all([
      countOf(usersCol),
      countOf(usersCol.where('role', '==', 'worker')),
      countOf(usersCol.where('role', '==', 'employer')),
      countOf(usersCol.where('role', '==', 'company')),
      countOf(usersCol.where('role', '==', 'superuser')),
      countOf(matchesCol),
      countOf(matchesCol.where('status', '==', 'pending')),
      countOf(matchesCol.where('status', '==', 'accepted')),
      countOf(matchesCol.where('status', '==', 'rejected')),
      countOf(offersCol),
      countOf(offersCol.where('active', '==', false))
    ]);

    res.json({
      totalUsers,
      usersByRole: {
        worker: workerCount,
        employer: employerCount,
        company: companyCount,
        superuser: superuserCount
      },
      totalMatches,
      matchesByStatus: {
        pending: pendingCount,
        accepted: acceptedCount,
        rejected: rejectedCount
      },
      totalJobOffers,
      activeJobOffers: totalJobOffers - inactiveJobOffers,
      inactiveJobOffers
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/users - Create a new user (invitation)
router.post('/users', async (req, res, next) => {
  try {
    const { email, firstName, lastName, phone, role, plan, workerProfile, businessName, maxMembers, companyPlanId } = req.body;
    const db = getDb();
    const auth = getAuth();

    // Validaciones
    if (!email) {
      return res.status(400).json({ error: 'Email es requerido' });
    }

    if (!role || !['worker', 'employer', 'company'].includes(role)) {
      return res.status(400).json({ error: 'Rol debe ser "worker", "employer" o "company"' });
    }

    // Las cuentas empresa requieren razón social y un plan desde su creación.
    let companyPlan = null;
    if (role === 'company') {
      if (!businessName) {
        return res.status(400).json({ error: 'businessName es requerido para cuentas empresa' });
      }
      if (!companyPlanId) {
        return res.status(400).json({ error: 'Tenés que elegir un plan para la empresa' });
      }
      const planDoc = await db.collection('companyPlans').doc(companyPlanId).get();
      if (!planDoc.exists) {
        return res.status(400).json({ error: 'El plan seleccionado no existe' });
      }
      companyPlan = { id: planDoc.id, ...planDoc.data() };
    }

    // Verificar si el email ya existe
    try {
      await auth.getUserByEmail(email);
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    } catch (e) {
      // Si el error es user-not-found, continuamos (es lo que queremos)
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
    }

    // 1. Crear usuario en Firebase Auth
    const userRecord = await auth.createUser({
      email,
      emailVerified: true, // Lo marcamos como verificado porque es invitación de admin
      displayName: firstName && lastName ? `${firstName} ${lastName}` : undefined
    });

    // 2. Crear documento en Firestore
    const userPayload = {
      uid: userRecord.uid,
      role,
      firstName: firstName || null,
      lastName: lastName || null,
      phone: phone || null,
      plan: plan || 'free',
      invitedBy: req.user.uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    // En MVP la empresa "es" la organización: organizationId = su propio uid.
    // Deja la puerta abierta a multi-miembro (varios uid → un organizationId).
    if (role === 'company') {
      userPayload.organizationId = userRecord.uid;
      // El perfil de empresa se carga desde el admin, así que no pasa por el
      // onboarding de la app (placeholder: se puede agregar uno propio luego).
      userPayload.onboardingCompleted = true;
    }
    await db.collection('users').doc(userRecord.uid).set(userPayload);

    // 2c. Si role=company, crear el perfil de empresa (con placeholders de
    // suscripción/KPIs/onboarding a definir más adelante).
    if (role === 'company') {
      await db.collection('companies').doc(userRecord.uid).set({
        uid: userRecord.uid,
        organizationId: userRecord.uid,
        businessName,
        contactName: firstName && lastName ? `${firstName} ${lastName}` : (firstName || null),
        phone: phone || null,
        rubro: null,
        address: null,
        localidad: null,
        city: null,
        description: null,
        photoUrl: null,
        active: true,
        // Límite de cuentas del equipo (incluye al dueño). null = sin límite.
        maxMembers: Number.isInteger(maxMembers) && maxMembers > 0 ? maxMembers : DEFAULT_COMPANY_MAX_MEMBERS,
        // Suscripción materializada desde el plan elegido (vigencia + IA + cupo).
        subscription: companySubscription.applyPlan(companyPlan, new Date()),
        // KPIs (PLACEHOLDER, a definir).
        kpis: {
          totalOffers: 0,
          totalCandidatesEvaluated: 0,
          totalHires: 0,
          talentPoolSize: 0,
          updatedAt: null
        },
        // Onboarding (PLACEHOLDER, a definir).
        onboarding: { completed: false, steps: {} },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 2b. Si role=worker y vienen datos de worker profile, crear el perfil
    let workerProfileCreated = false;
    if (role === 'worker' && workerProfile && workerProfile.rubro && workerProfile.puesto) {
      const canonicalZona = normalizeZona(workerProfile.zona) || workerProfile.zona || null;
      // Geocodifica zona/localidad -> coords + city para que el perfil cargado
      // desde CV participe del matching por proximidad.
      const { location, city } = await locationService.enrichLocation({
        location: workerProfile.location,
        city: workerProfile.city,
        zona: canonicalZona,
        localidad: workerProfile.localidad,
        address: workerProfile.address
      });
      const profileData = {
        uid: userRecord.uid,
        rubro: workerProfile.rubro,
        puesto: workerProfile.puesto,
        zona: canonicalZona,
        localidad: workerProfile.localidad || null,
        city: city || null,
        location: location ? { ...location, updatedAt: new Date() } : null,
        description: workerProfile.description || null,
        experience: workerProfile.experience || null,
        skills: Array.isArray(workerProfile.skills) ? workerProfile.skills : [],
        photoUrl: null,
        videoUrl: null,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('workers').doc(userRecord.uid).set(profileData);
      workerProfileCreated = true;
    }

    // 3. Generar link de reset password
    const resetLink = await auth.generatePasswordResetLink(email);

    // 4. Enviar email de invitación
    await sendInvitationEmail({
      to: email,
      firstName,
      resetLink
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado y email de invitación enviado',
      workerProfileCreated,
      user: {
        uid: userRecord.uid,
        email,
        firstName,
        lastName,
        role,
        plan: plan || 'free'
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    next(error);
  }
});

// POST /api/admin/users/:uid/resend-invitation - Resend the activation/invitation email
router.post('/users/:uid/resend-invitation', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const db = getDb();
    const auth = getAuth();

    // Resolve the user's email (Auth is source of truth, fall back to Firestore)
    let email = null;
    let firstName = null;
    try {
      const userRecord = await auth.getUser(uid);
      email = userRecord.email;
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
    }

    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      email = email || data.email;
      firstName = data.firstName || null;
    }

    if (!email) {
      return res.status(404).json({ error: 'El usuario no tiene un email asociado' });
    }

    const resetLink = await auth.generatePasswordResetLink(email);
    await sendInvitationEmail({ to: email, firstName, resetLink });

    res.json({ success: true, message: 'Invitación reenviada', email });
  } catch (error) {
    console.error('Error resending invitation:', error);
    next(error);
  }
});

// GET /api/admin/users - List users with optional role filter
router.get('/users', async (req, res, next) => {
  try {
    const db = getDb();
    const auth = getAuth();
    const { role, limit = 50, offset = 0 } = req.query;

    let query = db.collection('users');
    let useOrderBy = true;

    if (role && ['worker', 'employer', 'superuser', 'company'].includes(role)) {
      query = query.where('role', '==', role);
      // Skip orderBy when filtering to avoid needing composite index
      useOrderBy = false;
    }

    const snapshot = useOrderBy
      ? await query.orderBy('createdAt', 'desc').get()
      : await query.get();

    const docs = snapshot.docs;

    // Agrupar ids por lo que hay que leer, para batchear (evita N+1).
    const allUids = docs.map(d => d.id);
    const workerIds = [];
    const employerIds = [];
    const companyIds = [];
    const ownerIds = []; // employers + companies: dueños de jobOffers
    docs.forEach(d => {
      const r = d.data().role;
      if (r === 'worker') workerIds.push(d.id);
      else if (r === 'employer') { employerIds.push(d.id); ownerIds.push(d.id); }
      else if (r === 'company') { companyIds.push(d.id); ownerIds.push(d.id); }
    });

    // Firebase Auth: getUsers batchea hasta 100 identifiers por llamada.
    const authMap = new Map();
    await Promise.all(chunk(allUids, 100).map(async ids => {
      const result = await auth.getUsers(ids.map(uid => ({ uid })));
      result.users.forEach(u => authMap.set(u.uid, u));
    }));

    // Perfiles: un getAll por colección.
    const [workerMap, employerMap, companyMap] = await Promise.all([
      getDocMapByIds(db, 'workers', workerIds),
      getDocMapByIds(db, 'employers', employerIds),
      getDocMapByIds(db, 'companies', companyIds),
    ]);

    // jobOffers de los owners: where('employerId','in', chunk<=10), agrupadas.
    const jobOffersByOwner = new Map();
    await Promise.all(chunk(ownerIds, 10).map(async ids => {
      const snap = await db.collection('jobOffers').where('employerId', 'in', ids).get();
      snap.docs.forEach(j => {
        const data = j.data();
        const arr = jobOffersByOwner.get(data.employerId) || [];
        arr.push({ id: j.id, ...data, createdAt: data.createdAt?.toDate?.() || data.createdAt });
        jobOffersByOwner.set(data.employerId, arr);
      });
    }));

    const users = docs.map(doc => {
      const userData = doc.data();
      const userRecord = authMap.get(doc.id);
      const authData = userRecord ? {
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        phoneNumber: userRecord.phoneNumber,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled
      } : null;

      let profile = null;
      if (userData.role === 'worker') profile = workerMap.get(doc.id) || null;
      else if (userData.role === 'employer') profile = employerMap.get(doc.id) || null;
      else if (userData.role === 'company') profile = companyMap.get(doc.id) || null;

      const jobOffers = jobOffersByOwner.get(doc.id) || [];

      return {
        uid: doc.id,
        ...userData,
        email: authData?.email || userData.email,
        displayName: authData?.displayName,
        photoURL: profile?.photoUrl || authData?.photoURL,
        phoneNumber: authData?.phoneNumber,
        emailVerified: authData?.emailVerified,
        authDisabled: authData?.disabled,
        profile,
        jobOffers: jobOffers.length > 0 ? jobOffers : undefined,
        createdAt: userData.createdAt?.toDate?.() || userData.createdAt
      };
    });

    // Sort by createdAt desc if we didn't use orderBy
    if (!useOrderBy) {
      users.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }

    // Simple pagination
    const paginated = users.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      users: paginated,
      total: users.length,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/users/:uid - Get user detail with profile and stats
router.get('/users/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const db = getDb();
    const auth = getAuth();

    // Get user document
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const firestoreData = userDoc.data();

    // Get Firebase Auth data
    let authData = {};
    try {
      const userRecord = await auth.getUser(uid);
      authData = {
        email: userRecord.email,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        phoneNumber: userRecord.phoneNumber,
        emailVerified: userRecord.emailVerified,
        authDisabled: userRecord.disabled
      };
    } catch (e) {
      // User might not exist in Auth
    }

    const userData = {
      uid: userDoc.id,
      ...firestoreData,
      ...authData,
      createdAt: firestoreData.createdAt?.toDate?.() || firestoreData.createdAt,
      updatedAt: firestoreData.updatedAt?.toDate?.() || firestoreData.updatedAt
    };

    // Get profile based on role
    let profile = null;
    if (userData.role === 'worker') {
      const workerDoc = await db.collection('workers').doc(uid).get();
      if (workerDoc.exists) {
        profile = workerDoc.data();
      }
    } else if (userData.role === 'employer' || userData.role === 'company') {
      const profileCol = userData.role === 'company' ? 'companies' : 'employers';
      const profileDoc = await db.collection(profileCol).doc(uid).get();
      if (profileDoc.exists) {
        profile = profileDoc.data();
      }
    }

    // Prefer the profile photo uploaded in-app over the Firebase Auth photo
    userData.photoURL = profile?.photoUrl || userData.photoURL;

    // Get user stats
    const stats = { matches: 0, jobOffers: 0, chats: 0 };

    if (userData.role === 'worker') {
      const matchesSnapshot = await db.collection('matches')
        .where('workerId', '==', uid)
        .get();
      stats.matches = matchesSnapshot.size;
    } else if (userData.role === 'employer' || userData.role === 'company') {
      const matchesSnapshot = await db.collection('matches')
        .where('employerId', '==', uid)
        .get();
      stats.matches = matchesSnapshot.size;

      const jobOffersSnapshot = await db.collection('jobOffers')
        .where('employerId', '==', uid)
        .get();
      stats.jobOffers = jobOffersSnapshot.size;
    }

    res.json({
      user: userData,
      profile,
      stats
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/users/:uid - Update user (role, disabled status)
router.patch('/users/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { role, disabled, aiCvEnabled } = req.body;
    const db = getDb();

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = { updatedAt: new Date() };

    if (role !== undefined) {
      if (!['worker', 'employer', 'superuser', 'company'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role = role;
    }

    if (disabled !== undefined) {
      updates.disabled = Boolean(disabled);
    }

    if (aiCvEnabled !== undefined) {
      updates.aiCvEnabled = Boolean(aiCvEnabled);
    }

    await userRef.update(updates);

    const updatedDoc = await userRef.get();

    res.json({
      message: 'User updated successfully',
      user: {
        uid: updatedDoc.id,
        ...updatedDoc.data()
      }
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/users/:uid - Delete user (soft or hard)
router.delete('/users/:uid', async (req, res, next) => {
  try {
    const { uid } = req.params;
    const { hard } = req.query;
    const db = getDb();

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    // Prevent deleting superusers
    if (userData.role === 'superuser') {
      return res.status(403).json({ error: 'Cannot delete superuser accounts' });
    }

    if (hard === 'true') {
      // Hard delete - remove user and related data
      const batch = db.batch();
      const auth = getAuth();
      const authUidsToDelete = [uid]; // cuentas de Firebase Auth a liberar

      // Delete user document
      batch.delete(userRef);

      // Delete profile
      if (userData.role === 'worker') {
        batch.delete(db.collection('workers').doc(uid));
      } else if (userData.role === 'employer' || userData.role === 'company') {
        batch.delete(db.collection(userData.role === 'company' ? 'companies' : 'employers').doc(uid));

        // Delete the owner's job offers
        const jobOffersSnapshot = await db.collection('jobOffers')
          .where('employerId', '==', uid)
          .get();
        jobOffersSnapshot.docs.forEach(doc => batch.delete(doc.ref));

        // Empresa: borrar también su talent pool y sus MIEMBROS del equipo.
        if (userData.role === 'company') {
          const candidatesSnapshot = await db.collection('companyCandidates')
            .where('organizationId', '==', uid)
            .get();
          candidatesSnapshot.docs.forEach(doc => batch.delete(doc.ref));

          // Miembros de la organización (otros uid con organizationId === uid).
          const membersSnapshot = await db.collection('users')
            .where('organizationId', '==', uid)
            .get();
          membersSnapshot.docs.forEach(doc => {
            if (doc.id !== uid) {
              batch.delete(doc.ref);
              authUidsToDelete.push(doc.id);
            }
          });
        }
      }

      await batch.commit();

      // Liberar las cuentas de Firebase Auth (best-effort) para que el email
      // pueda re-invitarse en el futuro. Cada borrado es independiente.
      await Promise.all(authUidsToDelete.map(async (authUid) => {
        try {
          await auth.deleteUser(authUid);
        } catch (e) {
          // Ya no existe en Auth o falló: no bloqueamos el borrado.
        }
      }));

      res.json({ message: 'User permanently deleted' });
    } else {
      // Soft delete - mark as disabled
      await userRef.update({
        disabled: true,
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      res.json({ message: 'User disabled' });
    }
  } catch (error) {
    next(error);
  }
});

// ----- Perfiles de worker "huérfanos" -----
// Un worker es huérfano cuando existe su doc en `workers` pero NO su doc en
// `users` (típicamente porque se borró el usuario a mano en la consola de
// Firebase). Siguen apareciendo como candidatos en la app (el descubrimiento
// lee `workers`) pero son invisibles al panel (que lista `users`).

// Borra el worker + su data relacionada (matches/interacciones/solicitudes/
// notificaciones). Devuelve los conteos borrados.
async function deleteWorkerAndRefs(db, uid) {
  const counts = { worker: 0, matches: 0, offerInteractions: 0, contactRequests: 0, notifications: 0 };

  const workerRef = db.collection('workers').doc(uid);
  if ((await workerRef.get()).exists) {
    await workerRef.delete();
    counts.worker = 1;
  }

  const deleteWhere = async (collection, field, key) => {
    const snap = await db.collection(collection).where(field, '==', uid).get();
    if (!snap.size) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    counts[key] += snap.size;
  };

  await deleteWhere('matches', 'workerId', 'matches');
  await deleteWhere('offerInteractions', 'userId', 'offerInteractions');
  await deleteWhere('contactRequests', 'fromUid', 'contactRequests');
  await deleteWhere('contactRequests', 'toUid', 'contactRequests');
  await deleteWhere('notifications', 'userId', 'notifications');

  return counts;
}

// GET /api/admin/orphan-workers - Lista de workers sin doc en `users`.
router.get('/orphan-workers', async (req, res, next) => {
  try {
    const db = getDb();
    const snap = await db.collection('workers').get();
    const ids = snap.docs.map(d => d.id);
    const usersMap = await getDocMapByIds(db, 'users', ids);

    const orphans = snap.docs
      .filter(d => !usersMap.has(d.id))
      .map(d => {
        const w = d.data();
        return {
          uid: d.id,
          puesto: w.puesto || null,
          rubro: w.rubro || null,
          zona: w.zona || null,
          active: w.active !== false,
          hasVideo: !!w.videoUrl,
          createdAt: w.createdAt?.toDate?.() || w.createdAt || null
        };
      });

    res.json({ orphans, total: orphans.length });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/orphan-workers/:uid - Borra un worker huérfano + su data.
// Por seguridad, solo procede si realmente NO existe el doc en `users`.
router.delete('/orphan-workers/:uid', async (req, res, next) => {
  try {
    const db = getDb();
    const { uid } = req.params;

    const workerDoc = await db.collection('workers').doc(uid).get();
    if (!workerDoc.exists) {
      return res.status(404).json({ error: 'Worker no encontrado' });
    }
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      return res.status(400).json({
        error: 'Este worker tiene usuario asociado; borralo desde la lista de Usuarios.'
      });
    }

    const deleted = await deleteWorkerAndRefs(db, uid);
    res.json({ message: 'Worker huérfano eliminado', deleted });
  } catch (error) {
    next(error);
  }
});

// ----- Equipo de una empresa (gestión por el superuser) -----

// Verifica que :companyUid sea una cuenta empresa dueña (uid === organizationId).
async function ensureCompanyOwner(db, companyUid) {
  const doc = await db.collection('users').doc(companyUid).get();
  if (!doc.exists || doc.data().role !== 'company') {
    const err = new Error('Empresa no encontrada');
    err.status = 404;
    throw err;
  }
  return companyUid;
}

// PATCH /api/admin/companies/:companyUid - Editar config de la empresa (límite de miembros)
router.patch('/companies/:companyUid', async (req, res, next) => {
  try {
    const db = getDb();
    const companyUid = await ensureCompanyOwner(db, req.params.companyUid);
    const updates = { updatedAt: new Date() };

    if (req.body.maxMembers !== undefined) {
      const n = Number(req.body.maxMembers);
      // null/0/'' → sin límite; entero > 0 → límite.
      if (req.body.maxMembers === null || req.body.maxMembers === '') {
        updates.maxMembers = null;
      } else if (Number.isInteger(n) && n > 0) {
        updates.maxMembers = n;
      } else {
        return res.status(400).json({ error: 'maxMembers debe ser un entero mayor a 0 (o null para sin límite)' });
      }
    }

    // Renovar / asignar plan: reinicia vigencia y contador de CVs.
    if (req.body.planId) {
      const planDoc = await db.collection('companyPlans').doc(req.body.planId).get();
      if (!planDoc.exists) {
        return res.status(400).json({ error: 'El plan seleccionado no existe' });
      }
      updates.subscription = companySubscription.applyPlan({ id: planDoc.id, ...planDoc.data() }, new Date());
    }

    // Overrides por empresa sobre la suscripción vigente (IA y cupo de CVs).
    if (req.body.aiCvEnabled !== undefined || req.body.maxCvAnalyses !== undefined) {
      const current = updates.subscription || (await db.collection('companies').doc(companyUid).get()).data().subscription || {};
      const sub = { ...current };
      if (req.body.aiCvEnabled !== undefined) sub.aiCvEnabled = Boolean(req.body.aiCvEnabled);
      if (req.body.maxCvAnalyses !== undefined) {
        const m = Number(req.body.maxCvAnalyses);
        if (m < -1 || m === 0 || !Number.isInteger(m)) {
          return res.status(400).json({ error: 'maxCvAnalyses debe ser un entero mayor a 0 o -1 (ilimitado)' });
        }
        sub.maxCvAnalyses = m;
      }
      updates.subscription = sub;
    }

    await db.collection('companies').doc(companyUid).update(updates);
    const updated = await db.collection('companies').doc(companyUid).get();
    res.json({ message: 'Empresa actualizada', company: updated.data() });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// GET /api/admin/companies/:companyUid/members
router.get('/companies/:companyUid/members', async (req, res, next) => {
  try {
    const db = getDb();
    const organizationId = await ensureCompanyOwner(db, req.params.companyUid);
    const members = await companyMembers.listMembers(db, getAuth(), organizationId);
    res.json({ members, total: members.length });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// POST /api/admin/companies/:companyUid/members - Invitar miembro
router.post('/companies/:companyUid/members', async (req, res, next) => {
  try {
    const db = getDb();
    const organizationId = await ensureCompanyOwner(db, req.params.companyUid);
    const { email, firstName, lastName } = req.body;
    const member = await companyMembers.inviteMember(db, getAuth(), {
      organizationId,
      email,
      firstName,
      lastName,
      invitedBy: req.user.uid,
    });
    res.status(201).json({ success: true, message: 'Invitación enviada', member });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// DELETE /api/admin/companies/:companyUid/members/:memberUid - Quitar miembro
router.delete('/companies/:companyUid/members/:memberUid', async (req, res, next) => {
  try {
    const db = getDb();
    const organizationId = await ensureCompanyOwner(db, req.params.companyUid);
    await companyMembers.removeMember(db, getAuth(), {
      organizationId,
      memberUid: req.params.memberUid,
    });
    res.json({ success: true, message: 'Miembro eliminado' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// GET /api/admin/job-offers - List all job offers
router.get('/job-offers', async (req, res, next) => {
  try {
    const db = getDb();
    const { active, employerId, limit = 50, offset = 0 } = req.query;

    let query = db.collection('jobOffers');

    if (active !== undefined) {
      query = query.where('active', '==', active === 'true');
    }

    if (employerId) {
      query = query.where('employerId', '==', employerId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const docs = snapshot.docs;

    // Perfiles owner batcheados: employers y companies en un getAll cada uno
    // (mismo orden de preferencia que getOwnerProfile: employer y si no, company).
    const ownerIds = [...new Set(docs.map(d => d.data().employerId).filter(Boolean))];
    const [employerMap, companyMap] = await Promise.all([
      getDocMapByIds(db, 'employers', ownerIds),
      getDocMapByIds(db, 'companies', ownerIds),
    ]);
    const ownerOf = (id) => employerMap.get(id) || companyMap.get(id) || null;

    const jobOffers = docs.map(doc => {
      const data = doc.data();
      const employer = ownerOf(data.employerId);

      // Include stats (default to 0 if not present)
      const stats = data.stats || { interestedCount: 0, notInterestedCount: 0 };

      return {
        id: doc.id,
        ...data,
        stats,
        employer,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    // Simple pagination
    const paginated = jobOffers.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      jobOffers: paginated,
      total: jobOffers.length,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/job-offers/:id - Update job offer (admin)
router.patch('/job-offers/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const jobRef = db.collection('jobOffers').doc(id);
    const jobDoc = await jobRef.get();

    if (!jobDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    const updates = { updatedAt: new Date() };
    const allowedFields = ['active', 'durationDays', 'expiresAt', 'rubro', 'puesto', 'description', 'requirements', 'salary', 'schedule', 'requiredSkills', 'zona'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'expiresAt' && typeof req.body[field] === 'string') {
          updates[field] = new Date(req.body[field]);
        } else if (field === 'active') {
          updates[field] = Boolean(req.body[field]);
        } else if (field === 'durationDays') {
          updates[field] = Number(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    // If durationDays is updated, recalculate expiresAt from createdAt
    if (updates.durationDays !== undefined && !updates.expiresAt) {
      const jobData = jobDoc.data();
      const createdAt = jobData.createdAt?.toDate?.() || jobData.createdAt || new Date();
      updates.expiresAt = new Date(new Date(createdAt).getTime() + updates.durationDays * 24 * 60 * 60 * 1000);
    }

    await jobRef.update(updates);

    const updatedDoc = await jobRef.get();
    const updatedData = updatedDoc.data();

    res.json({
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate?.() || updatedData.createdAt,
      expiresAt: updatedData.expiresAt?.toDate?.() || updatedData.expiresAt,
      updatedAt: updatedData.updatedAt?.toDate?.() || updatedData.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/job-offers/:id/matches - Get matches for a specific job offer
router.get('/job-offers/:id/matches', async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;

    // Get offer first
    const offerDoc = await db.collection('jobOffers').doc(id).get();
    if (!offerDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    // Get matches for this offer
    const matchesSnapshot = await db.collection('matches')
      .where('offerId', '==', id)
      .get();

    const matches = await Promise.all(matchesSnapshot.docs.map(async doc => {
      const data = doc.data();

      // Get worker info
      let worker = null;
      let workerUser = null;
      if (data.workerId) {
        const workerDoc = await db.collection('workers').doc(data.workerId).get();
        if (workerDoc.exists) {
          worker = workerDoc.data();
        }
        const userDoc = await db.collection('users').doc(data.workerId).get();
        if (userDoc.exists) {
          workerUser = {
            firstName: userDoc.data().firstName,
            lastName: userDoc.data().lastName,
            email: userDoc.data().email
          };
        }
      }

      return {
        id: doc.id,
        ...data,
        worker,
        workerUser,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      };
    }));

    // Group by status
    const grouped = {
      pending: matches.filter(m => m.status === 'pending'),
      accepted: matches.filter(m => m.status === 'accepted'),
      rejected: matches.filter(m => m.status === 'rejected')
    };

    res.json({
      offerId: id,
      matches: grouped,
      total: matches.length,
      counts: {
        pending: grouped.pending.length,
        accepted: grouped.accepted.length,
        rejected: grouped.rejected.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/job-offers/:id/interactions - Get users who interacted with offer
router.get('/job-offers/:id/interactions', async (req, res, next) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { type } = req.query; // Optional: filter by 'interested' or 'not_interested'

    // Get offer first
    const offerDoc = await db.collection('jobOffers').doc(id).get();
    if (!offerDoc.exists) {
      return res.status(404).json({ error: 'Job offer not found' });
    }

    // Get interactions
    let query = db.collection('offerInteractions').where('offerId', '==', id);
    if (type && ['interested', 'not_interested'].includes(type)) {
      query = query.where('type', '==', type);
    }

    const interactionsSnapshot = await query.get();

    // Get user details for each interaction
    const interactions = await Promise.all(interactionsSnapshot.docs.map(async doc => {
      const data = doc.data();

      // Get user info
      let user = null;
      const userDoc = await db.collection('users').doc(data.userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        user = {
          uid: data.userId,
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email
        };
      }

      // Get worker profile
      let workerProfile = null;
      const workerDoc = await db.collection('workers').doc(data.userId).get();
      if (workerDoc.exists) {
        workerProfile = workerDoc.data();
      }

      return {
        id: doc.id,
        ...data,
        user,
        workerProfile,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      };
    }));

    // Group by type
    const grouped = {
      interested: interactions.filter(i => i.type === 'interested'),
      notInterested: interactions.filter(i => i.type === 'not_interested')
    };

    res.json({
      offerId: id,
      stats: offerDoc.data().stats || { interestedCount: 0, notInterestedCount: 0 },
      interactions: grouped,
      total: interactions.length
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/matches - List all matches
router.get('/matches', async (req, res, next) => {
  try {
    const db = getDb();
    const { status, limit = 50, offset = 0 } = req.query;

    let query = db.collection('matches');

    if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const docs = snapshot.docs;

    // Lookups batcheados: workers + owners (employers/companies).
    const workerIds = [...new Set(docs.map(d => d.data().workerId).filter(Boolean))];
    const ownerIds = [...new Set(docs.map(d => d.data().employerId).filter(Boolean))];
    const [workerMap, employerMap, companyMap] = await Promise.all([
      getDocMapByIds(db, 'workers', workerIds),
      getDocMapByIds(db, 'employers', ownerIds),
      getDocMapByIds(db, 'companies', ownerIds),
    ]);
    const ownerOf = (id) => employerMap.get(id) || companyMap.get(id) || null;

    const matches = docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        worker: data.workerId ? (workerMap.get(data.workerId) || null) : null,
        employer: ownerOf(data.employerId),
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      };
    });

    // Simple pagination
    const paginated = matches.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      matches: paginated,
      total: matches.length,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PLANS CRUD (Monetización)
// ============================================

// GET /api/admin/plans - List all plans
router.get('/plans', async (req, res, next) => {
  try {
    const db = getDb();
    const { active } = req.query;

    let query = db.collection('plans');

    if (active !== undefined) {
      query = query.where('active', '==', active === 'true');
    }

    const snapshot = await query.orderBy('order', 'asc').get();

    const plans = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    }));

    res.json({ plans });
  } catch (error) {
    // If orderBy fails due to missing index, try without it
    if (error.code === 9) {
      try {
        const db = getDb();
        const snapshot = await db.collection('plans').get();
        const plans = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        }));
        // Sort in memory
        plans.sort((a, b) => (a.order || 0) - (b.order || 0));
        return res.json({ plans });
      } catch (err) {
        return next(err);
      }
    }
    next(error);
  }
});

// GET /api/admin/plans/:planId - Get plan by ID
router.get('/plans/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const db = getDb();

    const planDoc = await db.collection('plans').doc(planId).get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const planData = planDoc.data();

    res.json({
      id: planDoc.id,
      ...planData,
      createdAt: planData.createdAt?.toDate?.() || planData.createdAt,
      updatedAt: planData.updatedAt?.toDate?.() || planData.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/plans - Create plan
router.post('/plans', async (req, res, next) => {
  try {
    const {
      name,
      description,
      price,
      maxOffers,
      visibleCandidatesPerOffer,
      offerDurationDays,
      isDefault,
      active = true,
      order = 0
    } = req.body;

    // Validations
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (price === undefined || price < 0) {
      return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0' });
    }
    if (!maxOffers || maxOffers < -1 || maxOffers === 0) {
      return res.status(400).json({ error: 'La cantidad de ofertas debe ser mayor a 0 o -1 para ilimitado' });
    }
    if (!visibleCandidatesPerOffer || visibleCandidatesPerOffer < -1 || visibleCandidatesPerOffer === 0) {
      return res.status(400).json({ error: 'La cantidad de candidatos debe ser mayor a 0 o -1 para ilimitado' });
    }
    if (!offerDurationDays || offerDurationDays < 1) {
      return res.status(400).json({ error: 'La duración debe ser al menos 1 día' });
    }

    const db = getDb();

    // If this plan is default, unset other defaults
    if (isDefault) {
      const existingDefaults = await db.collection('plans')
        .where('isDefault', '==', true)
        .get();

      const batch = db.batch();
      existingDefaults.docs.forEach(doc => {
        batch.update(doc.ref, { isDefault: false, updatedAt: new Date() });
      });
      await batch.commit();
    }

    const planData = {
      name: name.trim(),
      description: description?.trim() || '',
      price: Number(price),
      maxOffers: Number(maxOffers),
      visibleCandidatesPerOffer: Number(visibleCandidatesPerOffer),
      offerDurationDays: Number(offerDurationDays),
      isDefault: Boolean(isDefault),
      active: Boolean(active),
      order: Number(order),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const planRef = await db.collection('plans').add(planData);

    res.status(201).json({
      id: planRef.id,
      ...planData
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/plans/:planId - Update plan
router.patch('/plans/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const db = getDb();

    const planRef = db.collection('plans').doc(planId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const updates = { updatedAt: new Date() };
    const allowedFields = [
      'name', 'description', 'price', 'maxOffers',
      'visibleCandidatesPerOffer', 'offerDurationDays',
      'isDefault', 'active', 'order'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'name' && req.body[field].trim() === '') {
          return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        }
        if (field === 'price' && req.body[field] < 0) {
          return res.status(400).json({ error: 'El precio debe ser mayor o igual a 0' });
        }
        if (field === 'isDefault' || field === 'active') {
          updates[field] = Boolean(req.body[field]);
        } else if (['price', 'maxOffers', 'visibleCandidatesPerOffer', 'offerDurationDays', 'order'].includes(field)) {
          updates[field] = Number(req.body[field]);
        } else {
          updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
        }
      }
    }

    // If setting as default, unset other defaults
    if (updates.isDefault === true) {
      const existingDefaults = await db.collection('plans')
        .where('isDefault', '==', true)
        .get();

      const batch = db.batch();
      existingDefaults.docs.forEach(doc => {
        if (doc.id !== planId) {
          batch.update(doc.ref, { isDefault: false, updatedAt: new Date() });
        }
      });
      await batch.commit();
    }

    await planRef.update(updates);

    const updatedDoc = await planRef.get();
    const updatedData = updatedDoc.data();

    res.json({
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate?.() || updatedData.createdAt,
      updatedAt: updatedData.updatedAt?.toDate?.() || updatedData.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/plans/:planId - Delete plan
router.delete('/plans/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const db = getDb();

    const planRef = db.collection('plans').doc(planId);
    const planDoc = await planRef.get();

    if (!planDoc.exists) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const planData = planDoc.data();

    // Don't allow deleting the default plan
    if (planData.isDefault) {
      return res.status(400).json({ error: 'No se puede eliminar el plan por defecto. Asigná otro plan como default primero.' });
    }

    // TODO: Check if any employers are using this plan before deleting

    await planRef.delete();

    res.json({ message: 'Plan eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// COMPANY PLANS CRUD (planes de empresa: vigencia + IA + cupo de CVs)
// ============================================

// GET /api/admin/company-plans
router.get('/company-plans', async (req, res, next) => {
  try {
    const db = getDb();
    const { active } = req.query;
    let query = db.collection('companyPlans');
    if (active !== undefined) query = query.where('active', '==', active === 'true');
    let docs;
    try {
      docs = (await query.orderBy('order', 'asc').get()).docs;
    } catch (e) {
      docs = (await db.collection('companyPlans').get()).docs;
    }
    const plans = docs
      .map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt,
      }))
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ plans });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/company-plans
router.post('/company-plans', async (req, res, next) => {
  try {
    const { name, description, durationMonths, aiCvEnabled, maxCvAnalyses, price = 0, isDefault, active = true, order = 0 } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!durationMonths || durationMonths < 1) {
      return res.status(400).json({ error: 'La vigencia debe ser de al menos 1 mes' });
    }
    if (maxCvAnalyses === undefined || maxCvAnalyses < -1 || maxCvAnalyses === 0) {
      return res.status(400).json({ error: 'El cupo de CVs debe ser mayor a 0 o -1 para ilimitado' });
    }

    const db = getDb();

    if (isDefault) {
      const existing = await db.collection('companyPlans').where('isDefault', '==', true).get();
      const batch = db.batch();
      existing.docs.forEach(doc => batch.update(doc.ref, { isDefault: false, updatedAt: new Date() }));
      await batch.commit();
    }

    const planData = {
      name: name.trim(),
      description: description?.trim() || '',
      durationMonths: Number(durationMonths),
      aiCvEnabled: Boolean(aiCvEnabled),
      maxCvAnalyses: Number(maxCvAnalyses),
      price: Number(price) || 0,
      isDefault: Boolean(isDefault),
      active: Boolean(active),
      order: Number(order),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const ref = await db.collection('companyPlans').add(planData);
    res.status(201).json({ id: ref.id, ...planData });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/company-plans/:planId
router.patch('/company-plans/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const db = getDb();
    const planRef = db.collection('companyPlans').doc(planId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) return res.status(404).json({ error: 'Plan no encontrado' });

    const updates = { updatedAt: new Date() };
    const allowed = ['name', 'description', 'durationMonths', 'aiCvEnabled', 'maxCvAnalyses', 'price', 'isDefault', 'active', 'order'];
    for (const field of allowed) {
      if (req.body[field] === undefined) continue;
      if (field === 'name' && String(req.body[field]).trim() === '') {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      if (field === 'aiCvEnabled' || field === 'isDefault' || field === 'active') {
        updates[field] = Boolean(req.body[field]);
      } else if (['durationMonths', 'maxCvAnalyses', 'price', 'order'].includes(field)) {
        updates[field] = Number(req.body[field]);
      } else {
        updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    }

    if (updates.isDefault === true) {
      const existing = await db.collection('companyPlans').where('isDefault', '==', true).get();
      const batch = db.batch();
      existing.docs.forEach(doc => {
        if (doc.id !== planId) batch.update(doc.ref, { isDefault: false, updatedAt: new Date() });
      });
      await batch.commit();
    }

    await planRef.update(updates);
    const updated = await planRef.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/company-plans/:planId
router.delete('/company-plans/:planId', async (req, res, next) => {
  try {
    const { planId } = req.params;
    const db = getDb();
    const planRef = db.collection('companyPlans').doc(planId);
    const planDoc = await planRef.get();
    if (!planDoc.exists) return res.status(404).json({ error: 'Plan no encontrado' });
    if (planDoc.data().isDefault) {
      return res.status(400).json({ error: 'No se puede eliminar el plan por defecto. Asigná otro como default primero.' });
    }
    await planRef.delete();
    res.json({ message: 'Plan eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RUBROS CRUD (Categorías de trabajo)
// ============================================

// GET /api/admin/rubros - List all rubros (including inactive)
router.get('/rubros', async (req, res, next) => {
  try {
    const db = getDb();

    const snapshot = await db.collection('rubros').orderBy('orden', 'asc').get();

    const rubros = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    }));

    res.json({ rubros });
  } catch (error) {
    // If orderBy fails, sort in memory
    if (error.code === 9) {
      try {
        const db = getDb();
        const snapshot = await db.collection('rubros').get();
        const rubros = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        }));
        rubros.sort((a, b) => (a.orden || 0) - (b.orden || 0));
        return res.json({ rubros });
      } catch (err) {
        return next(err);
      }
    }
    next(error);
  }
});

// POST /api/admin/rubros - Create rubro
router.post('/rubros', async (req, res, next) => {
  try {
    const { nombre, icono, activo = true, orden = 0 } = req.body;

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const db = getDb();

    // Check if rubro with same name exists
    const existing = await db.collection('rubros')
      .where('nombre', '==', nombre.trim())
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(400).json({ error: 'Ya existe un rubro con ese nombre' });
    }

    const rubroData = {
      nombre: nombre.trim(),
      icono: icono?.trim() || '💼',
      activo: Boolean(activo),
      orden: Number(orden),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const rubroRef = await db.collection('rubros').add(rubroData);

    res.status(201).json({
      id: rubroRef.id,
      ...rubroData
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/rubros/:rubroId - Update rubro
router.patch('/rubros/:rubroId', async (req, res, next) => {
  try {
    const { rubroId } = req.params;
    const db = getDb();

    const rubroRef = db.collection('rubros').doc(rubroId);
    const rubroDoc = await rubroRef.get();

    if (!rubroDoc.exists) {
      return res.status(404).json({ error: 'Rubro no encontrado' });
    }

    const updates = { updatedAt: new Date() };
    const allowedFields = ['nombre', 'icono', 'activo', 'orden'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'nombre') {
          if (req.body[field].trim() === '') {
            return res.status(400).json({ error: 'El nombre no puede estar vacío' });
          }
          updates[field] = req.body[field].trim();
        } else if (field === 'activo') {
          updates[field] = Boolean(req.body[field]);
        } else if (field === 'orden') {
          updates[field] = Number(req.body[field]);
        } else {
          updates[field] = req.body[field]?.trim() || '';
        }
      }
    }

    await rubroRef.update(updates);

    const updatedDoc = await rubroRef.get();

    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.() || updatedDoc.data().createdAt,
      updatedAt: updatedDoc.data().updatedAt?.toDate?.() || updatedDoc.data().updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/rubros/:rubroId - Delete rubro
router.delete('/rubros/:rubroId', async (req, res, next) => {
  try {
    const { rubroId } = req.params;
    const db = getDb();

    const rubroRef = db.collection('rubros').doc(rubroId);
    const rubroDoc = await rubroRef.get();

    if (!rubroDoc.exists) {
      return res.status(404).json({ error: 'Rubro no encontrado' });
    }

    // Check if there are leads using this rubro
    const leadsWithRubro = await db.collection('leads')
      .where('rubroId', '==', rubroId)
      .limit(1)
      .get();

    if (!leadsWithRubro.empty) {
      return res.status(400).json({
        error: 'No se puede eliminar. Hay leads usando este rubro. Desactivalo en su lugar.'
      });
    }

    await rubroRef.delete();

    res.json({ message: 'Rubro eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CITIES CRUD (Ciudades donde opera la app)
// ============================================

// Valida y normaliza un center { lat, lng }. Devuelve null si es inválido.
function parseCenter(center) {
  if (!center || typeof center !== 'object') return null;
  const lat = Number(center.lat);
  const lng = Number(center.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function parseZonas(zonas) {
  if (!Array.isArray(zonas)) return [];
  return [...new Set(zonas.map(z => String(z || '').trim()).filter(Boolean))];
}

function serializeCity(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
  };
}

// GET /api/admin/cities - List all cities (including inactive)
router.get('/cities', async (req, res, next) => {
  try {
    const db = getDb();
    let snapshot;
    try {
      snapshot = await db.collection('cities').orderBy('orden', 'asc').get();
    } catch (error) {
      if (error.code === 9) {
        snapshot = await db.collection('cities').get();
      } else {
        throw error;
      }
    }
    const cities = snapshot.docs.map(serializeCity);
    cities.sort((a, b) => (a.orden || 0) - (b.orden || 0));
    res.json({ cities });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/cities - Create city
router.post('/cities', async (req, res, next) => {
  try {
    const { nombre, center, radiusKm, zonas, activo = true, orden = 0 } = req.body;

    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const parsedCenter = parseCenter(center);
    if (!parsedCenter) {
      return res.status(400).json({ error: 'El centro (lat/lng) es inválido' });
    }
    const radius = Number(radiusKm);
    if (!Number.isFinite(radius) || radius <= 0) {
      return res.status(400).json({ error: 'El radio (radiusKm) debe ser mayor a 0' });
    }

    const db = getDb();
    const existing = await db.collection('cities')
      .where('nombre', '==', nombre.trim())
      .limit(1)
      .get();
    if (!existing.empty) {
      return res.status(400).json({ error: 'Ya existe una ciudad con ese nombre' });
    }

    const cityData = {
      nombre: nombre.trim(),
      center: parsedCenter,
      radiusKm: radius,
      zonas: parseZonas(zonas),
      activo: Boolean(activo),
      orden: Number(orden) || 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const cityRef = await db.collection('cities').add(cityData);
    citiesService.ensureLoaded(true).catch(() => {});

    res.status(201).json({ id: cityRef.id, ...cityData });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/cities/:cityId - Update city
router.patch('/cities/:cityId', async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const db = getDb();

    const cityRef = db.collection('cities').doc(cityId);
    const cityDoc = await cityRef.get();
    if (!cityDoc.exists) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }

    const updates = { updatedAt: new Date() };

    if (req.body.nombre !== undefined) {
      if (String(req.body.nombre).trim() === '') {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      updates.nombre = String(req.body.nombre).trim();
    }
    if (req.body.center !== undefined) {
      const parsedCenter = parseCenter(req.body.center);
      if (!parsedCenter) {
        return res.status(400).json({ error: 'El centro (lat/lng) es inválido' });
      }
      updates.center = parsedCenter;
    }
    if (req.body.radiusKm !== undefined) {
      const radius = Number(req.body.radiusKm);
      if (!Number.isFinite(radius) || radius <= 0) {
        return res.status(400).json({ error: 'El radio (radiusKm) debe ser mayor a 0' });
      }
      updates.radiusKm = radius;
    }
    if (req.body.zonas !== undefined) {
      updates.zonas = parseZonas(req.body.zonas);
    }
    if (req.body.activo !== undefined) {
      updates.activo = Boolean(req.body.activo);
    }
    if (req.body.orden !== undefined) {
      updates.orden = Number(req.body.orden) || 0;
    }

    await cityRef.update(updates);
    citiesService.ensureLoaded(true).catch(() => {});

    const updatedDoc = await cityRef.get();
    res.json(serializeCity(updatedDoc));
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/cities/:cityId - Delete city
router.delete('/cities/:cityId', async (req, res, next) => {
  try {
    const { cityId } = req.params;
    const db = getDb();

    const cityRef = db.collection('cities').doc(cityId);
    const cityDoc = await cityRef.get();
    if (!cityDoc.exists) {
      return res.status(404).json({ error: 'Ciudad no encontrada' });
    }
    const cityName = cityDoc.data().nombre;

    // No permitir borrar si hay ofertas o workers usando la ciudad (por id o nombre).
    for (const value of [cityId, cityName]) {
      if (!value) continue;
      const offers = await db.collection('jobOffers').where('city', '==', value).limit(1).get();
      if (!offers.empty) {
        return res.status(400).json({
          error: 'No se puede eliminar. Hay ofertas usando esta ciudad. Desactivala en su lugar.'
        });
      }
      const workers = await db.collection('workers').where('city', '==', value).limit(1).get();
      if (!workers.empty) {
        return res.status(400).json({
          error: 'No se puede eliminar. Hay perfiles usando esta ciudad. Desactivala en su lugar.'
        });
      }
    }

    await cityRef.delete();
    citiesService.ensureLoaded(true).catch(() => {});

    res.json({ message: 'Ciudad eliminada correctamente' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LEADS CRUD (Waitlist)
// ============================================

// GET /api/admin/leads - List all leads
router.get('/leads', async (req, res, next) => {
  try {
    const db = getDb();
    const { contacted, rubroId, limit = 50, offset = 0 } = req.query;

    let query = db.collection('leads');

    if (contacted !== undefined) {
      query = query.where('contacted', '==', contacted === 'true');
    }

    if (rubroId) {
      query = query.where('rubroId', '==', rubroId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    const leads = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    }));

    // Simple pagination
    const paginated = leads.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      leads: paginated,
      total: leads.length,
      limit: Number(limit),
      offset: Number(offset)
    });
  } catch (error) {
    // If orderBy fails due to missing index, sort in memory
    if (error.code === 9) {
      try {
        const db = getDb();
        const snapshot = await db.collection('leads').get();
        let leads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        }));

        // Apply filters in memory
        if (req.query.contacted !== undefined) {
          const contactedFilter = req.query.contacted === 'true';
          leads = leads.filter(l => l.contacted === contactedFilter);
        }
        if (req.query.rubroId) {
          leads = leads.filter(l => l.rubroId === req.query.rubroId);
        }

        // Sort by createdAt desc
        leads.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        const limit = Number(req.query.limit) || 50;
        const offset = Number(req.query.offset) || 0;
        const paginated = leads.slice(offset, offset + limit);

        return res.json({
          leads: paginated,
          total: leads.length,
          limit,
          offset
        });
      } catch (err) {
        return next(err);
      }
    }
    next(error);
  }
});

// GET /api/admin/leads/stats - Get leads statistics
router.get('/leads/stats', async (req, res, next) => {
  try {
    const db = getDb();

    const leadsSnapshot = await db.collection('leads').get();
    const leads = leadsSnapshot.docs.map(doc => doc.data());

    const total = leads.length;
    const contacted = leads.filter(l => l.contacted).length;
    const pending = leads.filter(l => !l.contacted).length;

    // Count by rubro
    const byRubro = {};
    leads.forEach(lead => {
      const rubro = lead.rubroNombre || lead.rubroId || 'Sin rubro';
      byRubro[rubro] = (byRubro[rubro] || 0) + 1;
    });

    res.json({
      total,
      contacted,
      pending,
      byRubro
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/admin/leads/:leadId - Update lead (mark as contacted, etc)
router.patch('/leads/:leadId', async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const db = getDb();

    const leadRef = db.collection('leads').doc(leadId);
    const leadDoc = await leadRef.get();

    if (!leadDoc.exists) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    const updates = { updatedAt: new Date() };
    const allowedFields = ['contacted', 'notes'];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'contacted') {
          updates[field] = Boolean(req.body[field]);
        } else {
          updates[field] = req.body[field];
        }
      }
    }

    await leadRef.update(updates);

    const updatedDoc = await leadRef.get();

    res.json({
      id: updatedDoc.id,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.() || updatedDoc.data().createdAt,
      updatedAt: updatedDoc.data().updatedAt?.toDate?.() || updatedDoc.data().updatedAt
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/leads/:leadId - Delete lead
router.delete('/leads/:leadId', async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const db = getDb();

    const leadRef = db.collection('leads').doc(leadId);
    const leadDoc = await leadRef.get();

    if (!leadDoc.exists) {
      return res.status(404).json({ error: 'Lead no encontrado' });
    }

    await leadRef.delete();

    res.json({ message: 'Lead eliminado correctamente' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SETTINGS (Configuración general)
// ============================================

// GET /api/admin/settings/terms - Get terms and conditions
router.get('/settings/terms', async (req, res, next) => {
  try {
    const db = getDb();
    const termsDoc = await db.collection('settings').doc('terms').get();

    if (!termsDoc.exists) {
      return res.json({
        content: '',
        updatedAt: null,
        updatedBy: null
      });
    }

    const data = termsDoc.data();
    res.json({
      content: data.content || '',
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      updatedBy: data.updatedBy || null
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/settings/terms - Update terms and conditions
router.put('/settings/terms', async (req, res, next) => {
  try {
    const { content, confirmUpdate } = req.body;

    // Require double confirmation
    if (!confirmUpdate) {
      return res.status(400).json({
        error: 'Se requiere confirmación para actualizar los términos',
        requireConfirmation: true
      });
    }

    if (content === undefined) {
      return res.status(400).json({ error: 'El contenido es requerido' });
    }

    const db = getDb();
    const termsRef = db.collection('settings').doc('terms');

    await termsRef.set({
      content: content,
      updatedAt: new Date(),
      updatedBy: req.user.uid
    }, { merge: true });

    const updatedDoc = await termsRef.get();
    const data = updatedDoc.data();

    res.json({
      message: 'Términos actualizados correctamente',
      content: data.content,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      updatedBy: data.updatedBy
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/settings/whatsapp-template - Get WhatsApp message template
router.get('/settings/whatsapp-template', async (req, res, next) => {
  try {
    const db = getDb();
    const templateDoc = await db.collection('settings').doc('whatsapp-template').get();

    if (!templateDoc.exists) {
      // Return default template
      return res.json({
        template: 'Hola {{nombre}}! Te contactamos de LaburoYA. Tenemos ofertas de trabajo que podrían interesarte.',
        updatedAt: null,
        updatedBy: null
      });
    }

    const data = templateDoc.data();
    res.json({
      template: data.template || '',
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      updatedBy: data.updatedBy || null
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/settings/whatsapp-template - Update WhatsApp message template
router.put('/settings/whatsapp-template', async (req, res, next) => {
  try {
    const { template } = req.body;

    if (template === undefined) {
      return res.status(400).json({ error: 'El template es requerido' });
    }

    const db = getDb();
    const templateRef = db.collection('settings').doc('whatsapp-template');

    await templateRef.set({
      template: template,
      updatedAt: new Date(),
      updatedBy: req.user.uid
    }, { merge: true });

    const updatedDoc = await templateRef.get();
    const data = updatedDoc.data();

    res.json({
      message: 'Template actualizado correctamente',
      template: data.template,
      updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      updatedBy: data.updatedBy
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SECURITY (PIN admin)
// ============================================

router.get('/security/pin-status', async (req, res, next) => {
  try {
    const isSet = await adminSecurity.isPinSet();
    res.json({ isSet });
  } catch (error) {
    next(error);
  }
});

router.post('/security/set-initial-pin', async (req, res, next) => {
  try {
    const { pin } = req.body;
    await adminSecurity.setInitialPin({ pin, updatedBy: req.user.uid });
    res.json({ message: 'PIN inicial configurado' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/security/change-pin', async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body;
    await adminSecurity.changePin({ currentPin, newPin, updatedBy: req.user.uid });
    res.json({ message: 'PIN actualizado' });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/security/verify-pin', async (req, res, next) => {
  try {
    const { pin } = req.body;
    const result = await adminSecurity.verifyPin(pin);
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// ============================================
// AI CONFIG
// ============================================

router.get('/ai-config', async (req, res, next) => {
  try {
    const config = await aiProvider.getAiConfigPublic();
    res.json({ ...config, supportedProviders: aiProvider.SUPPORTED_PROVIDERS, models: aiProvider.MODELS });
  } catch (error) {
    next(error);
  }
});

router.post('/ai-config', async (req, res, next) => {
  try {
    adminSecurity.requirePinToken(req);
    const { provider, apiKey } = req.body;
    if (!provider && !apiKey) {
      return res.status(400).json({ error: 'Debe enviar provider y/o apiKey' });
    }
    await aiProvider.updateAiConfig({ provider, apiKey, updatedBy: req.user.uid });
    const updated = await aiProvider.getAiConfigPublic();
    res.json({ message: 'Configuración actualizada', ...updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/ai-config/reveal', async (req, res, next) => {
  try {
    adminSecurity.requirePinToken(req);
    const apiKey = await aiProvider.getAiApiKeyPlain();
    if (!apiKey) return res.status(404).json({ error: 'No hay API key configurada' });
    res.json({ apiKey });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// ============================================
// AI PROMPTS (editables, fallback a defaults)
// ============================================

router.get('/ai-prompts', async (req, res, next) => {
  try {
    const prompts = await aiProvider.getAiPromptsPublic();
    res.json(prompts);
  } catch (error) {
    next(error);
  }
});

router.post('/ai-prompts', async (req, res, next) => {
  try {
    adminSecurity.requirePinToken(req);
    const { parsePrompt, assessPrompt } = req.body;
    if (parsePrompt === undefined && assessPrompt === undefined) {
      return res.status(400).json({ error: 'Debe enviar parsePrompt y/o assessPrompt' });
    }
    await aiProvider.updateAiPrompts({ parsePrompt, assessPrompt, updatedBy: req.user.uid });
    const updated = await aiProvider.getAiPromptsPublic();
    res.json({ message: 'Prompts actualizados', ...updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// ============================================
// PARSE CV (PDF → datos para crear worker)
// ============================================

router.post('/parse-cv', pdfUpload.single('pdf'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo PDF (campo "pdf")' });
    }
    const useAi = req.body.useAi === 'true' || req.body.useAi === true;

    const heuristic = await pdfParser.parseHeuristic(req.file.buffer);

    if (!useAi) {
      return res.json({
        mode: 'heuristic',
        rawText: heuristic.text,
        fields: heuristic.fields
      });
    }

    let aiFields;
    try {
      aiFields = await aiProvider.parseCvWithAi(heuristic.text);
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ error: `Error al usar IA: ${err.message}` });
    }

    // Merge: fields explicitly returned by IA take precedence; fall back to heuristic
    const merged = {
      firstName: aiFields.firstName || heuristic.fields.firstName,
      lastName: aiFields.lastName || heuristic.fields.lastName,
      email: aiFields.email || heuristic.fields.email,
      phone: aiFields.phone || heuristic.fields.phone,
      rubro: aiFields.rubro || null,
      puesto: aiFields.puesto || null,
      zona: normalizeZona(aiFields.zona) || aiFields.zona || null,
      description: aiFields.description || null,
      experience: aiFields.experience || null,
      skills: Array.isArray(aiFields.skills) ? aiFields.skills : []
    };

    res.json({
      mode: 'ai',
      rawText: heuristic.text,
      fields: merged
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

// ----- Errores de IA (evaluación de CV) -----

// List recent AI errors (newest first)
router.get('/ai-errors', async (req, res, next) => {
  try {
    const db = getDb();
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    let snapshot;
    try {
      snapshot = await db.collection('aiErrors').orderBy('createdAt', 'desc').limit(limit).get();
    } catch (err) {
      // Fallback si falta el índice: traer y ordenar en memoria.
      snapshot = await db.collection('aiErrors').get();
    }
    let errors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    }));
    errors.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    errors = errors.slice(0, limit);
    res.json({ errors });
  } catch (error) {
    next(error);
  }
});

// Clear all AI errors
router.delete('/ai-errors', async (req, res, next) => {
  try {
    const db = getDb();
    const snapshot = await db.collection('aiErrors').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    res.json({ message: 'Errores eliminados', deleted: snapshot.size });
  } catch (error) {
    next(error);
  }
});

// Delete a single AI error
router.delete('/ai-errors/:id', async (req, res, next) => {
  try {
    const db = getDb();
    await db.collection('aiErrors').doc(req.params.id).delete();
    res.json({ message: 'Error eliminado' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
