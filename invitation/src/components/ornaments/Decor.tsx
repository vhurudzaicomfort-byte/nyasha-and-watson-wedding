"use client";

import { createContext, useContext } from "react";
import type { Invitation } from "@/invitations/types";
import { FloralCorner } from "./FloralCorner";
import { LeafSprig } from "./LeafSprig";

type Decor = NonNullable<Invitation["decor"]>;
export const DecorContext = createContext<Decor>({});

/**
 * One photographic floral, chosen per placement ("slot") from
 * `invitation.decor.slots`. Each slot's size, position, rotation and mirroring
 * lives in src/app/decor.css (keyed by data-slot), so the art direction for
 * every corner and edge is in one place.
 */
function SlotImage({ src, slot, className, style }: { src: string; slot: string; className?: string; style?: React.CSSProperties }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" aria-hidden="true" className={className} data-photo="slot" data-slot={slot} style={style} loading="lazy" decoding="async" />
  );
}

/**
 * Floral corner: the slot's photographic bouquet when configured, then the
 * shared corner image, otherwise the procedural SVG roses.
 */
export function CornerDecor(props: { id: string; slot?: string; className?: string; flip?: boolean; style?: React.CSSProperties }) {
  const { cornerImage, slots } = useContext(DecorContext);
  const slotSrc = props.slot ? slots?.[props.slot] : undefined;
  if (slotSrc) return <SlotImage src={slotSrc} slot={props.slot!} className={props.className} style={props.style} />;
  if (cornerImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cornerImage}
        alt=""
        aria-hidden="true"
        className={props.className}
        data-photo={props.flip ? "flip" : "plain"}
        style={props.style}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <FloralCorner {...props} />;
}

/** Leafy sprig: photographic when configured (per slot, then shared), otherwise SVG. */
export function SprigDecor(props: { slot?: string; className?: string; variant?: "gold" | "green"; flip?: boolean; style?: React.CSSProperties }) {
  const { sprigImage, slots } = useContext(DecorContext);
  const slotSrc = props.slot ? slots?.[props.slot] : undefined;
  if (slotSrc) return <SlotImage src={slotSrc} slot={props.slot!} className={props.className} style={props.style} />;
  if (sprigImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sprigImage}
        alt=""
        aria-hidden="true"
        className={props.className}
        data-photo={props.flip ? "flip" : "plain"}
        style={props.style}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <LeafSprig {...props} />;
}

/** The couple's gold wedding rings, used in place of "&" between the names. */
export function Rings({ className, label = "and" }: { className?: string; label?: string }) {
  const { ringsImage } = useContext(DecorContext);
  if (!ringsImage) return <span className={className}>&amp;</span>;
  return (
    <span className={className} data-rings="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ringsImage} alt={label} decoding="async" />
    </span>
  );
}
