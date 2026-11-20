/**
 * Layout — единая точка правды про размер экрана, safe area и масштаб UI.
 *
 * Идея:
 *  1. canvas рендерится в физических пикселях (CSS px × devicePixelRatio),
 *     поэтому текст и линии остаются резкими на Retina-экранах;
 *  2. масштаб `s` подбирается так, чтобы «дизайнерская» сетка 390×844
 *     всегда целиком влезала в экран (при этом на планшетах UI становится
 *     крупнее физически, а не растягивается в мыло);
 *  3. дальше вся вёрстка живёт в дизайн-единицах: `dw × dh`,
 *     а на экран переводится через px().
 *
 * Safe area приходит из CSS (env(safe-area-inset-*)) — canvas уже лежит
 * внутри контейнера с отступами, поэтому сцене достаточно `dw × dh`.
 */

export const DESIGN_W = 390;
export const DESIGN_H = 844;

import Phaser from 'phaser';

export class Layout {
  constructor(game) {
    this.game = game;
    this.el = document.getElementById('game');

    this.s = 1; // масштаб: 1 дизайн-единица = s физических пикселей
    this.w = 0; // ширина canvas в физ. пикселях
    this.h = 0;
    this.dw = DESIGN_W; // ширина экрана в дизайн-единицах
    this.dh = DESIGN_H;
    this.dpr = 1;
    this.landscape = false;

    this._subs = new Set();
    this._timer = null;
    this._started = false;
  }

  get ready() {
    return this.w > 0 && this.h > 0;
  }

  /** Запуск: первый замер + подписка на изменения размера. */
  start() {
    if (this._started) return;
    this._started = true;
    this.refresh(true);
    // До READY ScaleManager может быть не готов — повторим после загрузки
    this.game.events.once(Phaser.Core.Events.READY, () => this.refresh(true));

    const onResize = () => this.schedule();
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize, { passive: true });
    }
    // Скролл-бар/панель браузера меняет высоту — ловим и это
    if (window.ResizeObserver && this.el) {
      this._ro = new ResizeObserver(onResize);
      this._ro.observe(this.el);
    }
  }

  /** Дебаунс: на мобильных resize прилетает пачками. */
  schedule() {
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.refresh(), 120);
  }

  /**
   * Пересчитать размеры. Возвращает true, если что-то реально изменилось.
   * @param {boolean} force
   */
  refresh(force = false) {
    const el = this.el;
    if (!el) return false;

    const cssW = el.clientWidth || window.innerWidth || DESIGN_W;
    const cssH = el.clientHeight || window.innerHeight || DESIGN_H;

    // DPR ограничиваем: 4K-буфер на дешёвом Android = просадка FPS.
    // 2.3 Мп — эмпирический потолок для стабильных 60 FPS на среднем железе.
    let dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const budget = 2_300_000;
    if (cssW * cssH * dpr * dpr > budget) {
      dpr = Math.max(1, Math.sqrt(budget / (cssW * cssH)));
      dpr = Math.min(dpr, 2.5);
    }

    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);

    const changed =
      force || w !== this.w || h !== this.h || Math.abs(dpr - this.dpr) > 0.01;
    if (!changed) return false;

    this.dpr = dpr;
    this.w = w;
    this.h = h;

    // Phaser: canvas в физических пикселях, CSS-размер = физический * zoom.
    // В режиме Scale.NONE это единственный способ получить Retina-резкость.
    this.game.scale.zoom = 1 / dpr;
    this.game.scale.resize(w, h);

    this.s = Math.min(w / DESIGN_W, h / DESIGN_H);
    this.dw = w / this.s;
    this.dh = h / this.s;
    this.landscape = w > h * 1.12;
    // На планшетах не растягиваем контент на всю ширину: строка текста
    // длиннее ~520 дизайн-единиц читается плохо и выглядит «водянисто».
    this.contentW = Math.min(this.dw - 32, 520);

    this._emit();
    return true;
  }

  _emit() {
    for (const fn of this._subs) {
      try {
        fn(this);
      } catch (err) {
        console.error('[layout] subscriber failed', err);
      }
    }
  }

  /** Подписка на изменение размера. Возвращает функцию отписки. */
  onChange(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  /** Дизайн-единицы → физические пиксели. */
  px(v) {
    return v * this.s;
  }

  /** Округлённый размер шрифта (дробные px дают мыло). */
  font(v) {
    return Math.max(8, Math.round(v * this.s));
  }
}