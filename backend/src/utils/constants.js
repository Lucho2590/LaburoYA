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

module.exports = {
  JOB_CATEGORIES,
  ZONAS_MDP
};
