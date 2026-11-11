"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Background music with two engines behind one interface:
 *  - `file`: an <audio loop> element when a licensed track is configured.
 *  - `ambient`: a soft generative harp-like score synthesised with Web Audio
 *    when no track is configured (no asset, no licensing, always available).
 *
 * Playback only ever starts from a user gesture (the envelope opening or the
 * play button), which satisfies browser autoplay policies.
 */
export interface MusicControls {
  available: boolean;
  playing: boolean;
  muted: boolean;
  play: () => Promise<void>;
  pause: () => void;
  toggle: () => Promise<void>;
  toggleMute: () => void;
}

interface Engine {
  start(): Promise<void>;
  stop(): void;
  setMuted(m: boolean): void;
  dispose(): void;
}

function fileEngine(src: string): Engine {
  const el = new Audio(src);
  el.loop = true;
  el.preload = "auto";
  el.volume = 0.55;
  return {
    async start() {
      await el.play();
    },
    stop() {
      el.pause();
    },
    setMuted(m) {
      el.muted = m;
    },
    dispose() {
      el.pause();
      el.src = "";
    },
  };
}

/** Generative ambient engine. */
function ambientEngine(): Engine {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muteGain: GainNode | null = null;
  let timer: number | null = null;
  let nextTime = 0;
  let step = 0;
  let padOscs: OscillatorNode[] = [];
  let padGain: GainNode | null = null;

  // D major palette: I – vi – IV – V, voiced warmly.
  const chords = [
    [50, 57, 62, 66, 69], // D  (D A D F# A)
    [47, 54, 59, 62, 66], // Bm (B F# B D F#)
    [43, 50, 55, 59, 62], // G  (G D G B D)
    [45, 52, 57, 61, 64], // A  (A E A C# E)
  ];
  const STEP = 0.6; // seconds between notes
  const CHORD_STEPS = 10;
  const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

  let rnd = 12345;
  const rand = () => {
    rnd = (rnd * 1664525 + 1013904223) >>> 0;
    return rnd / 4294967296;
  };

  function makeReverb(c: AudioContext): ConvolverNode {
    const len = Math.floor(c.sampleRate * 2.8);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
    }
    const conv = c.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    muteGain = ctx.createGain();
    muteGain.gain.value = 1;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 3200;

    const reverb = makeReverb(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    const dry = ctx.createGain();
    dry.gain.value = 0.8;

    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    delay.connect(fb).connect(delay);

    master.connect(lp);
    lp.connect(dry).connect(muteGain);
    lp.connect(reverb).connect(wet).connect(muteGain);
    lp.connect(delay).connect(wet);
    muteGain.connect(ctx.destination);

    // Soft sustained pad underneath the arpeggio.
    padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    padGain.connect(master);
  }

  function pluck(time: number, note: number, vel: number) {
    if (!ctx || !master) return;
    const freq = midi(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vel, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 2.6);

    const o1 = ctx.createOscillator();
    o1.type = "triangle";
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = freq * 2;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;

    o1.connect(g);
    o2.connect(g2).connect(g);
    g.connect(master);
    o1.start(time);
    o2.start(time);
    o1.stop(time + 2.8);
    o2.stop(time + 2.8);
  }

  function setPad(time: number, chord: number[]) {
    if (!ctx || !padGain) return;
    padOscs.forEach((o) => {
      try {
        o.stop(time + 1.2);
      } catch {
        /* already stopped */
      }
    });
    padOscs = [chord[0], chord[2]].map((n, i) => {
      const o = ctx!.createOscillator();
      o.type = "sine";
      o.frequency.value = midi(n) * (i === 0 ? 1 : 1.002);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(1, time + 1.5);
      o.connect(g).connect(padGain!);
      o.start(time);
      return o;
    });
  }

  function schedule() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.8) {
      const chord = chords[Math.floor(step / CHORD_STEPS) % chords.length];
      if (step % CHORD_STEPS === 0) setPad(nextTime, chord);
      // Sparse, slightly humanised arpeggio with occasional rests.
      if (rand() > 0.22) {
        const idx = Math.min(chord.length - 1, Math.floor(rand() * chord.length));
        const octave = rand() > 0.7 ? 12 : 0;
        pluck(nextTime + rand() * 0.04, chord[idx] + octave, 0.16 + rand() * 0.1);
      }
      if (step % CHORD_STEPS === CHORD_STEPS - 2 && rand() > 0.5) {
        pluck(nextTime + 0.3, chord[4] + 12, 0.1);
      }
      nextTime += STEP;
      step++;
    }
  }

  return {
    async start() {
      ensure();
      if (!ctx || !master) return;
      if (ctx.state === "suspended") await ctx.resume();
      nextTime = Math.max(nextTime, ctx.currentTime + 0.05);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2.5);
      if (timer === null) {
        schedule();
        timer = window.setInterval(schedule, 200);
      }
    },
    stop() {
      if (!ctx || !master) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    },
    setMuted(m) {
      if (!ctx || !muteGain) return;
      muteGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
    },
    dispose() {
      if (timer !== null) window.clearInterval(timer);
      ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}

export function useMusic(src?: string): MusicControls {
  const engine = useRef<Engine | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(typeof window !== "undefined" && (Boolean(src) || "AudioContext" in window || "webkitAudioContext" in window));
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [src]);

  const get = useCallback(() => {
    if (!engine.current) engine.current = src ? fileEngine(src) : ambientEngine();
    return engine.current;
  }, [src]);

  const play = useCallback(async () => {
    try {
      await get().start();
      setPlaying(true);
    } catch (err) {
      console.warn("[music] could not start playback", err);
      setPlaying(false);
    }
  }, [get]);

  const pause = useCallback(() => {
    engine.current?.stop();
    setPlaying(false);
  }, []);

  const toggle = useCallback(async () => (playing ? pause() : play()), [playing, pause, play]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      engine.current?.setMuted(!m);
      return !m;
    });
  }, []);

  // Pause when the tab is hidden; resume state is left to the guest.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && playing) pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [playing, pause]);

  return { available, playing, muted, play, pause, toggle, toggleMute };
}
