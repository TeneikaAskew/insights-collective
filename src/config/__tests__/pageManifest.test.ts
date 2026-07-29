import { describe, it, expect } from 'vitest';
import {
  PAGE_MANIFEST,
  resolveGoverningPaths,
  isUngatedPath,
  getAllManifestEntries,
} from '../pageManifest';

describe('resolveGoverningPaths', () => {
  it('resolves an exact section match', () => {
    expect(resolveGoverningPaths('/resume')).toEqual(['/resume']);
    expect(resolveGoverningPaths('/courses')).toEqual(['/courses']);
  });

  it('resolves the root path to Home only', () => {
    expect(resolveGoverningPaths('/')).toEqual(['/']);
  });

  it('does NOT let the root section govern other pages', () => {
    expect(resolveGoverningPaths('/dashboard')).toEqual(['/dashboard']);
    expect(resolveGoverningPaths('/resume')).not.toContain('/');
  });

  it('governs nested paths through the section (subtree inheritance)', () => {
    expect(resolveGoverningPaths('/courses/abc-123')).toEqual(['/courses']);
    expect(resolveGoverningPaths('/courses/abc-123/learn/m1/i2')).toEqual(['/courses']);
    expect(resolveGoverningPaths('/blog/my-post-slug')).toEqual(['/blog']);
    expect(resolveGoverningPaths('/events/evt-9')).toEqual(['/events']);
    expect(resolveGoverningPaths('/messages/conv-1')).toEqual(['/messages']);
  });

  it('returns the parent → child chain for manifest children', () => {
    expect(resolveGoverningPaths('/interview-prep/star-practice')).toEqual([
      '/interview-prep',
      '/interview-prep/star-practice',
    ]);
    expect(resolveGoverningPaths('/interview-prep')).toEqual(['/interview-prep']);
  });

  it('includes the child chain for paths nested below a child', () => {
    expect(
      resolveGoverningPaths('/interview-prep/mock-interview-room/session-1'),
    ).toEqual(['/interview-prep', '/interview-prep/mock-interview-room']);
  });

  it('matches only on segment boundaries', () => {
    // /course (singular alias of /courses) must not match /course-management
    expect(resolveGoverningPaths('/course-management')).toEqual(['/course-management']);
    // /courses must not be governed by a hypothetical /course prefix match
    expect(resolveGoverningPaths('/coursesextra')).toEqual([]);
  });

  it('resolves aliases to the canonical section', () => {
    expect(resolveGoverningPaths('/course-list')).toEqual(['/courses']);
    expect(resolveGoverningPaths('/course/abc-123')).toEqual(['/courses']);
    expect(resolveGoverningPaths('/assistant/rowan')).toEqual(['/assistants']);
    expect(resolveGoverningPaths('/assistant-interface')).toEqual(['/assistants']);
    expect(resolveGoverningPaths('/survey-confirmation/slug-1')).toEqual(['/survey']);
  });

  it('returns an empty chain for unknown paths', () => {
    expect(resolveGoverningPaths('/definitely-not-a-page')).toEqual([]);
  });

  it('ignores trailing slashes', () => {
    expect(resolveGoverningPaths('/resume/')).toEqual(['/resume']);
    expect(resolveGoverningPaths('/interview-prep/star-practice/')).toEqual([
      '/interview-prep',
      '/interview-prep/star-practice',
    ]);
  });
});

describe('isUngatedPath', () => {
  it('exempts auth routes', () => {
    expect(isUngatedPath('/login')).toBe(true);
    expect(isUngatedPath('/register')).toBe(true);
    expect(isUngatedPath('/reset-password')).toBe(true);
    expect(isUngatedPath('/auth-callback')).toBe(true);
    expect(isUngatedPath('/auth/callback')).toBe(true);
  });

  it('exempts legal, public, admin, and dev surfaces', () => {
    expect(isUngatedPath('/privacy-policy')).toBe(true);
    expect(isUngatedPath('/terms-of-service')).toBe(true);
    expect(isUngatedPath('/portfolio/my-custom-url')).toBe(true);
    expect(isUngatedPath('/verify-certificate/CERT-123')).toBe(true);
    expect(isUngatedPath('/admin')).toBe(true);
    expect(isUngatedPath('/admin/users')).toBe(true);
    expect(isUngatedPath('/dev/soft-studio')).toBe(true);
  });

  it('does not exempt gated pages', () => {
    expect(isUngatedPath('/')).toBe(false);
    expect(isUngatedPath('/resume')).toBe(false);
    expect(isUngatedPath('/courses/abc')).toBe(false);
    // /portfolio-explorer is gated even though /portfolio/* is public
    expect(isUngatedPath('/portfolio-explorer')).toBe(false);
    expect(isUngatedPath('/portfolio-editor/p1')).toBe(false);
  });
});

describe('getAllManifestEntries', () => {
  it('returns sections and children, flat', () => {
    const rows = getAllManifestEntries();
    const paths = rows.map(r => r.page_path);
    expect(paths).toContain('/courses');
    expect(paths).toContain('/interview-prep');
    expect(paths).toContain('/interview-prep/star-practice');
    expect(paths).not.toContain('/course-list'); // aliases are not synced
    expect(paths).not.toContain('/admin');       // ungated paths are not synced
  });

  it('has no duplicate page_path values', () => {
    const paths = getAllManifestEntries().map(r => r.page_path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('every entry has a non-empty name', () => {
    for (const row of getAllManifestEntries()) {
      expect(row.page_name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('manifest consistency', () => {
  it('all children live under their parent path', () => {
    for (const section of PAGE_MANIFEST) {
      for (const child of section.children ?? []) {
        expect(child.path.startsWith(`${section.path}/`)).toBe(true);
      }
    }
  });

  it('no manifest path overlaps an ungated prefix', () => {
    for (const row of getAllManifestEntries()) {
      expect(isUngatedPath(row.page_path)).toBe(false);
    }
  });
});
