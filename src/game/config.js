import Phaser from 'phaser';
import { BootScene } from './scenes/boot.js';
import { MenuScene } from './scenes/menu.js';
import { OrdersScene } from './scenes/orders.js';
import { RepairScene } from './scenes/repair.js';

/**
 * Конфигурация Phaser.
 *
 * Scale.NONE + ручной resize (layout.js) — единственный способ держать
 * canvas в физических пикселях и получить резкий текст на Retina.
 * Портретная ориентация: ширина 390, высота 844 (референс iPhone 12/13).
 */
export const GAME_CONFIG = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0f14',
  scale: {
    mode: Phaser.Scale.NONE,
    width: 390,
    height: 844,
    autoRound: false,
  },
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  input: {
    activePointers: 2, // два пальца: пинч-зум платы
  },
  audio: {
    noAudio: true, // звук синтезируем сами (core/audio.js)
  },
  banner: false,
  scene: [BootScene, MenuScene, OrdersScene, RepairScene],
};