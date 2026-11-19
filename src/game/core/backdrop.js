/**
 * Фон: градиент + сетка + мягкое свечение. Рисуется один раз на перерисовку
 * (не в update), поэтому стоит почти ничего.
 */
export function backdrop(scene, root, opts = {}) {
  const L = scene.layout || scene.L;
  const s = L.s;

  const g = scene.add.graphics();
  const top = opts.top ?? 0x101a24;
  const bottom = opts.bottom ?? 0x070b10;
  g.fillGradientStyle(top, top, bottom, bottom, 1);
  g.fillRect(0, 0, L.w, L.h);

  g.lineStyle(Math.max(1, s), 0x2a3646, 0.22);
  const step = 52 * s;
  const offset = ((L.h * 0.12) % step) - step;
  for (let x = 0; x < L.w + step; x += step) g.lineBetween(x, 0, x, L.h);
  for (let y = offset; y < L.h + step; y += step) g.lineBetween(0, y, L.w, y);

  const glow = scene.add.graphics();
  glow.fillStyle(opts.glow ?? 0x38e8a0, 0.055);
  glow.fillCircle(L.w * 0.5, L.h * 0.16, L.w * 0.62);
  glow.fillStyle(0x4aa8ff, 0.035);
  glow.fillCircle(L.w * 0.15, L.h * 0.85, L.w * 0.5);

  root.add([g, glow]);
  return g;
}