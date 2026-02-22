// Job categories - same as backend
export const JOB_CATEGORIES = {
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
} as const;

export const ZONAS_MDP = [
  'Centro',
  'La Perla',
  'Güemes',
  'Punta Mogotes',
  'Puerto',
  'Constitución',
  'San Juan',
  'Los Troncos',
  'Otras'
] as const;

// Skills por rubro y puesto - synced with backend
export const SKILLS_BY_RUBRO: Record<string, Record<string, string[]>> = {
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
 * Get suggested skills for a specific rubro and puesto
 */
export function getSuggestedSkills(rubro: string, puesto: string): string[] {
  const rubroData = SKILLS_BY_RUBRO[rubro];
  if (!rubroData) return [];

  const commonSkills = rubroData._common || [];
  const puestoSkills = rubroData[puesto] || [];

  // Return common + puesto skills without duplicates
  return [...new Set([...commonSkills, ...puestoSkills])];
}

/**
 * Get all skills for a rubro
 */
export function getAllSkillsForRubro(rubro: string): string[] {
  const rubroData = SKILLS_BY_RUBRO[rubro];
  if (!rubroData) return [];

  const allSkills = new Set<string>();
  Object.values(rubroData).forEach(skills => {
    if (Array.isArray(skills)) {
      skills.forEach(skill => allSkills.add(skill));
    }
  });

  return [...allSkills].sort();
}

/**
 * Get all available skills in the system
 */
export function getAllSkills(): string[] {
  const allSkills = new Set<string>();
  Object.values(SKILLS_BY_RUBRO).forEach(rubroData => {
    Object.values(rubroData).forEach(skills => {
      if (Array.isArray(skills)) {
        skills.forEach(skill => allSkills.add(skill));
      }
    });
  });

  return [...allSkills].sort();
}

export type TRubro = keyof typeof JOB_CATEGORIES;
export type TZona = typeof ZONAS_MDP[number];
