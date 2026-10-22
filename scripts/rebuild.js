// Recreates data/compliments.json from the backup log (data/compliments.log).
// Stop the server first. The existing file is kept as compliments.json.bak.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const DATA_FILE = path.join(DATA_DIR, 'compliments.json');
const LOG_FILE = path.join(DATA_DIR, 'compliments.log');

if (!fs.existsSync(LOG_FILE)) {
  console.error('No backup log found at', LOG_FILE);
  process.exit(1);
}

const byId = new Map();
let skipped = 0;
for (const line of fs.readFileSync(LOG_FILE, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    skipped++; // e.g. a half-written last line after a power loss
    continue;
  }
  if (record.type === 'add') byId.set(record.entry.id, record.entry);
  if (record.type === 'delete') byId.delete(record.entry.id);
}

if (fs.existsSync(DATA_FILE)) fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak');
const list = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
console.log(`Rebuilt ${list.length} compliments from the log${skipped ? ` (skipped ${skipped} unreadable lines)` : ''}.`);
