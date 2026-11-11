import { flourishPath } from "./paths";

interface Props {
  className?: string;
  color?: string;
  width?: number;
}

/** Calligraphic divider with a central diamond. */
export function Flourish({ className, color = "currentColor", width = 220 }: Props) {
  const h = width * 0.2;
  return (
    <svg
      viewBox={`${-width / 2 - 4} ${-h / 2} ${width + 8} ${h}`}
      className={className}
      style={{ width, height: h, color }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={flourishPath(width)} fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" />
      <path d={`M0 ${-h * 0.18} L${h * 0.18} 0 L0 ${h * 0.18} L${-h * 0.18} 0 Z`} fill="currentColor" />
      <circle cx={width / 2} cy={-h * 0.03} r={1.4} fill="currentColor" />
      <circle cx={-width / 2} cy={-h * 0.03} r={1.4} fill="currentColor" />
    </svg>
  );
}
