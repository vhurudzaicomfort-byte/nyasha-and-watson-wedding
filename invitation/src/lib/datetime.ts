/**
 * Time-zone aware helpers. The ceremony time is stored as a local wall-clock
 * time in the invitation's time zone; these functions convert it to an exact
 * instant so the countdown and calendar entries are correct for every guest,
 * wherever they are in the world.
 */

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

/** Offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = partsFormatter(timeZone).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/**
 * Convert a local date ("2030-02-14") and time ("10:00") in `timeZone` to a
 * UTC `Date`. Iterates twice to settle on DST boundaries.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  let guess = naive - tzOffsetMs(naive, timeZone);
  guess = naive - tzOffsetMs(guess, timeZone);
  return new Date(guess);
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Total milliseconds remaining (negative once the moment has passed). */
  totalMs: number;
}

export function getCountdown(target: Date, now: Date = new Date()): Countdown {
  const totalMs = target.getTime() - now.getTime();
  const clamped = Math.max(totalMs, 0);
  const seconds = Math.floor(clamped / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    totalMs,
  };
}

/** "Saturday" for a given calendar date in the event's time zone. */
export function weekdayName(date: string, timeZone: string): string {
  const d = zonedTimeToUtc(date, "12:00", timeZone);
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone }).format(d);
}

/** "14 February 2030" */
export function longDate(date: string, timeZone: string): string {
  const d = zonedTimeToUtc(date, "12:00", timeZone);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(d);
}

/** { day: "14", month: "February", year: "2030" } */
export function dateParts(date: string, timeZone: string) {
  const d = zonedTimeToUtc(date, "12:00", timeZone);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { ...opts, timeZone }).format(d);
  return {
    day: fmt({ day: "2-digit" }),
    month: fmt({ month: "long" }),
    monthShort: fmt({ month: "short" }),
    year: fmt({ year: "numeric" }),
    weekday: fmt({ weekday: "long" }),
  };
}

/** "10:00 AM" from "10:00". */
export function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Dotted numeric form used on the cover: "14.02.2030". */
export function dottedDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}
