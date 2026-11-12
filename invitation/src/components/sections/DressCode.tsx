"use client";

import { useState } from "react";
import type { Invitation } from "@/invitations/types";
import { useToast } from "@/components/ui/Toast";
import { CopyIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Marble } from "@/components/ornaments/Marble";
import { SprigDecor } from "@/components/ornaments/Decor";
import { Gown, Tuxedo } from "@/components/ornaments/Attire";
import styles from "./DressCode.module.css";

export function DressCode({ invitation }: { invitation: Invitation }) {
  const { dressCode } = invitation;
  const [selected, setSelected] = useState<number | null>(null);
  const toast = useToast();
  const current = selected === null ? null : dressCode.palette[selected];

  const copyHex = async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.hex);
      toast.show(`${current.name} ${current.hex} copied`);
    } catch {
      toast.show(current.hex);
    }
  };
  return (
    <section className={styles.section} id="dress-code" aria-labelledby="dress-code-title">
      <Marble className={styles.marble} opacity={0.16} seed={5} />
      <SprigDecor slot="dress-r" className={`${styles.sprig} ${styles.sprigR}`} />
      <div className={styles.inner}>
        <SectionHeading label="Dress code" id="dress-code-title" />

        <Reveal className={styles.theme}>
          <span>{dressCode.theme}</span>
        </Reveal>

        <div className={styles.columns}>
          <Reveal className={styles.col} delay={0.05}>
            <span className={`script ${styles.colScript}`}>Ladies</span>
            <p>{dressCode.ladies}</p>
          </Reveal>
          <span className={styles.divider} aria-hidden="true" />
          <Reveal className={styles.col} delay={0.12}>
            <span className={`script ${styles.colScript}`}>Gentlemen</span>
            <p>{dressCode.gentlemen}</p>
          </Reveal>
        </div>

        {dressCode.note && (
          <Reveal className={styles.note} delay={0.1}>
            <p className="eyebrow">{dressCode.note}</p>
          </Reveal>
        )}

        <Reveal className={styles.inspiration} delay={0.12}>
          {dressCode.inspirationImages?.length ? (
            <div className={styles.photos}>
              {dressCode.inspirationImages.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.src} src={img.src} alt={img.alt} loading="lazy" />
              ))}
            </div>
          ) : (
            <div className={styles.figures}>
              <div className={styles.group}>
                <ul className={styles.gowns}>
                  {dressCode.palette.slice(0, 4).map((c, i) => (
                    <li key={c.name} data-active={selected === i} data-dim={selected !== null && selected !== i}>
                      <button type="button" className={styles.gownBtn} onClick={() => setSelected(selected === i ? null : i)} aria-pressed={selected === i} aria-label={`${c.gownName ?? c.name} gown`}>
                        <Gown id={`gown-${i}`} colour={c.hex} style={(["oneShoulder", "boatNeck", "cowlRuffle", "bellSleeve"] as const)[i % 4]} />
                      </button>
                      <span>{c.gownName ?? c.name}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.groupLabel}>Ladies</p>
              </div>
              <div className={styles.group}>
                <ul className={`${styles.gowns} ${styles.tuxedos}`}>
                  <li>
                    <Tuxedo id="tux-1" />
                  </li>
                  <li>
                    <Tuxedo id="tux-2" />
                  </li>
                </ul>
                <p className={styles.groupLabel}>Gentlemen</p>
              </div>
            </div>
          )}
        </Reveal>

        <Reveal className={styles.palette} delay={0.15}>
          <p className={styles.hint}>{dressCode.inspirationImages?.length ? "Tap a colour to copy it" : "Tap a colour to see it on the gown"}</p>
          <ul className={styles.swatches}>
            {dressCode.palette.map((c, i) => (
              <li key={c.name} style={{ "--swatch": c.hex, "--d": `${i * 0.08}s` } as React.CSSProperties}>
                <button
                  type="button"
                  className={`${styles.swatch} ${selected === i ? styles.swatchActive : ""}`}
                  onClick={() => setSelected(selected === i ? null : i)}
                  aria-pressed={selected === i}
                  aria-label={`${c.name} ${c.hex}`}
                >
                  <i />
                </button>
                <span className={styles.swatchName}>{c.name}</span>
              </li>
            ))}
          </ul>
          <div className={`${styles.detail} ${current ? styles.detailOpen : ""}`} aria-live="polite">
            {current && (
              <>
                <span className={styles.detailDot} style={{ background: current.hex }} />
                <span className={styles.detailName}>
                  {current.name}
                  {current.gownName && current.gownName !== current.name ? ` · ${current.gownName}` : ""}
                </span>
                <button type="button" className={styles.copyBtn} onClick={() => void copyHex()}>
                  <CopyIcon /> {current.hex}
                </button>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
