// Job categories for Mar del Plata
const JOB_CATEGORIES = {
  gastronomia: {
    label: 'Gastronomía',
    puestos: ['Cocinero', 'Ayudante de cocina', 'Mozo', 'Bachero', 'Barman']
  },
  comercio: {
    label: 'Comercio',
    puestos: ['Vendedor', 'Cajero', 'Repositor', 'Encargado']
  },
  construccion: {
    label: 'Construcción',
    puestos: ['Albañil', 'Ayudante', 'Electricista', 'Plomero', 'Pintor']
  },
  limpieza: {
    label: 'Limpieza',
    puestos: ['Empleada doméstica', 'Personal de limpieza', 'Mucama']
  },
  transporte: {
    label: 'Transporte',
    puestos: ['Chofer', 'Repartidor', 'Fletero']
  },
  administracion: {
    label: 'Administración',
    puestos: ['Administrativo', 'Recepcionista', 'Secretaria', 'Data entry']
  }
};

// Skills por rubro y puesto
const SKILLS_BY_RUBRO = {
  gastronomia: {
    _common: ['Trabajo en equipo', 'Puntualidad', 'Higiene y manipulación de alimentos', 'Resistencia física'],
    'Cocinero': ['Cocina internacional', 'Parrilla', 'Pastelería', 'Cocina rápida', 'Menú del día', 'Manejo de stock'],
    'Ayudante de cocina': ['Mise en place', 'Limpieza de cocina', 'Corte de verduras', 'Apoyo al cocinero'],
    'Mozo': ['Atención al cliente', 'Manejo de bandeja', 'Conocimiento de vinos', 'Inglés básico', 'Trabajo bajo presión'],
    'Bachero': ['Limpieza rápida', 'Organización', 'Resistencia física'],
    'Barman': ['Coctelería clásica', 'Coctelería de autor', 'Atención al cliente', 'Manejo de caja', 'Inglés básico']
  },
  comercio: {
    _common: ['Atención al cliente', 'Buena presencia', 'Comunicación', 'Trabajo en equipo'],
    'Vendedor': ['Técnicas de venta', 'Conocimiento del producto', 'Negociación', 'Fidelización de clientes', 'Manejo de objeciones'],
    'Cajero': ['Manejo de caja', 'Cobro con tarjetas', 'Arqueo de caja', 'Atención rápida', 'Matemáticas básicas'],
    'Repositor': ['Organización de góndolas', 'Control de vencimientos', 'Manejo de stock', 'Orden y limpieza'],
    'Encargado': ['Liderazgo', 'Manejo de personal', 'Control de stock', 'Apertura y cierre', 'Resolución de conflictos']
  },
  construccion: {
    _common: ['Trabajo en altura', 'Uso de EPP', 'Lectura de planos básica', 'Trabajo en equipo'],
    'Albañil': ['Levantamiento de paredes', 'Revoques', 'Contrapisos', 'Colocación de cerámicos', 'Mezcla de materiales'],
    'Ayudante': ['Preparación de materiales', 'Limpieza de obra', 'Transporte de materiales', 'Apoyo general'],
    'Electricista': ['Instalaciones domiciliarias', 'Tableros eléctricos', 'Lectura de planos eléctricos', 'Normas de seguridad'],
    'Plomero': ['Instalaciones sanitarias', 'Termotanques', 'Destapaciones', 'Soldadura de caños'],
    'Pintor': ['Pintura interior', 'Pintura exterior', 'Preparación de superficies', 'Empapelado', 'Técnicas decorativas']
  },
  limpieza: {
    _common: ['Responsabilidad', 'Discreción', 'Organización', 'Uso de productos de limpieza'],
    'Empleada doméstica': ['Limpieza profunda', 'Planchado', 'Cocina básica', 'Cuidado de ropa', 'Organización del hogar'],
    'Personal de limpieza': ['Limpieza de oficinas', 'Limpieza de vidrios', 'Manejo de máquinas', 'Limpieza industrial'],
    'Mucama': ['Tendido de camas', 'Limpieza de habitaciones', 'Atención a huéspedes', 'Reposición de amenities']
  },
  transporte: {
    _common: ['Licencia de conducir', 'Conocimiento de calles', 'Puntualidad', 'Responsabilidad'],
    'Chofer': ['Licencia profesional', 'Manejo defensivo', 'GPS', 'Atención al pasajero', 'Mantenimiento básico'],
    'Repartidor': ['Moto propia', 'Conocimiento de zonas', 'Rapidez', 'Buen trato', 'Manejo de efectivo'],
    'Fletero': ['Vehículo propio', 'Carga y descarga', 'Embalaje', 'Mudanzas', 'Armado de muebles']
  },
  administracion: {
    _common: ['Manejo de PC', 'Microsoft Office', 'Organización', 'Comunicación escrita'],
    'Administrativo': ['Facturación', 'Cuentas a pagar/cobrar', 'Archivo', 'Atención telefónica', 'Gestión de proveedores'],
    'Recepcionista': ['Atención al público', 'Agenda de turnos', 'Atención telefónica', 'Inglés básico', 'Buena presencia'],
    'Secretaria': ['Gestión de agenda', 'Redacción', 'Organización de reuniones', 'Confidencialidad', 'Multitasking'],
    'Data entry': ['Tipeo rápido', 'Atención al detalle', 'Manejo de planillas', 'Carga de datos', 'Excel avanzado']
  }
};

/**
 * Obtiene las skills sugeridas para un rubro y puesto específico
 * @param {string} rubro - El rubro (ej: 'gastronomia')
 * @param {string} puesto - El puesto (ej: 'Cocinero')
 * @returns {string[]} Array de skills sugeridas (comunes + específicas del puesto)
 */
function getSuggestedSkills(rubro, puesto) {
  const rubroData = SKILLS_BY_RUBRO[rubro];
  if (!rubroData) return [];

  const commonSkills = rubroData._common || [];
  const puestoSkills = rubroData[puesto] || [];

  // Retorna skills comunes + skills del puesto sin duplicados
  return [...new Set([...commonSkills, ...puestoSkills])];
}

/**
 * Obtiene todas las skills disponibles para un rubro
 * @param {string} rubro - El rubro (ej: 'gastronomia')
 * @returns {string[]} Array de todas las skills del rubro
 */
function getAllSkillsForRubro(rubro) {
  const rubroData = SKILLS_BY_RUBRO[rubro];
  if (!rubroData) return [];

  const allSkills = new Set();
  Object.values(rubroData).forEach(skills => {
    if (Array.isArray(skills)) {
      skills.forEach(skill => allSkills.add(skill));
    }
  });

  return [...allSkills].sort();
}

/**
 * Obtiene todas las skills disponibles en el sistema
 * @returns {string[]} Array de todas las skills
 */
function getAllSkills() {
  const allSkills = new Set();
  Object.values(SKILLS_BY_RUBRO).forEach(rubroData => {
    Object.values(rubroData).forEach(skills => {
      if (Array.isArray(skills)) {
        skills.forEach(skill => allSkills.add(skill));
      }
    });
  });

  return [...allSkills].sort();
}

const ZONAS_MDP = [
  'Centro',
  'La Perla',
  'Güemes',
  'Punta Mogotes',
  'Puerto',
  'Constitución',
  'San Juan',
  'Los Troncos',
  'Otras'
];

// Centro aproximado de Mar del Plata (usado como default de seed de ciudad).
const MDP_CENTER = { lat: -38.0023, lng: -57.5575 };

// Centroides aproximados de los barrios de Mar del Plata. Solo se usan como
// fallback cuando una entidad no tiene coordenadas precisas (GPS/geocoding):
// permiten estimar proximidad a partir de la zona categórica. 'Otras' = sin
// centroide (se trata como sin ubicación).
const ZONA_CENTROIDS = {
  'Centro': { lat: -38.0028, lng: -57.5426 },
  'La Perla': { lat: -37.9866, lng: -57.5430 },
  'Güemes': { lat: -38.0090, lng: -57.5460 },
  'Los Troncos': { lat: -38.0145, lng: -57.5480 },
  'San Juan': { lat: -38.0210, lng: -57.5760 },
  'Constitución': { lat: -37.9560, lng: -57.5560 },
  'Puerto': { lat: -38.0360, lng: -57.5310 },
  'Punta Mogotes': { lat: -38.0720, lng: -57.5430 },
  'Otras': null
};

/** Lowercase + strip accents/diacritics for tolerant matching. */
function normalizeStr(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

// Variantes de texto libre frecuentes -> etiqueta canónica de ZONAS_MDP.
// Las claves ya están normalizadas (sin acentos, minúsculas).
const ZONA_SYNONYMS = {
  'centro': 'Centro', 'microcentro': 'Centro', 'centro de mar del plata': 'Centro',
  'la perla': 'La Perla', 'perla': 'La Perla', 'playa la perla': 'La Perla',
  'guemes': 'Güemes', 'barrio guemes': 'Güemes', 'zona guemes': 'Güemes',
  'punta mogotes': 'Punta Mogotes', 'mogotes': 'Punta Mogotes', 'faro': 'Punta Mogotes',
  'puerto': 'Puerto', 'zona puerto': 'Puerto',
  'constitucion': 'Constitución', 'playa grande': 'Constitución',
  'san juan': 'San Juan',
  'los troncos': 'Los Troncos', 'troncos': 'Los Troncos',
  'otras': 'Otras', 'otra': 'Otras'
};

/**
 * Normaliza texto libre de zona a una etiqueta canónica de ZONAS_MDP.
 * @param {string} input - texto de zona (puede venir de un CV, dropdown, etc.)
 * @returns {string|null} etiqueta canónica o null si no se reconoce.
 */
function normalizeZona(input) {
  const n = normalizeStr(input);
  if (!n) return null;
  if (ZONA_SYNONYMS[n]) return ZONA_SYNONYMS[n];
  // match canónico exacto (insensible a acentos)
  for (const z of ZONAS_MDP) {
    if (normalizeStr(z) === n) return z;
  }
  // substring: el texto libre contiene un token canónico (ej. "vivo en san juan, mdp")
  for (const z of ZONAS_MDP) {
    const zn = normalizeStr(z);
    if (zn !== 'otras' && (n.includes(zn) || zn.includes(n))) return z;
  }
  // substring por sinónimo
  for (const [syn, canonical] of Object.entries(ZONA_SYNONYMS)) {
    if (canonical !== 'Otras' && n.includes(syn)) return canonical;
  }
  return null;
}

/**
 * Devuelve el centroide aproximado { lat, lng } de una zona, o null.
 * @param {string} zonaLabel - etiqueta de zona (libre o canónica).
 */
function zonaCentroid(zonaLabel) {
  const canonical = normalizeZona(zonaLabel);
  if (!canonical) return null;
  return ZONA_CENTROIDS[canonical] || null;
}

module.exports = {
  JOB_CATEGORIES,
  ZONAS_MDP,
  MDP_CENTER,
  ZONA_CENTROIDS,
  SKILLS_BY_RUBRO,
  getSuggestedSkills,
  getAllSkillsForRubro,
  getAllSkills,
  normalizeStr,
  normalizeZona,
  zonaCentroid
};
