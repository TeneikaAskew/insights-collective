// ABOUTME: T-42: with the global rail COLLAPSED (icons only) every navigation link must keep a non-empty COMPUTED
// ABOUTME: accessible name; exact href/name sets per persona and page-visibility state, collapsed and expanded.
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeAccessibleName } from 'dom-accessibility-api';
import { MemoryRouter } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { createMockAuthProvider } from '@/test/mocks/authMocks';

// Page visibility is controlled per test. It is a fixture input, NOT a permission oracle: the real manifest and
// the server decide visibility; these tests only check that the rail renders exactly what that input allows.
const vis = vi.hoisted(() => ({ fn: (_p: string): boolean => true, loading: false }));
vi.mock('@/contexts/PageVisibilityContext', () => ({
  usePageVisibility: () => ({ isPageVisible: (p: string) => vis.fn(p), isLoading: vis.loading }),
}));
import AppSidebar from '@/components/layout/AppSidebar';

const admin = { id: 'u-admin', email: 'admin@example.com', roles: ['admin'], user_metadata: {} } as never;
const instructor = { id: 'u-ins', email: 'ins@example.com', roles: ['instructor'], user_metadata: {} } as never;
const member = { id: 'u-mem', email: 'mem@example.com', roles: [], user_metadata: {} } as never;
const as = (user: never | null) =>
  vi.mocked(useAuth).mockReturnValue(
    (user ? createMockAuthProvider({ user, isAuthenticated: true }) : createMockAuthProvider()) as never,
  );

function mount(open: boolean, path = '/course-management') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarProvider defaultOpen={open}><AppSidebar /></SidebarProvider>
    </MemoryRouter>,
  );
}

// Computed accessible name (accname algorithm via dom-accessibility-api), never aria-label/title/textContent.
const links = () => screen.getAllByRole('link').map((a) => ({ href: a.getAttribute('href'), name: computeAccessibleName(a) }));

const PUBLIC = [
  ['/dashboard', 'Dashboard'], ['/resources', 'Resources'], ['/teneika-linkedin', "Teneika's LinkedIn"],
  ['/teneika-tweets', "Teneika's Tweets"], ['/courses', 'Courses'], ['/resume', 'Resume Analyzer'],
  ['/interview-prep', 'Interview Prep'], ['/career-pathway', 'Career Pathway'], ['/portfolio-explorer', 'Portfolio Explorer'],
  ['/survey', 'AI & Automation Fellowship'], ['/events', 'Events'], ['/assistants', 'Assistants'],
  ['/dashboard?tab=messages', 'Messages'], ['/notifications', 'Notifications'], ['/profile', 'Profile'],
] as const;
const HIGHLIGHT = new Set(['/resume', '/interview-prep', '/career-pathway', '/portfolio-explorer']);
const BROWSE = [
  ['/dashboard', 'Dashboard'], ['/resources', 'Resources'], ['/courses', 'Courses'], ['/events', 'Events'],
  ['/career-pathway', 'Career Pathway'], ['/resume', 'Resume Analyzer'],
] as const;
const HOME = { href: '/', name: 'Insights Collective' };
const set = (rows: readonly (readonly [string, string])[], expanded: boolean) =>
  rows.map(([href, name]) => ({ href, name: expanded && HIGHLIGHT.has(href) ? `${name} New` : name }));

describe('AppSidebar computed accessible names (T-42)', () => {
  beforeEach(() => { vis.fn = () => true; vis.loading = false; as(admin); });

  describe('oracle self-check: hidden-only labels are NOT names', () => {
    it('aria-hidden and display:none labels compute to an empty name although textContent is non-empty', () => {
      render(<nav><a href="/x"><span aria-hidden="true">Hidden by aria</span></a><a href="/y"><span style={{ display: 'none' }}>Hidden by CSS</span></a></nav>);
      const [x, y] = screen.getAllByRole('link');
      // The old proxy (aria-label || title || textContent) would call both of these named.
      expect((x.getAttribute('aria-label') || x.getAttribute('title') || x.textContent || '').trim()).not.toBe('');
      expect((y.getAttribute('aria-label') || y.getAttribute('title') || y.textContent || '').trim()).not.toBe('');
      expect(x).toHaveAccessibleName('');
      expect(y).toHaveAccessibleName('');
    });
  });

  describe.each([[false, 'collapsed'], [true, 'expanded']] as const)('%s=%s', (open, label) => {
    it(`${label}, admin: exact links and computed names`, () => {
      mount(open);
      expect(links()).toEqual([HOME, ...set(PUBLIC, open), { href: '/admin', name: 'Admin' }]);
    });
    it(`${label}, instructor: exact links and computed names, including My Courses and Manage Blog`, () => {
      as(instructor);
      mount(open);
      expect(links()).toEqual([HOME, ...set(PUBLIC, open), { href: '/course-management', name: 'My Courses' }, { href: '/admin/blog', name: 'Manage Blog' }]);
    });
    it(`${label}, ordinary member: exact links, no staff entries`, () => {
      as(member);
      mount(open);
      expect(links()).toEqual([HOME, ...set(PUBLIC, open)]);
    });
    it(`${label}, member with /notifications and /messages denied: those two are absent, the rest unchanged`, () => {
      as(member);
      vis.fn = (p) => p !== '/notifications' && p !== '/messages';
      mount(open);
      expect(links()).toEqual([HOME, ...set(PUBLIC, open).filter((l) => l.href !== '/notifications' && l.href !== '/dashboard?tab=messages')]);
    });
    it(`${label}, member while visibility is loading (fail-closed input): only the home link`, () => {
      as(member);
      vis.fn = () => false; vis.loading = true;
      mount(open);
      expect(links()).toEqual([HOME]);
    });
    it(`${label}, signed-out visitor: exact browse links${open ? ' plus sign-in and register' : ''}`, () => {
      as(null);
      mount(open);
      const auth = open
        ? [{ href: '/register', name: 'Create Free Account' }, { href: '/login', name: 'Sign In' }]
        : [];
      const footer = open ? [{ href: '/login', name: 'Sign In' }, { href: '/register', name: 'Create Account' }] : [];
      expect(links()).toEqual([HOME, ...auth, ...set(BROWSE, open), ...footer]);
    });
    it(`${label}: every link has a non-empty computed name (toHaveAccessibleName)`, () => {
      for (const who of [admin, instructor, member, null]) {
        as(who as never);
        const { unmount } = mount(open);
        for (const a of screen.getAllByRole('link')) expect(a).toHaveAccessibleName(/\S/);
        unmount();
      }
    });
  });

  it('collapsed: the exact audited targets are named (/courses, home)', () => {
    mount(false);
    expect(screen.getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/courses');
    expect(screen.getByRole('link', { name: 'Insights Collective' })).toHaveAttribute('href', '/');
  });

  it('collapsed instructor: My Courses and Manage Blog keep their names', () => {
    as(instructor);
    mount(false);
    expect(screen.getByRole('link', { name: 'My Courses' })).toHaveAttribute('href', '/course-management');
    expect(screen.getByRole('link', { name: 'Manage Blog' })).toHaveAttribute('href', '/admin/blog');
  });

  it('collapsed: labels are visually hidden (sr-only), not removed; expanded: visible text', () => {
    as(instructor);
    const { unmount } = mount(false);
    expect(screen.getByRole('link', { name: 'My Courses' }).querySelector('span')).toHaveClass('sr-only');
    unmount();
    mount(true);
    expect(screen.getByRole('link', { name: 'My Courses' }).querySelector('span')).not.toHaveClass('sr-only');
  });
});
