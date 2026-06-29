// Scheduler liviano sin dependencias (mismo espíritu que el seed de ciudades):
// corre tareas periódicas dentro del proceso del backend.
//
// Tarea: procesar el talent pool vencido (>6 meses) → migrar a prospectos +
// mail de validación, o descartar. Idempotente, así que correr de más es seguro.

const { getDb, getAuth } = require('../config/firebase');
const talentProspects = require('../services/talentProspects');

const DAY_MS = 24 * 60 * 60 * 1000;

async function runTalentPoolJob() {
  try {
    await talentProspects.processExpiredTalentPool(getDb(), getAuth());
  } catch (e) {
    console.warn('[scheduler] job de talent pool falló:', e.message);
  }
}

function start() {
  // Primera corrida ~1 min después del boot (deja que Firebase termine de init).
  setTimeout(runTalentPoolJob, 60 * 1000);
  // Luego, una vez por día.
  setInterval(runTalentPoolJob, DAY_MS);
  console.log('[scheduler] job diario de talent pool programado');
}

module.exports = { start, runTalentPoolJob };
