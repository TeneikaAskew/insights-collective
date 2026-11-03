// ABOUTME: Receipt that binds the pinned headless shell to EVERY gradebook-journey launch: each project's launchOptions in
// ABOUTME: playwright.gradebook-roles.config.ts and the journey session-setup's chromium.launch(chromiumExecutableOption()).
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

// Lanes: journey (playwright.gradebook-roles.config.ts, output unchanged) and lesson-editor (the lesson-editor lane's own
// e2e/lesson-editor/playwright.lesson-editor.config.ts, exactly one project; its egress fixture spreads the same launchOptions).
export const LE_PROJECTS = ['lesson-editor-chromium'];
export function laneProblems(lane: string | undefined, projects: Project[]): string[] {
  if (lane !== 'lesson-editor') return [];
  return projects.map((p) => p.name ?? '?').join(',') === LE_PROJECTS.join(',') ? [] : [`lesson-editor projects are not exactly ${LE_PROJECTS.join(', ')}`];
}
const tag = (lane: string | undefined) => (lane === 'lesson-editor' ? 'LE-LAUNCH' : 'GB-LAUNCH');

async function main() {
  const lane = process.env.GB_LANE, T = tag(lane);
  let cfg: { projects?: Project[] };
  if (lane === 'journey') cfg = (await import('../../playwright.gradebook-roles.config')).default as { projects?: Project[] };
  else if (lane === 'lesson-editor') cfg = (await import('../../e2e/lesson-editor/playwright.lesson-editor.config')).default as { projects?: Project[] };
  else throw new Error('GB_LANE must be journey or lesson-editor');
  const projects = cfg.projects ?? [];
  const problems = [...bindingProblems(process.env, projects, chromiumExecutableOption()), ...laneProblems(lane, projects)];
  if (problems.length) throw new Error(problems.join('; '));
  for (const p of projects) console.log(`${T} project ${p.name} executablePath=${p.use?.launchOptions?.executablePath}`);
  console.log(`${T} session-setup executablePath=${chromiumExecutableOption().executablePath}`);
  console.log(`${T} ok: ${projects.length} projects and the setup launch bind the pinned headless shell`);
}

const isMain = process.argv[1] && /gb-launch-binding\.ts$/.test(process.argv[1]);
if (isMain) main().catch((e) => { console.log(`${tag(process.env.GB_LANE)} REFUSED: ${e instanceof Error ? e.message.split('\n')[0] : 'unexpected error'}`); process.exit(1); });
