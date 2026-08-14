/**
 * Times and durations, written the way a QC sheet reads them.
 *
 * Two decisions shape this file.
 *
 * **The clock is an argument.** Nothing here calls `Date.now()`. "12 phút
 * trước" is a statement about two instants, and a function that fetches the
 * second one itself cannot be tested without freezing global time — a trick
 * that leaks across test files. Every entry point takes `now`, so a test states
 * both instants and the history panel passes the clock it already ticks on.
 *
 * **No date library.** `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat` ship
 * with the runtime and already know that Vietnamese writes `03/08/2026` and
 * `12 phút trước`; a formatting dependency would add weight to the bundle to
 * restate what the platform says. Durations are the one exception: they are
 * composed by hand because `Intl.DurationFormat` writes `"2 phút, 15 giây"`
 * with a comma, and is still missing from browsers this app supports.
 *
 * Time zones travel with the format. A calendar day is only "today" relative to
 * a zone, so `isSameCalendarDay` and the formatters read the *same* `timeZone`
 * option — otherwise a timestamp could be shown as `14:32` (today, per the
 * system zone) while the day comparison that chose that shape used another.
 */

import { formatNumber, MISSING_VALUE } from './number';

/** The one locale every formatter in this module is built with. */
const LOCALE = 'vi-VN';

/** An instant, or one of the ways an instant goes missing. */
export type TimeInput = Date | number | null | undefined;

/** Shown instead of a relative phrase when the gap is too small to name. */
export const JUST_NOW_LABEL = 'vừa xong';

/** Shown for a processing time that finished faster than the unit can express. */
export const SUB_SECOND_LABEL = 'dưới 1 giây';

const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_MINUTE = 60 * MILLISECONDS_PER_SECOND;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

const HOUR_WORD = 'giờ';
const MINUTE_WORD = 'phút';
const SECOND_WORD = 'giây';

export interface TimestampFormatOptions {
  /**
   * IANA zone the timestamp is read in, such as `'Asia/Ho_Chi_Minh'`.
   *
   * Left out, the runtime's zone is used — right for a browser, wrong for a
   * test, which should name the zone so the expected string does not depend on
   * the machine running it.
   */
  readonly timeZone?: string;
}

/**
 * `Intl` formatters are expensive to build and cheap to reuse, and a history
 * list formats one timestamp per row on every render.
 */
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

function cachedDateTimeFormatter(
  key: string,
  base: Intl.DateTimeFormatOptions,
  timeZone: string | undefined,
): Intl.DateTimeFormat {
  const cacheKey = `${key}:${timeZone ?? ''}`;
  const cached = dateTimeFormatterCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  // Spread rather than `{ ...base, timeZone }`: under `exactOptionalPropertyTypes`
  // an explicit `undefined` is not the same as an absent key, and `Intl` reads
  // the key's presence.
  const created = new Intl.DateTimeFormat(LOCALE, timeZone === undefined ? base : { ...base, timeZone });
  dateTimeFormatterCache.set(cacheKey, created);
  return created;
}

let relativeFormatter: Intl.RelativeTimeFormat | undefined;

function minutesAgoFormatter(): Intl.RelativeTimeFormat {
  relativeFormatter ??= new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' });
  return relativeFormatter;
}

/** `14:32` — the 24-hour clock, which is the only one Vietnamese plans use. */
function clockFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  return cachedDateTimeFormatter('clock', { hour: '2-digit', minute: '2-digit', hour12: false }, timeZone);
}

/** `03/08/2026` — day first, as written on a drawing sheet. */
function calendarFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  return cachedDateTimeFormatter(
    'calendar',
    { day: '2-digit', month: '2-digit', year: 'numeric' },
    timeZone,
  );
}

/**
 * Reduce an instant to milliseconds since the epoch, or `null` when it is not
 * an instant at all.
 *
 * `new Date('nonsense')` is an `Date` whose time is `NaN`; it reaches here from
 * any API response with a malformed date, and must come out as missing rather
 * than as the string `"Invalid Date"`.
 */
function toEpochMilliseconds(value: TimeInput): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const milliseconds = value instanceof Date ? value.getTime() : value;
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * Whether two instants fall on the same calendar day in a given zone.
 *
 * Compared through the formatter rather than `getDate()` so the answer and the
 * displayed string are decided in one zone. A 24-hour window would be the wrong
 * test: 23:50 and 00:10 are ten minutes apart and belong to different days.
 */
export function isSameCalendarDay(left: TimeInput, right: TimeInput, timeZone?: string): boolean {
  const leftMs = toEpochMilliseconds(left);
  const rightMs = toEpochMilliseconds(right);
  if (leftMs === null || rightMs === null) {
    return false;
  }
  const formatter = calendarFormatter(timeZone);
  return formatter.format(leftMs) === formatter.format(rightMs);
}

/**
 * `14:32` — the time of day, with no date.
 *
 * This is the string the autosave indicator needs for "Đã lưu lúc 14:32".
 */
export function formatClockTime(value: TimeInput, options: TimestampFormatOptions = {}): string {
  const milliseconds = toEpochMilliseconds(value);
  if (milliseconds === null) {
    return MISSING_VALUE;
  }
  return clockFormatter(options.timeZone).format(milliseconds);
}

/** `03/08/2026` — the calendar date, with no time. */
export function formatCalendarDate(value: TimeInput, options: TimestampFormatOptions = {}): string {
  const milliseconds = toEpochMilliseconds(value);
  if (milliseconds === null) {
    return MISSING_VALUE;
  }
  return calendarFormatter(options.timeZone).format(milliseconds);
}

/**
 * Write an instant at the precision the reader needs, relative to `now`.
 *
 * The shape gets more specific as the gap widens, because that is the order the
 * questions are asked in: a change made seconds ago needs no time at all, one
 * made this morning needs the hour, one made last week needs the date.
 *
 * | gap from `now`      | shape               |
 * |---------------------|---------------------|
 * | under a minute      | `vừa xong`          |
 * | under an hour       | `12 phút trước`     |
 * | same calendar day   | `14:32`             |
 * | any other day       | `03/08/2026 14:32`  |
 *
 * A timestamp slightly ahead of the clock — the ordinary result of a server and
 * a browser disagreeing by seconds — is `vừa xong` rather than a phrase about
 * the future. A timestamp genuinely in the future falls through to the absolute
 * shapes, which state what it is without pretending to explain it.
 *
 * @param value The instant to write.
 * @param now The clock to measure against. Always passed in, never read from
 *   `Date.now()`, so the result is a pure function of its arguments.
 */
export function formatTimestamp(
  value: TimeInput,
  now: TimeInput,
  options: TimestampFormatOptions = {},
): string {
  const valueMs = toEpochMilliseconds(value);
  const nowMs = toEpochMilliseconds(now);
  if (valueMs === null || nowMs === null) {
    return MISSING_VALUE;
  }

  const elapsed = nowMs - valueMs;
  if (Math.abs(elapsed) < MILLISECONDS_PER_MINUTE) {
    return JUST_NOW_LABEL;
  }

  if (elapsed > 0 && elapsed < MILLISECONDS_PER_HOUR) {
    const minutes = Math.floor(elapsed / MILLISECONDS_PER_MINUTE);
    return minutesAgoFormatter().format(-minutes, 'minute');
  }

  const { timeZone } = options;
  const clock = clockFormatter(timeZone).format(valueMs);
  if (isSameCalendarDay(valueMs, nowMs, timeZone)) {
    return clock;
  }

  return `${calendarFormatter(timeZone).format(valueMs)} ${clock}`;
}

/** One unit of a duration, dropped from the sentence when it is zero. */
function durationPart(amount: number, word: string): string | null {
  return amount === 0 ? null : `${formatNumber(amount, { fractionDigits: 0 })} ${word}`;
}

/**
 * Write how long something took: `"2 phút 15 giây"`.
 *
 * Only the two largest units that carry information are written. Seconds are
 * dropped past an hour — nobody reads "1 giờ 5 phút 3 giây" off a pipeline
 * report — and a unit that is zero is left out entirely, so a round two minutes
 * is `"2 phút"`, not `"2 phút 0 giây"`.
 *
 * A duration below a second becomes {@link SUB_SECOND_LABEL} rather than
 * `"0 giây"`, which reads as though the step never ran. A negative duration is
 * not a duration and comes back as the missing-value placeholder.
 *
 * @param durationMs Elapsed time in milliseconds.
 *
 * @example
 * formatDuration(135_000)  // "2 phút 15 giây"
 * formatDuration(120_000)  // "2 phút"
 * formatDuration(45_000)   // "45 giây"
 * formatDuration(400)      // "dưới 1 giây"
 * formatDuration(null)     // "—"
 */
export function formatDuration(durationMs: number | null | undefined): string {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs < 0) {
    return MISSING_VALUE;
  }

  if (durationMs === 0) {
    return `0 ${SECOND_WORD}`;
  }
  if (durationMs < MILLISECONDS_PER_SECOND) {
    return SUB_SECOND_LABEL;
  }

  const totalSeconds = Math.floor(durationMs / MILLISECONDS_PER_SECOND);
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${formatNumber(totalSeconds, { fractionDigits: 0 })} ${SECOND_WORD}`;
  }

  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  if (totalMinutes < MINUTES_PER_HOUR) {
    const parts = [
      durationPart(totalMinutes, MINUTE_WORD),
      durationPart(totalSeconds % SECONDS_PER_MINUTE, SECOND_WORD),
    ];
    return parts.filter((part): part is string => part !== null).join(' ');
  }

  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const parts = [
    durationPart(hours, HOUR_WORD),
    durationPart(totalMinutes % MINUTES_PER_HOUR, MINUTE_WORD),
  ];
  return parts.filter((part): part is string => part !== null).join(' ');
}
