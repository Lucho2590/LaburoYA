// Suscripción de una cuenta empresa (vigencia + capacidades del plan).
//
// La empresa arranca con un plan (companyPlans) que define: vigencia en meses,
// si la IA para analizar CVs está habilitada, y un cupo TOTAL de CVs a analizar
// durante la vigencia. Al vencer (currentPeriodEnd < now) la empresa NO se
// deshabilita, pero se le bloquean las acciones de valor (ver gate en rutas).

// Convierte un Timestamp de Firestore / Date / string a Date, o null.
function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Suma meses a una fecha (maneja fin de mes de forma razonable).
function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + Number(months || 0));
  return d;
}

// Arma el objeto subscription al asignar/renovar un plan. Reinicia el período y
// el contador de CVs usados.
function applyPlan(plan, now = new Date()) {
  const durationMonths = Number(plan.durationMonths) || 1;
  return {
    planId: plan.id || null,
    planName: plan.name || null,
    durationMonths,
    startedAt: now,
    currentPeriodEnd: addMonths(now, durationMonths),
    aiCvEnabled: plan.aiCvEnabled === true,
    maxCvAnalyses: Number.isInteger(plan.maxCvAnalyses) ? plan.maxCvAnalyses : -1,
    cvAnalysesUsed: 0,
    status: 'active',
  };
}

// ¿La suscripción está vigente? (sin currentPeriodEnd → vencida/bloqueada).
function isActive(company, now = new Date()) {
  const end = toDate(company && company.subscription && company.subscription.currentPeriodEnd);
  return !!end && now.getTime() <= end.getTime();
}

// ¿Quedó CVs en el cupo? (maxCvAnalyses -1 = ilimitado).
function hasCvQuota(company) {
  const sub = (company && company.subscription) || {};
  const max = Number.isInteger(sub.maxCvAnalyses) ? sub.maxCvAnalyses : -1;
  if (max === -1) return true;
  return (Number(sub.cvAnalysesUsed) || 0) < max;
}

// Resumen para el frontend (/auth/me).
function summarize(company, now = new Date()) {
  const sub = (company && company.subscription) || {};
  const end = toDate(sub.currentPeriodEnd);
  return {
    active: isActive(company, now),
    expired: !isActive(company, now),
    currentPeriodEnd: end ? end.toISOString() : null,
    planId: sub.planId || null,
    planName: sub.planName || null,
    aiCvEnabled: sub.aiCvEnabled === true,
    maxCvAnalyses: Number.isInteger(sub.maxCvAnalyses) ? sub.maxCvAnalyses : -1,
    cvAnalysesUsed: Number(sub.cvAnalysesUsed) || 0,
  };
}

// Carga la empresa y lanza 403 si la suscripción está vencida. Devuelve el doc.
async function loadActiveCompanyOrThrow(db, organizationId, now = new Date()) {
  const doc = await db.collection('companies').doc(organizationId).get();
  const company = doc.exists ? doc.data() : null;
  if (!isActive(company, now)) {
    const err = new Error('Tu plan venció. Renovalo para seguir usando las búsquedas y el talent pool.');
    err.status = 403;
    err.code = 'subscription_expired';
    throw err;
  }
  return company;
}

module.exports = { applyPlan, isActive, hasCvQuota, summarize, toDate, addMonths, loadActiveCompanyOrThrow };
