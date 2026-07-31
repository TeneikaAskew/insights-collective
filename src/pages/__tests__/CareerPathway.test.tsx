import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import CareerPathway from '@/pages/CareerPathway';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const authState = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'nikki@example.com' } as { id: string; email: string } | null,
  isAuthenticated: true,
}));
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/AuthContext')>();
  return { ...actual, useAuth: () => authState };
});

const resultsState = vi.hoisted(() => ({
  data: null as unknown,
  isLoading: false,
  isError: false,
}));
vi.mock('@/hooks/useCareerPathwayResults', () => ({
  useCareerPathwayResults: () => resultsState,
}));

vi.mock('@/hooks/resume/useResume', () => ({
  useResume: () => ({ uploading: false, uploadResume: vi.fn() }),
}));

// The real coach runs timers and a typewriter; the panel wiring under test
// doesn't depend on any of that.
vi.mock('@/components/career/studio/useCoachChat', () => ({
  useCoachChat: () => ({
    messages: [],
    composing: false,
    say: vi.fn().mockResolvedValue(undefined),
    addUser: vi.fn(),
    addBotInstant: vi.fn(),
    restore: vi.fn(),
    readPause: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn(),
    cancel: vi.fn(),
    genRef: { current: 0 },
  }),
}));

// Stubbed so the page test stays about the panels — the real section pulls in
// portfolio and progress queries of its own.
const milestoneReport = vi.hoisted(() => ({ done: 1, total: 3 }));
vi.mock('@/components/career/studio/ActionPlanSection', () => {
  const ActionPlanSectionStub: React.FC<{
    onMilestoneProgress?: (p: { done: number; total: number }) => void;
  }> = ({ onMilestoneProgress }) => {
    React.useEffect(() => { onMilestoneProgress?.(milestoneReport); }, [onMilestoneProgress]);
    return <section data-testid="action-plan-section">Action plan</section>;
  };
  return { __esModule: true, default: ActionPlanSectionStub };
});

const REPORT = {
  summary: 'A seasoned executive moving into data science leadership.',
  // Reports carry a slug, not a title — the title and pay are resolved from
  // career_role_wages at render time so neither can be model-invented.
  recommendedRoles: [{ roleSlug: 'data-scientist', description: 'Lead data science teams.', matchPercentage: 92 }],
  keyTakeaways: ['Develop technical skills in machine learning, data visualization, and SQL'],
  potentialRoles: [],
  skillsAndCourses: [],
  careerPathSteps: [],
};

/** No active answers + a saved report is the returning-user path into 'ready'. */
function mockNoActiveAnswers() {
  mockSupabaseClient.from.mockImplementation(() => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      update: vi.fn(() => chain),
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    return chain;
  });
}

beforeEach(() => {
  navigate.mockClear();
  authState.user = { id: 'user-1', email: 'nikki@example.com' };
  authState.isAuthenticated = true;
  resultsState.data = { report: REPORT, actionPlan: null };
  resultsState.isLoading = false;
  resultsState.isError = false;
  mockNoActiveAnswers();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

describe('CareerPathway view switch', () => {
  it('shows the switch once the pathway is ready', async () => {
    render(<CareerPathway />);
    expect(await screen.findByTestId('pathway-view-switch')).toBeInTheDocument();
  });

  it('keeps the header copy alongside the switch', async () => {
    render(<CareerPathway />);
    await screen.findByTestId('pathway-view-switch');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/here's your career insights/i);
    expect(screen.getByText(/Based on your assessment/i)).toBeInTheDocument();
  });

  it('opens on the pathway view with the plan hidden', async () => {
    render(<CareerPathway />);
    await screen.findByTestId('pathway-view-switch');

    expect(screen.getByTestId('report-canvas')).toBeVisible();
    expect(screen.getByTestId('action-plan-section')).not.toBeVisible();
  });

  it('swaps the panels when the plan tab is chosen', async () => {
    render(<CareerPathway />);
    fireEvent.click(await screen.findByTestId('pathway-view-plan'));

    await waitFor(() => expect(screen.getByTestId('action-plan-section')).toBeVisible());
    expect(screen.getByTestId('report-canvas')).not.toBeVisible();
  });

  it('sends "Get action plan" to the plan view instead of scrolling past the report', async () => {
    render(<CareerPathway />);
    fireEvent.click(await screen.findByTestId('get-action-plan'));

    await waitFor(() => expect(screen.getByTestId('action-plan-section')).toBeVisible());
    expect(screen.getByTestId('pathway-view-plan')).toHaveAttribute('aria-selected', 'true');
  });

  it('leaves the plan mounted while the pathway view is showing, so switching keeps its state', async () => {
    render(<CareerPathway />);
    await screen.findByTestId('pathway-view-switch');

    // Present in the DOM (hidden), not unmounted — remounting would refetch the
    // plan and its progress on every switch.
    expect(screen.getByTestId('action-plan-section')).toBeInTheDocument();
  });

  it('surfaces milestone progress on the plan tab while the plan is hidden', async () => {
    render(<CareerPathway />);
    await screen.findByTestId('pathway-view-switch');

    await waitFor(() => expect(screen.getByTestId('pathway-view-plan-badge')).toHaveTextContent('1/3'));
    expect(screen.getByTestId('action-plan-section')).not.toBeVisible();
  });

  it('hides the switch when there is no report to switch away from', async () => {
    resultsState.data = { report: null, actionPlan: null };
    render(<CareerPathway />);

    await waitFor(() => expect(screen.getByTestId('career-pathway-page')).toBeInTheDocument());
    expect(screen.queryByTestId('pathway-view-switch')).not.toBeInTheDocument();
    // The canvas still renders its ghost slots during the conversation.
    expect(screen.getByTestId('report-canvas')).toBeVisible();
  });

  it('renders the sign-in wall when logged out', () => {
    authState.user = null;
    authState.isAuthenticated = false;
    render(<CareerPathway />);

    expect(screen.getByTestId('career-pathway-signin')).toBeInTheDocument();
    expect(screen.queryByTestId('pathway-view-switch')).not.toBeInTheDocument();
  });
});
