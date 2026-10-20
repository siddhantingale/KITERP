// Email + password accounts with JWT sessions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db, DATA_DIR, newId, publicUser } from './db.js';

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(DATA_DIR, '.jwt-secret');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'));
  return fs.readFileSync(file, 'utf8').trim();
}
const SECRET = loadSecret();
const TOKEN_DAYS = Number(process.env.TOKEN_DAYS || 30);

export function signToken(user) {
  return jwt.sign({ sub: user.id }, SECRET, { expiresIn: `${TOKEN_DAYS}d` });
}

export function userFromToken(token) {
  if (!token) return null;
  try {
    const { sub } = jwt.verify(token, SECRET);
    return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(sub));
  } catch {
    return null;
  }
}

export function tokenFromRequest(req) {
  const h = req.headers?.authorization || req.headers?.get?.('authorization') || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  return null;
}

const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;

export function createUser({ email, password, full_name, role }) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, 'Please enter a valid email address');
  if (!password || String(password).length < 6) throw httpError(400, 'Password must be at least 6 characters');
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw httpError(409, 'An account with this email already exists');
  // The very first account is the admin.
  const finalRole = role || (userCount() === 0 ? 'admin' : 'user');
  const ts = new Date().toISOString();
  const id = newId();
  db.prepare(`INSERT INTO users (id, email, full_name, role, password_hash, data, created_date, updated_date)
              VALUES (?, ?, ?, ?, ?, '{}', ?, ?)`)
    .run(id, email, full_name || email.split('@')[0], finalRole, bcrypt.hashSync(String(password), 10), ts, ts);
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function verifyLogin(email, password) {
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').trim().toLowerCase());
  if (!row || !bcrypt.compareSync(String(password || ''), row.password_hash)) {
    throw httpError(401, 'Incorrect email or password');
  }
  return publicUser(row);
}

export function updateUser(id, patch, { allowRole = false } = {}) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row) throw httpError(404, 'User not found');
  const data = JSON.parse(row.data || '{}');
  let { full_name, role } = row;
  for (const [k, v] of Object.entries(patch || {})) {
    if (['id', 'email', 'password_hash', 'created_date', 'updated_date', 'password'].includes(k)) continue;
    if (k === 'full_name') full_name = v;
    else if (k === 'role') { if (allowRole && ['admin', 'user'].includes(v)) role = v; }
    else data[k] = v;
  }
  db.prepare('UPDATE users SET full_name = ?, role = ?, data = ?, updated_date = ? WHERE id = ?')
    .run(full_name, role, JSON.stringify(data), new Date().toISOString(), id);
  return publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
}

export function changePassword(id, oldPassword, newPassword) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!row || !bcrypt.compareSync(String(oldPassword || ''), row.password_hash)) throw httpError(401, 'Current password is incorrect');
  if (!newPassword || String(newPassword).length < 6) throw httpError(400, 'Password must be at least 6 characters');
  db.prepare('UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?')
    .run(bcrypt.hashSync(String(newPassword), 10), new Date().toISOString(), id);
}

export function setPassword(id, newPassword) {
  if (!newPassword || String(newPassword).length < 6) throw httpError(400, 'Password must be at least 6 characters');
  db.prepare('UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?')
    .run(bcrypt.hashSync(String(newPassword), 10), new Date().toISOString(), id);
}

// Optional: create the admin from .env on first start.
export function seedAdmin() {
  const { ADMIN_LOGIN_EMAIL, ADMIN_LOGIN_PASSWORD } = process.env;
  if (!ADMIN_LOGIN_EMAIL || !ADMIN_LOGIN_PASSWORD) return;
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(ADMIN_LOGIN_EMAIL.toLowerCase());
  if (existing) return;
  createUser({ email: ADMIN_LOGIN_EMAIL, password: ADMIN_LOGIN_PASSWORD, full_name: 'Administrator', role: 'admin' });
  console.log(`👤 Admin account created: ${ADMIN_LOGIN_EMAIL}`);
}

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}
