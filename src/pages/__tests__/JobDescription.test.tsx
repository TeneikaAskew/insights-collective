import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import JobDescription from '@/pages/interview-prep/JobDescription';
import { LocalStorageUtils } from '@/utils/localStorageUtils';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

const userState = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock('@/hooks/use-user', () => ({
  useUser: () => ({ user: userState.user }),
}));

vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const GUIDE = {
  id: 'guide-1',
  competencies: {
    technical: ['PyTorch', 'SQL'],
    behavioral: ['Stakeholder Communication'],
  },
  questions: [
    { id: 'q-beh', type: 'behavioral', question: 'Tell me about a hard stakeholder conversation.', targetCompetency: 'Stakeholder Communication' },
    { id: 'q-tech', type: 'technical', question: 'Design a model rollout strategy.', targetCompetency: 'Model Deployment' },
  ],
  technical_checklist: [
    { skill: 'PyTorch profiling', importance: 'high' },
    { skill: 'SQL window functions', importance: 'medium' },
    { skill: 'Docker basics', importance: 'low' },
  ],
};

beforeEach(() => {
  navigate.mockClear();
  userState.user = null;
  vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(null);
});

describe('JobDescription page (Split Desk)', () => {
  it('renders the input rail and empty state when logged out — no infinite spinner', async () => {
    render(<JobDescription />);

    expect(await screen.findByText('Job Description Analysis')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://example.com/jobs/123')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Or paste the job description here...')).toBeInTheDocument();
    expect(screen.getByText('Your study guide will appear here')).toBeInTheDocument();
  });

  it('disables Extract without a URL and Analyze without a description', async () => {
    render(<JobDescription />);
    await screen.findByText('Job Description Analysis');

    expect(screen.getByRole('button', { name: /extract/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /analyze description/i })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('https://example.com/jobs/123'), {
      target: { value: 'https://example.com/jobs/1' },
    });
    expect(screen.getByRole('button', { name: /extract/i })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText('Or paste the job description here...'), {
      target: { value: 'Senior ML Engineer role at Nimbus AI' },
    });
    expect(screen.getByRole('button', { name: /analyze description/i })).toBeEnabled();
  });

  it('renders the full study guide from cache for a signed-in user', async () => {
    userState.user = { id: 'user-1' };
    vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(GUIDE as any);

    render(<JobDescription />);

    expect(await screen.findByText('Required Competencies')).toBeInTheDocument();
    expect(screen.getByText('PyTorch')).toBeInTheDocument();
    // Appears both as a competency badge and as a question's target competency
    expect(screen.getAllByText('Stakeholder Communication').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Practice Questions')).toBeInTheDocument();
    expect(screen.getByText('Tell me about a hard stakeholder conversation.')).toBeInTheDocument();
    expect(screen.getByText('Technical Skills Checklist')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
    // Empty state should NOT render alongside the guide
    expect(screen.queryByText('Your study guide will appear here')).not.toBeInTheDocument();
  });

  it('practice buttons deep-link to STAR and code practice with the question id', async () => {
    userState.user = { id: 'user-1' };
    vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(GUIDE as any);

    render(<JobDescription />);
    await screen.findByText('Practice Questions');

    const links = screen.getAllByRole('link', { name: /practice/i });
    expect(links[0]).toHaveAttribute('href', '/interview-prep/star-practice?questionId=q-beh');
    expect(links[1]).toHaveAttribute('href', '/interview-prep/code-practice?questionId=q-tech');
  });

  it('checking skills updates the prepared counter and next-skill hint', async () => {
    userState.user = { id: 'user-1' };
    vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(GUIDE as any);

    render(<JobDescription />);
    await screen.findByText('Technical Skills Checklist');

    expect(screen.getByText(/of 3 skills prepared/)).toBeInTheDocument();
    // Highest-priority unprepared skill is suggested first
    expect(screen.getByText('PyTorch profiling', { selector: 'b' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('PyTorch profiling'));
    // Both progress counters (rail + checklist footer) bold the checked count;
    // the next suggestion moves to the medium-priority skill
    expect(screen.getAllByText('1', { selector: 'b' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SQL window functions', { selector: 'b' })).toBeInTheDocument();
  });

  it('reset clears the study guide back to the empty state', async () => {
    userState.user = { id: 'user-1' };
    vi.spyOn(LocalStorageUtils, 'getStudyGuide').mockReturnValue(GUIDE as any);

    render(<JobDescription />);
    fireEvent.click(await screen.findByRole('button', { name: /reset/i }));

    expect(screen.getByText('Your study guide will appear here')).toBeInTheDocument();
    expect(screen.queryByText('Required Competencies')).not.toBeInTheDocument();
  });
});
