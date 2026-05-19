const { PDFParse } = require('pdf-parse');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Loose Argentine-friendly phone regex: any 8-15 digits with optional separators and country code
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;

async function extractText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function extractEmail(text) {
  const matches = text.match(EMAIL_REGEX);
  return matches?.[0] || null;
}

function extractPhone(text) {
  if (!text) return null;
  const matches = text.match(PHONE_REGEX) || [];
  // Prefer matches with 8+ digits to avoid catching things like dates
  const candidates = matches
    .map(m => ({ raw: m.trim(), digits: m.replace(/\D/g, '') }))
    .filter(c => c.digits.length >= 8 && c.digits.length <= 15);
  return candidates[0]?.raw || null;
}

function extractName(text) {
  if (!text) return { firstName: null, lastName: null };
  // Heuristic: scan first 8 non-empty lines for one that looks like "Firstname Lastname"
  // i.e. 2-4 words, all starting with uppercase letter, no digits, no @, no special chars
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 8);
  for (const line of lines) {
    if (line.length > 60 || /\d|@|:/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    const allTitleCase = words.every(w =>
      /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'-]+$/.test(w)
    );
    if (allTitleCase) {
      return {
        firstName: words[0],
        lastName: words.slice(1).join(' ')
      };
    }
  }
  return { firstName: null, lastName: null };
}

async function parseHeuristic(buffer) {
  const text = await extractText(buffer);
  if (!text) {
    const error = new Error('No se pudo extraer texto del PDF (¿está escaneado como imagen?)');
    error.status = 422;
    throw error;
  }
  const { firstName, lastName } = extractName(text);
  return {
    text,
    fields: {
      firstName,
      lastName,
      email: extractEmail(text),
      phone: extractPhone(text)
    }
  };
}

module.exports = { extractText, parseHeuristic };
