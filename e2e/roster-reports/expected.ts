// ABOUTME: Hand-computed oracle for the T-15 acceptance fixture (scripts/roster-reports-fixture/seed.sql). Computed by
// ABOUTME: hand from the seed rows, not from product code; tests/selftest.mjs recomputes it independently from seed.sql.
//
// Denominator: published items in published modules of RR = I1..I4 (4). Excluded: I5 (unpublished), I6 (draft module).
// Done states: read, completed, graded. 'started' is not done.
//   L1 Ada     I1 completed, I2 completed, I3 read, I4 completed  -> 4/4 = 100%  finished
//   L2 Grace   I1 read, I2 completed, I3 started                  -> 2/4 =  50%
//   L3 Alan    none, enrolled 30 days ago                         -> 0/4 =   0%  Not started
//   L4 Edsger  none, enrolled 2 days ago                          -> 0/4 =   0%  (under 7 days: not flagged)
//   member     I1 completed (+ I5, I6 excluded)                   -> 1/4 =  25%
// Average = (1 + 0.5 + 0 + 0 + 0.25) / 5 = 0.35 -> 35%. Completed 1 of 5 -> 20%. Not started 1.
// Legacy completion_status (0, 100, 100, 0, 0) would instead give 40% / 40% / 2 not started.
export const RR = {
  course: '7150a000-0000-4000-8000-000000000001',
  empty: '7150a000-0000-4000-8000-000000000002',
  other: '7150a000-0000-4000-8000-000000000003',
  item: {
    I1: '7150a000-0000-4000-8000-000000000101', I2: '7150a000-0000-4000-8000-000000000102',
    I3: '7150a000-0000-4000-8000-000000000103', I4: '7150a000-0000-4000-8000-000000000104',
    I5: '7150a000-0000-4000-8000-000000000105', I6: '7150a000-0000-4000-8000-000000000106',
    I8: '7150a000-0000-4000-8000-000000000108',
  },
  memberId: 'e2e00000-0000-4000-8000-000000000003',
  memberEnrollment: '7150a000-0000-4000-8000-000000000305',
  memberProgressions: ['7150a000-0000-4000-8000-000000000408', '7150a000-0000-4000-8000-000000000409', '7150a000-0000-4000-8000-000000000410'],
} as const;

export const FIXTURE_LEARNERS = [
  { name: 'Ada Fixture', pct: '100%', title: '4 of 4 lessons finished', notStarted: false },
  { name: 'Grace Fixture', pct: '50%', title: '2 of 4 lessons finished', notStarted: false },
  { name: 'Alan Fixture', pct: '0%', title: '0 of 4 lessons finished', notStarted: true },
  { name: 'Edsger Fixture', pct: '0%', title: '0 of 4 lessons finished', notStarted: false },
] as const;
/** The member's row is found by its exact counts; its display name comes from the shared actor profile. */
export const MEMBER_ROW = { pct: '25%', title: '1 of 4 lessons finished' } as const;

export const STUDENTS = { enrolled: '5', avg: '35%', notStarted: '1' } as const;
export const REPORTS = {
  enrolled: '5', completionRate: '20%', completionCopy: '1 of 5 learners finished every published lesson.',
  avg: '35%', notStarted: '1',
  modules: [{ title: 'RR Published Section', meta: '4 lessons · 1 finished', pct: '35%' }],
  absentModules: ['RR Draft Section'],
} as const;
export const LEGACY = { completionRate: '40%', avg: '40%', notStarted: '2' } as const;

export const EMPTY = {
  enrolled: '2', unknown: '—', unknownCopy: 'Unknown: no published lessons to measure yet.', notStarted: '0',
  studentsNote: 'No published lessons to measure yet.',
} as const;

export const builder = (courseId: string, view: 'students' | 'reports') => `/courses/${courseId}/builder?view=${view}`;
