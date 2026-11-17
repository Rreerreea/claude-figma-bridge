// Claude Figma Bridge — local relay between Claude Code and a Figma development plugin.
//
//   Claude  --POST /run (x-token, x-file?)-->  server  <--GET /next?file=<name>--  plugin (in a Figma file)
//   Claude  <------------- result ------------  server  <--POST /result-----------  plugin
//
// - Listens on 127.0.0.1 and ::1 only. A random token is written to .token next to this file on every start;
//   /run without that token is refused, so only processes on this computer that can read the file may send code.
// - A job may target one Figma file (header x-file, percent-encoded file name). Such a job is handed only to a plugin
//   window whose file has that name. Jobs without x-file go to whichever plugin polls first.
// - Request bodies are read as UTF-8 strings (multi-byte characters split across chunks stay intact).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.FIGMA_BRIDGE_PORT || 7787);
const JOB_TIMEOUT_MS = Number(process.env.FIGMA_BRIDGE_TIMEOUT_MS || 10 * 60 * 1000);
const TOKEN = crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(__dirname, '.token'), TOKEN, { mode: 0o600 });

const queue = [];             // { id, code, file }
const waiters = new Map();    // id -> http response of /run
const clients = new Map();    // file name -> last poll time
let seq = 0;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

function send(res, code, obj, extraHeaders) {
  res.writeHead(code, Object.assign({ 'content-type': 'application/json; charset=utf-8' }, extraHeaders || {}));
  res.end(obj === undefined ? '' : JSON.stringify(obj));
}

function readBody(req, cb) {
  req.setEncoding('utf8');
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 50 * 1024 * 1024) req.destroy();
  });
  req.on('end', () => cb(body));
}

function decodeName(s) {
  try { return decodeURIComponent(s || ''); } catch (e) { return s || ''; }
}

function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  // plugin asks for work
  if (req.method === 'GET' && url.pathname === '/next') {
    const file = url.searchParams.get('file') || '';
    clients.set(file || '(unknown file)', Date.now());
    const i = queue.findIndex((job) => !job.file || job.file === file);
    const job = i >= 0 ? queue.splice(i, 1)[0] : null;
    return send(res, 200, job ? { id: job.id, code: job.code } : null, CORS);
  }

  // who is connected
  if (req.method === 'GET' && url.pathname === '/status') {
    const now = Date.now();
    const alive = [...clients.entries()]
      .map(([file, t]) => ({ file, lastPollMs: now - t }))
      .filter((c) => c.lastPollMs < 15000)
      .sort((a, b) => a.lastPollMs - b.lastPollMs);
    return send(res, 200, {
      plugin: alive.some((c) => c.lastPollMs < 3000),
      clients: alive,
      queued: queue.map((j) => j.file || '*'),
      waiting: waiters.size,
      port: PORT,
    });
  }

  // Claude sends a script
  if (req.method === 'POST' && url.pathname === '/run') {
    if (req.headers['x-token'] !== TOKEN) { res.writeHead(403); return res.end('bad token'); }
    return readBody(req, (code) => {
      const id = ++seq;
      const job = { id, code, file: decodeName(req.headers['x-file']) };
      queue.push(job);
      waiters.set(id, res);
      setTimeout(() => {
        if (!waiters.has(id)) return;
        waiters.delete(id);
        const qi = queue.indexOf(job);
        if (qi >= 0) queue.splice(qi, 1);
        send(res, 504, { id, ok: false, error: 'timeout: no plugin took the job or it did not answer' + (job.file ? ' (target file: ' + job.file + ')' : '') });
      }, JOB_TIMEOUT_MS);
    });
  }

  // plugin returns a result
  if (req.method === 'POST' && url.pathname === '/result') {
    return readBody(req, (body) => {
      let msg;
      try { msg = JSON.parse(body); } catch (e) { res.writeHead(400, CORS); return res.end(); }
      const w = waiters.get(msg.id);
      if (w) { waiters.delete(msg.id); send(w, 200, msg); }
      res.writeHead(200, CORS);
      res.end('ok');
    });
  }

  res.writeHead(404, CORS);
  res.end();
}

for (const host of ['127.0.0.1', '::1']) {
  http.createServer(handler)
    .listen(PORT, host, () => console.log('figma bridge listening on ' + host + ':' + PORT))
    .on('error', (e) => console.log('skip ' + host + ': ' + e.code));
}
