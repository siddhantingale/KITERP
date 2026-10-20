// SQLite storage for every EduTrack entity.
// Each entity gets its own table: built-in columns + a JSON "data" column for its fields.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { matches, sortRows } from './query.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');

// Database + uploads live in <project>/data (outside server/ so code watchers ignore them)
export const DATA_DIR = path.resolve(SERVER_DIR, '..', process.env.DATA_DIR || 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'edutrack.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- schemas ----------
const ENTITY_DIR = path.join(SERVER_DIR, 'entities');
export const schemas = {};
for (const file of fs.readdirSync(ENTITY_DIR)) {
  if (!file.endsWith('.json')) continue;
  const schema = JSON.parse(fs.readFileSync(path.join(ENTITY_DIR, file), 'utf8'));
  schemas[schema.name || file.replace(/\.json$/, '')] = schema;
}

const BUILTIN = ['id', 'created_date', 'updated_date', 'created_by', 'created_by_id'];

for (const name of Object.keys(schemas)) {
  db.exec(`CREATE TABLE IF NOT EXISTS "e_${name}" (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    created_by TEXT,
    created_by_id TEXT
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS "ix_${name}_created" ON "e_${name}"(created_date)`);
}

// Indexes on the fields the app filters by most, so big tables stay fast.
const HOT_FIELDS = {
  Student: ['batch_id', 'email', 'prn'],
  AttendanceRecord: ['session_id', 'student_id', 'batch_id'],
  Session: ['batch_id'],
  Batch: ['batch_id'],
  AssignmentSubmission: ['assignment_id', 'student_id'],
  StudentNotification: ['student_id', 'student_email'],
  QRActiveStudent: ['session_id'],
  AttendanceSubmissionLog: ['session_id'],
  PendingPushNotification: ['user_email'],
};
for (const [name, fields] of Object.entries(HOT_FIELDS)) {
  if (!schemas[name]) continue;
  for (const f of fields) {
    db.exec(`CREATE INDEX IF NOT EXISTS "ix_${name}_${f}" ON "e_${name}"(json_extract(data,'$.${f}'))`);
  }
}

// ---------- users ----------
db.exec(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  password_hash TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_date TEXT NOT NULL,
  updated_date TEXT NOT NULL
)`);

// ---------- realtime events (used by .subscribe) ----------
export const events = new EventEmitter();
events.setMaxListeners(0);

// ---------- helpers ----------
const now = () => new Date().toISOString();
export const newId = () => crypto.randomBytes(12).toString('hex');

export function hasEntity(name) {
  return Object.prototype.hasOwnProperty.call(schemas, name);
}

function rowToRecord(row) {
  return {
    ...JSON.parse(row.data),
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by: row.created_by,
    created_by_id: row.created_by_id,
  };
}

function applyDefaults(name, data) {
  const props = schemas[name]?.properties || {};
  const out = { ...data };
  for (const [k, def] of Object.entries(props)) {
    if (out[k] === undefined && def && def.default !== undefined) out[k] = def.default;
  }
  return out;
}

function stripBuiltins(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (!BUILTIN.includes(k) && v !== undefined) out[k] = v;
  }
  return out;
}

// Push simple equality filters down to SQL; everything else is checked in JS.
function sqlPrefilter(query) {
  const where = [];
  const params = [];
  for (const [k, v] of Object.entries(query || {})) {
    if (k.startsWith('$')) continue;
    const col = BUILTIN.includes(k) ? k : `json_extract(data,'$.${k.replace(/'/g, '')}')`;
    if (typeof v === 'string' || typeof v === 'number') {
      where.push(`${col} = ?`);
      params.push(v);
    } else if (typeof v === 'boolean' && !BUILTIN.includes(k)) {
      where.push(`${col} = ?`);
      params.push(v ? 1 : 0);
    }
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// ---------- CRUD ----------
export function findRecords(name, query = {}, { sort, limit, skip } = {}) {
  const { where, params } = sqlPrefilter(query);
  const rows = db.prepare(`SELECT * FROM "e_${name}" ${where}`).all(...params);
  let records = rows.map(rowToRecord).filter((r) => matches(r, query));
  records = sortRows(records, sort === undefined || sort === null || sort === '' ? '-created_date' : sort);
  const start = Number(skip) || 0;
  const end = limit ? start + Number(limit) : undefined;
  return records.slice(start, end);
}

export function getRecord(name, id) {
  const row = db.prepare(`SELECT * FROM "e_${name}" WHERE id = ?`).get(String(id));
  return row ? rowToRecord(row) : null;
}

export function createRecord(name, data, user) {
  const id = newId();
  const ts = now();
  const clean = applyDefaults(name, stripBuiltins(data));
  db.prepare(`INSERT INTO "e_${name}" (id, data, created_date, updated_date, created_by, created_by_id)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, JSON.stringify(clean), ts, ts, user?.email || null, user?.id || null);
  const rec = getRecord(name, id);
  events.emit('change', { entity: name, type: 'create', id, data: rec });
  return rec;
}

export const bulkCreate = db.transaction((name, list, user) => list.map((d) => createRecord(name, d, user)));

export function updateRecord(name, id, patch) {
  const existing = getRecord(name, id);
  if (!existing) return null;
  const current = stripBuiltins(existing);
  const next = { ...current, ...stripBuiltins(patch) };
  for (const [k, v] of Object.entries(patch || {})) if (v === undefined) delete next[k];
  db.prepare(`UPDATE "e_${name}" SET data = ?, updated_date = ? WHERE id = ?`)
    .run(JSON.stringify(next), now(), String(id));
  const rec = getRecord(name, id);
  events.emit('change', { entity: name, type: 'update', id: rec.id, data: rec });
  return rec;
}

export function deleteRecord(name, id) {
  const existing = getRecord(name, id);
  if (!existing) return false;
  db.prepare(`DELETE FROM "e_${name}" WHERE id = ?`).run(String(id));
  events.emit('change', { entity: name, type: 'delete', id: existing.id, data: existing });
  return true;
}

export function deleteMany(name, query = {}) {
  const recs = findRecords(name, query);
  const tx = db.transaction(() => recs.forEach((r) => deleteRecord(name, r.id)));
  tx();
  return recs.length;
}

// ---------- users as a read-only "User" entity ----------
export function publicUser(u) {
  if (!u) return null;
  return {
    ...JSON.parse(u.data || '{}'),
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role,
    created_date: u.created_date,
    updated_date: u.updated_date,
  };
}

export function findUsers(query = {}, opts = {}) {
  const all = db.prepare('SELECT * FROM users').all().map(publicUser);
  const list = sortRows(all.filter((u) => matches(u, query)), opts.sort || '-created_date');
  const start = Number(opts.skip) || 0;
  return list.slice(start, opts.limit ? start + Number(opts.limit) : undefined);
}
