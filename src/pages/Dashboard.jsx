import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ArrowRight, CheckCircle2, Database, FlaskConical, Lightbulb, Rocket, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useHypotheses, useStats } from '../lib/hooks';
import { STAGES, STATUSES, STATUS_MAP, fmtDate, fmtRelative, METRIC_MAP, daysBetween, todayISO } from '../lib/constants';
import { Button, EmptyState, IceBadge, PageHeader, Skeleton, StatusBadge, cn } from '../components/ui';

function Kpi({ icon: Icon, label, value, sub, tone, loading }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tone)}><Icon className="h-4 w-4" /></div>
      </div>
      {loading ? <Skeleton className="mt-3 h-7 w-16" /> : <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>}
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const { data: stats, isLoading: sl } = useStats();
  const { data: hyps, isLoading: hl } = useHypotheses();
  const hour = new Date().getHours();
  const greet = hour < 6 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const testing = hyps?.filter(h => h.status === 'testing') || [];
  const top = hyps?.filter(h => h.status === 'planned').sort((a, b) => b.ice - a.ice).slice(0, 5) || [];
  const empty = !hl && hyps?.length === 0;

  return (
    <div>
      <PageHeader title={`${greet}, ${user?.name?.split(' ')[0]}`} subtitle="Сводка по экспериментам и ближайшим шагам"
        actions={<><Button variant="secondary" icon={Database} onClick={() => nav('/data')}>Загрузить данные</Button><Button icon={Sparkles} onClick={() => nav('/generator')}>Сгенерировать гипотезу</Button></>} />

      {empty ? (
        <div className="card"><EmptyState icon={Lightbulb} title="Здесь появится ваша лаборатория роста" text="Сгенерируйте первую гипотезу — мастер проведёт по воронке AARRR, поможет сформулировать её по SMART и оценить по ICE." action={<Button icon={Sparkles} onClick={() => nav('/generator')}>Создать первую гипотезу</Button>} /></div>
      ) : (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi loading={sl} icon={Lightbulb} label="Всего гипотез" value={stats?.total} sub={`${stats?.byStatus.planned ?? 0} в бэклоге`} tone="bg-brand-50 text-brand-600" />
          <Kpi loading={sl} icon={FlaskConical} label="Сейчас в тесте" value={stats?.byStatus.testing} sub="активные эксперименты" tone="bg-amber-50 text-amber-600" />
          <Kpi loading={sl} icon={CheckCircle2} label="Проверено" value={stats?.done} sub="завершено и масштабируется" tone="bg-sky-50 text-sky-600" />
          <Kpi loading={sl} icon={Rocket} label="Win rate" value={`${stats?.successRate ?? 0}%`} sub="ушли в масштабирование" tone="bg-emerald-50 text-emerald-600" />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <div className="min-w-0 space-y-6 xl:col-span-2">
            <section className="card">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <h2 className="flex items-center gap-2 font-semibold"><Activity className="h-4 w-4 text-amber-500" />Активные эксперименты</h2>
                <Link to="/backlog?status=testing" className="text-sm text-brand-600 hover:underline">Все</Link>
              </div>
              {hl ? <div className="space-y-3 p-5">{[0, 1].map(i => <Skeleton key={i} className="h-14" />)}</div>
                : testing.length === 0 ? <EmptyState icon={FlaskConical} className="py-10" title="Нет активных тестов" text="Переведите гипотезу из бэклога в статус «Тестируется», чтобы начать эксперимент." />
                : <div className="divide-y divide-slate-100">{testing.map(h => {
                  const total = h.start_date && h.end_date ? daysBetween(h.start_date, h.end_date) + 1 : null;
                  const passed = h.start_date ? Math.max(0, daysBetween(h.start_date, todayISO())) : 0;
                  const pct = total ? Math.min(100, Math.round(passed / total * 100)) : 0;
                  return (
                    <Link key={h.id} to={`/hypotheses/${h.id}`} className="block px-5 py-4 transition hover:bg-slate-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0"><div className="truncate font-medium">{h.title}</div><div className="mt-0.5 text-xs text-slate-500">{h.product} · {METRIC_MAP[h.metric]?.label}</div></div>
                        <span className="hidden shrink-0 text-xs tabular-nums text-slate-500 sm:inline">{fmtDate(h.start_date)} — {fmtDate(h.end_date)}</span>
                      </div>
                      {total && <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all" style={{ width: pct + '%' }} /></div><span className="text-xs tabular-nums text-slate-500">день {Math.min(passed, total)} из {total}</span></div>}
                    </Link>
                  );
                })}</div>}
            </section>

            <section className="card">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <h2 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-brand-500" />Топ бэклога по ICE</h2>
                <Link to="/backlog" className="text-sm text-brand-600 hover:underline">Бэклог</Link>
              </div>
              {hl ? <div className="space-y-2 p-5">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10" />)}</div>
                : top.length === 0 ? <EmptyState icon={Lightbulb} className="py-10" title="Бэклог пуст" text="Все гипотезы в работе. Самое время сгенерировать новые!" />
                : <ol className="divide-y divide-slate-100">{top.map((h, i) => (
                  <li key={h.id}><Link to={`/hypotheses/${h.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{h.title}</span>
                    <IceBadge value={h.ice} />
                  </Link></li>))}</ol>}
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            <section className="card p-5">
              <h2 className="font-semibold">Статусы</h2>
              {sl ? <Skeleton className="mt-4 h-24" /> : (<>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
                  {STATUSES.map(s => stats.byStatus[s.key] ? <div key={s.key} className={s.dot} style={{ width: stats.byStatus[s.key] / stats.total * 100 + '%' }} title={s.label} /> : null)}
                </div>
                <ul className="mt-4 space-y-2">{STATUSES.map(s => (
                  <li key={s.key}><Link to={`/backlog?status=${s.key}`} className="flex items-center justify-between rounded-md text-sm hover:text-brand-700">
                    <span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}</span><span className="tabular-nums text-slate-500">{stats.byStatus[s.key]}</span>
                  </Link></li>))}</ul>
              </>)}
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">По этапам воронки</h2>
              {sl ? <Skeleton className="mt-4 h-40" /> : (
                <div className="mt-2 h-44"><ResponsiveContainer><BarChart data={STAGES.map(s => ({ name: s.label, v: stats.byStage[s.key] || 0 }))} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f5f3ff' }} formatter={v => [v, 'Гипотез']} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="v" fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart></ResponsiveContainer></div>)}
            </section>
            <section className="card p-5">
              <h2 className="font-semibold">Последние события</h2>
              {sl ? <div className="mt-4 space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-8" />)}</div> : (
                <ul className="mt-3 space-y-3">{stats.events.slice(0, 7).map(e => (
                  <li key={e.id} className="flex gap-3 text-sm">
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', e.type === 'status' ? 'bg-amber-400' : e.type === 'created' ? 'bg-brand-400' : 'bg-slate-300')} />
                    <div className="min-w-0"><Link to={`/hypotheses/${e.hypothesis_id}`} className="line-clamp-2 text-slate-700 hover:text-brand-700">{e.type === 'created' ? e.text : <>{e.text} · <span className="text-slate-500">{e.title}</span></>}</Link><div className="text-xs text-slate-400">{fmtRelative(e.created_at)}</div></div>
                  </li>))}</ul>)}
            </section>
          </div>
        </div>
      </>)}
    </div>
  );
}
