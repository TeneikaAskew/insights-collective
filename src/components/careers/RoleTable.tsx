// ABOUTME: Dense list view of career roles, for comparing pay across many roles at once.
// ABOUTME: The grid of RoleCards is the other half of the List/Grid toggle on Explore Careers.
import React from 'react';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { CareerRoleWage, formatWageShort } from '@/hooks/useCareerRoleWages';
import WageBand from './WageBand';

interface RoleTableProps {
  roles: DataCareerRole[];
  wagesBySlug: Map<string, CareerRoleWage>;
  onOpenRole: (roleId: string) => void;
}

export const RoleTable: React.FC<RoleTableProps> = ({ roles, wagesBySlug, onOpenRole }) => (
  // The distribution column needs room, so the table scrolls inside its own
  // container rather than pushing the page sideways.
  <div className="overflow-x-auto rounded-xl border bg-card">
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
              id={`role-${role.id}`}
              data-testid="role-row"
              data-role-id={role.id}
              tabIndex={0}
              role="button"
              onClick={() => onOpenRole(role.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenRole(role.id);
                }
              }}
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
                <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-studio-peachDeep">
                  {role.category.split(',')[0].trim()}
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
                {wage && <WageBand wage={wage} showOccupation={false} showScale={false} />}
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
);

export default RoleTable;
