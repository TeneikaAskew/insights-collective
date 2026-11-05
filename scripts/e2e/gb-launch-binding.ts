// ABOUTME: Receipt that binds the pinned headless shell to EVERY gradebook-journey launch: each project's launchOptions in
// ABOUTME: playwright.gradebook-roles.config.ts and the journey session-setup's chromium.launch(chromiumExecutableOption());
// ABOUTME: with GB_LANE=builder-authoring (or its K1-only run, builder-authoring-k1), the same binding for that config and setup.
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
// builder-authoring (WP-08 acceptance): playwright.builder-authoring.config.ts, run as GB_LANE=builder-authoring
// BA_SESSION_DIR=<unused abs dir> BA_RUN_DIR=<unused abs dir> BA_NONCE=<16 hex>; prints BA-LAUNCH lines and refuses any
// project set other than exactly its three viewport projects.
// builder-authoring-k1 (T-18 K1-only copy run): playwright.builder-authoring-k1.config.ts, same env plus BA_SUITE=k1 (set by
// run.sh alone); the same three projects, each depending on the one before, retries 0, and testMatch exactly copy.spec.ts.
// Every lane checks the same resolver the setup launch uses.
export const LE_PROJECTS = ['lesson-editor-chromium'];
export const BUILDER_PROJECTS = ['ba-1440', 'ba-768', 'ba-390'];
type Config = { projects?: (Project & { dependencies?: string[] })[]; testMatch?: unknown; retries?: number };

// laneProblems(lane, projects) or laneProblems(lane, env, projects, config): the lesson-editor lane reads no environment.
export function laneProblems(lane: string | undefined, envOrProjects: NodeJS.ProcessEnv | Project[], maybeProjects?: Project[], config: Config = {}): string[] {
  const env: NodeJS.ProcessEnv = Array.isArray(envOrProjects) ? {} : envOrProjects;
  const projects: Project[] = Array.isArray(envOrProjects) ? envOrProjects : (maybeProjects ?? []);
  const names = projects.map((p) => p.name ?? '?').join(',');
  if (lane === 'lesson-editor') return names === LE_PROJECTS.join(',') ? [] : [`lesson-editor projects are not exactly ${LE_PROJECTS.join(', ')}`];
  if (lane !== 'builder-authoring' && lane !== 'builder-authoring-k1') return [];
  const out = names === BUILDER_PROJECTS.join(',') ? [] : [`builder-authoring projects are not exactly ${BUILDER_PROJECTS.join(', ')}`];
  if (lane === 'builder-authoring-k1') {
    if (env.BA_SUITE !== 'k1') out.push('the K1-only lane needs BA_SUITE=k1');
    if (JSON.stringify(config.testMatch) !== JSON.stringify(['copy.spec.ts'])) out.push('the K1-only config does not select exactly copy.spec.ts');
    if (config.retries !== 0) out.push('the K1-only config allows retries');
    const deps = (config.projects ?? []).map((p) => JSON.stringify(p.dependencies ?? [])).join(';');
    if (deps !== '[];["ba-1440"];["ba-768"]') out.push('the K1-only projects are not ordered ba-1440, ba-768, ba-390');
  } else if (env.BA_SUITE !== undefined) out.push('the baseline lane must not carry BA_SUITE');
  return out;
}

const tag = (lane: string | undefined) =>
  lane === 'lesson-editor' ? 'LE-LAUNCH' : lane === 'builder-authoring' ? 'BA-LAUNCH' : lane === 'builder-authoring-k1' ? 'BA-K1-LAUNCH' : 'GB-LAUNCH';

async function loadConfig(lane: string | undefined): Promise<Config> {
  if (lane === 'journey') return (await import('../../playwright.gradebook-roles.config')).default as Config;
  if (lane === 'lesson-editor') return (await import('../../e2e/lesson-editor/playwright.lesson-editor.config')).default as Config;
  if (lane === 'builder-authoring') return (await import('../../playwright.builder-authoring.config')).default as Config;
  if (lane === 'builder-authoring-k1') return (await import('../../playwright.builder-authoring-k1.config')).default as Config;
  throw new Error('GB_LANE must be journey, lesson-editor, builder-authoring or builder-authoring-k1');
}

async function main() {
  const lane = process.env.GB_LANE, T = tag(lane);
  const config = await loadConfig(lane);
  const projects = config.projects ?? [];
  const problems = [...bindingProblems(process.env, projects, chromiumExecutableOption()), ...laneProblems(lane, process.env, projects, config)];
  if (problems.length) throw new Error(problems.join('; '));
  for (const p of projects) console.log(`${T} project ${p.name} executablePath=${p.use?.launchOptions?.executablePath}`);
  console.log(`${T} session-setup executablePath=${chromiumExecutableOption().executablePath}`);
  console.log(`${T} ok: ${projects.length} projects and the setup launch bind the pinned headless shell`);
}

const isMain = process.argv[1] && /gb-launch-binding\.ts$/.test(process.argv[1]);
if (isMain) main().catch((e) => { console.log(`${tag(process.env.GB_LANE)} REFUSED: ${e instanceof Error ? e.message.split('\n')[0] : 'unexpected error'}`); process.exit(1); });
