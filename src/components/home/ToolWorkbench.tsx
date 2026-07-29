// ABOUTME: Live, try-before-you-sign-up previews of three career tools.
// ABOUTME: Runs entirely client-side on transparent heuristics — no edge functions, no AI calls.
import { useEffect, useMemo, useState } from 'react';
import { Reveal } from './motion/Reveal';

/**
 * These panels deliberately do NOT call `resume-analyzer` or `assistant-ai`.
 * Those are billable edge functions and this section renders for anonymous
 * visitors, so the previews score locally against the rules below. The real
 * tools live behind signup; these exist so you can see what they do first.
 */

const WEAK_PHRASES = [
  'responsible for',
  'helped with',
  'worked on',
  'assisted',
  'duties included',
  'involved in',
];

const STRONG_VERBS = [
  'built', 'led', 'shipped', 'cut', 'grew', 'reduced',
  'automated', 'designed', 'launched', 'migrated', 'owned', 'delivered',
];

const STAR_QUESTIONS = [
  'Tell me about a time you found an error in someone else’s work.',
  'Describe a time you had to explain something technical to a non-technical audience.',
  'Tell me about a project that did not go to plan.',
  'Describe a time you had to push back on a stakeholder request.',
];

const COACH_THREADS = [
  {
    q: 'I know Excel. Can I skip SQL?',
    a: 'Not yet. SQL for Data Analysis is the prerequisite for the rest of the Analytics track. Take the placement test — score above 80% and it collapses to a short refresher.',
    cites: ['SQL for Data Analysis', 'Your roadmap'],
  },
  {
    q: 'Which project should I lead with?',
    a: 'The one with a measured result. Measured results are what survive a six-second scan; a longer list of responsibilities does not.',
    cites: ['Resume Analyzer', 'Portfolio Explorer'],
  },
  {
    q: 'How long until I can apply?',
    a: 'Analytics is the shortest doorway — 4 to 8 months at a steady pace. You can start applying once the first applied project is in your portfolio.',
    cites: ['Your roadmap', 'Analytics track'],
  },
];

const SAMPLE_WEAK =
  'Responsible for reporting and dashboards for the sales team. Helped with data quality. Worked on the migration project.';

const SAMPLE_STRONG =
  'Built the sales reporting pipeline in Python and SQL, cutting refresh time from 6 hours to 20 minutes. Led the warehouse migration for 12 dashboards with zero downtime. Grew self-serve dashboard adoption 40% in two quarters.';

type Verdict = 'good' | 'warn' | 'note';

const CHIP: Record<Verdict, string> = {
  good: 'bg-studio-goodChip text-studio-good',
  warn: 'bg-studio-warnChip text-studio-warn',
  note: 'bg-studio-lavChip text-studio-lavDeeper',
};

type Score = { label: string; value: number; tone: string };

function scoreResume(text: string): { scores: Score[]; notes: { text: string; verdict: Verdict; tag: string }[] } {
  const trimmed = text.trim();
  const low = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const numbers = trimmed.match(/\d+%?|\$[\d,]+/g) || [];
  const weak = WEAK_PHRASES.filter((w) => low.includes(w));
  const verbs = STRONG_VERBS.filter((v) => low.includes(v));
  const tech = low.match(/sql|python|dashboard|pipeline|model|etl|tableau/g) || [];

  const clamp = (n: number) => Math.max(8, Math.min(98, Math.round(n)));

  const scores: Score[] = [
    { label: 'Impact', value: clamp(numbers.length * 22 + verbs.length * 13), tone: 'bg-studio-lavDeep' },
    { label: 'Clarity', value: clamp(96 - weak.length * 19 - (words > 90 ? 12 : 0)), tone: 'bg-studio-lavDeep' },
    { label: 'Keywords', value: clamp(verbs.length * 16 + tech.length * 13), tone: 'bg-studio-teal' },
    { label: 'Specificity', value: clamp(numbers.length * 24 + (words > 18 ? 22 : 6)), tone: 'bg-studio-peachDeep' },
  ];

  const notes: { text: string; verdict: Verdict; tag: string }[] = [];
  weak.forEach((w) => notes.push({ text: `“${w}” — name the outcome instead`, verdict: 'warn', tag: 'Fix' }));
  if (!numbers.length) {
    notes.push({ text: 'No numbers anywhere. One measured result outranks three duties.', verdict: 'warn', tag: 'Add' });
  }
  if (verbs.length) {
    notes.push({ text: `Strong verbs found: ${verbs.slice(0, 4).join(', ')}`, verdict: 'good', tag: 'Good' });
  }
  if (numbers.length >= 2) {
    notes.push({ text: `${numbers.length} quantified results — that is what a reader remembers.`, verdict: 'good', tag: 'Good' });
  }
  if (!notes.length) {
    notes.push({ text: 'Nothing obvious to flag. Try a longer excerpt.', verdict: 'note', tag: 'Note' });
  }

  return { scores, notes };
}

function scoreStar(text: string) {
  const trimmed = text.trim();
  const low = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words < 8) return null;

  return [
    { key: 'Situation', ok: /\b(when|while|at |during|last |we were|the team)\b/.test(low), hint: 'Set the scene — when and where' },
    { key: 'Task', ok: /\b(needed|had to|my job|responsible|asked me|goal|target)\b/.test(low), hint: 'What was actually yours to solve' },
    { key: 'Action', ok: STRONG_VERBS.some((v) => low.includes(v)) || /\bi \w+ed\b/.test(low), hint: 'What you personally did' },
    { key: 'Result', ok: /\d/.test(trimmed) || /\b(result|so that|which meant|ended up|saved|improved|increased|reduced)\b/.test(low), hint: 'End with a number if you can' },
  ];
}

const buttonBase =
  'rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50';
const buttonSolid = `${buttonBase} bg-studio-lavDeep text-white hover:bg-studio-lavDeeper`;
const buttonGhost = `${buttonBase} border border-studio-border text-studio-ink hover:bg-studio-cardWarm`;
const textareaClass =
  'w-full rounded-xl border border-studio-border bg-studio-cardWarm text-studio-ink text-sm leading-relaxed p-3.5 min-h-[104px] resize-y focus:outline-none focus:ring-2 focus:ring-studio-lav focus:bg-studio-card';

const ToolWorkbench = () => {
  const [resume, setResume] = useState(SAMPLE_WEAK);
  const [analyzed, setAnalyzed] = useState(SAMPLE_WEAK);

  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [starResult, setStarResult] = useState<ReturnType<typeof scoreStar> | 'short' | null>(null);

  const [thread, setThread] = useState(0);

  const { scores, notes } = useMemo(() => scoreResume(analyzed), [analyzed]);

  // Bars grow from zero on first paint, so the section has something to do
  // when it scrolls into view rather than appearing already filled.
  const [barsReady, setBarsReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // items-start, so the analyzer card hugs its findings instead of stretching to
  // match the column beside it and leaving dead space under the last note.
  return (
    <div className="grid gap-5 items-start lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] mt-10">
      {/* ── Resume Analyzer ─────────────────────────────────────────── */}
      <Reveal as="div">
        <div className="studio-card p-6">
          <h3 className="font-bold text-studio-ink">Resume Analyzer</h3>
          <p className="text-sm text-studio-muted mt-1 mb-4">
            Paste a few lines. Scored here in your browser against the rules a human reviewer
            applies first.
          </p>

          <label htmlFor="wb-resume" className="sr-only">
            Resume excerpt
          </label>
          <textarea
            id="wb-resume"
            className={textareaClass}
            spellCheck={false}
            value={resume}
            onChange={(e) => setResume(e.target.value)}
          />

          <div className="flex flex-wrap gap-2.5 mt-3">
            <button type="button" className={buttonSolid} onClick={() => setAnalyzed(resume)}>
              Analyze
            </button>
            <button
              type="button"
              className={buttonGhost}
              onClick={() => {
                setResume(SAMPLE_STRONG);
                setAnalyzed(SAMPLE_STRONG);
              }}
            >
              Load a stronger sample
            </button>
          </div>

          <div className="mt-5 space-y-1.5">
            {scores.map((s) => (
              <div key={s.label} className="grid grid-cols-[88px_minmax(0,1fr)_34px] items-center gap-3">
                <span className="text-xs text-studio-muted text-right">{s.label}</span>
                <span className="h-[17px] bg-studio-track rounded-r-md overflow-hidden">
                  <span
                    className={`block h-full ${s.tone} rounded-r-md transition-[width] duration-700 ease-out`}
                    style={{ width: barsReady ? `${s.value}%` : 0 }}
                  />
                </span>
                <span className="text-xs text-studio-muted tabular-nums text-right">{s.value}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-2.5 mt-4">
            {notes.map((n, i) => (
              <div
                key={`${n.tag}-${i}`}
                className="flex justify-between items-start gap-3 rounded-xl border border-studio-border bg-studio-card px-3.5 py-2.5 text-sm"
              >
                {/* Lora italic here, as in the prototype — it separates the
                    reviewer's voice from the UI chrome around it. */}
                <span className="font-studioSerif italic font-medium text-studio-ink">{n.text}</span>
                <span className={`shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 ${CHIP[n.verdict]}`}>
                  {n.tag}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <div className="grid gap-5 content-start">
        {/* ── Interview Prep ────────────────────────────────────────── */}
        <Reveal as="div" delay={0.08}>
          <div className="studio-card-warm p-6">
            <h3 className="font-bold text-studio-ink">Interview Prep</h3>
            <p className="text-sm text-studio-muted mt-1 mb-4">{STAR_QUESTIONS[questionIndex]}</p>

            <label htmlFor="wb-star" className="sr-only">
              Your answer
            </label>
            <textarea
              id="wb-star"
              className={textareaClass}
              spellCheck={false}
              placeholder="Answer in a few sentences…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />

            <div className="flex flex-wrap gap-2.5 mt-3">
              <button
                type="button"
                className={buttonSolid}
                onClick={() => setStarResult(scoreStar(answer) ?? 'short')}
              >
                Get STAR feedback
              </button>
              <button
                type="button"
                className={buttonGhost}
                onClick={() => {
                  setQuestionIndex((i) => (i + 1) % STAR_QUESTIONS.length);
                  setAnswer('');
                  setStarResult(null);
                }}
              >
                New question
              </button>
            </div>

            {starResult === 'short' && (
              <div className="mt-3 flex justify-between items-center gap-3 rounded-xl border border-studio-border bg-studio-card px-3.5 py-2.5 text-sm">
                <span className="text-studio-ink">Give it a few more sentences and try again.</span>
                <span className={`shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 ${CHIP.warn}`}>
                  Too short
                </span>
              </div>
            )}

            {Array.isArray(starResult) && (
              <div className="grid gap-2.5 mt-3">
                {starResult.map((r) => (
                  <div
                    key={r.key}
                    className="flex justify-between items-center gap-3 rounded-xl border border-studio-border bg-studio-card px-3.5 py-2.5 text-sm"
                  >
                    <span className="text-studio-ink">
                      <b>{r.key}</b>
                      {!r.ok && <span className="text-studio-muted"> — {r.hint}</span>}
                    </span>
                    <span
                      className={`shrink-0 text-[11px] font-bold rounded-full px-2.5 py-1 ${r.ok ? CHIP.good : CHIP.warn}`}
                    >
                      {r.ok ? 'Clear' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* ── Career Coach ──────────────────────────────────────────── */}
        <Reveal as="div" delay={0.16}>
          <div className="studio-card p-6">
            <h3 className="font-bold text-studio-ink">Career Coach</h3>
            <p className="text-sm text-studio-muted mt-1 mb-4">
              Answers cite where they came from, so you can check them.
            </p>

            <div className="flex flex-wrap gap-2 mb-3.5">
              {COACH_THREADS.map((c, i) => (
                <button
                  key={c.q}
                  type="button"
                  onClick={() => setThread(i)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    thread === i
                      ? 'border-studio-lav text-studio-ink bg-studio-lavChip'
                      : 'border-studio-border text-studio-muted bg-studio-cardWarm hover:text-studio-ink hover:border-studio-lav'
                  }`}
                >
                  {c.q}
                </button>
              ))}
            </div>

            <div className="grid gap-3">
              <div className="justify-self-end max-w-[88%] rounded-xl bg-studio-lavChip px-3.5 py-2.5 text-sm font-semibold text-studio-ink">
                {COACH_THREADS[thread].q}
              </div>
              <div className="border-l-[3px] border-studio-teal pl-3.5 text-sm leading-relaxed text-studio-muted">
                {COACH_THREADS[thread].a}
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {COACH_THREADS[thread].cites.map((cite) => (
                    <span
                      key={cite}
                      className="text-[10.5px] font-bold text-studio-teal bg-studio-tealChip rounded-full px-2.5 py-1"
                    >
                      {cite}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
};

export default ToolWorkbench;
