// ABOUTME: Renders a BLS wage distribution as a box-and-whisker strip on a shared salary scale.
// ABOUTME: Every instance names the BLS occupation it came from, because role titles are not BLS titles.
import { CareerRoleWage, formatWageShort } from '@/hooks/useCareerRoleWages';

/**
 * A fixed scale, so strips are directly comparable between roles. The floor and
 * ceiling sit outside every seeded occupation's 10th/90th percentile.
 */
export const WAGE_SCALE_MIN = 40_000;
export const WAGE_SCALE_MAX = 300_000;

const pct = (value: number) =>
  Math.max(0, Math.min(100, ((value - WAGE_SCALE_MIN) / (WAGE_SCALE_MAX - WAGE_SCALE_MIN)) * 100));

type Props = {
  wage: CareerRoleWage;
  /** Name the BLS occupation and SOC code under the strip. */
  showOccupation?: boolean;
  /** Print the $40k / median / $300k scale under the strip. */
  showScale?: boolean;
  className?: string;
};

/**
 * BLS publishes five percentiles, so the strip draws all of them: whiskers span
 * the 10th to 90th, the box the 25th to 75th, and a tick marks the median. Two
 * roles can share a "typical pay" range and have very different spreads, which
 * a single bar hides.
 *
 * No absent-data branch: `career_role_wages` inner-joins a NOT NULL FK and a
 * CHECK keeps the percentiles ordered, so every row here has a complete band.
 */
const WageBand = ({ wage, showOccupation = true, showScale = true, className = '' }: Props) => {
  const { pct10, pct25, median, pct75, pct90 } = wage;

  const lo = pct(pct10);
  const hi = pct(pct90);
  const boxLeft = pct(pct25);
  const boxWidth = Math.max(1.2, pct(pct75) - boxLeft);

  return (
    <div className={className}>
      <div className="flex justify-between gap-4 text-sm">
        <span className="text-muted-foreground">Typical pay</span>
        <span className="font-semibold text-right tabular-nums" data-testid="wage-range">
          {formatWageShort(pct25)} – {formatWageShort(pct75)}
        </span>
      </div>

      <div
        className="relative h-[22px] mt-1"
        data-testid="wage-band"
        data-pct10={pct10}
        data-pct25={pct25}
        data-median={median}
        data-pct75={pct75}
        data-pct90={pct90}
        role="img"
        aria-label={`Pay distribution: 10th percentile ${formatWageShort(pct10)}, 25th ${formatWageShort(
          pct25,
        )}, median ${formatWageShort(median)}, 75th ${formatWageShort(pct75)}, 90th ${formatWageShort(pct90)}`}
      >
        <span className="absolute left-0 right-0 top-[10px] h-[2px] rounded bg-muted" />
        <span
          className="absolute top-[10px] h-[2px] bg-ss-teal-chip"
          style={{ left: `${lo}%`, width: `${hi - lo}%` }}
        />
        <span className="absolute top-[6px] w-[2px] h-[10px] rounded bg-ss-teal-chip" style={{ left: `${lo}%` }} />
        <span className="absolute top-[6px] w-[2px] h-[10px] rounded bg-ss-teal-chip" style={{ left: `${hi}%` }} />
        <span
          className="absolute top-[4px] h-[14px] rounded bg-ss-teal opacity-90"
          style={{ left: `${boxLeft}%`, width: `${boxWidth}%` }}
        />
        <span
          className="absolute top-[1px] w-[2px] h-[20px] rounded bg-foreground"
          style={{ left: `${pct(median)}%` }}
        />
      </div>

      {showScale && (
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>{formatWageShort(WAGE_SCALE_MIN)}</span>
          <span>Median {formatWageShort(median)}</span>
          <span>{formatWageShort(WAGE_SCALE_MAX)}</span>
        </div>
      )}

      {showOccupation && (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          BLS: {wage.occupation_title} ({wage.soc_code})
          {wage.mapping_note ? ` — ${wage.mapping_note}` : ''}
        </p>
      )}
    </div>
  );
};

/** Shared key for the strip, so the encoding is explained once per page. */
export const WageBandLegend = ({ className = '' }: { className?: string }) => (
  <div className={`flex flex-wrap items-center gap-4 text-xs text-muted-foreground ${className}`}>
    <span className="flex items-center gap-1.5">
      <i className="inline-block w-[22px] h-[2px] bg-ss-teal-chip" /> 10th–90th
    </span>
    <span className="flex items-center gap-1.5">
      <i className="inline-block w-[22px] h-[10px] rounded-sm bg-ss-teal" /> 25th–75th
    </span>
    <span className="flex items-center gap-1.5">
      <i className="inline-block w-[2px] h-[12px] bg-foreground" /> Median
    </span>
  </div>
);

export default WageBand;
