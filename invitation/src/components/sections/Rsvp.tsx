"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GuestContext, Invitation } from "@/invitations/types";
import { issuesToFieldErrors, rsvpSchema, type RsvpFormValues } from "@/lib/rsvp/validation";
import { longDate } from "@/lib/datetime";
import { telHref } from "@/lib/share";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { CheckIcon, HeartIcon, PhoneIcon } from "@/components/ui/Icons";
import { CornerDecor } from "@/components/ornaments/Decor";
import { useInvitationEnv } from "@/components/invitation/env";
import { celebrate } from "@/components/ui/Petals";
import styles from "./Rsvp.module.css";

interface Props {
  invitation: Invitation;
  guest?: GuestContext | null;
  /** Standalone /rsvp page hides the decorative corners. */
  compact?: boolean;
}

type Status = "idle" | "submitting" | "success" | "error";

interface Saved {
  fullName: string;
  attendance: "attending" | "declined";
  partySize: number;
  at: string;
  /** Awaiting the couple's approval (not on the invitation list yet). */
  pending?: boolean;
}

export function Rsvp({ invitation, guest, compact }: Props) {
  const storageKey = `eguest:rsvp:${invitation.slug}`;
  const { submitRsvp } = useInvitationEnv();
  const allowance = guest?.allowance ?? invitation.rsvp.defaultPartySize;
  const openedAt = useRef<number>(Date.now());

  const [values, setValues] = useState<RsvpFormValues>({
    invitationSlug: invitation.slug,
    fullName: guest?.displayName ?? "",
    attendance: "attending",
    partySize: guest?.rsvp?.attendance === "attending" ? guest.rsvp.partySize : 1,
    phone: "",
    email: "",
    message: "",
    guestCode: guest?.code,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>("idle");
  const [serverMessage, setServerMessage] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);
  const [editing, setEditing] = useState(false);

  // Remember a previous response on this device to prevent accidental duplicates.
  useEffect(() => {
    openedAt.current = Date.now();
    // A personal invitation shows the reply on record in the wedding portal;
    // otherwise this device's last response, if any.
    if (guest) {
      if (guest.rsvp) setSaved({ fullName: guest.displayName, attendance: guest.rsvp.attendance, partySize: guest.rsvp.partySize, at: guest.rsvp.at || "" });
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setSaved(JSON.parse(raw) as Saved);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey, guest]);

  const deadline = useMemo(
    () => (invitation.rsvp.deadline ? longDate(invitation.rsvp.deadline, invitation.schedule.timeZone) : null),
    [invitation.rsvp.deadline, invitation.schedule.timeZone],
  );

  const set = <K extends keyof RsvpFormValues>(k: K, v: RsvpFormValues[K]) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((e) => {
      if (!e[k as string]) return e;
      const copy = { ...e };
      delete copy[k as string];
      return copy;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    const payload = { ...values, elapsedMs: Date.now() - openedAt.current };
    const parsed = rsvpSchema.safeParse(payload);
    if (!parsed.success) {
      const fe = issuesToFieldErrors(parsed.error);
      setErrors(fe);
      const first = document.querySelector<HTMLElement>(`[data-field="${Object.keys(fe)[0]}"]`);
      first?.focus();
      return;
    }
    if (parsed.data.attendance === "attending" && parsed.data.partySize > allowance) {
      setErrors({ partySize: `This invitation covers up to ${allowance} guest${allowance === 1 ? "" : "s"}.` });
      return;
    }

    setStatus("submitting");
    setServerMessage("");
    try {
      const data = await submitRsvp(payload);
      if (!data.ok) {
        setErrors(data.fieldErrors ?? {});
        setServerMessage(data.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      const record: Saved = {
        fullName: parsed.data.fullName,
        attendance: parsed.data.attendance,
        partySize: parsed.data.attendance === "attending" ? data.partySize ?? parsed.data.partySize : 0,
        at: new Date().toISOString(),
        pending: !!data.pending,
      };
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(record));
      } catch {
        /* ignore */
      }
      setSaved(record);
      setEditing(false);
      setServerMessage(data.message || "Thank you!");
      setStatus("success");
      if (record.attendance === "attending" && !record.pending) window.setTimeout(() => celebrate(), 250);
    } catch {
      setServerMessage("We could not reach the server. Please check your connection and try again.");
      setStatus("error");
    }
  };

  const showForm = !saved || editing;

  return (
    <section className={`${styles.section} ${compact ? styles.compact : ""}`} id="rsvp" aria-labelledby="rsvp-title">
      {!compact && (
        <>
          <CornerDecor id="fc-rsvp" slot="rsvp-tr" className={`${styles.corner} ${styles.cornerTR}`} flip />
          <CornerDecor id="fc-rsvp-b" slot="rsvp-bl" className={`${styles.corner} ${styles.cornerBL}`} />
        </>
      )}
      <div className={styles.inner}>
        <SectionHeading
          label="RSVP"
          id="rsvp-title"
          intro={
            deadline
              ? `Kindly confirm your attendance by ${deadline}. Attendance is strictly by RSVP and invitation.`
              : "Kindly confirm your attendance below. Attendance is strictly by RSVP and invitation."
          }
        />

        <Reveal className={styles.card}>
          {!showForm && saved ? (
            <div className={styles.success} role="status" aria-live="polite">
              <span className={styles.successIcon}>
                <CheckIcon />
              </span>
              <h3 className={`script ${styles.successTitle}`}>
                {saved.pending ? "Thank you" : saved.attendance === "attending" ? "Thank you" : "We will miss you"}
              </h3>
              <p className={styles.successText}>
                {serverMessage ||
                  (saved.attendance === "attending"
                    ? "Your response has been received. We cannot wait to celebrate with you."
                    : "Your response has been received. Thank you for letting us know.")}
              </p>
              <dl className={styles.summary}>
                <div>
                  <dt>Name</dt>
                  <dd>{saved.fullName}</dd>
                </div>
                <div>
                  <dt>Attending</dt>
                  <dd>{saved.attendance === "attending" ? "Yes" : "No"}</dd>
                </div>
                {saved.attendance === "attending" && (
                  <div>
                    <dt>Guests</dt>
                    <dd>{saved.partySize}</dd>
                  </div>
                )}
                {saved.attendance === "attending" && !saved.pending && guest?.table && (
                  <div>
                    <dt>Your table</dt>
                    <dd>{guest.table}</dd>
                  </div>
                )}
                {saved.pending && (
                  <div>
                    <dt>Status</dt>
                    <dd>Awaiting confirmation</dd>
                  </div>
                )}
              </dl>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Change my response
              </Button>
            </div>
          ) : (
            <form className={styles.form} onSubmit={(e) => void submit(e)} noValidate>
              {saved && (
                <p className={styles.notice}>You have already responded on this device. Submitting again will update your response.</p>
              )}

              <fieldset className={styles.choice}>
                <legend className="sr-only">Will you attend?</legend>
                {(
                  [
                    ["attending", "Joyfully accept"],
                    ["declined", "Regretfully decline"],
                  ] as const
                ).map(([val, label]) => (
                  <label key={val} className={`${styles.option} ${values.attendance === val ? styles.optionActive : ""}`}>
                    <input
                      type="radio"
                      name="attendance"
                      value={val}
                      checked={values.attendance === val}
                      onChange={() => set("attendance", val)}
                      data-field="attendance"
                    />
                    <span className={styles.optionIcon} aria-hidden="true">
                      {val === "attending" ? <HeartIcon /> : <span className={styles.dash} />}
                    </span>
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
              {errors.attendance && <p className={styles.error}>{errors.attendance}</p>}

              <div className={styles.field}>
                <label htmlFor="rsvp-name">Full name</label>
                <input
                  id="rsvp-name"
                  data-field="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Mr & Mrs T. Moyo"
                  value={values.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? "err-fullName" : undefined}
                  required
                />
                {errors.fullName && (
                  <p className={styles.error} id="err-fullName">
                    {errors.fullName}
                  </p>
                )}
              </div>

              {values.attendance === "attending" && (
                <div className={styles.field}>
                  <label htmlFor="rsvp-party">Number of guests attending</label>
                  <div className={styles.stepper}>
                    <button
                      type="button"
                      aria-label="Fewer guests"
                      onClick={() => set("partySize", Math.max(1, Number(values.partySize) - 1))}
                      disabled={Number(values.partySize) <= 1}
                    >
                      −
                    </button>
                    <input
                      id="rsvp-party"
                      data-field="partySize"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={allowance}
                      value={values.partySize}
                      onChange={(e) => set("partySize", e.target.value)}
                      aria-invalid={Boolean(errors.partySize)}
                      aria-describedby="help-partySize"
                    />
                    <button
                      type="button"
                      aria-label="More guests"
                      onClick={() => set("partySize", Math.min(allowance, Number(values.partySize) + 1))}
                      disabled={Number(values.partySize) >= allowance}
                    >
                      +
                    </button>
                  </div>
                  <p className={styles.help} id="help-partySize">
                    Including yourself. This invitation covers up to {allowance} guest{allowance === 1 ? "" : "s"}. Adults only.
                  </p>
                  {errors.partySize && <p className={styles.error}>{errors.partySize}</p>}
                </div>
              )}

              <div className={styles.row}>
                <div className={styles.field}>
                  <label htmlFor="rsvp-phone">Phone</label>
                  <input
                    id="rsvp-phone"
                    data-field="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="077 000 0000"
                    value={values.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                  />
                  {errors.phone && <p className={styles.error}>{errors.phone}</p>}
                </div>
                <div className={styles.field}>
                  <label htmlFor="rsvp-email">
                    Email <span className={styles.optional}>(optional)</span>
                  </label>
                  <input
                    id="rsvp-email"
                    data-field="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={values.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                  />
                  {errors.email && <p className={styles.error}>{errors.email}</p>}
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="rsvp-message">
                  A note for the couple <span className={styles.optional}>(optional)</span>
                </label>
                <textarea
                  id="rsvp-message"
                  data-field="message"
                  rows={3}
                  maxLength={500}
                  placeholder="Dietary requirements, a wish, a memory…"
                  value={values.message ?? ""}
                  onChange={(e) => set("message", e.target.value)}
                />
                {errors.message && <p className={styles.error}>{errors.message}</p>}
              </div>

              {/* Honeypot: hidden from humans, tempting for bots. */}
              <div className={styles.hp} aria-hidden="true">
                <label htmlFor="rsvp-website">Website</label>
                <input id="rsvp-website" type="text" tabIndex={-1} autoComplete="off" value={values.website ?? ""} onChange={(e) => set("website", e.target.value)} />
              </div>

              {status === "error" && serverMessage && (
                <p className={`${styles.error} ${styles.formError}`} role="alert">
                  {serverMessage}
                </p>
              )}

              <div className={styles.submitRow}>
                <Button type="submit" variant="plum" disabled={status === "submitting"} aria-busy={status === "submitting"}>
                  {status === "submitting" ? "Sending…" : saved ? "Update response" : "Send response"}
                </Button>
                {saved && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
              <p className={styles.privacy}>Your details are shared only with the couple and used solely for the wedding.</p>
            </form>
          )}
        </Reveal>

        {invitation.rsvp.fallbackPhones.length > 0 && (
          <Reveal className={styles.fallback} delay={0.1}>
            <p className="eyebrow">If you are unable to RSVP on our site, please RSVP to</p>
            <div className={styles.phones}>
              {invitation.rsvp.fallbackPhones.map((p) => (
                <a key={p} href={telHref(p)} className={styles.phone}>
                  <PhoneIcon />
                  <span>{p}</span>
                </a>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
