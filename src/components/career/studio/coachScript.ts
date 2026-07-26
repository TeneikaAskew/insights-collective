import { pathwayQuestions } from '@/data/careerPathwayData';

export const COACH_NAME = 'Maya';

/** The 13 pathway questions grouped into four named acts (indices into pathwayQuestions). */
export const ACTS = [
  { name: 'Spark', start: 0, end: 0 },
  { name: 'Vision', start: 1, end: 5 },
  { name: 'Strengths', start: 6, end: 10 },
  { name: 'Priorities', start: 11, end: 12 },
] as const;

export function actIndexForQuestion(qIndex: number): number {
  const i = ACTS.findIndex((a) => qIndex >= a.start && qIndex <= a.end);
  return i === -1 ? ACTS.length - 1 : i;
}

export const INTRO_MESSAGES = [
  `Hey — I'm ${COACH_NAME}, your career coach.`,
  "Four short acts and you'll walk out with a pathway built around your answers — recommended roles, the skills to get there, and a step-by-step route. No wrong answers, just honest ones.",
];

export const WELCOME_BACK_MESSAGE =
  'Welcome back — your pathway is ready, and your action plan is on the next tab. Start over any time if your goals have shifted.';

export const RESUME_FOUND_MESSAGE =
  'One last thing: I found a resume on file. Want me to use it, or would you rather upload a fresh one?';

export const RESUME_MISSING_MESSAGE =
  'One last thing: upload your resume so I can ground the pathway in your actual experience.';

export const GENERATING_MESSAGE =
  "That's everything I need. Watch the canvas on the right — I'm sketching your pathway now.";

export const DONE_MESSAGE =
  "Done — your pathway is on the right, and it's saved to your profile. When you're ready, switch to Action plan up top.";

export const DONE_UNSAVED_MESSAGE =
  "Done — your pathway is on the right. Heads up: I couldn't save it to your profile just now, so it may not be here next visit.";

/** Short echo of the user's own words, for acknowledgments. */
export function echoOf(text: string): string {
  const words = text.trim().split(/\s+/).slice(0, 4).join(' ');
  return words.length > 34 ? `${words.slice(0, 34)}…` : words;
}

/** Acknowledgment per question index — reflect before asking the next thing. */
const ACKS: Array<(echo: string) => string> = [
  () => 'Good place to start.',
  (e) => `“${e}…” — I can picture that.`,
  () => "That's a clear horizon.",
  (e) => `“${e}” — noted.`,
  () => 'Good, that calibrates the path.',
  () => 'Worth exploring — pivots are where transferable skills earn their keep.',
  () => "Noted — that's a real edge.",
  () => 'Honest — that rules out as much as it rules in.',
  () => 'Naming it is half the routing problem.',
  () => 'That tells me a lot about the day-to-day you need.',
  () => "Self-aware — that'll show up in the plan.",
  () => 'Priorities set the weighting. Almost there.',
  () => "Perfect — that's everything I need on the questions.",
];

export function ackFor(questionIndex: number, answer: string): string {
  const fn = ACKS[questionIndex] ?? (() => 'Noted.');
  return fn(echoOf(answer));
}

/** A short beat when a new act begins (not for the first act). */
export function actIntro(actIdx: number): string | null {
  switch (actIdx) {
    case 1: return 'Act 2 — Vision. Let’s look ahead.';
    case 2: return 'Act 3 — Strengths. Now the honest mirror.';
    case 3: return 'Last act — Priorities.';
    default: return null;
  }
}

export function questionText(qIndex: number): string {
  return pathwayQuestions[qIndex]?.placeholder ?? '';
}
