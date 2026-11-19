/**
 * Экономика и прогрессия. Чистые функции — ни Phaser, ни DOM,
 * поэтому покрываются unit-тестами (tests/logic.test.js).
 */

import { BALANCE } from '../data/content.js';

export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/** Уровень по опыту: { level, into, need, progress 0..1, maxed } */
export function levelInfo(xp) {
  const table = BALANCE.xpLevels;
  let level = 1;
  for (let i = 0; i < table.length; i++) {
    if (xp >= table[i]) level = i + 1;
  }
  const maxed = level >= table.length;
  const base = table[level - 1] ?? 0;
  const next = maxed ? base : table[level];
  const need = Math.max(1, next - base);
  const into = maxed ? need : xp - base;
  return { level, into, need, progress: clamp(into / need, 0, 1), maxed };
}

/**
 * Итог заказа.
 * @param {object} state  сохранение (money/rep/xp/tools)
 * @param {object} report summary() из RepairRun
 * @returns {{money:number, repDelta:number, xpGain:number, success:boolean, lines:Array, levelUp:boolean, level:number}}
 */
export function settle(state, report) {
  const success = report.success && report.damage < BALANCE.damageLimit;
  const base = report.payout;

  const lampBonus = state.tools.includes('lamp') ? Math.round(base * 0.1) : 0;
  const timeBonus =
    success && report.seconds <= report.targetSeconds
      ? Math.round(base * BALANCE.timeBonus)
      : 0;

  const extraProbes = Math.max(0, report.probes - BALANCE.freeProbes);
  const probePenalty = extraProbes * BALANCE.probePenalty;
  const hintPenalty = report.hints * BALANCE.hintPenalty;
  const damagePenalty = success
    ? Math.round(base * Math.min(BALANCE.maxDamagePenalty, report.damage / 250))
    : 0;
  const tearPenalty = report.tear ? 30 : 0;

  const gross = base + timeBonus + lampBonus - damagePenalty - probePenalty - hintPenalty - tearPenalty;
  // Запчасть уже оплачена при приёме заказа, но при провале она «сгорает»
  const money = success ? Math.max(0, gross) : -report.partCost;

  const lines = [];
  lines.push({ label: 'Оплата заказа', amount: base });
  if (lampBonus) lines.push({ label: 'Лампа 5000K', amount: lampBonus });
  if (timeBonus) lines.push({ label: 'Бонус за скорость', amount: timeBonus });
  if (damagePenalty) lines.push({ label: 'Повреждения', amount: -damagePenalty });
  if (probePenalty) lines.push({ label: 'Лишние замеры', amount: -probePenalty });
  if (hintPenalty) lines.push({ label: 'Подсказки', amount: -hintPenalty });
  if (tearPenalty) lines.push({ label: 'Порванный шлейф', amount: -tearPenalty });
  if (!success) lines.push({ label: 'Провал · запчасть', amount: -report.partCost });

  const damage = report.damage;
  let repDelta = 0;
  if (success) {
    repDelta = damage <= 10 ? 3 : damage <= 35 ? 2 : 1;
    if (report.tear) repDelta -= 2;
  } else {
    repDelta = -3;
  }

  const xpGain = success ? 20 + Math.round(base / 8) + (damage <= 10 ? 10 : 0) : 5;

  return {
    money,
    repDelta,
    xpGain,
    success,
    lines,
    levelUp: false,
    level: levelInfo(state.xp).level,
  };
}

/**
 * Применяет итог к сохранению (мутирует и возвращает его же + флаги).
 */
export function applyReport(state, report) {
  const result = settle(state, report);
  const beforeLevel = levelInfo(state.xp).level;

  state.money = Math.max(0, state.money + result.money);
  state.rep = clamp(state.rep + result.repDelta, 0, BALANCE.maxRep);
  state.xp += result.xpGain;

  const info = levelInfo(state.xp);
  state.level = info.level;
  result.levelUp = info.level > beforeLevel;
  result.level = info.level;

  state.stats.orders += 1;
  if (!result.success) state.stats.failed += 1;
  if (report.tear) state.stats.tears += 1;
  state.stats.earned = Math.max(0, state.stats.earned + Math.max(0, result.money));

  return result;
}

/** Можно ли купить инструмент. */
export function canBuyTool(state, tool) {
  return !!tool && tool.price > 0 && !state.tools.includes(tool.id) && state.money >= tool.price;
}

/** Покупка инструмента. Возвращает true при успехе. */
export function buyTool(state, tool) {
  if (!canBuyTool(state, tool)) return false;
  state.money -= tool.price;
  state.tools.push(tool.id);
  return true;
}

/** Покупка запчасти на склад. */
export function buyPart(state, part, amount = 1) {
  const cost = part.price * amount;
  if (state.money < cost) return false;
  state.money -= cost;
  state.parts[part.id] = (state.parts[part.id] || 0) + amount;
  return true;
}