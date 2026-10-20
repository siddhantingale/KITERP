// Mongo-style filter matching and sorting, used for entity queries.

function getPath(obj, key) {
  if (obj == null) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  return key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function eq(a, b) {
  if (Array.isArray(a)) return a.some((x) => eq(x, b));
  if (a === b) return true;
  if (a == null && b == null) return true;
  return false;
}

function cmp(a, b) {
  if (a == null || b == null) return null;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function matchCondition(value, cond) {
  if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    const ops = Object.keys(cond);
    if (ops.length && ops.every((o) => o.startsWith('$'))) {
      return ops.every((op) => {
        const arg = cond[op];
        switch (op) {
          case '$eq': return eq(value, arg);
          case '$ne': return !eq(value, arg);
          case '$in': return Array.isArray(arg) && arg.some((x) => eq(value, x));
          case '$nin': return Array.isArray(arg) && !arg.some((x) => eq(value, x));
          case '$gt': { const c = cmp(value, arg); return c !== null && c > 0; }
          case '$gte': { const c = cmp(value, arg); return c !== null && c >= 0; }
          case '$lt': { const c = cmp(value, arg); return c !== null && c < 0; }
          case '$lte': { const c = cmp(value, arg); return c !== null && c <= 0; }
          case '$exists': return arg ? value !== undefined && value !== null : value === undefined || value === null;
          case '$regex': {
            if (value == null) return false;
            try { return new RegExp(arg, cond.$options || '').test(String(value)); } catch { return false; }
          }
          case '$options': return true;
          case '$not': return !matchCondition(value, arg);
          case '$all': return Array.isArray(value) && Array.isArray(arg) && arg.every((x) => value.includes(x));
          case '$size': return Array.isArray(value) && value.length === arg;
          default: return false;
        }
      });
    }
  }
  return eq(value, cond);
}

export function matches(record, query) {
  if (!query || typeof query !== 'object') return true;
  return Object.entries(query).every(([key, cond]) => {
    if (key === '$or') return Array.isArray(cond) && cond.some((q) => matches(record, q));
    if (key === '$and') return Array.isArray(cond) && cond.every((q) => matches(record, q));
    if (key === '$nor') return Array.isArray(cond) && !cond.some((q) => matches(record, q));
    return matchCondition(getPath(record, key), cond);
  });
}

export function sortRows(rows, sort) {
  if (!sort) return rows;
  const fields = String(sort).split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => (s.startsWith('-') ? { key: s.slice(1), dir: -1 } : { key: s.replace(/^\+/, ''), dir: 1 }));
  return [...rows].sort((a, b) => {
    for (const { key, dir } of fields) {
      const va = getPath(a, key);
      const vb = getPath(b, key);
      if (va == null && vb == null) continue;
      if (va == null) return 1;
      if (vb == null) return -1;
      const na = Number(va), nb = Number(vb);
      const c = typeof va === 'number' || (va !== '' && vb !== '' && !isNaN(na) && !isNaN(nb) && typeof va !== 'boolean')
        ? na - nb
        : String(va).localeCompare(String(vb), undefined, { numeric: true });
      if (c !== 0) return c * dir;
    }
    return 0;
  });
}
