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

export type Rubro = keyof typeof JOB_CATEGORIES;
export type Zona = typeof ZONAS_MDP[number];
