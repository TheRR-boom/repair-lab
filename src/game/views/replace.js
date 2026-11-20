import Phaser from 'phaser';
import { audio } from '../core/audio.js';
import { C, icon, panel, tx } from '../core/ui.js';
import { PARTS } from '../data/content.js';

/**
 * Замена детали: попасть новой деталью в посадочное место (точность),
 * затем прижать разъём и включить телефон.
 *
 * Тач-специфика: деталь тащится пальцем, «окно» допуска большое (30 единиц),
 * а после промаха сужается — так игрок чувствует прогресс, но не страдает
 * от того, что палец перекрывает точку прицела.
 */
export class ReplaceView {
  constructor(scene, run) {
    this.scene = scene;
    this.run = run;
    this.L = scene.L;
    this.area = scene.area;

    this.dragging = false;
    this.offset = { x: 0, y: 0 };

    this._move = (p) => this.onMove(p);
    this._up = (p) => this.onUp(p);
  }

  get part() {
    return PARTS[this.run.fault.part];
  }

  build(root) {
    this.root = root;
    const s = this.L.s;

    this.cx = this.area.w / 2;
    this.socketY = this.area.y + this.area.h * 0.38;
    this.trayY = this.area.y + this.area.h * 0.82;

    this.content = this.scene.add.container(0, 0);
    this.root.add(this.content);

    this.scene.input.on('pointermove', this._move);
    this.scene.input.on('pointerup', this._up);

    this.render();
  }

  destroy() {
    this.scene.input.off('pointermove', this._move);
    this.scene.input.off('pointerup', this._up);
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    if (this.content) this.content.destroy(true);
  }

  /* ---------------------------------------------------------------- */

  render() {
    if (!this.content) return;
    if (this.pulseTween) {
      this.pulseTween.stop();
      this.pulseTween = null;
    }
    this.content.removeAll(true);

    const s = this.L.s;
    const scene = this.scene;
    const placed = this.run.replace.placed;

    /* Корпус-подложка */
    const plate = scene.add.graphics();
    const pw = 156 * s;
    const ph = 156 * s;
    plate.fillStyle(C.panel, 1);
    plate.fillRoundedRect(this.cx - pw / 2, this.socketY - ph / 2, pw, ph, 20 * s);
    plate.lineStyle(Math.max(1, 1.5 * s), C.line, 1);
    plate.strokeRoundedRect(this.cx - pw / 2, this.socketY - ph / 2, pw, ph, 20 * s);

    // Контур посадочного места
    plate.lineStyle(Math.max(1, 1.5 * s), 0x3a4a5c, 1);
    plate.strokeRoundedRect(this.cx - 44 * s, this.socketY - 44 * s, 88 * s, 88 * s, 12 * s);

    // Кольцо допуска (пунктиром)
    const tol = this.run.replace.tolerance * s;
    plate.lineStyle(Math.max(1, 1.5 * s), C.accent, 0.55);
    for (let i = 0; i < 20; i++) {
      plate.beginPath();
      plate.arc(this.cx, this.socketY, tol, (i * Math.PI) / 10, (i * Math.PI) / 10 + 0.12);
      plate.strokePath();
    }
    this.content.add(plate);

    /* Деталь */
    if (placed) {
      const img = icon(scene, this.cx, this.socketY, this.part.icon, 70);
      this.content.add(img);
      this.partImg = img;
      this.drawConnector(s);
    } else {
      // Лоток с деталью
      const trayW = 150 * s;
      const trayH = 96 * s;
      const tray = scene.add.graphics();
      tray.fillStyle(C.panel2, 1);
      tray.fillRoundedRect(this.cx - trayW / 2, this.trayY - trayH / 2, trayW, trayH, 16 * s);
      tray.lineStyle(Math.max(1, s), C.line, 1);
      tray.strokeRoundedRect(this.cx - trayW / 2, this.trayY - trayH / 2, trayW, trayH, 16 * s);
      this.content.add(tray);

      const label = tx(scene, 'НОВАЯ ДЕТАЛЬ', 9, { color: C.faint, letterSpacing: 1.5 });
      label.setOrigin(0.5, 0.5).setPosition(this.cx, this.trayY - trayH / 2 - 12 * s);
      this.content.add(label);

      const img = icon(scene, this.cx, this.trayY, this.part.icon, 64);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', (p) => this.startDrag(p));
      this.content.add(img);
      this.partImg = img;

      const hint = tx(scene, 'перетащите деталь в гнездо', 10, { color: C.faint });
      hint.setOrigin(0.5, 0).setPosition(this.cx, this.trayY + trayH / 2 + 8 * s);
      this.content.add(hint);
    }

    this.updateAction();
  }

  drawConnector(s) {
    const scene = this.scene;
    const cy = this.socketY + 66 * s;

    const g = scene.add.graphics();
    g.fillStyle(C.panel2, 1);
    g.fillRoundedRect(this.cx - 34 * s, cy - 16 * s, 68 * s, 32 * s, 10 * s);
    g.lineStyle(Math.max(1, 1.5 * s), this.run.replace.locked ? C.accent : C.warn, 1);
    g.strokeRoundedRect(this.cx - 34 * s, cy - 16 * s, 68 * s, 32 * s, 10 * s);
    this.content.add(g);

    const img = icon(scene, this.cx, cy, 'comp_flex', 26);
    this.content.add(img);

    const label = tx(
      scene,
      this.run.replace.locked ? 'разъём защёлкнут' : 'прижмите разъём',
      10,
      { color: this.run.replace.locked ? C.accentText : C.warnText }
    );
    label.setOrigin(0.5, 0).setPosition(this.cx, cy + 20 * s);
    this.content.add(label);

    if (!this.run.replace.locked) {
      // Пульсирующая рамка = «нажми сюда». Рисуем в локальных координатах,
      // чтобы зона нажатия совпадала с картинкой после setPosition.
      const glow = scene.add.graphics();
      glow.lineStyle(Math.max(2, 2 * s), C.warn, 0.6);
      glow.strokeRoundedRect(-38 * s, -20 * s, 76 * s, 40 * s, 12 * s);
      glow.setPosition(this.cx, cy);
      // Зона нажатия 96×56 dp: палец не должен целиться в тонкую полоску
      glow.setInteractive(
        new Phaser.Geom.Rectangle(-48 * s, -28 * s, 96 * s, 56 * s),
        Phaser.Geom.Rectangle.Contains
      );
      glow.on('pointerup', () => this.lock());
      this.content.add(glow);
      this.pulseTween = scene.tweens.add({
        targets: glow,
        alpha: { from: 0.9, to: 0.15 },
        duration: 700,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Перетаскивание                                                   */
  /* ---------------------------------------------------------------- */

  startDrag(p) {
    if (this.run.replace.placed) return;
    this.dragging = true;
    this.offset.x = this.partImg.x - p.x;
    this.offset.y = this.partImg.y - p.y;
    this.scene.tweens.add({ targets: this.partImg, scale: this.partImg.scale * 1.08, duration: 90 });
    audio.play('tap');
  }

  onMove(p) {
    if (!this.dragging || !this.partImg) return;
    this.partImg.setPosition(p.x + this.offset.x, p.y + this.offset.y);
  }

  onUp() {
    if (!this.dragging || !this.partImg) return;
    this.dragging = false;

    const s = this.L.s;
    const dist = Math.hypot(
      (this.partImg.x - this.cx) / s,
      (this.partImg.y - this.socketY) / s
    );

    const res = this.run.placePart(dist);
    if (res.ok) {
      audio.play(res.forced ? 'warn' : 'ok');
      audio.vibrate(res.forced ? [20, 40, 20] : 12);
      if (res.forced) this.scene.toast('Деталь встала криво — штраф', 'warn');
      this.scene.afterAction();
      return;
    }

    audio.play('fail');
    audio.vibrate([25, 45, 25]);
    this.scene.shakeStage();
    this.scene.toast(`Мимо · допуск ${Math.round(res.tolerance)} ед.`, 'bad');
    this.scene.afterAction();
  }

  /* ---------------------------------------------------------------- */

  lock() {
    if (this.run.replace.locked) return;
    const res = this.run.lockConnector();
    if (!res.ok) return;
    audio.play('attach');
    audio.vibrate(10);
    this.scene.afterAction();
  }

  power() {
    const res = this.run.powerOn();
    if (!res.ok) {
      this.scene.toast('Сначала прижмите разъём', 'warn');
      return;
    }
    audio.play('boot');
    this.scene.finish();
  }

  updateAction() {
    const r = this.run.replace;
    if (!r.placed) {
      this.scene.setAction(null);
      return;
    }
    if (!r.locked) {
      this.scene.setAction({
        label: 'ПРИЖМИТЕ РАЗЪЁМ',
        kind: 'ghost',
        enabled: false,
        onClick: () => {},
      });
      return;
    }
    this.scene.setAction({
      label: 'ВКЛЮЧИТЬ ТЕЛЕФОН',
      kind: 'primary',
      enabled: true,
      onClick: () => this.power(),
    });
  }
}