// ABOUTME: Single normalized grade model for /courses/:id/gradebook — cells, totals and the CSV export
// ABOUTME: all read from here so the table and the download can never disagree (0 vs missing, latest attempt).

export type CellStatus = 'graded' | 'submitted' | 'missing';

export interface GradebookStudent { id: string; full_name: string; email?: string }
export interface GradebookItem { id: string; title?: string | null; points?: number | null }

export interface RawAssignmentSubmission {
  id: string;
  user_id: string;
  assignment_id: string;
  grade?: number | null;
  workflow_state?: string | null;
  attempt?: number | null;
  submitted_at?: string | null;
}

export interface RawQuizSubmission {
  id: string;
  user_id: string;
  quiz_id: string;
  score?: number | null;
  kept_score?: number | null;
  attempt?: number | null;
  workflow_state?: string | null;
}

export interface NormalizedCell {
  studentId: string;
  itemId: string;
  itemType: 'assignment' | 'quiz';
  /** undefined = no grade yet. 0 is a real grade. */
  pointsEarned?: number;
  pointsPossible?: number;
  percentage?: number;
  status: CellStatus;
  attempt?: number;
  submissionId?: string;
}

export interface StudentTotal {
  earned: number;
  /** Sum of points possible over GRADED items only, so ungraded work doesn't drag the % down. */
  possible: number;
  percentage?: number;
  gradedCount: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const toNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Latest attempt wins (by attempt number, ties keep the first seen). */
function latestBy<T extends { attempt?: number | null }>(rows: T[], key: (r: T) => string): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    const prev = out.get(k);
    if (!prev || (r.attempt ?? 0) > (prev.attempt ?? 0)) out.set(k, r);
  }
  return out;
}

/** Quiz policy: the latest finished (scored) attempt; `kept_score` overrides `score` when set. */
export function latestQuizAttempts(rows: RawQuizSubmission[]): Map<string, RawQuizSubmission> {
  const scored = rows.filter((q) => toNum(q.kept_score ?? q.score) !== undefined);
  return latestBy(scored, (q) => `${q.user_id}-${q.quiz_id}`);
}

export function buildGradebook(input: {
  students: GradebookStudent[];
  assignments: GradebookItem[];
  quizzes: GradebookItem[];
  assignmentSubmissions: RawAssignmentSubmission[];
  quizSubmissions: RawQuizSubmission[];
}) {
  const cells: Record<string, NormalizedCell> = {};
  const subs = latestBy(input.assignmentSubmissions, (s) => `${s.user_id}-${s.assignment_id}`);
  const quizAttempts = latestQuizAttempts(input.quizSubmissions);
  const pct = (e?: number, p?: number) => (isNum(e) && isNum(p) && p > 0 ? (e / p) * 100 : undefined);

  for (const student of input.students) {
    for (const a of input.assignments) {
      const s = subs.get(`${student.id}-${a.id}`);
      const earned = toNum(s?.grade);
      const possible = toNum(a.points);
      const submitted = !!s && s.workflow_state !== 'unsubmitted' && (s.workflow_state != null || !!s.submitted_at);
      cells[`${student.id}-${a.id}`] = {
        studentId: student.id,
        itemId: a.id,
        itemType: 'assignment',
        pointsEarned: earned,
        pointsPossible: possible,
        percentage: pct(earned, possible),
        status: earned !== undefined ? 'graded' : submitted ? 'submitted' : 'missing',
        attempt: s?.attempt ?? undefined,
        submissionId: s?.id,
      };
    }
    for (const q of input.quizzes) {
      const qs = quizAttempts.get(`${student.id}-${q.id}`);
      const earned = toNum(qs?.kept_score ?? qs?.score);
      const possible = toNum(q.points);
      cells[`${student.id}-${q.id}`] = {
        studentId: student.id,
        itemId: q.id,
        itemType: 'quiz',
        pointsEarned: earned,
        pointsPossible: possible,
        percentage: pct(earned, possible),
        // pending_review = auto-scored but awaiting manual grading of some answers.
        status: !qs ? 'missing' : qs.workflow_state === 'pending_review' ? 'submitted' : 'graded',
        attempt: qs?.attempt ?? undefined,
        submissionId: qs?.id,
      };
    }
  }

  const totals: Record<string, StudentTotal> = {};
  for (const student of input.students) {
    let earned = 0, possible = 0, gradedCount = 0;
    for (const item of [...input.assignments, ...input.quizzes]) {
      const c = cells[`${student.id}-${item.id}`];
      if (c && isNum(c.pointsEarned)) {
        earned += c.pointsEarned;
        possible += c.pointsPossible ?? 0;
        gradedCount += 1;
      }
    }
    totals[student.id] = { earned, possible, gradedCount, percentage: possible > 0 ? (earned / possible) * 100 : undefined };
  }
  return { cells, totals };
}

// ---------- CSV ----------

/** Neutralise spreadsheet formulas: text starting (after whitespace/control chars) with = + - @ gets a leading quote. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (typeof value === 'number') {
    s = Number.isFinite(value) ? String(value) : '';
  } else {
    s = String(value);
    // eslint-disable-next-line no-control-regex
    if (/^[\s\x00-\x1f]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) s = `'${s}`;
  }
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

const round = (n?: number) => (isNum(n) ? Math.round(n * 100) / 100 : undefined);

export function buildGradebookCsvRows(
  students: GradebookStudent[],
  items: Array<GradebookItem & { type: 'assignment' | 'quiz' }>,
  model: ReturnType<typeof buildGradebook>,
): unknown[][] {
  const header: unknown[] = ['Student ID', 'Student', 'Email'];
  for (const i of items) {
    const label = `${i.title || (i.type === 'quiz' ? 'Quiz' : 'Assignment')} (${i.type})`;
    header.push(`${label} - earned`, `${label} - possible`, `${label} - status`);
  }
  header.push('Total earned', 'Total possible (graded items)', 'Total %');
  const rows: unknown[][] = [header];
  for (const s of students) {
    const row: unknown[] = [s.id, s.full_name, s.email || ''];
    for (const i of items) {
      const c = model.cells[`${s.id}-${i.id}`];
      row.push(c?.pointsEarned, c?.pointsPossible, c?.status ?? 'missing');
    }
    const t = model.totals[s.id];
    row.push(t?.earned ?? 0, t?.possible ?? 0, round(t?.percentage));
    rows.push(row);
  }
  return rows;
}

/** UTF-8 BOM + CRLF so Excel opens it with the right encoding. */
export function toCsv(rows: unknown[][]): string {
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
