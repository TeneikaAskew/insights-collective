// ABOUTME: Tests the Similar Roles block at the foot of the career role dialog:
// ABOUTME: four neighbours excluding the open role, the shared-skill chips that
// ABOUTME: explain the match, and the click that swaps the dialog to that role.
// ABOUTME: Also pins that the block renders under every tab, not just Overview.

import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/test/utils/test-utils';
import { SimilarRolesSection } from '../SimilarRolesSection';
import { CareerRoleDetails } from '../../CareerRoleDetails';
import { dataCareerRoles, type DataCareerRole } from '@/data/dataCareerRoles';

// The Career Path tab reads both catalogs; neither is what this file is about,
// so they return empty and the tab renders its no-courses state.
vi.mock('@/hooks/usePublishedCourses', () => ({
  usePublishedCourses: () => ({ courses: [], loading: false }),
}));
vi.mock('@/hooks/useCourseraCatalog', () => ({
  useCourseraCatalog: () => ({ catalog: [], loading: false, error: null, isEmpty: true, retry: vi.fn() }),
}));

const biAnalyst = dataCareerRoles.find(role => role.id === 'bi-analyst')!;

describe('SimilarRolesSection', () => {
  it('lists four other roles, never the open one', () => {
    render(<SimilarRolesSection role={biAnalyst} />);

    const entries = screen.getAllByTestId('similar-role');
    expect(entries).toHaveLength(4);
    for (const entry of entries) {
      expect(entry).not.toHaveTextContent(biAnalyst.title);
    }
  });

  it('names the skills a neighbour shares with the open role', () => {
    const roles: DataCareerRole[] = [
      {
        id: 'a',
        title: 'Role A',
        category: 'Analytics',
        shortDescription: 'Builds dashboards.',
        skills: ['SQL', 'Data Visualization'],
      },
      {
        id: 'b',
        title: 'Role B',
        category: 'Analytics',
        shortDescription: 'Builds reporting dashboards.',
        skills: ['SQL', 'Data Visualization', 'Python'],
      },
    ];
    render(<SimilarRolesSection role={roles[0]} roles={roles} />);

    const entry = screen.getByTestId('similar-role');
    expect(within(entry).getByText('SQL')).toBeInTheDocument();
    expect(within(entry).getByText('Data Visualization')).toBeInTheDocument();
    // Python is Role B's alone, so it is not offered as common ground.
    expect(within(entry).queryByText('Python')).not.toBeInTheDocument();
  });

  it('hands the chosen role id back to the page', async () => {
    const user = userEvent.setup();
    const onSelectRole = vi.fn();
    render(<SimilarRolesSection role={biAnalyst} onSelectRole={onSelectRole} />);

    const first = screen.getAllByTestId('similar-role')[0];
    await user.click(first);

    expect(onSelectRole).toHaveBeenCalledTimes(1);
    const [selectedId] = onSelectRole.mock.calls[0];
    expect(dataCareerRoles.some(role => role.id === selectedId)).toBe(true);
    expect(selectedId).not.toBe(biAnalyst.id);
  });

  it('renders inert cards when the surface cannot open another role', () => {
    render(<SimilarRolesSection role={biAnalyst} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('CareerRoleDetails', () => {
  it('shows the section under every tab, not only Overview', async () => {
    const user = userEvent.setup();
    render(<CareerRoleDetails role={biAnalyst} onClose={vi.fn()} onSelectRole={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Similar Roles' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Career Path' }));
    expect(screen.getByRole('heading', { name: 'Similar Roles' })).toBeInTheDocument();
    expect(screen.getAllByTestId('similar-role')).toHaveLength(4);
  });
});
