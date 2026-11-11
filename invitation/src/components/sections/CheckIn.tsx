"use client";

import { useEffect, useState } from "react";
import type { GuestContext, Invitation } from "@/invitations/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { CheckIcon, MapPinIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { currentPosition, currentToken, isWeddingDay, postCheckin, type CheckinResult } from "@/components/invitation/host";
import styles from "./CheckIn.module.css";

/**
 * Self check-in at the venue (kept from the previous site; records land on the
 * guest in the wedding portal, next to usher and QR-badge check-ins).
 * Shown on the wedding day only. Location is verified by the server; a device
 * that cannot share its location may still check in, recorded as unverified.
 */
export function CheckIn({ invitation, guest }: { invitation: Invitation; guest: GuestContext | null }) {
  const { date, timeZone } = invitation.schedule;
  const [today, setToday] = useState(false);
  const [done, setDone] = useState<{ firstName?: string; table?: string } | null>(guest?.checkedIn ? { firstName: guest.displayName.split(" ")[0], table: guest.table } : null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [phone, setPhone] = useState("");
  const [offerUnverified, setOfferUnverified] = useState(false);
  const { show: toast } = useToast();

  useEffect(() => {
    const on = isWeddingDay(date, timeZone) || new URLSearchParams(window.location.search).has("checkin-preview");
    setToday(on);
    // On the day, a confirmed guest with a personal link is checked in quietly when they arrive.
    if (!on || !guest || guest.checkedIn || guest.rsvp?.attendance !== "attending" || !navigator.geolocation) return;
    currentPosition(8000)
      .then((pos) => postCheckin({ token: guest.code, mode: "auto", lat: pos.coords.latitude, lng: pos.coords.longitude }))
      .then((res) => { if (res.ok) finish(res, true); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, timeZone, guest]);

  if (!today && !done) return null;

  function identity(): Record<string, string> | null {
    const { token } = currentToken();
    if (guest || token) return { token: guest?.code || token };
    if (phone.replace(/\D/g, "").length >= 7) return { phone };
    return null;
  }

  function finish(res: CheckinResult, auto?: boolean) {
    setBusy(false);
    setDone({ firstName: res.firstName || guest?.displayName.split(" ")[0], table: res.table || guest?.table });
    setMsg("");
    if (!res.alreadyCheckedIn) toast(auto ? "Welcome! You've been checked in automatically." : "You're checked in — welcome!");
  }

  function explain(res: CheckinResult) {
    setBusy(false);
    if (res.reason === "too_far") {
      const d = res.distanceMeters ?? 0;
      setMsg(`You appear to be about ${d >= 1000 ? (d / 1000).toFixed(1) + " km" : d + " m"} from the venue. Please check in once you've arrived at ${invitation.venue.name}.`);
    } else if (res.reason === "not_found") {
      setMsg("We couldn't find an invitation with that phone number. Please see an usher at the entrance.");
    } else {
      setMsg(res.error || "Something went wrong. Please try again, or see an usher at the entrance.");
    }
  }

  async function checkIn() {
    const id = identity();
    if (!id) { setMsg("Please enter the phone number on your invitation."); return; }
    setBusy(true);
    setMsg("Confirming you're at the venue…");
    try {
      const pos = await currentPosition();
      const res = await postCheckin({ ...id, mode: "self", lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (res.ok) finish(res); else explain(res);
    } catch {
      setBusy(false);
      setMsg("We couldn't get your location. You can still check in — the couple will see it wasn't location-confirmed.");
      setOfferUnverified(true);
    }
  }

  async function checkInUnverified() {
    const id = identity();
    if (!id) return;
    setBusy(true);
    const res = await postCheckin({ ...id, mode: "self-unverified" });
    if (res.ok) finish(res); else explain(res);
  }

  return (
    <section className={styles.section} id="check-in" aria-labelledby="checkin-title">
      <div className={styles.inner}>
        <SectionHeading label="Check-in" id="checkin-title" intro={done ? undefined : `Arrived at ${invitation.venue.name}? Check yourself in so the couple and ushers know you're here.`} />
        <div className={`${styles.card} ${done ? styles.cardDone : ""}`}>
          {done ? (
            <div className={styles.done} role="status" aria-live="polite">
              <span className={styles.icon}><CheckIcon /></span>
              <p className={`script ${styles.title}`}>Welcome{done.firstName ? `, ${done.firstName}` : ""}</p>
              <p className={styles.text}>You&apos;re checked in. Enjoy the celebration!</p>
              {done.table && (
                <p className={styles.table}>
                  <span className="eyebrow">Your table</span>
                  <strong>{done.table}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className={styles.form}>
              <p className={styles.rule}>Please only check in once you have arrived. We confirm your location to keep the guest list accurate.</p>
              {!guest && !currentToken().token && (
                <label className={styles.field}>
                  <span>The phone number on your invitation</span>
                  <input type="tel" autoComplete="tel" placeholder="077 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
              )}
              <Button variant="plum" icon={<MapPinIcon />} onClick={() => void checkIn()} disabled={busy} aria-busy={busy}>
                {busy ? "Checking in…" : "Check me in"}
              </Button>
              {offerUnverified && !busy && (
                <Button variant="ghost" size="sm" onClick={() => void checkInUnverified()}>
                  Check in without location
                </Button>
              )}
              {msg && <p className={styles.msg} role="status" aria-live="polite">{msg}</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
