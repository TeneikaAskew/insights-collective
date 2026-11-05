// ABOUTME: Contract controls for the t09-runtime job's owned loopback network: per mode, the job creates its own network,
// ABOUTME: starts the stack on it with --network-id, verifies membership and listeners BEFORE the unchanged ports check,
// ABOUTME: and removes only that network after stop. No daemon, firewall, sudo or other docker network command appears.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const ROOT = path.resolve(__dirname, '../../..');
const WF = YAML.parse(readFileSync(process.env.T09_WF_UNDER_TEST || path.join(ROOT, '.github/workflows/e2e.yml'), 'utf8'));
const STEPS = WF.jobs['t09-runtime'].steps as Array<{ name?: string; if?: string; run?: string }>;
const at = (re: RegExp) => STEPS.findIndex((s) => re.test(s.name ?? ''));

describe('t09-runtime: owned loopback-binding network per mode', () => {
  for (const [M, m] of [['OLD', 'old'], ['NEW', 'new']] as const) {
    const net = `"ic-t09-${m}-net-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"`;
    const owner = `"$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT-${m}"`;
    it(`${M}: create -> start --network-id -> verify + listeners + unchanged ports check -> stop -> remove -> leftovers`, () => {
      const prep = at(new RegExp(`^${M} - prepare workdir`));
      const create = at(new RegExp(`^${M} - create owned loopback-binding network`));
      const start = at(new RegExp(`^${M} - supabase start`));
      const ports = at(new RegExp(`^${M} - published ports loopback-only`));
      const stagePre = at(new RegExp(`^${M} - STAGE PRE`));
      const stop = at(new RegExp(`^${M} - stop`));
      const remove = at(new RegExp(`^${M} - remove owned network`));
      const left = at(new RegExp(`^${M} - nothing left behind`));
      for (const i of [prep, create, start, ports, stagePre, stop, remove, left]) expect(i).toBeGreaterThan(-1);
      expect(prep < create && create < start && start < ports && ports < stagePre && stop < remove && remove < left).toBe(true);
      expect(STEPS[create].run).toBe(`node scripts/local-stack/t09/stack-net.mjs create ${net} ${owner} | tee "$T09_EVIDENCE/${m}-net-create.txt"`);
      expect(STEPS[create].if).toBeUndefined();          // a failed create stops the mode before any start
      expect(STEPS[start].run).toContain(`supabase start --workdir "$IC_WORKDIR_${M}" --network-id ${net} -x `);
      const p = STEPS[ports].run ?? '';
      const v = p.indexOf(`stack-net.mjs verify ${net} ${owner}`), l = p.indexOf('stack-net.mjs listeners'), c = p.indexOf('stack-checks.sh ports');
      expect(v).toBeGreaterThan(-1); expect(l).toBeGreaterThan(v); expect(c).toBeGreaterThan(l);
      expect(p).toContain(`scripts/local-stack/t09/stack-checks.sh ports | tee "$T09_EVIDENCE/${m}-ports.txt"`);
      expect(STEPS[remove].if).toBe(`always() && steps.${m}_prep.outcome == 'success'`);
      expect(STEPS[remove].run).toBe(`node scripts/local-stack/t09/stack-net.mjs remove ${net} ${owner} | tee "$T09_EVIDENCE/${m}-net-remove.txt"`);
    });
  }

  it('the stack-net fake selftest runs before any stack is prepared', () => {
    expect(at(/^Stack-net selftest/)).toBeGreaterThan(-1);
    expect(at(/^Stack-net selftest/)).toBeLessThan(at(/^OLD - prepare workdir/));
  });

  it('no daemon, default, firewall, privilege or ad-hoc docker network change appears in the job', () => {
    const all = STEPS.map((s) => s.run ?? '').join('\n');
    expect(all).not.toMatch(/daemon\.json|dockerd|systemctl|iptables|nft |ufw|sudo |--privileged|sysctl/);
    expect(all).not.toMatch(/docker +network/);         // only stack-net.mjs touches networks
    expect(all.match(/--network-id/g)?.length).toBe(2);
  });

  it('every new receipt is in the staged evidence list', () => {
    const stage = STEPS.find((s) => /stage-evidence/.test(s.run ?? ''))?.run ?? '';
    for (const m of ['old', 'new']) for (const k of ['net-create', 'net-verify', 'net-remove']) expect(stage).toContain(`"$T09_EVIDENCE/${m}-${k}.txt"`);
  });
});
