"use client";

import { useContext, useEffect, useId, useState } from "react";
import { Monogram } from "@/components/ornaments/Monogram";
import { DecorContext, Rings, SprigDecor } from "@/components/ornaments/Decor";
import styles from "./Envelope.module.css";

export type EnvelopePhase = "closed" | "opening" | "done";

interface Props {
  coupleLine: string;
  initials: [string, string];
  guestName?: string | null;
  dateLine: string;
  title: string;
  musicAvailable: boolean;
  /** Called once the guest taps "Open". `withMusic` reflects the toggle. */
  onOpen: (withMusic: boolean) => void;
  /** Called when the opening animation completes. */
  onOpened: () => void;
  phase: EnvelopePhase;
}

const OPEN_DURATION_MS = 3400;

/**
 * Digital envelope with wax seal. Tapping the seal (or the button) breaks the
 * seal, lifts the flap, slides the card out and dissolves into the invitation.
 */
export function Envelope({
  coupleLine,
  initials,
  guestName,
  dateLine,
  title,
  musicAvailable,
  onOpen,
  onOpened,
  phase,
}: Props) {
  const { sealImage } = useContext(DecorContext);
  const [withMusic, setWithMusic] = useState(true);
  const [reduced, setReduced] = useState(false);
  const descId = useId();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (phase !== "opening") return;
    const t = window.setTimeout(onOpened, reduced ? 400 : OPEN_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [phase, onOpened, reduced]);

  if (phase === "done") return null;

  const open = () => {
    if (phase !== "closed") return;
    onOpen(withMusic && musicAvailable);
  };

  return (
    <div
      className={`${styles.overlay} ${phase === "opening" ? styles.opening : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${descId}-title`}
      aria-describedby={`${descId}-desc`}
    >
      <div className={styles.dust} aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ "--i": i, left: `${(i * 53) % 100}%` } as React.CSSProperties} />
        ))}
      </div>

      <div className={styles.stage}>
        <SprigDecor slot="envelope-l" variant="gold" className={`${styles.sprig} ${styles.sprigLeft}`} />
        <SprigDecor slot="envelope-r" variant="gold" flip className={`${styles.sprig} ${styles.sprigRight}`} />

        <p className={`eyebrow ${styles.kicker}`} id={`${descId}-desc`}>
          {guestName ? `Especially for ${guestName}` : "You have received an invitation"}
        </p>

        <button
          type="button"
          className={styles.envelope}
          onClick={open}
          aria-label="Open the invitation"
          disabled={phase !== "closed"}
        >
          {/* back of the envelope */}
          <span className={styles.back} />

          {/* the card inside */}
          <span className={styles.card} aria-hidden="true">
            <span className={styles.cardInner}>
              <span className={styles.cardEyebrow}>{withRings(coupleLine, styles.cardRings)}</span>
              <span className={`script ${styles.cardTitle}`}>{title}</span>
              <span className={styles.cardDate}>{dateLine}</span>
            </span>
          </span>

          {/* folds */}
          <span className={styles.foldLeft} />
          <span className={styles.foldRight} />
          <span className={styles.foldBottom} />

          {/* address line on the front */}
          <span className={styles.address} aria-hidden="true">
            <span className={styles.addressTo}>{guestName ? `Dear ${guestName}` : "With love"}</span>
            <span className={`script ${styles.addressNames}`}>{withRings(coupleLine, styles.addressRings)}</span>
          </span>

          {/* flap + seal */}
          <span className={styles.flap}>
            <span className={styles.flapInner} />
          </span>
          <span className={styles.seal}>
            {sealImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sealImage} alt="" aria-hidden="true" className={styles.sealImg} width={300} height={300} decoding="async" />
            ) : (
              <Monogram initials={initials} variant="seal" size={84} />
            )}
          </span>
        </button>

        <h1 className={`script ${styles.title}`} id={`${descId}-title`}>
          {title}
        </h1>

        <div className={styles.actions}>
          <button type="button" className={styles.openBtn} onClick={open} disabled={phase !== "closed"}>
            <span>{phase === "opening" ? "Opening…" : "Open invitation"}</span>
          </button>
          {musicAvailable && (
            <label className={styles.musicToggle}>
              <input type="checkbox" checked={withMusic} onChange={(e) => setWithMusic(e.target.checked)} />
              <span className={styles.switch} aria-hidden="true" />
              <span>Play music</span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Nyasha Mazuruse & Watson Chin'ombe" with the gold rings in place of "&". */
function withRings(line: string, ringsClass?: string) {
  const [one, two] = line.split(" & ");
  if (!two) return line;
  return (
    <>
      {one} <Rings className={ringsClass} /> {two}
    </>
  );
}
