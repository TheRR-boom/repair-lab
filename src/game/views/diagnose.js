import { BOARD_SLOTS, COMPONENTS } from '../data/content.js';
import { audio } from '../core/audio.js';
import { C, Btn, icon, panel, tx } from '../core/ui.js';

/**
 * Диагностика: плата, мультиметр и пинч-зум.
 *
 * Тап по компоненту = замер. Замеров бесплатно 2, дальше — штраф к оплате,
 * поэтому выгодно думать, а не «прозванивать всё подряд».
 * Пинч-зум двумя пальцами увелиивает плату (два указателя уже включены
 * в конфиге Phaser), двойной тап — сброс.
 */

export class DiagnoseView {
  constructor(scene, run) {
    this.scene = scene;
    this.run = run;
    this.L = scene.L;
    this.area = scene.area;

    this.zoom = 1;
    this.pointers = new Map();
    this.pinch = null;
    this.lastProbed = null;
    this.readings = new Map();

    this._down = (p) => this.onPointerDown(p);
    this._move = (p) => this.onPointerMove(p);
    this._up = (p) => this.onPointerUp(p);
    this._lastTap = 0;
  }

  build(root) {
    this.root = root;
    const s = this.L.s;

    this.boardX = this.area.w / 2;
    this.boardY = this.area.y + this.area.h / 2 + 10 * s;

    this.board = this.scene.add
      .container(this.boardX, this.boardY)
      .setScale(s * this.zoom);
    this.root.add(this.board);

    this.readout = this.scene.add.container(0, 0);
    this.root.add(this.readout);

    this.render();
    this.renderReadout();

    this.scene.input.on('pointerdown', this._down);
    this.scene.input.on('pointermove', this._move);
    this.scene.input.on('pointerup', this._up);

    this.updateAction();
  }

  destroy() {
    this.scene.input.off('pointerdown', this._down);
    this.scene.input.off('pointermove', this._move);
    this.scene.input.off('pointerup', this._up);
    if (this.board) this.board.destroy(true);
    if (this.readout) this.readout.destroy(true);
  }

  /* ---------------------------------------------------------------- */
  /*  Плата                                                            */
  /* ---------------------------------------------------------------- */

  render() {
    if (!this.board) return;
    this.board.removeAll(true);

    const scene = this.scene;
    const g = scene.add.graphics();

    // Тень и текстолит
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-146, -176, 300, 360, 20);
    g.fillStyle(0x123029, 1);
    g.fillRoundedRect(-150, -180, 300, 360, 18);
    g.lineStyle(2, 0x1e5a4a, 1);
    g.strokeRoundedRect(-150, -180, 300, 360, 18);

    // Дорожки
    g.lineStyle(1, 0x2f8a6c, 0.55);
    for (let i = 0; i < 9; i++) {
      g.lineBetween(-140, -150 + i * 36, 140, -160 + i * 36);
    }
    g.lineStyle(1, 0x2f8a6c, 0.35);
    for (let i = 0; i < 6; i++) {
      g.lineBetween(-120 + i * 48, -170, -120 + i * 48, 170);
    }

    // Отверстия крепления
    g.fillStyle(0x08120f, 1);
    [[-134, -164], [134, -164], [-134, 164], [134, 164]].forEach(([x, y]) => {
      g.fillCircle(x, y, 6);
      g.lineStyle(1.5, 0x2a6a58, 1);
      g.strokeCircle(x, y, 6);
    });

    this.board.add(g);

    // Компоненты
    for (const slot of BOARD_SLOTS) {
      const comp = COMPONENTS[slot.id];
      const probed = this.readings.get(slot.id);

      const bg = scene.add.graphics();
      bg.fillStyle(0x0b1c18, 1);
      bg.fillCircle(slot.x, slot.y, 32);
      bg.lineStyle(1.5, probed ? (probed.status === 'ok' ? 0x38e8a0 : 0xffb020) : 0x2a6a58, 0.9);
      bg.strokeCircle(slot.x, slot.y, 32);
      this.board.add(bg);

      const img = icon(this.scene, slot.x, slot.y, comp.icon, 40);
      this.board.add(img);

      if (probed) {
        const dot = scene.add.graphics();
        dot.fillStyle(probed.status === 'ok' ? 0x38e8a0 : 0xffb020, 1);
        dot.fillCircle(slot.x + 24, slot.y - 24, 5);
        this.board.add(dot);
      }

      const zone = scene.add.zone(slot.x, slot.y, 72, 72).setOrigin(0.5).setInteractive();
      zone.on('pointerup', () => {
        if (this.pinching) return;
        this.probe(slot.id);
      });
      this.board.add(zone);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Замеры                                                           */
  /* ---------------------------------------------------------------- */

  probe(id) {
    const res = this.run.probe(id);
    if (!res.ok) return;

    this.lastProbed = id;
    this.readings.set(id, { status: res.status, reading: res.reading });

    audio.play(res.status === 'bad' ? 'warn' : 'tap');
    audio.vibrate(res.status === 'bad' ? [20, 30, 20] : 6);

    this.render();
    this.renderReadout();
    this.updateAction();
    this.scene.updateHUD();
  }

  renderReadout() {
    if (!this.readout) return;
    this.readout.removeAll(true);

    const s = this.L.s;
    const w = this.area.w / s - 32;
    const cx = this.area.w / 2;
    const cy = this.area.y + 62 * s;

    const bg = panel(this.scene, w, 96, { fill: C.panel, radius: 16, stroke: C.line });
    bg.setPosition(cx, cy);
    this.readout.add(bg);

    const last = this.lastProbed ? this.readings.get(this.lastProbed) : null;
    const comp = this.lastProbed ? COMPONENTS[this.lastProbed] : null;

    if (!comp) {
      const t = tx(this.scene, 'Мультиметр готов', 15, { bold: true });
      t.setOrigin(0, 0.5).setPosition(cx - (w / 2 - 18) * s, cy - 14 * s);
      this.readout.add(t);

      const hint = tx(this.scene, 'Коснитесь компонента на плате, чтобы снять замер', 11, {
        color: C.dim,
        wrap: w - 36,
      });
      hint.setOrigin(0, 0.5).setPosition(cx - (w / 2 - 18) * s, cy + 14 * s);
      this.readout.add(hint);
      return;
    }

    const left = cx - (w / 2 - 18) * s;
    const img = icon(this.scene, left + 18 * s, cy, comp.icon, 34);
    this.readout.add(img);

    const name = tx(this.scene, comp.name, 14, { bold: true });
    name.setOrigin(0, 0.5).setPosition(left + 44 * s, cy - 24 * s);
    this.readout.add(name);

    const statusColor = last.status === 'ok' ? C.accentText : last.status === 'bad' ? C.dangerText : C.warnText;
    const value = tx(this.scene, last.reading, 19, { bold: true, color: statusColor });
    value.setOrigin(0, 0.5).setPosition(left + 44 * s, cy + 2 * s);
    this.readout.add(value);

    const note = tx(
      this.scene,
      last.status === 'bad' ? 'Вне допуска — похоже на причину' : last.status === 'warn' ? 'Пограничное значение' : comp.note,
      10,
      { color: C.faint, wrap: w - 60 }
    );
    note.setOrigin(0, 0.5).setPosition(left + 44 * s, cy + 27 * s);
    this.readout.add(note);
  }

  /* ---------------------------------------------------------------- */
  /*  Кнопка «подтвердить»                                             */
  /* ---------------------------------------------------------------- */

  updateAction() {
    if (!this.lastProbed) {
      this.scene.setAction(null);
      return;
    }
    this.scene.setAction({
      label: 'ПОДТВЕРДИТЬ НЕИСПРАВНОСТЬ',
      kind: 'primary',
      enabled: true,
      onClick: () => this.confirm(),
    });
  }

  confirm() {
    const id = this.lastProbed;
    if (!id) return;
    const res = this.run.confirmFault(id);
    if (res.ok) {
      audio.play('ok');
      this.scene.afterAction();
      return;
    }
    audio.play('fail');
    audio.vibrate([30, 50, 30]);
    this.scene.shakeStage();
    this.scene.toast('Это не та неисправность. −10 к качеству', 'bad');
    this.scene.afterAction();
  }

  /* ---------------------------------------------------------------- */
  /*  Пинч-зум                                                         */
  /* ---------------------------------------------------------------- */

  onPointerDown(p) {
    this.pointers.set(p.id, { x: p.x, y: p.y });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.pinch = { dist: Math.max(1, dist), zoom: this.zoom };
      this.pinching = true;
    }

    // Двойной тап — сброс масштаба
    const now = performance.now();
    if (now - (this._lastTap || 0) < 300) this.setZoom(1);
    this._lastTap = now;
  }

  onPointerMove(p) {
    if (!this.pointers.has(p.id)) return;
    this.pointers.set(p.id, { x: p.x, y: p.y });
    if (!this.pinch || this.pointers.size < 2) return;

    const [a, b] = [...this.pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const next = Math.max(1, Math.min(2.3, this.pinch.zoom * (dist / this.pinch.dist)));
    this.setZoom(next);
  }

  onPointerUp(p) {
    this.pointers.delete(p.id);
    if (this.pointers.size < 2) {
      this.pinch = null;
      // Небольшая пауза, чтобы палец не «докликал» после жеста
      this.scene.time.delayedCall(120, () => {
        this.pinching = false;
      });
    }
  }

  setZoom(z) {
    this.zoom = z;
    if (this.board) this.board.setScale(this.L.s * z);
  }
}