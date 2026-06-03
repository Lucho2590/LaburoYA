const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb } = require('../config/firebase');
const { encrypt, decrypt, maskApiKey } = require('./crypto');

const SUPPORTED_PROVIDERS = ['claude', 'openai', 'gemini'];

const MODELS = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash'
};

const SYSTEM_PROMPT = `Sos un asistente experto en extraer datos estructurados de CVs en español (variante argentina).
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

async function getAiConfigDoc() {
  const db = getDb();
  const doc = await db.collection('appConfig').doc('aiConfig').get();
  if (!doc.exists) return null;
  return doc.data();
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
}

async function parseWithClaude(pdfText, apiKey, rubros) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.claude,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
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

async function parseWithOpenAI(pdfText, apiKey, rubros) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODELS.openai,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
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

async function parseWithGemini(pdfText, apiKey, rubros) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: SYSTEM_PROMPT,
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

  switch (data.provider) {
    case 'claude': return parseWithClaude(pdfText, apiKey, rubros);
    case 'openai': return parseWithOpenAI(pdfText, apiKey, rubros);
    case 'gemini': return parseWithGemini(pdfText, apiKey, rubros);
    default:
      throw new Error(`Provider desconocido: ${data.provider}`);
  }
}

// Builds a Claude content block for a file: images use an `image` block, PDFs a `document` block.
function claudeMediaBlock(base64, mimeType) {
  if (mimeType && mimeType.startsWith('image/')) {
    return { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };
  }
  return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
}

async function parseWithClaudePdf(base64, mimeType, apiKey, rubros) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.claude,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
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

async function parseWithGeminiPdf(base64, mimeType, apiKey, rubros) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: SYSTEM_PROMPT,
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
  const base64 = buffer.toString('base64');

  switch (data.provider) {
    case 'claude': return parseWithClaudePdf(base64, mimeType, apiKey, rubros);
    case 'gemini': return parseWithGeminiPdf(base64, mimeType, apiKey, rubros);
    case 'openai': {
      const err = new Error('El OCR de PDFs escaneados requiere Claude o Gemini. Cambiá el proveedor en /sudo/ai-settings.');
      err.status = 422;
      throw err;
    }
    default:
      throw new Error(`Provider desconocido: ${data.provider}`);
  }
}

// ============================================
// CV FIT ASSESSMENT (recruiter-style verdict)
// ============================================

const ASSESS_SYSTEM_PROMPT = `Sos un reclutador experto en RRHH (Argentina). Evaluás si un candidato encaja en una búsqueda laboral concreta, leyendo su CV.
Reglas:
- Considerá sinónimos y experiencia equivalente (ej: "mesero" ≈ "mozo", "encargado" ≈ "supervisor", "atención al público" ≈ "atención al cliente"). No compares texto literal: interpretá.
- "fitScore": entero 0-100 que refleja qué tan bien encaja el candidato con ESTA búsqueda (puesto, rubro, skills, experiencia y zona). Sé honesto y estricto, no infles el puntaje.
- "recommendation": "yes" si encaja claramente, "maybe" si encaja parcialmente o falta información, "no" si no encaja.
- "summary": 1-2 oraciones en español explicando el veredicto.
- "strengths": hasta 5 puntos fuertes del candidato para esta búsqueda.
- "gaps": hasta 5 faltantes o riesgos respecto a lo que pide la oferta.
- "matchingSkills": habilidades/competencias que el candidato SÍ tiene y la oferta pide (aunque estén redactadas distinto).
- "missingSkills": habilidades que la oferta pide y NO se evidencian en el CV.
- "firstName"/"lastName"/"email"/"phone": datos de contacto del candidato (null si no están).`;

const ASSESS_SCHEMA = {
  type: 'object',
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
};

function buildAssessUserMessage(offer, cvText) {
  const offerBlock = `Búsqueda laboral:
- Puesto: ${offer.puesto || '—'}
- Rubro: ${offer.rubro || '—'}
- Zona: ${offer.zona || 'no especificada'}
- Skills requeridas: ${(offer.requiredSkills || []).join(', ') || 'no especificadas'}
- Descripción: ${offer.description || '—'}${offer.requirements ? `\n- Requisitos: ${offer.requirements}` : ''}`;
  if (cvText) {
    return `${offerBlock}\n\nCV del candidato:\n"""\n${cvText}\n"""`;
  }
  return `${offerBlock}\n\nEvaluá el CV adjunto (PDF). Si es una imagen escaneada, leelo con OCR.`;
}

async function assessWithClaude(userContent, apiKey) {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: MODELS.claude,
    max_tokens: 1024,
    system: ASSESS_SYSTEM_PROMPT,
    tools: [{ name: 'save_assessment', description: 'Guarda la evaluación del candidato', input_schema: ASSESS_SCHEMA }],
    tool_choice: { type: 'tool', name: 'save_assessment' },
    messages: [{ role: 'user', content: userContent }]
  });
  const toolUse = response.content.find(c => c.type === 'tool_use');
  if (!toolUse) throw new Error('Claude no devolvió la evaluación esperada');
  return toolUse.input;
}

async function assessWithOpenAI(userText, apiKey) {
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: MODELS.openai,
    messages: [
      { role: 'system', content: ASSESS_SYSTEM_PROMPT },
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
  return JSON.parse(content);
}

async function assessWithGemini(parts, apiKey) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODELS.gemini,
    systemInstruction: ASSESS_SYSTEM_PROMPT,
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
  return JSON.parse(result.response.text());
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

  if (cvText) {
    const userText = buildAssessUserMessage(offer, cvText);
    switch (provider) {
      case 'claude': return assessWithClaude(userText, apiKey);
      case 'openai': return assessWithOpenAI(userText, apiKey);
      case 'gemini': return assessWithGemini([userText], apiKey);
      default: throw new Error(`Provider desconocido: ${provider}`);
    }
  }

  // No text layer → multimodal (scanned PDFs / images)
  const base64 = fileBuffer.toString('base64');
  const text = buildAssessUserMessage(offer, null);
  switch (provider) {
    case 'claude':
      return assessWithClaude([
        claudeMediaBlock(base64, mimeType),
        { type: 'text', text }
      ], apiKey);
    case 'gemini':
      return assessWithGemini([
        { inlineData: { mimeType: mimeType || 'application/pdf', data: base64 } },
        text
      ], apiKey);
    case 'openai': {
      const err = new Error('El OCR de PDFs escaneados requiere Claude o Gemini. Cambiá el proveedor en /sudo/ai-settings.');
      err.status = 422;
      throw err;
    }
    default:
      throw new Error(`Provider desconocido: ${provider}`);
  }
}

module.exports = {
  SUPPORTED_PROVIDERS,
  MODELS,
  parseCvWithAi,
  parseCvFromPdf,
  assessCvFit,
  getAiConfigPublic,
  getAiApiKeyPlain,
  updateAiConfig
};
