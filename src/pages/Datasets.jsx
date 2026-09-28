import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Database, Download, FileSpreadsheet, MoreHorizontal, Pencil, Trash2, Upload, Link2 } from 'lucide-react';
import { useDatasets, useDeleteDataset, useUpdateDataset } from '../lib/hooks';
import { METRIC_MAP, fmtDate, fmtRelative, plural, MARKETPLACES } from '../lib/constants';
import { Button, Confirm, EmptyState, IconButton, Menu, MenuItem, Modal, MpBadge, PageHeader, Skeleton, Field, Select } from '../components/ui';
import UploadWizard from '../components/UploadWizard';
import SampleLink from '../components/SampleLink';

export default function Datasets() {
  const { data, isLoading } = useDatasets();
  const del = useDeleteDataset();
  const upd = useUpdateDataset();
  const [upload, setUpload] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [rename, setRename] = useState(null);

  return (
    <div>
      <PageHeader title="Данные и анализ" subtitle="Ретроспективные выгрузки для интерпретации результатов экспериментов"
        actions={<><Menu trigger={<Button variant="secondary" icon={Download}>Примеры</Button>}>
          <SampleLink file="wb_voronka_po_dnyam.xlsx"><MenuItem icon={FileSpreadsheet}>WB · Воронка по дням</MenuItem></SampleLink>
          <SampleLink file="ozon_analitika_wide.xlsx"><MenuItem icon={FileSpreadsheet}>Ozon · даты в столбцах</MenuItem></SampleLink>
          <SampleLink file="shablon_hypolab.xlsx"><MenuItem icon={FileSpreadsheet}>Пустой шаблон</MenuItem></SampleLink>
        </Menu><Button icon={Upload} onClick={() => setUpload(true)}>Загрузить Excel</Button></>} />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="card space-y-3 p-5"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-1/2" /><Skeleton className="h-12" /></div>)}</div>
      ) : !data?.length ? (
        <div className="card"><EmptyState icon={Database} title="Данных пока нет" text="Загрузите выгрузку аналитики из личного кабинета маркетплейса — мы распознаем даты и метрики и сможем оценить результаты гипотез." action={<Button icon={Upload} onClick={() => setUpload(true)}>Загрузить первый файл</Button>} /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map(d => (
            <div key={d.id} className="card group relative flex flex-col p-5 transition hover:border-brand-200 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /></div>
                <Menu trigger={<IconButton icon={MoreHorizontal} label="Действия" />}>
                  <MenuItem icon={Pencil} onClick={() => setRename(d)}>Переименовать</MenuItem>
                  <MenuItem icon={Trash2} danger onClick={() => setConfirm(d)}>Удалить</MenuItem>
                </Menu>
              </div>
              <Link to={`/data/${d.id}`} className="mt-3 font-semibold after:absolute after:inset-0 hover:text-brand-700">{d.name}</Link>
              <div className="mt-1 flex items-center gap-3 text-xs text-slate-500"><MpBadge mp={d.marketplace} /><span>{d.filename}</span></div>
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                <div><div className="font-semibold tabular-nums">{d.days_count}</div><div className="text-[11px] text-slate-500">{plural(d.days_count, 'день', 'дня', 'дней')}</div></div>
                <div><div className="font-semibold tabular-nums">{d.metrics.length}</div><div className="text-[11px] text-slate-500">метрик</div></div>
                <div><div className="font-semibold tabular-nums">{d.skus.length || '—'}</div><div className="text-[11px] text-slate-500">артикулов</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">{d.metrics.slice(0, 7).map(k => <span key={k} className="chip bg-slate-100 text-slate-600">{METRIC_MAP[k]?.short}</span>)}{d.metrics.length > 7 && <span className="chip bg-slate-100 text-slate-500">+{d.metrics.length - 7}</span>}</div>
              <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(d.date_from)} — {fmtDate(d.date_to, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {d.hypotheses_count > 0 && <span className="flex items-center gap-1 text-brand-600"><Link2 className="h-3.5 w-3.5" />{d.hypotheses_count}</span>}
              </div>
            </div>
          ))}
          <button onClick={() => setUpload(true)} className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-brand-400 hover:bg-brand-50/40 hover:text-brand-700">
            <Upload className="h-6 w-6" /><span className="mt-2 text-sm font-medium">Загрузить ещё</span>
          </button>
        </div>
      )}

      <div className="card mt-8 p-5">
        <h2 className="font-semibold">Как это работает</h2>
        <div className="mt-4 grid gap-4 text-sm md:grid-cols-4">
          {[['1', 'Выгрузите отчёт', 'WB: Аналитика → Воронка продаж → по дням. Ozon: Аналитика → Графики → Скачать. Или любая таблица с датами.'], ['2', 'Загрузите файл', 'Парсер найдёт шапку, колонку дат (или даты в заголовках), распознает метрики и артикулы.'], ['3', 'Проверьте сопоставление', 'Исправьте колонки с низкой уверенностью. Конверсии, CTR, ДРР и средний чек досчитаются сами.'], ['4', 'Привяжите к гипотезе', 'Данные разбиваются на «до / во время / после» по датам эксперимента с проверкой значимости.']].map(([n, t, d]) => (
            <div key={n} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{n}</span><div><div className="font-medium">{t}</div><div className="mt-0.5 text-xs text-slate-500">{d}</div></div></div>))}
        </div>
      </div>

      <UploadWizard open={upload} onClose={() => setUpload(false)} />
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} title="Удалить датасет?" text={`«${confirm?.name}» будет удалён. Гипотезы останутся, но потеряют привязку к данным.`} onConfirm={() => { del.mutate(confirm.id); setConfirm(null); }} />
      <RenameModal d={rename} onClose={() => setRename(null)} onSave={(p) => { upd.mutate({ id: rename.id, ...p }); setRename(null); }} />
    </div>
  );
}

function RenameModal({ d, onClose, onSave }) {
  const [name, setName] = useState(''); const [mp, setMp] = useState('');
  const [last, setLast] = useState(null);
  if (d && d !== last) { setLast(d); setName(d.name); setMp(d.marketplace || 'Wildberries'); }
  return (
    <Modal open={!!d} onClose={onClose} size="sm" title="Параметры датасета" footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button disabled={!name.trim()} onClick={() => onSave({ name, marketplace: mp })}>Сохранить</Button></>}>
      <div className="space-y-4"><Field label="Название"><input autoFocus className="input" value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Маркетплейс"><Select value={mp} onChange={setMp} options={MARKETPLACES} /></Field></div>
    </Modal>
  );
}
