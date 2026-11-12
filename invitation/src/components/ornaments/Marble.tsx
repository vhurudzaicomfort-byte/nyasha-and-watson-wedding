/**
 * Soft marble veining built from SVG turbulence – no bitmap needed.
 * Place inside a `position: relative` container; it fills and sits behind.
 */
export function Marble({ className, opacity = 0.18, seed = 3 }: { className?: string; opacity?: number; seed?: number }) {
  const id = `marble-${seed}`;
  return (
    <svg className={className} aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice" style={{ opacity }}>
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.0022 0.0045" numOctaves={2} seed={seed} result="noise" />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0.62
                    0 0 0 0 0.54
                    0 0 0 0 0.58
                    0 0 0 6 -2.9"
            result="veins"
          />
          <feGaussianBlur in="veins" stdDeviation="2.2" />
        </filter>
      </defs>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}
