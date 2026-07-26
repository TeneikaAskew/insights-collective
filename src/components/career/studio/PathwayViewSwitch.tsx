import React, { useRef } from 'react';

export type PathwayView = 'pathway' | 'plan';

export const PATHWAY_PANEL_ID = 'pathway-panel';
export const PLAN_PANEL_ID = 'plan-panel';

interface PathwayViewSwitchProps {
  value: PathwayView;
  onChange: (view: PathwayView) => void;
  /** Milestone progress, shown on the plan tab so it reads while the plan is hidden. */
  milestones?: { done: number; total: number } | null;
}

const TABS: Array<{ view: PathwayView; label: string; panelId: string }> = [
  { view: 'pathway', label: 'Coach & pathway', panelId: PATHWAY_PANEL_ID },
  { view: 'plan', label: 'Action plan', panelId: PLAN_PANEL_ID },
];

/**
 * Two-way switch between the coach/pathway view and the action plan. It lives in
 * the header's empty right side, which keeps the plan one tap away instead of a
 * full-page scroll past the report.
 */
const PathwayViewSwitch: React.FC<PathwayViewSwitchProps> = ({ value, onChange, milestones }) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Arrow keys move between tabs, as a tablist is expected to.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + TABS.length) % TABS.length;
    onChange(TABS[next].view);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label="Career pathway views"
      data-testid="pathway-view-switch"
      className="inline-flex gap-1 rounded-full bg-ss-track p-1"
    >
      {TABS.map((tab, index) => {
        const selected = tab.view === value;
        return (
          <button
            key={tab.view}
            ref={(el) => { tabRefs.current[index] = el; }}
            type="button"
            role="tab"
            id={`${tab.panelId}-tab`}
            aria-selected={selected}
            aria-controls={tab.panelId}
            tabIndex={selected ? 0 : -1}
            data-testid={`pathway-view-${tab.view}`}
            onClick={() => onChange(tab.view)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ss-lav ${
              selected ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
            {tab.view === 'plan' && milestones && milestones.total > 0 && (
              <span
                data-testid="pathway-view-plan-badge"
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  selected ? 'bg-background/25' : 'bg-foreground/10'
                }`}
              >
                {milestones.done}/{milestones.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PathwayViewSwitch;
