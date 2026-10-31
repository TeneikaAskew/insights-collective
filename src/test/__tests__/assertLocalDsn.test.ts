// ABOUTME: Unit tests for the strict local-DSN parser used by every scripts/local-db entrypoint.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain ESM script without type declarations
import { assertLocalDsn, evaluateLibpqDsn } from '../../../scripts/local-db/assert-local-dsn.mjs';

const ok = (dsn: string, env = {}) => assertLocalDsn(dsn, env as NodeJS.ProcessEnv);

describe('assert-local-dsn', () => {
  it('accepts single loopback endpoints in URI and keyword form', () => {
    expect(ok('postgresql://postgres@127.0.0.1:54329/ic_snapshot').ok).toBe(true);
    expect(ok('postgresql://postgres:pw@localhost:5432/db').ok).toBe(true);
    expect(ok('postgresql://u@[::1]:5432/db').ok).toBe(true);
    expect(ok('host=127.0.0.1 port=54329 dbname=ic_snapshot user=postgres').ok).toBe(true);
    expect(ok('postgresql:///db?host=/tmp/pgsock&port=54329').ok).toBe(true);
  });

  it('redacts the password and never echoes it', () => {
    const r = ok('postgresql://postgres:TOPSECRET@127.0.0.1:5432/db');
    expect(r.ok).toBe(true);
    expect(r.redacted).toContain('password=<redacted>');
    expect(r.redacted).not.toContain('TOPSECRET');
  });

  it('refuses remote and deceptive endpoints', () => {
    const bad: Array<[string, RegExp]> = [
      ['postgresql://postgres:x@db.siuqvhscuiycvdrtiqsh.supabase.co:5432/postgres', /not loopback/],
      ['postgresql://127.0.0.1@prod.example.com/db', /not loopback/],              // loopback as USER, not host
      ['postgresql://u@localhost,prod.example.com:5432/db', /multihost/],           // libpq multihost
      ['postgresql://u@localhost/db?host=prod.example.com', /both in authority/],   // query override
      ['postgresql:///db?host=prod.example.com', /not loopback/],
      ['postgresql://u@localhost/db?hostaddr=203.0.113.9', /hostaddr/],             // DNS bypass
      ['host=localhost hostaddr=203.0.113.9 dbname=db', /hostaddr/],
      ['postgresql://u@localhost.attacker.example/db', /not loopback/],
      ['postgresql://u@%6cocalhost/db', /percent-encoding/],
      ['postgresql://u@localhost:5432/db#?host=remote.example', /'#' is refused/],      // libpq: dbname "db#", host=remote
      ['postgresql://u@localhost:5432/db#?hostaddr=203.0.113.9', /'#' is refused/],    // libpq: hostaddr honoured
      ['postgresql://u@localhost/db%3F?host=remote.example', /percent-encoding in the database/],
      ['postgresql://a@b@localhost/db', /more than one '@'/],                           // libpq: host "b@localhost"
      ['postgresql://u@localhost/db?host=localhost&host=remote.example', /host given both|duplicate/],
      ['postgresql://u@localhost/db?x=1&x=2', /duplicate|unsupported/],
      ['postgresql://u@localhost/db?=1', /malformed/],
      ['postgresql://u@localhost./db', /not loopback/],
      ['postgresql://u@127.1/db', /not loopback/],
      ['postgresql://u@[::ffff:127.0.0.1]/db', /not loopback/],
      ['postgresql://u@0.0.0.0/db', /not loopback/],
      ['postgresql://u@localhost/db?hostaddr=127.0.0.1', /hostaddr/],                   // even loopback hostaddr is refused: one endpoint source only
      ['postgresql://u@10.0.0.5/db', /not loopback/],
      ['postgresql:///db', /no host given/],                                        // PGHOST fallback
      ['service=prod', /service=/],
      ['postgresql://u@localhost/db?service=prod', /service=/],
      ['postgresql://u@localhost/db?options=-c%20search_path%3Dpublic', /options=|percent-encoding/],
      ['postgresql://u@localhost/db?options=-cfoo', /options=/],
      ['postgresql://u@LOCALHOST/db', /not loopback/],
      ['postgresql://u@localhost/db?passfile=/tmp/x', /passfile/],
      ['host=/var/run/postgresql dbname=db', /not loopback/],
      ['', /empty/],
      ['not a dsn', /does not parse/],
    ];
    for (const [dsn, why] of bad) {
      const r = ok(dsn);
      expect(r.ok, dsn).toBe(false);
      expect(r.reason, dsn).toMatch(why);
    }
  });

  it('refuses when libpq environment overrides are present', () => {
    for (const k of ['PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGPORT']) {
      const r = ok('postgresql://postgres@127.0.0.1:54329/db', { [k]: 'anything' });
      expect(r.ok, k).toBe(false);
      expect(r.reason).toContain(k);
    }
  });

  it('accepts a declared isolated project by db host or pooler user, and nothing else remote', () => {
    const ISO = 'abcdefghijklmnopqrst', PROD = 'siuqvhscuiycvdrtiqsh';
    const ev = (dsn: string, isolatedRef?: string) => evaluateLibpqDsn(dsn, { env: {}, isolatedRef, productionRef: PROD });
    expect(ev(`postgresql://postgres:x@db.${ISO}.supabase.co:5432/postgres`, ISO).ok).toBe(true);
    expect(ev(`postgresql://postgres.${ISO}:x@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`, ISO).ok).toBe(true);
    expect(ev(`postgresql://postgres:x@db.${ISO}.supabase.co:5432/postgres`).ok).toBe(false);            // not declared
    expect(ev(`postgresql://postgres:x@db.${ISO}.supabase.co:5432/postgres?hostaddr=203.0.113.9`, ISO).ok).toBe(false);
    expect(ev(`postgresql://postgres.${PROD}:x@aws-0-us-east-1.pooler.supabase.com:6543/postgres`, ISO).ok).toBe(false);
    expect(ev(`postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`, PROD).ok).toBe(false);     // isolated == production
    expect(ev(`postgresql://postgres.${ISO}:x@aws-0-eu-west-1.pooler.supabase.com.attacker.example:6543/postgres`, ISO).ok).toBe(false);
  });
});
