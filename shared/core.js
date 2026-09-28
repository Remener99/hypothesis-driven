// Pure business logic shared by the Express API and the in-browser backend.
import { extract, previewPayload, parseDate } from './excel.js';
import { dailySeries } from './analysis.js';
import { STATUS_RU } from './demo.js';

export { STATUS_RU };
export const STATUSES = ['planned', 'testing', 'completed', 'scaling', 'canceled'];
export const H_FIELDS = ['title', 'marketplace', 'product', 'sku', 'stage', 'problem', 'action', 'expected', 'rationale', 'metric', 'baseline', 'target', 'target_pct', 'start_date', 'end_date', 'before_days', 'after_days', 'impact', 'confidence', 'ease', 'status', 'result', 'insights', 'next_steps', 'tags', 'budget', 'owner', 'dataset_id', 'dataset_sku'];

export const J = (s, d) => { if (s == null) return d; if (typeof s !== 'string') return s; try { return JSON.parse(s); } catch { return d; } };
export const nowSql = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
export const iceOf = h => Math.round(((h.impact || 0) * (h.confidence || 0) * (h.ease || 0)) ** (1 / 3) * 10) / 10;

/** Validate & normalise an incoming hypothesis payload. `tagsAsJson` — SQLite stores tags as JSON text. */
export function cleanHypothesis(body, { tagsAsJson = true } = {}) {
  const o = {};
  for (const f of H_FIELDS) if (f in body) {
    let v = body[f];
    if (f === 'tags') { const arr = Array.isArray(v) ? v : []; v = tagsAsJson ? JSON.stringify(arr) : arr; }
    else if (['impact', 'confidence', 'ease'].includes(f)) v = Math.max(1, Math.min(10, parseInt(v) || 5));
    else if (['baseline', 'target', 'target_pct', 'budget', 'before_days', 'after_days', 'dataset_id'].includes(f)) v = v === '' || v == null || isNaN(+v) ? null : +v;
    else if (typeof v === 'string') v = v.trim() || null;
    if (f === 'status' && !STATUSES.includes(v)) continue;
    o[f] = v;
  }
  return o;
}
export const hypothesisOut = h => h && ({ ...h, tags: J(h.tags, []), ice: iceOf(h) });
export const datasetOut = d => d && ({ ...d, metrics: J(d.metrics, []), skus: J(d.skus, []), mapping: J(d.mapping, []), warnings: J(d.warnings, []) });

/** Build the upload preview payload (step 1/2 of the import wizard). */
export function buildPreview(entry, sheetName, customMapping) {
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
      let ex0 = analysis.layout === 'long' ? sheet.rows[hdr + 1]?.[m.col] : sheet.rows[m.row]?.[analysis.dateCols[0]];
      if (ex0 instanceof Date) ex0 = parseDate(ex0)?.date;
      return { ...m, example: ex0 == null ? '' : String(ex0).slice(0, 24) };
    }),
    summary: { dateFrom: ex.dateFrom, dateTo: ex.dateTo, days: ex.days, records: ex.records.length, metrics: ex.metrics, derived: ex.derived, skus: ex.skus.slice(0, 200), gran: ex.gran, warnings: ex.warnings },
    series: dailySeries(ex.records, null).map(d => ({ date: d.date, orders: d.orders, revenue: d.revenue ?? d.order_sum, views: d.views })),
  };
}

/** Extract records for commit (step 2/2). Returns { sheet, analysis, ex } or { error }. */
export function prepareCommit(entry, sheetName, mapping) {
  const sheet = previewPayload(entry.sheets, sheetName);
  if (!sheet?.best) return { error: 'Лист не содержит распознанной таблицы' };
  const analysis = mapping ? { ...sheet.best, mapping } : sheet.best;
  const ex = extract(sheet, analysis);
  if (!ex.records.length || !ex.metrics.length) return { error: 'Не найдено ни одной строки с датой и метриками' };
  return { sheet, analysis, ex };
}

export function datasetRecord({ name, filename, marketplace, sheet, analysis, ex }) {
  return { name, filename, marketplace, sheet, format: analysis.layout + ':' + ex.gran, date_from: ex.dateFrom, date_to: ex.dateTo, rows_count: ex.records.length, days_count: ex.days, metrics: ex.metrics, skus: ex.skus, mapping: analysis.mapping.map(({ example, ...m }) => m), warnings: ex.warnings };
}

/** Dashboard stats. `events` — newest first, with `title` joined; `allEvents` — every event of the user. */
export function computeStats(hs, events, allEvents, datasets) {
  const byStatus = Object.fromEntries(STATUSES.map(s => [s, hs.filter(h => h.status === s).length]));
  const byStage = {}; hs.forEach(h => { byStage[h.stage || 'other'] = (byStage[h.stage || 'other'] || 0) + 1; });
  const done = hs.filter(h => ['completed', 'scaling'].includes(h.status)).length;
  const toDate = s => new Date(String(s).replace(' ', 'T') + 'Z');
  const weeks = [];
  for (let i = 9; i >= 0; i--) {
    const to = new Date(Date.now() - i * 7 * 864e5), from = new Date(to.getTime() - 7 * 864e5);
    const inRange = s => s && toDate(s) > from && toDate(s) <= to;
    weeks.push({ week: to.toISOString().slice(5, 10), created: hs.filter(h => inRange(h.created_at)).length, finished: allEvents.filter(e => e.type === 'status' && inRange(e.created_at)).length });
  }
  return { total: hs.length, byStatus, byStage, events: events.slice(0, 12), done, datasets, weeks, successRate: done ? Math.round(hs.filter(h => h.status === 'scaling').length / done * 100) : 0 };
}
