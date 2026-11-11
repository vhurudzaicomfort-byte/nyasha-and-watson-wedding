"use client";

import { useState } from "react";
import type { Invitation } from "@/invitations/types";
import { mapsDirectionsUrl, mapsEmbedUrl, mapsSearchUrl } from "@/lib/maps";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { CopyIcon, MapPinIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { useInvitationEnv } from "@/components/invitation/env";
import styles from "./Directions.module.css";

export function Directions({ invitation }: { invitation: Invitation }) {
  const { venue } = invitation;
  const [showMap, setShowMap] = useState(false);
  const { allowEmbeds } = useInvitationEnv();
  const toast = useToast();
  const address = `${venue.name}, ${venue.addressLine}, ${venue.city}, ${venue.country}`;
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address);
      toast.show("Address copied");
    } catch {
      toast.show(address);
    }
  };
  const dest = encodeURIComponent(venue.coordinates ? `${venue.coordinates.lat},${venue.coordinates.lng}` : venue.mapsQuery);
  const wazeUrl = `https://waze.com/ul?q=${dest}&navigate=yes`;
  const appleUrl = `https://maps.apple.com/?daddr=${dest}`;

  return (
    <section className={styles.section} id="directions" aria-labelledby="directions-title">
      <div className={styles.inner}>
        <SectionHeading label="Directions" id="directions-title" intro="If you are using Google Maps, tap below for turn-by-turn directions to the venue." />

        <Reveal className={styles.mapCard}>
          {showMap ? (
            <iframe
              className={styles.map}
              src={mapsEmbedUrl(venue)}
              title={`Map of ${venue.name}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              className={styles.placeholder}
              onClick={() => (allowEmbeds ? setShowMap(true) : window.open(mapsSearchUrl(venue), "_blank", "noopener"))}
            >
              <span className={styles.grid} aria-hidden="true" />
              <span className={styles.pin} aria-hidden="true">
                <MapPinIcon />
              </span>
              <span className={styles.placeholderText}>
                <strong>{venue.name}</strong>
                <span>
                  {venue.addressLine}, {venue.city}
                </span>
                <em>{allowEmbeds ? "Tap to load the map" : "Tap to open in Google Maps"}</em>
              </span>
            </button>
          )}
        </Reveal>

        <Reveal className={styles.actions} delay={0.1}>
          <Button variant="gold" icon={<MapPinIcon />} href={mapsDirectionsUrl(venue)}>
            Get directions
          </Button>
          <Button variant="outline" href={mapsSearchUrl(venue)}>
            Open in Google Maps
          </Button>
          <Button variant="outline" icon={<CopyIcon />} onClick={() => void copyAddress()}>
            Copy address
          </Button>
        </Reveal>
        <Reveal className={styles.alt} delay={0.15}>
          <span className="eyebrow">Prefer another app?</span>
          <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
            Waze
          </a>
          <span aria-hidden="true">·</span>
          <a href={appleUrl} target="_blank" rel="noopener noreferrer">
            Apple Maps
          </a>
        </Reveal>
      </div>
    </section>
  );
}
