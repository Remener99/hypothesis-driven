// Server-side seeding: writes demo .xlsx samples to disk and imports them through the
// same parser as user uploads. Demo content itself lives in shared/demo.js.
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import XLSX from '../shared/xlsx.js';
import { db } from './db.js';
import { inspectWorkbook, extract, previewPayload } from '../shared/excel.js';
import { buildWorkbooks, demoHypotheses, DEMO_DATASETS } from '../shared/demo.js';
import { datasetRecord } from '../shared/core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLES_DIR = path.join(__dirname, '..', 'samples');

export function buildSampleFiles() {
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  for (const [file, wb] of Object.entries(buildWorkbooks())) XLSX.writeFile(wb, path.join(SAMPLES_DIR, file));
}

export function importDataset(userId, filePath, { name, marketplace }) {
  const { sheets } = inspectWorkbook(fs.readFileSync(filePath));
  const sheet = previewPayload(sheets);
  const ex = extract(sheet, sheet.best);
  return saveDataset(userId, { name, filename: path.basename(filePath), marketplace, sheet: sheet.name, analysis: sheet.best, ex });
}

export function saveDataset(userId, { name, filename, marketplace, sheet, analysis, ex }) {
  const r = datasetRecord({ name, filename, marketplace, sheet, analysis, ex });
  const tx = db.transaction(() => {
    const info = db.prepare(`INSERT INTO datasets (user_id,name,filename,marketplace,sheet,format,date_from,date_to,rows_count,days_count,metrics,skus,mapping,warnings)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(userId, r.name, r.filename, r.marketplace, r.sheet, r.format, r.date_from, r.date_to, r.rows_count, r.days_count,
      JSON.stringify(r.metrics), JSON.stringify(r.skus), JSON.stringify(r.mapping), JSON.stringify(r.warnings));
    const ins = db.prepare('INSERT INTO dataset_rows (dataset_id,date,sku,vals) VALUES (?,?,?,?)');
    for (const rec of ex.records) ins.run(info.lastInsertRowid, rec.date, rec.sku, JSON.stringify(rec.vals));
    return info.lastInsertRowid;
  });
  return tx();
}

export function seedUserData(userId) {
  const ids = {};
  for (const d of DEMO_DATASETS) ids[d.key] = importDataset(userId, path.join(SAMPLES_DIR, d.file), d);
  const cols = ['title', 'marketplace', 'product', 'sku', 'stage', 'problem', 'action', 'expected', 'rationale', 'metric', 'baseline', 'target', 'target_pct', 'start_date', 'end_date', 'impact', 'confidence', 'ease', 'status', 'result', 'insights', 'next_steps', 'tags', 'budget', 'owner', 'dataset_id', 'dataset_sku', 'created_at', 'updated_at'];
  const ins = db.prepare(`INSERT INTO hypotheses (user_id,${cols.join(',')}) VALUES (@user_id,${cols.map(c => '@' + c).join(',')})`);
  const ev = db.prepare('INSERT INTO events (user_id,hypothesis_id,type,text,created_at) VALUES (?,?,?,?,?)');
  db.transaction(() => {
    for (const { row, events } of demoHypotheses(ids)) {
      const rec = { user_id: userId };
      for (const c of cols) rec[c] = row[c] ?? null;
      rec.tags = JSON.stringify(row.tags || []);
      const id = ins.run(rec).lastInsertRowid;
      for (const e of events) ev.run(userId, id, e.type, e.text, e.created_at);
    }
  })();
}

export function ensureDemo() {
  buildSampleFiles();
  if (db.prepare('SELECT id FROM users WHERE email=?').get('demo@hypolab.ru')) return;
  const id = db.prepare('INSERT INTO users (email,name,company,password_hash) VALUES (?,?,?,?)').run('demo@hypolab.ru', 'Анна Ковалёва', 'Льняная мастерская', bcrypt.hashSync('demo1234', 10)).lastInsertRowid;
  seedUserData(id);
  console.log('Demo user created: demo@hypolab.ru / demo1234');
}
