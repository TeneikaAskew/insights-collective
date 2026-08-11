// ABOUTME: The "Similar Roles" block at the foot of a career role's detail
// ABOUTME: dialog. Ranking is content-based (see lib/roleSimilarity) — never pay
// ABOUTME: — and each entry swaps the dialog over to that role when the page
// ABOUTME: supplies a handler, so exploring sideways never leaves the dialog.

import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataCareerRole } from '@/data/dataCareerRoles';
import { getSimilarRoles } from '@/lib/roleSimilarity';

interface SimilarRolesSectionProps {
  role: DataCareerRole;
  /**
   * Opens another role in the same dialog. Omitted on surfaces that have no
   * dialog to drive — the section then renders as plain, non-interactive cards
   * rather than buttons that do nothing.
   */
  onSelectRole?: (roleId: string) => void;
  /** Catalog to rank within. Defaults to the bundled roles; injected by tests. */
  roles?: DataCareerRole[];
  /** How many neighbours to show. Default 5. */
  limit?: number;
}

export const SimilarRolesSection: React.FC<SimilarRolesSectionProps> = ({
  role,
  onSelectRole,
  roles,
  limit = 5,
}) => {
  // Recomputed only when the open role changes; the tf-idf index itself is
  // built once per catalog and cached inside the resolver.
  const similar = React.useMemo(
    () => getSimilarRoles(role.id, { roles, limit }),
    [role.id, roles, limit],
  );

  if (similar.length === 0) return null;

  return (
    <section className="mt-8 border-t pt-6" aria-labelledby="similar-roles-heading">
      <h3 id="similar-roles-heading" className="font-semibold text-lg">
        Similar Roles
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Closest matches to {role.title} by responsibilities, skills and day-to-day work.
      </p>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {similar.map(({ role: match, sharedSkills }) => {
          const interactive = Boolean(onSelectRole);
          const body = (
            <>
              <div className="flex items-start justify-between gap-2">
                <span data-testid="similar-role-title" className="font-medium leading-snug">
                  {match.title}
                </span>
                {interactive && (
                  <ArrowRight
                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {match.shortDescription}
              </p>
              {sharedSkills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {/* The score orders the list; these name the overlap in words
                      a reader can check, which a cosine value cannot. */}
                  {sharedSkills.slice(0, 3).map(skill => (
                    <Badge key={skill} variant="outline" className="text-xs font-normal">
                      {skill}
                    </Badge>
                  ))}
                  {sharedSkills.length > 3 && (
                    <span className="self-center text-xs text-muted-foreground">
                      +{sharedSkills.length - 3} more shared
                    </span>
                  )}
                </div>
              )}
            </>
          );

          return (
            <li key={match.id}>
              {interactive ? (
                <button
                  type="button"
                  data-testid="similar-role"
                  onClick={() => onSelectRole?.(match.id)}
                  className="h-full w-full rounded-xl border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </button>
              ) : (
                <div data-testid="similar-role" className="h-full rounded-xl border bg-card p-3">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
