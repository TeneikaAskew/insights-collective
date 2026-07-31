// ABOUTME: The one categorical chart palette, built from Soft Studio tokens so
// ABOUTME: every dashboard shares a ramp and adapts to Ink Studio dark at paint
// ABOUTME: time. Before this, four dashboards shipped four inconsistent hex
// ABOUTME: palettes — two of them Recharts demo defaults nobody chose.

/**
 * Ordered for adjacent-contrast: identity first, then hue-separated accents.
 * The values are CSS variable references, so SVG fills/strokes resolve against
 * whichever theme is active when the chart paints.
 */
export const CHART_COLORS = [
  'hsl(var(--ss-lav-deep))',
  'hsl(var(--ss-teal))',
  'hsl(var(--ss-peach-deep))',
  'hsl(var(--ss-good))',
  'hsl(var(--ss-lav))',
  'hsl(var(--ss-warn))',
] as const;

/** Cycle safely past the ramp's end. */
export const chartColor = (index: number): string =>
  CHART_COLORS[((index % CHART_COLORS.length) + CHART_COLORS.length) % CHART_COLORS.length];

/** Track/grid line color for cartesian charts. */
export const CHART_GRID = 'hsl(var(--ss-track))';
