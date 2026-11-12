"use client";

import type { Invitation } from "@/invitations/types";
import { dateParts, formatTime12h } from "@/lib/datetime";
import { buildIcs, googleCalendarUrl, invitationToEvent } from "@/lib/calendar";
import { mapsDirectionsUrl } from "@/lib/maps";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { AddToCalendar } from "@/components/ui/AddToCalendar";
import { MapPinIcon } from "@/components/ui/Icons";
import { CornerDecor } from "@/components/ornaments/Decor";
import { Flourish } from "@/components/ornaments/Flourish";
import styles from "./Details.module.css";

interface Props {
  invitation: Invitation;
  shareUrl?: string;
}

export function Details({ invitation, shareUrl }: Props) {
  const { schedule, venue } = invitation;
  const p = dateParts(schedule.date, schedule.timeZone);
  const ev = invitationToEvent(invitation, shareUrl);

  return (
    <section className={styles.section} id="details" aria-labelledby="details-title">
      <CornerDecor id="fc-details" slot="details-tl" className={`${styles.corner} ${styles.cornerTL}`} />
      <CornerDecor id="fc-details-r" slot="details-br" flip className={`${styles.corner} ${styles.cornerBR}`} />

      <div className={styles.inner}>
        <Reveal className={styles.head}>
          <span className={`script ${styles.script}`}>The</span>
          <h2 className={styles.title} id="details-title">
            Details
          </h2>
          <Flourish className={styles.flourish} color="var(--gold-deep)" width={200} />
        </Reveal>

        <Reveal delay={0.1} className={styles.dateBlock}>
          <div className={styles.weekday}>{schedule.weekdayLabel ?? p.weekday}</div>
          <div className={styles.dateRow}>
            <span className={styles.month}>{p.month}</span>
            <span className={styles.day}>{p.day}</span>
            <span className={styles.year}>{p.year}</span>
          </div>
          <div className={styles.time}>
            {schedule.arrivalTime && <span>Arrive {formatTime12h(schedule.arrivalTime)}</span>}
            <span>Ceremony {formatTime12h(schedule.startTime)}</span>
          </div>
        </Reveal>

        <Reveal delay={0.15} className={styles.venue}>
          <MapPinIcon />
          <h3 className={styles.venueName}>{venue.name}</h3>
          <p className={styles.venueAddr}>
            {venue.addressLine}
            <br />
            {venue.city}, {venue.country}
          </p>
        </Reveal>

        <Reveal delay={0.2} className={styles.actions}>
          <AddToCalendar googleUrl={googleCalendarUrl(ev)} icsUrl={`data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(ev))}`} />
          <Button variant="outline" icon={<MapPinIcon />} href={mapsDirectionsUrl(venue)}>
            Get directions
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
