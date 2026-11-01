// ABOUTME: Fixed ids, titles and exact oracles for the no-quiz authentic UI journey (UNRUN proposal). Every id is in the
// ABOUTME: 9b6c0000-... namespace, disjoint from the grading fixture (9b6b0000-...) and from the shared e2e seed.
//
// The seed (scripts/gradebook-fixture/journey/seed-journey.sql) creates ONLY the draft course shell below. Everything
// the journey is about (publish, enrollment, upload, submission, attachment, progress, grade, certificate) is written
// by the app's own UI under the signed-in persona, through the real API, Storage and RLS of the disposable stack.

export const J = {
  course: '9b6c0000-0000-4000-8000-000000000001',
  module: '9b6c0000-0000-4000-8000-000000000002',
  item: {
    page: '9b6c0000-0000-4000-8000-000000000101',
    assignment: '9b6c0000-0000-4000-8000-000000000102',
  },
  assignment: '9b6c0000-0000-4000-8000-000000000202',
  title: {
    course: 'Journey Fixture Course',
    page: 'Journey reading',
    assignment: 'Journey essay upload',
  },
  instructorId: 'e2e00000-0000-4000-8000-000000000002',
  memberId: 'e2e00000-0000-4000-8000-000000000003',
} as const;

/** Points possible on the one assignment, and the grade the instructor gives through SpeedGrader. */
export const POINTS = 10 as const;
export const GRADE = 7 as const;
/** Two published items (one page, one assignment): the denominator check_course_completion and the issuer both use. */
export const PUBLISHED_ITEMS = 2 as const;

/** Typed feedback, and the exact stored value the SpeedGrader editor produces for one plain paragraph (same oracle
 *  shape as the grading fixture: fixture.ts STORED). The learner must SEE the typed text, never the markup. */
export const FEEDBACK = 'Journey fixture: clear structure, cite one more source.';
export const STORED_FEEDBACK = `<p>${FEEDBACK}</p>`;

/** The uploaded file. Bytes are built deterministically so the instructor's Storage download can be compared to them. */
export const UPLOAD = {
  name: 'journey-essay.pdf',
  mimeType: 'application/pdf',
  /** A minimal, syntactically complete one-page PDF. Content is synthetic; no personal data. */
  body(): Buffer {
    const objs = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
    ];
    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const xref = Buffer.byteLength(out);
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
  },
} as const;

/** Storage key prefix the app uses for a learner's submission files (useFileUpload: submissions/<course>/<user>/...),
 *  which the course_submission_* storage policies key off. */
export const SUBMISSION_PREFIX = `submissions/${J.course}/${J.memberId}/`;

export const route = {
  catalog: '/courses',
  detail: `/courses/${J.course}`,
  builder: `/courses/${J.course}/builder`,
  lesson: (item: string) => `/courses/${J.course}/learn/${J.module}/${item}`,
  grader: `/courses/${J.course}/assignments/${J.item.assignment}/grade`,
  grades: `/courses/${J.course}/grades`,
  progress: `/courses/${J.course}/progress`,
  certificate: `/courses/${J.course}/certificate`,
} as const;
