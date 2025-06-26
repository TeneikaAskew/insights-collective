import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import PortfolioEditor from '../PortfolioEditor';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useToast } from '@/hooks/use-toast';

// Mock hooks
vi.mock('@/hooks/usePortfolio');
vi.mock('@/hooks/use-toast');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user123', email: 'test@example.com' },
    isAuthenticated: true,
  }),
}));

describe('PortfolioEditor', () => {
  const mockUpdatePortfolio = vi.fn();
  const mockAddProject = vi.fn();
  const mockToast = vi.fn();
  
  const mockPortfolio = {
    id: '1',
    user_id: 'user123',
    full_name: 'John Doe',
    title: 'Full Stack Developer',
    bio: 'Experienced developer',
    location: 'New York, NY',
    linkedin_url: 'https://linkedin.com/in/johndoe',
    github_url: 'https://github.com/johndoe',
    website_url: 'https://johndoe.com',
    skills: ['React', 'TypeScript', 'Node.js'],
    projects: [
      {
        id: 'p1',
        name: 'Project One',
        description: 'A cool project',
        technologies: ['React', 'Node.js'],
        github_url: 'https://github.com/johndoe/project-one',
        live_url: 'https://project-one.com',
        image_url: null,
      },
    ],
    education: [
      {
        id: 'e1',
        school: 'University of Example',
        degree: 'BS Computer Science',
        field: 'Computer Science',
        start_date: '2018-09-01',
        end_date: '2022-05-01',
      },
    ],
    experience: [
      {
        id: 'exp1',
        company: 'Tech Corp',
        position: 'Software Engineer',
        description: 'Developed web applications',
        start_date: '2022-06-01',
        end_date: null,
        current: true,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast } as any);
    vi.mocked(usePortfolio).mockReturnValue({
      portfolio: mockPortfolio,
      loading: false,
      error: null,
      updatePortfolio: mockUpdatePortfolio,
      addProject: mockAddProject,
      updateProject: vi.fn(),
      deleteProject: vi.fn(),
      addEducation: vi.fn(),
      updateEducation: vi.fn(),
      deleteEducation: vi.fn(),
      addExperience: vi.fn(),
      updateExperience: vi.fn(),
      deleteExperience: vi.fn(),
    } as any);
  });

  it('should render portfolio editor with user data', () => {
    render(<PortfolioEditor />);
    
    expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Full Stack Developer')).toBeInTheDocument();
    expect(screen.getByText('Experienced developer')).toBeInTheDocument();
  });

  it('should update profile information', async () => {
    mockUpdatePortfolio.mockResolvedValue({ success: true });
    
    render(<PortfolioEditor />);
    
    const nameInput = screen.getByLabelText(/full name/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
    
    const saveButton = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(mockUpdatePortfolio).toHaveBeenCalledWith(
        expect.objectContaining({ full_name: 'Jane Doe' })
      );
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Success',
        description: 'Profile updated successfully',
      });
    });
  });

  it('should display projects', () => {
    render(<PortfolioEditor />);
    
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('A cool project')).toBeInTheDocument();
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
  });

  it('should open add project dialog', () => {
    render(<PortfolioEditor />);
    
    const addProjectButton = screen.getByRole('button', { name: /add project/i });
    fireEvent.click(addProjectButton);
    
    expect(screen.getByText(/add new project/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
  });

  it('should display education entries', () => {
    render(<PortfolioEditor />);
    
    expect(screen.getByText('University of Example')).toBeInTheDocument();
    expect(screen.getByText('BS Computer Science')).toBeInTheDocument();
  });

  it('should display experience entries', () => {
    render(<PortfolioEditor />);
    
    expect(screen.getByText('Tech Corp')).toBeInTheDocument();
    expect(screen.getByText('Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Developed web applications')).toBeInTheDocument();
  });

  it('should handle loading state', () => {
    vi.mocked(usePortfolio).mockReturnValue({
      ...vi.mocked(usePortfolio).mock.results[0].value,
      loading: true,
    } as any);
    
    render(<PortfolioEditor />);
    
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should handle error state', () => {
    vi.mocked(usePortfolio).mockReturnValue({
      ...vi.mocked(usePortfolio).mock.results[0].value,
      error: 'Failed to load portfolio',
    } as any);
    
    render(<PortfolioEditor />);
    
    expect(screen.getByText(/failed to load portfolio/i)).toBeInTheDocument();
  });

  it('should toggle skill selection', () => {
    render(<PortfolioEditor />);
    
    const pythonSkill = screen.getByLabelText('Python');
    expect(pythonSkill).not.toBeChecked();
    
    fireEvent.click(pythonSkill);
    expect(pythonSkill).toBeChecked();
  });

  it('should validate URLs', async () => {
    render(<PortfolioEditor />);
    
    const websiteInput = screen.getByLabelText(/website/i);
    fireEvent.change(websiteInput, { target: { value: 'not-a-url' } });
    
    const saveButton = screen.getByRole('button', { name: /save profile/i });
    fireEvent.click(saveButton);
    
    await waitFor(() => {
      expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
    });
  });
});