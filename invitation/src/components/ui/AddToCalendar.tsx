"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";
import { CalendarIcon, DownloadIcon } from "./Icons";
import { useInvitationEnv } from "@/components/invitation/env";
import styles from "./Popover.module.css";

interface Props {
  googleUrl: string;
  icsUrl: string;
}

/** "Add to calendar" with Google Calendar and .ics (Apple / Outlook) options. */
export function AddToCalendar({ googleUrl, icsUrl }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { allowDownloads } = useInvitationEnv();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.wrap} ref={ref}>
      <Button variant="outline" icon={<CalendarIcon />} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        Add to calendar
      </Button>
      {open && (
        <div className={styles.menu} role="menu">
          <a role="menuitem" href={googleUrl} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            <CalendarIcon /> Google Calendar
          </a>
          {allowDownloads && (
            <a role="menuitem" href={icsUrl} download onClick={() => setOpen(false)}>
              <DownloadIcon /> Apple / Outlook (.ics)
            </a>
          )}
        </div>
      )}
    </div>
  );
}
