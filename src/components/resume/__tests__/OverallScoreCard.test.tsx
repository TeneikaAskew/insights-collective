import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import OverallScoreCard from '@/components/resume/OverallScoreCard';
import { fixtureResumeAnalysis } from '@/test/fixtures/resumeAnalysis';

vi.mock('@/hooks/useResumeAnalysis', () => ({
  useResumeAnalysis: () => ({ careerAlignments: [] }),
}));

const baseProps = {
  letterGrade: fixtureResumeAnalysis.letter_grade!,
  resumePercent: fixtureResumeAnalysis.resume_percent!,
  elevatorPitch: fixtureResumeAnalysis.elevator_pitch!,
  themes: fixtureResumeAnalysis.themes!,
  explanation: fixtureResumeAnalysis.explanation!,
  onStartCareerChat: vi.fn(),
  hasAnalysis: true,
};

describe('OverallScoreCard', () => {
  it('shows the letter grade and exact percentage', () => {
    render(<OverallScoreCard {...baseProps} />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('82.82%')).toBeInTheDocument();
  });

  it('renders the elevator pitch, themes, and expert analysis', () => {
    render(<OverallScoreCard {...baseProps} />);
    expect(screen.getByText(fixtureResumeAnalysis.elevator_pitch!)).toBeInTheDocument();
    for (const theme of fixtureResumeAnalysis.themes!) {
      expect(screen.getByText(theme)).toBeInTheDocument();
    }
    expect(screen.getByText(fixtureResumeAnalysis.explanation!)).toBeInTheDocument();
  });

  it('applies the soft semantic grade color for a B grade', () => {
    render(<OverallScoreCard {...baseProps} />);
    expect(screen.getByText('B').className).toContain('text-ss-good');
  });

  it('fires the career-chat callback and flips the CTA label on click', () => {
    const onStartCareerChat = vi.fn();
    render(<OverallScoreCard {...baseProps} onStartCareerChat={onStartCareerChat} />);

    const cta = screen.getByRole('button', { name: /start career chat/i });
    fireEvent.click(cta);

    expect(onStartCareerChat).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /continue career chat/i })).toBeInTheDocument();
  });

  it('renders a stable (non-flashing) CTA with no timers', () => {
    vi.useFakeTimers();
    try {
      render(<OverallScoreCard {...baseProps} />);
      const cta = screen.getByRole('button', { name: /start career chat/i });
      const before = cta.className;
      vi.advanceTimersByTime(3000);
      expect(cta.className).toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows fallback copy when no pitch is available', () => {
    render(<OverallScoreCard {...baseProps} elevatorPitch="" />);
    expect(screen.getByText('No elevator pitch available.')).toBeInTheDocument();
  });
});
