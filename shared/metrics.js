// Shared between server (Node) and client (browser)
export default [
 {
  "key": "views",
  "label": "Показы",
  "short": "Показы",
  "type": "sum",
  "format": "int",
  "aliases": [
   "показы",
   "просмотры",
   "impressions",
   "views",
   "охват",
   "показы всего",
   "показы в поиске и каталоге"
  ]
 },
 {
  "key": "clicks",
  "label": "Переходы в карточку",
  "short": "Переходы",
  "type": "sum",
  "format": "int",
  "aliases": [
   "переходы в карточку",
   "переходы",
   "клики",
   "clicks",
   "открытия карточки",
   "посещения карточки",
   "посещения карточки товара",
   "уникальные посетители",
   "просмотры карточки"
  ]
 },
 {
  "key": "cart",
  "label": "Добавления в корзину",
  "short": "Корзины",
  "type": "sum",
  "format": "int",
  "aliases": [
   "добавления в корзину",
   "корзины",
   "положили в корзину",
   "корзина",
   "в корзину",
   "add to cart",
   "добавили в корзину"
  ]
 },
 {
  "key": "orders",
  "label": "Заказы, шт",
  "short": "Заказы",
  "type": "sum",
  "format": "int",
  "aliases": [
   "заказы",
   "заказали шт",
   "заказано",
   "заказали",
   "orders",
   "заказано товаров",
   "заказы шт",
   "заказано шт"
  ]
 },
 {
  "key": "order_sum",
  "label": "Сумма заказов, ₽",
  "short": "Сумма заказов",
  "type": "sum",
  "format": "money",
  "aliases": [
   "заказали на сумму",
   "сумма заказов",
   "заказано на сумму",
   "заказы руб",
   "заказы на сумму",
   "gmv"
  ]
 },
 {
  "key": "buyouts",
  "label": "Выкупы, шт",
  "short": "Выкупы",
  "type": "sum",
  "format": "int",
  "aliases": [
   "выкупы",
   "выкупили шт",
   "выкупили",
   "выкуплено",
   "доставлено"
  ]
 },
 {
  "key": "revenue",
  "label": "Выручка, ₽",
  "short": "Выручка",
  "type": "sum",
  "format": "money",
  "aliases": [
   "выручка",
   "продажи",
   "revenue",
   "выкупили на сумму",
   "доход",
   "продажи руб",
   "выручка руб"
  ]
 },
 {
  "key": "ad_spend",
  "label": "Расходы на рекламу, ₽",
  "short": "Реклама",
  "type": "sum",
  "format": "money",
  "lowerBetter": true,
  "aliases": [
   "расход",
   "расходы на рекламу",
   "затраты",
   "рекламный бюджет",
   "ad spend",
   "spend",
   "затраты на рекламу",
   "расходы на продвижение"
  ]
 },
 {
  "key": "returns",
  "label": "Возвраты, шт",
  "short": "Возвраты",
  "type": "sum",
  "format": "int",
  "lowerBetter": true,
  "aliases": [
   "возвраты",
   "returns",
   "отказы",
   "возвраты шт"
  ]
 },
 {
  "key": "price",
  "label": "Цена, ₽",
  "short": "Цена",
  "type": "avg",
  "format": "money",
  "aliases": [
   "цена",
   "средняя цена",
   "price",
   "цена со скидкой",
   "цена продажи"
  ]
 },
 {
  "key": "stock",
  "label": "Остатки, шт",
  "short": "Остатки",
  "type": "avg",
  "format": "int",
  "aliases": [
   "остатки",
   "остаток",
   "stock",
   "сток",
   "остатки шт",
   "остатки на складах"
  ]
 },
 {
  "key": "rating",
  "label": "Рейтинг товара",
  "short": "Рейтинг",
  "type": "avg",
  "format": "dec",
  "aliases": [
   "рейтинг",
   "оценка",
   "rating",
   "средняя оценка",
   "рейтинг товара"
  ]
 },
 {
  "key": "reviews",
  "label": "Новые отзывы",
  "short": "Отзывы",
  "type": "sum",
  "format": "int",
  "aliases": [
   "отзывы",
   "новые отзывы",
   "кол во отзывов",
   "reviews",
   "количество отзывов"
  ]
 },
 {
  "key": "position",
  "label": "Позиция в выдаче",
  "short": "Позиция",
  "type": "avg",
  "format": "dec",
  "lowerBetter": true,
  "aliases": [
   "позиция",
   "средняя позиция",
   "position",
   "позиция в поиске",
   "позиция в выдаче"
  ]
 },
 {
  "key": "ctr",
  "label": "CTR карточки",
  "short": "CTR",
  "type": "ratio",
  "format": "pct",
  "derive": [
   "clicks",
   "views"
  ],
  "aliases": [
   "ctr",
   "кликабельность",
   "ctr карточки"
  ]
 },
 {
  "key": "cr_cart",
  "label": "Конверсия в корзину",
  "short": "CR в корзину",
  "type": "ratio",
  "format": "pct",
  "derive": [
   "cart",
   "clicks"
  ],
  "aliases": [
   "конверсия в корзину",
   "cr в корзину",
   "cr корзина"
  ]
 },
 {
  "key": "conv",
  "label": "Конверсия в заказ",
  "short": "CR в заказ",
  "type": "ratio",
  "format": "pct",
  "derive": [
   "orders",
   "clicks"
  ],
  "aliases": [
   "конверсия в заказ",
   "конверсия",
   "cr",
   "cr в заказ",
   "конверсия из карточки в заказ"
  ]
 },
 {
  "key": "aov",
  "label": "Средний чек, ₽",
  "short": "Ср. чек",
  "type": "ratio",
  "format": "money",
  "derive": [
   "order_sum",
   "orders"
  ],
  "aliases": [
   "средний чек",
   "aov",
   "средний чек руб"
  ]
 },
 {
  "key": "buyout_rate",
  "label": "Процент выкупа",
  "short": "% выкупа",
  "type": "ratio",
  "format": "pct",
  "derive": [
   "buyouts",
   "orders"
  ],
  "aliases": [
   "процент выкупа",
   "выкуп",
   "% выкупа",
   "процент выкупа %"
  ]
 },
 {
  "key": "drr",
  "label": "ДРР",
  "short": "ДРР",
  "type": "ratio",
  "format": "pct",
  "lowerBetter": true,
  "derive": [
   "ad_spend",
   "order_sum"
  ],
  "aliases": [
   "дрр",
   "drr",
   "acos",
   "доля рекламных расходов"
  ]
 }
];
