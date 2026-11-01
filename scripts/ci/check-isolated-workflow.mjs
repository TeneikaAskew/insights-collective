#!/usr/bin/env node
// ABOUTME: Structural, fail-closed policy check for the local-only E2E workflow (.github/workflows/e2e.yml). The file is PARSED as YAML
// ABOUTME: (duplicate keys refused); triggers, permissions, actions and every ${{ }} expression are checked on the tree.
//
// Why parsed: the earlier regex version accepted `contents: 'write'`, `${{ secrets['X'] }}` and
// `${{ format('{0}', secrets.X) }}`. Here permissions are compared as values, and every expression is reduced
// to its context roots, which must come from an allowlist; `secrets`, `vars` and `github.token` never do.
// `yaml` is a transitive dev dependency of this repository; if it cannot be loaded the check exits 2. The
// workflow therefore installs dependencies first, with `npm ci --ignore-scripts` so no dependency code runs
// before this check, and this check refuses any other step ahead of itself (ORDER rules below).
//
// `--executed` checks the file GitHub is running: the path comes from GITHUB_WORKFLOW_REF
// (<owner>/<repo>/<path>@<ref>) and the checked-out HEAD must equal GITHUB_WORKFLOW_SHA, so the file read from
// the workspace is the file the runner executes, whatever its name.
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const ALLOWED_ROOTS = new Set(['github', 'inputs', 'runner', 'env', 'steps', 'job']);
export const ALLOWED_FUNCTIONS = new Set(['always', 'success', 'failure', 'cancelled', 'contains', 'startsWith', 'endsWith', 'format', 'join', 'toJSON', 'fromJSON', 'hashFiles']);
export const ALLOWED_GITHUB_PROPS = new Set(['ref', 'sha', 'run_id', 'run_number', 'run_attempt', 'repository', 'workflow', 'event_name', 'job', 'actor', 'ref_name', 'workspace']);
export const ALLOWED_ACTIONS = [/^actions\/checkout@v4$/, /^actions\/setup-node@v4$/, /^actions\/upload-artifact@v4$/];
const PERMISSION_SCOPES = new Set(['actions', 'attestations', 'checks', 'contents', 'deployments', 'discussions', 'id-token', 'issues', 'models', 'packages', 'pages', 'pull-requests', 'repository-projects', 'security-events', 'statuses']);
const RUN_RULES = [
  [/\bgit\s+(push|commit)\b/, 'commits or pushes'],
  [/\bsupabase\s+link\b|--linked\b|--project-ref\b/, 'targets a hosted Supabase project'],
  [/\bdb\s+push\b/, 'pushes migrations'],
  [/\bfunctions\s+deploy\b/, 'deploys Edge Functions'],
  [/\|\|\s*(true|:|exit\s+0)\b/, 'masks a failure with an || fallback'],
  [/\.supabase\.(co|in|red)\b/, 'names a hosted Supabase host'],
];

// The policy step itself, and the only things allowed before it.
export const POLICY_STEP_RUN = /^node scripts\/ci\/check-isolated-workflow\.mjs --executed\s*$/;
export const PRE_POLICY_ACTIONS = [/^actions\/checkout@v4$/, /^actions\/setup-node@v4$/];
const PRE_POLICY_RUN_LINES = [
  /^git rev-parse HEAD HEAD\^\{tree\} \| tee tested-ids\.txt$/,
  /^git log -1 --format='%H %P' >> tested-ids\.txt$/,
  /^npm ci --ignore-scripts( --no-audit| --no-fund)*$/,
];

/** Joins backslash-continued lines, so one shell command is one entry. */
export function shellCommands(run) {
  return run.replace(/\\\n/g, ' ').split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Problems with the steps that run before the policy check, and with unbounded curl calls. */
export function checkOrderAndBounds(name, steps) {
  const problems = [];
  const at = steps.findIndex((st) => typeof st?.run === 'string' && POLICY_STEP_RUN.test(st.run.trim()));
  if (at < 0) problems.push(`order: jobs.${name} has no \`node scripts/ci/check-isolated-workflow.mjs --executed\` step`);
  for (const [i, st] of steps.entries()) {
    if (at >= 0 && i < at) {
      if (st?.uses !== undefined) {
        if (!PRE_POLICY_ACTIONS.some((re) => re.test(String(st.uses)))) problems.push(`order: jobs.${name}.steps[${i}] (${st.uses}) runs before the policy check`);
      } else if (typeof st?.run === 'string') {
        for (const line of shellCommands(st.run)) if (!PRE_POLICY_RUN_LINES.some((re) => re.test(line))) problems.push(`order: jobs.${name}.steps[${i}] runs \`${line.slice(0, 60)}\` before the policy check`);
      } else problems.push(`order: jobs.${name}.steps[${i}] runs before the policy check`);
    }
    if (typeof st?.run === 'string') {
      for (const cmd of shellCommands(st.run)) {
        if (!/(^|[^\w-])curl\s/.test(cmd)) continue;
        if (!/--connect-timeout\s+\S+/.test(cmd) || !/--max-time\s+\S+/.test(cmd)) problems.push(`curl: jobs.${name}.steps[${i}] has a curl without --connect-timeout and --max-time`);
      }
    }
  }
  return problems;
}

/** Context roots used by one expression body (string literals removed first). */
export function expressionRoots(expr) {
  const body = expr.replace(/'(?:[^']|'')*'/g, "''");
  const roots = [];
  // The call parenthesis is a lookahead, not consumed, so a context directly inside a call (toJSON(secrets))
  // still sees '(' as its preceding character.
  const re = /(^|[^\w.\]-])([A-Za-z_][\w-]*)(?=(\s*\()?)/g;
  let m;
  while ((m = re.exec(body))) {
    const [, , name, call] = m;
    if (call) { roots.push({ kind: 'fn', name }); continue; }
    if (['true', 'false', 'null'].includes(name)) continue;
    const rest = body.slice(m.index + m[0].length);
    const prop = rest.match(/^\s*(?:\.\s*([\w-]+)|\[\s*''\s*\]|\[)/);
    roots.push({ kind: 'ctx', name, prop: prop ? (prop[1] ?? '[]') : null });
  }
  return roots;
}

function* walk(node, at = []) {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) yield* walk(node[i], [...at, i]); return; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { yield { at: [...at, `{key}`], value: k }; yield* walk(v, [...at, k]); }
    return;
  }
  yield { at, value: node };
}

function checkPermissions(perm, where, allowEmptyOnly, problems) {
  if (allowEmptyOnly) {
    if (!(perm && typeof perm === 'object' && !Array.isArray(perm) && Object.keys(perm).length === 0)) problems.push(`top-permissions: ${where} must be {}`);
    return;
  }
  if (perm === undefined) { problems.push(`job-permissions: ${where} must declare permissions`); return; }
  if (!perm || typeof perm !== 'object' || Array.isArray(perm)) { problems.push(`job-permissions: ${where} must be a map (got ${JSON.stringify(perm)})`); return; }
  for (const [scope, level] of Object.entries(perm)) {
    if (!PERMISSION_SCOPES.has(scope)) problems.push(`job-permissions: unknown scope ${scope} in ${where}`);
    if (level !== 'read' && level !== 'none') problems.push(`write-perm: ${where}.${scope} is ${JSON.stringify(level)}`);
  }
}

export function checkWorkflowDoc(doc, rawText, prodRef) {
  const problems = [];
  if (prodRef && rawText.includes(prodRef)) problems.push('prod-ref: names the production project');
  if (!doc || typeof doc !== 'object') return [...problems, 'parse: not a mapping'];
  const on = doc.on;
  const triggers = on && typeof on === 'object' && !Array.isArray(on) ? Object.keys(on) : [String(on)];
  if (triggers.length !== 1 || triggers[0] !== 'workflow_dispatch') problems.push(`triggers: only workflow_dispatch is allowed (found: ${triggers.join(', ')})`);
  checkPermissions(doc.permissions, 'permissions', true, problems);
  const jobs = doc.jobs && typeof doc.jobs === 'object' ? doc.jobs : {};
  if (Object.keys(jobs).length === 0) problems.push('jobs: none');
  for (const [name, job] of Object.entries(jobs)) {
    checkPermissions(job?.permissions, `jobs.${name}.permissions`, false, problems);
    if (job?.secrets !== undefined) problems.push(`secrets: jobs.${name} passes secrets`);
    if (job?.uses !== undefined) problems.push(`uses: jobs.${name} calls a reusable workflow`);
    if (job?.container !== undefined || job?.services !== undefined) problems.push(`container: jobs.${name} declares containers/services`);
    problems.push(...checkOrderAndBounds(name, Array.isArray(job?.steps) ? job.steps : []));
    for (const [i, step] of (Array.isArray(job?.steps) ? job.steps : []).entries()) {
      if (step?.uses !== undefined && !ALLOWED_ACTIONS.some((re) => re.test(String(step.uses)))) problems.push(`action: jobs.${name}.steps[${i}] uses ${step.uses}`);
      if (typeof step?.run === 'string') for (const [re, msg] of RUN_RULES) if (re.test(step.run)) problems.push(`run: jobs.${name}.steps[${i}] ${msg}`);
    }
  }
  for (const { at, value } of walk(doc)) {
    if (typeof value !== 'string') continue;
    for (const m of value.matchAll(/\$\{\{([\s\S]*?)\}\}/g)) {
      for (const r of expressionRoots(m[1])) {
        const where = at.join('.');
        if (r.kind === 'fn') { if (!ALLOWED_FUNCTIONS.has(r.name)) problems.push(`expression: function ${r.name}() at ${where}`); continue; }
        if (r.name === 'secrets') { problems.push(`secrets: expression at ${where}`); continue; }
        if (r.name === 'vars') { problems.push(`vars: expression at ${where}`); continue; }
        if (!ALLOWED_ROOTS.has(r.name)) { problems.push(`expression: context ${r.name} at ${where}`); continue; }
        if (r.name === 'github' && !ALLOWED_GITHUB_PROPS.has(r.prop ?? '')) problems.push(`expression: github.${r.prop ?? '?'} at ${where}`);
      }
    }
  }
  return problems;
}

export async function checkWorkflowText(text, prodRef) {
  let YAML;
  try { YAML = await import('yaml'); } catch { return ['parser: the yaml package cannot be loaded']; }
  let doc;
  try { doc = YAML.parse(text, { uniqueKeys: true, schema: 'core' }); } catch (e) { return [`parse: ${e.message.split('\n')[0]}`]; }
  return checkWorkflowDoc(doc, text, prodRef);
}

/**
 * Resolves the executed workflow file from the runner's environment. Returns { file } or { error }.
 * GITHUB_WORKFLOW_REF = <owner>/<repo>/.github/workflows/<name>.yml@<ref>; HEAD must be GITHUB_WORKFLOW_SHA.
 */
export function resolveExecutedWorkflow(env, head, exists = existsSync, isLink = (f) => lstatSync(f).isSymbolicLink()) {
  const ref = env.GITHUB_WORKFLOW_REF, repo = env.GITHUB_REPOSITORY, sha = env.GITHUB_WORKFLOW_SHA;
  if (!ref || !repo || !sha) return { error: 'GITHUB_WORKFLOW_REF, GITHUB_REPOSITORY and GITHUB_WORKFLOW_SHA must all be set' };
  const prefix = `${repo}/`;
  const atIdx = ref.lastIndexOf('@');
  if (!ref.startsWith(prefix) || atIdx <= prefix.length) return { error: `GITHUB_WORKFLOW_REF is not <repo>/<path>@<ref>: ${ref}` };
  const file = ref.slice(prefix.length, atIdx);
  if (!/^\.github\/workflows\/[A-Za-z0-9._-]+\.ya?ml$/.test(file) || file.includes('..')) return { error: `unexpected workflow path: ${file}` };
  if (!/^[0-9a-f]{40}$/.test(sha) || head !== sha) return { error: `checked-out HEAD ${head} is not the executed workflow commit ${sha}` };
  if (!exists(file)) return { error: `executed workflow ${file} is not in the checkout` };
  if (isLink(file)) return { error: `executed workflow ${file} is a symlink` };
  return { file };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let file = process.argv[2];
  if (file === '--executed') {
    let head = '';
    try { head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* reported below */ }
    const r = resolveExecutedWorkflow(process.env, head);
    if (r.error) { console.error(`executed workflow: ${r.error}`); process.exit(2); }
    file = r.file;
    console.log(`checking executed workflow ${file} at ${head}`);
  }
  if (!file) { console.error('usage: check-isolated-workflow.mjs <workflow.yml> | --executed'); process.exit(2); }
  let text, toml;
  try { text = readFileSync(file, 'utf8'); toml = readFileSync(path.resolve(HERE, '../../supabase/config.toml'), 'utf8'); }
  catch { console.error('workflow or config.toml cannot be read'); process.exit(2); }
  const ref = (toml.match(/^\s*project_id\s*=\s*"([a-z0-9]+)"/m) || [])[1];
  if (!ref) { console.error('deny identity (project_id) not found'); process.exit(2); }
  const problems = await checkWorkflowText(text, ref);
  if (problems.some((p) => p.startsWith('parser:'))) { console.error(problems.join('\n')); process.exit(2); }
  if (problems.length) { for (const p of problems) console.error(`refused: ${p}`); process.exit(1); }
  console.log('isolated workflow policy: ok');
}
