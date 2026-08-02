// ABOUTME: Tests for useSkillCourses' key contract: callers look up results
// ABOUTME: with the exact strings they passed in, so a skill with surrounding
// ABOUTME: whitespace must still find its match (matching runs on the trimmed
// ABOUTME: name; the map is keyed by the original).
//
// Both tests used to lean on the bundled catalog BY DESIGN — the supabase mock
// left the read pending, resolution fell through to the build-time file, and
// "SQL always has courses" came for free. That is precisely the fallback this
// change removes, so the fixture is now explicit: useCourseraCatalog is mocked
// and returns the rows each test needs. More setup, but the test states its own
// preconditions instead of inheriting them from a 150KB data file that no longer
// ships.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CourseraCourse } from '@/data/courseraCatalog';

const mockCatalog = vi.fn();
vi.mock('../useCourseraCatalog', () => ({
  useCourseraCatalog: (...args: unknown[]) => mockCatalog(...args),
}));

import { useSkillCourses } from '../useSkillCourses';

function sqlCourse(overrides: Partial<CourseraCourse> = {}): CourseraCourse {
  return {
    slug: 'sql-for-data-science',
    url: 'https://www.coursera.org/learn/sql-for-data-science',
    title: 'SQL for Data Science',
    partner: 'UC Davis',
    format: 'Course',
    level: 'Beginner',
    rating: 4.6,
    reviews: 12000,
    subjects: ['sql'],
    primarySubjects: ['sql'],
    skills: ['SQL'],
    description: 'Learn SQL.',
    languages: ['en'],
    ...overrides,
  };
}

function catalogResult(catalog: CourseraCourse[] | undefined, error: Error | null = null) {
  return {
    catalog,
    loading: false,
    error,
    isEmpty: !error && !catalog?.length,
    retry: vi.fn(),
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSkillCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCatalog.mockReturnValue(catalogResult([sqlCourse()]));
  });

  it('keys results by the original untrimmed skill strings', () => {
    const { result } = renderHook(() => useSkillCourses([' SQL ']), { wrapper });

    const courses = result.current.coursesBySkill.get(' SQL ');
    expect(courses).toBeDefined();
    expect(courses!.length).toBeGreaterThan(0);
    expect(courses![0].external).toBe(true);
  });

  it('drops whitespace-only skills instead of keying empty strings', () => {
    const { result } = renderHook(() => useSkillCourses(['   ', 'SQL']), { wrapper });

    expect(result.current.coursesBySkill.has('   ')).toBe(false);
    expect(result.current.coursesBySkill.get('SQL')!.length).toBeGreaterThan(0);
  });

  it('surfaces a catalog read failure instead of returning a silent empty map', () => {
    // The point of the whole change. This state was previously UNREACHABLE: a
    // failed read produced bundled courses and the caller could not tell. Now the
    // caller gets empty lists AND an error saying why they are empty.
    mockCatalog.mockReturnValue(catalogResult(undefined, new Error('read failed')));

    const { result } = renderHook(() => useSkillCourses(['SQL']), { wrapper });

    expect(result.current.error).not.toBeNull();
    expect(result.current.coursesBySkill.get('SQL')).toEqual([]);
  });

  it('reports no error when the catalog is legitimately empty for a skill', () => {
    // The other half of the distinction: empty is an answer, not a failure.
    mockCatalog.mockReturnValue(catalogResult([]));

    const { result } = renderHook(() => useSkillCourses(['SQL']), { wrapper });

    expect(result.current.error).toBeNull();
    expect(result.current.coursesBySkill.get('SQL')).toEqual([]);
  });
});
