"use client";

import type { Invitation } from "@/invitations/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Flourish } from "@/components/ornaments/Flourish";
import { useContext } from "react";
import { DecorContext } from "@/components/ornaments/Decor";
import styles from "./Notes.module.css";

export function Gifts({ invitation }: { invitation: Invitation }) {
  const { gifts } = invitation;
  const { frameImage } = useContext(DecorContext);
  const tilt = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${px * 10}deg`);
    el.style.setProperty("--rx", `${-py * 10}deg`);
  };
  const reset = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
  };
  return (
    <section className={styles.section} id="gifts" aria-labelledby="gifts-title">
      <div className={styles.inner}>
        <SectionHeading label={gifts.heading} id="gifts-title" />
        <Reveal>
        <div className={styles.card} data-frame={frameImage ? "" : undefined} style={frameImage ? ({ "--frame-img": `url("${frameImage}")` } as React.CSSProperties) : undefined} onPointerMove={tilt} onPointerLeave={reset} onPointerUp={reset}>
          <span className={styles.cardIcon} aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="18" width="36" height="24" rx="2" />
              <path d="M4 12h40v6H4zM24 12v30M24 12c-4-6-10-7-12-4s3 5 12 4zM24 12c4-6 10-7 12-4s-3 5-12 4z" />
            </svg>
          </span>
          <p className={styles.text}>{gifts.message}</p>
        </div>
        </Reveal>
        <Flourish className={styles.flourish} color="var(--plum)" width={180} />
      </div>
    </section>
  );
}
