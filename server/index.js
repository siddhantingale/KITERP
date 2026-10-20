// EduTrack self-hosted server: REST API + file uploads + backend functions + (in production) the built frontend.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as store from './lib/db.js';
import {
  createUser, verifyLogin, signToken, userFromToken, tokenFromRequest, updateUser,
  changePassword, setPassword, seedAdmin, httpError,
} from './lib/auth.js';
import { Core, UPLOAD_DIR, aiEnabled } from './lib/integrations.js';
import { registerFunctions } from './lib/sdk.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 3001);

seedAdmin();

// ---------- load backend functions ----------
const functions = {};
const FN_DIR = path.join(__dirname, 'functions');
for (const file of fs.readdirSync(FN_DIR).filter((f) => f.endsWith('.js')).sort()) {
  const mod = await import(pathToFileURL(path.join(FN_DIR, file)).href); // sequential on purpose
  functions[file.replace(/\.js$/, '')] = mod.default;
}
registerFunctions(functions);

const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Attach the logged-in user (if any) to every request.
app.use((req, _res, next) => {
  req.user = userFromToken(tokenFromRequest(req));
  next();
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const requireUser = (req, _res, next) => (req.user ? next() : next(httpError(401, 'Please log in')));
const requireAdmin = (req, _res, next) =>
  (req.user?.role === 'admin' ? next() : next(httpError(403, 'Admin access required')));

function parseQuery(req) {
  let q = {};
  if (req.query.q) {
    try { q = JSON.parse(req.query.q); } catch { throw httpError(400, 'Invalid query'); }
  }
  return {
    q,
    opts: {
      sort: req.query.sort || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      skip: req.query.skip ? Number(req.query.skip) : undefined,
    },
  };
}

// ---------- health / config ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/config', (_req, res) => res.json({
  ai_enabled: aiEnabled(),
  email_enabled: !!(process.env.SMTP_HOST || (process.env.EMAIL_USER && process.env.EMAIL_PASS)),
  allow_signup: process.env.ALLOW_SIGNUP !== 'false',
  mapbox_token: process.env.MAPBOX_ACCESS_TOKEN || '',
}));

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const isFirst = store.findUsers({}).length === 0;
  if (!isFirst && process.env.ALLOW_SIGNUP === 'false') throw httpError(403, 'Sign-up is disabled. Ask an admin to create your account.');
  const user = createUser({ email: req.body.email, password: req.body.password, full_name: req.body.full_name });
  res.json({ token: signToken(user), user });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const user = verifyLogin(req.body.email, req.body.password);
  res.json({ token: signToken(user), user });
}));

app.get('/api/auth/me', requireUser, (req, res) => res.json(req.user));
app.put('/api/auth/me', requireUser, wrap(async (req, res) => res.json(updateUser(req.user.id, req.body))));
app.post('/api/auth/change-password', requireUser, wrap(async (req, res) => {
  changePassword(req.user.id, req.body.current_password, req.body.new_password);
  res.json({ success: true });
}));

// ---------- user management (admin) ----------
app.get('/api/users', requireAdmin, (_req, res) => res.json(store.findUsers({})));
app.post('/api/users', requireAdmin, wrap(async (req, res) => res.json(createUser(req.body))));
app.put('/api/users/:id', requireAdmin, wrap(async (req, res) =>
  res.json(updateUser(req.params.id, req.body, { allowRole: true }))));
app.post('/api/users/:id/password', requireAdmin, wrap(async (req, res) => {
  setPassword(req.params.id, req.body.password);
  res.json({ success: true });
}));
app.delete('/api/users/:id', requireAdmin, wrap(async (req, res) => {
  if (req.params.id === req.user.id) throw httpError(400, 'You cannot delete your own account');
  store.db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
}));

// ---------- entities ----------
function checkEntity(name) {
  if (!store.hasEntity(name)) throw httpError(404, `Unknown entity: ${name}`);
}

// Built-in "User" entity: admins see everyone, others only themselves.
app.get('/api/entities/User', requireUser, wrap(async (req, res) => {
  const { q, opts } = parseQuery(req);
  const scoped = req.user.role === 'admin' ? q : { ...q, id: req.user.id };
  res.json(store.findUsers(scoped, opts));
}));
app.get('/api/entities/User/:id', requireUser, wrap(async (req, res) => {
  if (req.user.role !== 'admin' && req.params.id !== req.user.id) throw httpError(403, 'Not allowed');
  const u = store.findUsers({ id: req.params.id })[0];
  if (!u) throw httpError(404, 'User not found');
  res.json(u);
}));
app.put('/api/entities/User/:id', requireUser, wrap(async (req, res) => {
  const self = req.params.id === req.user.id;
  if (!self && req.user.role !== 'admin') throw httpError(403, 'Not allowed');
  res.json(updateUser(req.params.id, req.body, { allowRole: req.user.role === 'admin' && !self }));
}));

app.get('/api/entities/:name', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  const { q, opts } = parseQuery(req);
  res.json(store.findRecords(req.params.name, q, opts));
}));
app.get('/api/entities/:name/:id', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  const rec = store.getRecord(req.params.name, req.params.id);
  if (!rec) throw httpError(404, `${req.params.name} not found`);
  res.json(rec);
}));
app.post('/api/entities/:name/bulk', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  if (!Array.isArray(req.body)) throw httpError(400, 'Expected an array');
  res.json(store.bulkCreate(req.params.name, req.body, req.user));
}));
app.post('/api/entities/:name', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  res.json(store.createRecord(req.params.name, req.body || {}, req.user));
}));
app.put('/api/entities/:name/:id', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  const rec = store.updateRecord(req.params.name, req.params.id, req.body || {});
  if (!rec) throw httpError(404, `${req.params.name} not found`);
  res.json(rec);
}));
app.delete('/api/entities/:name/:id', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  res.json({ success: store.deleteRecord(req.params.name, req.params.id) });
}));
app.delete('/api/entities/:name', requireUser, wrap(async (req, res) => {
  checkEntity(req.params.name);
  const { q } = parseQuery(req);
  if (!Object.keys(q).length) throw httpError(400, 'Refusing to delete everything without a filter');
  res.json({ deleted: store.deleteMany(req.params.name, q) });
}));

// ---------- realtime (Server-Sent Events) for entity .subscribe() ----------
app.get('/api/realtime', (req, res) => {
  const user = userFromToken(req.query.token);
  if (!user) return res.status(401).end();
  const wanted = new Set(String(req.query.entities || '').split(',').filter(Boolean));
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(': connected\n\n');
  const onChange = (evt) => {
    if (wanted.size && !wanted.has(evt.entity)) return;
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  };
  store.events.on('change', onChange);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); store.events.off('change', onChange); });
});

// ---------- integrations ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      const base = path.basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'file';
      cb(null, `${crypto.randomBytes(6).toString('hex')}_${base}${ext}`);
    },
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 25) * 1024 * 1024 },
});

app.post('/api/integrations/UploadFile', requireUser, upload.single('file'), (req, res) => {
  if (!req.file) throw httpError(400, 'No file uploaded');
  const base = process.env.PUBLIC_URL?.replace(/\/$/, '') || `${req.protocol}://${req.get('host')}`;
  res.json({ file_url: `${base}/uploads/${req.file.filename}` });
});

app.post('/api/integrations/:name', requireUser, wrap(async (req, res) => {
  const fn = Core[req.params.name];
  if (!fn) throw httpError(404, `Unknown integration: ${req.params.name}`);
  res.json({ result: await fn(req.body || {}) });
}));

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

// ---------- backend functions ----------
app.post('/api/functions/:name', wrap(async (req, res) => {
  const fn = functions[req.params.name];
  if (!fn) throw httpError(404, `Unknown function: ${req.params.name}`);
  const headers = new Headers({ 'content-type': 'application/json' });
  if (req.headers.authorization) headers.set('authorization', req.headers.authorization);
  for (const h of ['user-agent', 'x-forwarded-for', 'x-real-ip']) if (req.headers[h]) headers.set(h, req.headers[h]);
  if (!headers.get('x-forwarded-for') && req.ip) headers.set('x-forwarded-for', req.ip);
  headers.set('x-forwarded-origin', `${req.protocol}://${req.get('host')}`);
  const request = new Request(`http://localhost/api/functions/${req.params.name}`, {
    method: 'POST', headers, body: JSON.stringify(req.body ?? {}),
  });
  const response = await fn(request);
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(Buffer.from(await response.arrayBuffer()));
}));

app.use('/api', (_req, _res, next) => next(httpError(404, 'Not found')));

// ---------- frontend (production build) ----------
const DIST = path.join(ROOT, 'dist');
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST, { index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// ---------- errors ----------
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Server error', message: err.message || 'Server error' });
});

app.listen(PORT, () => {
  console.log(`\n✅ EduTrack server running on http://localhost:${PORT}`);
  if (!fs.existsSync(DIST)) console.log('   (API only — run "npm run dev" for the frontend at http://localhost:5173)');
  console.log(`   Functions loaded: ${Object.keys(functions).length}   AI: ${aiEnabled() ? 'on' : 'off'}\n`);
});
