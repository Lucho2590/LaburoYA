// Single source of truth for the star scale. The backend computes `stars`
// from the 0-100 score; this mirror is a fallback (and used for filter labels).

export const STAR_MAX = 5;

/** Map a 0-100 relevance/fit score to a 1-5 star rating. Must match backend. */
export function scoreToStars(score: number): number {
  const s = Number(score) || 0;
  if (s >= 80) return 5;
  if (s >= 60) return 4;
  if (s >= 40) return 3;
  if (s >= 20) return 2;
  if (s >= 1) return 1;
  return 0;
}

// Filter options for "N★ o más" controls. value = minimum stars (0 = all).
export const STAR_FILTERS: { value: number; label: string }[] = [
  { value: 0, label: 'Todas' },
  { value: 5, label: '5★' },
  { value: 4, label: '4★+' },
  { value: 3, label: '3★+' },
  { value: 2, label: '2★+' },
];
