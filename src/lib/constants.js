import METRICS from '../../shared/metrics.js';
import LIB from '../../shared/library.js';

export { METRICS };
export const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));
export const STAGES = LIB.stages;
export const STAGE_MAP = Object.fromEntries(LIB.stages.map(s => [s.key, s]));
export const TACTICS = LIB.tactics;

export const STATUSES = [
  { key: 'planned', label: 'Запланирована', dot: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 ring-slate-200', col: 'bg-slate-50' },
  { key: 'testing', label: 'Тестируется', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 ring-amber-200', col: 'bg-amber-50/40' },
  { key: 'completed', label: 'Завершена', dot: 'bg-sky-500', chip: 'bg-sky-50 text-sky-800 ring-sky-200', col: 'bg-sky-50/40' },
  { key: 'scaling', label: 'Масштабируется', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800 ring-emerald-200', col: 'bg-emerald-50/40' },
  { key: 'canceled', label: 'Отменена', dot: 'bg-rose-400', chip: 'bg-rose-50 text-rose-700 ring-rose-200', col: 'bg-rose-50/30' },
];
export const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]));
export const MARKETPLACES = ['Wildberries', 'Ozon', 'Яндекс Маркет', 'Мегамаркет', 'AliExpress', 'Lamoda'];
export const MP_COLORS = { Wildberries: 'bg-fuchsia-600', Ozon: 'bg-blue-600', 'Яндекс Маркет': 'bg-yellow-400', 'Мегамаркет': 'bg-green-600', AliExpress: 'bg-red-500', Lamoda: 'bg-slate-900' };

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export function fmtMetric(key, v, { short } = {}) {
  if (v == null || !isFinite(v)) return '—';
  const m = METRIC_MAP[key]; const f = m?.format || 'int';
  if (f === 'pct') return nf2.format(v * 100) + '%';
  if (f === 'money') return (short && Math.abs(v) >= 1e6 ? nf1.format(v / 1e6) + ' млн' : short && Math.abs(v) >= 1e4 ? nf1.format(v / 1e3) + ' тыс' : nf0.format(v)) + ' ₽';
  if (f === 'dec') return nf2.format(v);
  return short && Math.abs(v) >= 1e4 ? nf1.format(v / 1e3) + ' тыс' : nf0.format(Math.round(v * 10) / 10);
}
export const fmtNum = v => (v == null ? '—' : nf0.format(v));
export const fmtPct = (v, sign = true) => (v == null || !isFinite(v) ? '—' : (sign && v > 0 ? '+' : '') + nf1.format(v * 100) + '%');

export function fmtDate(s, opts = { day: 'numeric', month: 'short' }) {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('ru-RU', opts).replace('.', '');
}
export function fmtRelative(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + (s.length > 10 ? 'Z' : 'T00:00:00'));
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) { const n = Math.floor(diff / 86400); return `${n} ${plural(n, 'день', 'дня', 'дней')} назад`; }
  return fmtDate(s, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
export const iceScore = (i, c, e) => Math.round(((i || 0) * (c || 0) * (e || 0)) ** (1 / 3) * 10) / 10;
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const addDays = (s, n) => new Date(new Date(s + 'T00:00:00Z').getTime() + n * 864e5).toISOString().slice(0, 10);
export const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
