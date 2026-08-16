// Analítica de ofertas para /sudo: junta en un solo lugar todo lo que se puede
// medir de una oferta (matches, interacciones de workers, postulaciones, gasto
// de IA y skills fuera del catálogo). Es info interna: ningún endpoint de
// empleador/worker usa este módulo.

const { SKILLS_BY_RUBRO, getSuggestedSkills, normalizeStr } = require('../utils/constants');
const { getDocMapByIds } = require('../utils/firestore');

const toDate = (v) => v?.toDate?.() || v || null;

// --- Skills -----------------------------------------------------------------

// Catálogo completo (todas las skills de todos los rubros/puestos), indexado por
// su forma normalizada para que "Atención al Cliente" no cuente como custom.
const CATALOG_BY_NORM = new Map();
Object.entries(SKILLS_BY_RUBRO).forEach(([rubro, porPuesto]) => {
  Object.entries(porPuesto).forEach(([puesto, skills]) => {
    if (!Array.isArray(skills)) return;
    skills.forEach((skill) => {
      const key = normalizeStr(skill);
      const entry = CATALOG_BY_NORM.get(key) || { label: skill, rubros: new Set(), puestos: new Set() };
      entry.rubros.add(rubro);
      if (puesto !== '_common') entry.puestos.add(`${rubro} · ${puesto}`);
      CATALOG_BY_NORM.set(key, entry);
    });
  });
});

const isCatalogSkill = (skill) => CATALOG_BY_NORM.has(normalizeStr(skill));

// Clasifica las skills de una oferta/worker contra el catálogo del rubro+puesto.
// - custom: no existen en ningún rubro del catálogo (texto libre del usuario).
// - offCatalog: existen en el catálogo pero no entre las sugeridas de ese puesto.
function classifySkills(rubro, puesto, skills) {
  const list = Array.isArray(skills) ? skills.filter(Boolean) : [];
  const suggested = new Set(getSuggestedSkills(rubro, puesto).map(normalizeStr));

  const custom = [];
  const offCatalog = [];
  const known = [];
  list.forEach((skill) => {
    const norm = normalizeStr(skill);
    if (!CATALOG_BY_NORM.has(norm)) custom.push(skill);
    else if (!suggested.has(norm)) offCatalog.push(skill);
    else known.push(skill);
  });

  return { total: list.length, known, offCatalog, custom };
}

// --- Contadores por oferta ---------------------------------------------------

const emptyCounts = () => ({
  matches: { total: 0, pending: 0, accepted: 0, rejected: 0, mutual: 0 },
  // interested / notInterested salen de offerInteractions: es lo que el worker
  // hizo con la oferta en Descubrir (le interesó o la descartó).
  interactions: { interested: 0, notInterested: 0 },
  // Postulaciones: del worker a la oferta y del empleador al worker.
  requests: {
    total: 0,
    fromWorker: 0,
    fromEmployer: 0,
    pending: 0,
    matched: 0,
    accepted: 0,
    rejected: 0,
    expiredPending: 0,
  },
  // Ranking de CVs de la oferta (colección pinnedCandidates): cada doc es un CV
  // analizado, con su score y recomendación.
  cvRanking: {
    total: 0,
    selected: 0,
    withAi: 0,
    basic: 0,
    avgScore: 0,
    scoreSum: 0,
    byRecommendation: {},
  },
});

function tallyCandidate(counts, data) {
  const c = counts.cvRanking;
  const a = data.assessment || {};
  c.total += 1;
  if (data.selected) c.selected += 1;
  if (a.mode === 'ai') c.withAi += 1;
  else c.basic += 1;
  c.scoreSum += Number(a.score) || 0;
  const rec = a.recommendation || 'sin_dato';
  c.byRecommendation[rec] = (c.byRecommendation[rec] || 0) + 1;
}

// scoreSum es interno: se convierte en promedio y se saca del payload.
function finalizeCounts(counts) {
  const c = counts.cvRanking;
  c.avgScore = c.total > 0 ? Math.round(c.scoreSum / c.total) : 0;
  delete c.scoreSum;
  return counts;
}

function tallyMatch(counts, data) {
  counts.matches.total += 1;
  if (data.status === 'accepted') counts.matches.accepted += 1;
  else if (data.status === 'rejected') counts.matches.rejected += 1;
  else counts.matches.pending += 1;
  if (data.mutualInterest) counts.matches.mutual += 1;
}

function tallyInteraction(counts, data) {
  if (data.type === 'not_interested') counts.interactions.notInterested += 1;
  else if (data.type === 'interested') counts.interactions.interested += 1;
}

function tallyRequest(counts, data, now) {
  const r = counts.requests;
  r.total += 1;
  if (data.fromType === 'employer') r.fromEmployer += 1;
  else r.fromWorker += 1;
  const status = data.status || 'pending';
  if (r[status] !== undefined) r[status] += 1;
  const expiresAt = toDate(data.expiresAt);
  if (status === 'pending' && expiresAt && new Date(expiresAt) < now) r.expiredPending += 1;
}

// Contadores de TODAS las ofertas en una pasada por cada colección (4 lecturas
// completas). Se usa solo en el listado de /sudo, bajo ?withAnalytics=true.
async function loadAnalyticsByOffer(db) {
  const now = new Date();
  const [matches, interactions, requests, candidates] = await Promise.all([
    db.collection('matches').get(),
    db.collection('offerInteractions').get(),
    db.collection('contactRequests').get(),
    db.collection('pinnedCandidates').get(),
  ]);

  const byOffer = new Map();
  const bucket = (offerId) => {
    if (!offerId) return null;
    if (!byOffer.has(offerId)) byOffer.set(offerId, emptyCounts());
    return byOffer.get(offerId);
  };

  matches.docs.forEach((d) => {
    const data = d.data();
    const c = bucket(data.offerId);
    if (c) tallyMatch(c, data);
  });
  interactions.docs.forEach((d) => {
    const data = d.data();
    const c = bucket(data.offerId);
    if (c) tallyInteraction(c, data);
  });
  requests.docs.forEach((d) => {
    const data = d.data();
    const c = bucket(data.offerId);
    if (c) tallyRequest(c, data, now);
  });
  candidates.docs.forEach((d) => {
    const data = d.data();
    const c = bucket(data.offerId);
    if (c) tallyCandidate(c, data);
  });

  byOffer.forEach(finalizeCounts);
  return byOffer;
}

// --- Detalle de una oferta ---------------------------------------------------

// Perfil mínimo del worker para las listas del detalle (sin datos de contacto
// que no hagan falta para analizar la oferta).
function workerRow(uid, workerMap, userMap) {
  const w = workerMap.get(uid) || null;
  const u = userMap.get(uid) || null;
  return {
    uid,
    nombre: u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || null : null,
    email: u?.email || null,
    rubro: w?.rubro || null,
    puesto: w?.puesto || null,
    zona: w?.zona || null,
    skills: w?.skills || [],
    active: w?.active !== false,
  };
}

async function loadOfferDetail(db, offerId) {
  const offerDoc = await db.collection('jobOffers').doc(offerId).get();
  if (!offerDoc.exists) return null;
  const offer = offerDoc.data();
  const now = new Date();

  const [matchesSnap, interactionsSnap, requestsSnap, candidatesSnap] = await Promise.all([
    db.collection('matches').where('offerId', '==', offerId).get(),
    db.collection('offerInteractions').where('offerId', '==', offerId).get(),
    db.collection('contactRequests').where('offerId', '==', offerId).get(),
    db.collection('pinnedCandidates').where('offerId', '==', offerId).get(),
  ]);

  const counts = emptyCounts();

  // Un solo getAll por colección para todos los uids que aparecen.
  const uids = new Set();
  matchesSnap.docs.forEach((d) => uids.add(d.data().workerId));
  interactionsSnap.docs.forEach((d) => uids.add(d.data().userId));
  requestsSnap.docs.forEach((d) => {
    const data = d.data();
    uids.add(data.fromType === 'employer' ? data.toUid : data.fromUid);
  });
  uids.delete(undefined);
  uids.delete(null);
  const ids = [...uids];
  const [workerMap, userMap] = await Promise.all([
    getDocMapByIds(db, 'workers', ids),
    getDocMapByIds(db, 'users', ids),
  ]);

  const matches = matchesSnap.docs.map((d) => {
    const data = d.data();
    tallyMatch(counts, data);
    return {
      id: d.id,
      status: data.status || 'pending',
      mutualInterest: !!data.mutualInterest,
      // Quién movió el match a accepted/rejected. Solo existe para los cambios
      // hechos después de que se empezó a registrar (matches viejos: null).
      statusUpdatedByRole: data.statusUpdatedByRole || null,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
      worker: workerRow(data.workerId, workerMap, userMap),
    };
  });

  const interactions = interactionsSnap.docs.map((d) => {
    const data = d.data();
    tallyInteraction(counts, data);
    return {
      id: d.id,
      type: data.type,
      createdAt: toDate(data.createdAt),
      worker: workerRow(data.userId, workerMap, userMap),
    };
  });

  const requests = requestsSnap.docs.map((d) => {
    const data = d.data();
    tallyRequest(counts, data, now);
    const workerUid = data.fromType === 'employer' ? data.toUid : data.fromUid;
    const expiresAt = toDate(data.expiresAt);
    return {
      id: d.id,
      status: data.status || 'pending',
      direction: data.fromType === 'employer' ? 'employer_to_worker' : 'worker_to_offer',
      expired: !!expiresAt && (data.status || 'pending') === 'pending' && new Date(expiresAt) < now,
      createdAt: toDate(data.createdAt),
      expiresAt,
      worker: workerRow(workerUid, workerMap, userMap),
    };
  });

  // CVs cargados al ranking de la oferta, con lo que dijo la evaluación.
  const missingCount = new Map();
  const cvSkillCount = new Map();
  const candidates = candidatesSnap.docs.map((d) => {
    const data = d.data();
    tallyCandidate(counts, data);
    const a = data.assessment || {};
    const c = data.candidate || {};
    (a.missingSkills || []).forEach((s) => missingCount.set(s, (missingCount.get(s) || 0) + 1));
    (c.skills || []).forEach((s) => cvSkillCount.set(s, (cvSkillCount.get(s) || 0) + 1));
    return {
      id: d.id,
      nombre: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
      email: c.email || null,
      puesto: c.puesto || null,
      zona: c.zona || null,
      selected: !!data.selected,
      score: Number(a.score) || 0,
      stars: Number(a.stars) || 0,
      mode: a.mode || 'basic',
      recommendation: a.recommendation || null,
      locationStatus: a.locationStatus || null,
      matchingSkills: a.matchingSkills || [],
      missingSkills: a.missingSkills || [],
      createdAt: toDate(data.createdAt),
    };
  });
  finalizeCounts(counts);

  const topOf = (map) =>
    [...map.entries()]
      .map(([skill, count]) => ({ skill, count, inCatalog: isCatalogSkill(skill) }))
      .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
      .slice(0, 15);

  const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  matches.sort(byNewest);
  interactions.sort(byNewest);
  requests.sort(byNewest);
  candidates.sort((a, b) => b.score - a.score);

  const employerMap = await getDocMapByIds(db, 'employers', [offer.employerId].filter(Boolean));
  const companyMap = await getDocMapByIds(db, 'companies', [offer.employerId].filter(Boolean));
  const owner = employerMap.get(offer.employerId) || companyMap.get(offer.employerId) || null;

  return {
    offer: {
      id: offerDoc.id,
      ...offer,
      createdAt: toDate(offer.createdAt),
      updatedAt: toDate(offer.updatedAt),
      expiresAt: toDate(offer.expiresAt),
      aiUsage: offer.aiUsage
        ? { ...offer.aiUsage, updatedAt: toDate(offer.aiUsage.updatedAt) }
        : null,
    },
    employer: owner
      ? {
          uid: offer.employerId,
          businessName: owner.businessName || owner.nombre || null,
          isCompany: companyMap.has(offer.employerId),
        }
      : null,
    counts,
    skills: {
      required: offer.requiredSkills || [],
      suggested: getSuggestedSkills(offer.rubro, offer.puesto),
      ...classifySkills(offer.rubro, offer.puesto, offer.requiredSkills),
    },
    // Qué le faltó a los CVs analizados y qué skills traían: sirve para ver si
    // la oferta pide cosas que nadie tiene, y para descubrir skills nuevas.
    cvInsights: {
      topMissingSkills: topOf(missingCount),
      topCandidateSkills: topOf(cvSkillCount),
    },
    matches,
    interactions,
    requests,
    candidates,
  };
}

// --- Auditoría de skills -----------------------------------------------------

// Recorre ofertas y workers y arma el ranking de skills escritas a mano (fuera
// del catálogo), más las del catálogo que nadie usa. Sirve para decidir qué
// sumar/sacar de SKILLS_BY_RUBRO.
async function buildSkillsAudit(db) {
  const [offersSnap, workersSnap, candidatesSnap] = await Promise.all([
    db.collection('jobOffers').get(),
    db.collection('workers').get(),
    // Skills que la IA extrajo de los CVs: la mejor fuente de vocabulario real.
    db.collection('pinnedCandidates').get(),
  ]);

  const custom = new Map(); // norm -> { label, offers, workers, cvs, rubros, puestos, sampleOfferIds }
  const usage = new Map(); // norm (catálogo) -> veces usada

  const track = (source, id, rubro, puesto, skills) => {
    (Array.isArray(skills) ? skills : []).filter(Boolean).forEach((skill) => {
      const norm = normalizeStr(skill);
      if (!norm) return;
      if (isCatalogSkill(skill)) {
        usage.set(norm, (usage.get(norm) || 0) + 1);
        return;
      }
      const entry = custom.get(norm) || {
        skill,
        offers: 0,
        workers: 0,
        cvs: 0,
        rubros: new Set(),
        puestos: new Set(),
        sampleOfferIds: [],
      };
      entry[source] += 1;
      if (rubro) entry.rubros.add(rubro);
      if (puesto) entry.puestos.add(puesto);
      if (source !== 'workers' && id && entry.sampleOfferIds.length < 10 && !entry.sampleOfferIds.includes(id)) {
        entry.sampleOfferIds.push(id);
      }
      custom.set(norm, entry);
    });
  };

  let offersWithCustom = 0;
  const offers = offersSnap.docs.map((d) => {
    const data = d.data();
    track('offers', d.id, data.rubro, data.puesto, data.requiredSkills);
    const cls = classifySkills(data.rubro, data.puesto, data.requiredSkills);
    if (cls.custom.length > 0) offersWithCustom += 1;
    return {
      id: d.id,
      rubro: data.rubro || null,
      puesto: data.puesto || null,
      businessName: data.businessName || null,
      employerId: data.employerId || null,
      active: data.active !== false,
      createdAt: toDate(data.createdAt),
      requiredSkills: data.requiredSkills || [],
      custom: cls.custom,
      offCatalog: cls.offCatalog,
    };
  });

  let workersWithCustom = 0;
  workersSnap.docs.forEach((d) => {
    const data = d.data();
    track('workers', d.id, data.rubro, data.puesto, data.skills);
    if (classifySkills(data.rubro, data.puesto, data.skills).custom.length > 0) workersWithCustom += 1;
  });

  // Lo que la IA nombró al evaluar CVs (matchingSkills/missingSkills). Es texto
  // libre del modelo: no entra al ranking de `custom` (ruido), va aparte como
  // vocabulario a evaluar.
  const aiMentions = new Map(); // norm -> { skill, matching, missing }
  candidatesSnap.docs.forEach((d) => {
    const data = d.data();
    const c = data.candidate || {};
    track('cvs', data.offerId, null, c.puesto || null, c.skills);

    const a = data.assessment || {};
    const mention = (skill, kind) => {
      const norm = normalizeStr(skill);
      if (!norm || isCatalogSkill(skill)) return;
      const entry = aiMentions.get(norm) || { skill, matching: 0, missing: 0 };
      entry[kind] += 1;
      aiMentions.set(norm, entry);
    };
    (a.matchingSkills || []).forEach((s) => mention(s, 'matching'));
    (a.missingSkills || []).forEach((s) => mention(s, 'missing'));
  });

  const customList = [...custom.values()]
    .map((e) => ({
      skill: e.skill,
      offers: e.offers,
      workers: e.workers,
      cvs: e.cvs,
      total: e.offers + e.workers + e.cvs,
      rubros: [...e.rubros],
      puestos: [...e.puestos],
      sampleOfferIds: e.sampleOfferIds,
    }))
    .sort((a, b) => b.total - a.total || a.skill.localeCompare(b.skill));

  const catalog = [...CATALOG_BY_NORM.entries()]
    .map(([norm, e]) => ({
      skill: e.label,
      rubros: [...e.rubros],
      puestos: [...e.puestos],
      uses: usage.get(norm) || 0,
    }))
    .sort((a, b) => b.uses - a.uses || a.skill.localeCompare(b.skill));

  return {
    summary: {
      catalogSkills: catalog.length,
      customSkills: customList.length,
      totalOffers: offers.length,
      offersWithCustom,
      totalWorkers: workersSnap.size,
      workersWithCustom,
      totalCvs: candidatesSnap.size,
      unusedCatalogSkills: catalog.filter((s) => s.uses === 0).length,
    },
    custom: customList,
    catalog,
    aiSkills: [...aiMentions.values()]
      .map((e) => ({ ...e, total: e.matching + e.missing }))
      .sort((a, b) => b.total - a.total || a.skill.localeCompare(b.skill))
      .slice(0, 200),
    // Solo las ofertas que tienen algo para revisar (custom u off-catalog).
    offers: offers
      .filter((o) => o.custom.length > 0 || o.offCatalog.length > 0)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
  };
}

module.exports = {
  emptyCounts: () => finalizeCounts(emptyCounts()),
  classifySkills,
  isCatalogSkill,
  loadAnalyticsByOffer,
  loadOfferDetail,
  buildSkillsAudit,
};
