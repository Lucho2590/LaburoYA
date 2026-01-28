const { getDb } = require('../config/firebase');

async function superuserMiddleware(req, res, next) {
  try {
    // Requires authMiddleware to have run first
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const db = getDb();
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(403).json({ error: 'User not found' });
    }

    const userData = userDoc.data();

    if (userData.role !== 'superuser') {
      return res.status(403).json({ error: 'Access denied. Superuser privileges required.' });
    }

    // Attach user data to request for convenience
    req.userData = userData;
    next();
  } catch (error) {
    console.error('Superuser middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { superuserMiddleware };
