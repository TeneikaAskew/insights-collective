import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Typed row factories for course-flow tests. Each returns a plausible row for
// its table with sensible defaults; pass overrides for the fields a test
// cares about. Keeping these central stops every test file from re-inventing
// slightly-different course shapes.

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-${String(++idCounter).padStart(4, '0')}`;

export function makeCourse(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('course'),
    title: 'Intro to Data Analytics',
    description: 'Learn the basics of data analytics.',
    status: 'published',
    instructor_id: 'instructor-1',
    image_url: null,
    thumbnail: null,
    duration: 8,
    level: 'Beginner',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  };
}

export function makeModule(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('module'),
    course_id: 'course-1',
    title: 'Module 1',
    description: 'First module',
    position: 1,
    published: true,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeContentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('item'),
    module_id: 'module-1',
    title: 'Lesson 1',
    content_type: 'page',
    position: 1,
    published: true,
    points_possible: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

export function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('enrollment'),
    user_id: 'user-1',
    course_id: 'course-1',
    completion_status: 0,
    enrolled_at: '2026-01-05T00:00:00Z',
    created_at: '2026-01-05T00:00:00Z',
    ...overrides,
  };
}

export function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('profile'),
    first_name: 'Ada',
    last_name: 'Lovelace',
    avatar_url: null,
    roles: ['user'],
    ...overrides,
  };
}

export function makeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('submission'),
    assignment_id: 'assignment-1',
    user_id: 'user-1',
    body: 'My submission text',
    url: null,
    grade: null,
    score: null,
    graded_at: null,
    grader_comments: null,
    workflow_state: 'submitted',
    submitted_at: '2026-01-10T00:00:00Z',
    attempt: 1,
    ...overrides,
  };
}

export function makeQuizSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('quiz-sub'),
    quiz_id: 'quiz-1',
    user_id: 'user-1',
    score: 8,
    kept_score: 8,
    attempt: 1,
    workflow_state: 'complete',
    finished_at: '2026-01-11T00:00:00Z',
    ...overrides,
  };
}

export function makeCertificate(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('cert'),
    user_id: 'user-1',
    course_id: 'course-1',
    certificate_type: 'completion',
    certificate_data: { course_title: 'Intro to Data Analytics', final_score: 100 },
    verification_code: 'CERT-ABCD-1234',
    issued_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

export function makeProgression(overrides: Record<string, unknown> = {}) {
  return {
    id: nextId('progression'),
    content_item_id: 'item-1',
    user_id: 'user-1',
    workflow_state: 'completed',
    completed_at: '2026-01-12T00:00:00Z',
    ...overrides,
  };
}

// Wrapper for renderHook tests using TanStack Query hooks. Retries are
// disabled so error paths settle immediately instead of retrying 3 times.
export function createHookWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  return Wrapper;
}
