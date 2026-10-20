// Server-side client used by the backend functions in server/functions/.
// It exposes the same method shapes the functions already use
// (client.auth.me(), client.entities.X.filter(...), client.asServiceRole..., client.integrations.Core...).
import * as store from './db.js';
import { userFromToken, tokenFromRequest } from './auth.js';
import { Core } from './integrations.js';

function entityApi(name, user) {
  if (name === 'User') {
    return {
      list: (sort, limit, skip) => store.findUsers({}, { sort, limit, skip }),
      filter: (q, sort, limit, skip) => store.findUsers(q, { sort, limit, skip }),
      get: (id) => store.findUsers({ id })[0] || null,
    };
  }
  if (!store.hasEntity(name)) throw new Error(`Unknown entity: ${name}`);
  return {
    list: async (sort, limit, skip) => store.findRecords(name, {}, { sort, limit, skip }),
    filter: async (q, sort, limit, skip) => store.findRecords(name, q || {}, { sort, limit, skip }),
    get: async (id) => {
      const r = store.getRecord(name, id);
      if (!r) { const e = new Error(`${name} not found`); e.status = 404; throw e; }
      return r;
    },
    create: async (data) => store.createRecord(name, data, user),
    bulkCreate: async (list) => store.bulkCreate(name, list || [], user),
    update: async (id, data) => {
      const r = store.updateRecord(name, id, data);
      if (!r) { const e = new Error(`${name} not found`); e.status = 404; throw e; }
      return r;
    },
    delete: async (id) => { store.deleteRecord(name, id); return { success: true }; },
    deleteMany: async (q) => ({ deleted: store.deleteMany(name, q || {}) }),
  };
}

function entitiesFor(user) {
  return new Proxy({}, { get: (_, name) => (typeof name === 'string' ? entityApi(name, user) : undefined) });
}

const functionRegistry = new Map();
export function registerFunctions(map) {
  for (const [k, v] of Object.entries(map)) functionRegistry.set(k, v);
}

export function createClientFromRequest(req) {
  const user = userFromToken(tokenFromRequest(req));
  const origin = req.headers.get('x-forwarded-origin') || '';
  const client = {
    auth: { me: async () => user },
    entities: entitiesFor(user),
    integrations: { Core },
    functions: {
      invoke: async (name, payload) => {
        const fn = functionRegistry.get(name);
        if (!fn) throw new Error(`Unknown function: ${name}`);
        const res = await fn(new Request(`${origin || 'http://localhost'}/api/functions/${name}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: req.headers.get('authorization') || '' },
          body: JSON.stringify(payload || {}),
        }));
        return { data: await res.json().catch(() => null), status: res.status };
      },
    },
  };
  client.asServiceRole = { entities: entitiesFor(user), integrations: { Core }, functions: client.functions };
  return client;
}

// Each function file calls serve(handler) once while loading, then exports handlerFor(...).
let pending = null;
export function serve(handler) { pending = handler; }
export function handlerFor() {
  const h = pending;
  pending = null;
  if (!h) throw new Error('Function did not register a handler');
  return h;
}
