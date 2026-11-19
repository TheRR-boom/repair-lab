/**
 * Сохранение прогресса: localStorage + автодебаунс + защита от «мусора».
 *
 * Кнопки «Сохранить» в игре нет: пишем на каждое изменение (debounce 250 мс)
 * и принудительно — при уходе приложения в фон (pagehide / visibilitychange).
 * В Capacitor localStorage живёт в WebView и сохраняется между запусками.
 */

import { BALANCE, PARTS, TOOLS } from '../data/content.js';
import { levelInfo } from './economy.js';

export const SAVE_KEY = 'repairlab.save.v1';
export const SAVE_VERSION = 1;

export function defaultSave() {
  return {
    v: SAVE_VERSION,
    money: BALANCE.startMoney,
    rep: BALANCE.startRep,
    xp: 0,
    level: 1,
    tools: Object.values(TOOLS)
      .filter((t) => t.start)
      .map((t) => t.id),
    parts: { screen: 1, battery: 1, port: 0, camera: 0 },
    stats: { orders: 0, failed: 0, earned: 0, tears: 0 },
    settings: { sound: true, haptics: true },
    createdAt: Date.now(),
    playSeconds: 0,
  };
}

/** Приводит любой внешний объект к валидному сохранению. */
export function sanitizeSave(raw) {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;

  const out = { ...base };
  out.v = SAVE_VERSION;

  const num = (v, def, min = 0, max = 1e9) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
  };

  out.money = Math.round(num(raw.money, base.money, 0, 1e7));
  out.rep = Math.round(num(raw.rep, base.rep, 0, BALANCE.maxRep));
  out.xp = Math.round(num(raw.xp, 0, 0, 1e7));
  out.level = levelInfo(out.xp).level;

  const tools = Array.isArray(raw.tools) ? raw.tools.filter((id) => !!TOOLS[id]) : [];
  for (const tool of Object.values(TOOLS)) {
    if (tool.start && !tools.includes(tool.id)) tools.push(tool.id);
  }
  out.tools = Array.from(new Set(tools));

  out.parts = { ...base.parts };
  if (raw.parts && typeof raw.parts === 'object') {
    for (const id of Object.keys(PARTS)) {
      const n = Math.round(Number(raw.parts[id]));
      out.parts[id] = Number.isFinite(n) && n > 0 ? Math.min(99, n) : 0;
    }
  }

  out.stats = { ...base.stats, ...(raw.stats || {}) };
  out.settings = { ...base.settings, ...(raw.settings || {}) };
  out.settings.sound = out.settings.sound !== false;
  out.settings.haptics = out.settings.haptics !== false;
  out.createdAt = num(raw.createdAt, base.createdAt);
  out.playSeconds = Math.round(num(raw.playSeconds, 0));

  return out;
}

export class SaveStore {
  constructor(storage) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    this._timer = null;
    this._pending = null;
  }

  load() {
    if (!this.storage) return defaultSave();
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return sanitizeSave(JSON.parse(raw));
    } catch (err) {
      console.warn('[save] повреждённое сохранение, начинаем заново', err);
      return defaultSave();
    }
  }

  /** Отложенная запись — не душим localStorage каждый кадр. */
  save(state) {
    this._pending = state;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this._timer);
    this._timer = null;
    if (!this._pending || !this.storage) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this._pending));
    } catch (err) {
      console.warn('[save] не удалось записать прогресс', err);
    }
    this._pending = null;
  }

  reset() {
    this._pending = null;
    if (this.storage) this.storage.removeItem(SAVE_KEY);
  }
}