const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const matchingService = require('../services/matchingService');
const { resolveActingContext } = require('../utils/actingContext');

const router = express.Router();

// Get matches for current user
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // Los matches se guardan con employerId = uid de la organización. El cálculo
    // de rol que había acá no contemplaba impersonación ni organizationId, así
    // que una empresa no veía sus propios matches.
    const { actingUid: uid, effectiveRole, userData } = await resolveActingContext(req);

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('[Matches] GET / - Acting:', uid, 'EffectiveRole:', effectiveRole);

    const matches = await matchingService.getMatchesForUser(uid, effectiveRole);

    console.log('[Matches] Found matches:', matches.length);
    res.json(matches);
  } catch (error) {
    next(error);
  }
});

// Update match status (accept/reject)
router.patch('/:id/status', authMiddleware, async (req, res, next) => {
  try {
    // updateMatchStatus valida contra workerId/employerId del match, que para
    // una empresa es el uid de la organización.
    const { actingUid: uid } = await resolveActingContext(req);
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
