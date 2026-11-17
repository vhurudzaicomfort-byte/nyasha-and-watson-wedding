"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuestContext, Invitation as InvitationData } from "@/invitations/types";
import { dottedDate } from "@/lib/datetime";
import { telHref } from "@/lib/share";
import { useMusic } from "@/hooks/useMusic";
import { Envelope, type EnvelopePhase } from "@/components/envelope/Envelope";
import { MusicControl } from "@/components/ui/MusicControl";
import { Hero } from "@/components/sections/Hero";
import { Countdown } from "@/components/sections/Countdown";
import { Details } from "@/components/sections/Details";
import { DressCode } from "@/components/sections/DressCode";
import { Gifts } from "@/components/sections/Gifts";
import { Guidelines } from "@/components/sections/Guidelines";
import { Directions } from "@/components/sections/Directions";
import { Rsvp } from "@/components/sections/Rsvp";
import { Closing } from "@/components/sections/Closing";
import { CheckIn } from "@/components/sections/CheckIn";
import { InvitationEnvContext, type InvitationEnv } from "./env";
import { portalTransport } from "./host";
import { ToastProvider } from "@/components/ui/Toast";
import { DecorContext } from "@/components/ornaments/Decor";
import { PetalCanvas } from "@/components/ui/Petals";
import { SectionNav } from "@/components/ui/SectionNav";
import { CalendarIcon, HeartIcon, MapPinIcon, CheckIcon } from "@/components/ui/Icons";
import styles from "./Invitation.module.css";

interface Props {
  invitation: InvitationData;
  guest: GuestContext | null;
  /** Absolute public URL of this invitation when known. */
  shareUrl?: string;
  musicSrc?: string;
  /** Skip the envelope (used by the standalone RSVP page). */
  skipEnvelope?: boolean;
  /** Platform overrides (RSVP transport, embed/download permissions). */
  env?: Partial<InvitationEnv>;
  /** Shown at the top when this device was refused for a personal link (device limit). */
  notice?: string;
}

/**
 * Client orchestrator: envelope → reveal → sections. Holds the music engine
 * so it survives across the opening transition and the replay.
 */
export function InvitationExperience({ invitation, guest, shareUrl, musicSrc, skipEnvelope, env, notice }: Props) {
  const [noticeOpen, setNoticeOpen] = useState(!!notice);
  const [phase, setPhase] = useState<EnvelopePhase>(skipEnvelope ? "done" : "closed");
  const music = useMusic(musicSrc || invitation.musicSrc, musicSrc ? undefined : invitation.music);
  const open = phase === "done";

  // Lock scroll while the envelope is showing.
  useEffect(() => {
    document.body.classList.toggle("envelope-open-pending", phase !== "done");
    return () => document.body.classList.remove("envelope-open-pending");
  }, [phase]);

  const handleOpen = useCallback(
    (withMusic: boolean) => {
      setPhase("opening");
      if (withMusic) void music.play();
    },
    [music],
  );

  const handleOpened = useCallback(() => {
    setPhase("done");
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const replay = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    setPhase("closed");
  }, []);

  const themeVars = {
    "--accent": invitation.theme.primary,
    "--accent-deep": invitation.theme.primaryDeep,
    "--plum": invitation.theme.primaryDeep,
    "--gold": invitation.theme.gold,
    "--peach": invitation.theme.blush,
    "--leaf": invitation.theme.leaf,
  } as React.CSSProperties;

  const coupleLine = `${invitation.couple.partnerOne} & ${invitation.couple.partnerTwo}`;
  const initials: [string, string] = [invitation.couple.partnerOne[0] ?? "", invitation.couple.partnerTwo[0] ?? ""];

  const envValue: InvitationEnv = { submitRsvp: portalTransport, allowEmbeds: true, allowDownloads: true, ...env };

  const navItems = [
    { id: "details", label: "Details", icon: <CalendarIcon /> },
    { id: "dress-code", label: "Attire", icon: <DressIcon /> },
    { id: "gifts", label: "Gifts", icon: <GiftIcon /> },
    { id: "guidelines", label: "Notes", icon: <CheckIcon /> },
    { id: "directions", label: "Map", icon: <MapPinIcon /> },
    { id: "rsvp", label: "RSVP", icon: <HeartIcon /> },
  ];

  return (
    <InvitationEnvContext.Provider value={envValue}>
    <DecorContext.Provider value={invitation.decor ?? {}}>
    <ToastProvider>
    <div style={themeVars} className={styles.root}>
      {notice && noticeOpen && (
        <div className={styles.notice} role="alert">
          <p>
            {notice}{" "}
            {invitation.rsvp.fallbackPhones.map((ph, i) => (
              <span key={ph}>
                {i ? " or " : "Call "}
                <a href={telHref(ph)}>{ph}</a>
              </span>
            ))}
            .
          </p>
          <button type="button" onClick={() => setNoticeOpen(false)} aria-label="Dismiss">×</button>
        </div>
      )}
      {!skipEnvelope && (
        <Envelope
          phase={phase}
          coupleLine={coupleLine}
          initials={initials}
          guestName={guest?.displayName}
          dateLine={dottedDate(invitation.schedule.date)}
          title={invitation.title}
          musicAvailable={music.available}
          onOpen={handleOpen}
          onOpened={handleOpened}
        />
      )}

      <main className={`${styles.main} ${open ? styles.mainOpen : ""}`} inert={!open ? true : undefined} aria-hidden={!open}>
        <Hero invitation={invitation} guestName={guest?.displayName} active={open} />
        <Countdown invitation={invitation} />
        <CheckIn invitation={invitation} guest={guest} />
        <Details invitation={invitation} shareUrl={shareUrl} />
        <DressCode invitation={invitation} />
        <Gifts invitation={invitation} />
        <Guidelines invitation={invitation} />
        <Directions invitation={invitation} />
        <Rsvp invitation={invitation} guest={guest} />
        <Closing invitation={invitation} onReplay={skipEnvelope ? undefined : replay} shareUrl={shareUrl} guest={guest} />
      </main>

      {open && <MusicControl music={music} />}
      {open && <SectionNav items={navItems} />}
      <PetalCanvas />
    </div>
    </ToastProvider>
    </DecorContext.Provider>
    </InvitationEnvContext.Provider>
  );
}

const DressIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3l1.5 4L8 11l-4 10h16l-4-10-2.5-4L15 3" />
    <path d="M8 11h8" />
  </svg>
);
const GiftIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="9" width="18" height="12" rx="1.5" />
    <path d="M3 9h18M12 9v12M12 9c-2-3-5-3.5-6-2s1.5 2.5 6 2zM12 9c2-3 5-3.5 6-2s-1.5 2.5-6 2z" />
  </svg>
);
