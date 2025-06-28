import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import ResumeAnalysisDisplay from '../ResumeAnalysisDisplay';
import { useResumeAnalysis } from '@/hooks/useResumeAnalysis';
import { useToast } from '@/hooks/use-toast';

// Mock hooks
vi.mock('@/hooks/useResumeAnalysis');
vi.mock('@/hooks/use-toast');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

describe('ResumeAnalysisDisplay', () => {
  const mockAnalyzeResume = vi.fn();
  const mockToast = vi.fn();
  
  const mockAnalysisResult = {
    overallScore: 85,
    atsScore: 90,
    sections: {
      experience: {
        score: 88,
        feedback: 'Strong experience section with quantified achievements',
        suggestions: ['Add more leadership examples'],
      },
      skills: {
        score: 82,
        feedback: 'Good technical skills coverage',
        suggestions: ['Include more soft skills'],
      },
      education: {
        score: 95,
        feedback: 'Well-formatted education section',
        suggestions: [],
      },
    },
    bulletPoints: [
      {
        text: 'Led team of 5 engineers to deliver project 2 weeks early',
        score: 92,
        feedback: 'Excellent - includes metrics and leadership',
        improved: 'Led cross-functional team of 5 engineers to deliver critical project 2 weeks ahead of schedule, resulting in $50K cost savings',
      },
      {
        text: 'Worked on various projects',
        score: 45,
        feedback: 'Too vague - needs specifics and metrics',
        improved: 'Developed 3 full-stack web applications using React and Node.js, improving user engagement by 35%',
      },
    ],
    keywords: {
      matched: ['JavaScript', 'React', 'Node.js', 'AWS'],
      missing: ['Python', 'Docker', 'Kubernetes'],
      score: 75,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: null,
      loading: false,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
  });

  it('should render upload prompt when no analysis', () => {
    render(<ResumeAnalysisDisplay />);
    
    expect(screen.getByText(/upload your resume/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze resume/i })).toBeInTheDocument();
  });

  it('should display analysis results', () => {
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: mockAnalysisResult,
      loading: false,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    render(<ResumeAnalysisDisplay />);
    
    // Overall scores
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    
    // Section feedback
    expect(screen.getByText(/strong experience section/i)).toBeInTheDocument();
    expect(screen.getByText(/good technical skills/i)).toBeInTheDocument();
    
    // Bullet points
    expect(screen.getByText(/led team of 5 engineers/i)).toBeInTheDocument();
    expect(screen.getByText(/worked on various projects/i)).toBeInTheDocument();
  });

  it('should handle file upload', async () => {
    const file = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });
    mockAnalyzeResume.mockResolvedValue(mockAnalysisResult);
    
    render(<ResumeAnalysisDisplay />);
    
    const input = screen.getByLabelText(/drop your resume/i);
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(mockAnalyzeResume).toHaveBeenCalledWith(file);
    });
  });

  it('should show loading state during analysis', () => {
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: null,
      loading: true,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    render(<ResumeAnalysisDisplay />);
    
    expect(screen.getByText(/analyzing your resume/i)).toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should display error state', () => {
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: null,
      loading: false,
      error: 'Failed to analyze resume',
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    render(<ResumeAnalysisDisplay />);
    
    expect(screen.getByText(/failed to analyze resume/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should copy improved bullet point', async () => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
    
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: mockAnalysisResult,
      loading: false,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    render(<ResumeAnalysisDisplay />);
    
    const copyButtons = screen.getAllByRole('button', { name: /copy improved/i });
    fireEvent.click(copyButtons[0]);
    
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        mockAnalysisResult.bulletPoints[0].improved
      );
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Copied!',
        description: 'Improved bullet point copied to clipboard',
      });
    });
  });

  it('should filter bullet points by score', () => {
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: mockAnalysisResult,
      loading: false,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    render(<ResumeAnalysisDisplay />);
    
    // Initially shows all bullet points
    expect(screen.getByText(/led team of 5 engineers/i)).toBeInTheDocument();
    expect(screen.getByText(/worked on various projects/i)).toBeInTheDocument();
    
    // Filter to show only low-scoring bullets
    const filterButton = screen.getByRole('button', { name: /needs improvement/i });
    fireEvent.click(filterButton);
    
    expect(screen.queryByText(/led team of 5 engineers/i)).not.toBeInTheDocument();
    expect(screen.getByText(/worked on various projects/i)).toBeInTheDocument();
  });

  it('should export analysis as PDF', async () => {
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: mockAnalysisResult,
      loading: false,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    // Mock window.print
    window.print = vi.fn();
    
    render(<ResumeAnalysisDisplay />);
    
    const exportButton = screen.getByRole('button', { name: /export as pdf/i });
    fireEvent.click(exportButton);
    
    expect(window.print).toHaveBeenCalled();
  });

  it('should validate file type', async () => {
    const invalidFile = new File(['content'], 'resume.txt', { type: 'text/plain' });
    
    render(<ResumeAnalysisDisplay />);
    
    const input = screen.getByLabelText(/drop your resume/i);
    fireEvent.change(input, { target: { files: [invalidFile] } });
    
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid file type',
        description: 'Please upload a PDF or Word document',
        variant: 'destructive',
      });
      expect(mockAnalyzeResume).not.toHaveBeenCalled();
    });
  });

  it('should display keyword analysis', () => {
    vi.mocked(useResumeAnalysis).mockReturnValue({
      analysis: mockAnalysisResult,
      loading: false,
      error: null,
      analyzeResume: mockAnalyzeResume,
    } as any);
    
    render(<ResumeAnalysisDisplay />);
    
    // Matched keywords
    mockAnalysisResult.keywords.matched.forEach(keyword => {
      expect(screen.getByText(keyword)).toBeInTheDocument();
    });
    
    // Missing keywords
    mockAnalysisResult.keywords.missing.forEach(keyword => {
      expect(screen.getByText(keyword)).toBeInTheDocument();
    });
    
    // Keyword score
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});