const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/firebase');

const PIN_TOKEN_TTL_SECONDS = 5 * 60;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

function isValidPinFormat(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

async function getPinDoc() {
  const db = getDb();
  const doc = await db.collection('appConfig').doc('securityConfig').get();
  return doc.exists ? doc.data() : null;
}

async function isPinSet() {
  const data = await getPinDoc();
  return Boolean(data?.adminPinHash);
}

async function setInitialPin({ pin, updatedBy }) {
  if (!isValidPinFormat(pin)) {
    const err = new Error('El PIN debe ser de 4 dígitos');
    err.status = 400;
    throw err;
  }
  const existing = await isPinSet();
  if (existing) {
    const err = new Error('El PIN ya está configurado. Usá change-pin para cambiarlo.');
    err.status = 400;
    throw err;
  }
  const db = getDb();
  await db.collection('appConfig').doc('securityConfig').set({
    adminPinHash: hashPin(pin),
    updatedAt: new Date(),
    updatedBy: updatedBy || null
  });
}

async function changePin({ currentPin, newPin, updatedBy }) {
  if (!isValidPinFormat(newPin)) {
    const err = new Error('El nuevo PIN debe ser de 4 dígitos');
    err.status = 400;
    throw err;
  }
  const data = await getPinDoc();
  if (!data?.adminPinHash) {
    const err = new Error('No hay PIN configurado. Usá set-initial primero.');
    err.status = 400;
    throw err;
  }
  if (hashPin(currentPin) !== data.adminPinHash) {
    const err = new Error('PIN actual incorrecto');
    err.status = 401;
    throw err;
  }
  const db = getDb();
  await db.collection('appConfig').doc('securityConfig').set({
    adminPinHash: hashPin(newPin),
    updatedAt: new Date(),
    updatedBy: updatedBy || null
  });
}

async function verifyPin(pin) {
  const data = await getPinDoc();
  if (!data?.adminPinHash) {
    const err = new Error('No hay PIN configurado');
    err.status = 400;
    throw err;
  }
  if (hashPin(pin) !== data.adminPinHash) {
    const err = new Error('PIN incorrecto');
    err.status = 401;
    throw err;
  }
  const token = jwt.sign({ scope: 'admin-pin' }, getJwtSecret(), { expiresIn: PIN_TOKEN_TTL_SECONDS });
  return { token, expiresIn: PIN_TOKEN_TTL_SECONDS };
}

function requirePinToken(req) {
  const header = req.headers['x-pin-token'];
  if (!header || typeof header !== 'string') {
    const err = new Error('Se requiere validar el PIN antes de esta acción');
    err.status = 401;
    throw err;
  }
  try {
    const payload = jwt.verify(header, getJwtSecret());
    if (payload.scope !== 'admin-pin') {
      throw new Error('Token inválido');
    }
  } catch {
    const err = new Error('Token de PIN inválido o expirado');
    err.status = 401;
    throw err;
  }
}

module.exports = {
  isPinSet,
  setInitialPin,
  changePin,
  verifyPin,
  requirePinToken
};
