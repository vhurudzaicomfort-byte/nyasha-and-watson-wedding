"use client";

import { useState } from "react";
import QRCode from "qrcode";
import type { GuestContext, Invitation } from "@/invitations/types";
import { dateParts, dottedDate, formatTime12h } from "@/lib/datetime";
import { Button } from "./Button";
import { DownloadIcon } from "./Icons";
import { useToast } from "./Toast";

/**
 * Personal invitation card (kept from the previous site, redrawn in the new
 * design): the gold rose frame, the couple's names with the wedding rings,
 * date, venue, the guest's name and a QR code to their own invitation link.
 * Drawn on a canvas in the browser and saved as a JPG.
 */
async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  // centred text with letter-spacing (canvas letterSpacing isn't everywhere yet)
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = align;
  return total;
}

export async function drawInvitationCard(invitation: Invitation, guest: GuestContext | null, link: string): Promise<HTMLCanvasElement> {
  const W = 1693, H = 923;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  await Promise.all(
    ['400 40px "Cormorant Garamond"', 'italic 400 40px "Cormorant Garamond"', '500 40px "Cormorant Garamond"', '400 40px "Pinyon Script"', '400 20px "Jost"', '500 20px "Jost"'].map((f) => document.fonts.load(f).catch(() => null)),
  );
  const { decor, couple, schedule, venue } = invitation;
  const [frame, rings] = await Promise.all([
    decor?.frameImage ? loadImage(decor.frameImage) : Promise.resolve(null),
    decor?.ringsImage ? loadImage(decor.ringsImage) : Promise.resolve(null),
  ]);

  // paper
  const bg = ctx.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H / 2, W * 0.62);
  bg.addColorStop(0, "#fffdf8");
  bg.addColorStop(1, "#f4ede1");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  if (frame) ctx.drawImage(frame, 0, 0, W, H);

  const plum = "#3b2531", gold = "#9c7e46", soft = "#6b5a63";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = gold;
  ctx.font = '500 19px "Jost"';
  spaced(ctx, invitation.invitationLine.toUpperCase(), W / 2, 150, 6);

  ctx.fillStyle = plum;
  ctx.font = '400 104px "Pinyon Script"';
  ctx.fillText(invitation.title, W / 2, 262);

  // names with the rings between them
  ctx.font = '500 44px "Cormorant Garamond"';
  ctx.fillStyle = plum;
  const one = couple.partnerOne.toUpperCase(), two = couple.partnerTwo.toUpperCase();
  const sp = 9;
  const w1 = [...one].reduce((s, c) => s + ctx.measureText(c).width + sp, -sp);
  const w2 = [...two].reduce((s, c) => s + ctx.measureText(c).width + sp, -sp);
  const ringH = 58, ringW = rings ? (rings.width / rings.height) * ringH : 40, gap = 30;
  const total = w1 + gap + ringW + gap + w2;
  let x = W / 2 - total / 2;
  const ny = 352;
  spaced(ctx, one, x + w1 / 2, ny, sp);
  x += w1 + gap;
  if (rings) {
    ctx.save();
    ctx.shadowColor = "rgba(60, 30, 20, 0.28)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.drawImage(rings, x, ny - ringH + 12, ringW, ringH);
    ctx.restore();
  } else {
    ctx.fillText("&", x + ringW / 2, ny);
  }
  x += ringW + gap;
  spaced(ctx, two, x + w2 / 2, ny, sp);

  // gold rule
  ctx.strokeStyle = "rgba(196, 164, 106, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 210, 398); ctx.lineTo(W / 2 - 14, 398); ctx.moveTo(W / 2 + 14, 398); ctx.lineTo(W / 2 + 210, 398); ctx.stroke();
  ctx.fillStyle = "#c4a46a";
  ctx.beginPath(); ctx.moveTo(W / 2, 391); ctx.lineTo(W / 2 + 6, 398); ctx.lineTo(W / 2, 405); ctx.lineTo(W / 2 - 6, 398); ctx.closePath(); ctx.fill();

  ctx.fillStyle = plum;
  ctx.font = '400 62px "Cormorant Garamond"';
  spaced(ctx, dottedDate(schedule.date), W / 2, 478, 8);

  const p = dateParts(schedule.date, schedule.timeZone);
  ctx.fillStyle = soft;
  ctx.font = '400 19px "Jost"';
  spaced(ctx, `${(schedule.weekdayLabel ?? p.weekday).toUpperCase()} · ARRIVE ${formatTime12h(schedule.arrivalTime || schedule.startTime).toUpperCase()} · CEREMONY ${formatTime12h(schedule.startTime).toUpperCase()}`, W / 2, 530, 4);

  ctx.fillStyle = plum;
  ctx.font = 'italic 400 38px "Cormorant Garamond"';
  ctx.fillText(venue.name, W / 2, 598);
  ctx.fillStyle = soft;
  ctx.font = '400 18px "Jost"';
  spaced(ctx, `${venue.addressLine}, ${venue.city}`.toUpperCase(), W / 2, 636, 3);

  if (guest) {
    ctx.fillStyle = gold;
    ctx.font = '400 50px "Pinyon Script"';
    ctx.fillText(`Dear ${guest.displayName}`, W / 2, 722);
  }

  // QR to the guest's own invitation, bottom-left inside the frame
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, link, { margin: 1, width: 168, color: { dark: plum, light: "#fffdf8" } });
  const qx = 150, qy = H - 330;
  ctx.fillStyle = "#fffdf8";
  ctx.strokeStyle = "rgba(196, 164, 106, 0.7)";
  ctx.lineWidth = 1.5;
  ctx.fillRect(qx - 10, qy - 10, 188, 188);
  ctx.strokeRect(qx - 10, qy - 10, 188, 188);
  ctx.drawImage(qr, qx, qy, 168, 168);
  ctx.fillStyle = soft;
  ctx.font = '500 14px "Jost"';
  spaced(ctx, "SCAN FOR YOUR INVITATION", qx + 84, qy + 206, 2.5);
  return canvas;
}

export function InvitationCardButton({ invitation, guest }: { invitation: Invitation; guest: GuestContext | null }) {
  const [busy, setBusy] = useState(false);
  const { show } = useToast();
  const save = async () => {
    setBusy(true);
    try {
      const link = `${window.location.origin}/${guest ? `?g=${encodeURIComponent(guest.code)}` : ""}`;
      const canvas = await drawInvitationCard(invitation, guest, link);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.93));
      if (!blob) throw new Error("no image");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const first = invitation.couple.partnerOne.split(" ")[0], second = invitation.couple.partnerTwo.split(" ")[0];
      a.download = `${first}-${second}-Invitation${guest ? "-" + guest.displayName.replace(/[^\p{L}\p{N}]+/gu, "-") : ""}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      show("Your invitation card is saved");
    } catch {
      show("Sorry, the card could not be created on this device");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="outline" size="sm" icon={<DownloadIcon />} onClick={() => void save()} disabled={busy}>
      {busy ? "Preparing…" : "Save invitation card"}
    </Button>
  );
}
