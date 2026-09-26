// The last day of the Iron Age runs from dawn to midnight. Time is kept in game minutes since dawn.

export const DAWN_HOUR = 6;
export const DAY_MINUTES = (24 - DAWN_HOUR) * 60; // 06:00 → 24:00

/** Real seconds per game minute. 1 → an 18-minute day, close to the concept's ~20 minutes. */
export const DEFAULT_SECONDS_PER_MINUTE = 1;

export class DayClock {
  minute: number;
  paused = false;
  speed = 1;
  /** When the day ends. The wind brings it closer (see endMinuteForWind). */
  endMinute = DAY_MINUTES;
  /** Real seconds per game minute; the "length of the last day" setting changes it. */
  secondsPerMinute = DEFAULT_SECONDS_PER_MINUTE;

  constructor(minute = 0) {
    this.minute = minute;
  }

  /** Advances by real seconds; returns true on the tick the day runs out. */
  tick(realSeconds: number): boolean {
    if (this.paused || this.isOver) return false;
    this.minute = Math.min(this.endMinute, this.minute + (realSeconds * this.speed) / this.secondsPerMinute);
    return this.isOver;
  }

  /** Spends game time on an action (a conversation, a careful look). */
  spend(minutes: number): void {
    this.minute = Math.min(this.endMinute, this.minute + minutes);
  }

  get isOver(): boolean {
    return this.minute >= this.endMinute;
  }

  /** 0..1 through the day. */
  get progress(): number {
    return this.minute / DAY_MINUTES;
  }

  /** Hour of the day on a 24h clock, e.g. 13 for 13:xx. */
  get hour(): number {
    return DAWN_HOUR + Math.floor(this.minute / 60);
  }

  label(): string {
    const total = DAWN_HOUR * 60 + Math.floor(this.minute);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}

/** Game minutes since dawn for a 24h clock time, e.g. at(12) = noon. */
export function at(hour: number, minute = 0): number {
  return (hour - DAWN_HOUR) * 60 + minute;
}

/** Every full third of wind brings midnight one hour closer. */
export function endMinuteForWind(wind: number): number {
  const gusts = Math.min(3, Math.floor(wind * 3 + 1e-9));
  return DAY_MINUTES - gusts * 60;
}

/** Roman hour numeral as Leont would read it on a sundial (I = first hour after dawn). */
export function sundialHour(minute: number): string {
  const n = Math.min(18, Math.floor(minute / 60) + 1);
  const numerals: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let rest = n;
  let out = '';
  for (const [v, s] of numerals) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}
