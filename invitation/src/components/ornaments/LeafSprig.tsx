import { leafPath, stemPath } from "./paths";

interface Props {
  className?: string;
  /** Line-art in gold (hero) or filled green (body). */
  variant?: "gold" | "green";
  flip?: boolean;
  style?: React.CSSProperties;
}

/** Olive/ruscus branch with alternating lanceolate leaves. */
export function LeafSprig({ className, variant = "green", flip, style }: Props) {
  const leaves = [
    { x: 14, y: 6, len: 42, w: 14, a: -62 },
    { x: 32, y: 2, len: 40, w: 13, a: 48 },
    { x: 54, y: 0, len: 46, w: 15, a: -58 },
    { x: 78, y: -2, len: 44, w: 14, a: 44 },
    { x: 104, y: -3, len: 48, w: 15, a: -54 },
    { x: 130, y: -2, len: 42, w: 13, a: 40 },
    { x: 154, y: 0, len: 44, w: 14, a: -50 },
    { x: 176, y: 2, len: 38, w: 12, a: 36 },
    { x: 196, y: 3, len: 34, w: 11, a: -42 },
    { x: 212, y: 3, len: 30, w: 10, a: 10 },
  ];
  const stroke = variant === "gold" ? "var(--gold, #c4a46a)" : "var(--leaf, #4f6b52)";
  return (
    <svg
      viewBox="-10 -60 260 120"
      className={className}
      style={{ ...style, transform: flip ? "scaleX(-1)" : undefined }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="sprig-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--leaf-light, #8aa38c)" />
          <stop offset="100%" stopColor="var(--leaf, #4f6b52)" />
        </linearGradient>
      </defs>
      <path d={stemPath(230, -10)} fill="none" stroke={stroke} strokeWidth={variant === "gold" ? 0.9 : 1.2} strokeLinecap="round" />
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.a})`}>
          <path
            d={leafPath(l.len, l.w)}
            fill={variant === "gold" ? "none" : "url(#sprig-g)"}
            stroke={stroke}
            strokeWidth={variant === "gold" ? 0.8 : 0.4}
            opacity={variant === "gold" ? 0.9 : 1}
          />
          <path d={`M3 0 L${l.len - 4} 0`} stroke={variant === "gold" ? stroke : "rgba(255,255,255,0.35)"} strokeWidth={0.5} opacity={0.8} />
        </g>
      ))}
    </svg>
  );
}
