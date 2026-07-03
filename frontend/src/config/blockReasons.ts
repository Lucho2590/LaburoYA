// Espejo de los motivos de bloqueo definidos en el backend
// (backend/src/services/profileBlocks.js REASONS). El backend valida igual;
// esto es solo para el <select> del modal de bloqueo.
export const BLOCK_REASONS = [
  { key: 'no_cumple_requisitos', label: 'No cumple los requisitos' },
  { key: 'mala_experiencia', label: 'Mala experiencia previa' },
  { key: 'no_se_presento', label: 'No se presentó / no respondió' },
  { key: 'datos_falsos', label: 'Datos falsos o perfil sospechoso' },
  { key: 'otro', label: 'Otro' },
] as const;

export type TBlockReason = (typeof BLOCK_REASONS)[number]['key'];

export const blockReasonLabel = (key: string) =>
  BLOCK_REASONS.find((r) => r.key === key)?.label || key;
