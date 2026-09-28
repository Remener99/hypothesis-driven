import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from 'recharts';
import { AlertTriangle, CheckCircle2, Database, HelpCircle, Info, Link2, RefreshCw, TrendingDown, TrendingUp, XCircle, Upload, Minus } from 'lucide-react';
import { api } from '../lib/api';
import { useDatasets, useUpdateHypothesis } from '../lib/hooks';
import { METRIC_MAP, fmtDate, fmtMetric, fmtPct } from '../lib/constants';
import { Button, EmptyState, Select, Skeleton, Spinner, cn } from './ui';

const VERDICT = {
  success: { icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50 text-emerald-900', ic: 'text-emerald-600' },
  partial: { icon: TrendingUp, cls: 'border-sky-200 bg-sky-50 text-sky-900', ic: 'text-sky-600' },
  fail: { icon: XCircle, cls: 'border-rose-200 bg-rose-50 text-rose-900', ic: 'text-rose-600' },
  inconclusive: { icon: HelpCircle, cls: 'border-amber-200 bg-amber-50 text-amber-900', ic: 'text-amber-600' },
  no_metric: { icon: Info, cls: 'border-slate-200 bg-slate-50 text-slate-800', ic: 'text-slate-500' },
};
const PERIOD = { before: { label: 'До', fill: '#f1f5f9', color: '#64748b' }, during: { label: 'Во время', fill: '#fef3c7', color: '#d97706' }, after: { label: 'После', fill: '#dcfce7', color: '#16a34a' } };

function Lift({ v, lowerBetter, p }) {
  if (v == null) return <span className="text-slate-300">—</span>;
  const good = lowerBetter ? v < 0 : v > 0;
  const sig = p != null && p < 0.05;
  const I = Math.abs(v) < 0.005 ? Minus : v > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', Math.abs(v) < 0.005 ? 'text-slate-500' : good ? 'text-emerald-600' : 'text-rose-600', !sig && 'opacity-60')} title={p != null ? `p = ${p.toFixed(4)}${sig ? ' — значимо' : ' — не значимо'}` : ''}>
      <I className="h-3.5 w-3.5" />{fmtPct(v)}{sig && <span className="text-[10px] font-bold">*</span>}
    </span>
  );
}

export default function AnalysisPanel({ h }) {
  const { data: datasets, isLoading: dsl } = useDatasets();
  const update = useUpdateHypothesis();
  const [chartMetric, setChartMetric] = useState(null);
  const q = useQuery({
    queryKey: ['analysis', h.id, h.dataset_id, h.dataset_sku, h.start_date, h.end_date, h.before_days, h.after_days, h.metric],
    queryFn: () => api(`/hypotheses/${h.id}/analysis`),
    enabled: !!h.dataset_id && !!h.start_date,
    placeholderData: p => p,
  });
  const ds = datasets?.find(d => d.id === h.dataset_id);
  const a = q.data;
  const metric = chartMetric && a?.available?.includes(chartMetric) ? chartMetric : a?.primary?.key || a?.available?.[0];

  const series = useMemo(() => {
    if (!a?.series || !metric) return [];
    // 7-day moving average for readability
    return a.series.map((d, i, arr) => {
      const win = arr.slice(Math.max(0, i - 6), i + 1).map(x => x[metric]).filter(x => x != null);
      return { date: d.date, v: d[metric], ma: win.length ? win.reduce((s, x) => s + x, 0) / win.length : null, period: d.period };
    });
  }, [a, metric]);

  if (!h.start_date) return <div className="card"><EmptyState icon={Info} title="Укажите сроки эксперимента" text="Для анализа «до / во время / после» у гипотезы должна быть дата старта (и желательно окончания)." /></div>;
  if (!h.dataset_id) {
    return (
      <div className="card p-5">
        <div className="flex flex-col items-center py-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50"><Database className="h-6 w-6 text-brand-600" /></div>
          <h3 className="mt-4 font-semibold">Привяжите данные для анализа результатов</h3>
          <p className="mt-1 max-w-md text-sm text-slate-500">Выберите загруженную выгрузку — мы разобьём её на периоды до, во время и после эксперимента, посчитаем изменение метрик и статистическую значимость.</p>
          {dsl ? <Skeleton className="mt-5 h-9 w-72" /> : datasets?.length ? (
            <div className="mt-5 flex w-full max-w-md gap-2">
              <Select value="" onChange={v => v && update.mutate({ id: h.id, dataset_id: +v })} placeholder="Выберите датасет…" options={datasets.map(d => ({ value: d.id, label: `${d.name} (${fmtDate(d.date_from)} — ${fmtDate(d.date_to)})` }))} />
            </div>
          ) : <Link to="/data" className="mt-5"><Button icon={Upload}>Загрузить Excel</Button></Link>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm"><Link2 className="h-4 w-4 shrink-0 text-slate-400" />
          <Select className="max-w-xs" value={h.dataset_id} onChange={v => update.mutate({ id: h.id, dataset_id: v ? +v : null, dataset_sku: null })} placeholder="— отвязать —" options={(datasets || []).map(d => ({ value: d.id, label: d.name }))} />
          {ds?.skus?.length > 0 && <Select className="max-w-[200px]" value={h.dataset_sku || ''} onChange={v => update.mutate({ id: h.id, dataset_sku: v || null })} placeholder="Все артикулы" options={ds.skus} />}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {q.isFetching && <Spinner className="h-4 w-4" />}
          <span>Окно «до»</span><input type="number" className="input h-8 w-16 px-2 py-1" defaultValue={h.before_days || ''} placeholder="авто" onBlur={e => +e.target.value !== (h.before_days || 0) && update.mutate({ id: h.id, before_days: e.target.value || null })} />
          <span>«после»</span><input type="number" className="input h-8 w-16 px-2 py-1" defaultValue={h.after_days || ''} placeholder="авто" onBlur={e => +e.target.value !== (h.after_days || 0) && update.mutate({ id: h.id, after_days: e.target.value || null })} />
        </div>
      </div>

      {q.isLoading ? (
        <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-72" /><Skeleton className="h-64" /></div>
      ) : q.isError ? (
        <div className="card"><EmptyState icon={AlertTriangle} title="Ошибка анализа" text={q.error.message} action={<Button variant="secondary" icon={RefreshCw} onClick={() => q.refetch()}>Повторить</Button>} /></div>
      ) : a?.error ? (
        <div className="card"><EmptyState icon={AlertTriangle} title="Анализ невозможен" text={a.error} /></div>
      ) : a && (<>
        {(() => { const V = VERDICT[a.verdict.code]; return (
          <div className={cn('flex gap-3 rounded-xl border p-4', V.cls)}>
            <V.icon className={cn('mt-0.5 h-5 w-5 shrink-0', V.ic)} />
            <div><div className="font-semibold">{a.verdict.title}</div><p className="mt-0.5 text-sm opacity-90">{a.verdict.text}</p>{a.verdict.after && <p className="mt-1 text-sm opacity-90">{a.verdict.after}</p>}</div>
          </div>); })()}
        {a.warnings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            {a.warnings.map((w, i) => <div key={i} className="flex gap-2 py-0.5 text-[13px] text-amber-900"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{w}</div>)}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {['before', 'during', 'after'].map(k => {
            const p = a.periods[k]; const m = a.metrics.find(x => x.key === metric);
            return (
              <div key={k} className="card p-4" style={{ borderTop: `3px solid ${PERIOD[k].color}` }}>
                <div className="flex items-center justify-between text-xs"><span className="font-semibold uppercase tracking-wide" style={{ color: PERIOD[k].color }}>{PERIOD[k].label}</span><span className="tabular-nums text-slate-400">{fmtDate(p.from)} — {fmtDate(p.to)}</span></div>
                <div className="mt-2 text-xl font-semibold tabular-nums">{fmtMetric(metric, m?.[k]?.value)}<span className="ml-1 text-xs font-normal text-slate-400">{METRIC_MAP[metric]?.type === 'sum' ? '/день' : ''}</span></div>
                <div className="mt-0.5 text-xs text-slate-500">{k === 'before' ? `${m?.before?.n ?? 0} дн. данных · база сравнения` : <><Lift v={k === 'during' ? m?.liftDuring : m?.liftAfter} p={k === 'during' ? m?.pDuring : m?.pAfter} lowerBetter={m?.lowerBetter} /> к периоду «до» · {m?.[k]?.n ?? 0} дн.</>}</div>
              </div>);
          })}
        </div>

        <div className="card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Динамика: {METRIC_MAP[metric]?.label}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">{Object.entries(PERIOD).map(([k, p]) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.fill, border: `1px solid ${p.color}` }} />{p.label}</span>)}<span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-brand-600" />7-дн. среднее</span></div>
          </div>
          <div className="h-72"><ResponsiveContainer>
            <ComposedChart data={series} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              {['before', 'during', 'after'].map(k => a.periods[k] && <ReferenceArea key={k} x1={a.periods[k].from < series[0]?.date ? series[0]?.date : a.periods[k].from} x2={a.periods[k].to > series.at(-1)?.date ? series.at(-1)?.date : a.periods[k].to} fill={PERIOD[k].fill} fillOpacity={0.8} ifOverflow="hidden" />)}
              <XAxis dataKey="date" tickFormatter={d => fmtDate(d)} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tickFormatter={v => fmtMetric(metric, v, { short: true })} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} domain={['auto', 'auto']} />
              <Tooltip labelFormatter={d => fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' })} formatter={(v, n) => [fmtMetric(metric, v), n === 'ma' ? '7-дн. среднее' : 'За день']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke="#c4b5fd" fill="#ede9fe" fillOpacity={0.35} strokeWidth={1} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="ma" stroke="#7c3aed" strokeWidth={2.2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer></div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><h3 className="font-semibold">Все метрики</h3><span className="text-xs text-slate-500">* — статистически значимо (Welch t-test, p &lt; 0,05). Нажмите на строку, чтобы построить график</span></div>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50/70 text-left text-xs font-medium text-slate-500"><tr><th className="px-4 py-2">Метрика</th><th className="px-3 py-2 text-right">До</th><th className="px-3 py-2 text-right">Во время</th><th className="px-3 py-2 text-right">Δ</th><th className="px-3 py-2 text-right">После</th><th className="px-3 py-2 text-right">Δ</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {a.metrics.map(m => (
                  <tr key={m.key} onClick={() => setChartMetric(m.key)} className={cn('cursor-pointer transition hover:bg-slate-50', m.key === metric && 'bg-brand-50/50', m.key === h.metric && 'font-medium')}>
                    <td className="px-4 py-2">{m.label}{m.key === h.metric && <span className="ml-2 rounded bg-brand-100 px-1.5 py-px text-[10px] font-semibold uppercase text-brand-700">цель</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">{fmtMetric(m.key, m.before?.value)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMetric(m.key, m.during?.value)}</td>
                    <td className="px-3 py-2 text-right"><Lift v={m.liftDuring} p={m.pDuring} lowerBetter={m.lowerBetter} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMetric(m.key, m.after?.value)}</td>
                    <td className="px-3 py-2 text-right"><Lift v={m.liftAfter} p={m.pAfter} lowerBetter={m.lowerBetter} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">Для суммируемых метрик сравниваются средние значения в день; для конверсий — отношение сумм за период. Данные: {fmtDate(a.dataFrom, { day: 'numeric', month: 'short', year: 'numeric' })} — {fmtDate(a.dataTo, { day: 'numeric', month: 'short', year: 'numeric' })}.</p>
        </div>
      </>)}
    </div>
  );
}
