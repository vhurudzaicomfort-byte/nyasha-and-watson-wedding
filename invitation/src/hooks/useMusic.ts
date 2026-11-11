"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MusicTrackOptions } from "@/invitations/types";

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

type AudioCtor = typeof AudioContext;
const audioCtor = (): AudioCtor | undefined =>
  typeof window === "undefined"
    ? undefined
    : window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;

/** The first of src / fallbackSrc this browser can play. */
function pickSource(src: string, opts: MusicTrackOptions): string {
  if (!opts.fallbackSrc || typeof document === "undefined") return src;
  const probe = document.createElement("audio");
  const type = (u: string) => (/\.m4a$|\.mp4$|\.aac$/i.test(u) ? 'audio/mp4; codecs="mp4a.40.2"' : /\.mp3$/i.test(u) ? "audio/mpeg" : /\.ogg$|\.opus$/i.test(u) ? 'audio/ogg; codecs="opus"' : "");
  const t = type(src);
  return !t || probe.canPlayType(t) ? src : opts.fallbackSrc;
}

/** Downloads are shared, so prefetching on page load and playing later reuse one request. */
const bytesCache = new Map<string, Promise<ArrayBuffer>>();
function fetchBytes(url: string): Promise<ArrayBuffer> {
  let p = bytesCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`music ${r.status}`);
      return r.arrayBuffer();
    });
    p.catch(() => bytesCache.delete(url));
    bytesCache.set(url, p);
  }
  return p;
}

/**
 * S-shaped fade curves. A rising and a falling curve over the same span always
 * add up to exactly 1, so beat-matched passes cross without a swell or a dip.
 */
function curve(up: boolean): Float32Array {
  const c = new Float32Array(64);
  for (let i = 0; i < c.length; i++) {
    const t = i / (c.length - 1);
    const rise = (1 - Math.cos(Math.PI * t)) / 2;
    c[i] = up ? rise : 1 - rise;
  }
  return c;
}

/**
 * Music file played through Web Audio: a gentle fade-in, a beat-matched
 * cross-fade at every loop (no gap, no cut), fades on pause/resume, and gain
 * nodes for volume and mute, which, unlike <audio>.volume, also work on iPhone.
 */
function fileEngine(src: string, opts: MusicTrackOptions): Engine {
  const url = pickSource(src, opts);
  const volume = opts.volume ?? 0.5;
  const firstFade = opts.firstFade ?? 3;
  const XF = 2.0; // loop cross-fade: the new pass rises while the old one falls, over the same 2 s
  let ctx: AudioContext | null = null;
  let level: GainNode | null = null; // pause / resume fades and overall volume
  let muteGain: GainNode | null = null;
  let buffer: AudioBuffer | null = null;
  let nextAt = -1; // context time at which the next pass begins
  let timer: number | null = null;
  let suspendTimer: number | null = null;
  let disposed = false;
  let wanted = false; // false once paused, even if that happens while the track is still decoding

  function ensure() {
    if (ctx) return ctx;
    const AC = audioCtor();
    if (!AC) throw new Error("Web Audio unavailable");
    // iPhone: play like normal media (not muted by the ring/silent switch, like a video would be).
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = "playback";
      } catch {
        /* older Safari */
      }
    }
    ctx = new AC();
    level = ctx.createGain();
    level.gain.value = 0;
    muteGain = ctx.createGain();
    level.connect(muteGain).connect(ctx.destination);
    return ctx;
  }

  async function decode(c: AudioContext): Promise<AudioBuffer> {
    const bytes = (await fetchBytes(url)).slice(0); // decodeAudioData detaches its input
    return new Promise((resolve, reject) => c.decodeAudioData(bytes, resolve, reject));
  }

  function addPass(when: number, offset: number, fadeIn: number) {
    if (!ctx || !level || !buffer) return;
    const loopAt = Math.min(opts.loopAt ?? buffer.duration - XF, buffer.duration - XF);
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    const g = ctx.createGain();
    // Curves run 0→1 and 1→0 themselves; extra events at the same instants make Chrome throw.
    g.gain.setValueCurveAtTime(curve(true), when, fadeIn);
    const fadeOutAt = when + (loopAt - offset);
    g.gain.setValueCurveAtTime(curve(false), fadeOutAt, XF);
    s.connect(g).connect(level);
    s.start(when, offset);
    s.stop(fadeOutAt + XF + 0.05);
    s.onended = () => g.disconnect();
    nextAt = fadeOutAt;
  }

  /** Keeps the following pass booked well ahead, so slow timers never leave a gap. */
  function schedule() {
    if (!ctx || !buffer) return;
    const loopIn = opts.loopIn ?? 0;
    while (nextAt - ctx.currentTime < 8) addPass(nextAt, loopIn, XF);
  }

  function ramp(to: number, seconds: number) {
    if (!ctx || !level) return;
    const now = ctx.currentTime;
    level.gain.cancelScheduledValues(now);
    level.gain.setValueAtTime(level.gain.value, now);
    level.gain.linearRampToValueAtTime(to, now + seconds);
  }

  return {
    async start() {
      // Everything up to the first await runs inside the guest's tap, which is
      // what lets browsers (Safari especially) allow sound.
      const c = ensure();
      wanted = true;
      if (suspendTimer !== null) {
        window.clearTimeout(suspendTimer);
        suspendTimer = null;
      }
      const resumed = c.state === "running" ? Promise.resolve() : c.resume();
      if (!buffer) {
        const unlock = c.createBufferSource(); // older iOS: a silent blip in the gesture unlocks output
        unlock.buffer = c.createBuffer(1, 1, 22050);
        unlock.connect(c.destination);
        unlock.start(0);
      }
      await resumed;
      if (!buffer) buffer = await decode(c);
      if (disposed || !wanted) return;
      if (nextAt < 0) {
        addPass(c.currentTime + 0.05, 0, firstFade); // first play: from the lead-in, fading in
        schedule();
        level!.gain.setValueAtTime(volume, c.currentTime);
      } else {
        ramp(volume, 1.2); // resume where it paused
      }
      if (timer === null) timer = window.setInterval(schedule, 1000);
    },
    stop() {
      wanted = false;
      if (!ctx) return;
      ramp(0, 0.9);
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      const c = ctx;
      // Freeze the clock once the fade is done: scheduled passes simply wait, and play resumes in place.
      suspendTimer = window.setTimeout(() => {
        suspendTimer = null;
        void c.suspend().catch(() => undefined);
      }, 1000);
    },
    setMuted(m) {
      if (!ctx || !muteGain) return;
      muteGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.08);
    },
    dispose() {
      disposed = true;
      if (timer !== null) window.clearInterval(timer);
      if (suspendTimer !== null) window.clearTimeout(suspendTimer);
      void ctx?.close().catch(() => undefined);
      ctx = null;
    },
  };
}

/** Last resort when Web Audio can't decode the file: a plain looping <audio>. */
function elementEngine(src: string, opts: MusicTrackOptions): Engine {
  const el = new Audio(pickSource(src, opts));
  el.loop = true;
  el.preload = "auto";
  el.volume = opts.volume ?? 0.5;
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
      el.removeAttribute("src");
      el.load();
    },
  };
}

/** Web Audio engine that quietly hands over to <audio> if the file can't be decoded. */
function trackEngine(src: string, opts: MusicTrackOptions): Engine {
  let active: Engine = audioCtor() ? fileEngine(src, opts) : elementEngine(src, opts);
  let muted = false;
  return {
    async start() {
      try {
        await active.start();
      } catch (err) {
        console.warn("[music] Web Audio playback failed, using <audio>", err);
        active.dispose();
        active = elementEngine(src, opts);
        active.setMuted(muted);
        await active.start();
      }
    },
    stop: () => active.stop(),
    setMuted(m) {
      muted = m;
      active.setMuted(m);
    },
    dispose: () => active.dispose(),
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

export function useMusic(src?: string, options?: MusicTrackOptions): MusicControls {
  const engine = useRef<Engine | null>(null);
  const opts = useRef<MusicTrackOptions>(options || {});
  opts.current = options || {};
  const intent = useRef(0); // bumps on every play/pause so a slow start can't override a later pause
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    setAvailable(typeof window !== "undefined" && (Boolean(src) || "AudioContext" in window || "webkitAudioContext" in window));
    // Fetch the track quietly once the page has settled, so the music starts the moment the envelope opens.
    let cancelled = false;
    const later = () => {
      if (!src || cancelled) return;
      const url = pickSource(src, opts.current);
      window.setTimeout(() => !cancelled && void fetchBytes(url).catch(() => undefined), 1200);
    };
    if (src) {
      if (document.readyState === "complete") later();
      else window.addEventListener("load", later, { once: true });
    }
    return () => {
      cancelled = true;
      window.removeEventListener("load", later);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [src]);

  const get = useCallback(() => {
    if (!engine.current) engine.current = src ? trackEngine(src, opts.current) : ambientEngine();
    return engine.current;
  }, [src]);

  const play = useCallback(async () => {
    const mine = ++intent.current;
    try {
      await get().start();
      if (mine !== intent.current) return;
      setPlaying(true);
    } catch (err) {
      console.warn("[music] could not start playback", err);
      if (mine === intent.current) setPlaying(false);
    }
  }, [get]);

  const pause = useCallback(() => {
    intent.current++;
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
