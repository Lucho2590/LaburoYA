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

      return {
        id: doc.id,
        ...data,
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

module.exports = router;
