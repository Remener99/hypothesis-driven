import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDownUp, Copy, KanbanSquare, List, MoreHorizontal, Pencil, Plus, Search, SearchX, Sparkles, Trash2, Lightbulb, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateHypothesis, useDeleteHypothesis, useHypotheses, useUpdateHypothesis } from '../lib/hooks';
import { MARKETPLACES, METRIC_MAP, STAGES, STAGE_MAP, STATUSES, STATUS_MAP, fmtDate, fmtRelative } from '../lib/constants';
import { Button, EmptyState, IceBadge, IconButton, Menu, MenuItem, MpBadge, PageHeader, Segmented, Select, Skeleton, StatusBadge, cn } from '../components/ui';
import HypothesisForm from '../components/HypothesisForm';
import { hide, unhide, useHidden } from '../lib/pendingDelete';

export function useHypothesisActions() {
  const del = useDeleteHypothesis();
  const create = useCreateHypothesis();
  const update = useUpdateHypothesis();
  // Deferred delete with undo: the row disappears instantly, the request is sent after 5 s
  const remove = (h, after) => {
    let undone = false;
    const timer = setTimeout(() => { if (!undone) del.mutate(h.id, { onSettled: () => unhide(h.id) }); }, 5000);
    hide(h.id);
    toast('Гипотеза удалена', { description: h.title, duration: 5000, action: { label: 'Отменить', onClick: () => { undone = true; clearTimeout(timer); unhide(h.id); } } });
    after?.();
  };
  const duplicate = h => {
    const { id, events, ice, created_at, updated_at, user_id, ...rest } = h;
    create.mutate({ ...rest, title: h.title + ' (копия)', status: 'planned', result: null, insights: null }, { onSuccess: () => toast.success('Создана копия гипотезы') });
  };
  const setStatus = (h, status) => update.mutate({ id: h.id, status });
  return { remove, duplicate, setStatus };
}

const SORTS = [{ value: 'ice', label: 'По ICE' }, { value: 'updated', label: 'По обновлению' }, { value: 'start', label: 'По дате старта' }, { value: 'title', label: 'По алфавиту' }];

export default function Backlog() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, error, refetch } = useHypotheses();
  const [view, setView] = useState(() => localStorage.getItem('hl_view') || 'board');
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [mp, setMp] = useState('');
  const [sort, setSort] = useState('ice');
  const [edit, setEdit] = useState(null);
  const hidden = useHidden();
  const status = params.get('status') || '';
  const actions = useHypothesisActions();

  const list = useMemo(() => {
    let l = (data || []).filter(h => !hidden.has(h.id));
    if (q) { const s = q.toLowerCase(); l = l.filter(h => [h.title, h.product, h.sku, h.action, h.owner, ...(h.tags || [])].some(x => x && String(x).toLowerCase().includes(s))); }
    if (stage) l = l.filter(h => h.stage === stage);
    if (mp) l = l.filter(h => h.marketplace === mp);
    const cmp = { ice: (a, b) => b.ice - a.ice, updated: (a, b) => String(b.updated_at).localeCompare(String(a.updated_at)), start: (a, b) => String(b.start_date || '').localeCompare(String(a.start_date || '')), title: (a, b) => a.title.localeCompare(b.title, 'ru') }[sort];
    return [...l].sort(cmp);
  }, [data, q, stage, mp, sort, hidden]);
  const shown = view === 'table' && status ? list.filter(h => h.status === status) : list;
  const filtersActive = q || stage || mp || status;
  const setV = v => { setView(v); localStorage.setItem('hl_view', v); };

  return (
    <div>
      <PageHeader title="Бэклог гипотез" subtitle={data ? `${data.length} гипотез · ${data.filter(h => h.status === 'testing').length} в тесте` : 'Загрузка…'}
        actions={<><Button variant="secondary" icon={Plus} onClick={() => setEdit({})}>Быстро добавить</Button><Button icon={Sparkles} onClick={() => nav('/generator')}>Генератор</Button></>} />

      <div className="card mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Поиск по названию, товару, артикулу, тегам…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap items-center gap-2">
          {view === 'table' && <Select className="w-auto" value={status} onChange={v => setParams(v ? { status: v } : {})} placeholder="Все статусы" options={STATUSES.map(s => ({ value: s.key, label: s.label }))} />}
          <Select className="w-auto" value={stage} onChange={setStage} placeholder="Все этапы" options={STAGES.map(s => ({ value: s.key, label: s.label }))} />
          <Select className="w-auto" value={mp} onChange={setMp} placeholder="Все площадки" options={MARKETPLACES} />
          <Select className="w-auto" value={sort} onChange={setSort} options={SORTS} />
          <Segmented value={view} onChange={setV} options={[{ value: 'board', label: 'Канбан', icon: KanbanSquare }, { value: 'table', label: 'Список', icon: List }]} />
        </div>
      </div>

      {isError ? (
        <div className="card"><EmptyState icon={SearchX} title="Не удалось загрузить гипотезы" text={error.message} action={<Button variant="secondary" onClick={() => refetch()}>Повторить</Button>} /></div>
      ) : isLoading ? (
        view === 'board' ? <BoardSkeleton /> : <TableSkeleton />
      ) : data.length === 0 ? (
        <div className="card"><EmptyState icon={Lightbulb} title="Бэклог пока пуст" text="Сгенерируйте первые гипотезы с помощью пошагового мастера или добавьте вручную." action={<div className="flex gap-2"><Button variant="secondary" icon={Plus} onClick={() => setEdit({})}>Вручную</Button><Button icon={Sparkles} onClick={() => nav('/generator')}>Открыть генератор</Button></div>} /></div>
      ) : shown.length === 0 && view === 'table' ? (
        <div className="card"><EmptyState icon={SearchX} title="Ничего не найдено" text="Попробуйте изменить фильтры или поисковый запрос." action={filtersActive && <Button variant="secondary" onClick={() => { setQ(''); setStage(''); setMp(''); setParams({}); }}>Сбросить фильтры</Button>} /></div>
      ) : view === 'board' ? (
        <Board list={list} onEdit={setEdit} actions={actions} highlight={status} />
      ) : (
        <Table list={shown} onEdit={setEdit} actions={actions} />
      )}
      <HypothesisForm open={!!edit} onClose={() => setEdit(null)} hypothesis={edit?.id ? edit : null} />
    </div>
  );
}

function CardMenu({ h, onEdit, actions }) {
  return (
    <Menu trigger={<IconButton icon={MoreHorizontal} label="Действия" className="h-7 w-7" />}>
      <MenuItem icon={Pencil} onClick={() => onEdit(h)}>Редактировать</MenuItem>
      <MenuItem icon={Copy} onClick={() => actions.duplicate(h)}>Дублировать</MenuItem>
      <div className="my-1 h-px bg-slate-100" />
      <div className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Статус</div>
      {STATUSES.filter(s => s.key !== h.status).map(s => <MenuItem key={s.key} onClick={() => actions.setStatus(h, s.key)}><span className={cn('ml-1 mr-1 h-2 w-2 rounded-full', s.dot)} />{s.label}</MenuItem>)}
      <div className="my-1 h-px bg-slate-100" />
      <MenuItem icon={Trash2} danger onClick={() => actions.remove(h)}>Удалить</MenuItem>
    </Menu>
  );
}

function Board({ list, onEdit, actions, highlight }) {
  const [over, setOver] = useState(null);
  const [dragId, setDragId] = useState(null);
  const onDrop = (status) => {
    const h = list.find(x => String(x.id) === String(dragId));
    setOver(null); setDragId(null);
    if (h && h.status !== status) { actions.setStatus(h, status); toast.success(`«${h.title.slice(0, 40)}…» → ${STATUS_MAP[status].label}`); }
  };
  return (
    <div className="scroll-thin -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
      {STATUSES.map(s => {
        const items = list.filter(h => h.status === s.key);
        return (
          <div key={s.key} onDragOver={e => { e.preventDefault(); setOver(s.key); }} onDragLeave={() => setOver(o => (o === s.key ? null : o))} onDrop={() => onDrop(s.key)}
            className={cn('flex w-[290px] shrink-0 flex-col rounded-xl border p-2 transition', over === s.key ? 'border-brand-300 bg-brand-50/60 ring-2 ring-brand-100' : 'border-transparent bg-slate-100/70', highlight === s.key && 'ring-2 ring-brand-200')}>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold"><span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}</div>
              <span className="rounded-md bg-white px-1.5 text-xs tabular-nums text-slate-500 shadow-sm">{items.length}</span>
            </div>
            <div className="mt-1 flex min-h-[80px] flex-col gap-2">
              {items.map(h => (
                <div key={h.id} draggable={!h._optimistic} onDragStart={e => { setDragId(h.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDragId(null); setOver(null); }}
                  className={cn('group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-soft transition hover:border-brand-200 hover:shadow-md active:cursor-grabbing', dragId === h.id && 'opacity-40', h._optimistic && 'animate-pulse opacity-70')}>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={h._optimistic ? '#' : `/hypotheses/${h.id}`} className="line-clamp-3 text-[13px] font-medium leading-snug text-slate-800 hover:text-brand-700">{h.title}</Link>
                    <div className="-mr-1 -mt-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">{!h._optimistic && <CardMenu h={h} onEdit={onEdit} actions={actions} />}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <IceBadge value={h.ice} />
                    {h.stage && <span className="chip bg-slate-100 text-slate-600">{STAGE_MAP[h.stage]?.label}</span>}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                    <MpBadge mp={h.marketplace} />
                    {h.start_date ? <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(h.start_date)}</span> : h.owner ? <span className="flex items-center gap-1"><User className="h-3 w-3" />{h.owner}</span> : null}
                  </div>
                </div>
              ))}
              {items.length === 0 && <div className="flex flex-1 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">Перетащите карточку сюда</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Table({ list, onEdit, actions }) {
  return (
    <div className="card overflow-hidden">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-2.5">Гипотеза</th><th className="px-3 py-2.5">Статус</th><th className="px-3 py-2.5">Этап</th><th className="px-3 py-2.5">Метрика</th><th className="px-3 py-2.5">ICE</th><th className="px-3 py-2.5">Период</th><th className="px-3 py-2.5">Обновлено</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(h => (
              <tr key={h.id} className={cn('group transition hover:bg-slate-50/80', h._optimistic && 'animate-pulse opacity-60')}>
                <td className="max-w-[380px] px-4 py-3"><Link to={`/hypotheses/${h.id}`} className="line-clamp-1 font-medium text-slate-800 hover:text-brand-700">{h.title}</Link><div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500"><MpBadge mp={h.marketplace} />{h.product && <span className="truncate">· {h.product}</span>}</div></td>
                <td className="px-3 py-3">
                  <Menu align="left" trigger={<button className="rounded-full transition hover:ring-2 hover:ring-brand-100"><StatusBadge status={h.status} /></button>}>
                    {STATUSES.map(s => <MenuItem key={s.key} onClick={() => actions.setStatus(h, s.key)}><span className={cn('ml-1 mr-1 h-2 w-2 rounded-full', s.dot)} />{s.label}</MenuItem>)}
                  </Menu>
                </td>
                <td className="px-3 py-3 text-slate-600">{STAGE_MAP[h.stage]?.label || '—'}</td>
                <td className="px-3 py-3 text-slate-600">{METRIC_MAP[h.metric]?.short || '—'}{h.target_pct ? <span className="ml-1 text-xs text-emerald-600">{METRIC_MAP[h.metric]?.lowerBetter ? '−' : '+'}{h.target_pct}%</span> : null}</td>
                <td className="px-3 py-3"><IceBadge value={h.ice} /></td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{h.start_date ? `${fmtDate(h.start_date)} — ${fmtDate(h.end_date)}` : '—'}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fmtRelative(h.updated_at)}</td>
                <td className="px-2">{!h._optimistic && <CardMenu h={h} onEdit={onEdit} actions={actions} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return <div className="flex gap-4 overflow-hidden">{STATUSES.map((s, i) => <div key={s.key} className="w-[290px] shrink-0 space-y-2 rounded-xl bg-slate-100/70 p-2"><Skeleton className="m-2 h-4 w-28" />{Array.from({ length: 3 - (i % 2) }).map((_, j) => <div key={j} className="space-y-2 rounded-lg bg-white p-3"><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-5 w-24" /></div>)}</div>)}</div>;
}
function TableSkeleton() {
  return <div className="card divide-y divide-slate-100">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="flex items-center gap-4 px-4 py-3.5"><div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/3" /><Skeleton className="h-3 w-1/3" /></div><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-16" /></div>)}</div>;
}
