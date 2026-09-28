// Minimal IndexedDB key-value store (with in-memory fallback, e.g. private mode).
const DB_NAME = 'hypolab', STORE = 'kv';
let dbp = null;
const mem = new Map();
function open() {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode); const s = t.objectStore(STORE);
    const r = fn(s); t.oncomplete = () => resolve(r?.result); t.onerror = () => reject(t.error);
  });
}
export async function get(key) { const db = await open(); if (!db) return mem.get(key); return tx(db, 'readonly', s => s.get(key)); }
export async function set(key, val) { const db = await open(); if (!db) { mem.set(key, val); return; } return tx(db, 'readwrite', s => s.put(val, key)); }
export async function del(key) { const db = await open(); if (!db) { mem.delete(key); return; } return tx(db, 'readwrite', s => s.delete(key)); }
