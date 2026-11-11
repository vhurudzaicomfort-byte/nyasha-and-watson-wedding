/**
 * Procedural botanical path generators. Everything is drawn from code so the
 * invitation ships zero bitmap artwork, scales crisply at any size and stays
 * on-palette through CSS variables.
 */

const f = (n: number) => Number(n.toFixed(2));

/** Deterministic pseudo-random (mulberry32) so renders are stable across SSR/CSR. */
export function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A simple lanceolate leaf centred at origin pointing +x, length `len`. */
export function leafPath(len: number, width: number, curve = 0.35): string {
  const w = width / 2;
  const c = len * curve;
  return `M0 0 C${f(c)} ${f(-w)}, ${f(len - c)} ${f(-w * 0.9)}, ${f(len)} 0 C${f(len - c)} ${f(w * 0.9)}, ${f(c)} ${f(w)}, 0 0 Z`;
}

/** A broader rounded leaf (rose foliage), pointing +x. */
export function roundLeafPath(len: number, width: number): string {
  const w = width / 2;
  return `M0 0 C${f(len * 0.1)} ${f(-w * 1.1)}, ${f(len * 0.75)} ${f(-w * 1.05)}, ${f(len)} 0 C${f(len * 0.75)} ${f(w * 1.05)}, ${f(len * 0.1)} ${f(w * 1.1)}, 0 0 Z`;
}

/** Spiral used for a rose heart. */
export function spiralPath(turns: number, maxR: number, steps = 60): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2;
    const r = (i / steps) * maxR;
    const x = Math.cos(t) * r;
    const y = Math.sin(t) * r * 0.85;
    pts.push(`${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`);
  }
  return pts.join(" ");
}

/** Petal shape for a rose, pointing +y (down), base at origin. */
export function petalPath(len: number, width: number): string {
  const w = width / 2;
  return `M0 0 C${f(-w)} ${f(len * 0.15)}, ${f(-w * 1.1)} ${f(len * 0.75)}, 0 ${f(len)} C${f(w * 1.1)} ${f(len * 0.75)}, ${f(w)} ${f(len * 0.15)}, 0 0 Z`;
}

/** Gentle stem curve from (0,0) to (len, 0) with a bow of `bow`. */
export function stemPath(len: number, bow: number): string {
  return `M0 0 Q${f(len / 2)} ${f(bow)} ${f(len)} 0`;
}

/** Symmetric calligraphic flourish, width w, centred at origin. */
export function flourishPath(w: number): string {
  const h = w * 0.14;
  const half = w / 2;
  const side = (dir: 1 | -1) =>
    `M0 0 C${f(dir * half * 0.18)} ${f(-h * 0.9)}, ${f(dir * half * 0.42)} ${f(-h * 0.9)}, ${f(dir * half * 0.55)} 0 ` +
    `C${f(dir * half * 0.65)} ${f(h * 0.7)}, ${f(dir * half * 0.86)} ${f(h * 0.5)}, ${f(dir * half)} ${f(-h * 0.1)} ` +
    `M${f(dir * half * 0.55)} 0 C${f(dir * half * 0.48)} ${f(h * 0.55)}, ${f(dir * half * 0.3)} ${f(h * 0.65)}, ${f(dir * half * 0.22)} ${f(h * 0.35)}`;
  return `${side(1)} ${side(-1)}`;
}

/** Ornate plaque outline (cartouche) for section labels. */
export function cartouchePath(w: number, h: number, inset = 0): string {
  const x = inset;
  const y = inset;
  const W = w - inset * 2;
  const H = h - inset * 2;
  const n = Math.min(H * 0.28, 14); // corner notch size
  const b = H * 0.5; // mid bulge
  return [
    `M${f(x + n * 1.6)} ${f(y)}`,
    `H${f(x + W - n * 1.6)}`,
    `C${f(x + W - n * 0.5)} ${f(y)}, ${f(x + W - n * 0.2)} ${f(y + n * 0.2)}, ${f(x + W)} ${f(y + n)}`,
    `C${f(x + W - n * 0.2)} ${f(y + n * 1.3)}, ${f(x + W - n * 0.5)} ${f(y + H / 2 - b * 0.4)}, ${f(x + W - n * 0.1)} ${f(y + H / 2)}`,
    `C${f(x + W - n * 0.5)} ${f(y + H / 2 + b * 0.4)}, ${f(x + W - n * 0.2)} ${f(y + H - n * 1.3)}, ${f(x + W)} ${f(y + H - n)}`,
    `C${f(x + W - n * 0.2)} ${f(y + H - n * 0.2)}, ${f(x + W - n * 0.5)} ${f(y + H)}, ${f(x + W - n * 1.6)} ${f(y + H)}`,
    `H${f(x + n * 1.6)}`,
    `C${f(x + n * 0.5)} ${f(y + H)}, ${f(x + n * 0.2)} ${f(y + H - n * 0.2)}, ${f(x)} ${f(y + H - n)}`,
    `C${f(x + n * 0.2)} ${f(y + H - n * 1.3)}, ${f(x + n * 0.5)} ${f(y + H / 2 + b * 0.4)}, ${f(x + n * 0.1)} ${f(y + H / 2)}`,
    `C${f(x + n * 0.5)} ${f(y + H / 2 - b * 0.4)}, ${f(x + n * 0.2)} ${f(y + n * 1.3)}, ${f(x)} ${f(y + n)}`,
    `C${f(x + n * 0.2)} ${f(y + n * 0.2)}, ${f(x + n * 0.5)} ${f(y)}, ${f(x + n * 1.6)} ${f(y)}`,
    "Z",
  ].join(" ");
}
