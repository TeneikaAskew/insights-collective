// ABOUTME: Receipt that binds the pinned headless shell to EVERY gradebook-journey launch: each project's launchOptions in
// ABOUTME: playwright.gradebook-roles.config.ts and the journey session-setup's chromium.launch(chromiumExecutableOption());
// ABOUTME: with GB_LANE=lesson-editor or GB_LANE=roster-reports, the same binding for that lane's own config and launch.
//
// Run (job, after the shell pin and before any write):  GB_LANE=journey npx --no-install tsx scripts/e2e/gb-launch-binding.ts
// It loads the real config (which runs the config's own strict local-binding check) and the shared resolver the setup uses,
// and requires every executablePath to equal GB_SHELL_PATH, which must equal PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. With that
// variable set, e2e/support/chromium-executable.ts returns it verbatim, so its legacy full/system fallback is unreachable.
// Output: fixed lines plus the (non-secret) path; "GB-LAUNCH REFUSED: <reason>" and exit 1 otherwise.
import { chromiumExecutableOption } from '../../e2e/support/chromium-executable';

type Project = { name?: string; use?: { launchOptions?: { executablePath?: string } } };

export function bindingProblems(env: NodeJS.ProcessEnv, projects: Project[], setupOption: { executablePath?: string }): string[] {
  const want = env.GB_SHELL_PATH;
  const problems: string[] = [];
  if (!want) problems.push('GB_SHELL_PATH is not set (the shell pin step did not export it)');
  if (env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH !== want) problems.push('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH is not the pinned shell path');
  if (projects.length === 0) problems.push('the config declares no projects');
  for (const p of projects) {
    if (p.use?.launchOptions?.executablePath !== want) problems.push(`project ${p.name ?? '?'} would launch another browser`);
  }
  if (setupOption.executablePath !== want) problems.push('session-setup would launch another browser');
  return problems;
}

// Lanes. journey: playwright.gradebook-roles.config.ts, output unchanged. lesson-editor: the lesson-editor lane's own
// e2e/lesson-editor/playwright.lesson-editor.config.ts, exactly one project; its egress fixture spreads the same launchOptions.
// roster-reports: playwright.roster-reports.config.ts (T-15 persona acceptance), run as GB_LANE=roster-reports
// RR_SESSION_DIR=<unused absolute dir>; it prints RR-LAUNCH lines and additionally refuses RR_ERROR_INJECTION (the error
// state stays PENDING and is never bound into a run) and any project set other than exactly its three default projects.
// Every lane checks the same resolver the setup launch uses.
export const LE_PROJECTS = ['lesson-editor-chromium'];
export const ROSTER_PROJECTS = ['rr-instructor', 'rr-admin', 'rr-learner'];

// laneProblems(lane, projects) or laneProblems(lane, env, projects): the lesson-editor lane reads no environment.
export function laneProblems(lane: string | undefined, envOrProjects: NodeJS.ProcessEnv | Project[], maybeProjects?: Project[]): string[] {
  const env: NodeJS.ProcessEnv = Array.isArray(envOrProjects) ? {} : envOrProjects;
  const projects: Project[] = Array.isArray(envOrProjects) ? envOrProjects : (maybeProjects ?? []);
  const names = projects.map((p) => p.name ?? '?').join(',');
  if (lane === 'lesson-editor') return names === LE_PROJECTS.join(',') ? [] : [`lesson-editor projects are not exactly ${LE_PROJECTS.join(', ')}`];
  if (lane !== 'roster-reports') return [];
  const problems: string[] = [];
  if ((env.RR_ERROR_INJECTION ?? '') !== '') problems.push('RR_ERROR_INJECTION is set (the error state is PENDING and never part of a run)');
  if (names !== ROSTER_PROJECTS.join(',')) problems.push(`roster-reports projects are not exactly ${ROSTER_PROJECTS.join(', ')}`);
  return problems;
}

const tag = (lane: string | undefined) => (lane === 'lesson-editor' ? 'LE-LAUNCH' : lane === 'roster-reports' ? 'RR-LAUNCH' : 'GB-LAUNCH');

async function loadProjects(lane: string | undefined): Promise<Project[]> {
  if (lane === 'journey') return ((await import('../../playwright.gradebook-roles.config')).default as { projects?: Project[] }).projects ?? [];
  if (lane === 'lesson-editor') return ((await import('../../e2e/lesson-editor/playwright.lesson-editor.config')).default as { projects?: Project[] }).projects ?? [];
  if (lane === 'roster-reports') return ((await import('../../playwright.roster-reports.config')).default as { projects?: Project[] }).projects ?? [];
  throw new Error('GB_LANE must be journey, lesson-editor or roster-reports');
}

async function main() {
  const lane = process.env.GB_LANE, T = tag(lane);
  const projects = await loadProjects(lane);
  const problems = [...bindingProblems(process.env, projects, chromiumExecutableOption()), ...laneProblems(lane, process.env, projects)];
  if (problems.length) throw new Error(problems.join('; '));
  for (const p of projects) console.log(`${T} project ${p.name} executablePath=${p.use?.launchOptions?.executablePath}`);
  console.log(`${T} session-setup executablePath=${chromiumExecutableOption().executablePath}`);
  console.log(`${T} ok: ${projects.length} projects and the setup launch bind the pinned headless shell`);
}

const isMain = process.argv[1] && /gb-launch-binding\.ts$/.test(process.argv[1]);
if (isMain) main().catch((e) => { console.log(`${tag(process.env.GB_LANE)} REFUSED: ${e instanceof Error ? e.message.split('\n')[0] : 'unexpected error'}`); process.exit(1); });
