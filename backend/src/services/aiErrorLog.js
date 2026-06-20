// Registro de errores de evaluación de CV (colección Firestore `aiErrors`).
// Se muestra en el admin (/sudo/ai-settings → pestaña "Errores") para diagnóstico.

// Deriva un tipo legible a partir del error clasificado por friendlyAiError (aiProvider.js).
function classifyType(error) {
  if (!error) return 'unknown_error';
  if (error.rateLimited) return 'rate_limited';
  const status = Number(error.status) || 0;
  const text = `${error.message || ''} ${error.cause?.message || ''}`.toLowerCase();

  if (status === 400 && /no est[áa] configurada|configurala/.test(text)) return 'ai_not_configured';
  if (/api[_ ]?key|invalid key|unauthor|permission denied/.test(text)) return 'api_key_invalid';
  if (/not found|does not exist|no such model|modelo de ia/.test(text)) return 'model_not_found';
  if (/ocr/.test(text)) return 'ocr_not_supported';
  if (/json|unexpected token|parse|safety|blocked|respuesta inesperada/.test(text)) return 'parse_error';
  if (/no se pudo leer|ileg|empty|vac[íi]o|extract/.test(text)) return 'unreadable_file';
  if (status >= 500 || status === 502 || status === 503) return 'generic_ai_error';
  return 'generic_ai_error';
}

// Best-effort: nunca lanza; loguea en consola si falla la escritura.
async function logAiError(db, { employerId, employerEmail, offerId, fileName, mimeType, fileSize, error } = {}) {
  try {
    await db.collection('aiErrors').add({
      employerId: employerId || null,
      employerEmail: employerEmail || null,
      offerId: offerId || null,
      fileName: fileName || null,
      mimeType: mimeType || null,
      fileSize: Number(fileSize) || null,
      type: classifyType(error),
      status: Number(error?.status) || null,
      rateLimited: !!error?.rateLimited,
      rateScope: error?.rateScope || null,
      message: error?.message || null,
      cause: error?.cause?.message || null,
      createdAt: new Date()
    });
  } catch (e) {
    console.error('[aiErrorLog] no se pudo registrar el error de IA:', e.message);
  }
}

module.exports = { logAiError, classifyType };
