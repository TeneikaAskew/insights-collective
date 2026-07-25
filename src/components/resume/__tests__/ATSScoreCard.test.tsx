import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import ATSScoreCard from '@/components/resume/ATSScoreCard';
import { fixtureResumeAnalysis } from '@/test/fixtures/resumeAnalysis';

vi.mock('@/hooks/resume/useResumeData', () => ({
  useResumeData: () => ({ resume: null }),
}));
vi.mock('@/components/resume/JobDescriptionAnalyzer', () => ({
  default: () => <div data-testid="job-analyzer" />,
}));

describe('ATSScoreCard', () => {
  it('renders nothing without an analysis', () => {
    const { container } = render(<ATSScoreCard analysis={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('derives the ATS score from resume_percent (+10, capped at 100)', () => {
    render(<ATSScoreCard analysis={fixtureResumeAnalysis} />);
    // 82.82 + 10 = 92.82
    expect(screen.getByText('92.82%')).toBeInTheDocument();
  });

  it('derives keyword match, format detection, and readability sub-scores', () => {
    render(<ATSScoreCard analysis={fixtureResumeAnalysis} />);
    expect(screen.getByText('Keyword Match')).toBeInTheDocument();
    expect(screen.getByText('84%')).toBeInTheDocument(); // round(92.82 * 0.9)
    expect(screen.getByText('Format Detection')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument(); // grade B
    expect(screen.getByText('Readability')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument(); // round(92.82 * 0.95)
  });

  it('renders all six ATS checks with an 83% pass rate', () => {
    render(<ATSScoreCard analysis={fixtureResumeAnalysis} />);
    expect(screen.getByText(/ATS Checks \(83% Pass Rate\)/)).toBeInTheDocument();
    expect(screen.getByText('Contains relevant industry keywords')).toBeInTheDocument();
    expect(screen.getByText('Well-structured format for ATS parsing')).toBeInTheDocument();
    expect(screen.getByText('Clean, readable content without complex formatting')).toBeInTheDocument();
    expect(screen.getByText('Contact information is easily extractable')).toBeInTheDocument();
    expect(screen.getByText('Education section properly formatted')).toBeInTheDocument();
    // keywordMatch (84) is not > 85, so this check fails at fixture values
    expect(screen.getByText('Skills section matches job requirements')).toBeInTheDocument();
  });

  it('shows impact badges for the checks', () => {
    render(<ATSScoreCard analysis={fixtureResumeAnalysis} />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getAllByText('High').length).toBe(3);
    expect(screen.getAllByText('Medium').length).toBe(2);
  });

  it('offers General and Job-Specific tabs', () => {
    render(<ATSScoreCard analysis={fixtureResumeAnalysis} />);
    expect(screen.getByRole('tab', { name: /general ats score/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /job-specific analysis/i })).toBeInTheDocument();
  });
});
