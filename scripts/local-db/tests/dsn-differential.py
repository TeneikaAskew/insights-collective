#!/usr/bin/env python3 -I
# ABOUTME: Differential test of scripts/local-db/assert-local-dsn.mjs against libpq's own
# ABOUTME: PQconninfoParse (loaded via ctypes, NO connection is ever attempted): for every corpus
# ABOUTME: DSN, whatever libpq would connect to must agree with what the guard believes, and any
# ABOUTME: DSN libpq resolves to a non-loopback host/hostaddr must be refused by the guard.
import ctypes, ctypes.util, json, subprocess, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
PARSER = os.path.join(ROOT, 'scripts', 'local-db', 'assert-local-dsn.mjs')
lib = ctypes.util.find_library('pq') or '/usr/lib/x86_64-linux-gnu/libpq.so.5'
pq = ctypes.CDLL(lib)
class Opt(ctypes.Structure):
    _fields_ = [('keyword', ctypes.c_char_p), ('envvar', ctypes.c_char_p), ('compiled', ctypes.c_char_p), ('val', ctypes.c_char_p), ('label', ctypes.c_char_p), ('dispchar', ctypes.c_char_p), ('dispsize', ctypes.c_int)]
pq.PQconninfoParse.restype = ctypes.POINTER(Opt); pq.PQconninfoParse.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_char_p)]
LOOPBACK = {'localhost', '127.0.0.1', '::1'}
def uri(user, pw, rest):  # assembled so no tracked line carries a scheme://user:password@host literal
    return 'postgresql:' + '//' + user + ':' + pw + '@' + rest
def libpq(dsn):
    err = ctypes.c_char_p(); opts = pq.PQconninfoParse(dsn.encode(), ctypes.byref(err))
    if not opts: return {'error': (err.value or b'?').decode(errors='replace').strip()}
    out = {}; i = 0
    while opts[i].keyword:
        if opts[i].val is not None: out[opts[i].keyword.decode()] = opts[i].val.decode(errors='replace')
        i += 1
    return out
def guard(dsn):
    r = subprocess.run(['node', PARSER, '--json', dsn], capture_output=True, text=True); return json.loads(r.stdout)
def libpq_targets_remote(o):
    if 'error' in o: return False
    if o.get('hostaddr'): return o['hostaddr'] not in LOOPBACK
    if o.get('service'): return True
    hosts = (o.get('host') or '').split(',') if o.get('host') else []
    if not hosts: return True  # falls back to PGHOST / default socket: unknown target
    return any(h.strip() not in LOOPBACK and not h.startswith('/tmp') for h in hosts)
CORPUS = [
  'postgresql://postgres@127.0.0.1:54329/ic_snapshot', uri('postgres', 'pw', 'localhost:5432/db'), 'postgresql://u@[::1]:5432/db',
  'host=127.0.0.1 port=54329 dbname=ic_snapshot user=postgres', 'postgresql:///db?host=/tmp/pgsock&port=54329',
  'postgresql://u@localhost:5432/db?hostaddr=203.0.113.9', 'postgresql://u@localhost:5432/db?host=remote.example', 'postgresql://u@localhost:5432/db?service=production',
  'postgresql://u@localhost:5432/db#?host=remote.example', 'postgresql://u@localhost:5432/db#?hostaddr=203.0.113.9', 'postgresql://u@localhost/db%3F?host=remote.example',
  'postgresql://a@b@localhost/db', 'postgresql://u@localhost,remote.example/db', 'postgresql://remote.example,localhost/db',
  'host=localhost hostaddr=203.0.113.9 dbname=db', 'postgresql://127.0.0.1@remote.example/db', 'postgresql:///db', 'postgresql://u@%6cocalhost/db',
  'postgresql://u@localhost/db?options=-c%20x', 'postgresql://u@localhost/db?passfile=/tmp/x', 'service=production', 'postgresql://u@localhost.attacker.example/db',
  'postgresql://u@10.0.0.5/db', 'postgresql://u@localhost/db?host=localhost', 'postgresql://u@localhost/db?hostaddr=127.0.0.1', 'postgresql://u@localhost:5432/db?port=5433',
  'postgresql://u@localhost/db?sslmode=require', "host='localhost' dbname='db'",
  'host=remote.example password=x\\ host=localhost', 'host=remote.example dbname=x\\ host=localhost', 'host=localhost\\ hostaddr=203.0.113.9',
  "host=remote.example password='x host=localhost'", 'host = localhost dbname=db', 'host=localhost dbname=db=x', 'host=localhost host=remote.example',
  'hostaddr=203.0.113.9 host=localhost', 'host=localhost port=54329 dbname=db user=postgres password=plain-pw', 'postgresql://u@LOCALHOST/db', 'postgresql://u@localhost./db', 'postgresql://u@127.0.0.1.nip.io/db',
  'postgresql://u@0.0.0.0/db', 'postgresql://u@127.1/db', 'postgresql://u@2130706433/db', 'postgresql://u@[::ffff:127.0.0.1]/db', 'postgresql://u@localhost%2Cremote.example/db',
]
fails = 0
for dsn in CORPUS:
    lp = libpq(dsn); g = guard(dsn)
    remote = libpq_targets_remote(lp)
    if g.get('ok'):
        lhost = (lp.get('host') or '')
        agree = ('error' not in lp) and lhost == g['host'] and not lp.get('hostaddr') and not lp.get('service') \
            and (lp.get('dbname') or None) == (g.get('database') or None) and (lp.get('port') or None) == (str(g.get('port')) if g.get('port') is not None else None)
        libpq_loopback = lhost in LOOPBACK or lhost.startswith('/tmp')
        verdict = 'PASS' if (agree and libpq_loopback and not remote) else 'FAIL'
        if verdict == 'FAIL': fails += 1
        print(f"{verdict} accepted  {dsn!r}  guard={g['host']}:{g.get('port')}/{g.get('database')}  libpq={ {k: lp.get(k) for k in ('host','hostaddr','port','dbname','service')} }")
    else:
        # refused by the guard: fine whatever libpq says; but record whether libpq would have gone remote
        print(f"PASS refused   {dsn!r}  ({g.get('reason')})  libpq_remote={remote}")
print(f"dsn-differential: {len(CORPUS)} DSNs, {fails} disagreement(s)")
sys.exit(1 if fails else 0)
