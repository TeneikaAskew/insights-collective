// ABOUTME: Renders a BLS wage band as a labelled range bar on a shared salary scale.
// ABOUTME: Every instance names the BLS occupation it came from, because role titles are not BLS titles.
import { CareerRoleWage, formatWageShort } from '@/hooks/useCareerRoleWages';

/**
 * A fixed scale, so bars are comparable across cards. The floor and ceiling sit
 * outside every seeded occupation's 10th/90th percentile, so nothing clips.
 */
export const WAGE_SCALE_MIN = 40_000;
export const WAGE_SCALE_MAX = 300_000;

const pct = (value: number) =>
  Math.max(0, Math.min(100, ((value - WAGE_SCALE_MIN) / (WAGE_SCALE_MAX - WAGE_SCALE_MIN)) * 100));

type Props = {
  wage: CareerRoleWage;
  /** Show the BLS occupation title and SOC code under the bar. */
  showOccupation?: boolean;
  className?: string;
};

/**
 * No absent-data branch on purpose: `career_role_wages` inner-joins a NOT NULL
 * FK, and a CHECK constraint keeps the percentiles ordered, so every row that
 * reaches this component has a complete, well-formed band.
 */
const WageBand = ({ wage, showOccupation = true, className = '' }: Props) => {
  const { pct25, median, pct75 } = wage;

  const left = pct(pct25);
  const width = Math.max(1.5, pct(pct75) - left);
  const medianLeft = pct(median);

  return (
    <div className={className}>
      <div className="flex justify-between gap-4 text-sm">
        <span className="text-studio-muted">Typical pay</span>
        <span className="font-semibold text-studio-ink text-right tabular-nums">
          {formatWageShort(pct25)} – {formatWageShort(pct75)}
        </span>
      </div>

      <div
        className="relative mt-2 h-[9px] rounded-full bg-studio-track overflow-hidden"
        role="img"
        aria-label={`Middle half of earners make ${formatWageShort(pct25)} to ${formatWageShort(
          pct75,
        )}, median ${formatWageShort(median)}`}
      >
        <span
          className="absolute inset-y-0 rounded-full bg-studio-teal"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        {/* Median tick, so the bar shows centre as well as spread. */}
        <span
          className="absolute inset-y-0 w-[2px] bg-studio-card"
          style={{ left: `${medianLeft}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-studio-muted tabular-nums">
        <span>{formatWageShort(WAGE_SCALE_MIN)}</span>
        <span>Median {formatWageShort(median)}</span>
        <span>{formatWageShort(WAGE_SCALE_MAX)}</span>
      </div>

      {showOccupation && (
        <p className="mt-2 text-[11px] leading-snug text-studio-muted">
          BLS occupation: {wage.occupation_title} ({wage.soc_code})
          {wage.mapping_note ? ` — ${wage.mapping_note}` : ''}
        </p>
      )}
    </div>
  );
};

export default WageBand;
