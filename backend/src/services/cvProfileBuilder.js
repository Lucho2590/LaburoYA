const { JOB_CATEGORIES, getAllSkillsForRubro, ZONAS_MDP, normalizeZona } = require('../utils/constants');

/** Lowercase + strip accents/diacritics for tolerant matching. */
function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Curated synonyms per puesto label (values are already accent-free, lowercase).
// The puesto's own normalized label is always included implicitly at match time.
const PUESTO_SYNONYMS = {
  // Gastronomía
  'Cocinero': ['cocinero', 'cocinera', 'chef', 'cocina', 'jefe de cocina'],
  'Ayudante de cocina': ['ayudante de cocina', 'auxiliar de cocina', 'comis', 'asistente de cocina'],
  'Mozo': ['mozo', 'moza', 'mesero', 'mesera', 'camarero', 'camarera', 'runner'],
  'Bachero': ['bachero', 'lavacopas', 'lavaplatos', 'steward'],
  'Barman': ['barman', 'bartender', 'barwoman', 'cantinero', 'cocteleria'],
  // Comercio
  'Vendedor': ['vendedor', 'vendedora', 'ventas', 'atencion al publico', 'asesor de ventas', 'comercial'],
  'Cajero': ['cajero', 'cajera', 'caja', 'cobranza'],
  'Repositor': ['repositor', 'repositora', 'reposicion', 'gondolero'],
  'Encargado': ['encargado', 'encargada', 'supervisor', 'supervisora', 'jefe de local', 'responsable de local'],
  // Construcción
  'Albañil': ['albanil', 'albañil', 'construccion', 'mamposteria', 'oficial albanil'],
  'Ayudante': ['ayudante', 'peon', 'peon de obra', 'ayudante de obra'],
  'Electricista': ['electricista', 'instalador electrico', 'electricidad'],
  'Plomero': ['plomero', 'gasista', 'sanitarista', 'instalaciones sanitarias'],
  'Pintor': ['pintor', 'pintora', 'pintura', 'pintor de obra'],
  // Limpieza
  'Empleada doméstica': ['empleada domestica', 'empleado domestico', 'personal domestico', 'limpieza de hogar', 'servicio domestico'],
  'Personal de limpieza': ['personal de limpieza', 'limpieza', 'maestranza', 'limpiador', 'limpiadora', 'auxiliar de limpieza'],
  'Mucama': ['mucama', 'camarera de piso', 'housekeeping', 'limpieza de habitaciones'],
  // Transporte
  'Chofer': ['chofer', 'chofer', 'conductor', 'conductora', 'taxista', 'remisero', 'transportista'],
  'Repartidor': ['repartidor', 'repartidora', 'delivery', 'cadete', 'mensajero', 'motoquero'],
  'Fletero': ['fletero', 'flete', 'mudanzas', 'transporte de carga'],
  // Administración
  'Administrativo': ['administrativo', 'administrativa', 'administracion', 'auxiliar administrativo', 'empleado administrativo'],
  'Recepcionista': ['recepcionista', 'recepcion', 'front desk'],
  'Secretaria': ['secretaria', 'secretario', 'asistente', 'asistente ejecutiva'],
  'Data entry': ['data entry', 'carga de datos', 'digitador', 'tipeador']
};

/**
 * Builds a LaburoYA-style worker profile from raw CV text, relative to a given
 * offer + the taxonomy. No AI: dictionary matching + curated synonyms.
 * @param {string} text - raw CV text (from PDF or OCR)
 * @param {Object} offer - job offer (rubro key, puesto/zona labels, requiredSkills[])
 * @returns {{ rubro: string|null, puesto: string|null, zona: string|null, skills: string[] }}
 */
function buildProfileFromText(text, offer) {
  const n = normalize(text);

  // --- puesto ---
  const puestoLabel = offer.puesto || '';
  const candidates = [normalize(puestoLabel), ...(PUESTO_SYNONYMS[puestoLabel] || []).map(normalize)];
  const puestoDetected = candidates.some(c => c && n.includes(c));

  // --- rubro ---
  const rubroData = JOB_CATEGORIES[offer.rubro];
  const rubroLabel = rubroData ? normalize(rubroData.label) : '';
  const rubroSkills = getAllSkillsForRubro(offer.rubro);
  const rubroSkillHits = rubroSkills.filter(s => n.includes(normalize(s))).length;
  const rubroDetected = puestoDetected || (!!rubroLabel && n.includes(rubroLabel)) || rubroSkillHits >= 2;

  // --- zona ---
  // Detecta la zona PROPIA del candidato mencionada en el CV (cualquier zona
  // canónica), no solo la de la oferta. Permite puntuar proximidad aunque el
  // candidato y la oferta estén en zonas distintas. Prioriza la de la oferta.
  let zona = null;
  const offerZona = normalizeZona(offer.zona);
  if (offerZona && n.includes(normalize(offerZona))) {
    zona = offerZona;
  } else {
    for (const z of ZONAS_MDP) {
      if (z !== 'Otras' && n.includes(normalize(z))) { zona = z; break; }
    }
  }

  // --- skills (only the offer's required skills matter for the score) ---
  const required = Array.isArray(offer.requiredSkills) ? offer.requiredSkills : [];
  const skills = required.filter(s => s && n.includes(normalize(s)));

  return {
    rubro: rubroDetected ? offer.rubro : null,
    puesto: puestoDetected ? offer.puesto : null,
    zona,
    skills
  };
}

module.exports = { normalize, buildProfileFromText, PUESTO_SYNONYMS };
