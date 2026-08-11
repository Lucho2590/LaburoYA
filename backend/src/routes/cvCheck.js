// Análisis de CV público (Fase 1): una persona registrada evalúa su CV contra un
// puesto random del rubro que elige. Reutiliza el motor de IA (cvAssessment) sin
// el gating de empleador. Límite: 1 análisis por cuenta (colección `cvChecks`),
// reseteable por el admin.
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/firebase');
const cvAssessment = require('../services/cvAssessment');
const { normEmail } = require('../services/companyCandidates');
const { sendCvCheckCodeEmail } = require('../services/emailService');
const { JOB_CATEGORIES, getSuggestedSkills } = require('../utils/constants');

const router = express.Router();

const CODE_TTL_MS = 15 * 60 * 1000; // el código vence a los 15 min
const CODE_RESEND_COOLDOWN_MS = 60 * 1000; // no reenviar antes de 60s
const CODE_MAX_ATTEMPTS = 5;
const hashCode = (code, emailNorm) => crypto.createHash('sha256').update(`${code}:${emailNorm}`).digest('hex');

// Autorización propia del CV-check: un JWT corto (scope 'cv-check') que valida el
// email SIN crear sesión de Firebase (para que NO logue en la app). Identifica
// por email, no por uid.
function cvCheckAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    if (payload.scope !== 'cv-check' || !payload.email) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    req.cvEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
}

const ALLOWED_CV_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_CV_EXT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'docx']);
const cvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase().split('.').pop();
    if (ALLOWED_CV_MIME.has(file.mimetype) || ALLOWED_CV_EXT.has(ext)) return cb(null, true);
    const err = new Error('Formato no soportado. Subí un PDF, una imagen (JPG/PNG) o un Word (.docx).');
    err.status = 422;
    cb(err);
  },
});

// Arma un "offer sintético" desde un rubro: elige un puesto random del rubro y
// sus skills sugeridas, para poder correr assessFit sin una oferta real.
function buildSyntheticOffer(rubroKey) {
  const cat = JOB_CATEGORIES[rubroKey];
  if (!cat) return null;
  const puestos = cat.puestos || [];
  const puesto = puestos.length ? puestos[Math.floor(Math.random() * puestos.length)] : null;
  return {
    puesto,
    rubro: cat.label,
    city: null,
    zona: null,
    requiredSkills: getSuggestedSkills(rubroKey, puesto),
    description: '',
    requirements: '',
  };
}

function serializeCheck(data) {
  if (!data) return null;
  return {
    rubro: data.rubro || null,
    rubroKey: data.rubroKey || null,
    puesto: data.puesto || null,
    assessment: data.assessment || null,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || null,
  };
}

// Resultado previo (o null) — para que la página muestre lo ya hecho.
router.get('/me', cvCheckAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const doc = await db.collection('cvChecks').doc(req.cvEmail).get();
    res.json({ check: doc.exists ? serializeCheck(doc.data()) : null });
  } catch (error) {
    next(error);
  }
});

// Analiza el CV. 1 sola vez por email.
router.post('/analyze', cvCheckAuth, cvUpload.single('cv'), async (req, res, next) => {
  try {
    const email = req.cvEmail;
    const db = getDb();

    if (!req.file) {
      return res.status(400).json({ error: 'Falta el archivo del CV (campo "cv")' });
    }
    const rubroKey = (req.body.rubro || '').trim();
    const offer = buildSyntheticOffer(rubroKey);
    if (!offer) {
      return res.status(400).json({ error: 'Elegí un rubro válido.' });
    }

    // 1 análisis por email: si ya hay uno, devolvemos el previo (no re-analiza).
    const ref = db.collection('cvChecks').doc(email);
    const existing = await ref.get();
    if (existing.exists) {
      return res.status(409).json({
        error: 'Ya analizaste tu CV.',
        alreadyUsed: true,
        check: serializeCheck(existing.data()),
      });
    }

    const result = await cvAssessment.assessFit(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname,
      offer,
    );

    const checkData = {
      email,
      rubro: offer.rubro,
      rubroKey,
      puesto: offer.puesto,
      assessment: result,
      createdAt: new Date(),
    };
    await ref.set(checkData);

    res.json({ puesto: offer.puesto, rubro: offer.rubro, assessment: result });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
});

// --- Registro passwordless por código (valida la autenticidad del email) ---

// Pide un código: lo genera, lo guarda y lo manda por mail.
router.post('/request-code', async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ingresá un email válido.' });
    }
    const db = getDb();
    const ref = db.collection('cvCheckCodes').doc(email);
    const prev = await ref.get();
    if (prev.exists) {
      const lastSentAt = prev.data().lastSentAt?.toDate?.() || prev.data().lastSentAt;
      if (lastSentAt && Date.now() - new Date(lastSentAt).getTime() < CODE_RESEND_COOLDOWN_MS) {
        return res.status(429).json({ error: 'Esperá un momento antes de pedir otro código.' });
      }
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const now = new Date();
    await ref.set({
      email,
      codeHash: hashCode(code, email),
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
      attempts: 0,
      lastSentAt: now,
      createdAt: now,
    });

    // En desarrollo, logueamos el código para poder testear sin Resend.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[cv-check] código para ${email}: ${code}`);
    }
    try {
      await sendCvCheckCodeEmail({ to: email, code });
    } catch (e) {
      // Si no hay Resend configurado, en dev igual se puede usar el código de la consola.
      if (process.env.NODE_ENV === 'production') throw e;
      console.warn('[cv-check] no se pudo enviar el mail (dev):', e.message);
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Verifica el código y devuelve un JWT corto de CV-check (NO logea en la app).
router.post('/verify-code', async (req, res, next) => {
  try {
    const email = normEmail(req.body.email);
    const code = String(req.body.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ error: 'Faltan datos.' });
    }
    const db = getDb();
    const ref = db.collection('cvCheckCodes').doc(email);
    const doc = await ref.get();
    if (!doc.exists) {
      return res.status(400).json({ error: 'Pedí un código primero.' });
    }
    const data = doc.data();
    const expiresAt = data.expiresAt?.toDate?.() || data.expiresAt;
    if (expiresAt && Date.now() > new Date(expiresAt).getTime()) {
      await ref.delete();
      return res.status(400).json({ error: 'El código venció. Pedí uno nuevo.' });
    }
    if ((data.attempts || 0) >= CODE_MAX_ATTEMPTS) {
      await ref.delete();
      return res.status(400).json({ error: 'Demasiados intentos. Pedí un código nuevo.' });
    }
    if (data.codeHash !== hashCode(code, email)) {
      await ref.update({ attempts: (data.attempts || 0) + 1 });
      return res.status(400).json({ error: 'Código incorrecto.' });
    }

    // Código válido: el mail queda validado. Emitimos un JWT propio de CV-check
    // (no una sesión de Firebase) que solo autoriza evaluar el CV, sin loguear
    // en la app.
    await ref.delete(); // el código se usa una sola vez
    const token = jwt.sign({ scope: 'cv-check', email }, process.env.JWT_SECRET, { expiresIn: '24h' });
    res.json({ token });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
