/**
 * New York trading hours, for the clock on the ticker tape. The NYSE and Nasdaq share one
 * calendar: weekdays 9:30 to 16:00 Eastern, closed on nine holidays, and closing at 13:00 on
 * three half days. Unscheduled closures (a day of mourning, a storm) can't be known here.
 */

const DAY = 86_400_000;
const OPEN = 9 * 60 + 30;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Calendar dates as UTC midnights, so day arithmetic never meets a clock change. */
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);
const weekday = (t: number) => new Date(t).getUTCDay();

/** The nth given weekday of a month; n = -1 means the last one. */
function nth(y: number, m: number, day: number, n: number): number {
  if (n > 0) {
    const first = utc(y, m, 1);
    return first + (((day - weekday(first) + 7) % 7) + (n - 1) * 7) * DAY;
  }
  const last = utc(y, m + 1, 0);
  return last - ((weekday(last) - day + 7) % 7) * DAY;
}

/** Easter Sunday (Gregorian), by the anonymous algorithm. */
function easter(y: number): number {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}

/** A fixed-date holiday moves to Friday from a Saturday and to Monday from a Sunday. */
function observed(t: number): number {
  const w = weekday(t);
  return w === 6 ? t - DAY : w === 0 ? t + DAY : t;
}

function holidays(y: number): Set<number> {
  const newYear = utc(y, 1, 1);
  const days = [
    nth(y, 1, 1, 3), // Martin Luther King Jr. Day
    nth(y, 2, 1, 3), // Washington's Birthday
    easter(y) - 2 * DAY, // Good Friday
    nth(y, 5, 1, -1), // Memorial Day
    observed(utc(y, 6, 19)), // Juneteenth
    observed(utc(y, 7, 4)), // Independence Day
    nth(y, 9, 1, 1), // Labor Day
    nth(y, 11, 4, 4), // Thanksgiving
    observed(utc(y, 12, 25)), // Christmas
  ];
  // New Year's Day on a Saturday is not moved back into the old year.
  if (weekday(newYear) !== 6) days.push(observed(newYear));
  return new Set(days);
}

/** Minutes after midnight at which trading ends that day, or null if the market is shut. */
export function closingMinute(y: number, m: number, d: number): number | null {
  const t = utc(y, m, d);
  const w = weekday(t);
  if (w === 0 || w === 6 || holidays(y).has(t)) return null;
  const half = t === nth(y, 11, 4, 4) + DAY || t === utc(y, 12, 24) || t === utc(y, 7, 3);
  return half ? 13 * 60 : 16 * 60;
}

const NY = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

const two = (n: number) => String(n).padStart(2, '0');
const span = (minutes: number) => (minutes >= 60 ? `${Math.floor(minutes / 60)}h ${two(minutes % 60)}m` : `${minutes}m`);

export interface Session {
  open: boolean;
  /** New York wall-clock time, "09:41:07". */
  time: string;
  /** What happens next: "Closing bell in 2h 14m", "Opens Mon 9:30". */
  next: string;
}

export function session(now: Date): Session {
  const p = Object.fromEntries(NY.formatToParts(now).map((x) => [x.type, Number(x.value)]));
  const time = `${two(p.hour)}:${two(p.minute)}:${two(p.second)}`;
  const minute = p.hour * 60 + p.minute;
  const close = closingMinute(p.year, p.month, p.day);
  if (close !== null && minute < OPEN) return { open: false, time, next: `Opening bell in ${span(OPEN - minute)}` };
  if (close !== null && minute < close) return { open: true, time, next: `Closing bell in ${span(close - minute)}` };
  for (let t = utc(p.year, p.month, p.day) + DAY; ; t += DAY) {
    const d = new Date(t);
    if (closingMinute(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) !== null) return { open: false, time, next: `Opens ${WEEKDAYS[d.getUTCDay()]} 9:30` };
  }
}
