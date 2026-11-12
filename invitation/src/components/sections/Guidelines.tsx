"use client";

import { useEffect, useState } from "react";
import type { Invitation } from "@/invitations/types";
import { CheckIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import styles from "./Notes.module.css";

const icons = [
  // clock
  <svg key="clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>,
  // envelope / invitation
  <svg key="inv" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path d="M4 7l8 6 8-6" />
  </svg>,
  // adults only
  <svg key="adult" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7" r="3" />
    <path d="M6 20a6 6 0 0 1 12 0" />
  </svg>,
];

export function Guidelines({ invitation }: { invitation: Invitation }) {
  const key = `eguest:guidelines:${invitation.slug}`;
  const [done, setDone] = useState<boolean[]>(() => invitation.guidelines.map(() => false));

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw) as boolean[];
        setDone(invitation.guidelines.map((_, i) => Boolean(saved[i])));
      }
    } catch {
      /* ignore */
    }
  }, [key, invitation.guidelines]);

  const toggle = (i: number) => {
    setDone((d) => {
      const next = d.map((v, j) => (j === i ? !v : v));
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const all = done.every(Boolean);

  return (
    <section className={styles.section} id="guidelines" aria-labelledby="guidelines-title">
      <div className={styles.inner}>
        <SectionHeading label="Guest guidelines" id="guidelines-title" />
        <ol className={styles.list}>
          {invitation.guidelines.map((g, i) => (
            <Reveal as="li" key={g} delay={i * 0.08} className={`${styles.item} ${done[i] ? styles.itemDone : ""}`}>
              <button type="button" className={styles.itemBtn} onClick={() => toggle(i)} aria-pressed={done[i]}>
                <span className={styles.itemIcon} aria-hidden="true">
                  <span className={styles.iconFront}>{icons[i % icons.length]}</span>
                  <span className={styles.iconBack}>
                    <CheckIcon />
                  </span>
                </span>
                <span className={styles.itemText}>{g}</span>
              </button>
            </Reveal>
          ))}
        </ol>
        <p className={styles.ack} aria-live="polite">
          {all ? "Thank you for noting our guidelines." : "Tap each note to acknowledge it."}
        </p>
        <Reveal className={styles.strict}>
          <span className="eyebrow">Strictly by invitation</span>
        </Reveal>
      </div>
    </section>
  );
}
