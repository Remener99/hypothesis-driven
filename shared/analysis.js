// Before / during / after experiment analysis over a normalised daily dataset.
import { METRICS, METRIC_MAP } from './metricsIndex.js';

const DAY = 864e5;
export const addDays = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / DAY);

/** Collapse rows (date, sku, vals) into per-day totals (optionally filtered by SKU). */
export function dailySeries(rows, sku) {
  const byDate = new Map();
  const cnt = new Map();
  for (const r of rows) {
    if (sku && r.sku !== sku) continue;
    const vals = typeof r.vals === 'string' ? JSON.parse(r.vals) : r.vals;
    if (!byDate.has(r.date)) byDate.set(r.date, {});
    const acc = byDate.get(r.date);
    for (const [k, v] of Object.entries(vals)) {
      const m = METRIC_MAP[k]; if (!m || v == null) continue;
      if (m.type === 'sum') acc[k] = (acc[k] || 0) + v;
      else { const ck = r.date + k; const c = (cnt.get(ck) || 0) + 1; cnt.set(ck, c); acc[k] = acc[k] == null ? v : acc[k] + (v - acc[k]) / c; }
    }
  }
  const days = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
  // derive ratios where absent
  for (const d of days) for (const m of METRICS) {
    if (m.derive && d[m.key] == null) {
      const [n, den] = m.derive;
      if (d[n] != null && d[den]) d[m.key] = d[n] / d[den];
    }
  }
  return days;
}

function periodValue(days, key) {
  const m = METRIC_MAP[key];
  const vals = days.map(d => d[key]).filter(v => v != null && isFinite(v));
  if (!vals.length) return null;
  if (m.type === 'sum') { const total = vals.reduce((a, b) => a + b, 0); return { value: total / vals.length, total, n: vals.length, daily: vals }; }
  if (m.type === 'ratio' && m.derive) {
    const [n, den] = m.derive;
    const num = days.reduce((a, d) => a + (d[n] || 0), 0), dd = days.reduce((a, d) => a + (d[den] || 0), 0);
    if (dd > 0 && days.some(d => d[n] != null)) return { value: num / dd, n: vals.length, daily: vals };
  }
  return { value: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length, daily: vals };
}

// ── statistics: Welch t-test ────────────────────────────────────────────────
function mean(a) { return a.reduce((x, y) => x + y, 0) / a.length; }
function variance(a) { const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); }
function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015;
  for (const ci of c) s += ci / ++y; return -t + Math.log(2.5066282746310005 * s / x);
}
function betacf(a, b, x) {
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30; d = 1 / d; let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30; c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30; d = 1 / d;
    const del = d * c; h *= del; if (Math.abs(del - 1) < 3e-7) break;
  }
  return h;
}
function ibeta(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
export function welch(a, b) {
  if (a.length < 3 || b.length < 3) return null;
  const va = variance(a) / a.length, vb = variance(b) / b.length;
  if (va + vb === 0) return { t: 0, df: a.length + b.length - 2, p: 1 };
  const t = (mean(b) - mean(a)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va ** 2 / (a.length - 1) + vb ** 2 / (b.length - 1));
  const p = ibeta(df / 2, 0.5, df / (df + t * t));
  return { t, df, p };
}

/** Main entry: full before/during/after analysis */
export function analyse({ rows, hypothesis, sku }) {
  const days = dailySeries(rows, sku);
  if (!days.length) return { error: 'В датасете нет данных' + (sku ? ` для артикула ${sku}` : '') };
  const h = hypothesis;
  if (!h.start_date) return { error: 'У гипотезы не указана дата начала эксперимента' };
  const dataFrom = days[0].date, dataTo = days.at(-1).date;
  const start = h.start_date;
  const end = h.end_date || dataTo;
  const dur = Math.max(1, diffDays(start, end) + 1);
  const beforeDays = h.before_days || Math.min(28, Math.max(dur, 14));
  const afterDays = h.after_days || Math.min(28, Math.max(dur, 14));
  const periods = {
    before: { from: addDays(start, -beforeDays), to: addDays(start, -1) },
    during: { from: start, to: end },
    after: { from: addDays(end, 1), to: addDays(end, afterDays) },
  };
  const inP = (d, p) => d.date >= p.from && d.date <= p.to;
  const split = Object.fromEntries(Object.entries(periods).map(([k, p]) => [k, days.filter(d => inP(d, p))]));
  const warnings = [];
  const today = new Date().toISOString().slice(0, 10);
  if (start > dataTo) warnings.push('Эксперимент начинается после последней даты в датасете — загрузите более свежую выгрузку.');
  if (periods.before.from < dataFrom) warnings.push(`Период «до» покрыт данными частично: данные начинаются с ${dataFrom}.`);
  if (end > dataTo && start <= dataTo) warnings.push(`Эксперимент ещё идёт или данные неполные: последняя дата в выгрузке ${dataTo}.`);
  if (!split.after.length && end <= dataTo) warnings.push('Нет данных за период «после» — влияние на долгосрочный эффект оценить нельзя.');
  else if (split.after.length && split.after.length < afterDays * 0.8 && end < today) warnings.push(`Период «после» покрыт на ${split.after.length} из ${afterDays} дн.`);

  const available = METRICS.filter(m => days.some(d => d[m.key] != null)).map(m => m.key);
  const metrics = available.map(key => {
    const m = METRIC_MAP[key];
    const b = periodValue(split.before, key), du = periodValue(split.during, key), a = periodValue(split.after, key);
    const lift = (x, y) => (x && y && x.value ? (y.value - x.value) / Math.abs(x.value) : null);
    const test = b && du ? welch(b.daily, du.daily) : null;
    const testAfter = b && a ? welch(b.daily, a.daily) : null;
    const strip = p => p && { value: p.value, total: p.total, n: p.n };
    return {
      key, label: m.label, format: m.format, lowerBetter: !!m.lowerBetter, type: m.type,
      before: strip(b), during: strip(du), after: strip(a),
      liftDuring: lift(b, du), liftAfter: lift(b, a),
      pDuring: test?.p ?? null, pAfter: testAfter?.p ?? null,
    };
  });

  // Confounders: price changes, stock-outs, ad budget jumps
  const avg = (arr, k) => { const v = arr.map(d => d[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const pb = avg(split.before, 'price'), pd = avg(split.during, 'price');
  if (pb && pd && Math.abs(pd / pb - 1) > 0.05 && h.metric !== 'price' && !/цен|скидк|акци|промо/i.test((h.action || '') + (h.title || '')))
    warnings.push(`Во время эксперимента средняя цена изменилась на ${((pd / pb - 1) * 100).toFixed(1)}% — это может исказить результат.`);
  const lowStock = split.during.filter(d => d.stock != null && d.stock < 20).length;
  if (lowStock) warnings.push(`${lowStock} дн. во время эксперимента остатки были критически низкими (<20 шт) — возможна упущенная выручка.`);
  const ab = avg(split.before, 'ad_spend'), ad = avg(split.during, 'ad_spend');
  if (ab && ad && ad / ab > 1.3 && !/реклам|ставк|аукцион|продвиж|буст|трафик/i.test((h.action || '') + (h.title || '')))
    warnings.push(`Рекламный бюджет во время эксперимента вырос на ${((ad / ab - 1) * 100).toFixed(0)}% — эффект может быть связан с рекламой.`);

  // Verdict on the primary metric
  const primary = metrics.find(m => m.key === h.metric) || null;
  let verdict = { code: 'no_metric', title: 'Метрика гипотезы не найдена в данных', text: 'Выберите метрику, которая есть в датасете, или загрузите выгрузку с нужной колонкой.' };
  if (primary && primary.liftDuring != null) {
    const dir = primary.lowerBetter ? -1 : 1;
    const eff = primary.liftDuring * dir;
    const targetPct = h.target_pct != null ? h.target_pct / 100 : (h.baseline && h.target ? (h.target - h.baseline) / Math.abs(h.baseline) * dir : 0.1);
    const sig = primary.pDuring != null && primary.pDuring < 0.05;
    const weak = primary.pDuring != null && primary.pDuring < 0.15;
    const sustained = primary.liftAfter != null ? primary.liftAfter * dir > 0 && (primary.pAfter ?? 1) < 0.15 : null;
    const pct = v => (v * 100).toFixed(1).replace('.', ',') + '%';
    if (eff >= targetPct && sig) verdict = { code: 'success', title: 'Гипотеза подтверждена', text: `${primary.label}: ${eff >= 0 ? '+' : ''}${pct(primary.liftDuring)} при цели ${pct(targetPct * dir)}, статистически значимо (p=${primary.pDuring.toFixed(3)}).` };
    else if (eff > 0 && (sig || weak)) verdict = { code: 'partial', title: 'Частичный успех', text: `${primary.label} изменилась на ${pct(primary.liftDuring)} — эффект есть, но ${eff < targetPct ? 'цель ' + pct(targetPct * dir) + ' не достигнута' : 'значимость пограничная (p=' + primary.pDuring.toFixed(3) + ')'}.` };
    else if (eff < 0 && sig) verdict = { code: 'fail', title: 'Гипотеза опровергнута', text: `${primary.label} ухудшилась на ${pct(Math.abs(primary.liftDuring))} (p=${primary.pDuring.toFixed(3)}). Изменение стоит откатить.` };
    else verdict = { code: 'inconclusive', title: 'Результат не значим', text: `Изменение ${pct(primary.liftDuring)} в пределах шума (p=${primary.pDuring != null ? primary.pDuring.toFixed(3) : '—'}). Продлите тест или увеличьте трафик.` };
    if (sustained === true) verdict.after = 'Эффект сохранился после завершения эксперимента — можно масштабировать.';
    else if (sustained === false && primary.liftAfter != null) verdict.after = `После эксперимента метрика вернулась к исходному уровню (${pct(primary.liftAfter)} к периоду «до»).`;
  }

  const series = days.filter(d => d.date >= periods.before.from && d.date <= periods.after.to).map(d => {
    const period = inP(d, periods.before) ? 'before' : inP(d, periods.during) ? 'during' : 'after';
    return { ...d, period };
  });
  return { periods, dataFrom, dataTo, metrics, primary, verdict, warnings, series, available };
}

/** Baseline for a metric over last N days of a dataset */
export function baseline(rows, key, sku, days = 28) {
  const all = dailySeries(rows, sku);
  const last = all.slice(-days);
  const pv = periodValue(last, key);
  return pv ? { value: pv.value, from: last[0]?.date, to: last.at(-1)?.date, days: last.length } : null;
}
