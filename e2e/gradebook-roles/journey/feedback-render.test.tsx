// ABOUTME: MOCKED unit characterization (journey lane): what the learner sees for feedback in the SHAPE SpeedGrader stores
// ABOUTME: (<p>text</p>). Records current #139 behaviour; it is not browser, API or runtime evidence.
//
// Prediction this pins down: InlineAssignmentSubmit renders grader_comments as React text, so stored HTML is shown
// with its tags. The journey's J4a asserts the CORRECT behaviour (typed text only) and is therefore expected to fail
// on this source. No product change is made in this lane; the product file belongs to the PR 134 thread.
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '@/test/utils/test-utils';
import { mockSupabaseClient } from '@/test/mocks/supabase';
import { makeSubmission } from '@/test/utils/course-fixtures';
import { InlineAssignmentSubmit } from '@/components/course/learn/InlineAssignmentSubmit';
import { FEEDBACK, STORED_FEEDBACK, GRADE, POINTS } from './ids';

vi.mock('@/hooks/useFileUpload', () => ({ useFileUpload: () => ({ uploadFile: vi.fn(), uploading: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => ({ user: { id: 'user-1' }, session: {}, loading: false, error: null, isAuthenticated: true, isAdmin: false }),
}));

function table(result: { data: unknown; error: unknown }) {
  const b: any = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'single', 'in']) b[m] = vi.fn().mockReturnValue(b);
  b.then = (f: any, r: any) => Promise.resolve(result).then(f, r);
  return b;
}

describe('journey J4a characterization: learner feedback rendering of SpeedGrader-stored HTML', () => {
  it('current source shows the literal <p> markup to the learner (defect characterized, not fixed)', async () => {
    const tables: Record<string, any> = {
      assignment_submissions: table({ data: makeSubmission({ assignment_id: 'a-1', workflow_state: 'graded', attempt: 1, grade: GRADE, score: null, grader_comments: STORED_FEEDBACK }), error: null }),
      assignment_rubrics: table({ data: [], error: null }),
      submission_attachments: table({ data: [], error: null }),
    };
    (mockSupabaseClient.from as any).mockImplementation((t: string) => tables[t] ?? table({ data: null, error: null }));
    render(<InlineAssignmentSubmit item={{ id: 'i-1', title: 'Journey essay upload', type: 'assignment', course_id: 'c-1' } as any}
      assignment={{ id: 'a-1', course_id: 'c-1', title: 'Journey essay upload', submission_types: ['online_upload'], points: POINTS } as any} />);
    expect(await screen.findByText(new RegExp(`Score ${GRADE} / ${POINTS}`))).toBeInTheDocument();
    // What a learner would read: the stored string verbatim, tags included.
    expect(screen.getByText(STORED_FEEDBACK, { exact: true })).toBeInTheDocument();
    // The correct rendering (typed text as its own text node) is absent.
    expect(screen.queryByText(FEEDBACK, { exact: true })).toBeNull();
  });
});
