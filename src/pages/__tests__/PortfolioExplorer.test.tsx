// ABOUTME: Pins where Portfolio Explorer lands you, which is the whole point of the rework.
// ABOUTME: Answered once, you get your projects; unanswered, you get the questionnaire.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/utils/test-utils';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import PortfolioExplorer from '@/pages/PortfolioExplorer';

/**
 * The bug this replaces.
 *
 * `activeTab` initialised to `discover`, and an effect moved you to `ideas` as
 * soon as saved recommendations loaded. `tracker` was never disabled — it was
 * reachable the entire time — but nothing ever took you there, so on every
 * visit you got either a questionnaire you had already answered or a list of
 * ideas you had already read. Your actual projects were one click away and
 * never the thing you saw.
 */

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const authState = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  isAuthenticated: true,
}));
// Spread the real module: the shared render wrapper mounts <AuthProvider>, so
// replacing the whole module leaves it undefined and every test dies in the
// provider tree rather than in the thing under test.
vi.mock('@/contexts/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/contexts/AuthContext')>();
  return { ...actual, useAuth: () => authState };
});

const portfolioState = vi.hoisted(() => ({
  previousRecommendations: null as unknown,
  generate: vi.fn(),
}));
vi.mock('@/hooks/usePortfolio', () => ({
  usePortfolio: () => ({
    projects: [],
    projectsLoading: false,
    projectsError: null,
    generatePortfolioIdeas: { isPending: false, mutateAsync: portfolioState.generate },
    addProject: { mutateAsync: vi.fn() },
    updateProjectStatus: { mutateAsync: vi.fn() },
    updateProject: { mutateAsync: vi.fn() },
    deleteProject: { mutateAsync: vi.fn() },
    isLoading: false,
    previousRecommendations: portfolioState.previousRecommendations,
    recommendationsLoading: false,
    refetchRecommendations: vi.fn(),
  }),
}));

const SAVED = { current_role: 'Junior Data Analyst', interests: 'dbt, modeling', hobbies: 'cycling' };

/** Shaped to PortfolioInsightData — SkillGapChart reads the nested skillGaps. */
const RECOMMENDATIONS = {
  strengths: ['SQL'],
  skills: ['SQL', 'Python'],
  targetRoles: [
    { title: 'Analytics Engineer', coreSkills: ['dbt'], commonDeliverables: ['Star schema'], projectIdeas: [] },
  ],
  skillGaps: { missingSkills: ['dbt'], learningResources: [] },
};

/** The questionnaire read resolves through maybeSingle; no row is an ordinary state. */
function mockPortfolioRow(row: typeof SAVED | null) {
  mockSupabaseClient.from.mockImplementation(() => {
    const chain: any = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve({ data: row, error: null })),
      single: vi.fn(() => Promise.resolve({ data: row, error: null })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
    };
    return chain;
  });
}

const tab = (name: RegExp) => screen.getByRole('tab', { name });

describe('PortfolioExplorer landing tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // The deep-link tests below push a query string; without this each one
    // would inherit the previous test's URL and quietly assert the wrong thing.
    window.history.replaceState(null, '', '/portfolio-explorer');
    authState.user = { id: 'user-1' };
    authState.isAuthenticated = true;
    portfolioState.previousRecommendations = null;
    portfolioState.generate.mockReset();
  });

  it('opens on the questionnaire when there are no answers yet', async () => {
    mockPortfolioRow(null);
    render(<PortfolioExplorer />);

    await waitFor(() => expect(tab(/Discover you/i)).toHaveAttribute('aria-selected', 'true'));
    expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'false');
    // Only Project ideas is gated, and only until there are answers to build from.
    expect(tab(/Project ideas/i)).toBeDisabled();
    expect(tab(/Your projects/i)).not.toBeDisabled();
    expect(tab(/Your portfolio page/i)).not.toBeDisabled();
  });

  it('opens on your projects once the questionnaire has been answered', async () => {
    // Saved answers reach the page from localStorage before the row is read;
    // either source completes the profile, so either must land you on tracker.
    localStorage.setItem('portfolio_questionnaire_user-1', JSON.stringify(SAVED));
    mockPortfolioRow(SAVED);

    render(<PortfolioExplorer />);

    await waitFor(() => expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'true'));
    expect(tab(/Discover you/i)).toHaveAttribute('aria-selected', 'false');
  });

  it('opens on your projects even when saved ideas exist', async () => {
    // This is the case that used to bounce to `ideas` and never show projects.
    localStorage.setItem('portfolio_questionnaire_user-1', JSON.stringify(SAVED));
    mockPortfolioRow(SAVED);
    portfolioState.previousRecommendations = RECOMMENDATIONS;

    render(<PortfolioExplorer />);

    await waitFor(() => expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'true'));
    expect(tab(/Project ideas/i)).toHaveAttribute('aria-selected', 'false');
  });

  it('goes straight to the new ideas after a first submit, without flashing the tracker', async () => {
    // Submitting sets profileCompleted, which arms the landing effect, but the
    // navigation to `ideas` is 500ms behind it. With the ordering wrong the
    // reader watched the tracker for half a second on the way to the ideas
    // they had just generated.
    mockPortfolioRow(null);
    portfolioState.generate.mockResolvedValue(RECOMMENDATIONS);
    // Real timers: the delay is 500ms and the waitFor below allows 3s, so
    // faking them buys nothing and needs vi.useFakeTimers() to be set up.
    const user = userEvent.setup();

    render(<PortfolioExplorer />);
    await waitFor(() => expect(tab(/Discover you/i)).toHaveAttribute('aria-selected', 'true'));

    await user.type(screen.getByPlaceholderText(/data visualization/i), 'dbt, modeling');
    await user.type(screen.getByPlaceholderText(/Junior Data Analyst/i), 'Junior Data Analyst');
    await user.type(screen.getByPlaceholderText(/personal coding projects/i), 'cycling');
    await user.click(screen.getByRole('button', { name: /generate|analyz|submit/i }));

    // The whole window between the state flip and the delayed navigation: the
    // tracker must never become the selected tab in it.
    await waitFor(() => expect(portfolioState.generate).toHaveBeenCalled());
    expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'false');

    await waitFor(() => expect(tab(/Project ideas/i)).toHaveAttribute('aria-selected', 'true'), {
      timeout: 3000,
    });
    expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'false');
  });

  it('ignores a ?tab= value that is not a real tab', async () => {
    // `?tab=projects` is the obvious wrong guess — the tab is labeled "Your
    // projects" — and it used to count as a deliberate choice while rendering
    // as `discover`, which pinned an answered reader on the questionnaire.
    window.history.replaceState(null, '', '/portfolio-explorer?tab=projects');
    localStorage.setItem('portfolio_questionnaire_user-1', JSON.stringify(SAVED));
    mockPortfolioRow(SAVED);

    render(<PortfolioExplorer />);

    await waitFor(() => expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'true'));
  });

  it('honors a ?tab= value that is a real tab', async () => {
    // The other half of the same rule: a valid deep link must still win over
    // the landing choice, or the check above would just be ignoring the param.
    window.history.replaceState(null, '', '/portfolio-explorer?tab=pages');
    localStorage.setItem('portfolio_questionnaire_user-1', JSON.stringify(SAVED));
    mockPortfolioRow(SAVED);

    render(<PortfolioExplorer />);

    await waitFor(() =>
      expect(tab(/Your portfolio page/i)).toHaveAttribute('aria-selected', 'true'),
    );
    expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps the saved answers so the questionnaire is an edit, not a retype', async () => {
    localStorage.setItem('portfolio_questionnaire_user-1', JSON.stringify(SAVED));
    mockPortfolioRow(SAVED);

    render(<PortfolioExplorer />);
    await waitFor(() => expect(tab(/Your projects/i)).toHaveAttribute('aria-selected', 'true'));

    // userEvent, not fireEvent.click: a Radix tab activates on pointer-down,
    // so a bare click event leaves the tab exactly where it was and the
    // assertion below would be measuring the wrong panel.
    await userEvent.setup().click(tab(/Discover you/i));
    await waitFor(() => expect(tab(/Discover you/i)).toHaveAttribute('aria-selected', 'true'));

    // ProfileForm resets to initialData, so the stored role has to be on screen.
    await waitFor(() =>
      expect(screen.getByDisplayValue(SAVED.current_role)).toBeInTheDocument(),
    );
  });
});
