"use client";

import type { MusicControls } from "@/hooks/useMusic";
import { MuteIcon, PauseIcon, PlayIcon, VolumeIcon } from "./Icons";
import styles from "./MusicControl.module.css";

/** Floating play/pause + mute pill. Always visible once the invitation is open. */
export function MusicControl({ music }: { music: MusicControls }) {
  if (!music.available) return null;
  return (
    <div className={styles.pill} role="group" aria-label="Background music">
      <button
        type="button"
        className={`${styles.btn} ${music.playing ? styles.active : ""}`}
        onClick={() => void music.toggle()}
        aria-pressed={music.playing}
        aria-label={music.playing ? "Pause music" : "Play music"}
        title={music.playing ? "Pause music" : "Play music"}
      >
        {music.playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <span className={styles.bars} aria-hidden="true" data-playing={music.playing && !music.muted}>
        <i />
        <i />
        <i />
        <i />
      </span>
      <button
        type="button"
        className={styles.btn}
        onClick={music.toggleMute}
        aria-pressed={music.muted}
        aria-label={music.muted ? "Unmute music" : "Mute music"}
        title={music.muted ? "Unmute music" : "Mute music"}
      >
        {music.muted ? <MuteIcon /> : <VolumeIcon />}
      </button>
    </div>
  );
}
