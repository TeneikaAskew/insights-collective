// ABOUTME: Pins that site search reads the real catalogs rather than hand-typed copies.
// ABOUTME: Every advertised URL must be a route, and every career slug a real role.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils/test-utils';
import SiteSearch from '../SiteSearch';
import { dataCareerRoles } from '@/data/dataCareerRoles';

/**
 * Why this file exists.
 *
 * The career results were six roles typed out by hand against a catalog of
 * 33. Twenty-nine were unfindable, and two of the six — `analytics-engineer`
 * and `data-product-manager` — were slugs that no longer existed, so searching
 * them returned a result that deep-linked to nothing. Nothing failed, because
 * nothing compared the two lists.
 */

vi.mock('@/hooks/usePublishedCourses', () => ({
  usePublishedCourses: () => ({ courses: [], isLoading: false }),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigate };
});

/** Type into the search box and read back the rendered result titles. */
async function search(term: string): Promise<string[]> {
  const { container } = render(<SiteSearch />);
  fireEvent.change(screen.getByRole('searchbox', { name: /search entire site/i }), {
    target: { value: term },
  });
  await waitFor(() =>
    expect(container.querySelectorAll('[data-testid="search-result"]').length).toBeGreaterThan(0),
  );
  return Array.from(container.querySelectorAll('[data-testid="search-result-title"]')).map(
    (el) => el.textContent ?? '',
  );
}

describe('SiteSearch career results', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('finds a role that the old hand-written list left out', async () => {
    // `mlops-engineer` is in the catalog and was not in the six.
    const role = dataCareerRoles.find((r) => r.id === 'mlops-engineer');
    expect(role, 'mlops-engineer is expected in the catalog').toBeTruthy();

    const titles = await search(role!.title);
    expect(titles).toContain(role!.title);
  });

  it('offers every role in the catalog, not a subset', async () => {
    // "engineer" spans many tracks, so this is a broad read of the same list
    // the Explore Careers page renders.
    const expected = dataCareerRoles
      .filter((r) => r.title.toLowerCase().includes('engineer'))
      .map((r) => r.title);
    expect(expected.length).toBeGreaterThan(6);

    const titles = await search('engineer');
    for (const title of expected) {
      expect(titles, `${title} should be findable`).toContain(title);
    }
  });

  it('navigates to a slug the catalog actually contains', async () => {
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: /search entire site/i });
    fireEvent.change(input, { target: { value: 'Cloud Data Engineer' } });

    const result = await screen.findByText('Cloud Data Engineer');
    fireEvent.click(result);

    const [url] = navigate.mock.calls.at(-1) ?? [];
    expect(url).toBe('/explore-data-careers?role=cloud-data-engineer');
    const slug = String(url).split('role=')[1];
    expect(
      dataCareerRoles.some((r) => r.id === slug),
      `${slug} must be a real role, or the deep link opens nothing`,
    ).toBe(true);
  });

  it('does not advertise the disabled Forum', async () => {
    // App.tsx redirects /forum to /dashboard under "Forums disabled", and it is
    // absent from PAGE_MANIFEST. Searching it used to promise a page.
    render(<SiteSearch />);
    const input = screen.getByRole('searchbox', { name: /search entire site/i });
    fireEvent.change(input, { target: { value: 'forum' } });

    await screen.findByText('No results found.');
  });

  it('lists Career Pathway once, not twice', async () => {
    const titles = await search('career pathway');
    expect(titles.filter((t) => t === 'Career Pathway')).toHaveLength(1);
  });
});
