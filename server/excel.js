// ─────────────────────────────────────────────────────────────────────────────
// Excel parser for marketplace analytics (Wildberries, Ozon, Яндекс Маркет, ...)
//
// Pipeline:
//  1. Read workbook (SheetJS) → every sheet as 2D array of raw cells.
//  2. For every sheet detect the layout:
//       • "long"  – one row = one day (optionally × SKU), columns = metrics
//       • "wide"  – one row = one metric, columns = dates (typical for exports
//                   of "Воронка продаж" by days or hand-made pivot tables)
//     Header row is searched in the first 25 rows and scored by the number of
//     recognised metric columns + presence of a date column.
//  3. Headers are normalised (lowercase, ё→е, units / punctuation stripped) and
//     fuzzy-matched against the metric dictionary (shared/metrics.json) –
//     exact alias → alias contained in header → token overlap.
//  4. Dates are parsed from JS Date objects, Excel serial numbers, ISO, dd.mm.yyyy,
//     dd/mm/yy, "5 сентября 2025", "сен 2025" and ranges "01.09–07.09.2025"
//     (range → first day, granularity flagged as weekly/monthly).
//  5. Numbers are parsed from "1 234,5 ₽", "12,5%", "−3", "(1 200)" etc.
//     Ratio metrics stored as fractions (12,5% → 0.125).
//  6. The best sheet wins; rows are aggregated per (date, sku).
// ─────────────────────────────────────────────────────────────────────────────
import XLSX from 'xlsx';
import { METRICS, METRIC_MAP } from './metrics.js';

const MONTHS = {
  'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'мая': 5, 'май': 5, 'июн': 6, 'июл': 7, 'авг': 8,
  'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12,
  'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9,
  'oct': 10, 'nov': 11, 'dec': 12,
};

const DATE_HEADERS = ['дата', 'date', 'день', 'период', 'day', 'dt', 'отчетная дата', 'дата заказа', 'дата отчета', 'неделя', 'месяц'];
const SKU_HEADERS = ['артикул', 'sku', 'nmid', 'nm id', 'артикул wb', 'артикул продавца', 'артикул ozon', 'offer id', 'номенклатура', 'товар', 'название товара', 'наименование', 'product', 'item', 'ску', 'код товара', 'баркод'];

export function normHeader(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[,;]\s*(шт|руб|₽|%|р|rub|pcs)\.?\s*$/g, ' ')
    .replace(/\b(шт|руб|rub|pcs)\b\.?/g, ' ')
    .replace(/[₽%№"'«»:*]/g, ' ')
    .replace(/[_\-–—/\\.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ALIAS_INDEX = METRICS.flatMap(m => m.aliases.map(a => ({ key: m.key, alias: normHeader(a) })));

/** Match a raw header against the metric dictionary → { key, score } | null */
export function matchMetric(raw) {
  const h = normHeader(raw);
  if (!h) return null;
  let best = null;
  for (const { key, alias } of ALIAS_INDEX) {
    let score = 0;
    if (h === alias) score = 100;
    else if (h.startsWith(alias + ' ') || h.endsWith(' ' + alias)) score = 80 + alias.length / 10;
    else if (alias.length >= 4 && h.includes(alias)) score = 60 + alias.length / 10;
    else {
      const ht = new Set(h.split(' ')), at = alias.split(' ');
      const hit = at.filter(t => t.length > 2 && [...ht].some(x => x.startsWith(t.slice(0, Math.max(4, t.length - 2))))).length;
      if (hit && hit === at.length) score = 40 + hit;
    }
    if (score && (!best || score > best.score)) best = { key, score };
  }
  // Percent-flavoured header should prefer ratio metric ("Конверсия в корзину, %")
  if (best && /%|процент|конверс|ctr/.test(String(raw).toLowerCase())) {
    const m = METRIC_MAP[best.key];
    if (m.type !== 'ratio' && best.key !== 'buyout_rate') best.score -= 10;
  }
  return best && best.score >= 40 ? best : null;
}

function iso(y, m, d) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** Parse a cell into ISO date → { date, gran } | null */
export function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v)) {
    // SheetJS returns local-time dates, sometimes a few seconds/minutes before midnight
    // (historic TZ offsets). Round late-evening values up to the next day.
    const d = v.getHours() >= 20 ? new Date(v.getTime() + 5 * 3600e3) : v;
    return { date: iso(d.getFullYear(), d.getMonth() + 1, d.getDate()), gran: 'day' };
  }
  if (typeof v === 'number') {
    if (v > 36526 && v < 73051) { // 2000-01-01 … 2100-01-01 as Excel serial
      const p = XLSX.SSF.parse_date_code(v);
      return p ? { date: iso(p.y, p.m, p.d), gran: 'day' } : null;
    }
    return null;
  }
  let s = String(v).trim().toLowerCase().replace(/ё/g, 'е');
  if (s.length > 60) return null;
  let gran = 'day';
  // Range → take the first date
  const range = s.split(/\s*(?:—|–|-{1,2}|по|to)\s+|\s+(?:—|–)\s*/);
  if (range.length === 2 && /\d/.test(range[0]) && /\d/.test(range[1])) {
    const a = parseDate(range[0]) || parseDate(range[0] + '.' + (range[1].match(/(\d{2,4})$/) || [])[1]);
    const b = parseDate(range[1]);
    if (a && b) {
      const days = (new Date(b.date) - new Date(a.date)) / 864e5;
      return { date: a.date, gran: days >= 27 ? 'month' : days >= 5 ? 'week' : 'day' };
    }
  }
  s = s.replace(/^с\s+/, '').replace(/\s*г\.?$/, '');
  let m;
  if ((m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ t].*)?$/))) return wrap(iso(+m[1], +m[2], +m[3]));
  if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})(?:\s.*)?$/))) return wrap(iso(+m[3], +m[2], +m[1]));
  if ((m = s.match(/^(\d{1,2})\s+([a-zа-я]+)\.?\s+(\d{4})/))) {
    const mon = MONTHS[m[2].slice(0, 3)];
    return mon ? wrap(iso(+m[3], mon, +m[1])) : null;
  }
  if ((m = s.match(/^([a-zа-я]+)\.?\s+(\d{4})$/))) {
    const mon = MONTHS[m[1].slice(0, 3)];
    return mon ? { date: iso(+m[2], mon, 1), gran: 'month' } : null;
  }
  return null;
  function wrap(d) { return d ? { date: d, gran } : null; }
}

/** Parse a numeric cell ("1 234,5 ₽", "12,5%", "(300)") → { n, pct } | null */
export function parseNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? { n: v, pct: false } : null;
  if (typeof v === 'boolean' || v instanceof Date) return null;
  let s = String(v).trim();
  if (!s || s === '-' || s === '—') return null;
  const pct = s.includes('%');
  let neg = /^\(.*\)$/.test(s) || /^[-−–]/.test(s);
  s = s.replace(/[\s\u00a0\u202f₽%$€]|руб\.?|р\.|шт\.?/gi, '').replace(/^[(−–-]+|\)$/g, '');
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  if (!/^\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = parseFloat(s) * (neg ? -1 : 1);
  return isFinite(n) ? { n, pct } : null;
}

function isDateHeader(h) { const n = normHeader(h); return DATE_HEADERS.some(d => n === d || n.startsWith(d + ' ') || n.endsWith(' ' + d)); }
function isSkuHeader(h) { const n = normHeader(h); return SKU_HEADERS.some(d => n === d || n.startsWith(d)); }

function analyseLong(rows, hIdx) {
  const header = rows[hIdx].map(c => (c == null ? '' : String(c)));
  const body = rows.slice(hIdx + 1).filter(r => r && r.some(c => c !== '' && c != null));
  if (body.length < 1) return null;
  const cols = header.map((h, i) => ({ i, header: h.trim() }));
  // Date column: header hint or ≥70% parsable values
  let dateCol = null, bestRatio = 0;
  for (const c of cols) {
    const sample = body.slice(0, 200).map(r => r[c.i]).filter(v => v !== '' && v != null);
    if (!sample.length) continue;
    const ratio = sample.filter(v => parseDate(v)).length / sample.length;
    const bonus = isDateHeader(c.header) ? 0.3 : 0;
    if (ratio >= 0.7 && ratio + bonus > bestRatio) { bestRatio = ratio + bonus; dateCol = c.i; }
  }
  if (dateCol == null) return null;
  const skuCol = cols.find(c => c.i !== dateCol && isSkuHeader(c.header))?.i ?? null;
  const used = new Set();
  const mapping = cols.map(c => {
    if (c.i === dateCol) return { col: c.i, header: c.header || `Колонка ${c.i + 1}`, role: 'date' };
    if (c.i === skuCol) return { col: c.i, header: c.header, role: 'sku' };
    if (!c.header) return { col: c.i, header: `Колонка ${c.i + 1}`, role: 'ignore' };
    const numeric = body.slice(0, 100).map(r => r[c.i]).filter(v => v !== '' && v != null);
    const numRatio = numeric.length ? numeric.filter(v => parseNumber(v)).length / numeric.length : 0;
    const m = matchMetric(c.header);
    if (m && numRatio >= 0.6) {
      return { col: c.i, header: c.header, role: 'metric', metric: m.key, confidence: Math.min(100, Math.round(m.score)) };
    }
    return { col: c.i, header: c.header, role: 'ignore', numeric: numRatio >= 0.6 };
  });
  // Resolve duplicates: keep highest-confidence column per metric
  mapping.filter(m => m.role === 'metric').sort((a, b) => b.confidence - a.confidence).forEach(m => {
    if (used.has(m.metric)) { m.role = 'ignore'; m.duplicateOf = m.metric; delete m.metric; } else used.add(m.metric);
  });
  const score = used.size * 10 + (skuCol != null ? 2 : 0) + Math.min(body.length, 400) / 100;
  return { layout: 'long', headerRow: hIdx, mapping, score, bodyRows: body.length };
}

function analyseWide(rows, hIdx) {
  const header = rows[hIdx];
  const dateCols = header.map((c, i) => ({ i, d: parseDate(c) })).filter(x => x.d);
  if (dateCols.length < 3) return null;
  const body = rows.slice(hIdx + 1);
  const firstDateCol = dateCols[0].i;
  const mapping = [];
  const used = new Set();
  body.forEach((r, ri) => {
    if (!r) return;
    const label = r.slice(0, firstDateCol).map(x => (x == null ? '' : String(x))).filter(Boolean).join(' ').trim();
    if (!label) return;
    const m = matchMetric(label);
    const entry = { row: hIdx + 1 + ri, header: label, role: 'ignore' };
    if (m && !used.has(m.key)) { used.add(m.key); Object.assign(entry, { role: 'metric', metric: m.key, confidence: Math.round(Math.min(100, m.score)) }); }
    mapping.push(entry);
  });
  return { layout: 'wide', headerRow: hIdx, mapping, dateCols: dateCols.map(d => d.i), score: used.size * 10 + dateCols.length / 100, bodyRows: dateCols.length };
}

function toNumber(metricKey, v) {
  const p = parseNumber(v);
  if (!p) return null;
  const m = METRIC_MAP[metricKey];
  let n = p.n;
  if (m && m.format === 'pct' && (p.pct || n > 1.5)) n = n / 100;
  return n;
}

/** Inspect workbook → best layout per sheet */
export function inspectWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheets = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
    if (!rows.length) continue;
    let best = null;
    for (let h = 0; h < Math.min(25, rows.length - 1); h++) {
      if (!rows[h] || rows[h].filter(c => c !== '').length < 2) continue;
      for (const cand of [analyseLong(rows, h), analyseWide(rows, h)]) {
        if (cand && (!best || cand.score > best.score)) best = cand;
      }
    }
    sheets.push({ name, rows, best });
  }
  return { wb, sheets };
}

/** Extract normalised daily records using a (possibly user-edited) mapping */
export function extract(sheet, analysis) {
  const { rows } = sheet;
  const out = new Map(); // key date|sku → vals
  const counters = new Map();
  const grans = {};
  const warnings = [];
  let skipped = 0;
  const put = (date, sku, key, n) => {
    const k = date + '|' + (sku || '');
    if (!out.has(k)) out.set(k, { date, sku: sku || null, vals: {} });
    const rec = out.get(k);
    const meta = METRIC_MAP[key];
    if (meta.type === 'sum') rec.vals[key] = (rec.vals[key] || 0) + n;
    else { // average duplicates for avg / ratio metrics
      const ck = k + key; const c = (counters.get(ck) || 0) + 1; counters.set(ck, c);
      rec.vals[key] = rec.vals[key] == null ? n : rec.vals[key] + (n - rec.vals[key]) / c;
    }
  };
  if (analysis.layout === 'long') {
    const dateM = analysis.mapping.find(m => m.role === 'date');
    const skuM = analysis.mapping.find(m => m.role === 'sku');
    const metrics = analysis.mapping.filter(m => m.role === 'metric' && m.metric);
    for (const r of rows.slice(analysis.headerRow + 1)) {
      if (!r || !r.some(c => c !== '')) continue;
      const d = parseDate(r[dateM.col]);
      if (!d) { skipped++; continue; }
      grans[d.gran] = (grans[d.gran] || 0) + 1;
      const sku = skuM ? String(r[skuM.col] ?? '').trim() : null;
      for (const m of metrics) { const n = toNumber(m.metric, r[m.col]); if (n != null) put(d.date, sku, m.metric, n); }
    }
  } else {
    const header = rows[analysis.headerRow];
    const metrics = analysis.mapping.filter(m => m.role === 'metric' && m.metric);
    for (const ci of analysis.dateCols) {
      const d = parseDate(header[ci]); if (!d) continue;
      grans[d.gran] = (grans[d.gran] || 0) + 1;
      for (const m of metrics) { const n = toNumber(m.metric, rows[m.row]?.[ci]); if (n != null) put(d.date, null, m.metric, n); }
    }
  }
  const records = [...out.values()].sort((a, b) => a.date.localeCompare(b.date));
  const gran = Object.entries(grans).sort((a, b) => b[1] - a[1])[0]?.[0] || 'day';
  if (skipped) warnings.push(`Пропущено строк без распознаваемой даты: ${skipped} (итоги, пустые строки и т.п.)`);
  if (gran !== 'day') warnings.push(`Данные агрегированы по ${gran === 'week' ? 'неделям' : 'месяцам'} — точность разбивки периодов эксперимента снижена.`);
  const dates = [...new Set(records.map(r => r.date))];
  if (dates.length > 1) {
    const span = (new Date(dates.at(-1)) - new Date(dates[0])) / 864e5 + 1;
    if (gran === 'day' && dates.length < span * 0.9) warnings.push(`В данных есть пропуски: ${Math.round(span - dates.length)} дн. без значений.`);
  }
  const metrics = [...new Set(records.flatMap(r => Object.keys(r.vals)))];
  // Derivable ratio metrics
  const derivable = METRICS.filter(m => m.derive && !metrics.includes(m.key) && m.derive.every(k => metrics.includes(k))).map(m => m.key);
  const skus = [...new Set(records.map(r => r.sku).filter(Boolean))];
  return { records, gran, warnings, metrics: [...metrics, ...derivable], derived: derivable, skus, dateFrom: dates[0], dateTo: dates.at(-1), days: dates.length };
}

export function previewPayload(sheets, sheetName) {
  const sheet = sheetName ? sheets.find(s => s.name === sheetName) : [...sheets].filter(s => s.best).sort((a, b) => b.best.score - a.best.score)[0];
  return sheet;
}
