import { audio } from '../core/audio.js';
import { C } from '../core/ui.js';

/**
 * Разборка: винты Pentalobe → присоска → винты Torx → шлейф батареи.
 *
 * Вся графика рисуется в локальных координатах «дизайнерского» телефона
 * (196×390), а контейнер масштабируется под экран — поэтому модель
 * одинаково выглядит на любом устройстве.
 */

const CONNECTOR = { x: 4, y: -58 };

export class TeardownView {
  constructor(scene, run) {
    this.scene = scene;
    this.run = run;
    this.L = scene.L;
    this.area = scene.area;

    this.k = Math.min(
      1.05,
      (this.area.h / this.L.s - 26) / 400,
      (this.area.w / this.L.s - 20) / 210
    );
    this.cx = this.area.w / 2;
    this.cy = this.area.y + this.area.h / 2;

    this.lifting = false;
    this.lastY = 0;
    this.lastT = 0;
    this._move = (p) => this.onMove(p);
    this._up = () => this.onGlobalUp();
  }

  build(root) {
    this.root = root;
    this.phone = this.scene.add.container(this.cx, this.cy).setScale(this.L.s * this.k);
    this.root.add(this.phone);

    this.zone = this.scene.add.zone(0, 0, 196, 390).setOrigin(0.5).setInteractive();
    this.zone.on('pointerdown', (p) => this.onDown(p));
    this.zone.on('pointerup', (p) => this.onUp(p));
    this.phone.add(this.zone);

    this.scene.input.on('pointermove', this._move);
    this.scene.input.on('pointerup', this._up);

    this.render();
  }

  destroy() {
    this.scene.input.off('pointermove', this._move);
    this.scene.input.off('pointerup', this._up);
    if (this.phone) this.phone.destroy(true);
  }

  /* ---------------------------------------------------------------- */
  /*  Координаты                                                       */
  /* ---------------------------------------------------------------- */

  toLocal(px, py) {
    const sc = this.L.s * this.k;
    return { x: (px - this.cx) / sc, y: (py - this.cy) / sc };
  }

  hitTest(px, py) {
    const p = this.toLocal(px, py);
    const t = this.run.teardown;

    const list = t.coverOff
      ? t.screws.filter((s) => s.kind === 'torx' && !s.removed)
      : t.screws.filter((s) => s.kind === 'pentalobe' && !s.removed);

    for (const s of list) {
      if (Math.hypot(p.x - s.x, p.y - s.y) <= 34) return { kind: 'screw', id: s.id };
    }
    if (t.phase === 'connector' && Math.hypot(p.x - CONNECTOR.x, p.y - CONNECTOR.y) <= 36) {
      return { kind: 'connector' };
    }
    if (p.x > -98 && p.x < 98 && p.y > -195 && p.y < 195) return { kind: 'body' };
    return null;
  }

  /* ---------------------------------------------------------------- */
  /*  Отрисовка                                                        */
  /* ---------------------------------------------------------------- */

  render() {
    if (!this.phone) return;
    // Удаляем всё, кроме зоны нажатия
    for (const child of this.phone.list.slice()) {
      if (child !== this.zone) {
        this.phone.remove(child, true);
      }
    }
    const t = this.run.teardown;
    const phone = this.run.phone;
    const scene = this.scene;

    /* Корпус */
    const frame = scene.add.graphics();
    frame.fillStyle(0x000000, 0.4);
    frame.fillEllipse(0, 208, 220, 20);
    frame.fillStyle(0x1a222c, 1);
    frame.fillRoundedRect(-98, -195, 196, 390, 30);
    frame.lineStyle(2, 0x3b4855, 1);
    frame.strokeRoundedRect(-98, -195, 196, 390, 30);
    frame.fillStyle(0x0b1118, 1);
    frame.fillRoundedRect(-90, -187, 180, 374, 24);
    this.phone.add(frame);

    if (!t.coverOff) this.drawCover(t, phone);
    else this.drawInternals(t);

    this.drawScrews(t);
    this.drawSuction(t);

    // Зона всегда сверху
    this.phone.bringToTop(this.zone);
  }

  drawCover(t, phone) {
    const scene = this.scene;
    this.cover = scene.add.container(0, 0);

    const g = scene.add.graphics();
    g.fillStyle(phone.cover, 1);
    g.fillRoundedRect(-86, -183, 172, 366, 22);
    g.fillStyle(0xffffff, 0.035);
    g.fillRoundedRect(-86, -183, 172, 130, 22);
    g.lineStyle(1.5, 0xffffff, 0.07);
    g.strokeRoundedRect(-86, -183, 172, 366, 22);

    // Блок камер
    g.fillStyle(0x0d141c, 1);
    g.fillRoundedRect(-64, -158, 66, 66, 16);
    g.fillStyle(0x0a0f15, 1);
    g.fillCircle(-46, -140, 12);
    g.fillCircle(-19, -140, 12);
    g.fillCircle(-46, -113, 12);
    g.lineStyle(1.5, 0x39505f, 1);
    g.strokeCircle(-46, -140, 13);
    g.strokeCircle(-19, -140, 13);
    g.strokeCircle(-46, -113, 13);

    // Логотип-полоска
    g.fillStyle(phone.accent, 0.35);
    g.fillRoundedRect(-9, 24, 18, 4, 2);

    // Наклейка «крышка»
    g.lineStyle(1, 0xffffff, 0.05);
    for (let i = -2; i <= 2; i++) g.lineBetween(-70, i * 26 + 90, 70, i * 26 + 90);

    this.cover.add(g);
    this.phone.add(this.cover);
    this.cover.setPosition(0, -t.liftProgress * 150);
  }

  drawInternals(t) {
    const scene = this.scene;
    const g = scene.add.graphics();

    // Плата сверху
    g.fillStyle(0x0f2a26, 1);
    g.fillRoundedRect(-80, -183, 160, 112, 10);
    g.lineStyle(1, 0x1f5b4d, 1);
    g.strokeRoundedRect(-80, -183, 160, 112, 10);

    // Дорожки
    g.lineStyle(1, 0x2a7d63, 0.7);
    for (let i = 0; i < 6; i++) {
      g.lineBetween(-70, -170 + i * 14, 70, -176 + i * 14);
    }

    // Экранирующая пластина
    g.fillStyle(0x27333f, 1);
    g.fillRoundedRect(-62, -158, 124, 74, 6);
    g.lineStyle(1, 0x46586a, 1);
    g.strokeRoundedRect(-62, -158, 124, 74, 6);

    // Батарея
    g.fillStyle(0x14332b, 1);
    g.fillRoundedRect(-66, -52, 132, 168, 10);
    g.lineStyle(1.5, 0x1f5b4d, 1);
    g.strokeRoundedRect(-66, -52, 132, 168, 10);
    g.fillStyle(0x38e8a0, 0.10);
    g.fillRoundedRect(-58, -44, 116, 60, 6);

    // Шлейф батареи → плата
    g.lineStyle(7, 0xc98a3a, 1);
    g.lineBetween(0, -52, 0, -104);
    g.lineStyle(2, 0x1a1207, 0.5);
    g.lineBetween(-2, -52, -2, -104);

    // Разъём шлейфа
    g.fillStyle(t.connectorOut ? 0x33414f : 0xc9d6e2, 1);
    g.fillRoundedRect(CONNECTOR.x - 14, CONNECTOR.y - 6, 28, 12, 3);

    this.phone.add(g);

    // Пульс на разъёме, пока он не отключён
    if (!t.connectorOut && t.phase === 'connector') {
      const pulse = scene.add.circle(CONNECTOR.x, CONNECTOR.y, 20, C.warn, 0.35);
      this.phone.add(pulse);
      scene.tweens.add({
        targets: pulse,
        alpha: { from: 0.4, to: 0 },
        scale: { from: 0.6, to: 1.5 },
        duration: 900,
        repeat: -1,
      });
    }
  }

  drawScrews(t) {
    const scene = this.scene;
    const list = t.coverOff
      ? t.screws.filter((s) => s.kind === 'torx' && !s.removed)
      : t.screws.filter((s) => s.kind === 'pentalobe' && !s.removed);

    for (const screw of list) {
      const hole = scene.add.graphics();
      hole.fillStyle(0x05090d, 0.9);
      hole.fillCircle(screw.x, screw.y, 15);
      this.phone.add(hole);

      const img = scene.add.image(screw.x, screw.y, 'atlas', screw.stripped ? 'screw_stripped' : `screw_${screw.kind}`);
      img.setDisplaySize(30, 30);
      if (t.phase === 'lift') img.setAlpha(0.4);
      this.phone.add(img);

      // Подсказка порядка: подсвечиваем следующий винт
      const expected = this.run.expectedScrew;
      if (expected && expected.id === screw.id && !t.coverOff) {
        const ring = scene.add.circle(screw.x, screw.y, 19, C.accent, 0);
        ring.setStrokeStyle(1.5, C.accent, 0.85);
        this.phone.add(ring);
        scene.tweens.add({
          targets: ring,
          alpha: { from: 0.9, to: 0.15 },
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  drawSuction(t) {
    if (!t.attached) return;
    const scene = this.scene;
    const img = scene.add.image(0, -10, 'atlas', 'tool_suction');
    img.setDisplaySize(64, 64);
    this.phone.add(img);
    this.suctionImg = img;
  }

  /* ---------------------------------------------------------------- */
  /*  Взаимодействие                                                   */
  /* ---------------------------------------------------------------- */

  onDown(p) {
    const t = this.run.teardown;
    this.press = { x: p.x, y: p.y };
    if (t.phase === 'lift' && t.attached) {
      this.lifting = true;
      this.lastY = p.y;
      this.lastT = this.stamp(p);
    }
  }

  stamp(p) {
    return (p.event && p.event.timeStamp) || performance.now();
  }

  onUp(p) {
    if (this.lifting) return;
    const moved = this.press && Math.hypot(p.x - this.press.x, p.y - this.press.y) > 14;
    if (moved) return;
    this.scene.tapStage(p.x, p.y);
  }

  onMove(p) {
    if (!this.lifting) return;
    const now = this.stamp(p);
    const dt = Math.max(8, now - this.lastT);
    const dy = (this.lastY - p.y) / (this.L.s * this.k);

    this.lastY = p.y;
    this.lastT = now;

    const res = this.run.liftTick(dy, dt);
    if (!res.ok) return;

    if (this.cover) this.cover.y = -res.progress * 150;
    if (this.suctionImg) this.suctionImg.y = -10 - res.progress * 150;

    this.scene.setTension(res.tension, res.torn);

    if (res.torn) {
      audio.play('tear');
      audio.vibrate([40, 60, 40]);
      this.scene.shakeStage();
      this.lifting = false;
      this.scene.toast('Шлейф порван! −25 к качеству', 'bad');
      this.scene.afterAction();
      return;
    }
    if (res.progress >= 1) {
      this.lifting = false;
      audio.play('ok');
      this.scene.afterAction();
    }
  }

  onGlobalUp() {
    if (!this.lifting) return;
    this.lifting = false;
    this.scene.afterAction();
  }

  /* ---------------------------------------------------------------- */
  /*  Инструменты                                                      */
  /* ---------------------------------------------------------------- */

  tapAt(px, py) {
    const tool = this.scene.selectedTool;
    if (!tool) {
      this.scene.toast('Выберите инструмент снизу', 'warn');
      return;
    }
    this.applyTool(tool, px, py);
  }

  handleDrop(toolId, px, py) {
    this.applyTool(toolId, px, py);
  }

  applyTool(toolId, px, py) {
    const t = this.run.teardown;
    const hit = this.hitTest(px, py);
    if (!hit) return;

    /* --- Присоска: поднять крышку --- */
    if (t.phase === 'lift') {
      if (toolId === 'heatgun') {
        this.run.soften();
        audio.play('ok');
        this.scene.toast('Клей размягчён — можно тянуть смелее', 'good');
        this.scene.afterAction();
        return;
      }
      if (toolId === 'suction') {
        if (!t.attached) {
          this.run.attachSuction();
          audio.play('attach');
          this.scene.toast('Плавно тяните вверх', 'info');
          this.scene.afterAction();
        } else {
          this.scene.toast('Тяните присоску пальцем вверх', 'info');
        }
        return;
      }
      this.scene.toast('Сейчас нужна присоска', 'warn');
      return;
    }

    /* --- Винты --- */
    if (hit.kind === 'screw') {
      if (toolId !== 'pentalobe' && toolId !== 'torx') {
        this.scene.toast('Нужна отвёртка под этот винт', 'warn');
        return;
      }
      const res = this.run.useScrewdriver(hit.id, toolId);
      if (res.ok) {
        audio.play('unscrew');
        audio.vibrate(8);
      } else if (res.code === 'STRIPPED') {
        audio.play('strip');
        audio.vibrate([20, 40, 20]);
        this.scene.shakeStage();
        this.scene.toast('Шлиц сорван! Нужен другой инструмент', 'bad');
      } else if (res.code === 'OPEN_FIRST') {
        this.scene.toast('Сначала поднимите крышку присоской', 'warn');
        return;
      } else if (res.code === 'ALREADY') {
        return;
      }
      this.scene.afterAction();
      return;
    }

    /* --- Шлейф батареи --- */
    if (hit.kind === 'connector') {
      if (toolId !== 'spudger') {
        this.scene.toast('Шлейф отщёлкивают лопаткой', 'warn');
        return;
      }
      const res = this.run.unplugBattery(toolId);
      if (res.ok) {
        audio.play('unscrew');
        this.scene.toast('Шлейф отключён', 'good');
        this.scene.afterAction();
      }
      return;
    }

    if (hit.kind === 'body' && toolId === 'heatgun') {
      this.run.soften();
      audio.play('ok');
      this.scene.toast('Клей размягчён', 'good');
      this.scene.afterAction();
      return;
    }

    this.scene.toast('Инструмент сюда не подходит', 'warn');
  }
}