const { createWorker } = require('tesseract.js');
const sharp = require('sharp');

// Preprocess an image for better OCR: grayscale + contrast normalize + upscale
// small images. Falls back to the original buffer if sharp fails.
async function preprocess(buffer) {
  try {
    return await sharp(buffer)
      .grayscale()
      .normalize()
      .resize({ width: 2000, withoutEnlargement: false })
      .png()
      .toBuffer();
  } catch {
    return buffer;
  }
}

// Cache a single Spanish worker across requests (language data downloads once).
let workerPromise = null;
function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('spa').catch((e) => {
      workerPromise = null; // allow retry on next call
      throw e;
    });
  }
  return workerPromise;
}

/**
 * OCR a (likely scanned) PDF: rasterizes each page to an image and runs
 * Tesseract over it. Returns the concatenated recognized text.
 * Throws an Error with .status = 422 if it can't read the document.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function ocrPdf(buffer) {
  try {
    const { pdf } = await import('pdf-to-img');
    const worker = await getWorker();
    // Higher scale → sharper images → better OCR of stylised/large headings.
    const document = await pdf(buffer, { scale: 3 });

    const parts = [];
    for await (const pageImage of document) {
      const { data } = await worker.recognize(await preprocess(pageImage));
      if (data?.text) parts.push(data.text);
    }
    return parts.join('\n').trim();
  } catch (e) {
    const err = new Error('No pudimos leer el CV (¿es una imagen de baja calidad?).');
    err.status = 422;
    err.cause = e;
    throw err;
  }
}

/**
 * OCR an image buffer (JPG/PNG) directly with Tesseract.
 * Throws an Error with .status = 422 if it can't read the image.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
async function ocrImage(buffer) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(await preprocess(buffer));
    return (data?.text || '').trim();
  } catch (e) {
    const err = new Error('No pudimos leer la imagen del CV (¿es de baja calidad?).');
    err.status = 422;
    err.cause = e;
    throw err;
  }
}

module.exports = { ocrPdf, ocrImage };
