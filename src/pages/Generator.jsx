import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Circle, Database, Eye, Lightbulb, MousePointerClick, PackageCheck, PenLine, Rocket, ShoppingCart, Sparkles, Star, Wallet, Wand2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useCreateHypothesis, useDatasets } from '../lib/hooks';
import { MARKETPLACES, METRICS, METRIC_MAP, STAGES, STAGE_MAP, TACTICS, fmtMetric, iceScore, addDays, daysBetween } from '../lib/constants';
import { buildStatement, buildTitle, defaultDates, smartChecks, targetFrom } from '../lib/smart';
import { Button, Field, IceBadge, PageHeader, Select, Slider, Spinner, TagInput, cn } from '../components/ui';

const STAGE_ICONS = { visibility: Eye, ctr: MousePointerClick, conversion: ShoppingCart, buyout: PackageCheck, economics: Wallet, loyalty: Star };
const STEPS = ['Контекст', 'Точка роста', 'Идея', 'SMART', 'ICE и план'];

function Stepper({ step, setStep, maxStep }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1 scroll-thin">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <button disabled={i > maxStep} onClick={() => setStep(i)} className={cn('flex items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-3 text-sm transition', i === step ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20' : i < step || i <= maxStep ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-400')}>
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold', i === step ? 'bg-white/20' : i < step ? 'bg-brand-100 text-brand-700' : 'bg-slate-100')}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>{s}
          </button>
          {i < STEPS.length - 1 && <span className="h-px w-4 bg-slate-200 sm:w-8" />}
        </li>
      ))}
    </ol>
  );
}

export default function Generator() {
  const nav = useNavigate();
  const create = useCreateHypothesis();
  const { data: datasets } = useDatasets();
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [h, setH] = useState(() => ({ marketplace: 'Wildberries', product: '', sku: '', dataset_id: '', dataset_sku: '', stage: '', problem: '', tacticId: '', action: '', rationale: '', metric: '', baseline: '', target_pct: '', target: '', ...defaultDates(14), impact: 5, confidence: 5, ease: 5, owner: '', budget: '', tags: [], expected: '' }));
  const set = patch => setH(p => ({ ...p, ...patch }));
  const go = n => { setStep(n); setMaxStep(m => Math.max(m, n)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const ds = datasets?.find(d => d.id === +h.dataset_id);
  const baselineQ = useQuery({
    queryKey: ['baseline', h.dataset_id, h.dataset_sku, h.metric],
    queryFn: () => api(`/datasets/${h.dataset_id}/baseline?metric=${h.metric}&sku=${encodeURIComponent(h.dataset_sku || '')}`),
    enabled: !!h.dataset_id && !!h.metric && !!ds?.metrics.includes(h.metric),
  });
  useEffect(() => {
    if (baselineQ.data?.value != null) set({ baseline: +baselineQ.data.value.toFixed(METRIC_MAP[h.metric]?.format === 'pct' ? 4 : 2) });
  }, [baselineQ.data]); // eslint-disable-line
  useEffect(() => { const t = targetFrom(h.metric, h.baseline, h.target_pct); set({ target: t == null ? '' : +t.toFixed(4) }); }, [h.metric, h.baseline, h.target_pct]);

  const stage = STAGE_MAP[h.stage];
  const tactics = useMemo(() => TACTICS.filter(t => t.stage === h.stage).map(t => ({ ...t, ice: iceScore(...t.ice) })).sort((a, b) => b.ice - a.ice), [h.stage]);
  const checks = smartChecks(h);
  const statement = buildStatement(h);
  const ice = iceScore(h.impact, h.confidence, h.ease);
  const canNext = [!!h.product.trim(), !!h.stage && !!h.problem.trim(), !!h.action.trim(), checks.filter(c => c.ok).length >= 4, true][step];

  function pickTactic(t) {
    const prod = h.product ? `«${h.product}»` : 'товара';
    set({ tacticId: t.id, action: t.action.replace('{product}', prod), rationale: t.why, metric: t.metric, target_pct: Math.round((t.lift[0] + t.lift[1]) / 2 / 5) * 5 || t.lift[0], impact: t.ice[0], confidence: t.ice[1], ease: t.ice[2], tags: t.tags, tacticTitle: t.title, ...(!h._datesTouched ? { start_date: h.start_date, end_date: addDays(h.start_date, t.days - 1) } : {}) });
  }

  async function save(andNew) {
    const title = h.title?.trim() || buildTitle(h);
    const body = { ...h, title, expected: h.expected || statement, sku: h.sku || null, dataset_id: h.dataset_id || null, dataset_sku: h.dataset_sku || null };
    delete body.tacticId; delete body.tacticTitle; delete body._datesTouched;
    const p = create.mutateAsync(body);
    toast.promise(p, { loading: 'Сохраняем гипотезу…', success: 'Гипотеза добавлена в бэклог', error: e => e.message });
    if (andNew) {
      // optimistic: stay on page and reset idea-related fields immediately
      setH(p0 => ({ ...p0, tacticId: '', action: '', rationale: '', metric: '', baseline: '', target_pct: '', target: '', title: undefined, expected: '', tags: [] })); setStep(2);
    } else {
      nav('/backlog');
    }
    await p.catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Генератор гипотез" subtitle="Growth Hacking (AARRR) → SMART-формулировка → ICE-приоритизация → цикл HADI" />
      <div className="card mb-6 px-3 py-2.5"><Stepper step={step} setStep={setStep} maxStep={maxStep} /></div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card p-5 sm:p-6 animate-fade-in" key={step}>
          {step === 0 && (
            <div className="space-y-5">
              <StepTitle n={1} title="О каком товаре гипотеза?" text="Контекст нужен для точной формулировки и автоматического расчёта базовых значений из ваших данных." />
              <Field label="Маркетплейс">
                <div className="flex flex-wrap gap-2">{MARKETPLACES.map(m => (
                  <button key={m} onClick={() => set({ marketplace: m })} className={cn('rounded-lg border px-3 py-1.5 text-sm transition', h.marketplace === m ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300')}>{m}</button>))}</div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Товар / карточка *"><input autoFocus className="input" value={h.product} onChange={e => set({ product: e.target.value })} placeholder="Например, Платье льняное миди" /></Field>
                <Field label="Артикул" hint="nmID для WB, offer_id/SKU для Ozon"><input className="input" value={h.sku} onChange={e => set({ sku: e.target.value })} placeholder="184523761" /></Field>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4 text-brand-600" />Привязать данные (необязательно)</div>
                <p className="mt-1 text-xs text-slate-500">Базовое значение метрики рассчитается автоматически по последним 28 дням выгрузки.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Select value={h.dataset_id} onChange={v => set({ dataset_id: v, dataset_sku: '' })} placeholder="— без датасета —" options={(datasets || []).map(d => ({ value: d.id, label: d.name }))} />
                  {ds?.skus?.length > 0 && <Select value={h.dataset_sku} onChange={v => { set({ dataset_sku: v, sku: h.sku || v }); }} placeholder="Все артикулы (сумма)" options={ds.skus} />}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <StepTitle n={2} title="Где узкое место в воронке?" text="Growth Hacking начинается с поиска самого слабого этапа воронки AARRR — там максимальный потенциал роста." />
              <div className="grid gap-3 sm:grid-cols-2">
                {STAGES.map(s => { const I = STAGE_ICONS[s.key]; const active = h.stage === s.key; return (
                  <button key={s.key} onClick={() => set({ stage: s.key, problem: h.stage === s.key ? h.problem : '' })} className={cn('group flex gap-3 rounded-xl border p-3.5 text-left transition', active ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50')}>
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-brand-600')}><I className="h-[18px] w-[18px]" /></div>
                    <div><div className="flex items-center gap-2 text-sm font-semibold">{s.label}<span className="rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-slate-500">{s.aarrr}</span></div><div className="mt-0.5 text-xs text-slate-500">{s.desc}</div></div>
                  </button>); })}
              </div>
              {stage && (
                <div className="animate-fade-in space-y-3">
                  <span className="label">Какой симптом вы наблюдаете? *</span>
                  <div className="flex flex-wrap gap-2">{stage.symptoms.map(s => (
                    <button key={s} onClick={() => set({ problem: s })} className={cn('rounded-full border px-3 py-1 text-[13px] transition', h.problem === s ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-200 bg-white hover:border-brand-300')}>{s}</button>))}</div>
                  <textarea className="input min-h-[72px]" value={h.problem} onChange={e => set({ problem: e.target.value })} placeholder="Опишите проблему своими словами, желательно с цифрами: «CTR 3,8% при среднем по категории 5%»" />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <StepTitle n={3} title="Выберите идею для проверки" text={`Проверенные тактики для этапа «${stage?.label}», отсортированы по ICE. Можно выбрать и доработать, либо написать свою.`} />
              <div className="grid gap-3">
                {tactics.map(t => { const active = h.tacticId === t.id; return (
                  <button key={t.id} onClick={() => pickTactic(t)} className={cn('flex gap-3 rounded-xl border p-3.5 text-left transition', active ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-200 hover:bg-slate-50')}>
                    <div className="pt-0.5">{active ? <CheckCircle2 className="h-5 w-5 text-brand-600" /> : <Circle className="h-5 w-5 text-slate-300" />}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{t.title}</span><IceBadge value={t.ice} /></div>
                      <p className="mt-1 text-[13px] text-slate-600">{t.why}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"><span>Метрика: <b className="font-medium text-slate-700">{METRIC_MAP[t.metric].label}</b></span><span>Ожидаемо: <b className="font-medium text-emerald-700">{METRIC_MAP[t.metric].lowerBetter ? '−' : '+'}{t.lift[0]}…{t.lift[1]}%</b></span><span>Тест: {t.days} дн.</span></div>
                    </div>
                  </button>); })}
                <button onClick={() => set({ tacticId: 'custom', action: '', rationale: '', metric: stage?.metrics[0], tags: [] })} className={cn('flex items-center gap-3 rounded-xl border border-dashed p-3.5 text-left text-sm transition', h.tacticId === 'custom' ? 'border-brand-500 bg-brand-50/50' : 'border-slate-300 hover:border-brand-300')}>
                  <PenLine className="h-5 w-5 text-brand-600" /><span><b className="font-semibold">Своя идея</b><span className="block text-xs text-slate-500">Сформулируйте действие самостоятельно</span></span>
                </button>
              </div>
              {h.tacticId && (
                <div className="animate-fade-in space-y-4 border-t border-slate-100 pt-5">
                  <Field label="Что конкретно делаем (Action) *"><textarea className="input min-h-[80px]" value={h.action} onChange={e => set({ action: e.target.value })} placeholder="Заменить главное фото на lifestyle-сцену с плашкой УТП" /></Field>
                  <Field label="Почему это сработает (обоснование)"><textarea className="input min-h-[64px]" value={h.rationale} onChange={e => set({ rationale: e.target.value })} placeholder="У топ-5 конкурентов обложки — живые сцены…" /></Field>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <StepTitle n={4} title="Сделаем гипотезу SMART" text="Конкретная, измеримая, достижимая, релевантная и ограниченная по времени — иначе результат невозможно интерпретировать." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ключевая метрика">
                  <Select value={h.metric} onChange={v => set({ metric: v, baseline: '' })} options={METRICS.map(m => ({ value: m.key, label: m.label + (stage?.metrics.includes(m.key) ? ' ★' : '') }))} />
                </Field>
                <Field label="Целевое изменение, %" hint={METRIC_MAP[h.metric]?.lowerBetter ? 'Метрика «чем меньше, тем лучше» — укажите желаемое снижение' : 'Минимальный прирост, который вы считаете успехом'}>
                  <input type="number" className="input" value={h.target_pct} onChange={e => set({ target_pct: e.target.value === '' ? '' : +e.target.value })} placeholder="15" />
                </Field>
                <Field label="Текущее значение (baseline)" hint={baselineQ.isFetching ? 'Считаем по данным…' : baselineQ.data ? `Авто: среднее за ${baselineQ.data.days} дн. (${baselineQ.data.from} — ${baselineQ.data.to})` : METRIC_MAP[h.metric]?.format === 'pct' ? 'Доля: 0,041 = 4,1%' : 'Среднее значение в день'}>
                  <div className="relative"><input type="number" step="any" className="input" value={h.baseline} onChange={e => set({ baseline: e.target.value })} placeholder="—" />{baselineQ.isFetching && <Spinner className="absolute right-2.5 top-2.5 h-4 w-4" />}</div>
                </Field>
                <Field label="Целевое значение"><div className="input flex items-center bg-slate-50 tabular-nums text-slate-700">{h.target !== '' ? fmtMetric(h.metric, +h.target) : '—'}{h.baseline !== '' && h.target !== '' && <span className="ml-2 text-xs text-slate-400">(сейчас {fmtMetric(h.metric, +h.baseline)})</span>}</div></Field>
                <Field label="Старт эксперимента"><input type="date" className="input" value={h.start_date} onChange={e => set({ start_date: e.target.value, _datesTouched: true, end_date: h.end_date < e.target.value ? addDays(e.target.value, 13) : h.end_date })} /></Field>
                <Field label="Окончание" hint={h.start_date && h.end_date ? `${daysBetween(h.start_date, h.end_date) + 1} дн. — ${daysBetween(h.start_date, h.end_date) + 1 >= 14 ? 'покрывает 2 недельных цикла' : 'рекомендуем ≥ 14 дней'}` : ''}><input type="date" className="input" value={h.end_date} min={h.start_date} onChange={e => set({ end_date: e.target.value, _datesTouched: true })} /></Field>
              </div>
              <div className="flex flex-wrap gap-2">{[7, 14, 21, 28].map(d => <button key={d} onClick={() => set({ end_date: addDays(h.start_date, d - 1), _datesTouched: true })} className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200">{d} дней</button>)}</div>
              <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700"><Wand2 className="h-3.5 w-3.5" />Формулировка гипотезы</div>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-800">{statement}</p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <StepTitle n={5} title="Приоритизация и план HADI" text="Оценка ICE помогает выбрать, что тестировать первым. Значения подставлены из библиотеки тактик — скорректируйте под себя." />
              <div className="grid gap-5 sm:grid-cols-3">
                <Slider label="Impact — влияние" value={h.impact} onChange={v => set({ impact: v })} hint="Насколько сильно повлияет на цель" />
                <Slider label="Confidence — уверенность" value={h.confidence} onChange={v => set({ confidence: v })} hint="Есть ли данные / кейсы" />
                <Slider label="Ease — простота" value={h.ease} onChange={v => set({ ease: v })} hint="Сколько ресурсов нужно" />
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="text-3xl font-semibold tabular-nums text-brand-700">{ice.toFixed(1)}</div>
                <div className="text-sm text-slate-600"><b className="text-slate-800">ICE-скор</b> — {ice >= 7 ? 'высокий приоритет, берите в работу на этой неделе' : ice >= 5 ? 'средний приоритет, в очередь бэклога' : 'низкий приоритет — стоит поискать идею сильнее'}</div>
              </div>
              <Field label="Короткое название"><input className="input" value={h.title ?? buildTitle(h)} onChange={e => set({ title: e.target.value })} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Ответственный"><input className="input" value={h.owner} onChange={e => set({ owner: e.target.value })} placeholder="Анна К." /></Field>
                <Field label="Бюджет, ₽"><input type="number" className="input" value={h.budget} onChange={e => set({ budget: e.target.value })} placeholder="0" /></Field>
              </div>
              <Field label="Теги"><TagInput value={h.tags} onChange={tags => set({ tags })} /></Field>
              <div className="grid gap-2 sm:grid-cols-4">
                {[['H', 'Hypothesis', h.title ?? buildTitle(h)], ['A', 'Action', h.action], ['D', 'Data', `${METRIC_MAP[h.metric]?.label || '—'} · ${h.start_date} → ${h.end_date}`], ['I', 'Insights', 'Заполните после теста — анализ «до/во время/после» подскажет вывод']].map(([k, t, d]) => (
                  <div key={k} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">{k}</span><span className="text-xs font-semibold text-slate-700">{t}</span></div><p className="mt-2 line-clamp-3 text-xs text-slate-500">{d}</p></div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <Button variant="ghost" icon={ArrowLeft} onClick={() => go(step - 1)} disabled={step === 0}>Назад</Button>
            {step < 4 ? <Button onClick={() => go(step + 1)} disabled={!canNext}>Далее <ArrowRight className="h-4 w-4" /></Button> : (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={Sparkles} onClick={() => save(true)}>Сохранить и ещё идею</Button>
                <Button icon={Rocket} onClick={() => save(false)}>Сохранить в бэклог</Button>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">SMART-чек</h3><span className="text-xs tabular-nums text-slate-500">{checks.filter(c => c.ok).length}/5</span></div>
            <ul className="space-y-2.5">{checks.map(c => (
              <li key={c.k} className="flex gap-2.5">
                <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition', c.ok ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400')}>{c.ok ? <Check className="h-3 w-3" /> : c.k}</span>
                <div><div className={cn('text-[13px]', c.ok ? 'text-slate-800' : 'text-slate-500')}>{c.label}</div>{!c.ok && <div className="text-[11px] text-slate-400">{c.hint}</div>}</div>
              </li>))}</ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Черновик</h3>
            <dl className="mt-3 space-y-2 text-[13px]">
              {[['Товар', h.product], ['Этап', stage?.label], ['Проблема', h.problem], ['Идея', h.tacticTitle || (h.tacticId === 'custom' ? 'Своя' : '')], ['Метрика', METRIC_MAP[h.metric]?.label], ['Цель', h.target_pct !== '' ? `${METRIC_MAP[h.metric]?.lowerBetter ? '−' : '+'}${h.target_pct}%` : '']].map(([k, v]) => (
                <div key={k} className="flex gap-2"><dt className="w-20 shrink-0 text-slate-400">{k}</dt><dd className={cn('min-w-0 flex-1', v ? 'text-slate-700' : 'text-slate-300')}>{v || '—'}</dd></div>))}
            </dl>
          </div>
          <div className="rounded-xl bg-slate-900 p-4 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-amber-300" />Совет</div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{['Одна гипотеза — одно изменение. Если меняете фото и цену одновременно, вы не узнаете, что сработало.', 'Ищите этап с наибольшим отставанием от средних по категории — рост там даёт максимальный эффект на выручку.', 'Лучшие идеи рождаются из отзывов и вопросов покупателей — изучите их перед выбором.', 'Тест короче 7 дней на маркетплейсе искажается днём недели. Оптимально — 14 дней.', 'Не тратьте время на идеи с ICE < 5, пока в бэклоге есть более сильные.'][step]}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StepTitle({ n, title, text }) {
  return (<div><div className="text-xs font-semibold uppercase tracking-wider text-brand-600">Шаг {n} из 5</div><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{text}</p></div>);
}
