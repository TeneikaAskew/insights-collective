import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import CourseManagementDashboard from '../CourseManagementDashboard';
import { useCoursesManagement } from '@/hooks/useCoursesManagement';
import { useNavigate } from 'react-router-dom';

// Mock hooks
vi.mock('@/hooks/useCoursesManagement');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock layout component to simplify testing
vi.mock('@/components/layout/AppLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('CourseManagementDashboard', () => {
  const mockNavigate = vi.fn();
  const mockCourses = [
    {
      id: '1',
      title: 'Introduction to React',
      category: 'Frontend',
      level: 'Beginner',
      instructor_name: 'John Doe',
      student_count: 150,
      status: 'published',
      created_at: '2024-01-01',
    },
    {
      id: '2',
      title: 'Advanced TypeScript',
      category: 'Programming',
      level: 'Advanced',
      instructor_name: 'Jane Smith',
      student_count: 75,
      status: 'draft',
      created_at: '2024-01-15',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it('should display loading state', () => {
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: [],
      loading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CourseManagementDashboard />);
    
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('should render course list', () => {
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CourseManagementDashboard />);
    
    expect(screen.getByText('Course Management')).toBeInTheDocument();
    expect(screen.getByText('Introduction to React')).toBeInTheDocument();
    expect(screen.getByText('Advanced TypeScript')).toBeInTheDocument();
  });

  it('should filter courses by search query', () => {
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CourseManagementDashboard />);
    
    const searchInput = screen.getByPlaceholderText('Search courses...');
    fireEvent.change(searchInput, { target: { value: 'typescript' } });
    
    expect(screen.queryByText('Introduction to React')).not.toBeInTheDocument();
    expect(screen.getByText('Advanced TypeScript')).toBeInTheDocument();
  });

  it('should navigate to all courses page', () => {
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CourseManagementDashboard />);
    
    const viewAllButton = screen.getByText('View All Courses');
    fireEvent.click(viewAllButton);
    
    expect(mockNavigate).toHaveBeenCalledWith('/admin/courses');
  });

  it('should show empty state when no courses', () => {
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: [],
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CourseManagementDashboard />);
    
    expect(screen.getByText(/no courses/i)).toBeInTheDocument();
  });

  it('should render the error state and retry via refetch when loading fails', () => {
    const mockRefetch = vi.fn();
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: [],
      loading: false,
      error: 'Failed to fetch courses',
      refetch: mockRefetch,
    } as any);

    render(<CourseManagementDashboard />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Failed to load courses');
    expect(alert).toHaveTextContent('Failed to fetch courses');
    // The normal table UI must not render alongside the error state
    expect(screen.queryByText('Course Management')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('should navigate to manage course', () => {
    vi.mocked(useCoursesManagement).mockReturnValue({
      courses: mockCourses,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(<CourseManagementDashboard />);

    const manageButtons = screen.getAllByRole('button', { name: /manage/i });
    fireEvent.click(manageButtons[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/courses/1/management');
  });
});