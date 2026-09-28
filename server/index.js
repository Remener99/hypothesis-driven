import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { inspectWorkbook, extract, previewPayload, parseDate } from './excel.js';
import { analyse, baseline, dailySeries } from './analysis.js';
import { ensureDemo, saveDataset, seedUserData, SAMPLES_DIR } from './seed.js';
import { METRIC_MAP } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretFile = path.join(__dirname, '..', 'data', '.secret');
const SECRET = process.env.JWT_SECRET || (fs.existsSync(secretFile) ? fs.readFileSync(secretFile, 'utf8') : (() => { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(secretFile, s); return s; })());
const PORT = process.env.PORT || 3001;

ensureDemo();

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// artificial small latency in dev so loading states are visible
if (process.env.SLOW) app.use('/api', (req, res, next) => setTimeout(next, +process.env.SLOW));

const wrap = fn => (req, res, next) => { try { const r = fn(req, res, next); if (r?.catch) r.catch(next); } catch (e) { next(e); } };
const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// ── auth ────────────────────────────────────────────────────────────────────
// Cookie works both on plain http (localhost) and inside cross-site iframes behind an https proxy
// (SameSite=None requires Secure). A Bearer token is also returned as a fallback for browsers
// that block third-party cookies entirely.
function cookieOpts(req) {
  const https = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
  return https ? { httpOnly: true, sameSite: 'none', secure: true, partitioned: true, maxAge: 30 * 864e5 } : { httpOnly: true, sameSite: 'lax', secure: false, maxAge: 30 * 864e5 };
}
function setSession(req, res, user) {
  const token = jwt.sign({ uid: user.id }, SECRET, { expiresIn: '30d' });
  res.cookie('hl_token', token, cookieOpts(req));
  return token;
}
const publicUser = u => ({ id: u.id, email: u.email, name: u.name, company: u.company, created_at: u.created_at });
function auth(req, res, next) {
  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const t = bearer || req.cookies.hl_token || req.query.token;
  try {
    const { uid } = jwt.verify(t, SECRET);
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(uid);
    if (!u) throw new Error();
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Требуется авторизация' }); }
}

app.post('/api/auth/register', wrap((req, res) => {
  const { email, password, name, company, withDemo = true } = req.body || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: 'Укажите корректный email' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
  if (!name?.trim()) return res.status(400).json({ error: 'Укажите имя' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email.toLowerCase())) return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
  const id = db.prepare('INSERT INTO users (email,name,company,password_hash) VALUES (?,?,?,?)').run(email.toLowerCase(), name.trim(), company?.trim() || null, bcrypt.hashSync(password, 10)).lastInsertRowid;
  if (withDemo) seedUserData(id);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(id);
  const token = setSession(req, res, u); res.json({ user: publicUser(u), token });
}));
app.post('/api/auth/login', wrap((req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.status(401).json({ error: 'Неверный email или пароль' });
  const token = setSession(req, res, u); res.json({ user: publicUser(u), token });
}));
app.post('/api/auth/logout', (req, res) => { const { maxAge, ...o } = cookieOpts(req); res.clearCookie('hl_token', o); res.json({ ok: true }); });
app.get('/api/auth/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));
app.patch('/api/auth/me', auth, wrap((req, res) => {
  const { name, company, password, currentPassword } = req.body || {};
  if (password) {
    if (!bcrypt.compareSync(currentPassword || '', req.user.password_hash)) return res.status(400).json({ error: 'Текущий пароль указан неверно' });
    if (password.length < 6) return res.status(400).json({ error: 'Новый пароль должен быть не короче 6 символов' });
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(password, 10), req.user.id);
  }
  db.prepare('UPDATE users SET name=COALESCE(?,name), company=? WHERE id=?').run(name?.trim() || null, company?.trim() ?? req.user.company, req.user.id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
}));
app.post('/api/demo/reset', auth, wrap((req, res) => {
  db.prepare('DELETE FROM hypotheses WHERE user_id=?').run(req.user.id);
  db.prepare('DELETE FROM datasets WHERE user_id=?').run(req.user.id);
  db.prepare('DELETE FROM events WHERE user_id=?').run(req.user.id);
  seedUserData(req.user.id);
  res.json({ ok: true });
}));

// ── hypotheses ──────────────────────────────────────────────────────────────
const H_FIELDS = ['title', 'marketplace', 'product', 'sku', 'stage', 'problem', 'action', 'expected', 'rationale', 'metric', 'baseline', 'target', 'target_pct', 'start_date', 'end_date', 'before_days', 'after_days', 'impact', 'confidence', 'ease', 'status', 'result', 'insights', 'next_steps', 'tags', 'budget', 'owner', 'dataset_id', 'dataset_sku'];
const STATUSES = ['planned', 'testing', 'completed', 'scaling', 'canceled'];
const STATUS_RU = { planned: 'Запланирована', testing: 'Тестируется', completed: 'Завершена', scaling: 'Масштабируется', canceled: 'Отменена' };
const hOut = h => h && ({ ...h, tags: J(h.tags, []), ice: Math.round(((h.impact || 0) * (h.confidence || 0) * (h.ease || 0)) ** (1 / 3) * 10) / 10 });
function clean(body) {
  const o = {};
  for (const f of H_FIELDS) if (f in body) {
    let v = body[f];
    if (f === 'tags') v = JSON.stringify(Array.isArray(v) ? v : []);
    else if (['impact', 'confidence', 'ease'].includes(f)) v = Math.max(1, Math.min(10, parseInt(v) || 5));
    else if (['baseline', 'target', 'target_pct', 'budget', 'before_days', 'after_days', 'dataset_id'].includes(f)) v = v === '' || v == null || isNaN(+v) ? null : +v;
    else if (typeof v === 'string') v = v.trim() || null;
    if (f === 'status' && !STATUSES.includes(v)) continue;
    o[f] = v;
  }
  return o;
}
const logEvent = (uid, hid, type, text) => db.prepare('INSERT INTO events (user_id,hypothesis_id,type,text) VALUES (?,?,?,?)').run(uid, hid, type, text);

app.get('/api/hypotheses', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM hypotheses WHERE user_id=? ORDER BY updated_at DESC').all(req.user.id);
  res.json(rows.map(hOut));
});
app.get('/api/hypotheses/:id', auth, (req, res) => {
  const h = db.prepare('SELECT * FROM hypotheses WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!h) return res.status(404).json({ error: 'Гипотеза не найдена' });
  const events = db.prepare('SELECT * FROM events WHERE hypothesis_id=? ORDER BY created_at DESC, id DESC').all(h.id);
  res.json({ ...hOut(h), events });
});
app.post('/api/hypotheses', auth, wrap((req, res) => {
  const d = clean(req.body || {});
  if (!d.title) return res.status(400).json({ error: 'Укажите формулировку гипотезы' });
  d.status ||= 'planned'; d.user_id = req.user.id;
  const keys = Object.keys(d);
  const id = db.prepare(`INSERT INTO hypotheses (${keys.join(',')}) VALUES (${keys.map(k => '@' + k).join(',')})`).run(d).lastInsertRowid;
  logEvent(req.user.id, id, 'created', `Создана гипотеза «${d.title}»`);
  res.status(201).json(hOut(db.prepare('SELECT * FROM hypotheses WHERE id=?').get(id)));
}));
app.patch('/api/hypotheses/:id', auth, wrap((req, res) => {
  const h = db.prepare('SELECT * FROM hypotheses WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!h) return res.status(404).json({ error: 'Гипотеза не найдена' });
  const d = clean(req.body || {});
  if ('title' in d && !d.title) return res.status(400).json({ error: 'Формулировка не может быть пустой' });
  const keys = Object.keys(d);
  if (keys.length) db.prepare(`UPDATE hypotheses SET ${keys.map(k => `${k}=@${k}`).join(',')}, updated_at=datetime('now') WHERE id=@id`).run({ ...d, id: h.id });
  if (d.status && d.status !== h.status) logEvent(req.user.id, h.id, 'status', `Статус изменён на «${STATUS_RU[d.status]}»`);
  else if (keys.length && !(keys.length === 1 && keys[0] === 'status')) logEvent(req.user.id, h.id, 'edit', 'Гипотеза отредактирована');
  res.json(hOut(db.prepare('SELECT * FROM hypotheses WHERE id=?').get(h.id)));
}));
app.delete('/api/hypotheses/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM hypotheses WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Гипотеза не найдена' });
  res.json({ ok: true });
});
app.get('/api/hypotheses/:id/analysis', auth, wrap((req, res) => {
  const h = db.prepare('SELECT * FROM hypotheses WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!h) return res.status(404).json({ error: 'Гипотеза не найдена' });
  const dsId = req.query.dataset_id || h.dataset_id;
  if (!dsId) return res.json({ error: 'Датасет не привязан' });
  const ds = db.prepare('SELECT * FROM datasets WHERE id=? AND user_id=?').get(dsId, req.user.id);
  if (!ds) return res.status(404).json({ error: 'Датасет не найден' });
  const rows = db.prepare('SELECT date, sku, vals FROM dataset_rows WHERE dataset_id=?').all(ds.id);
  const sku = req.query.sku !== undefined ? (req.query.sku || null) : h.dataset_sku;
  const override = { ...h };
  for (const k of ['start_date', 'end_date']) if (req.query[k]) override[k] = req.query[k];
  for (const k of ['before_days', 'after_days']) if (req.query[k]) override[k] = +req.query[k];
  res.json({ dataset: { id: ds.id, name: ds.name, skus: J(ds.skus, []) }, sku, ...analyse({ rows, hypothesis: override, sku }) });
}));

// ── datasets ────────────────────────────────────────────────────────────────
const dOut = d => d && ({ ...d, metrics: J(d.metrics, []), skus: J(d.skus, []), mapping: J(d.mapping, []), warnings: J(d.warnings, []) });
app.get('/api/datasets', auth, (req, res) => {
  const rows = db.prepare(`SELECT d.*, (SELECT COUNT(*) FROM hypotheses h WHERE h.dataset_id=d.id) AS hypotheses_count FROM datasets d WHERE user_id=? ORDER BY created_at DESC, id DESC`).all(req.user.id);
  res.json(rows.map(dOut));
});
app.get('/api/datasets/:id', auth, (req, res) => {
  const ds = db.prepare('SELECT * FROM datasets WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!ds) return res.status(404).json({ error: 'Датасет не найден' });
  const rows = db.prepare('SELECT date, sku, vals FROM dataset_rows WHERE dataset_id=?').all(ds.id);
  const series = dailySeries(rows, req.query.sku || null);
  const hyps = db.prepare('SELECT id,title,status,start_date,end_date,metric FROM hypotheses WHERE dataset_id=? AND user_id=?').all(ds.id, req.user.id);
  res.json({ ...dOut(ds), series, hypotheses: hyps });
});
app.patch('/api/datasets/:id', auth, (req, res) => {
  const { name, marketplace } = req.body || {};
  const r = db.prepare('UPDATE datasets SET name=COALESCE(?,name), marketplace=COALESCE(?,marketplace) WHERE id=? AND user_id=?').run(name?.trim() || null, marketplace || null, req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Датасет не найден' });
  res.json(dOut(db.prepare('SELECT * FROM datasets WHERE id=?').get(req.params.id)));
});
app.delete('/api/datasets/:id', auth, (req, res) => {
  const r = db.prepare('DELETE FROM datasets WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: 'Датасет не найден' });
  res.json({ ok: true });
});
app.get('/api/datasets/:id/baseline', auth, (req, res) => {
  const ds = db.prepare('SELECT id FROM datasets WHERE id=? AND user_id=?').get(req.params.id, req.user.id);
  if (!ds) return res.status(404).json({ error: 'Датасет не найден' });
  const rows = db.prepare('SELECT date, sku, vals FROM dataset_rows WHERE dataset_id=?').all(ds.id);
  res.json(baseline(rows, req.query.metric, req.query.sku || null, +req.query.days || 28));
});

// Upload: 2-step (preview → confirm mapping → commit). Buffers are kept in memory for 30 min.
const pending = new Map();
setInterval(() => { const now = Date.now(); for (const [k, v] of pending) if (now - v.ts > 30 * 60e3) pending.delete(k); }, 60e3).unref();

function buildPreview(entry, sheetName, customMapping) {
  const sheet = previewPayload(entry.sheets, sheetName);
  if (!sheet || !sheet.best) return { error: 'Не удалось найти таблицу с датами и метриками. Проверьте, что в файле есть колонка с датой (или даты в заголовках столбцов) и числовые показатели.', sheets: entry.sheets.map(s => ({ name: s.name, ok: !!s.best })) };
  const analysis = customMapping ? { ...sheet.best, mapping: customMapping } : sheet.best;
  if (analysis.layout === 'long' && !analysis.mapping.some(m => m.role === 'date')) return { error: 'Не выбрана колонка с датой' };
  const ex = extract(sheet, analysis);
  const hdr = analysis.headerRow;
  const sample = sheet.rows.slice(hdr, hdr + 9).map(r => (r || []).slice(0, 40).map(c => c instanceof Date ? parseDate(c)?.date : c));
  return {
    sheet: sheet.name,
    sheets: entry.sheets.map(s => ({ name: s.name, ok: !!s.best, rows: s.rows.length })),
    layout: analysis.layout, headerRow: hdr, sample,
    mapping: analysis.mapping.map(m => {
      let ex = analysis.layout === 'long' ? sheet.rows[hdr + 1]?.[m.col] : sheet.rows[m.row]?.[analysis.dateCols[0]];
      if (ex instanceof Date) ex = parseDate(ex)?.date;
      return { ...m, example: ex == null ? '' : String(ex).slice(0, 24) };
    }),
    summary: { dateFrom: ex.dateFrom, dateTo: ex.dateTo, days: ex.days, records: ex.records.length, metrics: ex.metrics, derived: ex.derived, skus: ex.skus.slice(0, 200), gran: ex.gran, warnings: ex.warnings },
    series: dailySeries(ex.records, null).map(d => ({ date: d.date, orders: d.orders, revenue: d.revenue ?? d.order_sum, views: d.views })),
  };
}

app.post('/api/datasets/preview', auth, upload.single('file'), wrap((req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  if (!/\.(xlsx|xls|xlsm|csv)$/i.test(req.file.originalname)) return res.status(400).json({ error: 'Поддерживаются файлы .xlsx, .xls, .xlsm, .csv' });
  let parsed;
  try { parsed = inspectWorkbook(req.file.buffer); } catch (e) { return res.status(400).json({ error: 'Не удалось прочитать файл: он повреждён или защищён паролем' }); }
  const token = crypto.randomBytes(12).toString('hex');
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const entry = { uid: req.user.id, filename: name, sheets: parsed.sheets, ts: Date.now() };
  pending.set(token, entry);
  res.json({ token, filename: name, ...buildPreview(entry) });
}));
app.post('/api/datasets/preview/:token', auth, wrap((req, res) => {
  const entry = pending.get(req.params.token);
  if (!entry || entry.uid !== req.user.id) return res.status(410).json({ error: 'Сессия загрузки истекла, загрузите файл заново' });
  res.json({ token: req.params.token, filename: entry.filename, ...buildPreview(entry, req.body.sheet, req.body.mapping) });
}));
app.post('/api/datasets/commit/:token', auth, wrap((req, res) => {
  const entry = pending.get(req.params.token);
  if (!entry || entry.uid !== req.user.id) return res.status(410).json({ error: 'Сессия загрузки истекла, загрузите файл заново' });
  const sheet = previewPayload(entry.sheets, req.body.sheet);
  if (!sheet?.best) return res.status(400).json({ error: 'Лист не содержит распознанной таблицы' });
  const analysis = req.body.mapping ? { ...sheet.best, mapping: req.body.mapping } : sheet.best;
  const ex = extract(sheet, analysis);
  if (!ex.records.length || !ex.metrics.length) return res.status(400).json({ error: 'Не найдено ни одной строки с датой и метриками' });
  const id = saveDataset(req.user.id, { name: req.body.name?.trim() || entry.filename.replace(/\.\w+$/, ''), filename: entry.filename, marketplace: req.body.marketplace || null, sheet: sheet.name, analysis, ex });
  pending.delete(req.params.token);
  res.status(201).json(dOut(db.prepare('SELECT * FROM datasets WHERE id=?').get(id)));
}));

app.get('/api/samples/:file', (req, res) => {
  const f = path.basename(req.params.file);
  const p = path.join(SAMPLES_DIR, f);
  if (!fs.existsSync(p)) return res.status(404).end();
  res.download(p);
});

// ── stats ───────────────────────────────────────────────────────────────────
app.get('/api/stats', auth, (req, res) => {
  const hs = db.prepare('SELECT * FROM hypotheses WHERE user_id=?').all(req.user.id);
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, hs.filter(h => h.status === s).length]));
  const byStage = {}; hs.forEach(h => { byStage[h.stage || 'other'] = (byStage[h.stage || 'other'] || 0) + 1; });
  const events = db.prepare(`SELECT e.*, h.title FROM events e LEFT JOIN hypotheses h ON h.id=e.hypothesis_id WHERE e.user_id=? ORDER BY e.created_at DESC, e.id DESC LIMIT 12`).all(req.user.id);
  const done = hs.filter(h => ['completed', 'scaling'].includes(h.status)).length;
  const datasets = db.prepare('SELECT COUNT(*) c FROM datasets WHERE user_id=?').get(req.user.id).c;
  // weekly velocity (created per week, last 10 weeks)
  const weeks = [];
  for (let i = 9; i >= 0; i--) {
    const to = new Date(Date.now() - i * 7 * 864e5), from = new Date(to.getTime() - 7 * 864e5);
    const inRange = s => s && new Date(s.replace(' ', 'T') + 'Z') > from && new Date(s.replace(' ', 'T') + 'Z') <= to;
    weeks.push({ week: to.toISOString().slice(5, 10), created: hs.filter(h => inRange(h.created_at)).length, finished: db.prepare(`SELECT COUNT(*) c FROM events WHERE user_id=? AND type='status' AND created_at>? AND created_at<=?`).get(req.user.id, from.toISOString().replace('T', ' ').slice(0, 19), to.toISOString().replace('T', ' ').slice(0, 19)).c });
  }
  res.json({ total: hs.length, byStatus, byStage, events, done, datasets, weeks, successRate: done ? Math.round(hs.filter(h => h.status === 'scaling').length / done * 100) : 0 });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => { console.error(err); res.status(err.status || 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Файл больше 15 МБ' : 'Внутренняя ошибка сервера' }); });

// Production: serve built SPA
const distDir = path.join(__dirname, '..', 'webapp');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, setHeaders: (res, f) => { if (/assets/.test(f)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); } }));
  app.get(/^(?!\/api).*/, (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.sendFile(path.join(distDir, 'index.html')); });
}
app.listen(PORT, '0.0.0.0', () => console.log(`API on http://0.0.0.0:${PORT}`));
