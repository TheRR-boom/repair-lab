/**
 * RepairRun — вся логика одного заказа: разборка → диагностика → замена.
 *
 * Специально НЕ знает ничего про Phaser и DOM: сцену можно перерисовать
 * заново в любой момент (поворот, resize), а состояние заказа останется.
 * Каждый метод возвращает результат-«код», а не рисует и не показывает текст.
 */

import { COMPONENTS, PHONES, FAULTS, BALANCE } from '../data/content.js';

export const STAGE = {
  TEARDOWN: 'teardown',
  DIAGNOSE: 'diagnose',
  REPLACE: 'replace',
  DONE: 'done',
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class RepairRun {
  constructor(order, opts = {}) {
    this.order = order;
    this.phone = PHONES[order.phoneId];
    this.fault = FAULTS[order.faultId];
    this.now = opts.now || (() => Date.now());

    // «Точные биты» вдвое снижают урон от ошибок
    this.damageFactor = opts.hasTool && opts.hasTool('probits') ? 0.5 : 1;

    this.stage = STAGE.TEARDOWN;
    this.startedAt = this.now();
    this.finishedAt = 0;

    this.damage = 0;
    this.probes = 0;
    this.hints = 0;
    this.mistakes = 0;
    this.tear = false;
    this.probeLog = [];

    // «Ложный след»: один исправный узел показывает пограничное значение.
    // Так диагностика — это не «найди единственную красную цифру».
    this.redHerring = this._pickRedHerring();

    this.teardown = {
      phase: 'outer', // outer → lift → inner → connector → done
      attached: false,
      softened: false,
      tension: 0,
      liftProgress: 0,
      coverOff: false,
      connectorOut: false,
      screws: [
        { id: 'p1', kind: 'pentalobe', step: 1, x: -44, y: 152, removed: false, stripped: false },
        { id: 'p2', kind: 'pentalobe', step: 2, x: 44, y: 152, removed: false, stripped: false },
        { id: 't1', kind: 'torx', step: 3, x: 0, y: -118, removed: false, stripped: false },
        { id: 't2', kind: 'torx', step: 4, x: -48, y: -118, removed: false, stripped: false },
        { id: 't3', kind: 'torx', step: 5, x: 48, y: -118, removed: false, stripped: false },
      ],
    };

    this.replace = {
      placed: false,
      locked: false,
      tolerance: 30, // дизайн-единицы: радиус «окна» при установке детали
      attempts: 0,
      distance: null,
    };
  }

  _pickRedHerring() {
    const faulty = this.order.component;
    const pool = Object.keys(COMPONENTS).filter((id) => id !== faulty);
    // Детерминированно, без Math.random: важно для тестов
    const seed = (this.order.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return pool[seed % pool.length];
  }

  /* ---------------------------------------------------------------- */
  /*  Общее                                                            */
  /* ---------------------------------------------------------------- */

  addDamage(v) {
    this.damage = clamp(this.damage + v * this.damageFactor, 0, 100);
  }

  elapsedSeconds() {
    const end = this.finishedAt || this.now();
    return Math.max(0, Math.round((end - this.startedAt) / 1000));
  }

  requestHint() {
    this.hints += 1;
    return this.currentHint();
  }

  currentHint() {
    const t = this.teardown;
    if (this.stage === STAGE.TEARDOWN) {
      switch (t.phase) {
        case 'outer':
          return 'Открутите нижние винты Pentalobe: сначала левый (1), потом правый (2).';
        case 'lift':
          return t.attached
            ? 'Плавно тяните присоску вверх. Резкий рывок порвёт шлейф.'
            : 'Поставьте присоску на экран и потяните вверх.';
        case 'inner':
          return 'Открутите винты Torx: центральный (3), затем боковые (4, 5).';
        case 'connector':
          return 'Отщёлкните шлейф батареи лопаткой.';
        default:
          return 'Разборка завершена.';
      }
    }
    if (this.stage === STAGE.DIAGNOSE) {
      return `Замерьте плату мультиметром. ${this.order.symptom}`;
    }
    if (this.stage === STAGE.REPLACE) {
      return this.replace.placed
        ? 'Прижмите разъём новой детали и включите телефон.'
        : 'Установите новую деталь точно в посадочное место.';
    }
    return 'Заказ завершён.';
  }

  /* ---------------------------------------------------------------- */
  /*  Разборка                                                         */
  /* ---------------------------------------------------------------- */

  get expectedScrew() {
    const left = this.teardown.screws.filter((s) => !s.removed);
    if (!left.length) return null;
    return left.reduce((a, b) => (a.step <= b.step ? a : b));
  }

  get coverRemoved() {
    return this.teardown.coverOff;
  }

  /**
   * Попытка открутить винт.
   * @param {string} screwId
   * @param {string} toolId  'pentalobe' | 'torx' | ...
   */
  useScrewdriver(screwId, toolId) {
    if (this.stage !== STAGE.TEARDOWN) return { ok: false, code: 'WRONG_STAGE' };
    const t = this.teardown;

    if (t.phase === 'lift') return { ok: false, code: 'OPEN_FIRST' };
    if (t.phase === 'connector' || t.phase === 'done') return { ok: false, code: 'DONE' };

    const screw = t.screws.find((s) => s.id === screwId);
    if (!screw) return { ok: false, code: 'NO_SCREW' };
    if (screw.removed) return { ok: false, code: 'ALREADY' };

    // Пока крышка на месте, внутренние винты физически недоступны
    if (t.phase === 'outer' && screw.kind !== 'pentalobe') return { ok: false, code: 'NOT_YET' };
    if (t.phase === 'inner' && screw.kind !== 'torx') return { ok: false, code: 'NOT_YET' };

    // Инструмент не тот — срываем шлиц
    if (toolId !== screw.kind) {
      if (!screw.stripped) {
        screw.stripped = true;
        this.addDamage(8);
        return { ok: false, code: 'STRIPPED', screw };
      }
      // Второй раз — срываем с усилием
      screw.removed = true;
      this.addDamage(6);
      this._afterScrewRemoved(screw);
      return { ok: true, code: 'FORCED', screw };
    }

    const expected = this.expectedScrew;
    const outOfOrder = expected && expected.id !== screw.id;

    screw.removed = true;
    if (screw.stripped) this.addDamage(6);
    if (outOfOrder) this.addDamage(4);
    this._afterScrewRemoved(screw);

    return {
      ok: true,
      code: screw.stripped ? 'FORCED' : outOfOrder ? 'ORDER' : 'OK',
      screw,
    };
  }

  _afterScrewRemoved() {
    const t = this.teardown;
    const left = t.screws.filter((s) => !s.removed);
    if (t.phase === 'outer' && left.every((s) => s.kind !== 'pentalobe')) {
      t.phase = 'lift';
      return;
    }
    if (t.phase === 'inner' && left.every((s) => s.kind !== 'torx')) {
      t.phase = 'connector';
    }
  }

  /** Присоска «прилипла» к экрану. */
  attachSuction() {
    if (this.stage !== STAGE.TEARDOWN || this.teardown.phase !== 'lift') {
      return { ok: false, code: 'NOT_YET' };
    }
    this.teardown.attached = true;
    return { ok: true };
  }

  /** Прогрев феном: снижает риск порвать шлейф. */
  soften() {
    this.teardown.softened = true;
    return { ok: true };
  }

  /**
   * Один шаг подъёма крышки.
   * @param {number} delta  смещение вверх в дизайн-единицах (может быть < 0)
   * @param {number} dt     мс с прошлого шага
   */
  liftTick(delta, dt) {
    const t = this.teardown;
    if (this.stage !== STAGE.TEARDOWN || t.phase !== 'lift' || !t.attached) {
      return { ok: false, code: 'NO_SUCTION' };
    }

    const step = Math.max(0, delta);
    const speed = step / Math.max(16, dt); // ед/мс
    const safe = t.softened ? 0.95 : 0.55;
    const excess = Math.max(0, speed - safe);

    // Натяжение растёт от скорости и медленно спадает со временем
    t.tension = clamp(t.tension + excess * 34 - 0.22 * dt, 0, 100);
    t.liftProgress = clamp(t.liftProgress + step / 170, 0, 1);

    if (t.tension >= 100) {
      this.tear = true;
      t.tension = 100;
      this.addDamage(25);
      t.coverOff = true;
      t.phase = 'inner';
      return { ok: true, torn: true, progress: 1, tension: 100 };
    }

    if (t.liftProgress >= 1) {
      t.coverOff = true;
      t.phase = 'inner';
      return { ok: true, torn: false, progress: 1, tension: t.tension };
    }

    return { ok: true, torn: false, progress: t.liftProgress, tension: t.tension };
  }

  /** Отключение шлейфа батареи лопаткой. */
  unplugBattery(toolId) {
    if (this.stage !== STAGE.TEARDOWN || this.teardown.phase !== 'connector') {
      return { ok: false, code: 'NOT_YET' };
    }
    if (toolId !== 'spudger') {
      this.addDamage(5);
      return { ok: false, code: 'WRONG_TOOL' };
    }
    this.teardown.connectorOut = true;
    this.teardown.phase = 'done';
    this.stage = STAGE.DIAGNOSE;
    return { ok: true };
  }

  /* ---------------------------------------------------------------- */
  /*  Диагностика                                                      */
  /* ---------------------------------------------------------------- */

  probe(componentId) {
    if (this.stage !== STAGE.DIAGNOSE) return { ok: false, code: 'WRONG_STAGE' };
    const comp = COMPONENTS[componentId];
    if (!comp) return { ok: false, code: 'NO_COMPONENT' };

    this.probes += 1;
    const faulty = componentId === this.order.component;
    const herring = componentId === this.redHerring;
    const status = faulty ? 'bad' : herring ? 'warn' : 'ok';
    const reading = faulty ? comp.bad : comp.ok;

    const entry = {
      id: componentId,
      reading,
      status,
      name: comp.name,
      note: comp.note,
      time: this.now() - this.startedAt,
    };
    this.probeLog.push(entry);

    return {
      ok: true,
      reading,
      status,
      faulty,
      component: comp,
      count: this.probes,
    };
  }

  confirmFault(componentId) {
    if (this.stage !== STAGE.DIAGNOSE) return { ok: false, code: 'WRONG_STAGE' };
    if (componentId === this.order.component) {
      this.stage = STAGE.REPLACE;
      this.replaceStartedAt = this.now();
      return { ok: true };
    }
    this.mistakes += 1;
    this.addDamage(10);
    return { ok: false, code: 'WRONG', damage: this.damage };
  }

  /* ---------------------------------------------------------------- */
  /*  Замена                                                           */
  /* ---------------------------------------------------------------- */

  /** distance — промах в дизайн-единицах от центра посадочного места. */
  placePart(distance) {
    if (this.stage !== STAGE.REPLACE) return { ok: false, code: 'WRONG_STAGE' };
    if (this.replace.placed) return { ok: true, already: true };

    this.replace.distance = distance;

    if (distance <= this.replace.tolerance) {
      this.replace.placed = true;
      return { ok: true, exact: true };
    }

    this.replace.attempts += 1;
    this.addDamage(6);
    this.replace.tolerance = Math.max(14, this.replace.tolerance * 0.75);

    if (this.replace.attempts >= 3) {
      this.replace.placed = true;
      this.addDamage(10);
      return { ok: true, forced: true, tolerance: this.replace.tolerance };
    }
    return { ok: false, code: 'MISS', tolerance: this.replace.tolerance };
  }

  /** Прижать разъём — тап по разъёму после установки детали. */
  lockConnector() {
    if (this.stage !== STAGE.REPLACE) return { ok: false, code: 'WRONG_STAGE' };
    if (!this.replace.placed) return { ok: false, code: 'NO_PART' };
    this.replace.locked = true;
    return { ok: true };
  }

  /** Включение: финальная точка заказа. */
  powerOn() {
    if (this.stage !== STAGE.REPLACE) return { ok: false, code: 'WRONG_STAGE' };
    if (!this.replace.placed) return { ok: false, code: 'NO_PART' };
    if (!this.replace.locked) return { ok: false, code: 'NOT_LOCKED' };

    this.stage = STAGE.DONE;
    this.finishedAt = this.now();
    return { ok: true, summary: this.summary() };
  }

  /* ---------------------------------------------------------------- */
  /*  Итог                                                             */
  /* ---------------------------------------------------------------- */

  summary() {
    return {
      orderId: this.order.id,
      payout: this.order.payout,
      partCost: this.order.partCost,
      success: this.damage < BALANCE.damageLimit,
      damage: Math.round(this.damage),
      seconds: this.elapsedSeconds(),
      targetSeconds: this.order.targetSeconds,
      probes: this.probes,
      hints: this.hints,
      mistakes: this.mistakes,
      tear: this.tear,
      probeLog: this.probeLog.slice(),
    };
  }
}