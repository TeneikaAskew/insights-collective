// ABOUTME: Tests for ModuleProgressCard — locks its queries to the live schema:
// ABOUTME: content_items + content_item_progressions, no lesson_completions, no RPC.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { ModuleProgressCard } from '../ModuleProgressCard';

type QueryResult = { data?: unknown; error?: unknown };

function makeTableBuilder(result: QueryResult) {
  const builder: any = {};
  const promise = Promise.resolve({ data: null, error: null, ...result });
  for (const m of [
    'select', 'eq', 'neq', 'in', 'is', 'order', 'limit',
    'gt', 'gte', 'lt', 'lte', 'not', 'or', 'filter', 'match',
  ]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => promise);
  builder.maybeSingle = vi.fn(() => promise);
  builder.then = (f: any, r: any) => promise.then(f, r);
  return builder;
}

function mockTables(tables: Record<string, QueryResult>) {
  const builders: Record<string, any> = {};
  const queried: string[] = [];
  (mockSupabaseClient.from as ReturnType<typeof vi.fn>).mockImplementation(
    (table: string) => {
      queried.push(table);
      if (!builders[table]) builders[table] = makeTableBuilder(tables[table] ?? {});
      return builders[table];
    }
  );
  return { builders, queried };
}

function stubHappyPath(overrides: Record<string, any> = {}) {
  return mockTables({
    content_items: {
      data: [
        { id: 'i1', title: 'Intro video', type: 'video', position: 1 },
        { id: 'i2', title: 'Reading', type: 'page', position: 2 },
      ],
    },
    content_item_progressions: {
      data: [{ content_item_id: 'i1', workflow_state: 'completed' }],
    },
    assignments: {
      data: [{
        id: 'a1', title: 'Essay', due_date: null, points: 10,
        submissions: [{ id: 's1', workflow_state: 'graded', grade: 9 }],
      }],
    },
    quizzes: {
      data: [{
        id: 'q1', title: 'Quiz 1', points_possible: 5,
        attempts: [],
      }],
    },
    ...overrides,
  });
}

describe('ModuleProgressCard', () => {
  // REGRESSION: the card used to call the calculate_module_progress RPC and
  // join lessons -> lesson_completions with assignment_submissions.status /
  // student_id. None of those exist in the live database; the page 400'd.
  it('queries live tables only — no RPC, no lessons/lesson_completions, submissions by user_id', async () => {
    const { builders, queried } = stubHappyPath();

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );
    await screen.findByText('Week 1');

    expect(mockSupabaseClient.rpc).not.toHaveBeenCalledWith(
      'calculate_module_progress',
      expect.anything()
    );
    expect(queried).not.toContain('lessons');
    expect(queried).not.toContain('lesson_completions');
    expect(queried).toContain('content_items');
    expect(queried).toContain('content_item_progressions');
    expect(builders['content_item_progressions'].eq).toHaveBeenCalledWith('user_id', 'user-1');
    const assignmentSelect = builders['assignments'].select.mock.calls[0][0] as string;
    expect(assignmentSelect).toContain('workflow_state');
    expect(assignmentSelect).not.toMatch(/(^|[,\s(])status([,\s)]|$)/);
    expect(builders['assignments'].eq).toHaveBeenCalledWith('submissions.user_id', 'user-1');
  });

  it('computes progress client-side: 2 of 4 items done (1 content item + 1 graded assignment) = 50%', async () => {
    stubHappyPath();

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );
    await screen.findByText('Week 1');

    // i1 completed + a1 graded = 2 done; i2 + q1 not done. 2/4 = 50%.
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/2\s*\/\s*4/)).toBeInTheDocument();
  });

  // REGRESSION: quiz completion comes from quiz_submissions.workflow_state.
  // The card previously embedded quiz_attempts and checked completed_at — a
  // table nothing writes — so finished quizzes never counted.
  it('counts a completed quiz_submissions row as a finished quiz', async () => {
    stubHappyPath({
      quizzes: {
        data: [{
          id: 'q1', title: 'Quiz 1', points_possible: 5,
          attempts: [{ id: 'qs1', score: 5, finished_at: '2026-01-02T00:00:00Z', workflow_state: 'complete' }],
        }],
      },
    });

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );

    // 3 of 4 items done: 1 content item + 1 graded assignment + 1 quiz = 75%
    expect(await screen.findByText('75%')).toBeInTheDocument();
  });

  it('renders the error state with retry when a query fails', async () => {
    mockTables({
      content_items: { data: null, error: { message: 'boom' } },
      content_item_progressions: { data: [] },
      assignments: { data: [] },
      quizzes: { data: [] },
    });

    render(
      <ModuleProgressCard
        moduleId="m1"
        moduleTitle="Week 1"
        studentId="user-1"
        showDetails={true}
      />
    );

    expect(
      await screen.findByText(/Failed to load progress for Week 1/i)
    ).toBeInTheDocument();
  });
});
