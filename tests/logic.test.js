import test from 'node:test';
import assert from 'node:assert/strict';

import { RepairRun, STAGE } from '../src/game/systems/run.js';
import { levelInfo, settle, applyReport, buyTool, buyPart } from '../src/game/systems/economy.js';
import { defaultSave, sanitizeSave } from '../src/game/systems/save.js';
import { rollOrders, TOOLS, PARTS, FAULTS } from '../src/game/data/content.js';
import { makeRng } from '../src/game/systems/rng.js';

/* ------------------------------------------------------------------ */
/*  Хелперы                                                            */
/* ------------------------------------------------------------------ */

const clock = (start = 0) => {
  let t = start;
  return {
    now: () => t,
    tick: (ms) => {
      t += ms;
    },
  };
};

function makeOrder(overrides = {}) {
  return {
    id: 'test-order',
    phoneId: 'arc-5',
    faultId: 'battery',
    component: 'battery',
    payout: 120,
    partCost: 32,
    tools: ['pentalobe', 'suction', 'spudger', 'torx'],
    targetSeconds: 150,
    symptom: 'Садится за час',
    createdAt: 0,
    ...overrides,
  };
}

function newRun(order = makeOrder(), opts = {}) {
  const c = clock();
  return {
    run: new RepairRun(order, { now: c.now, hasTool: () => false, ...opts }),
    clock: c,
  };
}

function teardownToDiagnose(run) {
  assert.equal(run.useScrewdriver('p1', 'pentalobe').ok, true);
  assert.equal(run.useScrewdriver('p2', 'pentalobe').ok, true);
  assert.equal(run.teardown.phase, 'lift');
  run.attachSuction();
  const res = run.liftTick(170, 700); // медленно и плавно
  assert.equal(res.ok, true);
  assert.equal(run.teardown.phase, 'inner');
  for (const id of ['t1', 't2', 't3']) {
    assert.equal(run.useScrewdriver(id, 'torx').ok, true);
  }
  assert.equal(run.teardown.phase, 'connector');
  assert.equal(run.unplugBattery('spudger').ok, true);
  assert.equal(run.stage, STAGE.DIAGNOSE);
}

/* ------------------------------------------------------------------ */
/*  Экономика                                                          */
/* ------------------------------------------------------------------ */

test('levelInfo: пороги опыта считаются корректно', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(89).level, 1);
  assert.equal(levelInfo(90).level, 2);
  assert.equal(levelInfo(1400).level, 6);
  assert.equal(levelInfo(99999).maxed, true);
  assert.ok(levelInfo(45).progress > 0 && levelInfo(45).progress < 1);
});

test('settle: успешный заказ приносит деньги, провал — только минус за запчасть', () => {
  const state = defaultSave();
  const ok = settle(state, {
    success: true,
    damage: 0,
    seconds: 80,
    targetSeconds: 150,
    probes: 2,
    hints: 0,
    tear: false,
    payout: 120,
    partCost: 32,
  });
  assert.equal(ok.money, 120 + 18);
  assert.equal(ok.repDelta, 3);

  const fail = settle(state, {
    success: false,
    damage: 60,
    seconds: 300,
    targetSeconds: 150,
    probes: 5,
    hints: 2,
    tear: true,
    payout: 120,
    partCost: 32,
  });
  assert.equal(fail.money, -32);
  assert.equal(fail.repDelta, -3);
  assert.ok(fail.lines.some((l) => l.amount < 0));
});

test('applyReport: деньги, опыт и уровень обновляются', () => {
  const state = defaultSave();
  const before = state.money;
  const res = applyReport(state, {
    success: true,
    damage: 5,
    seconds: 60,
    targetSeconds: 150,
    probes: 2,
    hints: 0,
    tear: false,
    payout: 200,
    partCost: 40,
  });
  assert.equal(state.money, before + 200 + 30 - 4); // −4 штраф за 5% повреждений
  assert.equal(state.stats.orders, 1);
  assert.equal(state.level, levelInfo(state.xp).level);
  assert.ok(res.xpGain > 0);
});

test('покупки: нельзя купить без денег и дважды', () => {
  const state = defaultSave();
  const heatgun = TOOLS.heatgun;
  assert.equal(buyTool(state, heatgun), true);
  assert.equal(buyTool(state, heatgun), false);
  state.money = 0;
  assert.equal(buyTool(state, TOOLS.tweezers), false);

  state.money = 10;
  assert.equal(buyPart(state, PARTS.camera), false);
  state.money = PARTS.camera.price;
  assert.equal(buyPart(state, PARTS.camera), true);
  assert.equal(state.parts.camera, 1);
});

/* ------------------------------------------------------------------ */
/*  Сохранение                                                         */
/* ------------------------------------------------------------------ */

test('sanitizeSave: мусор на входе не ломает игру', () => {
  const dirty = {
    money: 'много',
    rep: 999,
    xp: -5,
    tools: ['pentalobe', 'хакер', 'lamp'],
    parts: { screen: -3, battery: '2' },
    settings: { sound: false },
  };
  const clean = sanitizeSave(dirty);
  assert.equal(clean.money, defaultSave().money);
  assert.equal(clean.rep, 100);
  assert.equal(clean.xp, 0);
  assert.ok(clean.tools.includes('pentalobe'));
  assert.ok(clean.tools.includes('suction'));
  assert.ok(!clean.tools.includes('хакер'));
  assert.equal(clean.parts.screen, 0);
  assert.equal(clean.parts.battery, 2);
  assert.equal(clean.settings.sound, false);
  assert.equal(clean.settings.haptics, true);
});

test('sanitizeSave: null и строка на входе', () => {
  assert.equal(sanitizeSave(null).money, defaultSave().money);
  assert.equal(sanitizeSave('oops').level, 1);
});

/* ------------------------------------------------------------------ */
/*  Заказы                                                             */
/* ------------------------------------------------------------------ */

test('rollOrders: 3 заказа, корректные поля, детерминированность', () => {
  const state = defaultSave();
  const a = rollOrders(state, makeRng(42));
  const b = rollOrders(state, makeRng(42));
  assert.equal(a.length, 3);
  assert.deepEqual(
    a.map((o) => o.phoneId),
    b.map((o) => o.phoneId)
  );
  for (const order of a) {
    assert.ok(order.payout > 0);
    assert.ok(order.partCost > 0);
    assert.ok(FAULTS[order.faultId]);
    assert.ok(order.tools.length > 0);
    assert.equal(order.component, FAULTS[order.faultId].component);
  }
});

test('rollOrders: на 1 уровне только простые неисправности', () => {
  const state = defaultSave();
  state.level = 1;
  for (const order of rollOrders(state, makeRng(7), 10)) {
    assert.ok(['screen', 'battery'].includes(order.faultId));
  }
});

/* ------------------------------------------------------------------ */
/*  Разборка                                                           */
/* ------------------------------------------------------------------ */

test('разборка: полный цикл до диагностики', () => {
  const { run } = newRun();
  teardownToDiagnose(run);
  assert.equal(run.damage, 0);
});

test('разборка: не тот инструмент срывает шлиц и наносит урон', () => {
  const { run } = newRun();
  const res = run.useScrewdriver('p1', 'torx');
  assert.equal(res.ok, false);
  assert.equal(res.code, 'STRIPPED');
  assert.equal(run.teardown.screws[0].stripped, true);
  assert.equal(run.damage, 8);

  // Со правильной отвёрткой сорванный винт всё же выкручивается, но с уроном
  const forced = run.useScrewdriver('p1', 'pentalobe');
  assert.equal(forced.ok, true);
  assert.equal(forced.code, 'FORCED');
  assert.equal(run.damage, 14);
});

test('разборка: порядок винтов важен', () => {
  const { run } = newRun();
  const res = run.useScrewdriver('p2', 'pentalobe'); // первым должен быть p1
  assert.equal(res.ok, true);
  assert.equal(res.code, 'ORDER');
  assert.equal(run.damage, 4);
});

test('разборка: пока не снята крышка, Torx недоступны', () => {
  const { run } = newRun();
  const res = run.useScrewdriver('t1', 'torx');
  assert.equal(res.ok, false);
  assert.equal(res.code, 'NOT_YET');
});

test('разборка: резкий рывок рвёт шлейф', () => {
  const { run } = newRun();
  run.useScrewdriver('p1', 'pentalobe');
  run.useScrewdriver('p2', 'pentalobe');
  run.attachSuction();
  const res = run.liftTick(160, 20); // 8 ед/мс — рывок
  assert.equal(res.torn, true);
  assert.equal(run.tear, true);
  assert.ok(run.damage >= 25);
  assert.equal(run.teardown.phase, 'inner');
});

test('разборка: фен снижает риск разрыва', () => {
  const { run } = newRun();
  run.useScrewdriver('p1', 'pentalobe');
  run.useScrewdriver('p2', 'pentalobe');
  run.attachSuction();
  run.soften();
  const res = run.liftTick(60, 100); // 0.6 ед/мс — без фена уже «на грани»
  assert.equal(res.torn, false);
  assert.ok(res.tension < 100);
});

test('разборка: шлейф отключается только лопаткой', () => {
  const { run } = newRun();
  teardownToDiagnose(run);
  const fresh = newRun().run;
  fresh.useScrewdriver('p1', 'pentalobe');
  fresh.useScrewdriver('p2', 'pentalobe');
  fresh.attachSuction();
  fresh.liftTick(170, 700);
  for (const id of ['t1', 't2', 't3']) fresh.useScrewdriver(id, 'torx');
  const before = fresh.damage;
  const res = fresh.unplugBattery('pentalobe');
  assert.equal(res.ok, false);
  assert.equal(res.code, 'WRONG_TOOL');
  assert.equal(fresh.damage, before + 5);
  assert.equal(fresh.stage, STAGE.TEARDOWN);
});

/* ------------------------------------------------------------------ */
/*  Диагностика                                                        */
/* ------------------------------------------------------------------ */

test('диагностика: замеры и подтверждение', () => {
  const { run } = newRun();
  teardownToDiagnose(run);

  const good = run.probe('screen');
  assert.equal(good.ok, true);
  assert.equal(run.probes, 1);

  const bad = run.probe('battery');
  assert.equal(bad.status, 'bad');
  assert.equal(bad.faulty, true);

  assert.equal(run.confirmFault('screen').ok, false);
  assert.equal(run.mistakes, 1);
  assert.equal(run.damage, 10);

  assert.equal(run.confirmFault('battery').ok, true);
  assert.equal(run.stage, STAGE.REPLACE);
});

/* ------------------------------------------------------------------ */
/*  Замена                                                             */
/* ------------------------------------------------------------------ */

test('замена: промах сужает допуск, три промаха — принудительная установка', () => {
  const { run } = newRun();
  teardownToDiagnose(run);
  run.probe('battery');
  run.confirmFault('battery');

  const first = run.placePart(200);
  assert.equal(first.ok, false);
  assert.ok(run.replace.tolerance < 30);

  run.placePart(200);
  const third = run.placePart(200);
  assert.equal(third.ok, true);
  assert.equal(third.forced, true);
  assert.equal(run.replace.placed, true);
});

test('замена: точная установка без штрафа', () => {
  const { run } = newRun();
  teardownToDiagnose(run);
  run.confirmFault('battery');
  const before = run.damage;
  const res = run.placePart(10);
  assert.equal(res.ok, true);
  assert.equal(run.damage, before);
  assert.equal(run.replace.attempts, 0);
});

test('включение: нельзя включить без детали и разъёма', () => {
  const { run } = newRun();
  teardownToDiagnose(run);
  run.confirmFault('battery');
  assert.equal(run.powerOn().code, 'NO_PART');
  run.placePart(5);
  assert.equal(run.powerOn().code, 'NOT_LOCKED');
  run.lockConnector();
  const res = run.powerOn();
  assert.equal(res.ok, true);
  assert.equal(run.stage, STAGE.DONE);
  assert.equal(res.summary.success, true);
});

test('итог: время, урон и порванный шлейф попадают в summary', () => {
  const c = clock(1000);
  const run = new RepairRun(makeOrder(), { now: c.now });
  c.tick(45_000);
  const summary = run.summary();
  assert.equal(summary.seconds, 45);
  assert.equal(summary.payout, 120);
  assert.equal(summary.tear, false);
});

test('урон 100% — заказ провален', () => {
  const run = new RepairRun(makeOrder(), { now: () => 0 });
  run.addDamage(100);
  assert.equal(run.summary().success, false);
});