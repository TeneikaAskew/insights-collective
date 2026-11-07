#!/usr/bin/env node
// ABOUTME: Diagnostic only (dispatch job lesson-editor-crash-diag): runs crash-diag-inner.mjs in the built lane image under the
// ABOUTME: lane's own container security settings, once per variant, and on the runner host as a baseline. Prints DIAG lines.
//
//   crash-diag.mjs <ctl dir with image.id> <repo> <headless shell abs path>
//
// Variants: LANE (exactly the lane's rootfs, no fonts), FONTS (the same plus the host's /etc/fonts and /usr/share/fonts bound
// read-only), NOGPU (no fonts, --disable-gpu), FONTS_NOGPU, and HOST (no container). Dummy pages only; no stack or secret.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { LANE_LIMITS, LANE_NODE, laneTmpfsSpec } from './contract.mjs';

const [ctl, repo, shell] = process.argv.slice(2);
const image = fs.readFileSync(path.join(ctl, 'image.id'), 'utf8').trim();
const uid = process.getuid(), gid = process.getgid();
const seccomp = path.join(repo, 'scripts/e2e/le-iso/seccomp/chromium147.json');
const inner = path.join(repo, 'scripts/e2e/le-lane/crash-diag-inner.mjs');
const fontBinds = ['/etc/fonts', '/usr/share/fonts', '/usr/share/fontconfig'].filter((p) => fs.existsSync(p)).flatMap((p) => ['-v', `${p}:${p}:ro,rprivate`]);

const dockerArgs = (variant, binds, extra) => ['run', '--rm',
  '--user', `${uid}:${gid}`, '--network', 'none', '--ipc', 'private', '--cgroupns', 'private',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--security-opt', `seccomp=${seccomp}`,
  '--read-only', '--tmpfs', `/tmp:${laneTmpfsSpec(uid, gid)}`, '--restart', 'no', '--init',
  '--cpus', String(LANE_LIMITS.NanoCpus / 1e9), '--memory', String(LANE_LIMITS.Memory), '--memory-swap', String(LANE_LIMITS.MemorySwap),
  '--pids-limit', String(LANE_LIMITS.PidsLimit), '--shm-size', String(LANE_LIMITS.ShmSize),
  '--workdir', repo, '-v', `${repo}:${repo}:ro,rprivate`, ...binds,
  image, LANE_NODE, inner, shell, variant, ...extra];

const run = (label, bin, args) => {
  console.log(`DIAG ${label} BEGIN`);
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 240_000, maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(r.stdout ?? '');
  for (const l of (r.stderr ?? '').split('\n').filter(Boolean).slice(0, 80)) console.log(`DIAG ${label} OUTER_STDERR ${l.slice(0, 400)}`);
  console.log(`DIAG ${label} END status=${r.status} signal=${r.signal} error=${r.error?.code ?? 'NONE'}`);
};

run('HOST', process.execPath, [inner, shell, 'HOST']);
run('LANE', 'docker', dockerArgs('LANE', [], []));
run('FONTS', 'docker', dockerArgs('FONTS', fontBinds, []));
run('NOGPU', 'docker', dockerArgs('NOGPU', [], ['--disable-gpu']));
run('FONTS_NOGPU', 'docker', dockerArgs('FONTS_NOGPU', fontBinds, ['--disable-gpu']));
