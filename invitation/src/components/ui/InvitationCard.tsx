"use client";

import { useState } from "react";
import type { GuestContext, Invitation } from "@/invitations/types";
import { Button } from "./Button";
import { DownloadIcon } from "./Icons";
import { useToast } from "./Toast";

/**
 * The guest's own printable invitation: an A5 PDF in the design of the opening
 * screen, with the venue linked to Google Maps, the phone numbers dialable and
 * a QR code + web address that open this guest's personal invitation.
 *
 * The drawing lives in the site's /assets/js/wn-invitation-pdf.js, which the
 * wedding portal uses too, so guests and the couple get the same card.
 */
interface InvitationPdf {
  download(guests: { name: string; link: string }[], fileName: string): Promise<Blob>;
  fileName(name?: string): string;
}

let loader: Promise<InvitationPdf> | null = null;
function invitationPdf(): Promise<InvitationPdf> {
  const w = window as unknown as { WNInvitationPDF?: InvitationPdf };
  if (w.WNInvitationPDF) return Promise.resolve(w.WNInvitationPDF);
  if (!loader) {
    loader = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/assets/js/wn-invitation-pdf.js";
      s.async = true;
      s.onload = () => (w.WNInvitationPDF ? resolve(w.WNInvitationPDF) : reject(new Error("PDF maker missing")));
      s.onerror = () => {
        loader = null;
        reject(new Error("PDF maker could not load"));
      };
      document.head.appendChild(s);
    });
  }
  return loader;
}

export function InvitationCardButton({ guest }: { invitation: Invitation; guest: GuestContext | null }) {
  const [busy, setBusy] = useState(false);
  const { show } = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const link = `${window.location.origin}/${guest ? `?g=${encodeURIComponent(guest.code)}` : ""}`;
      const pdf = await invitationPdf();
      const name = guest?.displayName || "";
      await pdf.download([{ name, link }], pdf.fileName(name));
      show("Your invitation is saved");
    } catch (err) {
      console.warn("[invitation pdf]", err);
      show("Sorry, the invitation could not be created on this device");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" icon={<DownloadIcon />} onClick={() => void save()} disabled={busy}>
      {busy ? "Preparing…" : "Save invitation (PDF)"}
    </Button>
  );
}
