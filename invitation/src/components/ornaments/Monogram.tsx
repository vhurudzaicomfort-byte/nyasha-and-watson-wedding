interface Props {
  initials: [string, string];
  size?: number;
  className?: string;
  /** "seal" = wax seal look, "line" = fine gold line crest */
  variant?: "seal" | "line";
}

/** Circular crest with the couple's initials and a laurel ring. */
export function Monogram({ initials, size = 96, className, variant = "line" }: Props) {
  const r = 46;
  const leaves = 14;
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`mono-wax-${variant}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#b08a9f" />
          <stop offset="55%" stopColor="#7a5469" />
          <stop offset="100%" stopColor="#4a2e3f" />
        </radialGradient>
        <linearGradient id={`mono-gold-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6d3a3" />
          <stop offset="50%" stopColor="#c4a46a" />
          <stop offset="100%" stopColor="#9c7e46" />
        </linearGradient>
      </defs>
      {variant === "seal" && (
        <>
          <path
            d="M0 -47 C14 -47 24 -44 32 -36 C42 -28 47 -15 46 -2 C46 12 42 26 32 35 C22 44 10 48 -2 47 C-16 46 -29 41 -37 31 C-45 21 -48 8 -46 -6 C-44 -20 -37 -33 -26 -40 C-18 -45 -9 -47 0 -47Z"
            fill={`url(#mono-wax-${variant})`}
          />
          <path d="M0 -47 C14 -47 24 -44 32 -36" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeLinecap="round" />
        </>
      )}
      <circle r={r - (variant === "seal" ? 10 : 0)} fill="none" stroke={variant === "seal" ? "rgba(255,240,220,0.55)" : `url(#mono-gold-${variant})`} strokeWidth={variant === "seal" ? 0.8 : 1} />
      {variant === "line" && <circle r={r - 4} fill="none" stroke={`url(#mono-gold-${variant})`} strokeWidth={0.5} opacity={0.7} />}
      <g fill={variant === "seal" ? "rgba(255,240,220,0.7)" : `url(#mono-gold-${variant})`}>
        {Array.from({ length: leaves }, (_, i) => {
          const a = (i / leaves) * Math.PI * 2;
          const rr = r - (variant === "seal" ? 15 : 7);
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          const deg = (a * 180) / Math.PI + 90;
          return <path key={i} d="M0 0 C-2 -2.5 -2 -6 0 -8 C2 -6 2 -2.5 0 0Z" transform={`translate(${x} ${y}) rotate(${deg})`} />;
        })}
      </g>
      <text
        x="0"
        y="7"
        textAnchor="middle"
        fontFamily="var(--font-script), cursive"
        fontSize="26"
        fill={variant === "seal" ? "#f6e8d6" : `url(#mono-gold-${variant})`}
      >
        {initials[0]}
        <tspan fontFamily="var(--font-display), serif" fontSize="12" dy="-2" fill={variant === "seal" ? "#f6e8d6" : "#c4a46a"}>
          {" & "}
        </tspan>
        <tspan dy="2">{initials[1]}</tspan>
      </text>
    </svg>
  );
}
