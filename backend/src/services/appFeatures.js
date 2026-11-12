// Feature flags de la app, guardados en `appConfig/features`.
//  - aiEnabled: interruptor GLOBAL de la IA (default APAGADO). Si está off,
//    nada llama al proveedor de IA: la evaluación de CV usa el modo básico y el
//    front oculta todo lo de IA (salvo el panel /sudo).
//  - cvCheckEnabled: análisis público de CV (/evaluar-cv). Como es 100% IA, el
//    valor efectivo requiere además aiEnabled.
const { getDb } = require('../config/firebase');

const FEATURES_DOC = 'features';

async function readRaw() {
  const db = getDb();
  const doc = await db.collection('appConfig').doc(FEATURES_DOC).get();
  return doc.exists ? doc.data() : {};
}

// Valores efectivos (los que respetan la landing y el backend).
async function getFeatures() {
  const data = await readRaw();
  const aiEnabled = data.aiEnabled === true;
  return {
    aiEnabled,
    cvCheckEnabled: aiEnabled && data.cvCheckEnabled !== false,
  };
}

// Para el admin: efectivos + lo guardado en crudo (para los switches).
async function getAdminFeatures() {
  const data = await readRaw();
  const effective = await getFeatures();
  return {
    ...effective,
    cvCheckEnabledRaw: data.cvCheckEnabled !== false,
  };
}

async function isAiEnabled() {
  const { aiEnabled } = await getFeatures();
  return aiEnabled;
}

async function isCvCheckEnabled() {
  const { cvCheckEnabled } = await getFeatures();
  return cvCheckEnabled;
}

async function setFeatures({ cvCheckEnabled, aiEnabled, updatedBy }) {
  const db = getDb();
  const patch = { updatedAt: new Date(), updatedBy: updatedBy || null };
  if (typeof cvCheckEnabled === 'boolean') patch.cvCheckEnabled = cvCheckEnabled;
  if (typeof aiEnabled === 'boolean') patch.aiEnabled = aiEnabled;
  await db.collection('appConfig').doc(FEATURES_DOC).set(patch, { merge: true });
  return getAdminFeatures();
}

module.exports = { getFeatures, getAdminFeatures, isAiEnabled, isCvCheckEnabled, setFeatures };
