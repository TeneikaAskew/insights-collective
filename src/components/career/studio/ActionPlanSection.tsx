import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useNavigate } from 'react-router-dom';
import { Loader2, Check, ArrowRight, ExternalLink } from 'lucide-react';

import { createLogger } from '@/utils/logger';

const logger = createLogger('ActionPlanSection');

interface CourseData {
  title: string;
  provider: string;
  url?: string;
}

interface SkillData {
  name: string;
  courses: Array<CourseData | string>;
}

interface ProjectData {
  title: string;
  description: string;
}

interface ContentData {
  platform: string;
  topics: string[];
}

export interface ActionPlanTimeframe {
  skills: SkillData[];
  projects: ProjectData[];
  content: ContentData[];
  milestones: string[];
  narrative: string;
}

export type ActionPlan = Partial<Record<TimeframeKey, ActionPlanTimeframe>>;

const TIMEFRAME_KEYS = ['6_weeks', '9_weeks', '12_weeks', '6_months', '12_months'] as const;
type TimeframeKey = typeof TIMEFRAME_KEYS[number];

const TIMEFRAME_LABELS: Record<TimeframeKey, string> = {
  '6_weeks': '6 Weeks',
  '9_weeks': '9 Weeks',
  '12_weeks': '12 Weeks',
  '6_months': '6 Months',
  '12_months': '12 Months',
};

const GENERATION_STATUSES = [
  'Reading your pathway report…',
  'Matching courses to your skill gaps…',
  'Choosing projects that fit your career story…',
  'Sequencing milestones across 12 months…',
];

/** Older saved plans stored courses as plain strings; render both shapes. */
const courseParts = (course: CourseData | string): CourseData =>
  typeof course === 'string' ? { title: course, provider: '' } : course;

const isValidTimeframe = (data: unknown): data is ActionPlanTimeframe => {
  const d = data as ActionPlanTimeframe;
  return !!d && typeof d === 'object' &&
    (Array.isArray(d.skills) || Array.isArray(d.projects) || Array.isArray(d.content) || Array.isArray(d.milestones));
};

export const isValidActionPlan = (plan: unknown): plan is ActionPlan =>
  !!plan && typeof plan === 'object' && TIMEFRAME_KEYS.some((key) => isValidTimeframe((plan as ActionPlan)[key]));

// Keyed by `${timeframe}:${index}`, but completion only applies when the
// stored milestone text still matches the rendered milestone — a regenerated
// plan reorders/rewrites milestones, and positional state must not leak
// across generations. (Empty stored text accepts legacy rows.)
interface ProgressEntry { completed: boolean; text: string }
type ProgressState = Record<string, ProgressEntry>;

const progressStorageKey = (userId: string) => `action_plan_progress_${userId}`;

const normalizeProgressEntry = (value: unknown): ProgressEntry =>
  typeof value === 'boolean'
    ? { completed: value, text: '' } // legacy localStorage shape
    : { completed: !!(value as ProgressEntry)?.completed, text: (value as ProgressEntry)?.text ?? '' };

const entryApplies = (entry: ProgressEntry | undefined, milestoneText: string): boolean =>
  !!entry && entry.completed && (entry.text === '' || entry.text === milestoneText);

const AddToPortfolioButton: React.FC<{
  isAdded: boolean;
  isLoading: boolean;
  onClick: () => void;
}> = ({ isAdded, isLoading, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isAdded || isLoading}
    className={`flex-none text-xs font-bold rounded-full px-3 py-1.5 border transition-colors ${
      isAdded
        ? 'bg-ss-good-chip text-ss-good border-transparent cursor-default'
        : 'border-border text-ss-lav-deep hover:border-ss-lav hover:bg-ss-lav-chip'
    }`}
  >
    {isLoading ? (
      <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Adding…</span>
    ) : isAdded ? (
      <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Added</span>
    ) : (
      '+ Portfolio'
    )}
  </button>
);

interface ActionPlanSectionProps {
  initialActionPlan?: ActionPlan | null;
  /**
   * Milestone progress for the active timeframe, reported upward so the page
   * can show it while this section is on the hidden panel.
   */
  onMilestoneProgress?: (progress: { done: number; total: number }) => void;
}

const ActionPlanSection: React.FC<ActionPlanSectionProps> = ({ initialActionPlan, onMilestoneProgress }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { projects: portfolioProjects } = usePortfolio();

  const [plan, setPlan] = useState<ActionPlan | null>(
    isValidActionPlan(initialActionPlan) ? initialActionPlan : null,
  );
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>('6_weeks');
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [progress, setProgress] = useState<ProgressState>({});
  const [progressRemote, setProgressRemote] = useState(true);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isValidActionPlan(initialActionPlan)) setPlan(initialActionPlan);
  }, [initialActionPlan]);

  // Cycle the drafting status line while generating.
  useEffect(() => {
    if (!isGenerating) return;
    setStatusIndex(0);
    const timer = setInterval(() => {
      setStatusIndex((i) => (i + 1) % GENERATION_STATUSES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isGenerating]);

  // Load milestone progress: from Supabase, falling back to localStorage if the
  // table isn't available yet.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('action_plan_progress' as never)
          .select('timeframe, milestone_index, milestone_text, completed');
        if (error) throw error;
        if (cancelled) return;
        const next: ProgressState = {};
        (data as Array<{ timeframe: string; milestone_index: number; milestone_text: string | null; completed: boolean }> | null)?.forEach((row) => {
          next[`${row.timeframe}:${row.milestone_index}`] = { completed: row.completed, text: row.milestone_text ?? '' };
        });
        setProgress(next);
        setProgressRemote(true);
      } catch (e) {
        logger.warn('action_plan_progress unavailable, using localStorage:', e);
        setProgressRemote(false);
        try {
          const raw = localStorage.getItem(progressStorageKey(user.id));
          if (!cancelled && raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const next: ProgressState = {};
            Object.entries(parsed).forEach(([key, value]) => { next[key] = normalizeProgressEntry(value); });
            setProgress(next);
          }
        } catch { /* ignore corrupt cache */ }
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggleMilestone = useCallback(async (timeframe: TimeframeKey, index: number, text: string) => {
    if (!user?.id) return;
    const key = `${timeframe}:${index}`;
    const completed = !entryApplies(progress[key], text);
    const next: ProgressState = { ...progress, [key]: { completed, text } };
    setProgress(next);

    if (progressRemote) {
      const { error } = await supabase
        .from('action_plan_progress' as never)
        .upsert(
          {
            user_id: user.id,
            timeframe,
            milestone_index: index,
            milestone_text: text,
            completed,
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: 'user_id,timeframe,milestone_index' },
        );
      if (error) {
        logger.warn('Failed to persist milestone remotely, caching locally:', error);
        setProgressRemote(false);
      } else {
        return;
      }
    }
    try {
      localStorage.setItem(progressStorageKey(user.id), JSON.stringify(next));
    } catch { /* storage full — state still works for this session */ }
  }, [user?.id, progress, progressRemote]);

  const generatePlan = useCallback(async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to generate your career action plan.',
        variant: 'destructive',
      });
      return;
    }
    setIsGenerating(true);
    try {
      // Identity comes from the session JWT — the function no longer accepts a userId.
      const { data, error } = await supabase.functions.invoke('generate-career-action-plan', { body: {} });
      if (error) throw new Error(error.message);
      if (data?.success && isValidActionPlan(data.data)) {
        setPlan(data.data as ActionPlan);
        setActiveTimeframe('6_weeks');
        toast({
          title: 'Action plan ready',
          description: data.saved
            ? 'Your personalized action plan is ready and saved.'
            : 'Your action plan is ready, but could not be saved to your profile.',
          ...(data.saved ? {} : { variant: 'destructive' as const }),
        });
      } else {
        throw new Error(data?.error || 'Failed to generate a valid action plan.');
      }
    } catch (error) {
      logger.error('Error generating action plan:', error);
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'We couldn’t generate your action plan. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [user, toast]);

  const handleAddToPortfolio = useCallback(async (
    type: 'project' | 'content' | 'milestone',
    data: ProjectData | ContentData | string,
    timeframe: string,
  ) => {
    if (!user) return;
    const title = typeof data === 'string' ? data : 'title' in data ? data.title : (data as ContentData).platform;
    const itemId = `${type}-${timeframe}-${title}`;
    if (addedItems.has(itemId) || loadingItems.has(itemId)) return;
    setLoadingItems((prev) => new Set(prev).add(itemId));
    try {
      let projectData;
      if (type === 'project') {
        const p = data as ProjectData;
        projectData = {
          user_id: user.id, title: p.title, description: p.description,
          required_skills: [], effort_level: 'Medium', status: 'Idea',
        };
      } else if (type === 'content') {
        const c = data as ContentData;
        projectData = {
          user_id: user.id, title: `Content: ${c.platform}`,
          description: `Create content about: ${c.topics.join(', ')}`,
          required_skills: c.topics, effort_level: 'Low', status: 'Idea',
        };
      } else {
        projectData = {
          user_id: user.id, title: `Milestone: ${data}`,
          description: `Career milestone to achieve: ${data}`,
          required_skills: [], effort_level: 'Medium', status: 'Idea',
        };
      }
      const { error } = await supabase.from('portfolio_projects').insert(projectData);
      if (error) throw error;
      setAddedItems((prev) => new Set(prev).add(itemId));
      toast({ title: 'Added to portfolio', description: 'It’s in your portfolio tracker as an idea.' });
    } catch (error) {
      logger.error('Error adding to portfolio:', error);
      toast({ title: 'Couldn’t add to portfolio', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoadingItems((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }, [user, addedItems, loadingItems, toast]);

  const buttonState = useCallback((type: 'project' | 'content' | 'milestone', data: ProjectData | ContentData | string, timeframe: string) => {
    const title = typeof data === 'string' ? data : 'title' in data ? data.title : (data as ContentData).platform;
    const itemId = `${type}-${timeframe}-${title}`;
    const portfolioTitle = type === 'milestone' ? `Milestone: ${data}` : type === 'content' ? `Content: ${(data as ContentData).platform}` : title;
    const inPortfolio = Array.isArray(portfolioProjects) &&
      portfolioProjects.some((p: { title?: string }) => p.title === portfolioTitle);
    return {
      isAdded: addedItems.has(itemId) || inPortfolio,
      isLoading: loadingItems.has(itemId),
    };
  }, [addedItems, loadingItems, portfolioProjects]);

  const validKeys = useMemo(
    () => (plan ? TIMEFRAME_KEYS.filter((key) => isValidTimeframe(plan[key])) : []),
    [plan],
  );
  const active: TimeframeKey = validKeys.includes(activeTimeframe) ? activeTimeframe : (validKeys[0] ?? '6_weeks');
  const timeframeData = plan?.[active];

  const milestoneCount = timeframeData?.milestones?.length ?? 0;
  const milestonesDone = timeframeData
    ? timeframeData.milestones.filter((m, i) => entryApplies(progress[`${active}:${i}`], m)).length
    : 0;

  // Report progress up before the early return below, so the page's badge is
  // right whether or not a plan exists yet.
  useEffect(() => {
    onMilestoneProgress?.({ done: milestonesDone, total: milestoneCount });
  }, [onMilestoneProgress, milestonesDone, milestoneCount]);

  // ---------- No plan yet ----------
  if (!plan) {
    return (
      <section className="ss-card bg-card p-7" aria-label="Career action plan" data-testid="action-plan-section">
        <h2 className="text-xl font-bold tracking-tight mb-1.5">Your action plan</h2>
        <p className="text-sm text-muted-foreground mb-5 max-w-xl">
          Turn your pathway into a week-by-week plan — skills with named courses, portfolio projects,
          content to post, and checkable milestones across five timeframes.
        </p>
        {isGenerating ? (
          <div className="flex items-center gap-3 rounded-[18px] bg-background border border-border px-5 py-4">
            <span className="inline-flex gap-1" aria-hidden>
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="w-1.5 h-1.5 rounded-full bg-ss-lav animate-bounce" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </span>
            <span className="text-sm text-muted-foreground" role="status">{GENERATION_STATUSES[statusIndex]}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={generatePlan}
            className="rounded-full bg-ss-lav-deep text-white text-sm font-bold px-6 py-3 transition-colors hover:bg-ss-lav-deep/90"
          >
            Generate my action plan
          </button>
        )}
      </section>
    );
  }

  // ---------- Plan ----------
  return (
    <section aria-label="Career action plan" data-testid="action-plan-section">
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <h2 className="text-xl font-bold tracking-tight">Your action plan</h2>
        <span className="ss-chip">Generated from your pathway report + resume</span>
        {milestoneCount > 0 && (
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-ss-good-chip text-ss-good">
            {milestonesDone} of {milestoneCount} milestones · {TIMEFRAME_LABELS[active]}
          </span>
        )}
        <button
          type="button"
          onClick={generatePlan}
          disabled={isGenerating}
          className="ml-auto rounded-full border border-border text-sm font-bold px-4 py-2 transition-colors hover:border-ss-lav disabled:opacity-60"
        >
          {isGenerating ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Regenerating…</span>
          ) : (
            'Regenerate'
          )}
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-5" role="tablist" aria-label="Plan timeframe">
        {validKeys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === active}
            data-testid="plan-timeframe-tab"
            onClick={() => setActiveTimeframe(key)}
            className={`text-sm font-bold rounded-full px-4 py-2 border transition-colors ${
              key === active
                ? 'bg-foreground text-background border-foreground'
                : 'bg-card/70 text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            {TIMEFRAME_LABELS[key]}
          </button>
        ))}
      </div>

      {timeframeData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {timeframeData.narrative && (
            <div className="ss-card ss-card-warm p-6 md:col-span-2">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                {TIMEFRAME_LABELS[active]} overview
              </h3>
              <p className="ss-serif text-[1.05rem] leading-relaxed">{timeframeData.narrative}</p>
            </div>
          )}

          <div className="ss-card bg-card p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Skills to acquire</h3>
            {timeframeData.skills.length ? timeframeData.skills.map((skill, idx) => (
              <div key={idx} className="mb-4 last:mb-0">
                <p className="font-bold text-sm mb-1">{skill.name}</p>
                {skill.courses.map((course, cIdx) => {
                  const c = courseParts(course);
                  return (
                    <div key={cIdx} className="flex items-baseline gap-2 py-0.5 text-sm">
                      <span className="flex-none w-1.5 h-1.5 rounded-full bg-ss-lav self-center" aria-hidden />
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {c.title}
                          <ExternalLink className="ml-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
                        </a>
                      ) : (
                        <span>{c.title}</span>
                      )}
                      {c.provider && <span className="text-xs text-muted-foreground whitespace-nowrap">{c.provider}</span>}
                    </div>
                  );
                })}
              </div>
            )) : <p className="text-sm text-muted-foreground">No skills defined for this timeframe.</p>}
          </div>

          <div className="ss-card bg-card p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Projects to build</h3>
            {timeframeData.projects.length ? timeframeData.projects.map((project, idx) => {
              const state = buttonState('project', project, TIMEFRAME_LABELS[active]);
              return (
                <div key={idx} className="flex items-start gap-3 py-2.5 border-b border-ss-track last:border-b-0 last:pb-0 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{project.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{project.description}</p>
                  </div>
                  <AddToPortfolioButton
                    isAdded={state.isAdded}
                    isLoading={state.isLoading}
                    onClick={() => handleAddToPortfolio('project', project, TIMEFRAME_LABELS[active])}
                  />
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">No projects defined for this timeframe.</p>}
          </div>

          <div className="ss-card bg-card p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Content to share</h3>
            {timeframeData.content.length ? timeframeData.content.map((item, idx) => {
              const state = buttonState('content', item, TIMEFRAME_LABELS[active]);
              return (
                <div key={idx} className="flex items-start gap-3 py-2.5 border-b border-ss-track last:border-b-0 last:pb-0 first:pt-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{item.platform}</p>
                    <ul className="m-0 mt-1 p-0 list-none">
                      {item.topics.map((topic, tIdx) => (
                        <li key={tIdx} className="relative pl-4 py-0.5 text-sm leading-relaxed">
                          <span className="absolute left-0 top-2.5 w-1.5 h-1.5 rounded-full bg-ss-peach" aria-hidden />
                          {topic}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <AddToPortfolioButton
                    isAdded={state.isAdded}
                    isLoading={state.isLoading}
                    onClick={() => handleAddToPortfolio('content', item, TIMEFRAME_LABELS[active])}
                  />
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">No content goals defined for this timeframe.</p>}
          </div>

          <div className="ss-card bg-card p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Milestones to achieve</h3>
            {timeframeData.milestones.length ? timeframeData.milestones.map((milestone, idx) => {
              const done = entryApplies(progress[`${active}:${idx}`], milestone);
              const state = buttonState('milestone', milestone, TIMEFRAME_LABELS[active]);
              return (
                <div key={idx} className="flex items-start gap-2.5 py-1.5" data-testid="plan-milestone">
                  <label className="flex items-start gap-2.5 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => toggleMilestone(active, idx, milestone)}
                      className="sr-only peer"
                    />
                    <span
                      aria-hidden
                      className={`flex-none w-5 h-5 mt-0.5 rounded-full border-2 grid place-content-center text-[10px] font-bold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ss-lav ${
                        done ? 'bg-ss-good border-ss-good text-white' : 'border-ss-lav text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className={`text-sm leading-relaxed ${done ? 'text-muted-foreground line-through decoration-muted-foreground/50' : ''}`}>
                      {milestone}
                    </span>
                  </label>
                  <AddToPortfolioButton
                    isAdded={state.isAdded}
                    isLoading={state.isLoading}
                    onClick={() => handleAddToPortfolio('milestone', milestone, TIMEFRAME_LABELS[active])}
                  />
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">No milestones defined for this timeframe.</p>}
          </div>

          <div className="ss-card bg-card p-6 md:col-span-2 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-muted-foreground m-0 flex-1">
              Everything you add lands in your Portfolio tracker as an idea — milestone checks are saved to your profile.
            </p>
            <button
              type="button"
              onClick={() => navigate('/portfolio-explorer')}
              className="rounded-full bg-ss-lav-deep text-white text-sm font-bold px-5 py-2.5 inline-flex items-center gap-2 transition-colors hover:bg-ss-lav-deep/90 self-start sm:self-auto"
            >
              Go to Portfolio Explorer <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ActionPlanSection;
