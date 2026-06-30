// Validación ("claim") de perfiles migrados del talent pool. Públicos: el
// claimToken (en el link del mail) es la credencial; no requieren authMiddleware.

const express = require('express');
const { getDb, getAuth } = require('../config/firebase');
const talentProspects = require('../services/talentProspects');

const router = express.Router();

// GET /api/prospects/:token - Preview del perfil a validar
router.get('/:token', async (req, res, next) => {
  try {
    const prospect = await talentProspects.getByToken(getDb(), req.params.token);
    if (!prospect) {
      return res.status(404).json({ error: 'Link inválido o vencido' });
    }
    if (prospect.status === 'claimed') {
      return res.status(409).json({ error: 'Este perfil ya fue validado', alreadyClaimed: true });
    }
    res.json({ prospect });
  } catch (error) {
    next(error);
  }
});

// POST /api/prospects/:token/claim { password } - Crea/activa el worker
router.post('/:token/claim', async (req, res, next) => {
  try {
    const { password } = req.body || {};
    const result = await talentProspects.claim(getDb(), getAuth(), req.params.token, { password });
    res.json({ success: true, ...result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

module.exports = router;
