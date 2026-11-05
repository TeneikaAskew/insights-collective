// ABOUTME: One reading of courses.estimated_hours for display and catalog filtering ("Estimated time").
// ABOUTME: Legacy courses.duration has no defined unit and is deliberately not read here.

/** A usable estimate: a finite number above zero. Null, NaN, 0 and negatives are "no estimate". */
export function validEstimatedHours(h: unknown): number | null {
  const n = typeof h === 'string' && h.trim() !== '' ? Number(h) : h;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/** The value people see: the estimate rounded to 0.1 h. Buckets use this same value, so a card that reads
 *  "2 hours" is never filtered under "Under 2 hours". */
export function displayedEstimatedHours(h: unknown): number | null {
  const n = validEstimatedHours(h);
  return n === null ? null : Math.round(n * 10) / 10;
}

/** "4.5 hours", "1 hour", "Under 0.1 hours"; null when there is no usable estimate (render nothing). */
export function formatEstimatedHours(h: unknown): string | null {
  const rounded = displayedEstimatedHours(h);
  if (rounded === null) return null;
  if (rounded < 0.1) return 'Under 0.1 hours';
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${rounded === 1 ? 'hour' : 'hours'}`;
}

/** Catalog buckets over the DISPLAYED (0.1 h rounded) value: lower bound inclusive, upper bound exclusive.
 *  Courses with no estimate match only 'all'. */
export const ESTIMATED_TIME_BUCKETS = [
  { value: 'lt2', label: 'Under 2 hours', min: 0, max: 2 },
  { value: '2to5', label: '2 to 5 hours', min: 2, max: 5 },
  { value: '5to10', label: '5 to 10 hours', min: 5, max: 10 },
  { value: 'gte10', label: '10 hours or more', min: 10, max: Infinity },
] as const;

export type EstimatedTimeBucket = 'all' | (typeof ESTIMATED_TIME_BUCKETS)[number]['value'];

export function matchesEstimatedTime(h: unknown, bucket: string): boolean {
  if (bucket === 'all') return true;
  const b = ESTIMATED_TIME_BUCKETS.find((x) => x.value === bucket);
  const n = displayedEstimatedHours(h);
  if (!b || n === null) return false;
  return n >= b.min && n < b.max;
}
