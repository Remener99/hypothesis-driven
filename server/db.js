import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'hypolab.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS datasets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filename TEXT,
  marketplace TEXT,
  sheet TEXT,
  format TEXT,
  date_from TEXT,
  date_to TEXT,
  rows_count INTEGER DEFAULT 0,
  days_count INTEGER DEFAULT 0,
  metrics TEXT DEFAULT '[]',
  skus TEXT DEFAULT '[]',
  mapping TEXT DEFAULT '[]',
  warnings TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS dataset_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  sku TEXT,
  vals TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rows_ds ON dataset_rows(dataset_id, date);
CREATE TABLE IF NOT EXISTS hypotheses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  marketplace TEXT,
  product TEXT,
  sku TEXT,
  stage TEXT,
  problem TEXT,
  action TEXT,
  expected TEXT,
  rationale TEXT,
  metric TEXT,
  baseline REAL,
  target REAL,
  target_pct REAL,
  start_date TEXT,
  end_date TEXT,
  before_days INTEGER,
  after_days INTEGER,
  impact INTEGER DEFAULT 5,
  confidence INTEGER DEFAULT 5,
  ease INTEGER DEFAULT 5,
  status TEXT DEFAULT 'planned',
  result TEXT,
  insights TEXT,
  next_steps TEXT,
  tags TEXT DEFAULT '[]',
  budget REAL,
  owner TEXT,
  dataset_id INTEGER REFERENCES datasets(id) ON DELETE SET NULL,
  dataset_sku TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hypothesis_id INTEGER REFERENCES hypotheses(id) ON DELETE CASCADE,
  type TEXT,
  text TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
`);
