import { cartouchePath } from "./paths";
import styles from "./Cartouche.module.css";

interface Props {
  children: React.ReactNode;
  className?: string;
  as?: "h2" | "h3" | "div";
  id?: string;
}

/**
 * Gold-lined plaque used for section titles ("RSVP", "Gifts", "Dress code"),
 * a direct evolution of the badge in the original design.
 */
export function Cartouche({ children, className, as: Tag = "h2", id }: Props) {
  const w = 300;
  const h = 84;
  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className={styles.frame} aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cartouche-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--gold-deep, #9c7e46)" />
            <stop offset="45%" stopColor="var(--gold-light, #e6d3a3)" />
            <stop offset="100%" stopColor="var(--gold-deep, #9c7e46)" />
          </linearGradient>
        </defs>
        <path d={cartouchePath(w, h, 2)} fill="rgba(255,252,246,0.85)" stroke="url(#cartouche-gold)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
        <path d={cartouchePath(w, h, 7)} fill="none" stroke="url(#cartouche-gold)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" opacity={0.9} />
        <path d={cartouchePath(w, h, 11)} fill="none" stroke="url(#cartouche-gold)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" opacity={0.6} />
      </svg>
      <Tag className={styles.label} id={id}>
        {children}
      </Tag>
    </div>
  );
}
