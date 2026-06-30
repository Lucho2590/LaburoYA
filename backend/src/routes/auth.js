const express = require('express');
const { getDb, getAuth } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const { isSuperuserEmail } = require('../utils/superuser');
const { lookupIp } = require('../services/ipGeolocation');
const companySubscription = require('../utils/companySubscription');

const router = express.Router();

// Register/update user role
router.post('/register', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { role, referralSource } = req.body;

    if (!role || !['worker', 'employer', 'superuser'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "worker", "employer", or "superuser"' });
    }

    const db = getDb();

    // Create or update user document
    const userData = {
      uid,
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Agregar referralSource si existe
    if (referralSource) {
      userData.referralSource = referralSource;
    }

    await db.collection('users').doc(uid).set(userData, { merge: true });

    res.json({
      message: 'User registered successfully',
      uid,
      role
    });
  } catch (error) {
    next(error);
  }
});

// Get current user info
router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const { uid, email } = req.user;
    const db = getDb();

    const userDoc = await db.collection('users').doc(uid).get();

    let userData;
    if (userDoc.exists) {
      userData = userDoc.data();
    } else if (isSuperuserEmail(email)) {
      // Las cuentas @laburoya.com son superusers y no completan onboarding.
      // Autoaprovisionamos un doc mínimo (sin perfil) para que el resto del
      // backend (role-based) funcione sin tratamiento especial por endpoint.
      userData = {
        uid,
        role: 'superuser',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await db.collection('users').doc(uid).set(userData, { merge: true });
    } else {
      return res.status(404).json({ error: 'User not found' });
    }

    let profileData = null;
    let impersonating = null;
    let companySub = null;

    // Rol efectivo. Para superusers: impersonar una empresa gana sobre el
    // secondaryRole (worker/employer); si no hay nada, es superuser puro.
    let effectiveRole;
    if (userData.role === 'superuser') {
      effectiveRole = userData.impersonatingCompanyId ? 'company' : userData.secondaryRole;
    } else {
      effectiveRole = userData.role;
    }

    if (effectiveRole === 'worker') {
      const workerDoc = await db.collection('workers').doc(uid).get();
      if (workerDoc.exists) {
        profileData = workerDoc.data();
      }
    } else if (effectiveRole === 'employer') {
      const employerDoc = await db.collection('employers').doc(uid).get();
      if (employerDoc.exists) {
        profileData = employerDoc.data();
      }
    } else if (effectiveRole === 'company') {
      // El perfil de empresa es uno solo, el de la organización. Para el dueño
      // organizationId === uid; para un miembro es el uid de la empresa madre.
      // Superuser impersonando: el uid de la empresa impersonada.
      const companyUid = userData.role === 'superuser'
        ? userData.impersonatingCompanyId
        : (userData.organizationId || uid);
      const companyDoc = await db.collection('companies').doc(companyUid).get();
      if (companyDoc.exists) {
        profileData = companyDoc.data();
        companySub = companySubscription.summarize(profileData, new Date());
        if (userData.role === 'superuser') {
          impersonating = { companyId: companyUid, businessName: profileData.businessName || null };
        }
      }
    }

    res.json({
      user: userData,
      profile: profileData,
      ...(impersonating ? { impersonating } : {}),
      ...(companySub ? { companySubscription: companySub } : {})
    });
  } catch (error) {
    next(error);
  }
});

// Update basic info (name, lastName, phone, age, nickname)
router.patch('/basic-info', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { firstName, lastName, phone, age, nickname, businessName, contactName } = req.body;

    // For employers, businessName and contactName are required instead of lastName
    if (businessName) {
      if (!contactName) {
        return res.status(400).json({ error: 'contactName is required for employers' });
      }
    } else if (!firstName || !lastName) {
      return res.status(400).json({ error: 'firstName and lastName are required' });
    }

    const db = getDb();

    // Build update data
    const updateData = {
      firstName,
      lastName,
      phone: phone || null,
      age: age || null,
      nickname: nickname || null,
      onboardingCompleted: true,
      updatedAt: new Date()
    };

    // Add employer-specific fields if provided
    if (businessName !== undefined) updateData.businessName = businessName || null;
    if (contactName !== undefined) updateData.contactName = contactName || null;

    await db.collection('users').doc(uid).update(updateData);

    res.json({
      message: 'Basic info updated successfully',
      firstName,
      lastName,
      phone,
      age,
      nickname,
      businessName,
      contactName
    });
  } catch (error) {
    next(error);
  }
});

// Set secondary role for superusers
router.patch('/secondary-role', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { secondaryRole } = req.body;

    if (!secondaryRole || !['worker', 'employer'].includes(secondaryRole)) {
      return res.status(400).json({ error: 'Invalid secondaryRole. Must be "worker" or "employer"' });
    }

    const db = getDb();

    // Verify user is a superuser
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can set a secondary role' });
    }

    // Update secondaryRole
    await db.collection('users').doc(uid).update({
      secondaryRole,
      updatedAt: new Date()
    });

    res.json({
      message: 'Secondary role updated successfully',
      secondaryRole
    });
  } catch (error) {
    next(error);
  }
});

// Superuser: impersonate a company (entrar a su perfil, como secondaryRole pero
// apuntando a una empresa concreta). Mientras está activo, /me y los endpoints
// company-scoped actúan como esa empresa.
router.patch('/impersonate-company', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { companyId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    const db = getDb();

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can impersonate a company' });
    }

    const companyDoc = await db.collection('companies').doc(companyId).get();
    if (!companyDoc.exists) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await db.collection('users').doc(uid).update({
      impersonatingCompanyId: companyId,
      updatedAt: new Date()
    });

    res.json({
      message: 'Impersonating company',
      companyId,
      businessName: companyDoc.data().businessName || null
    });
  } catch (error) {
    next(error);
  }
});

// Superuser: stop impersonating the current company.
router.delete('/impersonate-company', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists || userDoc.data().role !== 'superuser') {
      return res.status(403).json({ error: 'Only superusers can stop impersonating' });
    }

    await db.collection('users').doc(uid).update({
      impersonatingCompanyId: null,
      updatedAt: new Date()
    });

    res.json({ message: 'Stopped impersonating company' });
  } catch (error) {
    next(error);
  }
});

// Update user location (IP-based geolocation, resuelta server-side).
// El lookup se hace en el backend para evitar Mixed Content en el browser
// (ver services/ipGeolocation.js). No usa el body: la ubicación se deriva de
// la IP real del cliente (x-forwarded-for cuando estamos detrás del proxy).
router.patch('/location', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;

    const clientIp =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    const location = await lookupIp(clientIp);

    const db = getDb();

    // Update user document with location info (best-effort: si el lookup falló,
    // location es null y guardamos campos vacíos, pero igual marcamos el login).
    await db.collection('users').doc(uid).update({
      lastLocation: {
        city: location?.city || null,
        region: location?.region || null,
        country: location?.country || null,
        updatedAt: new Date()
      },
      lastLoginAt: new Date(),
      updatedAt: new Date()
    });

    res.json({
      message: 'Location updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Check if email exists (for password reset)
router.post('/check-email', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const auth = getAuth();

    try {
      await auth.getUserByEmail(email);
      res.json({ exists: true });
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        return res.status(404).json({ error: 'No existe una cuenta con ese email', exists: false });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
