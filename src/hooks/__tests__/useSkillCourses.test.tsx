// ABOUTME: Tests for useSkillCourses' key contract: callers look up results
// ABOUTME: with the exact strings they passed in, so a skill with surrounding
// ABOUTME: whitespace must still find its match (matching runs on the trimmed
// ABOUTME: name; the map is keyed by the original).

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSkillCourses } from '../useSkillCourses';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSkillCourses', () => {
  it('keys results by the original untrimmed skill strings', () => {
    // The catalog read stays pending under the supabase mock, so resolution
    // runs against the bundled catalog — which always has SQL courses.
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
});
