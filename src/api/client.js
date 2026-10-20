// EduTrack API client — talks to our own server (server/index.js).
// Same method names the pages already use:
//   api.entities.Student.filter({...}, '-created_date', 100)
//   api.auth.me()   api.integrations.Core.UploadFile({ file })   api.functions.invoke('name', payload)

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'edutrack_token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
  restartRealtime();
}

function makeError(status, data, fallback) {
  const message = (data && (data.error || data.message)) || fallback || `Request failed (${status})`;
  const err = new Error(typeof message === 'string' ? message : JSON.stringify(message));
  err.status = status;
  err.data = data;
  err.response = { status, data }; // axios-style, used by some pages
  return err;
}

async function request(method, path, { body, query, raw } = {}) {
  let url = `${API_BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw makeError(0, null, 'Cannot reach the EduTrack server. Is it running?');
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : await res.text();
  if (res.status === 401 && token && path !== '/api/auth/login') {
    // Expired or invalid session
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  }
  if (!res.ok) throw makeError(res.status, typeof data === 'object' ? data : { error: data });
  return raw ? { data, status: res.status, headers: Object.fromEntries(res.headers.entries()) } : data;
}

// ---------- realtime: one shared event stream for all .subscribe() calls ----------
const listeners = new Map(); // entity -> Set<callback>
let source = null;
let reconnectTimer = null;

function restartRealtime() {
  if (source) { source.close(); source = null; }
  clearTimeout(reconnectTimer);
  if (listeners.size === 0 || typeof EventSource === 'undefined') return;
  const token = getToken();
  if (!token) return;
  const entities = [...listeners.keys()].join(',');
  source = new EventSource(`${API_BASE}/api/realtime?entities=${encodeURIComponent(entities)}&token=${encodeURIComponent(token)}`);
  source.onmessage = (msg) => {
    let evt;
    try { evt = JSON.parse(msg.data); } catch { return; }
    const set = listeners.get(evt.entity);
    if (!set) return;
    for (const cb of [...set]) {
      try { cb({ type: evt.type, id: evt.id, data: evt.data }); } catch (e) { console.error(e); }
    }
  };
  source.onerror = () => {
    if (source?.readyState === EventSource.CLOSED) {
      reconnectTimer = setTimeout(restartRealtime, 5000);
    }
  };
}

function subscribe(entity, callback) {
  const isNew = !listeners.has(entity);
  if (isNew) listeners.set(entity, new Set());
  listeners.get(entity).add(callback);
  if (isNew || !source) restartRealtime();
  return () => {
    const set = listeners.get(entity);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) { listeners.delete(entity); restartRealtime(); }
  };
}

// ---------- entities ----------
function entity(name) {
  const base = `/api/entities/${name}`;
  return {
    list: (sort, limit, skip) => request('GET', base, { query: { sort, limit, skip } }),
    filter: (q = {}, sort, limit, skip) => request('GET', base, { query: { q, sort, limit, skip } }),
    get: (id) => request('GET', `${base}/${encodeURIComponent(id)}`),
    create: (data) => request('POST', base, { body: data || {} }),
    bulkCreate: (list) => request('POST', `${base}/bulk`, { body: list || [] }),
    update: (id, data) => request('PUT', `${base}/${encodeURIComponent(id)}`, { body: data || {} }),
    delete: (id) => request('DELETE', `${base}/${encodeURIComponent(id)}`),
    deleteMany: (q) => request('DELETE', base, { query: { q } }),
    subscribe: (callback) => subscribe(name, callback),
  };
}
const entityCache = {};
const entities = new Proxy({}, {
  get: (_, name) => (typeof name === 'string' ? (entityCache[name] ||= entity(name)) : undefined),
});

// ---------- auth ----------
function goToLogin(next) {
  const target = next || window.location.href;
  let path = target;
  try { const u = new URL(target, window.location.origin); path = u.pathname + u.search + u.hash; } catch { /* keep */ }
  if (window.location.pathname === '/login') return;
  window.location.href = `/login${path && path !== '/' && path !== '/login' ? `?next=${encodeURIComponent(path)}` : ''}`;
}

const auth = {
  me: () => request('GET', '/api/auth/me'),
  updateMe: (data) => request('PUT', '/api/auth/me', { body: data }),
  isAuthenticated: async () => {
    if (!getToken()) return false;
    try { await auth.me(); return true; } catch { return false; }
  },
  loginWithPassword: async (email, password) => {
    const { token, user } = await request('POST', '/api/auth/login', { body: { email, password } });
    setToken(token);
    return user;
  },
  register: async ({ email, password, full_name }) => {
    const { token, user } = await request('POST', '/api/auth/register', { body: { email, password, full_name } });
    setToken(token);
    return user;
  },
  changePassword: (current_password, new_password) =>
    request('POST', '/api/auth/change-password', { body: { current_password, new_password } }),
  // Opens the login page; afterwards the user returns to `next` (or the current page).
  login: (next) => goToLogin(next),
  redirectToLogin: (next) => goToLogin(next),
  logout: (redirectUrl) => {
    setToken(null);
    window.location.href = redirectUrl ? `/login?next=${encodeURIComponent(new URL(redirectUrl, window.location.origin).pathname)}` : '/login';
  },
  setToken,
};

// ---------- admin: user accounts ----------
const users = {
  list: () => request('GET', '/api/users'),
  create: (data) => request('POST', '/api/users', { body: data }),
  update: (id, data) => request('PUT', `/api/users/${id}`, { body: data }),
  setPassword: (id, password) => request('POST', `/api/users/${id}/password`, { body: { password } }),
  delete: (id) => request('DELETE', `/api/users/${id}`),
};

// ---------- integrations ----------
async function callIntegration(name, params) {
  const { result } = await request('POST', `/api/integrations/${name}`, { body: params || {} });
  return result;
}
const Core = {
  UploadFile: async ({ file } = {}) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/api/integrations/UploadFile', { body: form });
  },
  InvokeLLM: (params) => callIntegration('InvokeLLM', params),
  ExtractDataFromUploadedFile: (params) => callIntegration('ExtractDataFromUploadedFile', params),
  SendEmail: (params) => callIntegration('SendEmail', params),
  SendSMS: (params) => callIntegration('SendSMS', params),
  GenerateImage: (params) => callIntegration('GenerateImage', params),
};

// ---------- backend functions ----------
const functions = {
  // Returns { data, status, headers } like the old SDK; throws on HTTP errors with error.response.data
  invoke: (name, payload) => request('POST', `/api/functions/${name}`, { body: payload || {}, raw: true }),
};

export const api = {
  entities,
  auth,
  users,
  integrations: { Core },
  functions,
  config: () => request('GET', '/api/config'),
};

export default api;
