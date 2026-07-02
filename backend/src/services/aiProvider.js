const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb } = require('../config/firebase');
const { encrypt, decrypt, maskApiKey } = require('./crypto');

const SUPPORTED_PROVIDERS = ['claude', 'openai', 'gemini'];

const MODELS = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  // flash-lite: más rápido y con más margen de rate-limit en el free tier
  // (15 RPM vs 10). Revertir a 'gemini-2.5-flash' si baja la calidad.
  gemini: 'gemini-2.5-flash-lite'
};

// Translates raw SDK/runtime errors from the AI providers into a short,
// user-facing message. Errors we threw ourselves (they already carry a
// `.status`) pass through untouched. The original error is kept in `.cause`
// so the server logs still show the full provider message.
function friendlyAiError(error) {
  if (error && error.status) return error;
  const raw = error && error.message ? String(error.message) : '';
  const lower = raw.toLowerCase();

  let message = 'No se pudo procesar el CV con la IA. Intentá de nuevo en unos minutos.';
  let status = 502;

  if (/api[_ ]?key|invalid key|unauthor|permission denied|\b401\b|\b403\b/.test(lower)) {
    message = 'La API key de IA no es válida o no tiene permisos. Revisá la configuración en /sudo/ai-settings.';
  } else if (/not found|is not supported|does not exist|no such model|\b404\b/.test(lower)) {
    message = 'El modelo de IA configurado ya no está disponible. Avisá al administrador para que lo actualice.';
  } else if (/quota|rate.?limit|resource has been exhausted|too many requests|\b429\b/.test(lower)) {
    status = 503;
    const isDaily = /per ?day|perday|requests per day|perdayper/.test(lower);
    message = isDaily
      ? 'Se alcanzó el límite diario de la API de IA. Probá mañana o cambiá de proveedor/plan en /sudo/ai-settings.'
      : 'Se alcanzó el límite por minuto de la API de IA. Esperá un momento y reintentá.';
    const retryMatch = raw.match(/retryDelay"?\s*:?\s*"?(\d+(?:\.\d+)?)s/i) || raw.match(/retry in ([\d.]+)s/i);
    const err = new Error(message);
    err.status = status;
    err.rateLimited = true;
    err.rateScope = isDaily ? 'day' : 'minute';
    if (retryMatch) err.retryAfter = Math.ceil(parseFloat(retryMatch[1]));
    err.cause = error;
    return err;
  } else if (/json|unexpected token|parse|safety|blocked|recitation/.test(lower)) {
    message = 'La IA devolvió una respuesta inesperada. Probá con otro archivo o de nuevo en un rato.';
  }

  const err = new Error(message);
  err.status = status;
  err.cause = error;
  return err;
}

// Precios aprox por modelo (USD por 1M tokens, input/output). Actualizar con un
// deploy si el proveedor cambia tarifas. Referencia: tarifas públicas a 2026-06.
const MODEL_PRICING = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'gpt-4o-mini': { in: 0.15, out: 0.60 },
  'gemini-2.5-flash': { in: 0.30, out: 2.50 },
  'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 },
};
const DEFAULT_PRICING = { in: 1, out: 3 };

// Estimación de costo en USD a partir del modelo y los tokens usados.
function estimateCostUsd(model, usage) {
  const p = MODEL_PRICING[model] || DEFAULT_PRICING;
  const inTok = Number(usage?.inputTokens) || 0;
  const outTok = Number(usage?.outputTokens) || 0;
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

const DEFAULT_SYSTEM_PROMPT = `Sos un asistente experto en extraer datos estructurados de CVs en español (variante argentina).
Recibís el texto crudo de un CV y devolvés un JSON con los campos solicitados.
Reglas:
- Devolvé null para cualquier campo que no esté presente o no puedas inferir con confianza.
- "rubro" debe ser una de las opciones provistas (lista exacta, case-sensitive). Si ninguna calza, usá null.
- "puesto" es el cargo/rol principal del candidato (ej. "Mozo", "Programador", "Cocinero").
- "skills" es un array de habilidades concretas extraídas del CV (máximo 8, en español, sin duplicados).
- "description" es un resumen breve (1-2 oraciones) en primera persona del candidato.
- "experience" es una descripción concisa de la experiencia laboral (3-5 oraciones).
- "zona" es el barrio o zona geográfica si está mencionada.
- "firstName" y "lastName" son nombre y apellido del candidato.`;

const TOOL_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    rubro: { type: ['string', 'null'] },
    puesto: { type: ['string', 'null'] },
    zona: { type: ['string', 'null'] },
    description: { type: ['string', 'null'] },
    experience: { type: ['string', 'null'] },
    skills: { type: 'array', items: { type: 'string' } }
  },
  required: ['firstName', 'lastName', 'email', 'phone', 'rubro', 'puesto', 'zona', 'description', 'experience', 'skills']
};

async function getRubroNames() {
  const db = getDb();
  const snapshot = await db.collection('rubros').where('activo', '==', true).get();
  return snapshot.docs.map(doc => doc.data().nombre).filter(Boolean);
}

function buildUserMessage(pdfText, rubros) {
  return `Lista de rubros válidos (elegí exactamente uno o null):\n${rubros.map(r => `- ${r}`).join('\n')}\n\nTexto del CV:\n"""\n${pdfText}\n"""`;
}

function buildPdfUserMessage(rubros) {
  return `Lista de rubros válidos (elegí exactamente uno o null):\n${rubros.map(r => `- ${r}`).join('\n')}\n\nExtraé los datos del CV adjunto (PDF). Si el PDF es una imagen escaneada, leelo con OCR.`;
}

// Cache en memoria del doc de config de IA. En el análisis de CVs este doc se
// lee varias veces por CV (config + prompts); cachearlo con TTL corto evita esas
// lecturas repetidas a Firestore. Se invalida al guardar cambios de config/prompts.
const AI_CONFIG_TTL_MS = 60_000;
let _aiConfigCache = { data: null, ts: 0 };

function invalidateAiConfigCache() {
  _aiConfigCache = { data: null, ts: 0 };
}

async function getAiConfigDoc() {
  const now = Date.now();
  if (_aiConfigCache.ts && now - _aiConfigCache.ts < AI_CONFIG_TTL_MS) {
    return _aiConfigCache.data;
  }
  const db = getDb();
  const doc = await db.collection('appConfig').doc('aiConfig').get();
  const data = doc.exists ? doc.data() : null;
  _aiConfigCache = { data, ts: now };
  return data;
}

async function getAiConfigPublic() {
  const data = await getAiConfigDoc();
  if (!data) return { provider: null, apiKeyMasked: null, configured: false };
  let apiKeyMasked = null;
  try {
    const plain = decrypt(data.apiKeyEncrypted);
    apiKeyMasked = maskApiKey(plain);
  } catch {
    apiKeyMasked = '****';
  }
  return {
    provider: data.provider,
    apiKeyMasked,
    configured: Boolean(data.apiKeyEncrypted),
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt || null,
    updatedBy: data.updatedBy || null
  };
}

async function getAiApiKeyPlain() {
  const data = await getAiConfigDoc();
  if (!data) return null;
  return decrypt(data.apiKeyEncrypted);
}

async function updateAiConfig({ provider, apiKey, updatedBy }) {
  if (provider && !SUPPORTED_PROVIDERS.includes(provider)) {
    const err = new Error(`Provider inválido. Debe ser uno de: ${SUPPORTED_PROVIDERS.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const db = getDb();
  const ref = db.collection('appConfig').doc('aiConfig');
  const existing = (await ref.get()).data() || {};
  const update = {
    provider: provider || existing.provider || null,
    updatedAt: new Date(),
    updatedBy: updatedBy || null
  };
  if (apiKey) {
    update.apiKeyEncrypted = encrypt(apiKey);
  } else if (existing.apiKeyEncrypted) {
    update.apiKeyEncrypted = existing.apiKeyEncrypted;
  }
  await ref.set(update, { merge: true });
  invalidateAiConfigCache();
}

// ============================================
// PROMPTS (editable overrides, fallback a defaults)
// ============================================

// Devuelve los prompts efectivos que usa el motor: el override guardado si existe
// y no está vacío, o el default hardcodeado.
async function getResolvedPrompts() {
  const data = await getAiConfigDoc();
  const parse = (data && typeof data.parsePrompt === 'string' && data.parsePrompt.trim())
    ? data.parsePrompt
    : DEFAULT_SYSTEM_PROMPT;
  const assess = (data && typeof data.assessPrompt === 'string' && data.assessPrompt.trim())
    ? data.assessPrompt
    : DEFAULT_ASSESS_SYSTEM_PROMPT;
  return { parse, assess };
}

// Versión para la UI del admin: prompts actuales, defaults y si están customizados.
async function getAiPromptsPublic() {
  const data = await getAiConfigDoc();
  const hasParse = Boolean(data && typeof data.parsePrompt === 'string' && data.parsePrompt.trim());
  const hasAssess = Boolean(data && typeof data.assessPrompt === 'string' && data.assessPrompt.trim());
  return {
    parse: hasParse ? data.parsePrompt : DEFAULT_SYSTEM_PROMPT,
    assess: hasAssess ? data.assessPrompt : DEFAULT_ASSESS_SYSTEM_PROMPT,
    defaults: { parse: DEFAULT_SYSTEM_PROMPT, assess: DEFAULT_ASSESS_SYSTEM_PROMPT },
    isCustom: { parse: hasParse, assess: hasAssess }
  };
}

// Guarda overrides de prompts. Para restaurar un default, enviar string vacío o
// null en ese campo (se borra el override y vuelve a usarse el default).
async function updateAiPrompts({ parsePrompt, assessPrompt, updatedBy }) {
  const db = getDb();
  const ref = db.collection('appConfig').doc('aiConfig');
  const update = { updatedAt: new Date(), updatedBy: updatedBy || null };
  if (parsePrompt !== undefined) {
    update.parsePrompt = (typeof parsePrompt === 'string' && parsePrompt.trim()) ? parsePrompt : null;
  }
  if (assessPrompt !== undefined) {
    update.assessPrompt = (typeof assessPrompt === 'string' && assessPrompt.trim()) ? assessPrompt : null;
  }
  await ref.set(update, { merge: true });
  invalidateAiConfigCache();
}

async function parseWithClaude(pdfText, apiKey, rubros, systemPrompt) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.claude,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [
      {
        name: 'save_cv_fields',
        description: 'Guarda los campos extraídos del CV',
        input_schema: TOOL_INPUT_SCHEMA
      }
    ],
    tool_choice: { type: 'tool', name: 'save_cv_fields' },
    messages: [{ role: 'user', content: buildUserMessage(pdfText, rubros) }]
  });
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Claude no devolvió los campos esperados');
  }
  return toolUse.input;
}

async function parseWithOpenAI(pdfText, apiKey, rubros, systemPrompt) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODELS.openai,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(pdfText, rubros) }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cv_fields',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            firstName: { type: ['string', 'null'] },
            lastName: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            rubro: { type: ['string', 'null'] },
            puesto: { type: ['string', 'null'] },
            zona: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] },
            experience: { type: ['string', 'null'] },
            skills: { type: 'array', items: { type: 'string' } }
          },
          required: ['firstName', 'lastName', 'email', 'phone', 'rubro', 'puesto', 'zona', 'description', 'experience', 'skills']
        }
      }
    }
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido');
  return JSON.parse(content);
}

async function parseWithGemini(pdfText, apiKey, rubros, systemPrompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          rubro: { type: 'string', nullable: true },
          puesto: { type: 'string', nullable: true },
          zona: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          experience: { type: 'string', nullable: true },
          skills: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  });
  const result = await model.generateContent(buildUserMessage(pdfText, rubros));
  const text = result.response.text();
  return JSON.parse(text);
}

async function parseCvWithAi(pdfText) {
  const data = await getAiConfigDoc();
  if (!data || !data.provider || !data.apiKeyEncrypted) {
    const err = new Error('La IA no está configurada. Configurala en /sudo/ai-settings antes de usarla.');
    err.status = 400;
    throw err;
  }
  const apiKey = decrypt(data.apiKeyEncrypted);
  const rubros = await getRubroNames();
  const { parse: systemPrompt } = await getResolvedPrompts();

  try {
    switch (data.provider) {
      case 'claude': return await parseWithClaude(pdfText, apiKey, rubros, systemPrompt);
      case 'openai': return await parseWithOpenAI(pdfText, apiKey, rubros, systemPrompt);
      case 'gemini': return await parseWithGemini(pdfText, apiKey, rubros, systemPrompt);
      default:
        throw new Error(`Provider desconocido: ${data.provider}`);
    }
  } catch (error) {
    throw friendlyAiError(error);
  }
}

// Builds a Claude content block for a file: images use an `image` block, PDFs a `document` block.
function claudeMediaBlock(base64, mimeType) {
  if (mimeType && mimeType.startsWith('image/')) {
    return { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
  }
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
}

async function parseWithClaudePdf(base64, mimeType, apiKey, rubros, systemPrompt) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.claude,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [
      {
        name: 'save_cv_fields',
        description: 'Guarda los campos extraídos del CV',
        input_schema: TOOL_INPUT_SCHEMA
      }
    ],
    tool_choice: { type: 'tool', name: 'save_cv_fields' },
    messages: [
      {
        role: 'user',
        content: [
          claudeMediaBlock(base64, mimeType),
          { type: 'text', text: buildPdfUserMessage(rubros) }
        ]
      }
    ]
  });
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse) {
    throw new Error('Claude no devolvió los campos esperados');
  }
  return toolUse.input;
}

async function parseWithGeminiPdf(base64, mimeType, apiKey, rubros, systemPrompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          rubro: { type: 'string', nullable: true },
          puesto: { type: 'string', nullable: true },
          zona: { type: 'string', nullable: true },
          description: { type: 'string', nullable: true },
          experience: { type: 'string', nullable: true },
          skills: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  });
  const result = await model.generateContent([
    { inlineData: { mimeType: mimeType || 'application/pdf', data: base64 } },
    buildPdfUserMessage(rubros)
  ]);
  const text = result.response.text();
  return JSON.parse(text);
}

/**
 * Parse a CV directly from the PDF bytes using the model's native document/OCR
 * support. Used for scanned/image PDFs that have no extractable text layer.
 */
async function parseCvFromPdf(buffer, mimeType) {
  const data = await getAiConfigDoc();
  if (!data || !data.provider || !data.apiKeyEncrypted) {
    const err = new Error('La IA no está configurada. Configurala en /sudo/ai-settings antes de usarla.');
    err.status = 400;
    throw err;
  }
  const apiKey = decrypt(data.apiKeyEncrypted);
  const rubros = await getRubroNames();
  const { parse: systemPrompt } = await getResolvedPrompts();
  const base64 = buffer.toString('base64');

  try {
    switch (data.provider) {
      case 'claude': return await parseWithClaudePdf(base64, mimeType, apiKey, rubros, systemPrompt);
      case 'gemini': return await parseWithGeminiPdf(base64, mimeType, apiKey, rubros, systemPrompt);
      case 'openai': {
        const err = new Error('El OCR de PDFs escaneados requiere Claude o Gemini. Cambiá el proveedor en /sudo/ai-settings.');
        err.status = 422;
        throw err;
      }
      default:
        throw new Error(`Provider desconocido: ${data.provider}`);
    }
  } catch (error) {
    throw friendlyAiError(error);
  }
}

// ============================================
// CV FIT ASSESSMENT (recruiter-style verdict)
// ============================================

const DEFAULT_ASSESS_SYSTEM_PROMPT = `Sos un reclutador experto en RRHH (Argentina). Evaluás si un candidato encaja en una búsqueda laboral concreta, leyendo su CV.
Reglas:
- Considerá sinónimos y experiencia equivalente (ej: "mesero" ≈ "mozo", "encargado" ≈ "supervisor", "atención al público" ≈ "atención al cliente"). No compares texto literal: interpretá.
- "fitScore": entero 0-100 que refleja qué tan bien encaja el candidato con ESTA búsqueda (puesto, rubro, skills, experiencia y zona). Sé honesto y estricto, no infles el puntaje. Usá esta rúbrica de 5 bandas para distribuir el puntaje:
  · 80-100: encaja muy bien (cumple puesto/rubro y la mayoría de skills/experiencia que pide la oferta).
  · 60-79: encaja bien, con algún faltante menor.
  · 40-59: encaja parcialmente (el rol coincide pero faltan skills/experiencia, o tiene las skills pero el rol no es exacto).
  · 20-39: encaja poco (coincidencias débiles o aisladas).
  · 1-19: casi no encaja.
- "recommendation": alineá con el fitScore → "yes" si fitScore ≥ 60, "maybe" si está entre 20 y 59, "no" si es menor a 20.
- "summary": 1-2 oraciones en español explicando el veredicto.
- "strengths": hasta 5 puntos fuertes del candidato para esta búsqueda.
- "gaps": hasta 5 faltantes o riesgos respecto a lo que pide la oferta.
- "matchingSkills": habilidades/competencias que el candidato SÍ tiene y la oferta pide (aunque estén redactadas distinto).
- "missingSkills": habilidades que la oferta pide y NO se evidencian en el CV.
- "firstName"/"lastName"/"email"/"phone": datos de contacto del candidato (null si no están).
- "city"/"zona"/"localidad": ubicación del candidato SEGÚN EL CV (ciudad, barrio/zona y localidad). null si el CV no la menciona. No la inventes ni uses la de la búsqueda. NO la uses para el fitScore (la cercanía la calcula el sistema aparte).`;

const ASSESS_SCHEMA = {
  type: 'object',
  properties: {
    firstName: { type: ['string', 'null'] },
    lastName: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    phone: { type: ['string', 'null'] },
    city: { type: ['string', 'null'], description: 'Ciudad del candidato según el CV (null si no figura)' },
    zona: { type: ['string', 'null'], description: 'Barrio/zona del candidato según el CV (null si no figura)' },
    localidad: { type: ['string', 'null'], description: 'Localidad del candidato según el CV (null si no figura)' },
    fitScore: { type: 'integer' },
    recommendation: { type: 'string', enum: ['yes', 'maybe', 'no'] },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
    matchingSkills: { type: 'array', items: { type: 'string' } },
    missingSkills: { type: 'array', items: { type: 'string' } }
  },
  required: ['firstName', 'lastName', 'email', 'phone', 'city', 'zona', 'localidad', 'fitScore', 'recommendation', 'summary', 'strengths', 'gaps', 'matchingSkills', 'missingSkills']
};

function buildAssessUserMessage(offer, cvText) {
  const offerBlock = `Búsqueda laboral:
- Puesto: ${offer.puesto || '—'}
- Rubro: ${offer.rubro || '—'}
- Ciudad: ${offer.city || 'no especificada'}
- Zona: ${offer.zona || 'no especificada'}
- Skills requeridas: ${(offer.requiredSkills || []).join(', ') || 'no especificadas'}
- Descripción: ${offer.description || '—'}${offer.requirements ? `\n- Requisitos: ${offer.requirements}` : ''}`;
  if (cvText) {
    return `${offerBlock}\n\nCV del candidato:\n"""\n${cvText}\n"""`;
  }
  return `${offerBlock}\n\nEvaluá el CV adjunto (PDF). Si es una imagen escaneada, leelo con OCR.`;
}

async function assessWithClaude(userContent, apiKey, systemPrompt) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.claude,
    max_tokens: 1024,
    system: systemPrompt,
    tools: [{ name: 'save_assessment', description: 'Guarda la evaluación del candidato', input_schema: ASSESS_SCHEMA }],
    tool_choice: { type: 'tool', name: 'save_assessment' },
    messages: [{ role: 'user', content: userContent }]
  });
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude no devolvió la evaluación esperada');
  return {
    data: toolUse.input,
    usage: { inputTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0 }
  };
}

async function assessWithOpenAI(userText, apiKey, systemPrompt) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODELS.openai,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cv_assessment',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            firstName: { type: ['string', 'null'] },
            lastName: { type: ['string', 'null'] },
            email: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            fitScore: { type: 'integer' },
            recommendation: { type: 'string', enum: ['yes', 'maybe', 'no'] },
            summary: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            gaps: { type: 'array', items: { type: 'string' } },
            matchingSkills: { type: 'array', items: { type: 'string' } },
            missingSkills: { type: 'array', items: { type: 'string' } }
          },
          required: ['firstName', 'lastName', 'email', 'phone', 'fitScore', 'recommendation', 'summary', 'strengths', 'gaps', 'matchingSkills', 'missingSkills']
        }
      }
    }
  });
  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI no devolvió contenido');
  return {
    data: JSON.parse(content),
    usage: { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 }
  };
}

async function assessWithGemini(parts, apiKey, systemPrompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: systemPrompt,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          firstName: { type: 'string', nullable: true },
          lastName: { type: 'string', nullable: true },
          email: { type: 'string', nullable: true },
          phone: { type: 'string', nullable: true },
          fitScore: { type: 'integer' },
          recommendation: { type: 'string', enum: ['yes', 'maybe', 'no'] },
          summary: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          gaps: { type: 'array', items: { type: 'string' } },
          matchingSkills: { type: 'array', items: { type: 'string' } },
          missingSkills: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  });
  const result = await model.generateContent(parts);
  const um = result.response.usageMetadata || {};
  return {
    data: JSON.parse(result.response.text()),
    usage: { inputTokens: um.promptTokenCount || 0, outputTokens: um.candidatesTokenCount || 0 }
  };
}

/**
 * Recruiter-style assessment of a CV against a specific offer. Pass either
 * cvText (text-layer PDFs) or pdfBuffer+mimeType (scanned → multimodal OCR).
 * @returns {Promise<Object>} { firstName, lastName, email, phone, fitScore,
 *   recommendation, summary, strengths[], gaps[], matchingSkills[], missingSkills[] }
 */
async function assessCvFit({ offer, cvText, fileBuffer, mimeType }) {
  const data = await getAiConfigDoc();
  if (!data || !data.provider || !data.apiKeyEncrypted) {
    const err = new Error('La IA no está configurada. Configurala en /sudo/ai-settings antes de usarla.');
    err.status = 400;
    throw err;
  }
  const apiKey = decrypt(data.apiKeyEncrypted);
  const provider = data.provider;
  const { assess: systemPrompt } = await getResolvedPrompts();

  try {
    let out;
    if (cvText) {
      const userText = buildAssessUserMessage(offer, cvText);
      switch (provider) {
        case 'claude': out = await assessWithClaude(userText, apiKey, systemPrompt); break;
        case 'openai': out = await assessWithOpenAI(userText, apiKey, systemPrompt); break;
        case 'gemini': out = await assessWithGemini([userText], apiKey, systemPrompt); break;
        default: throw new Error(`Provider desconocido: ${provider}`);
      }
    } else {
      // No text layer → multimodal (scanned PDFs / images)
      const base64 = fileBuffer.toString('base64');
      const text = buildAssessUserMessage(offer, null);
      switch (provider) {
        case 'claude':
          out = await assessWithClaude([
            claudeMediaBlock(base64, mimeType),
            { type: 'text', text }
          ], apiKey, systemPrompt);
          break;
        case 'gemini':
          out = await assessWithGemini([
            { inlineData: { mimeType: mimeType || 'application/pdf', data: base64 } },
            text
          ], apiKey, systemPrompt);
          break;
        case 'openai': {
          const err = new Error('El OCR de PDFs escaneados requiere Claude o Gemini. Cambiá el proveedor en /sudo/ai-settings.');
          err.status = 422;
          throw err;
        }
        default:
          throw new Error(`Provider desconocido: ${provider}`);
      }
    }

    return {
      ...out.data,
      usage: {
        inputTokens: out.usage?.inputTokens || 0,
        outputTokens: out.usage?.outputTokens || 0,
        model: MODELS[provider],
        provider
      }
    };
  } catch (error) {
    throw friendlyAiError(error);
  }
}

module.exports = {
  SUPPORTED_PROVIDERS,
  MODELS,
  parseCvWithAi,
  parseCvFromPdf,
  assessCvFit,
  estimateCostUsd,
  MODEL_PRICING,
  getAiConfigPublic,
  getAiApiKeyPlain,
  updateAiConfig,
  getAiPromptsPublic,
  updateAiPrompts
};
