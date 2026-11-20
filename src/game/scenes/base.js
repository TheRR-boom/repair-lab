import Phaser from 'phaser';

/**
 * Базовая сцена: доступ к сохранению, layout и единый цикл «перерисовать всё».
 *
 * Вся вёрстка восстанавливается из состояния (save / modalKind / run),
 * поэтому поворот экрана и смена размера окна не ломают игру.
 */
export class BaseScene extends Phaser.Scene {
  /**
   * Единый геттер на layout: UI-кит (core/ui.js) обращается к `scene.layout`,
   * сцены — к `this.L`. Это один и тот же объект, поэтому масштаб всегда
   * совпадает и не зависит от того, кто рисует элемент.
   */
  get layout() {
    return this.registry.get('layout');
  }

  bootView() {
    this.L = this.layout;
    this.state = this.registry.get('save');
    this.store = this.registry.get('store');
    this.s = this.L.s;

    this._unsub = this.L.onChange(() => this.onLayout());
    this.events.once('shutdown', () => {
      if (this._unsub) this._unsub();
      this._unsub = null;
    });
  }

  /** Подстраховка на случай, если размер поменялся во время создания сцены. */
  onLayout() {
    if (!this.sys || !this.sys.isActive()) return;
    this.redraw();
  }

  /** Полная перерисовка сцены из состояния. */
  redraw() {
    this.s = this.L.s;
    if (this.modal) {
      this.modal.root.destroy(true);
      this.modal = null;
    }
    if (this.view) {
      this.view.destroy(true);
      this.view = null;
    }
    this.view = this.add.container(0, 0);
    this.root = this.view;
    this.build(this.view);
    if (this.modalKind) this.openModal(this.modalKind);
  }

  saveNow() {
    this.store.save(this.state);
  }
}