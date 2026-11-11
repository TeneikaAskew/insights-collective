#!/usr/bin/env node
// ABOUTME: Job-owned DUMMY nonce endpoint for the isolation probe: a 127.0.0.1 HTTP server that only returns a random nonce,
// ABOUTME: bridged to a unix socket that the container sees read-only. No stack, credential or real service behind it.
//
// Usage: host-endpoint.mjs <sock dir> <control dir>
//   sock dir (later bound read-only into the container): writes nonce, hostport, and listens on api.sock
//   control dir (host-owned, NEVER mounted): writes ready (pid starttime port) and, on SIGTERM, final (accepted open)
// It prints nothing. Every connection is tracked; SIGTERM closes both listeners, destroys every open socket, records the
// counts, and exits 0. Any failure exits non-zero with no output. Writers (disclosed): the five files named above.
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';

const [sockDir, ctlDir] = process.argv.slice(2);
if (!sockDir || !ctlDir || !path.isAbsolute(sockDir) || !path.isAbsolute(ctlDir)) process.exit(2);
const W = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW;
const writeNew = (p, text, mode = 0o600) => { const fd = fs.openSync(p, W, mode); try { fs.writeSync(fd, text); } finally { fs.closeSync(fd); } };
const starttime = () => { const s = fs.readFileSync('/proc/self/stat', 'utf8'); return s.slice(s.lastIndexOf(')') + 2).split(' ')[19]; };

const nonce = crypto.randomBytes(16).toString('hex');
const open = new Set();
let accepted = 0;
const track = (s) => { accepted++; open.add(s); s.on('close', () => open.delete(s)); s.on('error', () => s.destroy()); };

const web = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/plain', Connection: 'close' }).end(`${nonce}\n`); });
web.on('connection', track);
const bridge = net.createServer((c) => {
  track(c);
  const u = net.connect({ host: '127.0.0.1', port: web.address().port });
  track(u);
  c.pipe(u); u.pipe(c);
  const kill = () => { c.destroy(); u.destroy(); };
  c.on('close', kill); u.on('close', kill);
});

web.listen(0, '127.0.0.1', () => {
  const port = web.address().port;
  bridge.listen(path.join(sockDir, 'api.sock'), () => {
    try {
      writeNew(path.join(sockDir, 'nonce'), `${nonce}\n`, 0o644);
      writeNew(path.join(sockDir, 'hostport'), `${port}\n`, 0o644);
      writeNew(path.join(ctlDir, 'ready'), `${process.pid} ${starttime()} ${port}\n`);
    } catch { process.exit(3); }
  });
});
web.on('error', () => process.exit(4));
bridge.on('error', () => process.exit(4));

process.on('SIGTERM', () => {
  web.close(); bridge.close();
  for (const s of open) s.destroy();
  setTimeout(() => {
    try { writeNew(path.join(ctlDir, 'final'), `${accepted} ${open.size}\n`); } catch { process.exit(5); }
    process.exit(0);
  }, 200);
});
