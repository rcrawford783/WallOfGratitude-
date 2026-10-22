// Wall of Gratitude server — Node built-ins only.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
// On Azure set DATA_DIR=/home/data so submissions survive redeploys.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'compliments.json');
// Append-only backup: one JSON line per add/delete. scripts/rebuild.js can recreate DATA_FILE from it.
const LOG_FILE = path.join(DATA_DIR, 'compliments.log');
const PUBLIC_DIR = path.join(__dirname, 'public');

const LIMITS = { to: 100, from: 100, message: 500 };
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20; // submissions per IP per window
const MAX_BODY_BYTES = 10 * 1024;

if (!ADMIN_PASSWORD) {
  console.error('\nADMIN_PASSWORD is not set.');
  console.error('Create a .env file containing:  ADMIN_PASSWORD=your-secret');
  console.error('or run:  $env:ADMIN_PASSWORD="your-secret"; npm start\n');
  process.exit(1);
}

// ---------- storage ----------

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function save(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const json = JSON.stringify(list, null, 2);
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, json);
  try {
    fs.renameSync(tmp, DATA_FILE);
  } catch {
    // OneDrive/antivirus can briefly lock the target on Windows; write directly instead.
    fs.writeFileSync(DATA_FILE, json);
    fs.rmSync(tmp, { force: true });
  }
}

function appendLog(record) {
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify({ ...record, at: new Date().toISOString() }) + '\n');
  } catch (err) {
    // The main file is already saved, so don't fail the request — just make it loud.
    console.error('WARNING: could not write backup log:', err.message);
  }
}

// Saves the new list before swapping it in, so a failed write never leaves unsaved data in memory.
function commit(next, record) {
  save(next);
  compliments = next;
  appendLog(record);
}

let compliments = load();
// Seed the backup log with anything saved before the log existed.
if (compliments.length && !fs.existsSync(LOG_FILE)) {
  for (const entry of compliments) appendLog({ type: 'add', entry });
}

// ---------- helpers ----------

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest();
}

function isAdmin(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return crypto.timingSafeEqual(sha256(password), sha256(ADMIN_PASSWORD));
}

function requireAdmin(req, res) {
  if (isAdmin(req)) return true;
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="Wall of Gratitude admin", charset="UTF-8"',
    'Content-Type': 'text/plain; charset=utf-8',
  });
  res.end('Admin login required.');
  return false;
}

function clientIp(req) {
  // Behind the Cloudflare tunnel or Azure's front end every request arrives from the same proxy,
  // so use the visitor address they forward. Azure sends "ip:port", so drop the port.
  const forwarded = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = req.headers['cf-connecting-ip'] || forwarded || req.socket.remoteAddress || '';
  return /^[\d.]+:\d+$/.test(ip) ? ip.replace(/:\d+$/, '') : ip;
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_MAX;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function csvCell(value) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop Excel from treating it as a formula
  return '"' + s.replace(/"/g, '""') + '"';
}

const STATIC = {
  '/': ['submit.html', 'text/html', false],
  '/submit.js': ['submit.js', 'text/javascript', false],
  '/styles.css': ['styles.css', 'text/css', false],
  '/admin': ['admin.html', 'text/html', true],
  '/admin.js': ['admin.js', 'text/javascript', true],
};

// ---------- routes ----------

async function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  if (req.method === 'GET' && STATIC[route]) {
    const [file, type, adminOnly] = STATIC[route];
    if (adminOnly && !requireAdmin(req, res)) return;
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 200, fs.readFileSync(path.join(PUBLIC_DIR, file)), type + '; charset=utf-8');
  }

  const font = route.match(/^\/fonts\/([\w-]+\.woff2)$/);
  if (req.method === 'GET' && font) {
    const file = path.join(PUBLIC_DIR, 'fonts', font[1]);
    if (!fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return send(res, 200, fs.readFileSync(file), 'font/woff2');
  }

  if (route === '/api/compliments' && req.method === 'POST') {
    if (rateLimited(clientIp(req))) {
      return send(res, 429, { error: 'Whoa, lots of kindness! Please wait a few minutes and try again.' });
    }
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, { error: 'Invalid submission.' });
    }
    const entry = {
      id: crypto.randomUUID(),
      to: clean(data.to, LIMITS.to),
      from: clean(data.from, LIMITS.from),
      message: clean(data.message, LIMITS.message),
      createdAt: new Date().toISOString(),
    };
    if (!entry.to || !entry.from || !entry.message) {
      return send(res, 400, { error: 'Please fill in every field.' });
    }
    try {
      commit([...compliments, entry], { type: 'add', entry });
    } catch (err) {
      console.error('Save failed:', err.message);
      return send(res, 500, { error: "Your message couldn't be saved. Please try again in a moment." });
    }
    return send(res, 201, { ok: true });
  }

  if (route === '/api/compliments' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return send(res, 200, compliments);
  }

  if (route === '/api/compliments.csv' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const rows = [['To', 'From', 'Message', 'Submitted']]
      .concat(compliments.map((c) => [c.to, c.from, c.message, c.createdAt]))
      .map((row) => row.map(csvCell).join(','));
    res.setHeader('Content-Disposition', 'attachment; filename="wall-of-gratitude.csv"');
    return send(res, 200, '﻿' + rows.join('\r\n'), 'text/csv; charset=utf-8');
  }

  const del = route.match(/^\/api\/compliments\/([\w-]+)$/);
  if (del && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const entry = compliments.find((c) => c.id === del[1]);
    if (!entry) return send(res, 404, { error: 'Not found.' });
    try {
      commit(compliments.filter((c) => c !== entry), { type: 'delete', entry });
    } catch (err) {
      console.error('Save failed:', err.message);
      return send(res, 500, { error: 'Could not delete. Please try again.' });
    }
    return send(res, 200, { ok: true });
  }

  send(res, 404, 'Not found', 'text/plain; charset=utf-8');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: 'Something went wrong.' });
  });
});

server.listen(PORT, () => {
  console.log(`\nWall of Gratitude running (${compliments.length} compliments loaded from ${DATA_DIR})`);
  console.log(`  This computer:   http://localhost:${PORT}`);
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) console.log(`  Office network:  http://${a.address}:${PORT}`);
    }
  }
  console.log(`  Admin page:      http://localhost:${PORT}/admin\n`);
});

module.exports = server;
