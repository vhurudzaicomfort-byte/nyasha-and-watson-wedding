"use client";

import { useEffect, useState } from "react";
import { ourLoveStory } from "@/invitations/our-love-story";
import type { GuestContext } from "@/invitations/types";
import { InvitationExperience } from "@/components/invitation/Invitation";
import { deviceRefusal, loadGuest, pendingRequest } from "@/components/invitation/host";

/**
 * The invitation at nyasha-watson.e-guests.com. Built as a static page; the
 * guest is resolved in the browser from their personal link (?g=<guestId>)
 * against the wedding portal's /api/rsvp, the single guest database.
 */
export default function Home() {
  const [state, setState] = useState<{ ready: boolean; guest: GuestContext | null; notice?: string }>({ ready: false, guest: null });

  useEffect(() => {
    let live = true;
    (async () => {
      let guest = await loadGuest();
      if (!guest) {
        const req = await pendingRequest(); // an approved RSVP request becomes a personal link
        if (req?.guestId) guest = await loadGuest();
      }
      if (live) setState({ ready: true, guest, notice: deviceRefusal() || undefined });
    })();
    return () => { live = false; };
  }, []);

  if (!state.ready) return <div aria-busy="true" style={{ minHeight: "100svh", background: "radial-gradient(120% 90% at 50% 0%, #5a3a4b, #3b2531 45%, #22141c)" }} />;
  return <InvitationExperience invitation={ourLoveStory} guest={state.guest} notice={state.notice} shareUrl={typeof window !== "undefined" ? `${window.location.origin}/` : undefined} />;
}
