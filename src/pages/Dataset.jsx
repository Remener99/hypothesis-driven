import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, FileSpreadsheet, AlertTriangle, FlaskConical } from 'lucide-react';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from 'recharts';
import { useDataset } from '../lib/hooks';
import { METRIC_MAP, fmtDate, fmtMetric, fmtNum, STATUS_MAP } from '../lib/constants';
import { EmptyState, MpBadge, Select, Skeleton, StatusBadge, Spinner, cn } from '../components/ui';

export default function DatasetPage() {
  const { id } = useParams();
  const [sku, setSku] = useState('');
  const { data: d, isLoading, isError, error, isFetching } = useDataset(id, sku);
  const [metric, setMetric] = useState(null);
  const [showH, setShowH] = useState(true);

  const m = metric && d?.metrics.includes(metric) ? metric : d?.metrics.includes('orders') ? 'orders' : d?.metrics[0];
  const totals = useMemo(() => {
    if (!d) return [];
    return d.metrics.map(k => {
      const meta = METRIC_MAP[k]; const vals = d.series.map(x => x[k]).filter(v => v != null);
      if (!vals.length) return { k, v: null };
      if (meta.type === 'sum') return { k, v: vals.reduce((a, b) => a + b, 0), label: 'всего' };
      if (meta.derive) { const [n, den] = meta.derive; const a = d.series.reduce((s, x) => s + (x[n] || 0), 0), b = d.series.reduce((s, x) => s + (x[den] || 0), 0); if (b) return { k, v: a / b, label: 'за период' }; }
      return { k, v: vals.reduce((a, b) => a + b, 0) / vals.length, label: 'в среднем' };
    });
  }, [d]);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-1/2" /><div className="grid grid-cols-2 gap-3 md:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-80" /></div>;
  if (isError) return <div className="card"><EmptyState icon={FileSpreadsheet} title="Датасет не найден" text={error.message} /></div>;

  const colors = { planned: '#94a3b8', testing: '#f59e0b', completed: '#0ea5e9', scaling: '#10b981', canceled: '#fb7185' };
  return (
    <div>
      <Link to="/data" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Все данные</Link>
      <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{d.name}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500"><MpBadge mp={d.marketplace} /><span className="flex items-center gap-1"><FileSpreadsheet className="h-3.5 w-3.5" />{d.filename} · лист «{d.sheet}»</span><span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(d.date_from, { day: 'numeric', month: 'long', year: 'numeric' })} — {fmtDate(d.date_to, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        </div>
        <div className="flex items-center gap-2">{isFetching && <Spinner className="h-4 w-4" />}{d.skus.length > 0 && <Select className="w-56" value={sku} onChange={setSku} placeholder={`Все артикулы (${d.skus.length})`} options={d.skus} />}</div>
      </div>
      {d.warnings.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">{d.warnings.map((w, i) => <div key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{w}</div>)}</div>}

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {totals.slice(0, 12).map(t => (
          <button key={t.k} onClick={() => setMetric(t.k)} className={cn('card p-3 text-left transition hover:border-brand-200', m === t.k && 'border-brand-400 ring-2 ring-brand-100')}>
            <div className="truncate text-xs text-slate-500">{METRIC_MAP[t.k]?.label}</div>
            <div className="mt-1 font-semibold tabular-nums">{fmtMetric(t.k, t.v, { short: true })}</div>
            <div className="text-[11px] text-slate-400">{t.label}</div>
          </button>))}
      </div>

      <div className="card mt-6 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><h3 className="font-semibold">Динамика</h3><Select className="h-8 w-auto py-1 text-sm" value={m} onChange={setMetric} options={d.metrics.map(k => ({ value: k, label: METRIC_MAP[k]?.label }))} /></div>
          {d.hypotheses.length > 0 && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={showH} onChange={e => setShowH(e.target.checked)} className="accent-brand-600" />Показать эксперименты</label>}
        </div>
        <div className="h-80"><ResponsiveContainer>
          <ComposedChart data={d.series} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            {showH && d.hypotheses.filter(h => h.start_date).map(h => <ReferenceArea key={h.id} x1={h.start_date < d.date_from ? d.date_from : h.start_date} x2={!h.end_date || h.end_date > d.date_to ? d.date_to : h.end_date} fill={colors[h.status]} fillOpacity={0.12} ifOverflow="hidden" />)}
            <XAxis dataKey="date" tickFormatter={x => fmtDate(x)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={30} />
            <YAxis tickFormatter={v => fmtMetric(m, v, { short: true })} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} />
            <Tooltip labelFormatter={x => fmtDate(x, { day: 'numeric', month: 'long', year: 'numeric' })} formatter={v => [fmtMetric(m, v), METRIC_MAP[m]?.label]} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Area type="monotone" dataKey={m} stroke="#7c3aed" fill="#ede9fe" fillOpacity={0.5} strokeWidth={1.8} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer></div>
        {showH && d.hypotheses.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{d.hypotheses.map(h => (
            <Link key={h.id} to={`/hypotheses/${h.id}`} className="flex items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs transition hover:border-brand-300">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[h.status] }} /><span className="max-w-[260px] truncate">{h.title}</span><span className="text-slate-400">{fmtDate(h.start_date)}–{fmtDate(h.end_date)}</span>
            </Link>))}</div>)}
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h3 className="font-semibold">Распознанная структура</h3><p className="text-xs text-slate-500">Формат: {d.format?.startsWith('long') ? 'дни в строках' : 'дни в столбцах'} · {fmtNum(d.rows_count)} записей</p></div>
        <div className="scroll-thin max-h-72 overflow-y-auto">
          <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">{d.mapping.map((x, i) => (
            <tr key={i} className={x.role === 'ignore' ? 'text-slate-400' : ''}><td className="px-4 py-1.5">{x.header}</td><td className="px-4 py-1.5 text-right">{x.role === 'metric' ? <span className="chip bg-emerald-50 text-emerald-700">{METRIC_MAP[x.metric]?.label}</span> : x.role === 'date' ? <span className="chip bg-sky-50 text-sky-700">Дата</span> : x.role === 'sku' ? <span className="chip bg-violet-50 text-violet-700">Артикул</span> : <span className="text-xs">не используется</span>}</td></tr>))}</tbody></table>
        </div>
      </div>
    </div>
  );
}
