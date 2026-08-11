// ABOUTME: Regression tests for the course rail — mobile must render nav labels, and the
// ABOUTME: rail must use the site-standard --sidebar-* palette rather than its own primary tint.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CourseSidebar } from '../CourseSidebar';

const mockIsMobile = vi.fn(() => false);
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile(),
}));

vi.mock('@/hooks/useCourseData', () => ({
  useCourseData: () => ({
    course: {
      id: 'course-1',
      title: 'Visualization with Tableau',
      category: 'Analytics & BI',
      level: 'Beginner',
      instructor: null,
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCoursePermissions', () => ({
  useCoursePermissions: () => ({ isInstructor: false }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ courseId: 'course-1' }) };
});

const renderRail = () =>
  render(
    // `open={false}` is the desktop collapse state. On mobile the rail lives in a
    // Sheet that this flag does not drive, so labels must survive it.
    <SidebarProvider open={false} mobileOpen>
      <CourseSidebar />
    </SidebarProvider>,
  );

describe('CourseSidebar', () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(false);
  });

  it('renders nav labels in the mobile drawer even though the desktop rail is collapsed', async () => {
    mockIsMobile.mockReturnValue(true);
    renderRail();

    // The bug: a full-width drawer of bare icons, every label suppressed by the
    // desktop `open` flag.
    expect(await screen.findByText('Course Home')).toBeInTheDocument();
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Back to Courses')).toBeInTheDocument();
  });

  it('hides labels on a collapsed desktop rail, where icon-only is the intent', async () => {
    mockIsMobile.mockReturnValue(false);
    renderRail();

    expect(await screen.findByRole('link', { name: /course home/i })).toBeInTheDocument();
    expect(screen.queryByText('Back to Courses')).not.toBeInTheDocument();
  });

  it('styles nav items with the shared sidebar palette, not a course-only primary tint', async () => {
    mockIsMobile.mockReturnValue(true);
    renderRail();

    const modules = await screen.findByRole('link', { name: /modules/i });
    const button = modules.closest('[data-sidebar="menu-button"]') ?? modules;
    const className = button.getAttribute('class') ?? '';

    expect(className).toContain('hover:text-sidebar-accent');
    expect(className).not.toContain('bg-primary/10');
    expect(className).not.toContain('border-primary');
  });
});
