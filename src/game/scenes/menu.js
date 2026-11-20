import Phaser from 'phaser';
import { BaseScene } from './base.js';
import { backdrop } from '../core/backdrop.js';
import { Btn, C, Modal, divider, icon, money, panel, toast, tx } from '../core/ui.js';
import { audio } from '../core/audio.js';
import { levelInfo } from '../systems/economy.js';
import { defaultSave } from '../systems/save.js';

/**
 * Главное меню: витрина прогресса + вход в заказы/магазин/настройки.
 * Минимум текста, крупные кнопки, всё в зоне большого пальца.
 */
export class MenuScene extends BaseScene {
  constructor() {
    super('Menu');
  }

  create() {
    this.bootView();
    this.modal = null;
    this.modalKind = null;
    this.resetArmed = false;
    this.redraw();
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  build(root) {
    const L = this.L;
    const s = L.s;
    const dw = L.dw;
    const cx = L.w / 2;
    const top = 28 * s;

    backdrop(this, root);

    /* ---------------- Логотип ---------------- */
    const t1 = tx(this, 'REPAIR', 38, { bold: true, color: '#e8f0f8' });
    t1.setOrigin(0, 0.5);
    const t2 = tx(this, 'LAB', 38, { bold: true, color: C.accentText });
    t2.setOrigin(0, 0.5);

    const totalW = t1.width + t2.width + 8 * s;
    t1.setPosition(cx - totalW / 2, top + 34 * s);
    t2.setPosition(t1.x + t1.width + 8 * s, top + 34 * s);
    root.add([t1, t2]);

    const sub = tx(this, 'МАСТЕРСКАЯ РЕМОНТА', 10, { color: C.faint, letterSpacing: 3 });
    sub.setOrigin(0.5, 0.5).setPosition(cx, top + 66 * s);
    root.add(sub);

    /* ---------------- Карточка игрока ---------------- */
    const cardW = L.contentW;
    const cardH = 186;
    const cardY = top + 34 * s + 62 * s + cardH * 0.5 * s + 10 * s;
    const card = panel(this, cardW, cardH, { fill: C.panel, radius: 20, stroke: C.line });
    card.setPosition(cx, cardY);
    root.add(card);

    const left = cx - (cardW / 2) * s + 18 * s;
    const right = cx + (cardW / 2) * s - 18 * s;
    const info = levelInfo(this.state.xp);

    // Кружок уровня
    const lvl = this.add.graphics();
    lvl.fillStyle(C.accent, 0.14);
    lvl.fillCircle(left + 24 * s, cardY - 62 * s, 24 * s);
    lvl.lineStyle(Math.max(1, 1.5 * s), C.accent, 0.7);
    lvl.strokeCircle(left + 24 * s, cardY - 62 * s, 24 * s);
    root.add(lvl);

    const lvlText = tx(this, String(info.level), 20, { bold: true, color: C.accentText });
    lvlText.setOrigin(0.5, 0.5).setPosition(left + 24 * s, cardY - 62 * s);
    root.add(lvlText);

    const lvlLabel = tx(this, 'УРОВЕНЬ', 10, { color: C.faint, letterSpacing: 2 });
    lvlLabel.setOrigin(0, 0.5).setPosition(left + 58 * s, cardY - 74 * s);
    root.add(lvlLabel);

    const lvlName = tx(this, info.maxed ? 'МАСТЕР' : 'ТЕХНИК', 15, { bold: true });
    lvlName.setOrigin(0, 0.5).setPosition(left + 58 * s, cardY - 56 * s);
    root.add(lvlName);

    // Репутация
    const starIcon = icon(this, right - 58 * s, cardY - 64 * s, 'icon_rep', 18);
    root.add(starIcon);
    const repText = tx(this, String(Math.round(this.state.rep)), 16, { bold: true, color: '#ffd97a' });
    repText.setOrigin(0, 0.5).setPosition(right - 44 * s, cardY - 64 * s);
    root.add(repText);
    const repCap = tx(this, 'репутация', 9, { color: C.faint });
    repCap.setOrigin(0, 0.5).setPosition(right - 58 * s, cardY - 44 * s);
    root.add(repCap);

    // XP
    const xpLabel = tx(this, 'ОПЫТ', 9, { color: C.faint, letterSpacing: 2 });
    xpLabel.setOrigin(0, 0.5).setPosition(left, cardY - 22 * s);
    root.add(xpLabel);

    const xpValue = tx(this, `${info.into} / ${info.need}`, 10, { color: C.dim });
    xpValue.setOrigin(1, 0.5).setPosition(right, cardY - 22 * s);
    root.add(xpValue);

    const track = this.add.graphics();
    track.fillStyle(0x000000, 0.35);
    track.fillRoundedRect(left, cardY - 12 * s, right - left, 8 * s, 4 * s);
    track.fillStyle(C.accent, 1);
    const fillW = Math.max(8 * s, (right - left) * info.progress);
    track.fillRoundedRect(left, cardY - 12 * s, fillW, 8 * s, 4 * s);
    root.add(track);

    // Баланс
    const coin = icon(this, left + 9 * s, cardY + 26 * s, 'icon_coin', 20);
    root.add(coin);
    const moneyText = tx(this, money(this.state.money), 26, { bold: true });
    moneyText.setOrigin(0, 0.5).setPosition(left + 24 * s, cardY + 26 * s);
    root.add(moneyText);
    const moneyCap = tx(this, '₽ на счету', 10, { color: C.faint });
    moneyCap.setOrigin(0, 0.5).setPosition(left + 24 * s, cardY + 45 * s);
    root.add(moneyCap);

    // Статистика
    const stats = tx(
      this,
      `Заказов: ${this.state.stats.orders}   ·   Провалов: ${this.state.stats.failed}`,
      11,
      { color: C.dim }
    );
    stats.setOrigin(1, 0.5).setPosition(right, cardY + 44 * s);
    root.add(stats);

    /* ---------------- Кнопки ---------------- */
    const btnY = cardY + (cardH / 2) * s + 74 * s;

    const ordersBtn = new Btn(this, {
      x: cx,
      y: btnY,
      w: L.contentW - 16,
      h: 68,
      label: 'ЗАКАЗЫ',
      icon: 'icon_wrench',
      kind: 'primary',
      fontSize: 18,
      onClick: () => {
        this.store.flush();
        this.scene.start('Orders');
      },
    });
    root.add(ordersBtn);

    const halfW = (L.contentW - 28) / 2;
    const rowY = btnY + 86 * s;

    const shopBtn = new Btn(this, {
      x: cx - halfW / 2 * s - 6 * s,
      y: rowY,
      w: halfW,
      h: 56,
      label: 'МАГАЗИН',
      icon: 'icon_coin',
      kind: 'secondary',
      fontSize: 14,
      onClick: () => this.scene.start('Orders', { openShop: true }),
    });
    root.add(shopBtn);

    const settingsBtn = new Btn(this, {
      x: cx + halfW / 2 * s + 6 * s,
      y: rowY,
      w: halfW,
      h: 56,
      label: 'НАСТРОЙКИ',
      icon: 'icon_settings',
      kind: 'ghost',
      fontSize: 14,
      onClick: () => this.openModal('settings'),
    });
    root.add(settingsBtn);

    /* ---------------- Футер ---------------- */
    const footer = tx(this, 'прогресс сохраняется автоматически · офлайн', 10, { color: C.faint });
    footer.setOrigin(0.5, 1).setPosition(cx, L.h - 22 * s);
    root.add(footer);
  }

  /* ---------------------------------------------------------------- */
  /*  Модалки                                                          */
  /* ---------------------------------------------------------------- */

  openModal(kind) {
    if (kind === 'shop') {
      this.scene.start('Orders', { openShop: true });
      return;
    }
    this.modalKind = kind;
    if (kind !== 'settings') return;

    const m = new Modal(this, {
      title: 'Настройки',
      w: 330,
      h: 452,
      onClose: () => {
        this.modal = null;
        this.modalKind = null;
      },
    });
    this.modal = m;

    const s = this.s;
    const bw = m.bodyWidth;
    const body = m.body;

    let y = 4 * s;

    const row = (labelText, hintText, valueText, onToggle, kind) => {
      const l = tx(this, labelText, 15, { bold: true });
      l.setOrigin(0, 0.5).setPosition(0, y + 14 * s);
      body.add(l);

      const h = tx(this, hintText, 11, { color: C.faint, wrap: bw - 106 });
      h.setOrigin(0, 0.5).setPosition(0, y + 34 * s);
      body.add(h);

      const btn = new Btn(this, {
        x: bw * s - 40 * s,
        y: y + 22 * s,
        w: 86,
        h: 44,
        label: valueText,
        kind,
        fontSize: 13,
        onClick: (b) => {
          const next = !(b._on === true);
          b._on = next;
          b.setLabel(next ? 'ВКЛ' : 'ВЫКЛ');
          b.setKind(next ? 'success' : 'ghost');
          onToggle(next);
        },
      });
      btn._on = valueText === 'ВКЛ';
      body.add(btn);

      y += 66 * s;
      const line = divider(this, bw);
      line.setPosition(bw * 0.5 * s, y);
      body.add(line);
      y += 16 * s;
      return btn;
    };

    row('Звук', 'Короткие сигналы инструментов', this.state.settings.sound ? 'ВКЛ' : 'ВЫКЛ', (v) => {
      this.state.settings.sound = v;
      audio.setEnabled(v);
      this.saveNow();
    }, this.state.settings.sound ? 'success' : 'ghost');

    row('Вибрация', 'Отклик на кнопки и ошибки', this.state.settings.haptics ? 'ВКЛ' : 'ВЫКЛ', (v) => {
      this.state.settings.haptics = v;
      audio.setHaptics(v);
      this.saveNow();
    }, this.state.settings.haptics ? 'success' : 'ghost');

    const note = tx(
      this,
      'Прогресс пишется в локальное хранилище автоматически. Интернет не нужен.',
      11,
      { color: C.dim, wrap: bw }
    );
    note.setOrigin(0, 0).setPosition(0, y + 6 * s);
    body.add(note);

    const reset = new Btn(this, {
      x: bw * 0.5 * s,
      y: (m.modalH - 92) * s,
      w: bw - 8,
      h: 48,
      label: this.resetArmed ? 'ТОЧНО СБРОСИТЬ?' : 'СБРОСИТЬ ПРОГРЕСС',
      kind: 'danger',
      fontSize: 13,
      onClick: (b) => {
        if (!this.resetArmed) {
          this.resetArmed = true;
          b.setLabel('ТОЧНО СБРОСИТЬ?');
          return;
        }
        const fresh = defaultSave();
        Object.assign(this.state, fresh);
        this.store.save(this.state);
        this.store.flush();
        audio.setEnabled(true);
        audio.setHaptics(true);
        this.resetArmed = false;
        this.modal?.close();
        this.redraw();
        toast(this, 'Прогресс сброшен', 'warn');
      },
    });
    body.add(reset);
  }
}