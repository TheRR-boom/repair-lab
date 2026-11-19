/**
 * Атлас иконок, собранный в рантайме.
 *
 * Почему так: игре нужны десятки мелких иконок (винты, инструменты, платы,
 * детали). Держать их отдельными PNG — это десятки draw call'ов и лишний вес.
 * Здесь мы рисуем все иконки один раз в один CanvasTexture 1024×1024 и
 * регистрируем кадры — получаем честный атлас без бинарных ассетов.
 *
 * Для продакшена этот же приём заменяется на TexturePacker-атлас: интерфейс
 * `add.image(x, y, 'atlas', frame)` останется тем же.
 */

const CELL = 128;
const SIZE = 1024;

export const ICONS = [
  'screw_pentalobe',
  'screw_torx',
  'screw_phillips',
  'screw_stripped',
  'tool_pentalobe',
  'tool_torx',
  'tool_phillips',
  'tool_suction',
  'tool_spudger',
  'tool_tweezers',
  'tool_heatgun',
  'tool_multimeter',
  'comp_battery',
  'comp_screen',
  'comp_port',
  'comp_camera',
  'comp_speaker',
  'comp_ic',
  'comp_flex',
  'comp_antenna',
  'icon_coin',
  'icon_rep',
  'icon_xp',
  'icon_lock',
  'icon_check',
  'icon_close',
  'icon_back',
  'icon_settings',
  'icon_bolt',
  'icon_star',
  'icon_wrench',
  'icon_power',
  'icon_refresh',
  'icon_info',
];

/** Создаёт (один раз) текстуру-атлас и возвращает её ключ. */
export function buildAtlas(scene) {
  if (scene.textures.exists('atlas')) return 'atlas';

  const tex = scene.textures.createCanvas('atlas', SIZE, SIZE);
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, SIZE, SIZE);

  ICONS.forEach((name, i) => {
    const col = i % (SIZE / CELL);
    const row = Math.floor(i / (SIZE / CELL));
    const x = col * CELL;
    const y = row * CELL;

    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();
    drawIcon(ctx, name);
    ctx.restore();

    // Регистрируем кадр атласа
    tex.add(name, 0, x, y, CELL, CELL);
  });

  tex.refresh();
  return 'atlas';
}

/* ------------------------------------------------------------------ */
/*  Примитивы рисования                                                */
/* ------------------------------------------------------------------ */

const C = {
  metalA: '#b9c7d4',
  metalB: '#7d8fa2',
  metalC: '#3f4c5a',
  dark: '#0e141c',
  dark2: '#182432',
  line: '#2c3a4a',
  accent: '#38e8a0',
  accent2: '#1fb37a',
  warn: '#ffb020',
  danger: '#ff5a5f',
  blue: '#4aa8ff',
  gold: '#ffcc33',
};

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function circle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
}

function metalGrad(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, C.metalA);
  g.addColorStop(0.5, C.metalB);
  g.addColorStop(1, C.metalC);
  return g;
}

function withShadow(ctx, blur, dy, fn) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  fn();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Иконки                                                             */
/* ------------------------------------------------------------------ */

const DRAW = {
  screw_pentalobe: (ctx) => drawScrew(ctx, 5),
  screw_torx: (ctx) => drawScrew(ctx, 6),
  screw_phillips: (ctx) => drawScrew(ctx, 0),
  screw_stripped: (ctx) => drawScrew(ctx, 6, true),

  tool_pentalobe: (ctx) => drawScrewdriver(ctx, 5, C.blue),
  tool_torx: (ctx) => drawScrewdriver(ctx, 6, C.warn),
  tool_phillips: (ctx) => drawScrewdriver(ctx, 0, C.accent),
  tool_suction: drawSuction,
  tool_spudger: drawSpudger,
  tool_tweezers: drawTweezers,
  tool_heatgun: drawHeatgun,
  tool_multimeter: drawMultimeter,

  comp_battery: drawBattery,
  comp_screen: drawScreen,
  comp_port: drawPort,
  comp_camera: drawCamera,
  comp_speaker: drawSpeaker,
  comp_ic: drawChip,
  comp_flex: drawFlex,
  comp_antenna: drawAntenna,

  icon_coin: (ctx) => drawCoin(ctx, C.gold, '₽'),
  icon_rep: (ctx) => drawStar(ctx, C.gold),
  icon_xp: (ctx) => drawBolt(ctx, C.blue),
  icon_lock: drawLock,
  icon_check: (ctx) => drawCheck(ctx, C.accent),
  icon_close: (ctx) => drawCross(ctx, C.danger),
  icon_back: drawBack,
  icon_settings: drawGear,
  icon_bolt: (ctx) => drawBolt(ctx, C.warn),
  icon_star: (ctx) => drawStar(ctx, C.accent),
  icon_wrench: drawWrench,
  icon_power: drawPower,
  icon_refresh: drawRefresh,
  icon_info: drawInfo,
};

function drawIcon(ctx, name) {
  const fn = DRAW[name];
  if (!fn) {
    // Заглушка-ромб, чтобы опечатка в имени была видна, а не ломала атлас
    ctx.fillStyle = '#ff00ff';
    ctx.beginPath();
    ctx.moveTo(64, 24);
    ctx.lineTo(104, 64);
    ctx.lineTo(64, 104);
    ctx.lineTo(24, 64);
    ctx.closePath();
    ctx.fill();
    return;
  }
  fn(ctx);
}

/* --- винты --------------------------------------------------------- */

function drawScrew(ctx, lobes, stripped = false) {
  const cx = 64;
  const cy = 64;

  withShadow(ctx, 14, 5, () => {
    circle(ctx, cx, cy, 45);
    ctx.fillStyle = metalGrad(ctx, 20, 20, 108, 108);
    ctx.fill();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 43, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();

  circle(ctx, cx, cy, 27);
  ctx.fillStyle = '#0a1017';
  ctx.fill();

  if (stripped) {
    // Сорванный шлиц: рваная дырка + красная трещина
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r = i % 2 === 0 ? 21 : 11;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#111a24';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx - 26, cy - 18);
    ctx.lineTo(cx + 6, cy + 2);
    ctx.lineTo(cx - 4, cy + 8);
    ctx.lineTo(cx + 22, cy + 26);
    ctx.strokeStyle = C.danger;
    ctx.lineWidth = 4;
    ctx.stroke();
    return;
  }

  if (lobes === 0) {
    // Крест (Phillips)
    ctx.fillStyle = '#0a1017';
    rr(ctx, cx - 6, cy - 22, 12, 44, 4);
    ctx.fill();
    rr(ctx, cx - 22, cy - 6, 44, 12, 4);
    ctx.fill();
    return;
  }

  // Лепестки: 5 = Pentalobe, 6 = Torx
  ctx.fillStyle = '#0a1017';
  for (let i = 0; i < lobes; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / lobes;
    circle(ctx, cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 8);
    ctx.fill();
  }
  circle(ctx, cx, cy, 10);
  ctx.fill();
}

/* --- инструменты ---------------------------------------------------- */

function drawScrewdriver(ctx, lobes, handleColor) {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-Math.PI / 4);

  withShadow(ctx, 12, 4, () => {
    // рукоятка
    rr(ctx, -48, -20, 50, 40, 14);
    const g = ctx.createLinearGradient(-48, -20, 2, 20);
    g.addColorStop(0, handleColor);
    g.addColorStop(1, '#123');
    ctx.fillStyle = g;
    ctx.fill();

    // стержень
    rr(ctx, 0, -7, 44, 14, 3);
    ctx.fillStyle = metalGrad(ctx, 0, -7, 44, 7);
    ctx.fill();

    // жало
    ctx.beginPath();
    ctx.moveTo(44, -7);
    ctx.lineTo(60, -3);
    ctx.lineTo(60, 3);
    ctx.lineTo(44, 7);
    ctx.closePath();
    ctx.fillStyle = '#9fb0c2';
    ctx.fill();
  });

  // насечки на рукоятке
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-40 + i * 11, -17);
    ctx.lineTo(-40 + i * 11, 17);
    ctx.stroke();
  }

  // маркировка жала
  ctx.beginPath();
  ctx.arc(-8, 0, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  ctx.restore();
}

function drawSuction(ctx) {
  withShadow(ctx, 12, 5, () => {
    // ручка
    rr(ctx, 50, 16, 28, 44, 10);
    ctx.fillStyle = metalGrad(ctx, 50, 16, 78, 60);
    ctx.fill();
    // чашка
    ctx.beginPath();
    ctx.ellipse(64, 84, 46, 26, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#202b36';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(64, 80, 38, 18, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,160,200,0.25)';
    ctx.fill();
  });
  ctx.beginPath();
  ctx.ellipse(64, 84, 45, 25, 0, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawSpudger(ctx) {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-0.5);
  withShadow(ctx, 10, 4, () => {
    rr(ctx, -52, -10, 104, 20, 8);
    const g = ctx.createLinearGradient(-52, -10, 52, 10);
    g.addColorStop(0, '#1b2a36');
    g.addColorStop(0.6, '#2e4250');
    g.addColorStop(1, '#16222c');
    ctx.fillStyle = g;
    ctx.fill();
    // загнутый кончик
    ctx.beginPath();
    ctx.moveTo(52, -10);
    ctx.quadraticCurveTo(66, -2, 54, 12);
    ctx.lineTo(40, 10);
    ctx.quadraticCurveTo(48, 0, 44, -10);
    ctx.closePath();
    ctx.fillStyle = C.accent2;
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-42, -4);
  ctx.lineTo(30, -4);
  ctx.stroke();
  ctx.restore();
}

function drawTweezers(ctx) {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-0.35);
  ctx.strokeStyle = metalGrad(ctx, 0, 0, 0, 70);
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-34, -46);
  ctx.lineTo(30, -6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-34, 46);
  ctx.lineTo(30, 6);
  ctx.stroke();
  // кончики
  ctx.strokeStyle = '#d7e3ee';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(30, -6);
  ctx.lineTo(50, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, 6);
  ctx.lineTo(50, 0);
  ctx.stroke();
  // держатель
  rr(ctx, -52, -14, 22, 28, 8);
  ctx.fillStyle = C.blue;
  ctx.fill();
  ctx.restore();
}

function drawHeatgun(ctx) {
  withShadow(ctx, 12, 4, () => {
    rr(ctx, 22, 44, 62, 44, 14);
    ctx.fillStyle = '#243341';
    ctx.fill();
    rr(ctx, 58, 54, 44, 18, 8);
    ctx.fillStyle = metalGrad(ctx, 58, 54, 102, 72);
    ctx.fill();
    rr(ctx, 34, 86, 18, 30, 6);
    ctx.fillStyle = '#1a2733';
    ctx.fill();
  });
  // сопло
  rr(ctx, 96, 56, 10, 14, 3);
  ctx.fillStyle = C.warn;
  ctx.fill();
  // волны тепла
  ctx.strokeStyle = 'rgba(255,176,32,0.9)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(96, 30 - i * 12);
    ctx.quadraticCurveTo(104, 24 - i * 12, 110, 30 - i * 12);
    ctx.stroke();
  }
  // кнопка
  circle(ctx, 44, 58, 6);
  ctx.fillStyle = C.accent;
  ctx.fill();
}

function drawMultimeter(ctx) {
  withShadow(ctx, 12, 5, () => {
    rr(ctx, 26, 18, 76, 96, 12);
    ctx.fillStyle = '#182430';
    ctx.fill();
  });
  rr(ctx, 34, 26, 60, 34, 6);
  ctx.fillStyle = '#0b1a16';
  ctx.fill();
  // «показания»
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(42, 48);
  ctx.lineTo(52, 38);
  ctx.lineTo(60, 46);
  ctx.lineTo(70, 34);
  ctx.stroke();
  // крутилка
  circle(ctx, 64, 78, 16);
  ctx.fillStyle = '#2b3a48';
  ctx.fill();
  circle(ctx, 64, 78, 4);
  ctx.fillStyle = C.warn;
  ctx.fill();
  // гнёзда щупов
  circle(ctx, 45, 104, 5);
  ctx.fillStyle = C.danger;
  ctx.fill();
  circle(ctx, 67, 104, 5);
  ctx.fillStyle = '#111';
  ctx.fill();
}

/* --- компоненты платы ----------------------------------------------- */

function drawBattery(ctx) {
  withShadow(ctx, 10, 4, () => {
    rr(ctx, 22, 28, 84, 76, 10);
    const g = ctx.createLinearGradient(22, 28, 106, 104);
    g.addColorStop(0, '#2fbf87');
    g.addColorStop(1, '#116b4c');
    ctx.fillStyle = g;
    ctx.fill();
  });
  // контакт
  rr(ctx, 46, 20, 36, 12, 4);
  ctx.fillStyle = '#c8d6e2';
  ctx.fill();
  // молния
  ctx.beginPath();
  ctx.moveTo(70, 40);
  ctx.lineTo(54, 68);
  ctx.lineTo(66, 68);
  ctx.lineTo(58, 94);
  ctx.lineTo(80, 62);
  ctx.lineTo(68, 62);
  ctx.closePath();
  ctx.fillStyle = 'rgba(230,255,245,0.92)';
  ctx.fill();
  // полоски
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  rr(ctx, 30, 92, 68, 4, 2);
  ctx.fill();
}

function drawScreen(ctx) {
  withShadow(ctx, 12, 5, () => {
    rr(ctx, 20, 12, 88, 104, 12);
    ctx.fillStyle = '#0a1119';
    ctx.fill();
  });
  rr(ctx, 26, 18, 76, 92, 8);
  const g = ctx.createLinearGradient(26, 18, 102, 110);
  g.addColorStop(0, 'rgba(80,180,220,0.35)');
  g.addColorStop(0.55, 'rgba(40,90,140,0.15)');
  g.addColorStop(1, 'rgba(120,220,190,0.22)');
  ctx.fillStyle = g;
  ctx.fill();
  // динамик
  rr(ctx, 52, 22, 24, 5, 3);
  ctx.fillStyle = '#2a3745';
  ctx.fill();
  // трещины
  ctx.strokeStyle = 'rgba(220,240,255,0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(38, 30);
  ctx.lineTo(58, 56);
  ctx.lineTo(48, 66);
  ctx.lineTo(74, 96);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(58, 56);
  ctx.lineTo(88, 46);
  ctx.moveTo(58, 56);
  ctx.lineTo(34, 74);
  ctx.stroke();
}

function drawPort(ctx) {
  withShadow(ctx, 8, 4, () => {
    rr(ctx, 30, 40, 68, 48, 22);
    ctx.fillStyle = metalGrad(ctx, 30, 40, 98, 88);
    ctx.fill();
  });
  rr(ctx, 40, 52, 48, 24, 12);
  ctx.fillStyle = '#0b1118';
  ctx.fill();
  rr(ctx, 48, 60, 32, 8, 4);
  ctx.fillStyle = '#33465a';
  ctx.fill();
  // контакты
  ctx.fillStyle = C.warn;
  for (let i = 0; i < 4; i++) {
    rr(ctx, 50 + i * 10, 79, 6, 4, 2);
    ctx.fill();
  }
}

function drawCamera(ctx) {
  withShadow(ctx, 12, 5, () => {
    circle(ctx, 64, 64, 46);
    ctx.fillStyle = '#1b2733';
    ctx.fill();
  });
  circle(ctx, 64, 64, 38);
  ctx.strokeStyle = '#395063';
  ctx.lineWidth = 4;
  ctx.stroke();
  circle(ctx, 64, 64, 28);
  const g = ctx.createRadialGradient(54, 52, 4, 64, 64, 28);
  g.addColorStop(0, '#3d6fa8');
  g.addColorStop(0.5, '#12263a');
  g.addColorStop(1, '#050a10');
  ctx.fillStyle = g;
  ctx.fill();
  circle(ctx, 54, 52, 7);
  ctx.fillStyle = 'rgba(200,235,255,0.85)';
  ctx.fill();
}

function drawSpeaker(ctx) {
  withShadow(ctx, 8, 4, () => {
    rr(ctx, 24, 36, 80, 56, 12);
    ctx.fillStyle = '#1c2836';
    ctx.fill();
  });
  ctx.fillStyle = '#40576b';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      circle(ctx, 38 + c * 11, 50 + r * 14, 3);
      ctx.fill();
    }
  }
}

function drawChip(ctx) {
  withShadow(ctx, 8, 4, () => {
    rr(ctx, 30, 30, 68, 68, 8);
    ctx.fillStyle = '#101a24';
    ctx.fill();
  });
  ctx.strokeStyle = '#4a6076';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, 56, 56);
  // выводы
  ctx.fillStyle = '#8ea3b8';
  for (let i = 0; i < 5; i++) {
    rr(ctx, 22, 40 + i * 12, 8, 5, 2);
    ctx.fill();
    rr(ctx, 98, 40 + i * 12, 8, 5, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#dbe8f3';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('IC', 64, 66);
}

function drawFlex(ctx) {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-0.25);
  withShadow(ctx, 8, 3, () => {
    ctx.beginPath();
    ctx.moveTo(-46, -34);
    ctx.lineTo(46, -34);
    ctx.quadraticCurveTo(56, 0, 46, 34);
    ctx.lineTo(-46, 34);
    ctx.quadraticCurveTo(-56, 0, -46, -34);
    ctx.closePath();
    const g = ctx.createLinearGradient(-46, -34, 46, 34);
    g.addColorStop(0, '#e7a24b');
    g.addColorStop(1, '#b96a1d');
    ctx.fillStyle = g;
    ctx.fill();
  });
  ctx.strokeStyle = 'rgba(120,60,10,0.55)';
  ctx.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-40, i * 10);
    ctx.lineTo(40, i * 10);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAntenna(ctx) {
  ctx.strokeStyle = C.blue;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(28, 92);
  ctx.lineTo(44, 60);
  ctx.lineTo(60, 76);
  ctx.lineTo(78, 38);
  ctx.lineTo(96, 54);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(74,168,255,0.35)';
  ctx.lineWidth = 16;
  ctx.stroke();
}

/* --- UI-иконки ------------------------------------------------------ */

function drawCoin(ctx, color, glyph) {
  withShadow(ctx, 10, 4, () => {
    circle(ctx, 64, 64, 42);
    const g = ctx.createLinearGradient(30, 30, 98, 98);
    g.addColorStop(0, '#ffe98a');
    g.addColorStop(0.5, color);
    g.addColorStop(1, '#c98f11');
    ctx.fillStyle = g;
    ctx.fill();
  });
  circle(ctx, 64, 64, 33);
  ctx.strokeStyle = 'rgba(120,80,0,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#5a3c00';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, 64, 68);
}

function drawStar(ctx, color) {
  const cx = 64;
  const cy = 66;
  const outer = 44;
  const inner = 19;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  withShadow(ctx, 10, 4, () => {
    const g = ctx.createLinearGradient(30, 30, 98, 100);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

function drawBolt(ctx, color) {
  ctx.beginPath();
  ctx.moveTo(74, 16);
  ctx.lineTo(38, 70);
  ctx.lineTo(60, 70);
  ctx.lineTo(50, 112);
  ctx.lineTo(90, 54);
  ctx.lineTo(66, 54);
  ctx.closePath();
  withShadow(ctx, 12, 4, () => {
    const g = ctx.createLinearGradient(40, 20, 80, 110);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
  });
}

function drawLock(ctx) {
  withShadow(ctx, 10, 4, () => {
    rr(ctx, 30, 58, 68, 52, 12);
    ctx.fillStyle = metalGrad(ctx, 30, 58, 98, 110);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(64, 56, 22, Math.PI, 0);
  ctx.strokeStyle = '#9fb0c2';
  ctx.lineWidth = 10;
  ctx.stroke();
  circle(ctx, 64, 84, 8);
  ctx.fillStyle = C.dark;
  ctx.fill();
}

function drawCheck(ctx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(30, 66);
  ctx.lineTo(54, 90);
  ctx.lineTo(98, 38);
  ctx.stroke();
}

function drawCross(ctx, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(38, 38);
  ctx.lineTo(90, 90);
  ctx.moveTo(90, 38);
  ctx.lineTo(38, 90);
  ctx.stroke();
}

function drawBack(ctx) {
  ctx.strokeStyle = C.metalA;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(76, 32);
  ctx.lineTo(44, 64);
  ctx.lineTo(76, 96);
  ctx.stroke();
}

function drawGear(ctx) {
  const cx = 64;
  const cy = 64;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = C.metalA;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    rr(ctx, -8, -46, 16, 20, 5);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  circle(ctx, cx, cy, 30);
  ctx.lineWidth = 14;
  ctx.strokeStyle = C.metalA;
  ctx.stroke();
  circle(ctx, cx, cy, 12);
  ctx.fillStyle = C.dark;
  ctx.fill();
}

function drawWrench(ctx) {
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(-Math.PI / 4);
  ctx.strokeStyle = C.metalA;
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, 30);
  ctx.lineTo(34, -34);
  ctx.stroke();
  circle(ctx, 38, -38, 18);
  ctx.lineWidth = 10;
  ctx.stroke();
  circle(ctx, -34, 34, 18);
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.restore();
}

function drawPower(ctx) {
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(64, 64, 34, -Math.PI * 0.35, Math.PI * 1.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(64, 20);
  ctx.lineTo(64, 62);
  ctx.stroke();
}

function drawRefresh(ctx) {
  ctx.strokeStyle = C.metalA;
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(64, 64, 32, -Math.PI * 0.25, Math.PI * 1.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(88, 26);
  ctx.lineTo(92, 55);
  ctx.lineTo(64, 46);
  ctx.closePath();
  ctx.fillStyle = C.metalA;
  ctx.fill();
}

function drawInfo(ctx) {
  circle(ctx, 64, 64, 44);
  ctx.lineWidth = 8;
  ctx.strokeStyle = C.blue;
  ctx.stroke();
  ctx.fillStyle = C.blue;
  circle(ctx, 64, 42, 6);
  ctx.fill();
  rr(ctx, 58, 54, 12, 34, 6);
  ctx.fill();
}