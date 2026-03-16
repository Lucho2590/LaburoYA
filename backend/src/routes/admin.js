const express = require('express');
const { getDb, getAuth } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { superuserMiddleware } = require('../middleware/superuser');

const router = express.Router();

// Apply auth and superuser middleware to all routes
router.use(authMiddleware);
router.use(superuserMiddleware);

// GET /api/admin/stats - General statistics
router.get('/stats', async (req, res, next) => {
  try {
    const db = getDb();

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => doc.data());

    // Count users by role
    const usersByRole = {
      worker: users.filter(u => u.role === 'worker').length,
      employer: users.filter(u => u.role === 'employer').length,
      superuser: users.filter(u => u.role === 'superuser').length
    };

    // Get matches
    const matchesSnapshot = await db.collection('matches').get();
    const matches = matchesSnapshot.docs.map(doc => doc.data());

    // Count matches by status
    const matchesByStatus = {
      pending: matches.filter(m => m.status === 'pending').length,
      accepted: matches.filter(m => m.status === 'accepted').length,
      rejected: matches.filter(m => m.status === 'rejected').length
    };

    // Get job offers
    const jobOffersSnapshot = await db.collection('jobOffers').get();
    const jobOffers = jobOffersSnapshot.docs.map(doc => doc.data());

    // Count active/inactive job offers
    const activeJobOffers = jobOffers.filter(j => j.active !== false).length;
    const inactiveJobOffers = jobOffers.filter(j => j.active === false).length;

    res.json({
      totalUsers: users.length,
      usersByRole,
      totalMatches: matches.length,
      matchesByStatus,
      totalJobOffers: jobOffers.length,
      activeJobOffers,
      inactiveJobOffers
    });
  } catch (error) {
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

    if (role && ['worker', 'employer', 'superuser'].includes(role)) {
      query = query.where('role', '==', role);
      // Skip orderBy when filtering to avoid needing composite index
      useOrderBy = false;
    }

    const snapshot = useOrderBy
      ? await query.orderBy('createdAt', 'desc').get()
      : await query.get();

    // Fetch profile and auth data for each user
    const users = await Promise.all(snapshot.docs.map(async doc => {
      const userData = doc.data();
      let profile = null;
      let authData = null;
      let jobOffers = [];

      // Get Firebase Auth data (email, displayName, photoURL)
      try {
        const userRecord = await auth.getUser(doc.id);
        authData = {
          email: userRecord.email,
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL,
          phoneNumber: userRecord.phoneNumber,
          emailVerified: userRecord.emailVerified,
          disabled: userRecord.disabled
        };
      } catch (e) {
        // User might not exist in Auth
      }

      // Get profile based on role
      if (userData.role === 'worker') {
        const workerDoc = await db.collection('workers').doc(doc.id).get();
        if (workerDoc.exists) {
          profile = workerDoc.data();
        }
      } else if (userData.role === 'employer') {
        const employerDoc = await db.collection('employers').doc(doc.id).get();
        if (employerDoc.exists) {
          profile = employerDoc.data();
        }
        // Get employer's job offers
        const jobOffersSnapshot = await db.collection('jobOffers')
          .where('employerId', '==', doc.id)
          .get();
        jobOffers = jobOffersSnapshot.docs.map(j => ({
          id: j.id,
          ...j.data(),
          createdAt: j.data().createdAt?.toDate?.() || j.data().createdAt
        }));
      }

      return {
        uid: doc.id,
        ...userData,
        email: authData?.email || userData.email,
        displayName: authData?.displayName,
        photoURL: authData?.photoURL,
        phoneNumber: authData?.phoneNumber,
        emailVerified: authData?.emailVerified,
        authDisabled: authData?.disabled,
        profile,
        jobOffers: jobOffers.length > 0 ? jobOffers : undefined,
        createdAt: userData.createdAt?.toDate?.() || userData.createdAt
      };
    }));

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
    } else if (userData.role === 'employer') {
      const employerDoc = await db.collection('employers').doc(uid).get();
      if (employerDoc.exists) {
        profile = employerDoc.data();
      }
    }

    // Get user stats
    const stats = { matches: 0, jobOffers: 0, chats: 0 };

    if (userData.role === 'worker') {
      const matchesSnapshot = await db.collection('matches')
        .where('workerId', '==', uid)
        .get();
      stats.matches = matchesSnapshot.size;
    } else if (userData.role === 'employer') {
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
    const { role, disabled } = req.body;
    const db = getDb();

    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates = { updatedAt: new Date() };

    if (role !== undefined) {
      if (!['worker', 'employer', 'superuser'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      updates.role = role;
    }

    if (disabled !== undefined) {
      updates.disabled = Boolean(disabled);
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

      // Delete user document
      batch.delete(userRef);

      // Delete profile
      if (userData.role === 'worker') {
        batch.delete(db.collection('workers').doc(uid));
      } else if (userData.role === 'employer') {
        batch.delete(db.collection('employers').doc(uid));

        // Delete employer's job offers
        const jobOffersSnapshot = await db.collection('jobOffers')
          .where('employerId', '==', uid)
          .get();
        jobOffersSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      }

      await batch.commit();

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

    const jobOffers = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();

      // Get employer info
      let employer = null;
      if (data.employerId) {
        const employerDoc = await db.collection('employers').doc(data.employerId).get();
        if (employerDoc.exists) {
          employer = employerDoc.data();
        }
      }

      // Include stats (default to 0 if not present)
      const stats = data.stats || { interestedCount: 0, notInterestedCount: 0 };

      return {
        id: doc.id,
        ...data,
        stats,
        employer,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      };
    }));

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

    const matches = await Promise.all(snapshot.docs.map(async doc => {
      const data = doc.data();

      // Get worker info
      let worker = null;
      if (data.workerId) {
        const workerDoc = await db.collection('workers').doc(data.workerId).get();
        if (workerDoc.exists) {
          worker = workerDoc.data();
        }
      }

      // Get employer info
      let employer = null;
      if (data.employerId) {
        const employerDoc = await db.collection('employers').doc(data.employerId).get();
        if (employerDoc.exists) {
          employer = employerDoc.data();
        }
      }

      return {
        id: doc.id,
        ...data,
        worker,
        employer,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      };
    }));

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

module.exports = router;
