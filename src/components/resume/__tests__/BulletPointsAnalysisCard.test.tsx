import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import BulletPointsAnalysisCard from '@/components/resume/BulletPointsAnalysisCard';
import { fixtureBullets } from '@/test/fixtures/resumeAnalysis';

describe('BulletPointsAnalysisCard', () => {
  it('renders the empty state without bullets', () => {
    render(<BulletPointsAnalysisCard bullets={[]} isAnalyzing={false} />);
    expect(screen.getByText('No bullet points to analyze')).toBeInTheDocument();
  });

  it('computes the five stat tiles from the bullets', () => {
    render(<BulletPointsAnalysisCard bullets={fixtureBullets} isAnalyzing={false} />);

    expect(screen.getByText('Total Bullets')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('XYZ Average')).toBeInTheDocument();
    expect(screen.getByText('76%')).toBeInTheDocument();
    expect(screen.getByText('Balance Rating')).toBeInTheDocument();
    expect(screen.getByText('81%')).toBeInTheDocument();
    expect(screen.getByText('Strong Points')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Need Work')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('shows the selected bullet and its improvement in the detail tabs', () => {
    render(<BulletPointsAnalysisCard bullets={fixtureBullets} isAnalyzing={false} />);

    // Impact tab (default): original bullet with a selector listing every bullet
    expect(screen.getByText('Original Bullet')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();

    // Improve tab: AI improved version + tips
    fireEvent.mouseDown(screen.getByRole('tab', { name: /improve/i }));
    fireEvent.click(screen.getByRole('tab', { name: /improve/i }));
    expect(screen.getByText('AI Improved Version')).toBeInTheDocument();
    expect(screen.getByText(/raising detection reliability from 91% to 99\.2%/)).toBeInTheDocument();
    expect(screen.getByText('Include quantifiable results — %, $, or scale')).toBeInTheDocument();
  });

  it('switches to the all-bullets list view', () => {
    render(<BulletPointsAnalysisCard bullets={fixtureBullets} isAnalyzing={false} />);

    fireEvent.mouseDown(screen.getByRole('tab', { name: /all/i }));
    fireEvent.click(screen.getByRole('tab', { name: /all/i }));
    expect(screen.getByText('All Bullet Points (12)')).toBeInTheDocument();
    expect(screen.getAllByText(/Score: \d+\/100/).length).toBe(12);
  });
});
