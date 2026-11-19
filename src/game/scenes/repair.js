import Phaser from 'phaser';
import { BaseScene } from './base.js';
import { backdrop } from '../core/backdrop.js';
import { Btn, C, Meter, Modal, icon, iconBtn, money, panel, toast, tx } from '../core/ui.js';
import { audio } from '../core/audio.js';
import { RepairRun, STAGE } from '../systems/run.js';
import { applyReport } from '../systems/economy.js';
import { PHONES, PARTS, TOOLS } from '../data/content.js';
import { TeardownView } from '../views/teardown.js';
import { DiagnoseView } from '../views/diagnose.js';
import { ReplaceView } from '../views/replace.js';

const STEP_TITLES = {
  teardown: 'ШАГ 1 ИЗ 3 · РАЗБОРКА',
  diagnose: 'ШАГ 2 ИЗ 3 · ДИАГНОСТИКА',
  replace: 'ШАГ 3 ИЗ 3 · ЗАМЕНА',
  done: 'ГОТОВО',
};

const STEP_INDEX = { teardown: 1, diagnose: 2, replace: 3, done: 3 };

/**
 * Сцена ремонта: хедер с уроном, подсказка, панель инструментов и текущий
 * этап. Этапы живут в отдельных view и полностью перерисовываются из
 * состояния RepairRun — поэтому resize/поворот не ломают прогресс.
 */
export class RepairScene extends BaseScene {
  constructor() {
    super('Repair');
  }

  create(data) {
    this.bootView();

    this.order = data && data.order;
    if (!this.order) {
      this.scene.start('Orders');
      return;
    }

    this.run = new RepairRun(this.order, {
      hasTool: (id) => this.state.tools.includes(id),
    });
    this.selectedTool = this.order.tools[0];
    this.stageView = null;
    this.stageRoot = null;
    this.actionBtn = null;
    this.modal = null;
    this.modalKind = null;
    this.finished = false;
    this.lastTension = null;
    this.tensionVisible = false;

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);

    this.redraw();
    this.cameras.main.fadeIn(160, 0, 0, 0);
  }

  /* ---------------------------------------------------------------- */
  /*  Вёрстка                                                          */
  /* ---------------------------------------------------------------- */

  build(root) {
    this.root = root;
    const L = this.L;
    const s = L.s;

    backdrop(this, root);

    this.actionBtn = null;
    this.stageRoot = this.add.container(0, 0);
    root.add(this.stageRoot);

    this.area = {
      x: 0,
      y: 118 * s,
      w: L.w,
      h: L.h - 118 * s - 262 * s,
    };

    this.buildHeader(root);
    this.buildBottom(root);
    this.mountStage();
  }

  buildHeader(root) {
    const s = this.s;
    const L = this.L;
    const cx = L.w / 2;

    root.add(iconBtn(this, 30 * s, 40 * s, 'icon_back', () => this.confirmExit(), 44));

    const title = tx(this, this.run.phone.name, 18, { bold: true });
    title.setOrigin(0.5, 0.5).setPosition(cx, 31 * s);
    root.add(title);

    const fault = tx(this, this.run.fault.name, 11, { color: C.dim });
    fault.setOrigin(0.5, 0.5).setPosition(cx, 53 * s);
    root.add(fault);

    this.dmgLabel = tx(this, 'ПОВРЕЖДЕНИЯ 0%', 9, { color: C.faint, letterSpacing: 1 });
    this.dmgLabel.setOrigin(1, 0.5).setPosition(L.w - 16 * s, 31 * s);
    root.add(this.dmgLabel);

    this.dmgMeter = new Meter(this, {
      x: cx,
      y: 78 * s,
      w: L.dw - 32,
      h: 6,
      color: C.accent,
    });
    root.add(this.dmgMeter);
  }

  buildBottom(root) {
    const s = this.s;
    const L = this.L;
    const cx = L.w / 2;

    const hintY = L.h - 170 * s;

    this.stepLabel = tx(this, '', 9, { color: C.faint, letterSpacing: 2 });
    this.stepLabel.setOrigin(0.5, 0).setPosition(cx, hintY - 15 * s);
    root.add(this.stepLabel);

    this.hintText = tx(this, '', 12, {
      color: C.text,
      align: 'center',
      wrap: L.dw - 36,
      lineSpacing: 3,
    });
    this.hintText.setOrigin(0.5, 0).setPosition(cx, hintY);
    root.add(this.hintText);

    /* Натяжение шлейфа — только на этапе подъёма крышки */
    const ty = L.h - 246 * s;
    this.tensionWrap = this.add.container(0, 0);
    const tl = tx(this, 'НАТЯЖЕНИЕ ШЛЕЙФА', 8, { color: C.faint, letterSpacing: 1 });
    tl.setOrigin(0.5, 0).setPosition(cx, ty - 14 * s);
    this.tensionWrap.add(tl);
    this.tensionMeter = new Meter(this, {
      x: cx,
      y: ty,
      w: L.dw - 96,
      h: 8,
      color: C.accent,
    });
    this.tensionWrap.add(this.tensionMeter);
    this.tensionWrap.setVisible(false);
    root.add(this.tensionWrap);

    this.buildDock(root);
    this.actionY = L.h - 202 * s;
  }

  buildDock(root) {
    const s = this.s;
    const L = this.L;
    const cx = L.w / 2;

    // В доке только то, что нужно для заказа + фен (если куплен)
    const ids = Array.from(new Set(this.order.tools.slice()));
    if (this.state.tools.includes('heatgun')) ids.push('heatgun');

    const n = ids.length;
    const avail = L.dw - 24;
    const bw = Math.min(64, (avail - (n - 1) * 6) / n);
    const totalW = n * bw + (n - 1) * 6;
    const y = L.h - 92 * s;
    const startX = cx - (totalW / 2) * s + (bw / 2) * s;

    this.dockItems = new Map();
    this.dockW = bw;

    ids.forEach((id, i) => {
      const tool = TOOLS[id];
      const c = this.add.container(startX + i * (bw + 6) * s, y);
      const g = this.add.graphics();
      c.add(g);

      const img = icon(this, 0, -9 * s, tool.icon, 28);
      c.add(img);

      const label = tx(this, tool.name.split(' ')[0], 8, { color: C.dim });
      label.setOrigin(0.5, 0.5).setPosition(0, 22 * s);
      c.add(label);

      c._bg = g;
      c._id = id;
      c._w = bw * s;
      c.setSize(bw * s, 84 * s);
      c.setInteractive(
        new Phaser.Geom.Rectangle((-bw / 2) * s, -42 * s, bw * s, 84 * s),
        Phaser.Geom.Rectangle.Contains
      );
      c.on('pointerdown', (p) => this.startToolDrag(id, p));

      root.add(c);
      this.dockItems.set(id, c);
    });

    this.refreshDock();
  }

  refreshDock() {
    if (!this.dockItems) return;
    const s = this.s;
    for (const [id, c] of this.dockItems) {
      const selected = id === this.selectedTool;
      const halfW = c._w / 2;
      const g = c._bg;
      g.clear();
      g.fillStyle(selected ? 0x123027 : C.panel, 1);
      g.fillRoundedRect(-halfW, -42 * s, c._w, 84 * s, 14 * s);
      g.lineStyle(Math.max(1, (selected ? 2 : 1) * s), selected ? C.accent : C.line, 1);
      g.strokeRoundedRect(-halfW, -42 * s, c._w, 84 * s, 14 * s);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Этапы                                                           */
  /* ---------------------------------------------------------------- */

  mountStage() {
    if (this.stageView) {
      this.stageView.destroy();
      this.stageView = null;
    }
    if (this.stageRoot) this.stageRoot.removeAll(true);

    this.setAction(null);
    this.shownStage = this.run.stage;

    if (this.run.stage === STAGE.TEARDOWN) this.stageView = new TeardownView(this, this.run);
    else if (this.run.stage === STAGE.DIAGNOSE) this.stageView = new DiagnoseView(this, this.run);
    else if (this.run.stage === STAGE.REPLACE) this.stageView = new ReplaceView(this, this.run);

    if (this.stageView) this.stageView.build(this.stageRoot);
    this.updateHUD();
  }

  afterAction() {
    this.updateHUD();
    if (this.run.stage !== this.shownStage) {
      this.mountStage();
      return;
    }
    if (this.stageView && this.stageView.render) this.stageView.render();
  }

  updateHUD() {
    if (!this.dmgMeter) return;
    const run = this.run;
    const dmg = Math.round(run.damage);

    this.dmgMeter.setValue(dmg / 100, dmg >= 60 ? 0xff5a5f : dmg >= 25 ? 0xffb020 : C.accent);
    this.dmgLabel.setText(`ПОВРЕЖДЕНИЯ ${dmg}%`);
    this.dmgLabel.setColor(dmg >= 60 ? C.dangerText : dmg >= 25 ? C.warnText : C.faint);

    this.stepLabel.setText(STEP_TITLES[run.stage] || '');
    this.hintText.setText(run.currentHint());

    const liftPhase =
      run.stage === STAGE.TEARDOWN && run.teardown.phase === 'lift';
    this.tensionWrap.setVisible(liftPhase);
    if (liftPhase) {
      const v = (this.lastTension || 0) / 100;
      this.tensionMeter.setValue(v, v > 0.75 ? 0xff5a5f : v > 0.45 ? 0xffb020 : C.accent);
    }

    this.refreshDock();
  }

  /* ---------------------------------------------------------------- */
  /*  Панель действий                                                  */
  /* ---------------------------------------------------------------- */

  setAction(cfg) {
    if (this.actionBtn) {
      this.actionBtn.destroy();
      this.actionBtn = null;
    }
    if (!cfg || !this.root) return;

    const L = this.L;
    const btn = new Btn(this, {
      x: L.w / 2,
      y: this.actionY,
      w: L.dw - 72,
      h: 50,
      label: cfg.label,
      icon: cfg.icon || null,
      kind: cfg.kind || 'primary',
      enabled: cfg.enabled !== false,
      fontSize: 13,
      onClick: () => cfg.onClick && cfg.onClick(),
    });
    this.root.add(btn);
    this.actionBtn = btn;
  }

  /* ---------------------------------------------------------------- */
  /*  Инструменты                                                      */
  /* ---------------------------------------------------------------- */

  selectTool(id) {
    this.selectedTool = id;
    this.refreshDock();
  }

  startToolDrag(id, p) {
    this.selectTool(id);
    this.dragTool = id;
    this.dragStart = { x: p.x, y: p.y };

    if (this.ghost) this.ghost.destroy();
    this.ghost = icon(this, p.x, p.y, TOOLS[id].icon, 46, 0.9);
    this.ghost.setDepth(700);

    audio.play('tap');
    audio.vibrate(6);
  }

  onPointerMove(p) {
    if (this.ghost) this.ghost.setPosition(p.x, p.y);
  }

  onPointerUp(p) {
    if (!this.dragTool) return;

    const moved = Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > 10;
    const tool = this.dragTool;
    this.dragTool = null;

    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
    }

    if (moved && this.stageView && this.stageView.handleDrop) {
      this.stageView.handleDrop(tool, p.x, p.y);
    }
  }

  tapStage(px, py) {
    if (this.stageView && this.stageView.tapAt) this.stageView.tapAt(px, py);
  }

  /* ---------------------------------------------------------------- */
  /*  Обратная связь                                                   */
  /* ---------------------------------------------------------------- */

  setTension(value, torn) {
    this.lastTension = value;
    this.tensionVisible = true;
    if (this.tensionWrap) this.tensionWrap.setVisible(true);
    if (this.tensionMeter) {
      const v = value / 100;
      this.tensionMeter.setValue(v, v > 0.75 ? 0xff5a5f : v > 0.45 ? 0xffb020 : C.accent);
    }
  }

  shakeStage() {
    if (!this.stageRoot) return;
    const L = this.L;
    this.tweens.add({
      targets: this.stageRoot,
      x: { from: -6 * L.s, to: 0 },
      duration: 180,
      ease: 'Quad.out',
    });
    this.cameras.main.shake(120, 0.006);
  }

  toast(msg, kind) {
    toast(this, msg, kind);
  }

  /* ---------------------------------------------------------------- */
  /*  Итог                                                             */
  /* ---------------------------------------------------------------- */

  finish() {
    if (this.finished) return;
    this.finished = true;

    const summary = this.run.summary();
    const result = applyReport(this.state, summary);
    this.saveNow();
    this.store.flush();

    audio.play(result.success ? 'win' : 'fail');
    audio.vibrate(result.success ? [20, 40, 20] : [60, 60, 60]);
    this.showSummary(result, summary);
  }

  showSummary(result, summary) {
    const s = this.s;
    const L = this.L;
    const cx = L.w / 2;
    const cy = L.h / 2;

    const layer = this.add.container(0, 0).setDepth(950);
    const scrim = this.add.rectangle(0, 0, L.w, L.h, 0x05080c, 0.84).setOrigin(0, 0);
    scrim.setInteractive();
    layer.add(scrim);

    const w = Math.min(360, L.dw - 24);
    const h = 580;
    const bg = panel(this, w, h, { fill: C.panel, radius: 24, stroke: C.line });
    bg.setPosition(cx, cy);
    layer.add(bg);

    const top = cy - (h / 2) * s;
    const left = cx - (w / 2 - 20) * s;
    const right = cx + (w / 2 - 20) * s;

    const title = tx(this, result.success ? 'ЗАКАЗ ВЫПОЛНЕН' : 'ЗАКАЗ ПРОВАЛЕН', 20, {
      bold: true,
      color: result.success ? C.accentText : C.dangerText,
    });
    title.setOrigin(0.5, 0.5).setPosition(cx, top + 42 * s);
    layer.add(title);

    const subtitle = tx(
      this,
      `${this.run.phone.name} · ${this.run.fault.name}`,
      11,
      { color: C.dim }
    );
    subtitle.setOrigin(0.5, 0.5).setPosition(cx, top + 68 * s);
    layer.add(subtitle);

    let y = top + 106 * s;
    for (const line of result.lines) {
      const label = tx(this, line.label, 12, { color: C.dim });
      label.setOrigin(0, 0.5).setPosition(left, y);
      layer.add(label);

      const positive = line.amount >= 0;
      const amount = tx(this, `${positive ? '+' : '−'}${money(Math.abs(line.amount))} ₽`, 13, {
        bold: true,
        color: positive ? C.text : C.dangerText,
      });
      amount.setOrigin(1, 0.5).setPosition(right, y);
      layer.add(amount);

      y += 26 * s;
    }

    const line = this.add.graphics();
    line.lineStyle(Math.max(1, s), C.line, 1);
    line.lineBetween(left, y + 6 * s, right, y + 6 * s);
    layer.add(line);
    y += 28 * s;

    const totalLabel = tx(this, 'ИТОГО', 13, { bold: true });
    totalLabel.setOrigin(0, 0.5).setPosition(left, y);
    layer.add(totalLabel);

    const total = tx(this, `${result.money >= 0 ? '+' : '−'}${money(Math.abs(result.money))} ₽`, 24, {
      bold: true,
      color: result.money >= 0 ? C.accentText : C.dangerText,
    });
    total.setOrigin(1, 0.5).setPosition(right, y);
    layer.add(total);

    y += 42 * s;

    const rep = tx(
      this,
      `Репутация ${result.repDelta >= 0 ? '+' : '−'}${Math.abs(result.repDelta)}   ·   Опыт +${result.xpGain}`,
      12,
      { color: C.dim }
    );
    rep.setOrigin(0.5, 0.5).setPosition(cx, y);
    layer.add(rep);

    y += 26 * s;

    if (summary.tear) {
      const tear = tx(this, 'Порван шлейф — репутация пострадала', 10, { color: C.warnText });
      tear.setOrigin(0.5, 0.5).setPosition(cx, y);
      layer.add(tear);
      y += 22 * s;
    }

    if (result.levelUp) {
      const lvl = tx(this, `НОВЫЙ УРОВЕНЬ ${result.level} — открылись новые заказы`, 11, {
        color: C.accentText,
        bold: true,
      });
      lvl.setOrigin(0.5, 0.5).setPosition(cx, y);
      layer.add(lvl);
    }

    const btn = new Btn(this, {
      x: cx,
      y: cy + (h / 2 - 54) * s,
      w: w - 32,
      h: 56,
      label: 'ПРОДОЛЖИТЬ',
      kind: 'primary',
      fontSize: 15,
      onClick: () => {
        this.store.flush();
        this.scene.start('Orders');
      },
    });
    layer.add(btn);

    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 200 });
  }

  /* ---------------------------------------------------------------- */
  /*  Выход                                                            */
  /* ---------------------------------------------------------------- */

  confirmExit() {
    if (this.finished) return;

    const s = this.s;
    const m = new Modal(this, {
      title: 'Прервать заказ?',
      w: 320,
      h: 330,
      onClose: () => {
        this.modal = null;
      },
    });
    this.modal = m;

    const body = m.body;
    const bw = m.bodyWidth;

    const text = tx(
      this,
      'Заказ вернётся на доску, запчасть — на склад. Прогресс ремонта будет потерян.',
      12,
      { color: C.dim, wrap: bw, lineSpacing: 4 }
    );
    text.setOrigin(0, 0).setPosition(0, 4 * s);
    body.add(text);

    const keep = new Btn(this, {
      x: (bw / 2) * s,
      y: 128 * s,
      w: bw,
      h: 52,
      label: 'ПРОДОЛЖИТЬ РЕМОНТ',
      kind: 'primary',
      fontSize: 14,
      onClick: () => m.close(),
    });
    body.add(keep);

    const quit = new Btn(this, {
      x: (bw / 2) * s,
      y: 192 * s,
      w: bw,
      h: 52,
      label: 'ВЫЙТИ БЕЗ ОПЛАТЫ',
      kind: 'danger',
      fontSize: 14,
      onClick: () => this.abortOrder(),
    });
    body.add(quit);
  }

  abortOrder() {
    // Запчасть не использована — возвращаем на склад, заказ не оплачиваем
    const partId = this.run.fault.part;
    this.state.parts[partId] = (this.state.parts[partId] || 0) + 1;
    this.saveNow();
    this.store.flush();

    if (this.modal) this.modal.close();
    this.scene.start('Orders', { returnOrder: this.order });
  }
}