import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, CheckCircle2, FileSpreadsheet, Layers, Rows3, Sparkles, UploadCloud, Wand2 } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { MARKETPLACES, METRICS, METRIC_MAP, fmtDate, fmtNum } from '../lib/constants';
import { Button, Field, Modal, Select, Spinner, cn } from './ui';
import SampleLink from './SampleLink';

export default function UploadWizard({ open, onClose }) {
  const [stage, setStage] = useState('drop'); // drop | parsing | review | saving
  const [drag, setDrag] = useState(false);
  const [p, setP] = useState(null);
  const [meta, setMeta] = useState({ name: '', marketplace: 'Wildberries' });
  const [err, setErr] = useState('');
  const [reparsing, setReparsing] = useState(false);
  const inp = useRef();
  const qc = useQueryClient();
  const nav = useNavigate();

  const reset = () => { setStage('drop'); setP(null); setErr(''); };
  const close = () => { reset(); onClose(); };

  async function handle(file) {
    if (!file) return;
    if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name)) { setErr('Поддерживаются только .xlsx, .xls, .xlsm и .csv'); return; }
    setErr(''); setStage('parsing');
    const form = new FormData(); form.append('file', file);
    try {
      const r = await api('/datasets/preview', { method: 'POST', form });
      setP(r);
      const guess = /ozon/i.test(file.name) ? 'Ozon' : /ya|yandex|market|маркет/i.test(file.name) ? 'Яндекс Маркет' : 'Wildberries';
      setMeta({ name: file.name.replace(/\.\w+$/, '').replace(/[_-]+/g, ' '), marketplace: guess });
      setStage('review');
    } catch (e) { setErr(e.message); setStage('drop'); }
  }

  async function remap(patch) {
    setReparsing(true);
    try { const r = await api('/datasets/preview/' + p.token, { method: 'POST', body: { sheet: p.sheet, mapping: p.mapping?.map(({ example, ...m }) => m), ...patch } }); setP(r); }
    catch (e) { toast.error(e.message); if (e.status === 410) reset(); }
    finally { setReparsing(false); }
  }
  const setRole = (idx, value) => {
    const mapping = p.mapping.map((m, i) => {
      if (i !== idx) {
        if (value === 'date' && m.role === 'date') return { ...m, role: 'ignore' };
        if (value === 'sku' && m.role === 'sku') return { ...m, role: 'ignore' };
        if (value.startsWith('m:') && m.metric === value.slice(2)) return { ...m, role: 'ignore', metric: undefined };
        return m;
      }
      if (value === 'date' || value === 'sku' || value === 'ignore') return { ...m, role: value, metric: undefined, confidence: undefined };
      return { ...m, role: 'metric', metric: value.slice(2), confidence: 100 };
    });
    remap({ mapping });
  };

  async function commit() {
    setStage('saving');
    try {
      const d = await api('/datasets/commit/' + p.token, { method: 'POST', body: { sheet: p.sheet, mapping: p.mapping.map(({ example, ...m }) => m), ...meta } });
      qc.invalidateQueries({ queryKey: ['datasets'] }); qc.invalidateQueries({ queryKey: ['stats'] });
      toast.success(`Датасет «${d.name}» загружен: ${d.days_count} дн., ${d.metrics.length} метрик`);
      close(); nav('/data/' + d.id);
    } catch (e) { toast.error(e.message); setStage('review'); }
  }

  const roleValue = m => (m.role === 'metric' ? 'm:' + m.metric : m.role);
  const roleOptions = p?.layout === 'wide'
    ? [{ value: 'ignore', label: '— не использовать —' }, ...METRICS.filter(x => !x.derive || true).map(x => ({ value: 'm:' + x.key, label: x.label }))]
    : [{ value: 'ignore', label: '— не использовать —' }, { value: 'date', label: '📅 Дата' }, { value: 'sku', label: '🏷 Артикул / товар' }, ...METRICS.map(x => ({ value: 'm:' + x.key, label: x.label }))];
  const s = p?.summary;

  return (
    <Modal open={open} onClose={close} size={stage === 'review' ? 'xl' : 'md'} title="Загрузка аналитики из Excel" description={stage === 'review' ? `${p.filename} · лист «${p.sheet}»` : 'Выгрузка из личного кабинета WB, Ozon, Яндекс Маркета или своя таблица'}
      footer={stage === 'review' || stage === 'saving' ? <><Button variant="secondary" onClick={reset}>Другой файл</Button><Button icon={CheckCircle2} loading={stage === 'saving'} disabled={!s?.records || reparsing} onClick={commit}>Импортировать {s ? `${fmtNum(s.records)} строк` : ''}</Button></> : null}>
      {(stage === 'drop' || stage === 'parsing') && (
        <div>
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }} onClick={() => stage === 'drop' && inp.current.click()}
            className={cn('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition', drag ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50', stage === 'parsing' && 'pointer-events-none')}>
            {stage === 'parsing' ? (<>
              <div className="relative"><FileSpreadsheet className="h-12 w-12 text-emerald-600" /><Spinner className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white" /></div>
              <div className="mt-4 font-medium">Анализируем структуру файла…</div>
              <div className="mt-1 text-sm text-slate-500">Ищем заголовки, колонку с датами и сопоставляем метрики</div>
            </>) : (<>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50"><UploadCloud className="h-7 w-7 text-brand-600" /></div>
              <div className="mt-4 font-medium">Перетащите файл сюда или <span className="text-brand-600">выберите</span></div>
              <div className="mt-1 text-sm text-slate-500">.xlsx, .xls, .csv — до 15 МБ</div>
            </>)}
            <input ref={inp} type="file" accept=".xlsx,.xls,.xlsm,.csv" className="hidden" onChange={e => { handle(e.target.files[0]); e.target.value = ''; }} />
          </div>
          {err && <div className="mt-3 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{err}</div>}
          <div className="mt-5 grid gap-3 text-xs text-slate-600 sm:grid-cols-3">
            {[[Wand2, 'Автораспознавание', '«Заказали, шт», «Переходы в карточку», «ДРР»… — 150+ вариантов названий'], [CalendarDays, 'Любые даты', '01.09.2026, 2026-09-01, «1 сентября», серийные даты Excel, диапазоны'], [Layers, 'Любая структура', 'Дни в строках или в столбцах, шапка с отступом, несколько листов']].map(([I, t, d]) => (
              <div key={t} className="rounded-xl bg-slate-50 p-3"><I className="h-4 w-4 text-brand-600" /><div className="mt-1.5 font-medium text-slate-800">{t}</div><div className="mt-0.5">{d}</div></div>))}
          </div>
          <div className="mt-4 text-xs text-slate-500">Нет файла под рукой? Скачайте пример: <SampleLink className="text-brand-600 hover:underline" file="wb_voronka_po_dnyam.xlsx">WB воронка</SampleLink> · <SampleLink className="text-brand-600 hover:underline" file="ozon_analitika_wide.xlsx">Ozon (даты в столбцах)</SampleLink> · <SampleLink className="text-brand-600 hover:underline" file="shablon_hypolab.xlsx">шаблон</SampleLink></div>
        </div>
      )}

      {(stage === 'review' || stage === 'saving') && p && (
        p.error ? (
          <div className="py-6 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-amber-500" /><div className="mt-3 font-medium">Не удалось распознать таблицу</div><p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{p.error}</p>
            {p.sheets?.length > 1 && <div className="mx-auto mt-4 max-w-xs"><Select value={p.sheet || ''} onChange={v => remap({ sheet: v, mapping: undefined })} placeholder="Выберите лист" options={p.sheets.map(x => x.name)} /></div>}</div>
        ) : (
        <div className={cn('space-y-5 transition', reparsing && 'pointer-events-none opacity-60')}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[[CalendarDays, 'Период', `${fmtDate(s.dateFrom, { day: 'numeric', month: 'short', year: '2-digit' })} — ${fmtDate(s.dateTo, { day: 'numeric', month: 'short', year: '2-digit' })}`, `${s.days} дн. · шаг: ${{ day: 'день', week: 'неделя', month: 'месяц' }[s.gran]}`],
              [Sparkles, 'Метрики', s.metrics.length, s.derived.length ? `+${s.derived.length} рассчитано автоматически` : 'распознано'],
              [Rows3, 'Записей', fmtNum(s.records), s.skus.length ? `${s.skus.length} артикулов` : 'итог по дням'],
              [Layers, 'Структура', p.layout === 'long' ? 'Дни в строках' : 'Дни в столбцах', `заголовок в строке ${p.headerRow + 1}`]].map(([I, l, v, sub]) => (
              <div key={l} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-1.5 text-xs text-slate-500"><I className="h-3.5 w-3.5" />{l}</div><div className="mt-1 font-semibold">{v}</div><div className="text-[11px] text-slate-500">{sub}</div></div>))}
          </div>
          {s.warnings.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">{s.warnings.map((w, i) => <div key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />{w}</div>)}</div>}

          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Сопоставление колонок</h3>{p.sheets.length > 1 && <Select className="h-8 w-auto py-1 text-xs" value={p.sheet} onChange={v => remap({ sheet: v, mapping: undefined })} options={p.sheets.map(x => ({ value: x.name, label: `Лист: ${x.name}${x.ok ? '' : ' (нет данных)'}` }))} />}</div>
              <div className="scroll-thin max-h-[340px] overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500"><tr><th className="px-3 py-2">{p.layout === 'long' ? 'Колонка в файле' : 'Строка в файле'}</th><th className="px-3 py-2">Пример</th><th className="px-3 py-2">Значение в HypoLab</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {p.mapping.map((m, i) => (
                      <tr key={i} className={cn(m.role === 'ignore' && 'text-slate-400')}>
                        <td className="max-w-[200px] px-3 py-1.5"><div className="truncate" title={m.header}>{m.header}</div></td>
                        <td className="max-w-[120px] truncate px-3 py-1.5 text-xs tabular-nums text-slate-500">{m.example}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <Select className={cn('h-8 py-1 text-[13px]', m.role !== 'ignore' && 'border-emerald-300 bg-emerald-50/50')} value={roleValue(m)} onChange={v => setRole(i, v)} options={roleOptions} />
                            {m.role === 'metric' && m.confidence < 70 && <span title="Низкая уверенность — проверьте" className="text-amber-500"><AlertTriangle className="h-4 w-4" /></span>}
                          </div>
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">{s.metrics.map(k => <span key={k} className={cn('chip', s.derived.includes(k) ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700')}>{METRIC_MAP[k]?.short}{s.derived.includes(k) && ' ƒ'}</span>)}</div>
            </div>
            <div className="space-y-4">
              <Field label="Название датасета"><input className="input" value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value })} /></Field>
              <Field label="Маркетплейс"><Select value={meta.marketplace} onChange={v => setMeta({ ...meta, marketplace: v })} options={MARKETPLACES} /></Field>
              {p.series?.length > 1 && (
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Предпросмотр: {p.series.some(d => d.orders != null) ? 'заказы' : 'показы'} по дням</div>
                  <div className="mt-1 h-24"><ResponsiveContainer><AreaChart data={p.series}><XAxis dataKey="date" hide /><Tooltip labelFormatter={d => fmtDate(d)} contentStyle={{ fontSize: 11, borderRadius: 8 }} /><Area dataKey={p.series.some(d => d.orders != null) ? 'orders' : 'views'} name="Значение" stroke="#7c3aed" fill="#ede9fe" strokeWidth={1.5} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div>
                </div>)}
            </div>
          </div>
        </div>)
      )}
    </Modal>
  );
}
