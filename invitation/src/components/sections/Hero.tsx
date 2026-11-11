"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { celebrate } from "@/components/ui/Petals";
import type { Invitation } from "@/invitations/types";
import { dateParts, formatTime12h, dottedDate } from "@/lib/datetime";
import { Rings, SprigDecor } from "@/components/ornaments/Decor";
import { Monogram } from "@/components/ornaments/Monogram";
import { ChevronDownIcon } from "@/components/ui/Icons";
import styles from "./Hero.module.css";

interface Props {
  invitation: Invitation;
  guestName?: string | null;
  /** Start entrance animation (true once the envelope has opened). */
  active: boolean;
}

export function Hero({ invitation, guestName, active }: Props) {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { couple, schedule, venue } = invitation;

  // Pointer-reactive glow: the light follows the finger / cursor.
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el || reduce) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };
  const parts = dateParts(schedule.date, schedule.timeZone);
  const initials: [string, string] = [couple.partnerOne[0] ?? "", couple.partnerTwo[0] ?? ""];

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.16, delayChildren: reduce ? 0 : 0.2 } },
  };
  const item = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 22, filter: "blur(6px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <header className={styles.hero} id="top" ref={heroRef} onPointerMove={onMove}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.dust} aria-hidden="true">
        {Array.from({ length: 16 }, (_, i) => (
          <i key={i} style={{ "--i": i, left: `${(i * 61) % 100}%` } as React.CSSProperties} />
        ))}
      </div>
      <div className={styles.vignette} aria-hidden="true" />
      <SprigDecor slot="hero-tl" variant="gold" className={`${styles.sprig} ${styles.sprigTL}`} />
      <SprigDecor slot="hero-br" variant="gold" flip className={`${styles.sprig} ${styles.sprigBR}`} />
      <div className={styles.frame} aria-hidden="true" />

      <motion.div className={styles.content} variants={container} initial="hidden" animate={active ? "show" : "hidden"}>
        <motion.button
          type="button"
          variants={item}
          className={styles.monogram}
          onClick={(e) => celebrate({ x: e.clientX, y: e.clientY })}
          aria-label="Tap to scatter petals"
          title="Tap me"
          whileTap={{ scale: 0.92 }}
        >
          <Monogram initials={initials} size={88} />
        </motion.button>

        {guestName && (
          <motion.p variants={item} className={styles.guest}>
            Dear {guestName}
          </motion.p>
        )}

        <motion.p variants={item} className={`eyebrow ${styles.eyebrow}`}>
          {invitation.invitationLine}
        </motion.p>

        <motion.h1 variants={item} className={`script ${styles.title}`}>
          {invitation.title}
        </motion.h1>

        <motion.p variants={item} className={styles.names}>
          <span>{couple.partnerOne}</span>
          <Rings className={styles.amp} />
          <span>{couple.partnerTwo}</span>
        </motion.p>

        <motion.div variants={item} className={styles.rule} aria-hidden="true">
          <i />
          <b />
          <i />
        </motion.div>

        <motion.p variants={item} className={styles.date}>
          <time dateTime={`${schedule.date}T${schedule.startTime}`}>{dottedDate(schedule.date)}</time>
        </motion.p>

        <motion.p variants={item} className={styles.meta}>
          {schedule.weekdayLabel ?? parts.weekday} at {formatTime12h(schedule.startTime)}
          <br />
          {venue.name}, {venue.city}
        </motion.p>

        <motion.p variants={item} className={styles.tagline}>
          {invitation.tagline}
        </motion.p>
      </motion.div>

      <a href="#details" className={styles.scrollCue} aria-label="Scroll to the details">
        <span className="eyebrow">Scroll</span>
        <ChevronDownIcon />
      </a>
    </header>
  );
}
