// ─────────────────────────────────────────────────────────────────────────────
// In-browser backend for the static (GitHub Pages) build.
// Implements the same REST contract as server/index.js on top of IndexedDB,
// reusing the shared parser (shared/excel.js), analysis (shared/analysis.js),
// business logic (shared/core.js) and demo data (shared/demo.js).
// ─────────────────────────────────────────────────────────────────────────────
import XLSX from '../../shared/xlsx.js';
import * as kv from './store.js';
import { inspectWorkbook, extract, previewPayload } from '../../shared/excel.js';
import { analyse, baseline, dailySeries } from '../../shared/analysis.js';
import { buildWorkbooks, demoHypotheses, DEMO_DATASETS } from '../../shared/demo.js';
import { STATUS_RU, cleanHypothesis, hypothesisOut, datasetOut, buildPreview, prepareCommit, datasetRecord, computeStats, nowSql } from '../../shared/core.js';

const SESSION_KEY = 'hl_local_uid';
const STATE_KEY = 'state:v1';
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (s, m) => { throw new HttpError(s, m); };

let state = null;       // { seq, users, hypotheses, datasets, events }
const rowsCache = new Map();
let ready = null;

async function load() {
  state = (await kv.get(STATE_KEY)) || { seq: { user: 0, hyp: 0, ds: 0, ev: 0 }, users: [], hypotheses: [], datasets: [], events: [] };
  if (!state.users.some(u => u.email === 'demo@hypolab.ru')) {
    const id = await createUser({ email: 'demo@hypolab.ru', name: 'Анна Ковалёва', company: 'Льняная мастерская', password: 'demo1234' });
    await seedUser(id);
  }
  await save();
}
const init = () => (ready ||= load());
const save = () => kv.set(STATE_KEY, state);
const nextId = k => ++state.seq[k];
async function getRows(dsId) { if (!rowsCache.has(dsId)) rowsCache.set(dsId, (await kv.get('rows:' + dsId)) || []); return rowsCache.get(dsId); }
async function setRows(dsId, rows) { rowsCache.set(dsId, rows); await kv.set('rows:' + dsId, rows); }

async function hash(password, salt) {
  const data = new TextEncoder().encode(salt + ':' + password);
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let h = 5381; for (const b of data) h = (h * 33) ^ b; return 'djb2-' + (h >>> 0).toString(16);
}
const randomId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

async function createUser({ email, name, company, password }) {
  const salt = randomId();
  const u = { id: nextId('user'), email: email.toLowerCase(), name, company: company || null, salt, password_hash: await hash(password, salt), created_at: nowSql() };
  state.users.push(u);
  return u.id;
}
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, company: u.company, created_at: u.created_at });

async function saveDataset(userId, { name, filename, marketplace, sheet, analysis, ex }) {
  const id = nextId('ds');
  state.datasets.push({ id, user_id: userId, ...datasetRecord({ name, filename, marketplace, sheet, analysis, ex }), created_at: nowSql() });
  await setRows(id, ex.records.map(r => ({ date: r.date, sku: r.sku, vals: r.vals })));
  return id;
}

async function seedUser(userId) {
  const wbs = buildWorkbooks();
  const ids = {};
  for (const d of DEMO_DATASETS) {
    const buf = XLSX.write(wbs[d.file], { type: 'array', bookType: 'xlsx' });
    const { sheets } = inspectWorkbook(new Uint8Array(buf));
    const sheet = previewPayload(sheets);
    ids[d.key] = await saveDataset(userId, { name: d.name, filename: d.file, marketplace: d.marketplace, sheet: sheet.name, analysis: sheet.best, ex: extract(sheet, sheet.best) });
  }
  for (const { row, events } of demoHypotheses(ids)) {
    const id = nextId('hyp');
    state.hypotheses.push({ id, user_id: userId, ...row });
    for (const e of events) state.events.push({ id: nextId('ev'), user_id: userId, hypothesis_id: id, ...e });
  }
}

async function wipeUser(userId) {
  for (const d of state.datasets.filter(d => d.user_id === userId)) { rowsCache.delete(d.id); await kv.del('rows:' + d.id); }
  state.datasets = state.datasets.filter(d => d.user_id !== userId);
  state.hypotheses = state.hypotheses.filter(h => h.user_id !== userId);
  state.events = state.events.filter(e => e.user_id !== userId);
}

function currentUser() {
  const id = +localStorage.getItem(SESSION_KEY);
  const u = id && state.users.find(x => x.id === id);
  if (!u) fail(401, 'Требуется авторизация');
  return u;
}
const logEvent = (uid, hid, type, text) => state.events.push({ id: nextId('ev'), user_id: uid, hypothesis_id: hid, type, text, created_at: nowSql() });
const byNewest = (a, b) => String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id;

const pending = new Map(); // upload token → parsed workbook

// ── routes ──────────────────────────────────────────────────────────────────
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('POST', '/auth/register', async ({ body }) => {
  const { email, password, name, company, withDemo = true } = body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) fail(400, 'Укажите корректный email');
  if (!password || password.length < 6) fail(400, 'Пароль должен быть не короче 6 символов');
  if (!name?.trim()) fail(400, 'Укажите имя');
  if (state.users.some(u => u.email === email.toLowerCase())) fail(409, 'Пользователь с таким email уже существует');
  const id = await createUser({ email, password, name: name.trim(), company: company?.trim() });
  if (withDemo) await seedUser(id);
  await save();
  localStorage.setItem(SESSION_KEY, id);
  return { user: publicUser(state.users.find(u => u.id === id)) };
});
route('POST', '/auth/login', async ({ body }) => {
  const u = state.users.find(x => x.email === String(body?.email || '').toLowerCase());
  if (!u || (await hash(body?.password || '', u.salt)) !== u.password_hash) fail(401, 'Неверный email или пароль');
  localStorage.setItem(SESSION_KEY, u.id);
  return { user: publicUser(u) };
});
route('POST', '/auth/logout', () => { localStorage.removeItem(SESSION_KEY); return { ok: true }; });
route('GET', '/auth/me', () => ({ user: publicUser(currentUser()) }));
route('PATCH', '/auth/me', async ({ body }) => {
  const u = currentUser();
  const { name, company, password, currentPassword } = body || {};
  if (password) {
    if ((await hash(currentPassword || '', u.salt)) !== u.password_hash) fail(400, 'Текущий пароль указан неверно');
    if (password.length < 6) fail(400, 'Новый пароль должен быть не короче 6 символов');
    u.password_hash = await hash(password, u.salt);
  }
  if (name?.trim()) u.name = name.trim();
  if (company !== undefined) u.company = company?.trim() || null;
  await save();
  return { user: publicUser(u) };
});
route('POST', '/demo/reset', async () => { const u = currentUser(); await wipeUser(u.id); await seedUser(u.id); await save(); return { ok: true }; });

const myHyp = (u, id) => state.hypotheses.find(h => h.id === +id && h.user_id === u.id) || fail(404, 'Гипотеза не найдена');
const myDs = (u, id) => state.datasets.find(d => d.id === +id && d.user_id === u.id) || fail(404, 'Датасет не найден');

route('GET', '/hypotheses', () => { const u = currentUser(); return state.hypotheses.filter(h => h.user_id === u.id).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).map(hypothesisOut); });
route('GET', '/hypotheses/:id', ({ params }) => {
  const u = currentUser(); const h = myHyp(u, params.id);
  return { ...hypothesisOut(h), events: state.events.filter(e => e.hypothesis_id === h.id).sort(byNewest) };
});
route('POST', '/hypotheses', async ({ body }) => {
  const u = currentUser(); const d = cleanHypothesis(body || {}, { tagsAsJson: false });
  if (!d.title) fail(400, 'Укажите формулировку гипотезы');
  const now = nowSql();
  const h = { id: nextId('hyp'), user_id: u.id, impact: 5, confidence: 5, ease: 5, tags: [], ...d, status: d.status || 'planned', created_at: now, updated_at: now };
  state.hypotheses.push(h); logEvent(u.id, h.id, 'created', `Создана гипотеза «${h.title}»`); await save();
  return hypothesisOut(h);
});
route('PATCH', '/hypotheses/:id', async ({ params, body }) => {
  const u = currentUser(); const h = myHyp(u, params.id);
  const d = cleanHypothesis(body || {}, { tagsAsJson: false });
  if ('title' in d && !d.title) fail(400, 'Формулировка не может быть пустой');
  const keys = Object.keys(d); const prevStatus = h.status;
  if (keys.length) Object.assign(h, d, { updated_at: nowSql() });
  if (d.status && d.status !== prevStatus) logEvent(u.id, h.id, 'status', `Статус изменён на «${STATUS_RU[d.status]}»`);
  else if (keys.length && !(keys.length === 1 && keys[0] === 'status')) logEvent(u.id, h.id, 'edit', 'Гипотеза отредактирована');
  await save();
  return hypothesisOut(h);
});
route('DELETE', '/hypotheses/:id', async ({ params }) => {
  const u = currentUser(); const h = myHyp(u, params.id);
  state.hypotheses = state.hypotheses.filter(x => x !== h);
  state.events = state.events.filter(e => e.hypothesis_id !== h.id);
  await save(); return { ok: true };
});
route('GET', '/hypotheses/:id/analysis', async ({ params, query }) => {
  const u = currentUser(); const h = myHyp(u, params.id);
  const dsId = query.get('dataset_id') || h.dataset_id;
  if (!dsId) return { error: 'Датасет не привязан' };
  const ds = myDs(u, dsId);
  const rows = await getRows(ds.id);
  const sku = query.has('sku') ? (query.get('sku') || null) : h.dataset_sku;
  const hyp = { ...h };
  for (const k of ['start_date', 'end_date']) if (query.get(k)) hyp[k] = query.get(k);
  for (const k of ['before_days', 'after_days']) if (query.get(k)) hyp[k] = +query.get(k);
  return { dataset: { id: ds.id, name: ds.name, skus: ds.skus }, sku, ...analyse({ rows, hypothesis: hyp, sku }) };
});

route('GET', '/datasets', () => {
  const u = currentUser();
  return state.datasets.filter(d => d.user_id === u.id).sort(byNewest).map(d => ({ ...datasetOut(d), hypotheses_count: state.hypotheses.filter(h => h.dataset_id === d.id).length }));
});
route('GET', '/datasets/:id', async ({ params, query }) => {
  const u = currentUser(); const ds = myDs(u, params.id);
  const series = dailySeries(await getRows(ds.id), query.get('sku') || null);
  const hypotheses = state.hypotheses.filter(h => h.dataset_id === ds.id && h.user_id === u.id).map(({ id, title, status, start_date, end_date, metric }) => ({ id, title, status, start_date, end_date, metric }));
  return { ...datasetOut(ds), series, hypotheses };
});
route('PATCH', '/datasets/:id', async ({ params, body }) => {
  const u = currentUser(); const ds = myDs(u, params.id);
  if (body?.name?.trim()) ds.name = body.name.trim();
  if (body?.marketplace) ds.marketplace = body.marketplace;
  await save(); return datasetOut(ds);
});
route('DELETE', '/datasets/:id', async ({ params }) => {
  const u = currentUser(); const ds = myDs(u, params.id);
  state.datasets = state.datasets.filter(d => d !== ds);
  state.hypotheses.forEach(h => { if (h.dataset_id === ds.id) h.dataset_id = null; });
  rowsCache.delete(ds.id); await kv.del('rows:' + ds.id); await save();
  return { ok: true };
});
route('GET', '/datasets/:id/baseline', async ({ params, query }) => {
  const u = currentUser(); const ds = myDs(u, params.id);
  return baseline(await getRows(ds.id), query.get('metric'), query.get('sku') || null, +query.get('days') || 28);
});
route('POST', '/datasets/preview', async ({ form }) => {
  const u = currentUser();
  const file = form?.get('file');
  if (!file) fail(400, 'Файл не получен');
  if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) fail(400, 'Поддерживаются файлы .xlsx, .xls, .xlsm, .csv');
  if (file.size > 15 * 1024 * 1024) fail(400, 'Файл больше 15 МБ');
  let parsed;
  try { parsed = inspectWorkbook(new Uint8Array(await file.arrayBuffer())); } catch { fail(400, 'Не удалось прочитать файл: он повреждён или защищён паролем'); }
  const token = randomId();
  const entry = { uid: u.id, filename: file.name, sheets: parsed.sheets, ts: Date.now() };
  pending.set(token, entry);
  return { token, filename: file.name, ...buildPreview(entry) };
});
route('POST', '/datasets/preview/:token', ({ params, body }) => {
  const u = currentUser(); const entry = pending.get(params.token);
  if (!entry || entry.uid !== u.id) fail(410, 'Сессия загрузки истекла, загрузите файл заново');
  return { token: params.token, filename: entry.filename, ...buildPreview(entry, body?.sheet, body?.mapping) };
});
route('POST', '/datasets/commit/:token', async ({ params, body }) => {
  const u = currentUser(); const entry = pending.get(params.token);
  if (!entry || entry.uid !== u.id) fail(410, 'Сессия загрузки истекла, загрузите файл заново');
  const prep = prepareCommit(entry, body?.sheet, body?.mapping?.map(({ example, ...m }) => m));
  if (prep.error) fail(400, prep.error);
  const id = await saveDataset(u.id, { name: body?.name?.trim() || entry.filename.replace(/\.\w+$/, ''), filename: entry.filename, marketplace: body?.marketplace || null, sheet: prep.sheet.name, analysis: prep.analysis, ex: prep.ex });
  pending.delete(params.token); await save();
  return datasetOut(state.datasets.find(d => d.id === id));
});
route('GET', '/stats', () => {
  const u = currentUser();
  const hs = state.hypotheses.filter(h => h.user_id === u.id);
  const all = state.events.filter(e => e.user_id === u.id);
  const events = [...all].sort(byNewest).slice(0, 12).map(e => ({ ...e, title: state.hypotheses.find(h => h.id === e.hypothesis_id)?.title }));
  return computeStats(hs, events, all, state.datasets.filter(d => d.user_id === u.id).length);
});

/** Entry point used by src/lib/api.js in static mode */
export async function localApi(path, { method = 'GET', body, form } = {}) {
  await init();
  const url = new URL(path, 'http://local');
  // small artificial latency so loading states behave like with a real server
  await new Promise(r => setTimeout(r, 90 + Math.random() * 120));
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = url.pathname.match(r.re);
    if (m) {
      try { return structuredClone(await r.fn({ params: m.groups || {}, query: url.searchParams, body, form })); }
      catch (e) { if (e instanceof HttpError) throw e; console.error(e); throw new HttpError(500, 'Внутренняя ошибка: ' + e.message); }
    }
  }
  throw new HttpError(404, 'Not found');
}

/** Download a demo workbook (used for sample links in static mode) */
export function downloadSample(file) {
  const wb = buildWorkbooks()[file];
  if (wb) XLSX.writeFile(wb, file);
}
