// Feature flags de la app, guardados en `appConfig/features`. Por ahora sólo
// controla si el análisis público de CV (/evaluar-cv) está habilitado. El admin
// lo prende/apaga y la landing + el backend del cv-check lo respetan.
const { getDb } = require('../config/firebase');

const FEATURES_DOC = 'features';

async function getFeatures() {
  const db = getDb();
  const doc = await db.collection('appConfig').doc(FEATURES_DOC).get();
  const data = doc.exists ? doc.data() : {};
  return {
    // Default habilitado: sólo se oculta si el admin lo apagó explícitamente.
    cvCheckEnabled: data.cvCheckEnabled !== false,
  };
}

async function isCvCheckEnabled() {
  const { cvCheckEnabled } = await getFeatures();
  return cvCheckEnabled;
}

async function setFeatures({ cvCheckEnabled, updatedBy }) {
  const db = getDb();
  const patch = { updatedAt: new Date(), updatedBy: updatedBy || null };
  if (typeof cvCheckEnabled === 'boolean') patch.cvCheckEnabled = cvCheckEnabled;
  await db.collection('appConfig').doc(FEATURES_DOC).set(patch, { merge: true });
  return getFeatures();
}

module.exports = { getFeatures, isCvCheckEnabled, setFeatures };
