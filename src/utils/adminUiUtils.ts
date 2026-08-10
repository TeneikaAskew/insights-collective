// ABOUTME: Small presentational helpers for the Soft Studio admin surfaces —
// ABOUTME: two-letter initials, a deterministic avatar color, and the role→
// ABOUTME: badge-variant mapping. Kept separate so every admin page can reuse them.

// Palette mirrors the Soft Studio prototype avatar colors.
const AVATAR_COLORS = [
  '#624EBE', '#3FA391', '#A794EB', '#C97F3D', '#4E9B70',
  '#B97143', '#533FA8', '#3A7A8C', '#8A6FD1', '#2F8F7E',
];

/** Two-letter initials from a name; falls back to 'U'. */
export function getInitials(first?: string, last?: string): string {
  const a = (first || '').trim();
  const b = (last || '').trim();
  const initials = (a.charAt(0) || '') + (b.charAt(0) || a.charAt(1) || '');
  return (initials || 'U').toUpperCase().slice(0, 2);
}

/** Stable avatar color derived from a seed (e.g. the user id). */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export type RoleBadgeVariant = 'admin' | 'instructor' | 'student';

/** Maps a role to the color-coded badge variant (see ui/badge.tsx). */
export function roleBadgeVariant(role: string): RoleBadgeVariant {
  if (role === 'admin') return 'admin';
  if (role === 'instructor') return 'instructor';
  return 'student';
}
