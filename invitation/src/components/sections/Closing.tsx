"use client";

import type { GuestContext, Invitation } from "@/invitations/types";
import { InvitationCardButton } from "@/components/ui/InvitationCard";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { ShareButton } from "@/components/ui/ShareButton";
import { ReplayIcon } from "@/components/ui/Icons";
import { Flourish } from "@/components/ornaments/Flourish";
import { Rings, SprigDecor } from "@/components/ornaments/Decor";
import { celebrate } from "@/components/ui/Petals";
import styles from "./Closing.module.css";

interface Props {
  invitation: Invitation;
  onReplay?: () => void;
  shareUrl?: string;
  guest?: GuestContext | null;
}

export function Closing({ invitation, onReplay, shareUrl, guest = null }: Props) {
  const { couple } = invitation;
  return (
    <footer className={styles.footer}>
      <SprigDecor slot="closing-l" variant="gold" className={`${styles.sprig} ${styles.sprigL}`} />
      <SprigDecor slot="closing-r" variant="gold" flip className={`${styles.sprig} ${styles.sprigR}`} />
      <Reveal className={styles.inner}>
        <Flourish color="var(--gold)" width={180} />
        <p className={styles.with}>With love,</p>
        <button
          type="button"
          className={`script ${styles.signature}`}
          onClick={(e) => celebrate({ x: e.clientX, y: e.clientY })}
          aria-label="Tap to send petals"
          title="Tap to send petals"
        >
          {couple.partnerOne.split(" ")[0]} <Rings className={styles.amp} /> {couple.partnerTwo.split(" ")[0]}
        </button>
        <p className={styles.tapHint}>Tap our names to send us petals</p>
        <p className={styles.closing}>{invitation.closingLine}</p>
        <div className={styles.actions}>
          {onReplay && (
            <Button variant="outline" size="sm" icon={<ReplayIcon />} onClick={onReplay} className={styles.replay}>
              Replay invitation
            </Button>
          )}
          <InvitationCardButton invitation={invitation} guest={guest} />
          <ShareButton
            variant="ghost"
            title={`Wedding of ${couple.partnerOne} & ${couple.partnerTwo}`}
            text={`${invitation.invitationLine} ${invitation.title} – ${couple.partnerOne} & ${couple.partnerTwo}.`}
            url={shareUrl}
          />
        </div>
        <p className={styles.powered}>
          Crafted with <span aria-hidden="true">♥</span> · eGuest
        </p>
      </Reveal>
    </footer>
  );
}
