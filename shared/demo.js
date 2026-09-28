// Demo data shared by the Node server and the in-browser (GitHub Pages) backend.
// Synthetic marketplace analytics with embedded experiment effects; dates are relative
// to "yesterday", so the demo always looks fresh.
import XLSX from './xlsx.js';

const iso = d => d.toISOString().slice(0, 10);
export const addDays = (s, n) => iso(new Date(new Date(s + 'T00:00:00Z').getTime() + n * 864e5));
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function demoDates() {
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const end = addDays(iso(today), -1);
  const start = addDays(end, -144);
  return { start, end, today: iso(today) };
}

const PRODUCTS = [
  { sku: '184523761', name: 'Платье льняное миди', views: 14000, ctr: 0.041, crCart: 0.085, cartOrder: 0.36, price: 3490, buyout: 0.62, ad: 5200, stock: 900, rating: 4.72 },
  { sku: '175990312', name: 'Худи оверсайз унисекс', views: 21000, ctr: 0.047, crCart: 0.092, cartOrder: 0.34, price: 2790, buyout: 0.68, ad: 6800, stock: 1400, rating: 4.81 },
  { sku: '201334870', name: 'Термокружка 450 мл', views: 9500, ctr: 0.052, crCart: 0.11, cartOrder: 0.41, price: 1290, buyout: 0.9, ad: 2300, stock: 650, rating: 4.86 },
];

// Effects relative to "end" date (days offset), so demo is always fresh.
function effects(end) {
  const d = n => addDays(end, n);
  return [
    { sku: '184523761', from: d(-84), to: d(-71), persist: true, mult: { ctr: 1.24 } },           // new cover photo: success
    { sku: '175990312', from: d(-62), to: d(-42), persist: true, mult: { buyout: 1.11 } },        // size chart: scaling
    { sku: '201334870', from: d(-50), to: d(-37), persist: false, mult: { price: 1.08, crCart: 0.93 } }, // price test: fail-ish
    { sku: '175990312', from: d(-30), to: d(-17), persist: false, mult: { ad: 0.8, views: 0.97 } },  // DRR optimisation: partial
    { sku: '184523761', from: d(-12), to: d(2), persist: true, mult: { crCart: 1.16 } },          // infographic: testing now
    { sku: '184523761', from: d(-110), to: d(-104), persist: false, mult: { views: 1.6, price: 0.85 } }, // promo action
  ];
}

export function generateDaily() {
  const { start, end } = demoDates();
  const r = rng(42);
  const eff = effects(end);
  const rows = [];
  for (const p of PRODUCTS) {
    let stock = p.stock, rating = p.rating;
    for (let i = 0; ; i++) {
      const date = addDays(start, i); if (date > end) break;
      const dow = new Date(date).getUTCDay();
      const season = 1 + 0.12 * Math.sin(i / 22) + (dow === 0 || dow === 6 ? 0.1 : 0) + i * 0.0012;
      const m = { views: 1, ctr: 1, crCart: 1, cartOrder: 1, price: 1, buyout: 1, ad: 1 };
      for (const e of eff) {
        if (e.sku !== p.sku) continue;
        const active = date >= e.from && date <= e.to;
        const after = e.persist && date > e.to;
        if (active || after) for (const [k, v] of Object.entries(e.mult)) m[k] *= after ? 1 + (v - 1) * 0.9 : v;
      }
      const noise = (s) => 1 + (r() - 0.5) * s;
      const price = Math.round(p.price * m.price / 10) * 10 - 10;
      const views = Math.round(p.views * season * m.views * noise(0.18));
      const clicks = Math.round(views * p.ctr * m.ctr * noise(0.12));
      const cart = Math.round(clicks * p.crCart * m.crCart * noise(0.16));
      const orders = Math.round(cart * p.cartOrder * m.cartOrder * noise(0.14));
      const buyouts = Math.round(orders * Math.min(0.98, p.buyout * m.buyout * noise(0.08)));
      const returns = Math.max(0, Math.round((orders - buyouts) * 0.25 * noise(0.5)));
      const ad = Math.round(p.ad * m.ad * season * noise(0.2));
      stock = stock - orders + (i % 14 === 0 ? orders * 14 : 0); if (stock < 60) stock += 800;
      rating = Math.min(4.95, Math.max(4.4, rating + (r() - 0.5) * 0.01));
      rows.push({ date, sku: p.sku, name: p.name, views, clicks, cart, orders, order_sum: orders * price, buyouts, revenue: buyouts * price, ad_spend: ad, returns, price, stock, rating: +rating.toFixed(2), reviews: Math.round(orders * 0.06 * noise(0.8)) });
    }
  }
  return rows;
}

const ruDate = s => { const [y, m, d] = s.split('-'); return `${d}.${m}.${y}`; };

export const SAMPLE_FILES = { wb: 'wb_voronka_po_dnyam.xlsx', ozon: 'ozon_analitika_wide.xlsx', template: 'shablon_hypolab.xlsx' };

/** Build the three demo workbooks in memory: { [filename]: workbook } */
export function buildWorkbooks() {
  const rows = generateDaily();
  const { start, end } = demoDates();
  // 1) WB-style long report ("Воронка продаж по дням")
  const header = ['Дата', 'Артикул WB', 'Название', 'Показы', 'Переходы в карточку', 'Положили в корзину', 'Заказали, шт', 'Заказали на сумму, ₽', 'Выкупили, шт', 'Выкупили на сумму, ₽', 'Расходы на рекламу, ₽', 'Возвраты, шт', 'Средняя цена, ₽', 'Остатки, шт', 'Рейтинг', 'Новые отзывы', 'Конверсия в корзину, %'];
  const aoa = [
    ['Воронка продаж по дням — ООО «Льняная мастерская»'],
    [`Период: ${ruDate(start)} – ${ruDate(end)}`],
    [],
    header,
    ...rows.map(r => [new Date(r.date + 'T12:00:00'), r.sku, r.name, r.views, r.clicks, r.cart, r.orders, r.order_sum, r.buyouts, r.revenue, r.ad_spend, r.returns, r.price, r.stock, r.rating, r.reviews, +(r.cart / r.clicks * 100).toFixed(2)]),
    ['Итого', '', '', rows.reduce((a, r) => a + r.views, 0)],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  ws['!cols'] = header.map((h, i) => ({ wch: i === 2 ? 26 : Math.max(12, h.length + 2) }));
  for (let r = 4; r < 4 + rows.length; r++) { const c = ws[XLSX.utils.encode_cell({ r, c: 0 })]; if (c) c.z = 'dd.mm.yyyy'; }
  XLSX.utils.book_append_sheet(wb, ws, 'Воронка по дням');
  const info = XLSX.utils.aoa_to_sheet([['Отчёт сформирован автоматически'], ['Источник', 'Wildberries — Аналитика — Воронка продаж']]);
  XLSX.utils.book_append_sheet(wb, info, 'Инфо');
  

  // 2) Ozon-style wide pivot: metrics in rows, dates in columns (one SKU, totals)
  const mug = rows.filter(r => r.sku === '201334870').slice(-70);
  const wide = [
    ['Аналитика Ozon · Термокружка 450 мл · offer_id MUG-450-BLK'],
    ['Показатель', ...mug.map(r => ruDate(r.date))],
    ['Показы всего', ...mug.map(r => r.views)],
    ['Посещения карточки товара', ...mug.map(r => r.clicks)],
    ['Добавления в корзину', ...mug.map(r => r.cart)],
    ['Заказано товаров', ...mug.map(r => r.orders)],
    ['Заказано на сумму', ...mug.map(r => r.order_sum.toLocaleString('ru-RU') + ' ₽')],
    ['Расходы на продвижение', ...mug.map(r => r.ad_spend)],
    ['Средняя цена', ...mug.map(r => r.price)],
    ['Позиция в поиске', ...mug.map((r, i) => +(14 - Math.sin(i / 5) * 3 + (i % 3)).toFixed(1))],
  ];
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.aoa_to_sheet(wide), 'Аналитика');
  

  // 3) Simple template
  const tpl = [['Дата', 'Артикул', 'Показы', 'Переходы', 'Корзины', 'Заказы', 'Выручка', 'Расход на рекламу', 'Цена'], ['01.09.2026', '123456', 10000, 420, 38, 14, 41860, 3500, 2990]];
  const wb3 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb3, XLSX.utils.aoa_to_sheet(tpl), 'Данные');
  
  return { [SAMPLE_FILES.wb]: wb, [SAMPLE_FILES.ozon]: wb2, [SAMPLE_FILES.template]: wb3 };
}

export const DEMO_DATASETS = [
  { file: SAMPLE_FILES.wb, name: 'WB · Воронка продаж по дням', marketplace: 'Wildberries', key: 'wbId' },
  { file: SAMPLE_FILES.ozon, name: 'Ozon · Термокружка (сводная)', marketplace: 'Ozon', key: 'ozId' },
];

export const STATUS_RU = { planned: 'Запланирована', testing: 'Тестируется', completed: 'Завершена', scaling: 'Масштабируется', canceled: 'Отменена' };

/** Demo hypotheses with timestamps and events. Returns [{ row, events: [{type,text,created_at}] }] */
export function demoHypotheses({ wbId, ozId }) {
  const { end } = demoDates();
  const d = n => addDays(end, n);
  const H = [
    { title: 'Новое главное фото платья повысит CTR на 15%', marketplace: 'Wildberries', product: 'Платье льняное миди', sku: '184523761', stage: 'ctr', problem: 'CTR карточки 4,1% — ниже медианы категории (5,2%)', action: 'Заменить главное фото на lifestyle-сцену у моря с плашкой «100% лён»', expected: 'CTR вырастет с 4,1% до 4,7%', rationale: 'У топ-5 конкурентов обложки — живые сцены, наша студийная фотография теряется в выдаче', metric: 'ctr', baseline: 0.041, target: 0.047, target_pct: 15, start_date: d(-84), end_date: d(-71), impact: 8, confidence: 7, ease: 8, status: 'completed', result: 'CTR вырос на ~24% и сохранился после теста. Выручка карточки +19%.', insights: 'Lifestyle-обложки работают лучше студийных в категории «Платья». Плашка с материалом усиливает эффект.', next_steps: 'Масштабировать подход на 12 карточек летней коллекции', tags: ['фото', 'контент'], budget: 18000, owner: 'Анна К.', dataset_id: wbId, dataset_sku: '184523761' },
    { title: 'Подробная размерная сетка худи увеличит выкуп на 8%', marketplace: 'Wildberries', product: 'Худи оверсайз унисекс', sku: '175990312', stage: 'buyout', problem: 'Процент выкупа 68%, 41% возвратов — «не подошёл размер»', action: 'Добавить таблицу замеров изделия, фото на моделях 165/180/190 см и подсказку «берите на размер меньше»', expected: 'Процент выкупа вырастет с 68% до 73%', rationale: 'В отзывах 60% негатива про размер — покупатели не понимают посадку оверсайз', metric: 'buyout_rate', baseline: 0.68, target: 0.735, target_pct: 8, start_date: d(-62), end_date: d(-42), impact: 8, confidence: 7, ease: 8, status: 'scaling', result: 'Выкуп +11%, эффект устойчивый. Логистические потери снизились на ~52 тыс. ₽/мес.', insights: 'Размерные подсказки критичны для oversize-кроя.', next_steps: 'Внедрить шаблон размерной сетки во все карточки верхней одежды', tags: ['размеры', 'fashion'], budget: 12000, owner: 'Игорь М.', dataset_id: wbId, dataset_sku: '175990312' },
    { title: 'Повышение цены термокружки на 8% увеличит выручку', marketplace: 'Wildberries', product: 'Термокружка 450 мл', sku: '201334870', stage: 'economics', problem: 'Маржинальность 18% — ниже целевых 25%', action: 'Поднять цену с 1 280 до 1 380 ₽ на 2 недели', expected: 'Выручка вырастет на 5% при падении конверсии не более 3%', rationale: 'Рейтинг 4,86 и мало прямых аналогов — спрос может быть неэластичен', metric: 'revenue', baseline: null, target: null, target_pct: 5, start_date: d(-50), end_date: d(-37), impact: 7, confidence: 5, ease: 9, status: 'completed', result: 'Конверсия в корзину упала на ~7%, выручка без значимого роста. Цена возвращена.', insights: 'Спрос в категории эластичен: покупатели сравнивают цены в выдаче.', next_steps: 'Проверить рост маржи через комплект «кружка + крышка»', tags: ['цена', 'маржа'], budget: 0, owner: 'Анна К.', dataset_id: wbId, dataset_sku: '201334870' },
    { title: 'Чистка минус-фраз снизит ДРР худи до 10%', marketplace: 'Wildberries', product: 'Худи оверсайз унисекс', sku: '175990312', stage: 'economics', problem: 'ДРР 13–14%, треть бюджета — нерелевантные запросы', action: 'Отключить 38 запросов без заказов, перераспределить бюджет на 12 конверсионных ключей', expected: 'ДРР снизится с 13,5% до 10%', rationale: 'Статистика кластеров показывает 34% расходов без заказов', metric: 'drr', baseline: 0.135, target: 0.105, target_pct: 20, start_date: d(-30), end_date: d(-17), impact: 7, confidence: 7, ease: 8, status: 'completed', result: 'ДРР снизилась примерно на 17–18%, показы почти не просели.', insights: 'Регулярная чистка минус-фраз даёт быстрый эффект без потерь трафика.', next_steps: 'Ввести еженедельную чистку по чек-листу', tags: ['реклама', 'ДРР'], budget: 0, owner: 'Игорь М.', dataset_id: wbId, dataset_sku: '175990312' },
    { title: 'Инфографика с ответами на возражения поднимет CR в корзину на 12%', marketplace: 'Wildberries', product: 'Платье льняное миди', sku: '184523761', stage: 'conversion', problem: 'Конверсия в корзину 8,5% при среднем по категории 10%', action: 'Переделать слайды 2–6: состав и уход, замеры, фото ткани крупно, сравнение с аналогами', expected: 'CR в корзину вырастет с 8,5% до 9,5%', rationale: 'Топ вопросов в карточке — «просвечивает ли?», «мнётся ли?»', metric: 'cr_cart', baseline: 0.085, target: 0.095, target_pct: 12, start_date: d(-12), end_date: d(2), impact: 7, confidence: 6, ease: 7, status: 'testing', tags: ['инфографика', 'контент'], budget: 15000, owner: 'Анна К.', dataset_id: wbId, dataset_sku: '184523761' },
    { title: 'Участие в акции «Осенняя распродажа» даст +60% показов', marketplace: 'Wildberries', product: 'Худи оверсайз унисекс', sku: '175990312', stage: 'visibility', problem: 'Показы стагнируют последние 3 недели', action: 'Подать худи в акцию со скидкой 20% (в пределах юнит-экономики)', expected: 'Показы вырастут на 60% за время акции', rationale: 'Прошлые акции давали +40–120% показов', metric: 'views', target_pct: 60, start_date: d(8), end_date: d(15), impact: 8, confidence: 6, ease: 8, status: 'planned', tags: ['акции', 'промо'], budget: 0, owner: 'Игорь М.' },
    { title: 'Видеообложка термокружки увеличит CTR на 10%', marketplace: 'Ozon', product: 'Термокружка 450 мл', sku: 'MUG-450-BLK', stage: 'ctr', problem: 'CTR 5,2% на Ozon — среднее значение, конкуренты используют видео', action: 'Снять 8-секундное видео: кружку наполняют кипятком и переворачивают — не протекает', expected: 'CTR вырастет на 10%', rationale: 'Видео демонстрирует ключевое УТП — герметичность', metric: 'ctr', target_pct: 10, start_date: d(14), end_date: d(28), impact: 6, confidence: 5, ease: 6, status: 'planned', tags: ['видео'], budget: 9000, owner: 'Мария С.', dataset_id: ozId },
    { title: 'Набор «кружка + сменная крышка» повысит средний чек на 20%', marketplace: 'Ozon', product: 'Термокружка 450 мл', sku: 'MUG-450-BLK', stage: 'economics', problem: 'Средний чек 1 290 ₽ — логистика съедает 22% цены', action: 'Создать набор с выгодой 10% и продвигать его в рекомендациях', expected: 'Средний чек вырастет до 1 550 ₽', rationale: '14% покупателей в отзывах спрашивают про запасную крышку', metric: 'aov', target_pct: 20, impact: 7, confidence: 5, ease: 5, status: 'planned', tags: ['ассортимент', 'чек'], budget: 25000, owner: 'Мария С.' },
    { title: 'Баллы за отзывы увеличат число отзывов платья в 2 раза', marketplace: 'Wildberries', product: 'Платье льняное миди', sku: '184523761', stage: 'loyalty', problem: 'Всего 4–6 новых отзывов в неделю', action: 'Подключить «Баллы за отзывы» — 150 ₽ за отзыв с фото', expected: 'Новых отзывов станет в 2 раза больше', rationale: 'Больше свежих отзывов с фото → выше конверсия', metric: 'reviews', target_pct: 100, impact: 6, confidence: 8, ease: 9, status: 'planned', tags: ['отзывы'], budget: 10000, owner: 'Анна К.' },
    { title: 'Внешний трафик из Telegram-каналов для худи', marketplace: 'Wildberries', product: 'Худи оверсайз унисекс', sku: '175990312', stage: 'visibility', problem: 'Зависимость от внутренней рекламы WB', action: 'Закупить 4 размещения в fashion-каналах по 15–30 тыс. подписчиков', expected: 'Переходы в карточку +25%', rationale: 'Внешний трафик учитывается в ранжировании', metric: 'clicks', target_pct: 25, impact: 6, confidence: 3, ease: 4, status: 'canceled', result: 'Отменено: бюджет перенесён на акцию, CPM каналов вырос вдвое.', tags: ['внешний трафик'], budget: 60000, owner: 'Игорь М.' },
    { title: 'SEO-оптимизация названия платья под «лён» и «оверсайз»', marketplace: 'Wildberries', product: 'Платье льняное миди', sku: '184523761', stage: 'visibility', problem: 'Карточка не ранжируется по запросам «льняное платье летнее» (частотность 48 тыс.)', action: 'Переписать название и описание, заполнить все характеристики, добавить 20 ключей', expected: 'Показы вырастут на 20%', rationale: 'Релевантность текста — базовый фактор ранжирования', metric: 'views', target_pct: 20, impact: 6, confidence: 6, ease: 9, status: 'planned', tags: ['SEO'], budget: 0, owner: 'Анна К.' },
  ];
  return H.map((h, i) => {
    const created = (h.start_date ? addDays(h.start_date, -7 - i) : d(-5 + (i % 4))) + ' 10:' + String(10 + i).padStart(2, '0') + ':00';
    const updated = (h.end_date && h.end_date < end ? addDays(h.end_date, 2) : d(-(i % 3))) + ' 16:' + String(10 + i).padStart(2, '0') + ':00';
    const row = { baseline: null, target: null, start_date: null, end_date: null, result: null, insights: null, next_steps: null, dataset_id: null, dataset_sku: null, before_days: null, after_days: null, ...h, tags: h.tags || [], created_at: created, updated_at: updated };
    const events = [{ type: 'created', text: `Создана гипотеза «${h.title}»`, created_at: created }];
    if (h.status !== 'planned') events.push({ type: 'status', text: `Статус изменён на «${STATUS_RU[h.status]}»`, created_at: updated });
    return { row, events };
  });
}
