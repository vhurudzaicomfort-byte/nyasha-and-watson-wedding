import { petalPath, roundLeafPath, spiralPath } from "./paths";

interface RoseProps {
  cx: number;
  cy: number;
  r: number;
  rotate?: number;
  /** "ivory" (white rose) or "blush" (peach-tinted) */
  tone?: "ivory" | "blush";
  id: string;
}

/**
 * A layered garden rose: two rings of petals around a spiral heart.
 * Drawn inside a parent <svg>; expects gradients from <RoseDefs/>.
 */
export function Rose({ cx, cy, r, rotate = 0, tone = "ivory", id }: RoseProps) {
  const outer = 7;
  const inner = 5;
  const fill = tone === "ivory" ? `url(#${id}-ivory)` : `url(#${id}-blush)`;
  const stroke = tone === "ivory" ? "#d6c6a6" : "#e0b094";
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rotate})`}>
      {Array.from({ length: outer }, (_, i) => (
        <path
          key={`o${i}`}
          d={petalPath(r, r * 0.78)}
          transform={`rotate(${(360 / outer) * i + 12}) translate(0 ${-r * 0.08})`}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      ))}
      {Array.from({ length: inner }, (_, i) => (
        <path
          key={`i${i}`}
          d={petalPath(r * 0.68, r * 0.62)}
          transform={`rotate(${(360 / inner) * i - 20}) translate(0 ${-r * 0.04})`}
          fill={fill}
          stroke={stroke}
          strokeWidth={0.6}
          strokeLinejoin="round"
        />
      ))}
      <circle r={r * 0.34} fill={fill} stroke={stroke} strokeWidth={0.5} />
      <path
        d={spiralPath(2.4, r * 0.3)}
        fill="none"
        stroke={tone === "ivory" ? "#c9b58e" : "#d59d7c"}
        strokeWidth={0.7}
        strokeLinecap="round"
      />
    </g>
  );
}

export function RoseDefs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-ivory`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#fffdf8" />
        <stop offset="70%" stopColor="#f6eee0" />
        <stop offset="100%" stopColor="#e9dcc2" />
      </radialGradient>
      <radialGradient id={`${id}-blush`} cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="#fdf1e8" />
        <stop offset="70%" stopColor="#f6d6c0" />
        <stop offset="100%" stopColor="#ecb996" />
      </radialGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--leaf-light, #8aa38c)" />
        <stop offset="100%" stopColor="var(--leaf, #4f6b52)" />
      </linearGradient>
      <linearGradient id={`${id}-leafDark`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--leaf, #4f6b52)" />
        <stop offset="100%" stopColor="#2f4634" />
      </linearGradient>
    </defs>
  );
}

interface LeafProps {
  x: number;
  y: number;
  len: number;
  width: number;
  angle: number;
  id: string;
  dark?: boolean;
  round?: boolean;
}

export function Leaf({ x, y, len, width, angle, id, dark, round }: LeafProps) {
  const d = round ? roundLeafPath(len, width) : `M0 0 C${len * 0.3} ${-width / 2}, ${len * 0.7} ${-width / 2}, ${len} 0 C${len * 0.7} ${width / 2}, ${len * 0.3} ${width / 2}, 0 0 Z`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={d} fill={`url(#${id}-${dark ? "leafDark" : "leaf"})`} />
      <path d={`M${len * 0.08} 0 L${len * 0.92} 0`} stroke="rgba(255,255,255,0.35)" strokeWidth={0.6} />
      {[0.3, 0.5, 0.7].map((t) => (
        <path
          key={t}
          d={`M${len * t} 0 l${len * 0.12} ${-width * 0.22} M${len * t} 0 l${len * 0.12} ${width * 0.22}`}
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={0.5}
          fill="none"
        />
      ))}
    </g>
  );
}
