/**
 * UI-кит: палитра, типографика, кнопки, панели, тосты, модалки.
 *
 * Все размеры — в дизайн-единицах (см. layout.js), поэтому один и тот же
 * код даёт корректную вёрстку и на 360×640, и на 768×1024.
 * Минимальная высота интерактивных элементов — 48 дизайн-единиц (≈44 dp),
 * кнопки не прижимаются к краям: отступ 16.
 */

import { audio } from './audio.js';

/** Достаёт layout из сцены: у BaseScene есть геттер `layout`, у остальных — `L`. */
export function layoutOf(scene) {
  return scene.layout || scene.L;
}

export const C = {
  bg: 0x0b0f14,
  panel: 0x151c25,
  panel2: 0x1d2632,
  panel3: 0x243040,
  line: 0x2a3646,
  accent: 0x38e8a0,
  accentDark: 0x1aa677,
  warn: 0xffb020,
  danger: 0xff5a5f,
  blue: 0x4aa8ff,
  gold: 0xffcc33,
  text: '#e8f0f8',
  dim: '#8fa3b8',
  faint: '#5f7488',
  accentText: '#38e8a0',
  dangerText: '#ff8f93',
  warnText: '#ffcf70',
  darkText: '#04140d',
};

export const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** 12 480 → "12 480" */
export function money(n) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Текст с масштабированием под экран. size — в дизайн-единицах. */
export function tx(scene, str, size, opts = {}) {
  const s = layoutOf(scene).s;
  const style = {
    fontFamily: FONT,
    fontSize: `${Math.max(8, Math.round(size * s))}px`,
    color: opts.color || C.text,
    fontStyle: opts.bold ? '700' : '400',
    align: opts.align || 'left',
    lineSpacing: Math.round((opts.lineSpacing ?? 2) * s),
  };
  if (opts.wrap) {
    style.wordWrap = { width: Math.round(opts.wrap * s), useAdvancedWrap: true };
  }
  const t = scene.add.text(0, 0, str, style);
  t.setOrigin(opts.ox ?? 0, opts.oy ?? 0);
  if (opts.alpha !== undefined) t.setAlpha(opts.alpha);
  if (opts.letterSpacing) t.setLetterSpacing(opts.letterSpacing);
  return t;
}

/** Иконка из атласа, размер — дизайн-единицы. */
export function icon(scene, x, y, name, size, alpha = 1) {
  const s = layoutOf(scene).s;
  const img = scene.add.image(x, y, 'atlas', name);
  img.setDisplaySize(Math.round(size * s), Math.round(size * s));
  img.setAlpha(alpha);
  return img;
}

/** Панель с закруглением. Локальные координаты: 0,0 — центр. */
export function panel(scene, w, h, opts = {}) {
  const s = layoutOf(scene).s;
  const g = scene.add.graphics();
  const r = (opts.radius ?? 16) * s;
  g.fillStyle(opts.fill ?? C.panel, opts.alpha ?? 1);
  g.fillRoundedRect((-w / 2) * s, (-h / 2) * s, w * s, h * s, r);
  if (opts.stroke !== null && opts.stroke !== undefined) {
    g.lineStyle(Math.max(1, (opts.strokeWidth ?? 1.5) * s), opts.stroke, 1);
    g.strokeRoundedRect((-w / 2) * s, (-h / 2) * s, w * s, h * s, r);
  }
  return g;
}

/** Горизонтальная линия-разделитель длиной w. */
export function divider(scene, w, color = C.line) {
  const s = layoutOf(scene).s;
  const g = scene.add.graphics();
  g.lineStyle(Math.max(1, s), color, 1);
  g.lineBetween((-w / 2) * s, 0, (w / 2) * s, 0);
  return g;
}

const KIND_STYLE = {
  primary: { fill: C.accent, stroke: null, text: C.darkText, alpha: 1 },
  secondary: { fill: C.panel2, stroke: C.line, text: C.text, alpha: 1 },
  ghost: { fill: 0x000000, stroke: C.line, text: C.dim, alpha: 0 },
  danger: { fill: 0x33141a, stroke: C.danger, text: C.dangerText, alpha: 1 },
  warn: { fill: 0x2e2410, stroke: C.warn, text: C.warnText, alpha: 1 },
  success: { fill: 0x123027, stroke: C.accent, text: '#9ff5d0', alpha: 1 },
};

/**
 * Кнопка. Нажимается пальцем: увеличенная зона, вибрация, звук,
 * явное «нажатое» состояние. Никаких hover-зависимостей.
 */
export class Btn extends Phaser.GameObjects.Container {
  constructor(scene, opts = {}) {
    super(scene, opts.x ?? 0, opts.y ?? 0);
    this.scene = scene;
    this.w = opts.w ?? 200;
    this.h = Math.max(48, opts.h ?? 56);
    this.kind = opts.kind ?? 'primary';
    this.enabled = opts.enabled !== false;
    this.onClick = opts.onClick || (() => {});
    this.fs = opts.fontSize ?? 16;
    this.radius = opts.radius ?? Math.min(16, this.h / 2);
    this.iconName = opts.icon || null;
    this._label = opts.label ?? '';
    this._pressed = false;

    this.bg = scene.add.graphics();
    this.add(this.bg);

    this.labelText = null;
    this.iconImg = null;
    this._drawContent();

    this.setSize(this.w, this.h);
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        (-this.w / 2) * this.s,
        (-this.h / 2) * this.s,
        this.w * this.s,
        this.h * this.s
      ),
      Phaser.Geom.Rectangle.Contains
    );
    this.input.cursor = 'pointer';

    this.on('pointerdown', this._onDown, this);
    this.on('pointerup', this._onUp, this);
    this.on('pointerout', this._onOut, this);

    scene.add.existing(this);
    this._refreshState();
  }

  get s() {
    return layoutOf(this.scene).s;
  }

  _drawContent() {
    const s = this.s;
    const st = KIND_STYLE[this.kind] || KIND_STYLE.primary;
    this.bg.clear();
    this.bg.fillStyle(st.fill, st.alpha);
    this.bg.fillRoundedRect((-this.w / 2) * s, (-this.h / 2) * s, this.w * s, this.h * s, this.radius * s);
    if (st.stroke !== null && st.stroke !== undefined) {
      this.bg.lineStyle(Math.max(1, 1.5 * s), st.stroke, 1);
      this.bg.strokeRoundedRect((-this.w / 2) * s, (-this.h / 2) * s, this.w * s, this.h * s, this.radius * s);
    }

    if (this.labelText) this.labelText.destroy();
    if (this.iconImg) this.iconImg.destroy();

    const gap = 8;
    const hasIcon = !!this.iconName;
    const textW = this._label ? this._label.length * this.fs * 0.56 : 0;
    const iconSize = this.fs * 1.25;
    const totalW = (hasIcon ? iconSize + gap : 0) + textW;
    let cursor = -totalW / 2;

    if (hasIcon) {
      this.iconImg = icon(this.scene, 0, 0, this.iconName, iconSize);
      this.iconImg.setPosition((cursor + iconSize / 2) * s, 0);
      if (this.kind === 'primary') this.iconImg.setTint(0x04140d);
      this.add(this.iconImg);
      cursor += iconSize + gap;
    }
    if (this._label) {
      this.labelText = tx(this.scene, this._label, this.fs, { color: st.text, bold: this.kind === 'primary' });
      this.labelText.setOrigin(0, 0.5);
      this.labelText.setPosition(cursor * s, 0);
      this.add(this.labelText);
    }
  }

  _refreshState() {
    this.setAlpha(this.enabled ? 1 : 0.45);
    this.input.enabled = this.enabled;
  }

  setLabel(str) {
    this._label = str;
    this._drawContent();
    return this;
  }

  setKind(kind) {
    this.kind = kind;
    this._drawContent();
    return this;
  }

  setEnabled(on) {
    this.enabled = !!on;
    this._refreshState();
    return this;
  }

  _onDown() {
    if (!this.enabled) return;
    this._pressed = true;
    this.scene.tweens.add({ targets: this, scale: 0.96, duration: 70, ease: 'Quad.out' });
    audio.play('tap');
    audio.vibrate(6);
  }

  _onUp() {
    if (!this.enabled) return;
    const wasPressed = this._pressed;
    this._pressed = false;
    this.scene.tweens.add({ targets: this, scale: 1, duration: 90, ease: 'Quad.out' });
    if (wasPressed) this.onClick(this);
  }

  _onOut() {
    if (!this._pressed) return;
    this._pressed = false;
    this.scene.tweens.add({ targets: this, scale: 1, duration: 90 });
  }
}

/** Кружок-иконка для хедера (назад, настройки). */
export function iconBtn(scene, x, y, name, onClick, size = 44) {
  const s = layoutOf(scene).s;
  // Визуально кнопка может быть меньше, но палец должен попадать: ≥44 dp
  const hit = Math.max(size, 44);
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(C.panel2, 1);
  bg.fillRoundedRect((-size / 2) * s, (-size / 2) * s, size * s, size * s, 14 * s);
  c.add(bg);
  const img = icon(scene, 0, 0, name, size * 0.5);
  c.add(img);
  c.setSize(hit * s, hit * s);
  c.setInteractive(
    new Phaser.Geom.Rectangle((-hit / 2) * s, (-hit / 2) * s, hit * s, hit * s),
    Phaser.Geom.Rectangle.Contains
  );
  c.on('pointerdown', () => {
    audio.play('tap');
    audio.vibrate(6);
    scene.tweens.add({ targets: c, scale: 0.94, duration: 60, yoyo: true });
  });
  c.on('pointerup', () => onClick());
  return c;
}

/** Плашка со значением: иконка + текст. */
export function pill(scene, x, y, { iconName, text, color = C.text, w = 96, h = 34 }) {
  const s = layoutOf(scene).s;
  const c = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(C.panel, 1);
  bg.lineStyle(Math.max(1, s), C.line, 1);
  bg.fillRoundedRect((-w / 2) * s, (-h / 2) * s, w * s, h * s, (h / 2) * s);
  bg.strokeRoundedRect((-w / 2) * s, (-h / 2) * s, w * s, h * s, (h / 2) * s);
  c.add(bg);
  if (iconName) {
    const img = icon(scene, (-w / 2 + 15) * s, 0, iconName, 18);
    c.add(img);
  }
  const t = tx(scene, text, 14, { color, bold: true });
  t.setOrigin(0, 0.5);
  t.setPosition((-w / 2 + (iconName ? 28 : 10)) * s, 0);
  c.add(t);
  c.valueText = t;
  // Плашка низкая, но зона нажатия — не меньше 44 dp по высоте
  const hitH = Math.max(h, 44);
  c.setSize(w * s, hitH * s);
  c.setInteractive(
    new Phaser.Geom.Rectangle((-w / 2) * s, (-hitH / 2) * s, w * s, hitH * s),
    Phaser.Geom.Rectangle.Contains
  );
  c.on('pointerdown', () => {
    audio.vibrate(6);
  });
  return c;
}

/** Полоса прогресса (натяжение шлейфа, XP, HP). */
export class Meter extends Phaser.GameObjects.Container {
  constructor(scene, opts = {}) {
    super(scene, opts.x ?? 0, opts.y ?? 0);
    this.scene = scene;
    this.w = opts.w ?? 200;
    this.h = opts.h ?? 10;
    this.color = opts.color ?? C.accent;
    this.track = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.add([this.track, this.fill]);
    this.value = 0;
    this._drawTrack();
    this.setValue(opts.value ?? 0);
    scene.add.existing(this);
  }

  get s() {
    return layoutOf(this.scene).s;
  }

  _drawTrack() {
    const s = this.s;
    this.track.clear();
    this.track.fillStyle(0x000000, 0.35);
    this.track.fillRoundedRect((-this.w / 2) * s, (-this.h / 2) * s, this.w * s, this.h * s, (this.h / 2) * s);
  }

  setValue(v, color) {
    this.value = Math.max(0, Math.min(1, v));
    if (color) this.color = color;
    const s = this.s;
    const w = this.w * this.value;
    this.fill.clear();
    if (w > 0.5) {
      this.fill.fillStyle(this.color, 1);
      this.fill.fillRoundedRect((-this.w / 2) * s, (-this.h / 2) * s, Math.max(w, this.h) * s, this.h * s, (this.h / 2) * s);
    }
    return this;
  }
}

/** Всплывающее сообщение внизу экрана. */
export function toast(scene, message, kind = 'info') {
  const s = scene.layout.s;
  const color = kind === 'bad' ? C.dangerText : kind === 'good' ? C.accentText : kind === 'warn' ? C.warnText : C.text;
  const c = scene.add.container(scene.layout.w / 2, scene.layout.h - 150 * s);
  c.setDepth(900);
  const t = tx(scene, message, 14, { color, align: 'center', wrap: 300 });
  t.setOrigin(0.5, 0.5);
  const bw = Math.min(340, Math.max(160, message.length * 8 + 28));
  const bg = panel(scene, bw, 48, { fill: C.panel3, radius: 14, stroke: C.line });
  c.add([bg, t]);
  c.setAlpha(0);
  c.y += 10 * s;
  scene.tweens.add({ targets: c, alpha: 1, y: c.y - 10 * s, duration: 150, ease: 'Quad.out' });
  scene.time.delayedCall(1900, () => {
    scene.tweens.add({
      targets: c,
      alpha: 0,
      y: c.y - 8 * s,
      duration: 200,
      onComplete: () => c.destroy(),
    });
  });
  return c;
}

/**
 * Модальное окно: затемнение + панель + заголовок + кнопка «закрыть».
 * Контент добавляется в `modal.body` (локальные координаты 0..bodyW).
 */
export class Modal {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.onClose = opts.onClose || (() => {});
    this.closed = false;

    this.L = layoutOf(scene);
    this.s = this.L.s;
    this.root = scene.add.container(0, 0);
    this.root.setDepth(800);

    const s = this.s;
    const W = this.L.w;
    const H = this.L.h;

    // Блокировщик: клики не проходят в игру под модалкой
    this.blocker = scene.add.rectangle(0, 0, W, H, 0x05080c, 0.72).setOrigin(0, 0);
    this.blocker.setInteractive();
    this.blocker.on('pointerdown', () => {});
    this.root.add(this.blocker);

    const w = opts.w ?? Math.min(360, this.L.dw - 32);
    const h = opts.h ?? 520;
    this.modalW = w;
    this.modalH = h;

    this.panel = panel(scene, w, h, { fill: C.panel, radius: 22, stroke: C.line });
    this.panel.setPosition(W / 2, H / 2);
    this.root.add(this.panel);

    this.body = scene.add.container(W / 2 - (w / 2) * s + 18 * s, H / 2 - (h / 2) * s + 64 * s);
    this.bodyWidth = w - 36;
    this.root.add(this.body);

    this.titleText = tx(scene, opts.title || '', 20, { bold: true });
    this.titleText.setOrigin(0, 0.5);
    this.titleText.setPosition(W / 2 - (w / 2) * s + 20 * s, H / 2 - (h / 2) * s + 32 * s);
    this.root.add(this.titleText);

    this.closeBtn = iconBtn(scene, W / 2 + (w / 2) * s - 34 * s, H / 2 - (h / 2) * s + 32 * s, 'icon_close', () => this.close(), 36);
    this.root.add(this.closeBtn);

    this.root.setAlpha(0);
    scene.tweens.add({ targets: this.root, alpha: 1, duration: 140 });
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.root.destroy();
    this.onClose();
  }
}

/** Затемнение фона под модалкой — без блокировки, для оверлеев. */
export function scrim(scene, alpha = 0.75) {
  const L = layoutOf(scene);
  const r = scene.add.rectangle(0, 0, L.w, L.h, 0x05080c, alpha).setOrigin(0, 0);
  return r;
}