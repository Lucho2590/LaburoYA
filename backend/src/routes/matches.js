const express = require('express');
const { getDb } = require('../config/firebase');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');

const router = express.Router();

// Get matches for current user
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const db = getDb();

    // Get user role
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { role } = userDoc.data();
    const matches = await matchingService.getMatchesForUser(uid, role);

    res.json(matches);
  } catch (error) {
    next(error);
  }
});

// Update match status (accept/reject)
router.patch('/:id/status', authMiddleware, async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "accepted" or "rejected"' });
    }

    const result = await matchingService.updateMatchStatus(id, uid, status);
    res.json(result);
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (error.message === 'Match not found') {
      return res.status(404).json({ error: 'Match not found' });
    }
    next(error);
  }
});

module.exports = router;
