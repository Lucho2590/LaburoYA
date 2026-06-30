// Guardado del archivo original del CV en Firebase Storage.
//
// Sube el buffer del CV a `talent-pool/{organizationId}/{fileHash}.{ext}` y
// devuelve una URL estable y tokenizada (mismo formato que getDownloadURL del
// cliente), sin necesidad de firmar URLs. Todo es best-effort: si falla, el
// análisis del CV sigue funcionando con fileUrl=null.

const crypto = require('crypto');
const { getBucket } = require('../config/firebase');

// Deriva una extensión razonable del nombre original o del mime type.
function extFor(originalname, contentType) {
  const fromName = (originalname || '').toLowerCase().split('.').pop();
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return 'bin';
}

// Sube el CV y devuelve { fileUrl, filePath } o { fileUrl: null, filePath: null }.
async function uploadCv({ buffer, contentType, originalname, organizationId, fileHash }) {
  try {
    if (!buffer || !organizationId || !fileHash) return { fileUrl: null, filePath: null };
    const bucket = getBucket();
    const ext = extFor(originalname, contentType);
    const filePath = `talent-pool/${organizationId}/${fileHash}.${ext}`;
    const token = crypto.randomUUID();
    const file = bucket.file(filePath);
    await file.save(buffer, {
      resumable: false,
      contentType: contentType || 'application/octet-stream',
      metadata: {
        contentType: contentType || 'application/octet-stream',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });
    const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filePath)}?alt=media&token=${token}`;
    return { fileUrl, filePath };
  } catch (e) {
    console.error('[cvStorage] no se pudo subir el CV:', e.message);
    return { fileUrl: null, filePath: null };
  }
}

// Borra el archivo (best-effort) por su path de Storage.
async function deleteCv(filePath) {
  if (!filePath) return;
  try {
    await getBucket().file(filePath).delete();
  } catch (e) {
    // Ya no existe o falló: no bloquea.
  }
}

module.exports = { uploadCv, deleteCv };
