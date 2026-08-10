// ABOUTME: Dense list view of career roles, for comparing pay across many roles at once.
// ABOUTME: One of the three views on Explore Careers, alongside Grid and By Category.
import React from 'react';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { CareerRoleWage, formatWageShort } from '@/hooks/useCareerRoleWages';
import WageBand from './WageBand';

interface RoleTableProps {
  roles: DataCareerRole[];
  wagesBySlug: Map<string, CareerRoleWage>;
  onOpenRole: (roleId: string) => void;
}

/**
 * Click/keyboard behavior and identity, shared by both presentations below.
 *
 * Defined once so the table row and the stacked card cannot drift apart — a role
 * that opens on Enter at desktop width but not on a phone is the kind of gap
 * that survives a long time, because nobody tests the same behavior twice.
 */
const rowProps = (roleId: string, onOpenRole: (roleId: string) => void) => ({
  id: `role-${roleId}`,
  'data-testid': 'role-row',
  'data-role-id': roleId,
  tabIndex: 0,
  role: 'button' as const,
  onClick: () => onOpenRole(roleId),
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenRole(roleId);
    }
  },
});

const track = (role: DataCareerRole) => role.category.split(',')[0].trim();

const trackClass = 'text-[11.5px] font-bold uppercase tracking-[0.06em] text-ss-peach-deep';

/**
 * Below `sm` the five columns cannot fit, and a 780px table in a 390px viewport
 * means swiping sideways to reach the pay — the whole point of this view. Each
 * role stacks instead, carrying the same fields the columns carry.
 *
 * BOTH presentations are mounted at every width — `sm:hidden` / `hidden sm:block`
 * only toggle CSS visibility, they do not unmount. Anything that queries this
 * DOM (tests above all) must filter to visible elements, or it sees two copies
 * of every row, band, title, and attribution line. A previous version of this
 * comment claimed only one presentation is mounted at a time; four e2e specs
 * were written against that claim and all four failed in CI.
 */
const RoleCards: React.FC<RoleTableProps> = ({ roles, wagesBySlug, onOpenRole }) => (
  <div className="sm:hidden space-y-3">
    {roles.map((role) => {
      const wage = wagesBySlug.get(role.id);
      return (
        <div
          key={role.id}
          {...rowProps(role.id, onOpenRole)}
          className="ss-card bg-card p-4 space-y-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {/* Track sits under the title rather than beside it: a three-line role
              name next to a one-line label left a ragged gap at 390px. */}
          <div className="space-y-1">
            <div className="font-semibold leading-snug">{role.title}</div>
            <span className={`${trackClass} block`} data-testid="role-track">
              {track(role)}
            </span>
            {wage && (
              <div className="text-[11.5px] text-muted-foreground">
                BLS: {wage.occupation_title} ({wage.soc_code})
              </div>
            )}
          </div>

          {wage && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold tabular-nums">
                  {formatWageShort(wage.pct25)} – {formatWageShort(wage.pct75)}
                </span>
                <span className="text-[11.5px] text-muted-foreground tabular-nums">
                  median {formatWageShort(wage.median)}
                </span>
              </div>
              <WageBand wage={wage} showOccupation={false} showScale={false} showRange={false} />
              <div className="text-[11.5px] text-muted-foreground tabular-nums">
                {wage.employment.toLocaleString()} US jobs
              </div>
            </>
          )}
        </div>
      );
    })}
  </div>
);

export const RoleTable: React.FC<RoleTableProps> = (props) => {
  const { roles, wagesBySlug, onOpenRole } = props;
  return (
    <>
      <RoleCards {...props} />

      {/* From `sm` up the table fits. It keeps its own overflow container for the
          narrow end of that range — which only works because the grid item on the
          page carries `min-w-0`; without it the column grows to the table's
          min-width and drags every sibling, including the mobile filter bar,
          off-screen with it. */}
      <div className="hidden sm:block ss-card bg-card overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse">
          <thead>
            <tr className="bg-muted/40">
              {['Role', 'Track', 'Typical pay', 'Distribution', 'US jobs'].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground px-4 py-3 border-b whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const wage = wagesBySlug.get(role.id);
              return (
                <tr
                  key={role.id}
                  {...rowProps(role.id, onOpenRole)}
                  className="border-b last:border-b-0 hover:bg-muted/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <td className="px-4 py-3 align-middle">
                    <div className="font-semibold">{role.title}</div>
                    {wage && (
                      <div className="text-[11.5px] text-muted-foreground">
                        BLS: {wage.occupation_title} ({wage.soc_code})
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <span className={trackClass} data-testid="role-track">
                      {track(role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    {wage && (
                      <>
                        <div className="font-semibold tabular-nums">
                          {formatWageShort(wage.pct25)} – {formatWageShort(wage.pct75)}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground tabular-nums">
                          median {formatWageShort(wage.median)}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle min-w-[230px]">
                    {wage && <WageBand wage={wage} showOccupation={false} showScale={false} showRange={false} />}
                  </td>
                  <td className="px-4 py-3 align-middle text-[13px] text-muted-foreground tabular-nums">
                    {wage?.employment.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default RoleTable;
