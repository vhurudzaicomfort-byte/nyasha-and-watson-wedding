"use client";

import { useEffect, useRef } from "react";

/** Fire a celebration: `celebrate()` from anywhere, or dispatch the event. */
export const CELEBRATE_EVENT = "eguest:celebrate";
export function celebrate(origin?: { x: number; y: number }) {
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail: origin }));
}

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  life: number;
  color: string;
  w: number;
  h: number;
}

/**
 * Full-screen canvas that scatters soft petals in the palette colours.
 * Mounted once; idle (no RAF loop) until a celebration is requested.
 */
export function PetalCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let petals: Petal[] = [];
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = () => {
      const cs = getComputedStyle(document.documentElement);
      const pick = (v: string, fb: string) => cs.getPropertyValue(v).trim() || fb;
      return [pick("--peach", "#f0b48e"), pick("--gold-light", "#e6d3a3"), pick("--mauve-light", "#b995a8"), "#fbf6ec", pick("--accent", "#8c6a7f")];
    };

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      petals = petals.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of petals) {
        p.vy += 0.06;
        p.vx += Math.sin(p.life / 9 + p.rot) * 0.02;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w, p.h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      if (petals.length) raf = requestAnimationFrame(tick);
      else {
        raf = 0;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    const onCelebrate = (e: Event) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const origin = (e as CustomEvent<{ x: number; y: number } | undefined>).detail;
      const cx = origin?.x ?? window.innerWidth / 2;
      const cy = origin?.y ?? window.innerHeight * 0.35;
      const palette = colors();
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 6;
        petals.push({
          x: cx,
          y: cy,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 3,
          r: 0,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.2,
          life: 140 + Math.random() * 60,
          color: palette[i % palette.length],
          w: 3 + Math.random() * 4,
          h: 5 + Math.random() * 6,
        });
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener(CELEBRATE_EVENT, onCelebrate);
    return () => {
      window.removeEventListener(CELEBRATE_EVENT, onCelebrate);
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 45 }}
    />
  );
}
