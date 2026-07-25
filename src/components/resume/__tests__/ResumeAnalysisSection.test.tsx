import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/utils/test-utils';
import ResumeAnalysisSection from '@/components/resume/ResumeAnalysisSection';
import { fixtureResumeAnalysis, fixtureResume } from '@/test/fixtures/resumeAnalysis';

// Child panels have their own supabase traffic; the section tests only care
// about which panel is mounted for which tab.
vi.mock('@/components/resume/ResumeAnalysisDisplay', () => ({
  default: () => <div data-testid="panel-overview" />,
}));
vi.mock('@/components/resume/BulletPointsAnalysisCard', () => ({
  default: () => <div data-testid="panel-storytelling" />,
}));
vi.mock('@/components/resume/ATSScoreCard', () => ({
  default: () => <div data-testid="panel-ats" />,
}));
vi.mock('@/components/resume/ResumeChat', () => ({
  default: () => <div data-testid="panel-chat" />,
}));

const baseProps = {
  loading: false,
  isAnalyzing: false,
  analysis: fixtureResumeAnalysis,
  resume: fixtureResume as any,
  handleStartCareerChat: vi.fn(),
  handleFileChange: vi.fn(),
  hasAnalysis: true,
  showCareerChat: false,
  resumeFile: null,
  pdfPreviewUrl: null,
  uploading: false,
  handleUpload: vi.fn(),
  handleDelete: vi.fn(),
  handleDownload: vi.fn(),
  fileError: null,
};

describe('ResumeAnalysisSection', () => {
  it('renders the header, badge, and all four tabs', () => {
    render(<ResumeAnalysisSection {...baseProps} handleRefreshData={vi.fn()} />);

    expect(screen.getByText('Resume Analysis')).toBeInTheDocument();
    expect(screen.getByText('Industry-Leading Analysis')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /storytelling/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ats score/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /chat/i })).toBeInTheDocument();
    expect(screen.getByText('Refresh Data')).toBeInTheDocument();
  });

  it('shows the overview panel by default and switches panels on tab click', () => {
    render(<ResumeAnalysisSection {...baseProps} />);

    expect(screen.getByTestId('panel-overview')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-ats')).not.toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /ats score/i }));
    fireEvent.click(screen.getByRole('tab', { name: /ats score/i }));
    expect(screen.getByTestId('panel-ats')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: /storytelling/i }));
    fireEvent.click(screen.getByRole('tab', { name: /storytelling/i }));
    expect(screen.getByTestId('panel-storytelling')).toBeInTheDocument();
  });

  it('disables the refresh button while analyzing', () => {
    render(
      <ResumeAnalysisSection
        {...baseProps}
        isAnalyzing
        handleRefreshData={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
  });

  it('renders the upload UI without tabs when there is no analysis', () => {
    render(
      <ResumeAnalysisSection
        {...baseProps}
        analysis={null}
        hasAnalysis={false}
      />
    );
    expect(screen.queryByRole('tab', { name: /overview/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('panel-overview')).toBeInTheDocument();
  });

  it('disables the storytelling tab when the analysis has no bullets', () => {
    render(
      <ResumeAnalysisSection
        {...baseProps}
        analysis={{ ...fixtureResumeAnalysis, bullets: [] }}
      />
    );
    expect(screen.getByRole('tab', { name: /storytelling/i })).toBeDisabled();
  });
});
