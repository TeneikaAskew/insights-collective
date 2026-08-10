// ABOUTME: Regression tests for builder honesty — placeholder nav items must carry a
// ABOUTME: "Coming soon" badge, placeholder panels must lead with "not available yet",
// ABOUTME: the wizard has no dead pricing step, and certificates state their limits.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@/test/utils/test-utils';
import { TeachableShell } from '../TeachableShell';
import { PlaceholderView } from '../PlaceholderView';
import { NewCourseWizard } from '../NewCourseWizard';
import { CourseCertificatesView } from '../CourseCertificatesView';

// Hint needs a TooltipProvider ancestor; bypass it entirely in tests.
vi.mock('@/components/ui/hint', () => ({
  Hint: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('TeachableShell placeholder nav items', () => {
  it('marks Pricing, Sales pages, Students, and Reports as "Coming soon"', () => {
    render(
      <TeachableShell
        courseTitle="Intro to Data Analytics"
        published={false}
        activeKey="setup"
        onNavigate={vi.fn()}
        onTogglePublish={vi.fn()}
      >
        <div />
      </TeachableShell>,
    );

    for (const label of ['Pricing', 'Sales pages', 'Students', 'Reports']) {
      const navButton = screen
        .getAllByRole('button')
        .find((b) => within(b).queryByText(label));
      expect(navButton, `nav item "${label}" should exist`).toBeTruthy();
      expect(within(navButton!).getByText(/coming soon/i)).toBeInTheDocument();
    }
  });

  it('does NOT mark implemented sections as coming soon', () => {
    render(
      <TeachableShell
        courseTitle="Intro to Data Analytics"
        published={false}
        activeKey="setup"
        onNavigate={vi.fn()}
        onTogglePublish={vi.fn()}
      >
        <div />
      </TeachableShell>,
    );

    for (const label of ['Setup guide', 'Curriculum', 'Design templates', 'Certificates', 'Information']) {
      const navButton = screen
        .getAllByRole('button')
        .find((b) => within(b).queryByText(label));
      expect(navButton, `nav item "${label}" should exist`).toBeTruthy();
      expect(within(navButton!).queryByText(/coming soon/i)).not.toBeInTheDocument();
    }
  });
});

describe('TeachableShell nav palette', () => {
  // The builder rail used to paint every item in `text-primary` on white and the
  // active item in a solid `bg-primary` slab — its own scheme, unrelated to the
  // site nav a user had just come from.
  const renderShell = () =>
    render(
      <TeachableShell
        courseTitle="Intro to Data Analytics"
        published={false}
        activeKey="setup"
        onNavigate={vi.fn()}
        onTogglePublish={vi.fn()}
      >
        <div />
      </TeachableShell>,
    );

  const navButtonFor = (label: string) =>
    screen.getAllByRole('button').find((b) => within(b).queryByText(label))!;

  it('uses the shared --sidebar-* tokens for resting items', () => {
    renderShell();
    const className = navButtonFor('Curriculum').getAttribute('class') ?? '';

    expect(className).toContain('text-sidebar-foreground/80');
    expect(className).toContain('hover:bg-sidebar-accent/10');
    expect(className).not.toContain('text-primary');
  });

  it('uses the shared accent pill for the active item', () => {
    renderShell();
    const className = navButtonFor('Setup guide').getAttribute('class') ?? '';

    expect(className).toContain('bg-sidebar-accent');
    expect(className).toContain('text-sidebar-accent-foreground');
    expect(className).not.toContain('bg-primary ');
  });

  it('labels the collapse control instead of leaving a bare icon', () => {
    renderShell();
    expect(screen.getByText('Collapse menu')).toBeInTheDocument();
  });
});

describe('PlaceholderView', () => {
  it('leads with an explicit "not available yet" heading above the descriptive copy', () => {
    render(
      <PlaceholderView
        courseTitle="Intro to Data Analytics"
        title="Pricing"
        description="Once this ships, you will be able to set a one-time price."
      />,
    );

    expect(screen.getByText('This feature is not available yet')).toBeInTheDocument();
    expect(screen.getByText(/coming soon in this workspace/i)).toBeInTheDocument();
    expect(
      screen.getByText('Once this ships, you will be able to set a one-time price.'),
    ).toBeInTheDocument();
  });
});

describe('NewCourseWizard', () => {
  it('has no pricing step — About, Thumbnail, Outline, Confirm only', () => {
    render(<NewCourseWizard open onCancel={vi.fn()} onFinish={vi.fn()} />);

    // 4 steps total, no "Set a price" screen anywhere in the flow.
    expect(screen.getByText('1/4')).toBeInTheDocument();
    expect(screen.getByText('Tell us about your course')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Give it a name'), {
      target: { value: 'My Course' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Add a thumbnail image')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    // Straight from thumbnail to outline — never a pricing screen.
    expect(screen.getByText('Outline your course')).toBeInTheDocument();
    expect(screen.queryByText('Set a price')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Start from scratch'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Review and create')).toBeInTheDocument();
    // The confirm summary must not advertise a pricing choice that feeds nothing.
    expect(screen.queryByText('Pricing')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create course' })).toBeInTheDocument();
  });
});

describe('CourseCertificatesView', () => {
  it('shows a persistent notice that custom certificate text is not applied yet', () => {
    render(
      <CourseCertificatesView
        course={{ id: 'course-1', title: 'Intro to Data Analytics', settings: null } as any}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByText('Custom certificate text is not applied yet'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/certificates are issued automatically/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/not yet applied to issued certificates/i),
    ).toBeInTheDocument();
  });
});
