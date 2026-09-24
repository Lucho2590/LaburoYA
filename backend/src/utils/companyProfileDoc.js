// Forma del documento `companies/{uid}`.
//
// Se crea desde dos lugares: el alta por invitación (POST /api/admin/users con
// role=company) y la conversión de un empleador existente
// (POST /api/admin/users/:uid/convert-to-company). Vive acá para que la forma
// del doc sea una sola y no se desincronicen los dos caminos.

const companySubscription = require('./companySubscription');

// Límite de miembros por defecto al crear una empresa (incluye al dueño).
const DEFAULT_COMPANY_MAX_MEMBERS = 3;

/**
 * Arma el doc de empresa. `plan` es el doc de `companyPlans` ya cargado
 * ({ id, ...data }); de ahí sale la suscripción (vigencia + IA + cupo).
 * Los campos de perfil son opcionales: al crear una empresa de cero vienen
 * vacíos, al convertir un empleador vienen de su doc en `employers`.
 */
function buildCompanyProfileDoc({
  uid,
  businessName,
  contactName = null,
  phone = null,
  rubro = null,
  localidad = null,
  city = null,
  address = null,
  description = null,
  photoUrl = null,
  active = true,
  maxMembers,
  plan,
  now = new Date(),
}) {
  return {
    uid,
    // En MVP la empresa "es" la organización: organizationId = su propio uid.
    organizationId: uid,
    businessName,
    contactName: contactName || null,
    phone: phone || null,
    rubro: rubro || null,
    address: address || null,
    localidad: localidad || null,
    city: city || null,
    description: description || null,
    photoUrl: photoUrl || null,
    active: active !== false,
    // Límite de cuentas del equipo (incluye al dueño). null = sin límite.
    maxMembers: Number.isInteger(maxMembers) && maxMembers > 0 ? maxMembers : DEFAULT_COMPANY_MAX_MEMBERS,
    // Suscripción materializada desde el plan elegido (vigencia + IA + cupo).
    subscription: companySubscription.applyPlan(plan, now),
    // KPIs (PLACEHOLDER, a definir).
    kpis: {
      totalOffers: 0,
      totalCandidatesEvaluated: 0,
      totalHires: 0,
      talentPoolSize: 0,
      updatedAt: null
    },
    // Onboarding (PLACEHOLDER, a definir).
    onboarding: { completed: false, steps: {} },
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = { buildCompanyProfileDoc, DEFAULT_COMPANY_MAX_MEMBERS };
