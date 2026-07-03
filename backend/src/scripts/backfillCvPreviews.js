// Backfill de imágenes de preview para CVs PDF ya subidos al talent pool que
// todavía no tienen `previewUrls`. Descarga el PDF de Storage, lo rasteriza a
// PNG y actualiza el doc. Idempotente. Ejecutar con:
//   node src/scripts/backfillCvPreviews.js
require('dotenv').config();
const { initializeFirebase, getDb, getBucket } = require('../config/firebase');
const cvPreview = require('../services/cvPreview');
const cvStorage = require('../services/cvStorage');

async function backfillCvPreviews() {
  const db = getDb();
  const snap = await db.collection('companyCandidates').get();
  let done = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const filePath = data.filePath;
    const hasPreview = Array.isArray(data.previewUrls) && data.previewUrls.length > 0;
    const isPdf = typeof filePath === 'string' && filePath.toLowerCase().endsWith('.pdf');

    if (!isPdf || hasPreview || !data.organizationId || !data.fileHash) {
      skipped++;
      continue;
    }

    try {
      const [buffer] = await getBucket().file(filePath).download();
      const buffers = await cvPreview.pdfToPngBuffers(buffer);
      const { previewUrls } = await cvStorage.uploadPreviewImages(buffers, {
        organizationId: data.organizationId,
        fileHash: data.fileHash,
      });
      if (previewUrls.length) {
        await doc.ref.update({ previewUrls, updatedAt: new Date() });
        done++;
        console.log(`+ preview generado (${previewUrls.length} pág): ${doc.id}`);
      } else {
        skipped++;
      }
    } catch (e) {
      skipped++;
      console.error(`! error en ${doc.id}: ${e.message}`);
    }
  }

  console.log(`Backfill terminado. Generados: ${done}, omitidos: ${skipped}.`);
}

if (require.main === module) {
  initializeFirebase();
  backfillCvPreviews()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error en backfill de previews:', err);
      process.exit(1);
    });
}

module.exports = { backfillCvPreviews };
