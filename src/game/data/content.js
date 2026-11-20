/**
 * Контент игры: инструменты, модели телефонов, неисправности, компоненты платы,
 * запчасти и баланс экономики. Всё в одном месте, чтобы балансить без правок
 * логики и сцен.
 */

/* ------------------------------------------------------------------ */
/*  Инструменты                                                        */
/* ------------------------------------------------------------------ */

export const TOOLS = {
  pentalobe: {
    id: 'pentalobe',
    name: 'Pentalobe P2',
    icon: 'tool_pentalobe',
    price: 0,
    start: true,
    desc: 'Два нижних винта корпуса.',
  },
  torx: {
    id: 'torx',
    name: 'Torx T5',
    icon: 'tool_torx',
    price: 0,
    start: true,
    desc: 'Винты экранирующей пластины.',
  },
  suction: {
    id: 'suction',
    name: 'Присоска',
    icon: 'tool_suction',
    price: 0,
    start: true,
    desc: 'Поднимает крышку и экран.',
  },
  spudger: {
    id: 'spudger',
    name: 'Лопатка',
    icon: 'tool_spudger',
    price: 0,
    start: true,
    desc: 'Отщёлкивает шлейфы и разъёмы.',
  },
  multimeter: {
    id: 'multimeter',
    name: 'Мультиметр',
    icon: 'tool_multimeter',
    price: 0,
    start: true,
    desc: 'Прозвонка платы и замер напряжений.',
  },
  heatgun: {
    id: 'heatgun',
    name: 'Фен 200°C',
    icon: 'tool_heatgun',
    price: 180,
    desc: 'Размягчает клей: шлейф рвётся реже.',
  },
  tweezers: {
    id: 'tweezers',
    name: 'Пинцет',
    icon: 'tool_tweezers',
    price: 140,
    desc: 'Нужен для разъёма и камеры.',
  },
  probits: {
    id: 'probits',
    name: 'Точные биты',
    icon: 'icon_wrench',
    price: 220,
    desc: '−50% урона от ошибок.',
  },
  lamp: {
    id: 'lamp',
    name: 'Лампа 5000K',
    icon: 'icon_bolt',
    price: 260,
    desc: '+10% к оплате заказа.',
  },
};

/** Магазин показывает только то, что ещё не куплено. */
export function shopTools() {
  return Object.values(TOOLS).filter((t) => t.price > 0);
}

/* ------------------------------------------------------------------ */
/*  Модели телефонов                                                   */
/* ------------------------------------------------------------------ */

export const PHONES = {
  'arc-5': {
    id: 'arc-5',
    name: 'Arcelor 5',
    tier: 1,
    frame: '#39424d',
    cover: '#1d2733',
    accent: '#38e8a0',
    note: 'Бюджетник, всё на винтах',
  },
  'nova-x': {
    id: 'nova-x',
    name: 'Nova X',
    tier: 1,
    frame: '#3d4657',
    cover: '#222b3a',
    accent: '#4aa8ff',
    note: 'Клеевой корпус',
  },
  'zenit-7': {
    id: 'zenit-7',
    name: 'Zenit 7 Pro',
    tier: 2,
    frame: '#4a4351',
    cover: '#262032',
    accent: '#ffb020',
    note: 'Три камеры, плотная компоновка',
  },
  'vega-9': {
    id: 'vega-9',
    name: 'Vega 9 Ultra',
    tier: 3,
    frame: '#4b4b52',
    cover: '#242429',
    accent: '#ff5a5f',
    note: 'Флагман, тонкие шлейфы',
  },
};

/* ------------------------------------------------------------------ */
/*  Неисправности                                                      */
/* ------------------------------------------------------------------ */

export const FAULTS = {
  screen: {
    id: 'screen',
    name: 'Разбит экран',
    icon: 'comp_screen',
    part: 'screen',
    component: 'screen',
    tools: ['pentalobe', 'suction', 'spudger'],
    symptom: 'Клиент: «Экран в трещинах, половина не показывает».',
    base: 110,
  },
  battery: {
    id: 'battery',
    name: 'Износ батареи',
    icon: 'comp_battery',
    part: 'battery',
    component: 'battery',
    tools: ['pentalobe', 'suction', 'spudger', 'torx'],
    symptom: 'Клиент: «Садится за час и выключается на холоде».',
    base: 92,
  },
  port: {
    id: 'port',
    name: 'Не заряжается',
    icon: 'comp_port',
    part: 'port',
    component: 'port',
    tools: ['pentalobe', 'torx', 'tweezers'],
    symptom: 'Клиент: «Зарядка работает, только если держать провод».',
    base: 128,
  },
  camera: {
    id: 'camera',
    name: 'Камера не фокусируется',
    icon: 'comp_camera',
    part: 'camera',
    component: 'camera',
    tools: ['pentalobe', 'torx', 'tweezers'],
    symptom: 'Клиент: «Фото мутные, фокус гуляет».',
    base: 118,
  },
};

/* ------------------------------------------------------------------ */
/*  Компоненты для диагностики                                         */
/* ------------------------------------------------------------------ */

export const COMPONENTS = {
  battery: {
    id: 'battery',
    name: 'Аккумулятор',
    icon: 'comp_battery',
    ok: '3.87 В',
    bad: '2.41 В · просадка',
    note: 'Номинал 3.7–4.2 В под нагрузкой',
  },
  screen: {
    id: 'screen',
    name: 'Шлейф дисплея',
    icon: 'comp_screen',
    ok: '0.3 Ом',
    bad: 'обрыв линии',
    note: 'Прозвонка линий дисплея',
  },
  port: {
    id: 'port',
    name: 'Разъём зарядки',
    icon: 'comp_port',
    ok: '5.02 В',
    bad: '0.71 В · окисление',
    note: '5 В на контактах VBUS',
  },
  camera: {
    id: 'camera',
    name: 'Модуль камеры',
    icon: 'comp_camera',
    ok: '1.80 В',
    bad: 'КЗ на линии',
    note: 'Питание модуля 1.8 В',
  },
  speaker: {
    id: 'speaker',
    name: 'Динамик',
    icon: 'comp_speaker',
    ok: '8.0 Ом',
    bad: 'обрыв катушки',
    note: 'Сопротивление катушки',
  },
  ic: {
    id: 'ic',
    name: 'Контроллер питания',
    icon: 'comp_ic',
    ok: '1.10 В',
    bad: '0.00 В · не стартует',
    note: 'Ключевые линии питания',
  },
};

/** Раскладка компонентов на плате (дизайн-единицы, плата 300×360). */
export const BOARD_SLOTS = [
  { id: 'battery', x: 0, y: 108 },
  { id: 'screen', x: -78, y: 12 },
  { id: 'port', x: 78, y: 12 },
  { id: 'camera', x: -78, y: -84 },
  { id: 'speaker', x: 78, y: -84 },
  { id: 'ic', x: 0, y: -30 },
];

/* ------------------------------------------------------------------ */
/*  Запчасти                                                           */
/* ------------------------------------------------------------------ */

export const PARTS = {
  screen: { id: 'screen', name: 'Дисплейный модуль', icon: 'comp_screen', price: 55 },
  battery: { id: 'battery', name: 'Аккумулятор', icon: 'comp_battery', price: 32 },
  port: { id: 'port', name: 'Разъём Type-C', icon: 'comp_port', price: 18 },
  camera: { id: 'camera', name: 'Модуль камеры', icon: 'comp_camera', price: 42 },
};

/* ------------------------------------------------------------------ */
/*  Баланс                                                             */
/* ------------------------------------------------------------------ */

export const BALANCE = {
  startMoney: 220,
  startRep: 50,
  maxRep: 100,
  /** Пороги уровней: индекс = уровень−1, значение = нужный XP. */
  xpLevels: [0, 90, 240, 520, 900, 1400],
  freeProbes: 2,
  probePenalty: 6,
  hintPenalty: 4,
  timeBonus: 0.15,
  maxDamagePenalty: 0.4,
  damageLimit: 100,
};

/* ------------------------------------------------------------------ */
/*  Генерация заказов                                                  */
/* ------------------------------------------------------------------ */

/** Репутация влияет на цену заказов: 0.85 … 1.30 */
export function repMultiplier(rep) {
  const r = Math.max(0, Math.min(BALANCE.maxRep, rep));
  return 0.85 + (r / BALANCE.maxRep) * 0.45;
}

const FAULT_POOL_BY_LEVEL = {
  1: ['screen', 'battery'],
  2: ['screen', 'battery', 'port'],
  3: ['screen', 'battery', 'port', 'camera'],
  4: ['screen', 'battery', 'port', 'camera'],
};

/**
 * Три заказа «на доске». Детерминированно от переданного rng —
 * значит, логику можно тестировать.
 */
export function rollOrders(state, rng, count = 3) {
  const level = Math.max(1, Math.min(4, state.level));
  const faults = FAULT_POOL_BY_LEVEL[level] || FAULT_POOL_BY_LEVEL[1];
  const phones = Object.values(PHONES).filter((p) => p.tier <= level);
  const out = [];

  for (let i = 0; i < count; i++) {
    const fault = FAULTS[faults[Math.floor(rng() * faults.length)]];
    const phone = phones[Math.floor(rng() * phones.length)];
    const part = PARTS[fault.part];
    const tierMul = 1 + (phone.tier - 1) * 0.28;
    const noise = 0.92 + rng() * 0.22;
    const payout =
      Math.round((fault.base * tierMul * noise * repMultiplier(state.rep) + 35) / 5) * 5;

    out.push({
      id: `o${Date.now().toString(36)}${i}${Math.floor(rng() * 1e4).toString(36)}`,
      phoneId: phone.id,
      faultId: fault.id,
      component: fault.component,
      payout,
      partCost: part.price,
      tools: fault.tools.slice(),
      targetSeconds: fault.id === 'battery' ? 150 : 135,
      symptom: fault.symptom,
      createdAt: Date.now(),
    });
  }
  return out;
}

/** Все ли инструменты для заказа есть у игрока. */
export function missingTools(order, owned) {
  return order.tools.filter((t) => !owned.includes(t));
}