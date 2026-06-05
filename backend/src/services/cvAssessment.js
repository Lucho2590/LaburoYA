const { getDb } = require('../config/firebase');
const mammoth = require('mammoth');
const pdfParser = require('./pdfParser');
const aiProvider = require('./aiProvider');
const ocr = require('./ocr');
const cvProfileBuilder = require('./cvProfileBuilder');
const matchingService = require('./matchingService');

// Minimum chars of extracted text to trust the text layer (else treat as scanned → OCR)
const MIN_TEXT_CHARS = 200;

/** Classify the uploaded file by mimetype and/or filename extension. */
function detectKind(mimeType, fileName) {
  const mt = (mimeType || '').toLowerCase();
  const ext = (fileName || '').toLowerCase().split('.').pop();
  if (mt === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mt.startsWith('image/') || ['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
  if (mt === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') return 'docx';
  return 'unsupported';
}

/**
 * Reads plain text from a CV file (PDF text-layer/OCR, image OCR, or .docx).
 * Throws status 422 if unsupported or unreadable.
 */
async function readCvText(buffer, mimeType, fileName) {
  const kind = detectKind(mimeType, fileName);
  let text = '';

  if (kind === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    text = (value || '').trim();
  } else if (kind === 'pdf') {
    try { text = await pdfParser.extractText(buffer); } catch { text = ''; }
    if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
      text = await ocr.ocrPdf(buffer); // scanned PDF → OCR (422 if unreadable)
    }
  } else if (kind === 'image') {
    text = await ocr.ocrImage(buffer);
  } else {
    const err = new Error('Formato no soportado. Subí un PDF, una imagen (JPG/PNG) o un Word (.docx).');
    err.status = 422;
    throw err;
  }

  if (!text || !text.trim()) {
    const err = new Error('No pudimos leer el CV.');
    err.status = 422;
    throw err;
  }
  return text;
}

/**
 * Parse a CV from a PDF buffer. Prefers the cheap text-extraction + text-AI
 * path; falls back to multimodal OCR when the PDF has no usable text layer.
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {Promise<Object>} parsed fields + `source: 'text' | 'ocr'`
 */
async function parseCv(buffer, mimeType) {
  let text = '';
  try {
    text = await pdfParser.extractText(buffer);
  } catch {
    text = '';
  }

  const hasTextLayer = text.replace(/\s/g, '').length >= MIN_TEXT_CHARS;

  if (hasTextLayer) {
    const fields = await aiProvider.parseCvWithAi(text);
    return { ...normalizeFields(fields), source: 'text' };
  }

  const fields = await aiProvider.parseCvFromPdf(buffer, mimeType);
  return { ...normalizeFields(fields), source: 'ocr' };
}

function normalizeFields(f) {
  return {
    firstName: f.firstName || null,
    lastName: f.lastName || null,
    email: f.email || null,
    phone: f.phone || null,
    rubro: f.rubro || null,
    puesto: f.puesto || null,
    zona: f.zona || null,
    description: f.description || null,
    experience: f.experience || null,
    skills: Array.isArray(f.skills) ? f.skills : []
  };
}

/**
 * AI recruiter-style assessment of a CV against an offer. Uses the text layer
 * when available, otherwise multimodal OCR. Returns the verdict + a fit score
 * understood by the model (no exact-string matching).
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @param {Object} offer
 * @returns {Promise<Object>} assessment + `source: 'text' | 'ocr'`
 */
async function assessFit(buffer, mimeType, fileName, offer) {
  const kind = detectKind(mimeType, fileName);

  if (kind === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer });
    const result = await aiProvider.assessCvFit({ offer, cvText: (value || '').trim() });
    return { ...result, source: 'text' };
  }

  if (kind === 'pdf') {
    let text = '';
    try { text = await pdfParser.extractText(buffer); } catch { text = ''; }
    if (text.replace(/\s/g, '').length >= MIN_TEXT_CHARS) {
      const result = await aiProvider.assessCvFit({ offer, cvText: text });
      return { ...result, source: 'text' };
    }
    const result = await aiProvider.assessCvFit({ offer, fileBuffer: buffer, mimeType: 'application/pdf' });
    return { ...result, source: 'ocr' };
  }

  if (kind === 'image') {
    const result = await aiProvider.assessCvFit({ offer, fileBuffer: buffer, mimeType });
    return { ...result, source: 'ocr' };
  }

  const err = new Error('Formato no soportado. Subí un PDF, una imagen (JPG/PNG) o un Word (.docx).');
  err.status = 422;
  throw err;
}

/**
 * Basic CV reading without AI: extracts the PDF text layer and basic contact
 * fields via heuristics. Throws status 422 if the PDF has no text (scanned).
 * @param {Buffer} buffer
 * @returns {Promise<{ fields: Object, text: string }>}
 */
async function parseBasic(buffer, mimeType, fileName) {
  const text = await readCvText(buffer, mimeType, fileName);
  const name = pdfParser.extractName(text);
  return {
    text,
    fields: {
      firstName: name.firstName,
      lastName: name.lastName,
      email: pdfParser.extractEmail(text),
      phone: pdfParser.extractPhone(text)
    }
  };
}

/**
 * Basic CV assessment (no AI): reads the CV (text layer or OCR), builds a
 * LaburoYA-style profile from the taxonomy + synonyms, and scores it against
 * the offer with the same engine as the real match (calculateRelevanceScore).
 * @param {Buffer} buffer
 * @param {string} _mimeType - unused (kept for signature parity)
 * @param {Object} offer
 */
async function assessBasic(buffer, mimeType, fileName, offer) {
  const { text, fields } = await parseBasic(buffer, mimeType, fileName);
  const profile = cvProfileBuilder.buildProfileFromText(text, offer);
  const result = matchingService.calculateRelevanceScore(profile, offer);
  const missingSkills = (offer.requiredSkills || []).filter(s => !result.details.matchingSkills.includes(s));

  return {
    candidate: {
      firstName: fields.firstName,
      lastName: fields.lastName,
      email: fields.email,
      phone: fields.phone,
      puesto: profile.puesto,
      zona: profile.zona,
      skills: profile.skills
    },
    assessment: {
      score: result.score,
      stars: result.stars,
      matchType: result.matchType,
      rubroMatch: result.details.rubroMatch,
      puestoMatch: result.details.puestoMatch,
      zonaMatch: result.details.zonaMatch,
      matchingSkills: result.details.matchingSkills,
      missingSkills
    }
  };
}

/**
 * Ensures the user is an employer (or a superuser acting as employer) AND has
 * the AI CV-assessment module enabled by an admin.
 * Throws an error with `.status` set on failure.
 * @param {string} uid
 * @returns {Promise<Object>} the user document data
 */
async function assertEmployerCvAccess(uid) {
  const db = getDb();
  const userDoc = await db.collection('users').doc(uid).get();

  if (!userDoc.exists) {
    const err = new Error('Usuario no encontrado');
    err.status = 404;
    throw err;
  }

  const userData = userDoc.data();
  const isEmployer =
    userData.role === 'employer' ||
    (userData.role === 'superuser' && userData.secondaryRole === 'employer');

  if (!isEmployer) {
    const err = new Error('Solo los empleadores pueden evaluar CVs');
    err.status = 403;
    throw err;
  }

  if (userData.aiCvEnabled !== true) {
    const err = new Error('El módulo de IA no está habilitado para tu cuenta. Pedile a un administrador que lo active.');
    err.status = 403;
    throw err;
  }

  return userData;
}

module.exports = {
  assertEmployerCvAccess,
  parseCv,
  assessFit,
  assessBasic
};
