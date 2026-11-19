import Phaser from 'phaser';
import { buildAtlas } from '../core/atlas.js';
import { audio } from '../core/audio.js';

/**
 * BootScene: собирает атлас, поднимает сохранение, убирает HTML-заставку.
 * Ассетов на диске нет — всё рисуется в рантайме, поэтому грузиться нечего
 * и сцена не показывает прогресс-бар (он бы мигал на 1 кадр).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    const layout = this.registry.get('layout');
    layout.refresh(true);

    buildAtlas(this);

    const save = this.registry.get('save');
    audio.setEnabled(save.settings.sound);
    audio.setHaptics(save.settings.haptics);

    this.scene.start('Menu');

    // Убираем статичную HTML-заставку, когда первая сцена уже отрисована
    const splash = document.getElementById('boot-splash');
    if (splash) {
      setTimeout(() => splash.classList.add('hidden'), 60);
      setTimeout(() => splash.remove(), 700);
    }
  }
}