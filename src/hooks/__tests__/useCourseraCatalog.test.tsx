// ABOUTME: Tests the database-backed Coursera catalog read. The property that
// ABOUTME: matters is graceful degradation: when the table is missing, erroring, or
// ABOUTME: empty, callers must get `undefined` so the resolver falls back to the
// ABOUTME: catalog bundled with the app rather than rendering an empty section.

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useCourseraCatalog,
  MIN_RATING,
  MIN_REVIEWS,
  PLATFORM_LANGUAGE,
} from '../useCourseraCatalog';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import type { LearningSubject } from '@/data/learningSubjects';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Thenable stub matching the PostgREST builder chain the hook uses. */
function makeTableBuilder(result: any = { data: null, error: null }) {
  const builder: any = { result, calls: {} as Record<string, unknown[]> };
  for (const method of ['select', 'eq', 'overlaps', 'gte', 'or', 'order', 'limit']) {
    builder[method] = vi.fn().mockImplementation((...args: unknown[]) => {
      builder.calls[method] = args;
      return builder;
    });
  }
  builder.then = (resolve: any, reject: any) =>
    Promise.resolve(builder.result).then(resolve, reject);
  return builder;
}

const row = {
  slug: 'machine-learning-introduction',
  url: 'https://www.coursera.org/specializations/machine-learning-introduction',
  title: 'Machine Learning Specialization',
  partner: 'DeepLearning.AI',
  format: 'Specialization',
  level: 'Beginner',
  rating: 4.9,
  reviews: 30000,
  subjects: ['machine-learning', 'python'],
  primary_subjects: ['machine-learning'],
  skills: ['Machine Learning', 'Python Programming'],
  description: 'Regression, classification and recommenders in Python.',
  languages: ['en'],
};

const subjects: LearningSubject[] = ['machine-learning', 'python'];

describe('useCourseraCatalog', () => {
  let table: any;

  beforeEach(() => {
    vi.clearAllMocks();
    table = makeTableBuilder();
    mockSupabaseClient.from.mockImplementation(() => table);
  });

  it('returns database rows mapped to the catalog shape', async () => {
    table.result = { data: [row], error: null };

    const { result } = renderHook(() => useCourseraCatalog(subjects), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalog).toHaveLength(1);
    expect(result.current.catalog![0]).toMatchObject({
      slug: row.slug,
      url: row.url,
      partner: 'DeepLearning.AI',
      // snake_case column becomes camelCase, which the ranking logic reads.
      primarySubjects: ['machine-learning'],
      languages: ['en'],
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(false);
  });

  it('applies the quality bar and the active filter server-side', async () => {
    table.result = { data: [row], error: null };

    const { result } = renderHook(() => useCourseraCatalog(subjects), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Filtering client-side would mean shipping thousands of low-rated rows.
    expect(table.eq).toHaveBeenCalledWith('status', 'active');
    expect(table.gte).toHaveBeenCalledWith('rating', MIN_RATING);
    expect(table.gte).toHaveBeenCalledWith('reviews', MIN_REVIEWS);
    expect(table.overlaps).toHaveBeenCalledWith('subjects', ['machine-learning', 'python']);
  });

  it('filters to the platform language, keeping rows with none recorded', () => {
    table.result = { data: [row], error: null };

    renderHook(() => useCourseraCatalog(subjects), { wrapper });

    // A well-reviewed Spanish course is a bad recommendation here, but an empty
    // language means "not crawled since language capture" — excluding those would
    // blank the catalog mid-backfill.
    expect(table.or).toHaveBeenCalledWith(
      `languages.cs.{${PLATFORM_LANGUAGE}},languages.eq.{}`,
    );
  });

  it('sorts the subject list so two roles with the same subjects share a cache entry', async () => {
    table.result = { data: [row], error: null };

    const { result } = renderHook(
      () => useCourseraCatalog(['python', 'machine-learning'] as LearningSubject[]),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(table.overlaps).toHaveBeenCalledWith('subjects', ['machine-learning', 'python']);
  });

  // The next two cases used to assert the SAME thing — `usedFallback === true` —
  // for a failed read and an empty one. That single flag was the defect: the two
  // are different facts, they need different UI, and the bundled catalog rendered
  // either way so neither ever reached the screen. They are now distinguished.
  it('reports an error when the table is missing or unreadable', async () => {
    // What happens before the migration is applied.
    table.result = {
      data: null,
      error: { code: '42P01', message: 'relation "coursera_courses" does not exist' },
    };

    const { result } = renderHook(() => useCourseraCatalog(subjects), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalog).toBeUndefined();
    expect(result.current.error).not.toBeNull();
    // Not empty — nothing was successfully read, so "no rows" would be a lie.
    expect(result.current.isEmpty).toBe(false);
  });

  it('reports empty — not an error — when the table has no rows for these subjects', async () => {
    // Un-seeded, or mid-first-crawl. An honest gap, and the consumers say so
    // rather than substituting a build-time list.
    table.result = { data: [], error: null };

    const { result } = renderHook(() => useCourseraCatalog(subjects), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalog).toBeUndefined();
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('does not query at all for an empty subject list', async () => {
    const { result } = renderHook(() => useCourseraCatalog([]), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockSupabaseClient.from).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });
});
