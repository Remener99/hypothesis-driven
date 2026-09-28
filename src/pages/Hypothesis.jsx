import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BarChart3, Calendar, Copy, FileText, History, Pencil, Trash2, User, Wallet, Target, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDeleteHypothesis, useHypothesis, useUpdateHypothesis } from '../lib/hooks';
import { METRIC_MAP, STAGE_MAP, STATUSES, fmtDate, fmtMetric, fmtRelative, fmtNum, daysBetween } from '../lib/constants';
import { Button, Confirm, EmptyState, IceBadge, MpBadge, Skeleton, StatusBadge, cn } from '../components/ui';
import HypothesisForm from '../components/HypothesisForm';
import AnalysisPanel from '../components/AnalysisPanel';
import { useHypothesisActions } from './Backlog';

function InlineText({ value, onSave, placeholder, multiline = true }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value || '');
  if (!edit) return (
    <button onClick={() => { setV(value || ''); setEdit(true); }} className="group w-full rounded-lg px-2 py-1.5 -mx-2 text-left text-sm text-slate-700 transition hover:bg-slate-50">
      {value ? <span className="whitespace-pre-wrap">{value}</span> : <span className="text-slate-400">{placeholder}</span>}
      <Pencil className="ml-1.5 inline h-3 w-3 text-slate-300 opacity-0 transition group-hover:opacity-100" />
    </button>
  );
  const save = () => { if (v !== (value || '')) onSave(v); setEdit(false); };
  return (
    <div className="space-y-2">
      {multiline ? <textarea autoFocus className="input min-h-[80px]" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); if (e.key === 'Escape') setEdit(false); }} />
        : <input autoFocus className="input" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEdit(false); }} />}
      <div className="flex gap-1.5"><Button size="sm" icon={Check} onClick={save}>Сохранить</Button><Button size="sm" variant="ghost" icon={X} onClick={() => setEdit(false)}>Отмена</Button><span className="ml-auto self-center text-[11px] text-slate-400">Ctrl+Enter</span></div>
    </div>
  );
}

export default function HypothesisPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: h, isLoading, isError, error } = useHypothesis(id);
  const update = useUpdateHypothesis();
  const del = useDeleteHypothesis();
  const { duplicate } = useHypothesisActions();
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (isLoading) return (
    <div className="space-y-6"><Skeleton className="h-4 w-32" /><Skeleton className="h-8 w-2/3" /><div className="flex gap-2"><Skeleton className="h-6 w-28" /><Skeleton className="h-6 w-20" /></div><div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-80 lg:col-span-2" /><Skeleton className="h-80" /></div></div>
  );
  if (isError) return <div className="card"><EmptyState icon={FileText} title={error.status === 404 ? 'Гипотеза не найдена' : 'Ошибка загрузки'} text={error.status === 404 ? 'Возможно, она была удалена.' : error.message} action={<Button variant="secondary" icon={ArrowLeft} onClick={() => nav('/backlog')}>К бэклогу</Button>} /></div>;

  const patch = p => update.mutate({ id: h.id, ...p });
  const m = METRIC_MAP[h.metric];
  const dur = h.start_date && h.end_date ? daysBetween(h.start_date, h.end_date) + 1 : null;

  return (
    <div>
      <Link to="/backlog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Бэклог</Link>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{h.title}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <IceBadge value={h.ice} /><MpBadge mp={h.marketplace} />
            {h.stage && <span className="text-slate-500">{STAGE_MAP[h.stage]?.label} · {STAGE_MAP[h.stage]?.aarrr}</span>}
            {h.tags?.map(t => <span key={t} className="chip bg-brand-50 text-brand-700">#{t}</span>)}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" icon={Copy} onClick={() => duplicate(h)}>Дублировать</Button>
          <Button variant="secondary" icon={Trash2} onClick={() => setConfirm(true)} className="text-rose-600">Удалить</Button>
          <Button icon={Pencil} onClick={() => setEdit(true)}>Редактировать</Button>
        </div>
      </div>

      {/* status pipeline */}
      <div className="card mt-6 flex overflow-x-auto p-1 scroll-thin">
        {STATUSES.map(s => (
          <button key={s.key} onClick={() => h.status !== s.key && patch({ status: s.key })} className={cn('flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition', h.status === s.key ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800')}>
            <span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {[['overview', 'Обзор', FileText], ['analysis', 'Анализ результатов', BarChart3], ['history', 'История', History]].map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} className={cn('-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition', tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800')}><I className="h-4 w-4" />{l}</button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="min-w-0 space-y-6 lg:col-span-2">
              <section className="card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Гипотеза</h2>
                <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4 text-[15px] leading-relaxed text-slate-800">{h.expected || '—'}</div>
                <dl className="mt-4 space-y-3">
                  {[['Проблема', 'problem', 'Какую проблему решаем?'], ['Действие', 'action', 'Что конкретно делаем?'], ['Обоснование', 'rationale', 'Почему это сработает?']].map(([l, k, ph]) => (
                    <div key={k} className="grid gap-1 sm:grid-cols-[130px_1fr]"><dt className="pt-1.5 text-sm text-slate-500">{l}</dt><dd><InlineText value={h[k]} placeholder={ph} onSave={v => patch({ [k]: v })} /></dd></div>
                  ))}
                </dl>
              </section>
              <section className="card p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Цикл HADI — итоги</h2>
                <dl className="mt-3 space-y-3">
                  {[['Data (результат)', 'result', 'Опишите фактический результат — подсказка во вкладке «Анализ»'], ['Insights (выводы)', 'insights', 'Чему научились?'], ['Следующие шаги', 'next_steps', 'Масштабировать, доработать или отказаться?']].map(([l, k, ph]) => (
                    <div key={k} className="grid gap-1 sm:grid-cols-[130px_1fr]"><dt className="pt-1.5 text-sm text-slate-500">{l}</dt><dd><InlineText value={h[k]} placeholder={ph} onSave={v => patch({ [k]: v })} /></dd></div>
                  ))}
                </dl>
              </section>
            </div>
            <aside className="space-y-4">
              <div className="card divide-y divide-slate-100">
                {[
                  [Target, 'Метрика', m ? <>{m.label}<div className="text-xs text-slate-500">{h.baseline != null ? fmtMetric(h.metric, h.baseline) : '—'} → <b className="text-emerald-700">{h.target != null ? fmtMetric(h.metric, h.target) : (h.target_pct ? `${m.lowerBetter ? '−' : '+'}${h.target_pct}%` : '—')}</b></div></> : '—'],
                  [Calendar, 'Период теста', h.start_date ? <>{fmtDate(h.start_date, { day: 'numeric', month: 'long' })} — {fmtDate(h.end_date, { day: 'numeric', month: 'long' })}{dur && <div className="text-xs text-slate-500">{dur} дн.</div>}</> : 'Не запланирован'],
                  [FileText, 'Товар', h.product ? <>{h.product}{h.sku && <div className="text-xs text-slate-500">арт. {h.sku}</div>}</> : '—'],
                  [User, 'Ответственный', h.owner || '—'],
                  [Wallet, 'Бюджет', h.budget != null ? fmtNum(h.budget) + ' ₽' : '—'],
                ].map(([I, l, v]) => (
                  <div key={l} className="flex gap-3 p-4"><I className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><div className="min-w-0"><div className="text-xs text-slate-500">{l}</div><div className="mt-0.5 text-sm text-slate-800">{v}</div></div></div>
                ))}
              </div>
              <div className="card p-4">
                <div className="text-xs text-slate-500">ICE-оценка</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">{[['I', h.impact], ['C', h.confidence], ['E', h.ease]].map(([k, v]) => <div key={k} className="rounded-lg bg-slate-50 py-2"><div className="text-lg font-semibold tabular-nums">{v}</div><div className="text-[11px] text-slate-500">{k}</div></div>)}</div>
              </div>
              <button onClick={() => setTab('analysis')} className="card flex w-full items-center gap-3 p-4 text-left transition hover:border-brand-200 hover:shadow-md">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50"><BarChart3 className="h-4 w-4 text-brand-600" /></div>
                <div><div className="text-sm font-medium">Анализ «до / во время / после»</div><div className="text-xs text-slate-500">{h.dataset_id ? 'Данные привязаны' : 'Привяжите выгрузку Excel'}</div></div>
              </button>
            </aside>
          </div>
        )}
        {tab === 'analysis' && <AnalysisPanel h={h} />}
        {tab === 'history' && (
          <div className="card max-w-2xl p-5">
            {h.events?.length ? <ol className="relative space-y-5 border-l border-slate-200 pl-6">{h.events.map(e => (
              <li key={e.id} className="relative"><span className={cn('absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-white', e.type === 'status' ? 'bg-amber-400' : e.type === 'created' ? 'bg-brand-500' : 'bg-slate-300')} />
                <div className="text-sm text-slate-800">{e.text}</div><div className="text-xs text-slate-400">{fmtRelative(e.created_at)}</div></li>))}</ol>
              : <EmptyState icon={History} title="История пуста" />}
          </div>
        )}
      </div>

      <HypothesisForm open={edit} onClose={() => setEdit(false)} hypothesis={h} />
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Удалить гипотезу?" text="Гипотеза и её история будут удалены без возможности восстановления." loading={del.isPending}
        onConfirm={() => del.mutate(h.id, { onSuccess: () => { toast.success('Гипотеза удалена'); nav('/backlog'); } })} />
    </div>
  );
}
