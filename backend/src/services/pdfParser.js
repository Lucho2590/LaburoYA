const { PDFParse } = require('pdf-parse');

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Loose Argentine-friendly phone regex: any 8-15 digits with optional separators and country code
const PHONE_REGEX = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
// DNI/document context and the typical dotted DNI format (e.g. "38.323.344")
const DNI_CONTEXT = /\b(d\.?\s?n\.?\s?i\.?|documento|cuil|cuit|legajo|c\.?u\.?i\.?[lt]\.?)\b/i;
const DNI_DOTTED = /^\d{1,3}(?:\.\d{3})+$/;
// Phone context labels
const PHONE_CONTEXT = /(tel[eé]fono|tel\.?|cel(ular)?|m[oó]vil|whats\s?app|wpp|contacto|llamar)/i;
// CV header / section titles and company-ish words that must NOT be taken as the name
const NAME_BLOCKLIST = /(curr[ií]culum|vitae|\bc\.?v\.?\b|resume|hoja\s+de\s+vida|datos\s+personales|sobre\s+m[ií]|perfil|profile|experiencia|laboral|profesional|educaci[oó]n|formaci[oó]n|contacto|competencias|habilidades|skills|referencias|idiomas|objetivo|conocimientos|aptitudes|acerca|intereses|informaci[oó]n|distribuidora|indumentaria|balneario|supermercado|shop)/i;
// Labelled name field, e.g. "Nombre y Apellido: Lucas Cantrel"
const NAME_LABEL = /(nombre y apellido|apellido y nombre|nombre completo|nombre|apellido)\s*[:：]\s*(.*)$/i;

async function extractText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

// Known mail providers, used to repair an "@" the OCR misread (e.g. as Q/O/©).
const MAIL_DOMAIN = '(?:gmail|hotmail|outlook|yahoo|live|icloud|proton(?:mail)?|fibertel|speedy)\\.(?:com\\.ar|com|ar)';
const EMAIL_FUZZY = new RegExp(`([a-zA-Z0-9._%+-]{2,})\\s*[@qQoO0©(\\[\\s]{1,3}(${MAIL_DOMAIN})`, 'i');

function extractEmail(text) {
  const matches = text.match(EMAIL_REGEX);
  if (matches?.[0]) return matches[0];
  // Fallback: OCR turned the "@" into another char before a known domain
  const fuzzy = text.match(EMAIL_FUZZY);
  if (fuzzy) return `${fuzzy[1]}@${fuzzy[2]}`.toLowerCase();
  return null;
}

// Argentine phone reference: prefer numbers with phone markers (+54, area code,
// "tel/cel" label, 10+ digits) and reject DNI-looking numbers (dotted 7-8 digit
// groups, or numbers on a "DNI/CUIL" line).
function extractPhone(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  let best = null;
  let bestScore = -Infinity;

  for (const line of lines) {
    const isDniLine = DNI_CONTEXT.test(line);
    const hasPhoneCtx = PHONE_CONTEXT.test(line);
    const matches = line.match(PHONE_REGEX) || [];

    for (const m of matches) {
      const raw = m.trim();
      const digits = raw.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 14) continue;
      // Reject DNI dotted format (e.g. "38.323.344") and numbers on a DNI line
      if (DNI_DOTTED.test(raw)) continue;
      if (isDniLine && !hasPhoneCtx) continue;

      let score = 0;
      if (hasPhoneCtx) score += 5;            // labelled as phone
      if (/\+?\s?54/.test(raw)) score += 3;   // Argentina country code
      if (/[()]/.test(raw)) score += 1;       // area code in parens
      if (digits.length >= 10) score += 2;    // AR phones are usually 10+ digits
      if (digits.startsWith('0') || digits.includes('15')) score += 1;
      if (digits.length === 8 && !hasPhoneCtx) score -= 2; // likely DNI

      if (score > bestScore) {
        bestScore = score;
        best = raw;
      }
    }
  }
  return best;
}

// Turns a free string into { firstName, lastName }, accepting UPPERCASE or
// Title Case. Keeps 2-4 alphabetic words; returns null if it doesn't look like a name.
function parseNameWords(val) {
  const words = (val || '').trim().split(/\s+/)
    .filter(w => /^[A-Za-zÁÉÍÓÚÑáéíóúñ'.-]{2,}$/.test(w))
    .slice(0, 4);
  if (words.length < 2) return null;
  const tc = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return { firstName: tc[0], lastName: tc.slice(1).join(' ') };
}

function extractName(text) {
  if (!text) return { firstName: null, lastName: null };
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // 1) Labelled field: "Nombre y Apellido: Lucas Cantrel" (value inline or next line)
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(NAME_LABEL);
    if (!m) continue;
    const parsed = parseNameWords(m[2]) || parseNameWords(lines[i + 1]);
    if (parsed) return parsed;
  }

  // 2) Heuristic over the first lines. A "name word" is Title Case OR ALL CAPS
  // (CV titles are often uppercase). Section titles are excluded via blocklist.
  const isNameWord = (w) =>
    /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ'.-]+$/.test(w) || /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(w);

  // Experience/date context: if a candidate is immediately followed by this, it's
  // almost surely a company/job line (e.g. "Mc Donalds" / "Temporada 2016"), not a name.
  const EXP_CONTEXT = /(temporada|20\d{2}|presente|actualidad)/i;
  const isClean = (l) => l.length <= 40 && !/[\d@:·•.,;*]/.test(l) && !NAME_BLOCKLIST.test(l);

  // Walk the first lines; skip leading section titles, then consider the FIRST
  // clean line only. Scanning deeper risks grabbing body/company text.
  const top = lines.slice(0, 6);
  let idx = 0;
  while (idx < top.length && !isClean(top[idx])) idx++;

  // 2a) First clean line with 2-4 name words, NOT followed by experience/date context.
  if (idx < top.length) {
    const words = top[idx].split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every(isNameWord)) {
      const next = top[idx + 1] || '';
      if (!EXP_CONTEXT.test(next)) {
        return parseNameWords(top[idx]);
      }
      return { firstName: null, lastName: null };
    }
  }

  // 2b) Name split across consecutive single-word lines (VICTORIA / GARCIA / DESPERÉS)
  const singles = [];
  for (const line of top.slice(idx)) {
    const words = line.split(/\s+/);
    if (isClean(line) && words.length === 1 && isNameWord(words[0])) {
      singles.push(words[0]);
      if (singles.length === 3) break;
    } else if (singles.length > 0) {
      break;
    }
  }
  if (singles.length >= 2) return parseNameWords(singles.join(' '));

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

module.exports = { extractText, parseHeuristic, extractEmail, extractPhone, extractName };
