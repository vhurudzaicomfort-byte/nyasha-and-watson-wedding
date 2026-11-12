"use client";

import { useEffect, useMemo, useState } from "react";
import type { Invitation } from "@/invitations/types";
import { getCountdown, zonedTimeToUtc } from "@/lib/datetime";
import { Reveal } from "@/components/ui/Reveal";
import styles from "./Countdown.module.css";

export function Countdown({ invitation }: { invitation: Invitation }) {
  const { schedule } = invitation;
  const target = useMemo(
    () => zonedTimeToUtc(schedule.date, schedule.startTime, schedule.timeZone),
    [schedule.date, schedule.startTime, schedule.timeZone],
  );
  const end = useMemo(
    () => zonedTimeToUtc(schedule.date, schedule.endTime, schedule.timeZone),
    [schedule.date, schedule.endTime, schedule.timeZone],
  );
  // Render nothing time-dependent on the server to avoid hydration drift.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const cd = now ? getCountdown(target, now) : null;
  const state = !now ? "loading" : cd!.totalMs > 0 ? "counting" : now < end ? "today" : "past";

  const tiles: Array<[string, number | null]> = [
    ["Days", cd?.days ?? null],
    ["Hours", cd?.hours ?? null],
    ["Minutes", cd?.minutes ?? null],
    ["Seconds", cd?.seconds ?? null],
  ];

  return (
    <section className={styles.section} aria-label="Countdown to the wedding">
      <Reveal className={styles.inner}>
        {state === "today" && <p className={`script ${styles.message}`}>Today is the day</p>}
        {state === "past" && <p className={`script ${styles.message}`}>Happily married</p>}
        {(state === "counting" || state === "loading") && (
          <>
            <p className="eyebrow">Counting down to the day</p>
            <div className={styles.tiles} role="timer" aria-live="off">
              {tiles.map(([label, value]) => (
                <div key={label} className={styles.tile}>
                  <span className={styles.value} suppressHydrationWarning>
                    {value === null ? (
                      "–"
                    ) : (
                      <span key={value} className={styles.roll}>
                        {String(value).padStart(2, "0")}
                      </span>
                    )}
                  </span>
                  <span className={styles.label}>{label}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Reveal>
    </section>
  );
}
