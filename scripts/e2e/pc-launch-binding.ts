// ABOUTME: Receipt that binds the pinned headless shell to EVERY public-catalog launch: each project's launchOptions in
// ABOUTME: playwright.public-catalog.config.ts. Reuses the qualified bindingProblems() from gb-launch-binding.ts unchanged.
//
// Run (job, after the shell pin, before any write):
//   PUBLIC_ACCEPT_LIST_ONLY=1 npx --no-install tsx scripts/e2e/pc-launch-binding.ts --list
// The config only skips its runtime guards in its own list-only mode (it refuses PUBLIC_ACCEPT_LIST_ONLY without --list), so
// this loads the real config, projects and launch options without any stack proof. The lane has no separate setup launch,
// so the shared resolver's own option stands in for it. Output: fixed lines; "PC-LAUNCH REFUSED: <reason>" and exit 1.
import { chromiumExecutableOption } from '../../e2e/support/chromium-executable';
import { bindingProblems } from './gb-launch-binding';

type Project = { name?: string; use?: { launchOptions?: { executablePath?: string } } };

async function main() {
  if (process.env.PUBLIC_ACCEPT_LIST_ONLY !== '1' || !process.argv.includes('--list')) throw new Error('list-only mode required');
  const cfg = (await import('../../playwright.public-catalog.config')).default as { projects?: Project[] };
  const projects = cfg.projects ?? [];
  const problems = bindingProblems({ ...process.env, GB_SHELL_PATH: process.env.PC_SHELL_PATH }, projects, chromiumExecutableOption());
  if (problems.length) throw new Error(problems.join('; ').replace(/GB_SHELL_PATH/g, 'PC_SHELL_PATH').replace('session-setup', 'shared resolver'));
  for (const p of projects) console.log(`PC-LAUNCH project ${p.name} executablePath=${p.use?.launchOptions?.executablePath}`);
  console.log(`PC-LAUNCH ok: ${projects.length} projects bind the pinned headless shell`);
}

const isMain = process.argv[1] && /pc-launch-binding\.ts$/.test(process.argv[1]);
if (isMain) main().catch((e) => { console.log(`PC-LAUNCH REFUSED: ${e instanceof Error ? e.message.split('\n')[0] : 'unexpected error'}`); process.exit(1); });
