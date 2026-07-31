import React from 'react';
import { CareerReportData } from '@/components/assistants/types';
import { useSkillCourses } from '@/hooks/useSkillCourses';
import { CourseraCourseRow } from '@/components/learning/CourseraCourseRow';
import { useCareerRoleWages, formatWageShort } from '@/hooks/useCareerRoleWages';

/** Reveal order for the canvas cards during generation. */
export const CANVAS_STAGES = ['summary', 'match', 'skills', 'path', 'roles', 'takeaways'] as const;
export type CanvasStage = typeof CANVAS_STAGES[number];
export const ALL_REVEALED = CANVAS_STAGES.length;

const levelToPct = (level?: string): number => {
  const l = (level || '').toLowerCase();
  if (l === 'beginner') return 30;
  if (l === 'advanced') return 90;
  return 60;
};

/** Strip "Step 1:", "Phase 2:" style prefixes the model sometimes adds. */
const cleanStepTitle = (title?: string): string => {
  if (!title) return '';
  const cleaned = title
    .replace(/^Step\s*\d+\s*:?\s*/i, '')
    .replace(/^\d+\.\s*/, '')
    .replace(/^Phase\s*\d+\s*:?\s*/i, '')
    .replace(/^Stage\s*\d+\s*:?\s*/i, '')
    .trim();
  return cleaned || title;
};

const Ghost: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    data-testid="canvas-ghost"
    className="rounded-[20px] border-2 border-dashed border-ss-track grid place-content-center text-center min-h-24 px-5 py-6 text-sm text-muted-foreground"
  >
    {children}
  </div>
);

const CanvasCard: React.FC<{ warm?: boolean; children: React.ReactNode }> = ({ warm, children }) => (
  <div data-testid="canvas-card" className={`ss-card bg-card p-5 animate-fade-in ${warm ? 'ss-card-warm' : ''}`}>
    {children}
  </div>
);

const CardLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">{children}</h3>
);

const Meter: React.FC<{ label: string; sub?: string; pct: number; warm?: boolean }> = ({ label, sub, pct, warm }) => (
  <div className="mb-3 last:mb-0">
    <div className="flex justify-between items-baseline mb-1 gap-2">
      <span className="text-sm truncate">
        {label}
        {sub && <span className="text-xs text-muted-foreground"> · {sub}</span>}
      </span>
      <span className="text-sm font-bold tabular-nums flex-none">{pct}%</span>
    </div>
    <div className="h-2 rounded-full bg-ss-track overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${warm ? 'bg-ss-peach' : 'bg-ss-lav'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
);

interface ReportCanvasProps {
  report: CareerReportData | null;
  /** Number of stages revealed (0 = none). Use ALL_REVEALED for a loaded report. */
  revealStage: number;
}

const ReportCanvas: React.FC<ReportCanvasProps> = ({ report, revealStage }) => {
  const live = (stage: CanvasStage) => !!report && revealStage > CANVAS_STAGES.indexOf(stage);

  const { bySlug: wagesBySlug } = useCareerRoleWages();
  const topRole = report?.recommendedRoles?.[0];
  const topWage = topRole ? wagesBySlug.get(topRole.roleSlug) : undefined;
  const pathSteps = (report?.futureCareerPath?.length ? report.futureCareerPath : report?.careerPathSteps) ?? [];
  const otherRoles = report?.potentialRoles ?? [];

  // Ground each skill row in the real catalog. The LLM's `course · provider`
  // text stays as the fallback for skills nothing matched.
  const skillItems = report?.skillsAndCourses?.slice(0, 5) ?? [];
  const { coursesBySkill } = useSkillCourses(skillItems.map((item) => item.skill));

  return (
    <div className="flex flex-col gap-4" data-testid="report-canvas">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground pl-1">
        Your pathway
      </p>

      {live('summary') && report ? (
        <CanvasCard warm>
          <CardLabel>Summary</CardLabel>
          <p className="ss-serif text-[1.02rem] leading-relaxed">{report.summary}</p>
        </CanvasCard>
      ) : (
        <Ghost>Your summary — appears when your report is generated</Ghost>
      )}

      {live('match') && topRole ? (
        <CanvasCard>
          <CardLabel>Top match</CardLabel>
          <div className="flex items-baseline gap-2 flex-wrap">
            {/* Title and pay both come from `career_role_wages`, keyed by the
                slug the model chose. The report itself carries neither, so a
                figure can never appear here without a BLS occupation behind it. */}
            <span className="text-lg font-bold tracking-tight">
              {topWage?.title ?? topRole.roleSlug}
            </span>
            {topWage && (
              <span className="ss-chip" title={`${topWage.occupation_title} (${topWage.soc_code}), ${topWage.reference_period}`}>
                {formatWageShort(topWage.pct25)}–{formatWageShort(topWage.pct75)}
              </span>
            )}
          </div>
          {typeof topRole.matchPercentage === 'number' && topRole.matchPercentage > 0 && (
            <div className="mt-3">
              <Meter label="Match with your answers" pct={Math.min(topRole.matchPercentage, 100)} />
            </div>
          )}
          {topRole.description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{topRole.description}</p>
          )}
        </CanvasCard>
      ) : (
        <Ghost>Top career match — appears when your report is generated</Ghost>
      )}

      {live('skills') && skillItems.length ? (
        <CanvasCard>
          <CardLabel>Skills &amp; courses</CardLabel>
          {skillItems.map((item, idx) => {
            const match = coursesBySkill.get(item.skill)?.[0];
            return (
              <div key={idx} className="mb-3 last:mb-0">
                <Meter
                  label={item.skill}
                  sub={match ? undefined : [item.course, item.provider].filter(Boolean).join(' · ')}
                  pct={levelToPct(item.level)}
                  warm={idx % 2 === 1}
                />
                {match && (
                  <div className="mt-1.5">
                    <CourseraCourseRow course={match} variant="compact" />
                  </div>
                )}
              </div>
            );
          })}
        </CanvasCard>
      ) : (
        <Ghost>Skills &amp; matching courses — appears when your report is generated</Ghost>
      )}

      {live('path') && pathSteps.length ? (
        <CanvasCard>
          <CardLabel>Path to {topWage?.title || 'your aspirational role'}</CardLabel>
          <ol className="m-0 p-0 list-none">
            {pathSteps.map((step: any, idx: number) => (
              <li key={idx} className="relative flex gap-3.5 pb-4 last:pb-0">
                {idx < pathSteps.length - 1 && (
                  <span className="absolute left-[13px] top-8 bottom-0 w-0.5 bg-ss-track" aria-hidden />
                )}
                <span className="flex-none w-7 h-7 rounded-full bg-ss-lav-chip text-ss-lav-deep text-xs font-bold grid place-content-center relative z-10">
                  {idx + 1}
                </span>
                <div className="text-sm leading-relaxed min-w-0">
                  <p className="font-bold m-0">
                    {cleanStepTitle(step.step || step.title)}
                    {(step.timeline || step.timeframe) && (
                      <span className="ml-2 text-[11px] font-bold text-ss-peach-deep bg-ss-warn-chip rounded-full px-2 py-0.5 whitespace-nowrap">
                        {step.timeline || step.timeframe}
                      </span>
                    )}
                  </p>
                  <p className="m-0 text-muted-foreground">{step.action || step.description}</p>
                  {step.focusAreas && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {String(step.focusAreas).split(',').map((area: string, i: number) => {
                        const trimmed = area.trim();
                        return trimmed ? (
                          <span key={i} className="ss-chip !text-xs">{trimmed}</span>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CanvasCard>
      ) : (
        <Ghost>Path to your aspirational role — appears when your report is generated</Ghost>
      )}

      {live('roles') && otherRoles.length ? (
        <CanvasCard>
          <CardLabel>Roles that fit you today</CardLabel>
          <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
            {otherRoles.map((role: any, idx: number) => (
              <li key={idx} className="text-sm leading-relaxed">
                <span className="font-bold">{typeof role === 'object' ? role.title : String(role)}</span>
                {typeof role === 'object' && role.description && (
                  <span className="text-muted-foreground"> — {role.description}</span>
                )}
              </li>
            ))}
          </ul>
        </CanvasCard>
      ) : (
        <Ghost>Roles that fit you today — appears when your report is generated</Ghost>
      )}

      {live('takeaways') && report?.keyTakeaways?.length ? (
        <CanvasCard>
          <CardLabel>Key takeaways</CardLabel>
          {/* Full sentences of advice, so they are set as a read rather than
              crammed into chips — chips are for short labels like a salary
              range or a timeline. */}
          <ul className="m-0 p-0 list-none">
            {report.keyTakeaways.map((takeaway, idx) => (
              <li
                key={idx}
                className="text-[0.95rem] leading-relaxed max-w-[62ch] py-3 border-b border-ss-track first:pt-0 last:pb-0 last:border-b-0"
              >
                {takeaway}
              </li>
            ))}
          </ul>
        </CanvasCard>
      ) : (
        <Ghost>Key takeaways — appears when your report is generated</Ghost>
      )}
    </div>
  );
};

export default ReportCanvas;
