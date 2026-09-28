import { METRIC_MAP, fmtMetric, addDays } from './constants';

/** Compute target value from baseline and % lift respecting metric direction */
export function targetFrom(metric, baseline, pct) {
  if (baseline == null || pct == null || baseline === '') return null;
  const dir = METRIC_MAP[metric]?.lowerBetter ? -1 : 1;
  return +baseline * (1 + dir * pct / 100);
}

export function buildTitle({ action, metric, target_pct, product }) {
  const m = METRIC_MAP[metric];
  if (!m) return '';
  const verb = m.lowerBetter ? 'снизит' : 'повысит';
  const short = (action || '').split(/[,.;:(]/)[0].trim();
  const a = short.length > 70 ? short.slice(0, 67) + '…' : short;
  return `${a || 'Изменение'} ${verb} ${m.short} на ${target_pct ?? '?'}%`.replace(/^./, c => c.toUpperCase());
}

export function buildStatement(h) {
  const m = METRIC_MAP[h.metric];
  if (!m) return '';
  const dir = m.lowerBetter ? 'снизится' : 'вырастет';
  const from = h.baseline != null && h.baseline !== '' ? ` с ${fmtMetric(h.metric, +h.baseline)}` : '';
  const to = h.target != null && h.target !== '' ? ` до ${fmtMetric(h.metric, +h.target)}` : h.target_pct ? ` на ${h.target_pct}%` : '';
  const days = h.start_date && h.end_date ? Math.round((new Date(h.end_date) - new Date(h.start_date)) / 864e5) + 1 : null;
  return `Если ${lower(h.action) || '…'}, то «${m.label}»${h.product ? ` товара «${h.product}»` : ''} ${dir}${from}${to}${days ? ` за ${days} дн.` : ''}${h.start_date ? ` (с ${fmtRu(h.start_date)}${h.end_date ? ' по ' + fmtRu(h.end_date) : ''})` : ''}, потому что ${lower(h.rationale) || '…'}.`;
}
const lower = s => (s ? s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, '') : '');
const fmtRu = s => s.split('-').reverse().join('.');

export function smartChecks(h) {
  const days = h.start_date && h.end_date ? (new Date(h.end_date) - new Date(h.start_date)) / 864e5 + 1 : 0;
  return [
    { k: 'S', label: 'Specific — конкретная', ok: (h.action || '').length >= 20 && !!h.product, hint: 'Опишите конкретное действие (≥ 20 символов) и товар' },
    { k: 'M', label: 'Measurable — измеримая', ok: !!h.metric && (h.target_pct != null && h.target_pct !== ''), hint: 'Выберите метрику и целевое изменение' },
    { k: 'A', label: 'Achievable — достижимая', ok: h.target_pct != null && +h.target_pct > 0 && +h.target_pct <= 150, hint: 'Цель > 0% и не более 150% — иначе нереалистично' },
    { k: 'R', label: 'Relevant — обоснованная', ok: (h.rationale || '').length >= 15 && !!h.problem, hint: 'Укажите проблему и почему действие должно сработать' },
    { k: 'T', label: 'Time-bound — ограничена по времени', ok: days >= 7 && days <= 60, hint: 'Длительность теста 7–60 дней (учёт недельной сезонности)' },
  ];
}

export function defaultDates(days = 14) {
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // next Monday
  const start = d.toISOString().slice(0, 10);
  return { start_date: start, end_date: addDays(start, days - 1) };
}
