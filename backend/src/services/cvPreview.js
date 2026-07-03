const sharp = require('sharp');

// Rasteriza un PDF a imágenes PNG (una por página) para poder mostrarlo "como
// imagen" en el front, sin la barra del visor de PDF del navegador. Reutiliza
// `pdf-to-img` (ya usado en ocr.js). Best-effort: si algo falla, devuelve [].
async function pdfToPngBuffers(buffer, { maxPages = 4 } = {}) {
  try {
    if (!buffer) return [];
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(buffer, { scale: 2 });

    const out = [];
    for await (const pageImage of document) {
      try {
        const png = await sharp(pageImage)
          .resize({ width: 1000, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
        out.push(png);
      } catch {
        out.push(pageImage); // si sharp falla, usamos el buffer crudo
      }
      if (out.length >= maxPages) break;
    }
    return out;
  } catch (e) {
    console.error('[cvPreview] no se pudo rasterizar el PDF:', e.message);
    return [];
  }
}

module.exports = { pdfToPngBuffers };
