import Phaser from 'phaser';
import { GAME_CONFIG } from './game/config.js';
import { Layout } from './game/core/layout.js';
import { SaveStore } from './game/systems/save.js';
import { audio } from './game/core/audio.js';

/**
 * Точка входа. Здесь только инфраструктура:
 *  - canvas и адаптивный layout;
 *  - загрузка прогресса (до первой сцены, чтобы не мигало);
 *  - автозвук/вибрация по настройкам;
 *  - принудительный flush сохранения при уходе в фон.
 */

const game = new Phaser.Game(GAME_CONFIG);
const layout = new Layout(game);
const store = new SaveStore();
const save = store.load();

audio.setEnabled(save.settings.sound);
audio.setHaptics(save.settings.haptics);

game.registry.set('layout', layout);
game.registry.set('save', save);
game.registry.set('store', store);

// Разблокировка аудио: iOS/Android включают звук только после жеста
const unlockAudio = () => {
  audio.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('touchstart', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('touchstart', unlockAudio, { passive: true });

// Прогресс не теряется при сворачивании приложения
window.addEventListener('pagehide', () => store.flush());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) store.flush();
});

// Layout запускается сразу: размер canvas нужен ещё до первого кадра.
// Внутри он сам пересчитается на событии READY, когда ScaleManager готов.
layout.start();

// Для отладки в консоли браузера
window.__REPAIR_LAB__ = { game, layout, store };