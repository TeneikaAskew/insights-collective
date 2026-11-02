#!/usr/bin/env bash
# ABOUTME: MOCKED readiness self-test wrapper: one loopback stand-in serves a learn page whose script makes the app's
# ABOUTME: course GET (200 for the ready id, 406 PGRST116 otherwise), renders the item heading and player, and navigates in-app.
set -u
HERE="$(cd "$(dirname "$0")/../../../.." && pwd)"
T=$(mktemp -d); P1=; trap '[ -n "$P1" ] && kill $P1 2>/dev/null; rm -rf "$T"' EXIT
PORT=$((55900 + RANDOM % 90))
cat > "$T/server.mjs" <<'JS'
import http from 'node:http';
const OK = '9c000000-0000-4000-8000-000000000001';
// Item titles exactly as the fixture names them (content_items.title = 'QLC ' || title).
const page = `<!doctype html><title>learn</title><div id="root"></div><script>
const TITLES = { '9c002601-0000-4000-8000-000000000000': 'QLC T62 allowed control',
  '9c001d01-0000-4000-8000-000000000000': 'QLC R3 slow start A', '9c001e01-0000-4000-8000-000000000000': 'QLC R3 slow start B' };
const root = document.getElementById('root');
const parts = () => location.pathname.split('/');
function player(item, state) {
  const nav = Object.keys(TITLES).map((id) => '<a href="#" data-go="' + id + '">' + TITLES[id] + '</a>').join(' ');
  root.innerHTML = '<nav>' + nav + '</nav><h1>' + TITLES[item] + '</h1>' + (state === 'loading'
    ? '<div data-testid="quiz-player-loading">Loading</div>'
    : state === 'empty' ? '<div data-testid="quiz-player-empty">No questions</div>'
    : '<div data-testid="quiz-player-active"><label><input type="radio" name="q">Four</label></div>');
}
// In-app navigation like the router: URL first, then one render with the new heading and a fresh (loading) player.
document.addEventListener('click', (e) => {
  const id = e.target && e.target.getAttribute && e.target.getAttribute('data-go'); if (!id) return; e.preventDefault();
  const p = parts(); p[5] = id; history.pushState({}, '', p.join('/'));
  player(id, 'loading'); setTimeout(() => player(id, 'active'), 300);
});
const c = parts()[2]; const empty = location.search.includes('empty=1');
fetch('/rest/v1/courses?select=id%2Ctitle&id=eq.' + c, { headers: { accept: 'application/vnd.pgrst.object+json' } }).then((r) => {
  if (r.status !== 200) { root.innerHTML = '<h1>Course not found</h1><a href="/courses">Back to courses</a>'; return; }
  player(parts()[5], empty ? 'empty' : 'active');
});
</script>`;
http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/rest/v1/courses') {
    const id = (u.searchParams.get('id') || '').replace(/^eq\./, '');
    if (id === OK) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id, title: 'QLC' })); }
    res.writeHead(406, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ code: 'PGRST116', details: 'The result contains 0 rows secret-body-marker', message: 'x' }));
  }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(page);
}).listen(Number(process.argv[2]), '127.0.0.1');
JS
node "$T/server.mjs" "$PORT" & P1=$!
for i in $(seq 1 25); do curl -s -o /dev/null --noproxy '*' --max-time 1 "http://127.0.0.1:$PORT/" && break; sleep 0.2; done
cd "$HERE" && QLC_READINESS_BASE="http://127.0.0.1:$PORT" QLC_READINESS_OUT="$T" \
  npx --no-install playwright test -c scripts/local-stack/quiz-lifecycle/tests/playwright.readiness-selftest.config.ts
rc=$?; echo "== MOCKED readiness-selftest: exit $rc (loopback stand-in; not a stack, not acceptance)"; exit $rc
