import Phaser from 'phaser';
import { BaseScene } from './base.js';
import { backdrop } from '../core/backdrop.js';
import {
  Btn,
  C,
  Modal,
  divider,
  icon,
  iconBtn,
  money,
  panel,
  pill,
  toast,
  tx,
} from '../core/ui.js';
import { FAULTS, PHONES, PARTS, TOOLS, shopTools, missingTools, rollOrders } from '../data/content.js';
import { makeRng } from '../systems/rng.js';
import { audio } from '../core/audio.js';
import { buyPart, buyTool } from '../systems/economy.js';

/**
 * Доска заказов + магазин (инструменты и запчасти).
 *
 * Заказ нельзя принять, если не хватает инструмента или денег на запчасть —
 * кнопка сразу показывает причину, а не «уводит в отказ» после нажатия.
 */
export class OrdersScene extends BaseScene {
  constructor() {
    super('Orders');
  }

  create(data) {
    this.bootView();
    this.modal = null;
    this.modalKind = data && data.openShop ? 'shop' : null;
    this.shopTab = 'tools';
    this.selected = null;

    if (!Array.isArray(this.orders) || this.orders.length === 0) {
      this.orders = rollOrders(this.state, makeRng(Date.now()));
    }
    // Заказ, от которого отказались в ремонте, возвращается на доску
    if (data && data.returnOrder) {
      const back = data.returnOrder;
      if (!this.orders.some((o) => o.id === back.id)) this.orders.unshift(back);
    }

    this.redraw();
    this.cameras.main.fadeIn(160, 0, 0, 0);
  }

  /* ---------------------------------------------------------------- */
  /*  Основной экран                                                   */
  /* ---------------------------------------------------------------- */

  build(root) {
    const L = this.L;
    const s = L.s;
    const dw = L.dw;
    const cx = L.w / 2;

    backdrop(this, root);

    root.add(iconBtn(this, 30 * s, 42 * s, 'icon_back', () => this.scene.start('Menu'), 44));

    const title = tx(this, 'ЗАКАЗЫ', 20, { bold: true });
    title.setOrigin(0.5, 0.5).setPosition(cx, 42 * s);
    root.add(title);

    const wallet = pill(this, L.w - 62 * s, 42 * s, {
      iconName: 'icon_coin',
      text: money(this.state.money),
      w: 104,
      h: 36,
    });
    wallet.on('pointerup', () => this.openModal('shop'));
    root.add(wallet);

    const sub = tx(this, `Уровень ${this.state.level} · доска обновляется вручную`, 11, {
      color: C.faint,
    });
    sub.setOrigin(0.5, 0.5).setPosition(cx, 76 * s);
    root.add(sub);

    /* ---------------- Карточки заказов ---------------- */
    if (this.orders.length === 0) {
      const empty = tx(this, 'Заказов нет.\nОбновите доску.', 14, {
        color: C.dim,
        align: 'center',
        wrap: dw - 80,
      });
      empty.setOrigin(0.5, 0.5).setPosition(cx, 300 * s);
      root.add(empty);
    }

    const cardW = L.contentW;
    const cardH = 128;
    let y = 104 * s;

    for (const order of this.orders) {
      this.buildCard(root, order, cx, y, cardW, cardH);
      y += (cardH + 14) * s;
    }

    /* ---------------- Низ ---------------- */
    const bottomY = L.h - 62 * s;

    const refresh = new Btn(this, {
      x: cx,
      y: bottomY,
      w: L.contentW - 16,
      h: 56,
      label: 'ОБНОВИТЬ ДОСКУ',
      icon: 'icon_refresh',
      kind: 'secondary',
      fontSize: 14,
      onClick: () => {
        this.orders = rollOrders(this.state, makeRng(Date.now() + 7));
        this.redraw();
        toast(this, 'Новые заказы на доске', 'good');
      },
    });
    root.add(refresh);

    const hint = tx(this, 'Нажмите на карточку, чтобы изучить заказ', 10, { color: C.faint });
    hint.setOrigin(0.5, 1).setPosition(cx, L.h - 16 * s);
    root.add(hint);
  }

  buildCard(root, order, cx, top, cardW, cardH) {
    const s = this.s;
    const phone = PHONES[order.phoneId];
    const fault = FAULTS[order.faultId];
    const cy = top + (cardH / 2) * s;
    const left = cx - (cardW / 2) * s;
    const right = cx + (cardW / 2) * s;

    const bg = panel(this, cardW, cardH, { fill: C.panel, radius: 18, stroke: C.line });
    bg.setPosition(cx, cy);
    root.add(bg);

    // Иконка неисправности
    const circle = this.add.graphics();
    circle.fillStyle(C.panel3, 1);
    circle.fillCircle(left + 40 * s, cy, 26 * s);
    circle.lineStyle(Math.max(1, s), C.line, 1);
    circle.strokeCircle(left + 40 * s, cy, 26 * s);
    root.add(circle);

    const faultIcon = icon(this, left + 40 * s, cy, fault.icon, 30);
    root.add(faultIcon);

    const name = tx(this, phone.name, 16, { bold: true });
    name.setOrigin(0, 0.5).setPosition(left + 76 * s, cy - 24 * s);
    root.add(name);

    const faultText = tx(this, fault.name, 12, { color: C.dim });
    faultText.setOrigin(0, 0.5).setPosition(left + 76 * s, cy - 4 * s);
    root.add(faultText);

    // Инструменты
    const need = missingTools(order, this.state.tools);
    const toolsText = tx(this, need.length ? `нужно: ${need.map((t) => TOOLS[t].name).join(', ')}` : 'инструменты есть', 10, {
      color: need.length ? C.dangerText : C.faint,
    });
    toolsText.setOrigin(0, 0.5).setPosition(left + 76 * s, cy + 20 * s);
    if (toolsText.width > (right - left) * 0.56) toolsText.setVisible(false);
    root.add(toolsText);

    const payout = tx(this, `+${money(order.payout)} ₽`, 18, { bold: true, color: C.accentText });
    payout.setOrigin(1, 0.5).setPosition(right - 16 * s, cy - 22 * s);
    root.add(payout);

    const part = PARTS[fault.part];
    const partText = tx(this, `запчасть ${money(part.price)} ₽`, 10, { color: C.faint });
    partText.setOrigin(1, 0.5).setPosition(right - 16 * s, cy + 2 * s);
    root.add(partText);

    const timeText = tx(this, `${order.targetSeconds} с на бонус`, 9, { color: C.faint });
    timeText.setOrigin(1, 0.5).setPosition(right - 16 * s, cy + 20 * s);
    root.add(timeText);

    // Зона нажатия на всю карточку — палец не должен целиться
    const zone = this.add.zone(cx, cy, cardW * s, cardH * s).setOrigin(0.5);
    zone.setInteractive();
    zone.on('pointerdown', () => {
      bg.clear();
      bg.lineStyle(Math.max(1, 2 * s), C.accent, 1);
      bg.strokeRoundedRect(
        (-cardW / 2) * s,
        (-cardH / 2) * s,
        cardW * s,
        cardH * s,
        18 * s
      );
    });
    zone.on('pointerup', () => {
      bg.clear();
      bg.fillStyle(C.panel, 1);
      bg.fillRoundedRect((-cardW / 2) * s, (-cardH / 2) * s, cardW * s, cardH * s, 18 * s);
      bg.lineStyle(Math.max(1, 1.5 * s), C.line, 1);
      bg.strokeRoundedRect(
        (-cardW / 2) * s,
        (-cardH / 2) * s,
        cardW * s,
        cardH * s,
        18 * s
      );
      this.selected = order;
      this.openModal('order');
    });
    root.add(zone);
  }

  /* ---------------------------------------------------------------- */
  /*  Модалки                                                          */
  /* ---------------------------------------------------------------- */

  openModal(kind) {
    if (this.modal) {
      this.modal.root.destroy(true);
      this.modal = null;
    }
    this.modalKind = kind;

    if (kind === 'order') this.buildOrderModal();
    if (kind === 'shop') this.buildShopModal();
  }

  buildOrderModal() {
    const order = this.selected;
    if (!order) return;

    const s = this.s;
    const phone = PHONES[order.phoneId];
    const fault = FAULTS[order.faultId];
    const part = PARTS[fault.part];
    const need = missingTools(order, this.state.tools);
    const inStock = (this.state.parts[part.id] || 0) > 0;
    const canAffordPart = this.state.money >= part.price;
    const blocked = need.length > 0 || (!inStock && !canAffordPart);

    const m = new Modal(this, {
      title: 'Заказ',
      w: 336,
      h: 540,
      onClose: () => {
        this.modal = null;
        this.modalKind = null;
      },
    });
    this.modal = m;
    const body = m.body;
    const bw = m.bodyWidth;

    const title = tx(this, phone.name, 22, { bold: true });
    title.setOrigin(0, 0).setPosition(0, 0);
    body.add(title);

    const faultLine = tx(this, `${fault.name} · ${phone.tier} класс`, 12, { color: C.dim });
    faultLine.setOrigin(0, 0).setPosition(0, 34 * s);
    body.add(faultLine);

    const symptom = tx(this, order.symptom, 12, { color: C.text, wrap: bw, lineSpacing: 4 });
    symptom.setOrigin(0, 0).setPosition(0, 68 * s);
    body.add(symptom);

    const line1 = divider(this, bw);
    line1.setPosition((bw / 2) * s, 132 * s);
    body.add(line1);

    const rowY = 152;
    const addRow = (i, label, value, color) => {
      const l = tx(this, label, 12, { color: C.dim });
      l.setOrigin(0, 0.5).setPosition(0, (rowY + i * 30) * s);
      body.add(l);
      const v = tx(this, value, 13, { color: color || C.text, bold: true });
      v.setOrigin(1, 0.5).setPosition(bw * s, (rowY + i * 30) * s);
      body.add(v);
    };

    addRow(0, 'Оплата заказа', `+${money(order.payout)} ₽`, C.accentText);
    addRow(1, 'Запчасть', inStock ? 'на складе' : `${money(part.price)} ₽`, inStock ? C.accentText : C.text);
    addRow(2, 'Бонус за скорость', `${order.targetSeconds} с`, C.dim);

    // Инструменты
    const toolsTitle = tx(this, 'НУЖНЫ ИНСТРУМЕНТЫ', 10, { color: C.faint, letterSpacing: 1 });
    toolsTitle.setOrigin(0, 0).setPosition(0, 258 * s);
    body.add(toolsTitle);

    let tx0 = 0;
    order.tools.forEach((id, i) => {
      const owned = this.state.tools.includes(id);
      const box = this.add.graphics();
      box.fillStyle(owned ? C.panel2 : 0x2a1215, 1);
      box.fillRoundedRect(tx0 * s, 278 * s, 48 * s, 48 * s, 12 * s);
      body.add(box);

      const img = icon(this, tx0 * s + 24 * s, 302 * s, TOOLS[id].icon, 26, owned ? 1 : 0.35);
      body.add(img);

      const name = tx(this, TOOLS[id].name.split(' ')[0], 8, {
        color: owned ? C.dim : C.dangerText,
      });
      name.setOrigin(0.5, 0).setPosition(tx0 * s + 24 * s, 330 * s);
      body.add(name);

      tx0 += 56;
    });

    if (blocked) {
      const reason = need.length
        ? `Не хватает: ${need.map((t) => TOOLS[t].name).join(', ')}. Купите в магазине.`
        : `Нужно ${money(part.price)} ₽ на запчасть.`;
      const warn = tx(this, reason, 11, { color: C.warnText, wrap: bw });
      warn.setOrigin(0, 0).setPosition(0, 352 * s);
      body.add(warn);
    }

    const btn = new Btn(this, {
      x: (bw / 2) * s,
      y: (m.modalH - 78) * s,
      w: bw,
      h: 56,
      label: blocked ? 'ЗАКАЗ НЕДОСТУПЕН' : 'ПРИНЯТЬ ЗАКАЗ',
      kind: blocked ? 'ghost' : 'primary',
      fontSize: 15,
      enabled: !blocked,
      onClick: () => this.acceptOrder(order),
    });
    body.add(btn);
  }

  acceptOrder(order) {
    const fault = FAULTS[order.faultId];
    const part = PARTS[fault.part];

    if (!this.state.parts[part.id]) {
      if (this.state.money < part.price) {
        toast(this, 'Не хватает денег на запчасть', 'bad');
        return;
      }
      this.state.money -= part.price;
      this.state.parts[part.id] = 1;
      audio.play('coin');
    }
    this.state.parts[part.id] -= 1;

    this.orders = this.orders.filter((o) => o.id !== order.id);
    this.saveNow();

    this.modal?.close();
    this.scene.start('Repair', { order });
  }

  buildShopModal() {
    const s = this.s;
    const m = new Modal(this, {
      title: 'Магазин',
      w: 340,
      h: 576,
      onClose: () => {
        this.modal = null;
        this.modalKind = null;
      },
    });
    this.modal = m;
    const body = m.body;
    const bw = m.bodyWidth;

    // Табы
    const tabW = (bw - 8) / 2;
    const toolsTab = new Btn(this, {
      x: (tabW / 2) * s,
      y: 22 * s,
      w: tabW,
      h: 42,
      label: 'ИНСТРУМЕНТЫ',
      kind: this.shopTab === 'tools' ? 'primary' : 'ghost',
      fontSize: 12,
      onClick: () => {
        this.shopTab = 'tools';
        this.openModal('shop');
      },
    });
    body.add(toolsTab);

    const partsTab = new Btn(this, {
      x: (tabW + 8 + tabW / 2) * s,
      y: 22 * s,
      w: tabW,
      h: 42,
      label: 'ЗАПЧАСТИ',
      kind: this.shopTab === 'parts' ? 'primary' : 'ghost',
      fontSize: 12,
      onClick: () => {
        this.shopTab = 'parts';
        this.openModal('shop');
      },
    });
    body.add(partsTab);

    if (this.shopTab === 'tools') this.buildToolRows(body, bw);
    else this.buildPartRows(body, bw);
  }

  buildToolRows(body, bw) {
    const s = this.s;
    const items = shopTools();
    let y = 64;

    for (const tool of items) {
      const owned = this.state.tools.includes(tool.id);
      const row = this.add.graphics();
      row.fillStyle(C.panel2, 1);
      row.fillRoundedRect(0, y * s, bw * s, 66 * s, 14 * s);
      body.add(row);

      body.add(icon(this, 30 * s, (y + 33) * s, tool.icon, 30));

      const name = tx(this, tool.name, 13, { bold: true });
      name.setOrigin(0, 0.5).setPosition(54 * s, (y + 22) * s);
      body.add(name);

      const desc = tx(this, tool.desc, 10, { color: C.faint, wrap: bw - 150 });
      desc.setOrigin(0, 0.5).setPosition(54 * s, (y + 44) * s);
      body.add(desc);

      if (owned) {
        const check = icon(this, (bw - 30) * s, (y + 33) * s, 'icon_check', 22);
        body.add(check);
      } else {
        const can = this.state.money >= tool.price;
        const btn = new Btn(this, {
          x: (bw - 40) * s,
          y: (y + 33) * s,
          w: 74,
          h: 40,
          label: money(tool.price),
          icon: 'icon_coin',
          kind: can ? 'primary' : 'ghost',
          fontSize: 11,
          enabled: can,
          onClick: () => {
            if (buyTool(this.state, tool)) {
              audio.play('coin');
              this.saveNow();
              this.openModal('shop');
              toast(this, `${tool.name} куплен`, 'good');
            }
          },
        });
        body.add(btn);
      }

      y += 74;
    }

    const note = tx(this, 'Инструменты покупаются один раз и остаются навсегда.', 10, {
      color: C.faint,
      wrap: bw,
    });
    note.setOrigin(0, 0).setPosition(0, (y + 8) * s);
    body.add(note);
  }

  buildPartRows(body, bw) {
    const s = this.s;
    let y = 64;

    for (const part of Object.values(PARTS)) {
      const stock = this.state.parts[part.id] || 0;
      const row = this.add.graphics();
      row.fillStyle(C.panel2, 1);
      row.fillRoundedRect(0, y * s, bw * s, 66 * s, 14 * s);
      body.add(row);

      body.add(icon(this, 30 * s, (y + 33) * s, part.icon, 30));

      const name = tx(this, part.name, 13, { bold: true });
      name.setOrigin(0, 0.5).setPosition(54 * s, (y + 22) * s);
      body.add(name);

      const stockText = tx(this, `на складе: ${stock}`, 10, {
        color: stock > 0 ? C.accentText : C.faint,
      });
      stockText.setOrigin(0, 0.5).setPosition(54 * s, (y + 44) * s);
      body.add(stockText);

      const can = this.state.money >= part.price;
      const btn = new Btn(this, {
        x: (bw - 40) * s,
        y: (y + 33) * s,
        w: 74,
        h: 40,
        label: money(part.price),
        icon: 'icon_coin',
        kind: can ? 'secondary' : 'ghost',
        fontSize: 11,
        enabled: can,
        onClick: () => {
          if (buyPart(this.state, part, 1)) {
            audio.play('coin');
            this.saveNow();
            this.openModal('shop');
            toast(this, `${part.name}: +1`, 'good');
          }
        },
      });
      body.add(btn);

      y += 74;
    }

    const note = tx(this, 'Запчасть списывается при приёме заказа. Без неё заказ не принять.', 10, {
      color: C.faint,
      wrap: bw,
    });
    note.setOrigin(0, 0).setPosition(0, (y + 8) * s);
    body.add(note);
  }
}