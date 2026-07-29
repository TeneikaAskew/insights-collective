import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageVisibilityManager from '../PageVisibilityManager';

const updatePageVisibility = vi.fn();
const syncAvailablePages = vi.fn();

const rows = [
  {
    id: 'r1',
    page_path: '/interview-prep',
    page_name: 'Interview Prep',
    visible_to_users: false,
    visible_to_instructors: false,
  },
  {
    id: 'r2',
    page_path: '/interview-prep/star-practice',
    page_name: 'STAR Practice',
    visible_to_users: true,
    visible_to_instructors: true,
  },
  {
    id: 'r3',
    page_path: '/resume',
    page_name: 'Resume Analyzer',
    visible_to_users: true,
    visible_to_instructors: true,
  },
  {
    id: 'stale-1',
    page_path: '/forum',
    page_name: 'Forum',
    visible_to_users: true,
    visible_to_instructors: true,
  },
];

vi.mock('@/contexts/PageVisibilityContext', () => ({
  usePageVisibility: () => ({
    pageVisibility: rows,
    updatePageVisibility,
    syncAvailablePages,
    isSyncing: false,
    loadError: false,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PageVisibilityManager', () => {
  it('renders every manifest section as a ledger row', () => {
    render(<PageVisibilityManager />);
    expect(screen.getByTestId('visibility-row-/interview-prep')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-row-/courses')).toBeInTheDocument();
    expect(screen.getByTestId('visibility-row-/resume')).toBeInTheDocument();
    // Children are collapsed by default
    expect(
      screen.queryByTestId('visibility-row-/interview-prep/star-practice'),
    ).not.toBeInTheDocument();
  });

  it('expands a section to reveal its children', () => {
    render(<PageVisibilityManager />);
    fireEvent.click(screen.getByTestId('visibility-row-/interview-prep'));
    expect(
      screen.getByTestId('visibility-row-/interview-prep/star-practice'),
    ).toBeInTheDocument();
  });

  it('disables child switches when the parent section is hidden', () => {
    render(<PageVisibilityManager />);
    fireEvent.click(screen.getByTestId('visibility-row-/interview-prep'));
    const childRow = screen.getByTestId('visibility-row-/interview-prep/star-practice');
    const switches = childRow.querySelectorAll('button[role="switch"]');
    expect(switches.length).toBe(2);
    switches.forEach(sw => expect(sw).toBeDisabled());
    expect(childRow.textContent).toContain('parent hidden');
  });

  it('writes a flag change through updatePageVisibility', () => {
    render(<PageVisibilityManager />);
    const row = screen.getByTestId('visibility-row-/resume');
    const [usersSwitch] = row.querySelectorAll('button[role="switch"]');
    fireEvent.click(usersSwitch);
    expect(updatePageVisibility).toHaveBeenCalledWith('r3', { visible_to_users: false });
  });

  it('filters rows by name or path', () => {
    render(<PageVisibilityManager />);
    fireEvent.change(screen.getByPlaceholderText(/filter pages/i), {
      target: { value: 'star' },
    });
    expect(
      screen.getByTestId('visibility-row-/interview-prep/star-practice'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('visibility-row-/resume')).not.toBeInTheDocument();
  });

  it('lists stale rows and offers cleanup via sync', () => {
    render(<PageVisibilityManager />);
    expect(screen.getByText('/forum')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /clean up/i }));
    expect(syncAvailablePages).toHaveBeenCalled();
  });

  it('shows the hidden count chip', () => {
    render(<PageVisibilityManager />);
    expect(screen.getByText('1 hidden')).toBeInTheDocument();
  });
});
