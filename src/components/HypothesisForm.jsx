import { useEffect, useState } from 'react';
import { Button, Field, Modal, Select, Slider, TagInput } from './ui';
import { MARKETPLACES, METRICS, METRIC_MAP, STAGES, STATUSES, iceScore } from '../lib/constants';
import { targetFrom } from '../lib/smart';
import { useDatasets, useUpdateHypothesis, useCreateHypothesis } from '../lib/hooks';
import { toast } from 'sonner';

const EMPTY = { title: '', marketplace: 'Wildberries', product: '', sku: '', stage: 'ctr', problem: '', action: '', expected: '', rationale: '', metric: 'ctr', baseline: '', target: '', target_pct: '', start_date: '', end_date: '', before_days: '', after_days: '', impact: 5, confidence: 5, ease: 5, status: 'planned', result: '', insights: '', next_steps: '', tags: [], budget: '', owner: '', dataset_id: '', dataset_sku: '' };

export default function HypothesisForm({ open, onClose, hypothesis }) {
  const isEdit = !!hypothesis?.id;
  const [f, setF] = useState(EMPTY);
  const [tab, setTab] = useState('main');
  const [err, setErr] = useState({});
  const update = useUpdateHypothesis();
  const create = useCreateHypothesis();
  const { data: datasets } = useDatasets();
  useEffect(() => {
    if (open) { setF({ ...EMPTY, ...Object.fromEntries(Object.entries(hypothesis || {}).map(([k, v]) => [k, v ?? EMPTY[k] ?? ''])) }); setTab('main'); setErr({}); }
  }, [open, hypothesis]);
  const set = patch => setF(p => ({ ...p, ...patch }));
  const ds = datasets?.find(d => d.id === +f.dataset_id);

  function submit() {
    const e = {};
    if (!f.title.trim()) e.title = 'Обязательное поле';
    if (f.start_date && f.end_date && f.end_date < f.start_date) e.end_date = 'Окончание раньше старта';
    setErr(e);
    if (Object.keys(e).length) { setTab('main'); return; }
    const body = { ...f };
    for (const k of ['events', 'ice', 'created_at', 'updated_at', 'user_id', 'id', '_optimistic']) delete body[k];
    if (isEdit) {
      // optimistic: close immediately, rollback & toast on failure
      update.mutate({ id: hypothesis.id, ...body }, { onSuccess: () => toast.success('Изменения сохранены') });
    } else {
      create.mutate(body, { onSuccess: () => toast.success('Гипотеза создана') });
    }
    onClose();
  }

  const tabs = [['main', 'Гипотеза'], ['smart', 'Метрики и сроки'], ['hadi', 'Результаты (HADI)']];
  return (
    <Modal open={open} onClose={onClose} size="lg" title={isEdit ? 'Редактирование гипотезы' : 'Новая гипотеза'}
      footer={<><Button variant="secondary" onClick={onClose}>Отмена</Button><Button onClick={submit}>{isEdit ? 'Сохранить' : 'Создать'}</Button></>}>
      <div className="-mx-5 -mt-4 mb-5 flex gap-1 border-b border-slate-100 px-5">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>)}
      </div>
      {tab === 'main' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Формулировка *" error={err.title} className="sm:col-span-2"><input className="input" value={f.title} onChange={e => set({ title: e.target.value })} /></Field>
          <Field label="Статус"><Select value={f.status} onChange={v => set({ status: v })} options={STATUSES.map(s => ({ value: s.key, label: s.label }))} /></Field>
          <Field label="Этап воронки"><Select value={f.stage} onChange={v => set({ stage: v })} options={STAGES.map(s => ({ value: s.key, label: `${s.label} (${s.aarrr})` }))} /></Field>
          <Field label="Маркетплейс"><Select value={f.marketplace} onChange={v => set({ marketplace: v })} options={MARKETPLACES} /></Field>
          <Field label="Ответственный"><input className="input" value={f.owner} onChange={e => set({ owner: e.target.value })} /></Field>
          <Field label="Товар"><input className="input" value={f.product} onChange={e => set({ product: e.target.value })} /></Field>
          <Field label="Артикул"><input className="input" value={f.sku} onChange={e => set({ sku: e.target.value })} /></Field>
          <Field label="Проблема" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={f.problem} onChange={e => set({ problem: e.target.value })} /></Field>
          <Field label="Действие (Action)" className="sm:col-span-2"><textarea className="input min-h-[70px]" value={f.action} onChange={e => set({ action: e.target.value })} /></Field>
          <Field label="Обоснование" className="sm:col-span-2"><textarea className="input min-h-[60px]" value={f.rationale} onChange={e => set({ rationale: e.target.value })} /></Field>
          <Field label="Теги" className="sm:col-span-2"><TagInput value={f.tags} onChange={tags => set({ tags })} /></Field>
        </div>
      )}
      {tab === 'smart' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ключевая метрика"><Select value={f.metric} onChange={v => set({ metric: v })} options={METRICS.map(m => ({ value: m.key, label: m.label }))} /></Field>
          <Field label="Цель, %"><input type="number" className="input" value={f.target_pct} onChange={e => { const v = e.target.value; const t = targetFrom(f.metric, f.baseline, v === '' ? null : +v); set({ target_pct: v, ...(t != null ? { target: +t.toFixed(4) } : {}) }); }} /></Field>
          <Field label="Baseline" hint={METRIC_MAP[f.metric]?.format === 'pct' ? 'Доля, напр. 0,041' : ''}><input type="number" step="any" className="input" value={f.baseline} onChange={e => set({ baseline: e.target.value })} /></Field>
          <Field label="Целевое значение"><input type="number" step="any" className="input" value={f.target} onChange={e => set({ target: e.target.value })} /></Field>
          <Field label="Старт"><input type="date" className="input" value={f.start_date} onChange={e => set({ start_date: e.target.value })} /></Field>
          <Field label="Окончание" error={err.end_date}><input type="date" className="input" value={f.end_date} onChange={e => set({ end_date: e.target.value })} /></Field>
          <Field label="Окно «до», дней" hint="По умолчанию — длительность теста (14–28)"><input type="number" className="input" value={f.before_days} onChange={e => set({ before_days: e.target.value })} placeholder="авто" /></Field>
          <Field label="Окно «после», дней"><input type="number" className="input" value={f.after_days} onChange={e => set({ after_days: e.target.value })} placeholder="авто" /></Field>
          <Field label="Датасет для анализа"><Select value={f.dataset_id} onChange={v => set({ dataset_id: v, dataset_sku: '' })} placeholder="— не привязан —" options={(datasets || []).map(d => ({ value: d.id, label: d.name }))} /></Field>
          <Field label="Артикул в датасете">{ds?.skus?.length ? <Select value={f.dataset_sku} onChange={v => set({ dataset_sku: v })} placeholder="Все (сумма)" options={ds.skus} /> : <input className="input" disabled value="—" />}</Field>
          <Field label="Бюджет, ₽"><input type="number" className="input" value={f.budget} onChange={e => set({ budget: e.target.value })} /></Field>
          <div className="sm:col-span-2 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-3">
            <Slider label="Impact" value={+f.impact} onChange={v => set({ impact: v })} />
            <Slider label="Confidence" value={+f.confidence} onChange={v => set({ confidence: v })} />
            <Slider label="Ease" value={+f.ease} onChange={v => set({ ease: v })} />
            <div className="text-sm text-slate-600 sm:col-span-3">ICE-скор: <b className="text-brand-700">{iceScore(f.impact, f.confidence, f.ease).toFixed(1)}</b></div>
          </div>
        </div>
      )}
      {tab === 'hadi' && (
        <div className="space-y-4">
          <Field label="Ожидаемый результат"><textarea className="input min-h-[60px]" value={f.expected} onChange={e => set({ expected: e.target.value })} /></Field>
          <Field label="Фактический результат (Data)"><textarea className="input min-h-[70px]" value={f.result} onChange={e => set({ result: e.target.value })} placeholder="CTR вырос на 22%, эффект сохранился после теста" /></Field>
          <Field label="Выводы (Insights)"><textarea className="input min-h-[70px]" value={f.insights} onChange={e => set({ insights: e.target.value })} /></Field>
          <Field label="Следующие шаги"><textarea className="input min-h-[60px]" value={f.next_steps} onChange={e => set({ next_steps: e.target.value })} /></Field>
        </div>
      )}
    </Modal>
  );
}
