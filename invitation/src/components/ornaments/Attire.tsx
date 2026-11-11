/**
 * Fashion-croquis style attire illustrations – a photograph-free stand-in for
 * the gown and tuxedo inspiration photos of the original design. Gowns are
 * filled with the invitation's own palette so they always match the swatches.
 */

interface GownProps {
  colour: string;
  /** Silhouette variant mirrors the four reference gowns. */
  style: "oneShoulder" | "boatNeck" | "cowlRuffle" | "bellSleeve";
  id: string;
}

const INK = "rgba(60, 44, 52, 0.55)";

function Figure({ children }: { children: React.ReactNode }) {
  // Faint croquis: head, neck, shoulders, arms.
  return (
    <g>
      <circle cx="30" cy="11" r="7.5" fill="none" stroke={INK} strokeWidth="0.7" />
      <path d="M27.5 18.5 Q30 22 32.5 18.5" fill="none" stroke={INK} strokeWidth="0.7" />
      <path d="M30 18 L30 23" stroke={INK} strokeWidth="0.7" />
      {children}
    </g>
  );
}

function Sheen({ id, colour }: { id: string; colour: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-satin`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor={colour} stopOpacity="0.92" />
        <stop offset="38%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="52%" stopColor={colour} />
        <stop offset="100%" stopColor={colour} stopOpacity="0.8" />
      </linearGradient>
      <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
      </linearGradient>
    </defs>
  );
}

const GOWN =
  "M22 30 C20 44, 24 58, 23 72 C21 86, 17 96, 18 112 C19 132, 22 146, 22 158 C22 178, 10 188, 6 198 L54 198 C50 188, 38 178, 38 158 C38 146, 41 132, 42 112 C43 96, 39 86, 37 72 C36 58, 40 44, 38 30 Z";

export function Gown({ colour, style, id }: GownProps) {
  return (
    <svg viewBox="0 0 60 200" aria-hidden="true" focusable="false">
      <Sheen id={id} colour={colour} />
      <Figure>
        {/* arms */}
        <path d="M22 32 C16 50, 15 70, 17 92" fill="none" stroke={INK} strokeWidth="0.7" />
        <path d="M38 32 C44 50, 45 70, 43 92" fill="none" stroke={INK} strokeWidth="0.7" />
        {/* gown */}
        <path d={GOWN} fill={colour} />
        <path d={GOWN} fill={`url(#${id}-satin)`} opacity="0.75" />
        <path d={GOWN} fill={`url(#${id}-shade)`} />
        {/* neckline variants */}
        {style === "oneShoulder" && (
          <>
            <path d="M22 30 L38 36 L38 30 Z" fill="var(--ivory, #f7f2e9)" opacity="0.9" />
            <path d="M20 29 L24 26 L26 31" fill={colour} />
            {/* cape drape */}
            <path d="M21 30 C14 60, 10 110, 9 170 C13 160, 17 150, 20 140 C19 100, 20 60, 23 32 Z" fill={colour} opacity="0.85" />
          </>
        )}
        {style === "boatNeck" && <path d="M21 30 Q30 33 39 30 L38 27 Q30 30 22 27 Z" fill="var(--ivory, #f7f2e9)" opacity="0.9" />}
        {style === "cowlRuffle" && (
          <>
            <path d="M22 30 Q30 42 38 30 Z" fill="var(--ivory, #f7f2e9)" opacity="0.9" />
            <path d="M24 23 L25 31 M36 23 L35 31" stroke={colour} strokeWidth="0.8" />
            <path d="M36 110 C30 130, 44 150, 34 170 C44 182, 30 190, 42 198 L54 198 C50 188, 38 178, 38 158 C38 140, 41 128, 42 112 Z" fill="#fff" opacity="0.22" />
            <path d="M36 112 C30 132, 44 150, 34 170 C42 182, 32 190, 40 198" fill="none" stroke="#fff" strokeWidth="0.9" opacity="0.6" />
          </>
        )}
        {style === "bellSleeve" && (
          <>
            <path d="M22 30 Q30 40 38 30 Z" fill="var(--ivory, #f7f2e9)" opacity="0.9" />
            <path d="M22 31 C14 50, 12 75, 8 100 L24 100 C22 80, 23 55, 24 36 Z" fill={colour} opacity="0.9" />
            <path d="M38 31 C46 50, 48 75, 52 100 L36 100 C38 80, 37 55, 36 36 Z" fill={colour} opacity="0.9" />
          </>
        )}
        {/* waist seam */}
        <path d="M23 72 Q30 75 37 72" fill="none" stroke="#000" strokeWidth="0.5" opacity="0.15" />
      </Figure>
    </svg>
  );
}

export function Tuxedo({ id }: { id: string }) {
  const black = "#17131a";
  return (
    <svg viewBox="0 0 60 200" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-tux`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a2430" />
          <stop offset="50%" stopColor={black} />
          <stop offset="100%" stopColor="#2a2430" />
        </linearGradient>
      </defs>
      <Figure>
        {/* shirt */}
        <path d="M24 28 L30 60 L36 28 Z" fill="#fbf8f2" />
        {/* jacket */}
        <path d="M24 28 C16 32, 14 50, 15 96 L28 96 L30 70 L32 96 L45 96 C46 50, 44 32, 36 28 L30 62 Z" fill={`url(#${id}-tux)`} />
        {/* lapels (satin) */}
        <path d="M24 28 L30 62 L26 44 L22 36 Z" fill="#000" opacity="0.6" />
        <path d="M36 28 L30 62 L34 44 L38 36 Z" fill="#000" opacity="0.6" />
        <path d="M24 28 L30 62 L26 44 L22 36 Z M36 28 L30 62 L34 44 L38 36 Z" fill="none" stroke="#6a6070" strokeWidth="0.4" />
        {/* bow tie */}
        <path d="M27 27 L30 28.6 L33 27 L33 31 L30 29.4 L27 31 Z" fill={black} />
        {/* buttons */}
        <circle cx="30" cy="68" r="0.9" fill="#8a8090" />
        {/* trousers */}
        <path d="M16 96 L14 196 L27 196 L30 120 L33 196 L46 196 L44 96 Z" fill={black} />
        <path d="M30 96 L30 120" stroke="#2a2430" strokeWidth="0.6" />
        {/* sleeves / arms */}
        <path d="M16 36 C11 56, 10 78, 12 98 L18 98 C16 78, 17 58, 20 38 Z" fill="#1f1a24" />
        <path d="M44 36 C49 56, 50 78, 48 98 L42 98 C44 78, 43 58, 40 38 Z" fill="#1f1a24" />
        <path d="M12 98 Q15 100 18 98 M42 98 Q45 100 48 98" fill="none" stroke="#fbf8f2" strokeWidth="1.2" />
        {/* shoes */}
        <path d="M14 196 L12 199 L27 199 L27 196 Z M33 196 L33 199 L48 199 L46 196 Z" fill="#0b090c" />
      </Figure>
    </svg>
  );
}
