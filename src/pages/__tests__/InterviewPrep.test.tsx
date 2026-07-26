import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import InterviewPrep from '@/pages/InterviewPrep';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

// The hub reads auth via use-user; default logged out, overridden per test.
const userState = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: userState.user }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const GUIDE = {
  id: 'guide-1',
  created_at: '2026-07-01T00:00:00Z',
  competencies: { technical: ['SQL'], behavioral: ['Communication'] },
  questions: [
    { id: 'q-tech', type: 'technical', question: 'Write a SQL window function.', targetCompetency: 'SQL' },
    { id: 'q-beh', type: 'behavioral', question: 'Tell me about a time you led a project.', targetCompetency: 'Leadership' },
  ],
};

beforeEach(() => {
  navigate.mockClear();
  userState.user = null;
  vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(null);
});

describe('InterviewPrep hub (Concept D)', () => {
  it('renders the four-step navigation with logged-out states', async () => {
    render(<InterviewPrep />);

    expect(await screen.findByText('Interview Preparation')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /analyze the job/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /practice star stories/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /drill code challenges/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /book a mock interview/i })).toBeInTheDocument();

    // Without a study guide: step 1 is the entry point, STAR is gated
    expect(screen.getByText('Start here')).toBeInTheDocument();
    expect(screen.getByText('Unlocks after analysis')).toBeInTheDocument();
  });

  it('opens the job-description overview by default when no study guide exists', async () => {
    render(<InterviewPrep />);
    expect(await screen.findByText('Job Description Analysis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze new job description/i })).toBeInTheDocument();
    expect(screen.getByText('Most popular feature')).toBeInTheDocument();
  });

  it('switches the overview when a step is selected', async () => {
    render(<InterviewPrep />);
    await screen.findByText('Job Description Analysis');

    fireEvent.click(screen.getByRole('tab', { name: /drill code challenges/i }));
    expect(screen.getByText('Code Challenge Practice')).toBeInTheDocument();
    expect(screen.getByText(/94% of technical roles/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /book a mock interview/i }));
    expect(screen.getByText('Mock Interviews')).toBeInTheDocument();
    expect(screen.getByText('Community favorite')).toBeInTheDocument();
  });

  it('gates STAR practice behind job analysis when logged out', async () => {
    render(<InterviewPrep />);
    await screen.findByText('Job Description Analysis');

    fireEvent.click(screen.getByRole('tab', { name: /practice star stories/i }));
    const cta = screen.getByRole('button', { name: /analyze job description first/i });
    expect(cta).toBeDisabled();
    expect(screen.getByText(/you need to analyze a job description first/i)).toBeInTheDocument();
  });

  it('opens on STAR with Complete/Up next states and a continue card when a study guide exists', async () => {
    userState.user = { id: 'user-1' };
    vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(GUIDE as any);

    render(<InterviewPrep />);

    // Study guide present: step 1 complete, STAR up next and opened by default
    expect(await screen.findByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Up next')).toBeInTheDocument();
    expect(screen.getByText('STAR Response Practice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start star practice/i })).toBeEnabled();

    // Continue card shows the first behavioral question from the real guide
    expect(screen.getByText('Continue where you left off')).toBeInTheDocument();
    expect(screen.getByText(/tell me about a time you led a project/i)).toBeInTheDocument();
    expect(screen.getByText(/target competency: leadership/i)).toBeInTheDocument();
  });

  it('resume-practice deep-links to the specific question', async () => {
    userState.user = { id: 'user-1' };
    vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(GUIDE as any);

    render(<InterviewPrep />);
    fireEvent.click(await screen.findByRole('button', { name: /resume practice/i }));
    expect(navigate).toHaveBeenCalledWith('/interview-prep/star-practice?questionId=q-beh');
  });

  it('navigates to the tool page from the overview CTA', async () => {
    render(<InterviewPrep />);
    fireEvent.click(await screen.findByRole('button', { name: /analyze new job description/i }));
    expect(navigate).toHaveBeenCalledWith('/interview-prep/job-description');
  });
});
