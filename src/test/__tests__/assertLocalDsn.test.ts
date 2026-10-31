// ABOUTME: Unit tests for the strict local-DSN parser used by every scripts/local-db entrypoint.
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain ESM script without type declarations
import { assertLocalDsn, evaluateLibpqDsn } from '../../../scripts/local-db/assert-local-dsn.mjs';

const ok = (dsn: string, env = {}) => assertLocalDsn(dsn, env as NodeJS.ProcessEnv);
// Credential-bearing test DSNs are assembled from parts so no tracked line carries a
// `scheme://user:password@host` literal: the repository secret scan (TruffleHog in security.yml) reports that
// shape even for one-letter placeholder passwords, and a flagged commit range stays flagged for the life of the
// branch. src/test/__tests__/noCredentialShapedLiterals.test.ts enforces this for every tracked file.
const uri = (user: string, pw: string, rest: string) => ['postgresql:', '//', user, ':', pw, '@', rest].join('');

describe('assert-local-dsn', () => {
  it('accepts single loopback endpoints in URI and keyword form', () => {
    expect(ok('postgresql://postgres@127.0.0.1:54329/ic_snapshot').ok).toBe(true);
    expect(ok(uri('postgres', 'pw', 'localhost:5432/db')).ok).toBe(true);
    expect(ok('postgresql://u@[::1]:5432/db').ok).toBe(true);
    expect(ok('host=127.0.0.1 port=54329 dbname=ic_snapshot user=postgres').ok).toBe(true);
    expect(ok('postgresql:///db?host=/tmp/pgsock&port=54329').ok).toBe(true);
  });

  it('redacts the password and never echoes it', () => {
    const r = ok(uri('postgres', 'TOPSECRET', '127.0.0.1:5432/db'));
    expect(r.ok).toBe(true);
    expect(r.redacted).toContain('password=<redacted>');
    expect(r.redacted).not.toContain('TOPSECRET');
  });

  it('refuses remote and deceptive endpoints', () => {
    const bad: Array<[string, RegExp]> = [
      [uri('postgres', 'x', 'db.siuqvhscuiycvdrtiqsh.supabase.co:5432/postgres'), /not loopback/],
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
      // keyword-form escapes (libpq: backslash escapes the next char even unquoted; quotes span spaces)
      ['host=remote.example password=x\\ host=localhost', /quotes or backslashes/],  // libpq: host=remote.example, password "x host=localhost"
      ['host=remote.example dbname=x\\ host=localhost', /quotes or backslashes/],
      ['host=localhost\\ hostaddr=203.0.113.9', /quotes or backslashes/],
      ["host=remote.example password='x host=localhost'", /quotes or backslashes/],
      ['host = localhost dbname=db', /not a plain key=value/],
      ['host=localhost dbname=db=x', /not a plain key=value/],
      ['host=localhost host=remote.example', /duplicate keyword/],
      ['hostaddr=203.0.113.9 host=localhost', /hostaddr/],
      ['host=localhost foo=bar', /unsupported connection parameter/],
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
      ['not a dsn', /does not parse|not a plain key=value/],
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
    expect(ev(uri(`postgres`, `x`, `db.${ISO}.supabase.co:5432/postgres`), ISO).ok).toBe(true);
    expect(ev(uri(`postgres.${ISO}`, `x`, `aws-0-eu-west-1.pooler.supabase.com:6543/postgres`), ISO).ok).toBe(true);
    expect(ev(uri(`postgres`, `x`, `db.${ISO}.supabase.co:5432/postgres`)).ok).toBe(false);            // not declared
    expect(ev(uri(`postgres`, `x`, `db.${ISO}.supabase.co:5432/postgres?hostaddr=203.0.113.9`), ISO).ok).toBe(false);
    expect(ev(uri(`postgres.${PROD}`, `x`, `aws-0-us-east-1.pooler.supabase.com:6543/postgres`), ISO).ok).toBe(false);
    expect(ev(uri(`postgres`, `x`, `db.${PROD}.supabase.co:5432/postgres`), PROD).ok).toBe(false);     // isolated == production
    expect(ev(uri(`postgres.${ISO}`, `x`, `aws-0-eu-west-1.pooler.supabase.com.attacker.example:6543/postgres`), ISO).ok).toBe(false);
  });

  it('never echoes a credential in a refusal reason or a redacted summary', () => {
    const S = 'SYNTHETIC_SECRET!';
    const inputs = [
      `host=localhost password=${S}`,                               // invalid keyword value → refused
      `host=remote.example password=${S}x host=localhost`,          // refused by host rule
      uri(`u`, `${S}`, `remote.example/db`),                      // URI, refused by host rule
      uri(`u`, `${S}`, `localhost,remote.example/db`),            // multihost
      uri(`u`, `${S}`, `localhost/db?hostaddr=203.0.113.9`),      // hostaddr
      uri(`postgres.abc`, `${S}`, `aws-0-eu-west-1.pooler.supabase.com:6543/postgres`), // pooler, no isolated ref
      `postgresql://${S}@remote.example/db`,                        // secret as user name
      `host=localhost user=${S}`,                                   // '!' makes it an invalid token
    ];
    for (const dsn of inputs) {
      const r = ok(dsn);
      expect(JSON.stringify(r), dsn).not.toContain(S);
      const e = evaluateLibpqDsn(dsn, { env: {}, isolatedRef: 'abcdefghijklmnopqrst', productionRef: 'siuqvhscuiycvdrtiqsh' });
      expect(JSON.stringify(e), dsn).not.toContain(S);
    }
    const accepted = ok(uri(`u`, `${S}`, `localhost/db`));
    expect(accepted.ok).toBe(true);
    expect(JSON.stringify(accepted)).not.toContain(S);
  });
});
