const express = require('express');
const { getDb } = require('../config/firebase');

const router = express.Router();

// POST /api/leads - Create a new lead (PUBLIC - no auth required)
router.post('/', async (req, res, next) => {
  try {
    const { nombre, telefono, rubroId } = req.body;

    // Validations
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    if (!telefono || telefono.trim() === '') {
      return res.status(400).json({ error: 'El teléfono es requerido' });
    }
    if (!rubroId || rubroId.trim() === '') {
      return res.status(400).json({ error: 'El rubro es requerido' });
    }

    // Validate phone format (Argentina)
    const cleanPhone = telefono.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ error: 'El teléfono debe tener al menos 10 dígitos' });
    }

    const db = getDb();

    // Check if phone already exists
    const existingLead = await db.collection('leads')
      .where('telefono', '==', cleanPhone)
      .limit(1)
      .get();

    if (!existingLead.empty) {
      return res.status(400).json({ error: 'Este teléfono ya está registrado. ¡Te avisaremos pronto!' });
    }

    // Get rubro info
    const rubroDoc = await db.collection('rubros').doc(rubroId).get();
    const rubroNombre = rubroDoc.exists ? rubroDoc.data().nombre : rubroId;

    const leadData = {
      nombre: nombre.trim(),
      telefono: cleanPhone,
      rubroId: rubroId.trim(),
      rubroNombre,
      contacted: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const leadRef = await db.collection('leads').add(leadData);

    res.status(201).json({
      success: true,
      message: '¡Gracias! Te avisaremos cuando tengamos ofertas para vos.',
      id: leadRef.id
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
