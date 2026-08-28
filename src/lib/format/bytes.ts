/**
 * File sizes, written the way the rest of the product writes numbers.
 *
 * A sibling of `./measure`, and built the same way: the unit is chosen from the
 * magnitude, the digits are placed by `./number`, and nothing here calls
 * `toFixed` or `toLocaleString`. That matters more for a byte count than it
 * looks, because the separators invert — Vietnamese writes `1.234,5 MB` where
 * English writes `1,234.5 MB`, and a size assembled by hand gets that backwards
 * exactly once before someone reads 4,2 MB as 42.
 *
 * The units are binary — 1 KB here is 1024 bytes, matching
 * `UPLOAD_CHUNK_SIZE_BYTES` and `MAX_UPLOAD_FILE_SIZE_BYTES` in
 * `src/lib/upload`, which are the numbers these strings are usually describing.
 * A 100 MiB limit shown as "104,9 MB" next to a rule that says 100 MB is a
 * support ticket, so the two agree by construction.
 *
 * `null`, `undefined`, `NaN` and `±Infinity` all render as `MISSING_VALUE`, so
 * a caller never has to guard and the strings `"NaN"` and `"undefined"` cannot
 * reach the screen.
 */

import { formatNumber, isFormattable, MISSING_VALUE, type MaybeNumber } from './number';

/** Bytes in the next unit up. Binary, to agree with the upload limits. */
export const BYTES_PER_UNIT = 1024;

/** The ladder, from bytes upward. Vietnamese uses the same abbreviations. */
export const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** One of {@link BYTE_UNITS}. */
export type ByteUnit = (typeof BYTE_UNITS)[number];

export interface FileSizeFormatOptions {
  /**
   * Force the reading unit instead of choosing it from the magnitude.
   *
   * Pass `'MB'` for a column of file sizes that has to line up.
   */
  readonly unit?: ByteUnit;
  /**
   * Override the decimals. The default is none for whole bytes — half a byte
   * means nothing — and one everywhere above.
   */
  readonly fractionDigits?: number;
}

/** Decimals shown on a size in bytes: a byte is not divisible. */
const BYTE_FRACTION_DIGITS = 0;

/** Decimals shown from kilobytes up: enough to tell 4,2 MB from 4,9 MB. */
const SCALED_FRACTION_DIGITS = 1;

/** A space before the unit, as `./measure` writes `m` and `m²`. */
const UNIT_SEPARATOR = ' ';

/** The unit a size of this magnitude reads in. */
function chooseUnit(sizeBytes: number): ByteUnit {
  const magnitude = Math.abs(sizeBytes);
  let step = 0;

  while (magnitude >= Math.pow(BYTES_PER_UNIT, step + 1) && step + 1 < BYTE_UNITS.length) {
    step += 1;
  }

  return BYTE_UNITS[step] ?? 'B';
}

/**
 * Write a size held in bytes.
 *
 * Under a kilobyte the value stays whole: `formatFileSize(512)` is `"512 B"`.
 * Above it the value converts and keeps one decimal, with a comma for the
 * decimal mark.
 *
 * @param sizeBytes Size in bytes, or one of the ways a size goes missing.
 *
 * @example
 * formatFileSize(0)             // "0 B"
 * formatFileSize(5_242_880)     // "5,0 MB"
 * formatFileSize(104_857_600)   // "100,0 MB"
 * formatFileSize(undefined)     // "—"
 */
export function formatFileSize(
  sizeBytes: MaybeNumber,
  options: FileSizeFormatOptions = {},
): string {
  if (!isFormattable(sizeBytes)) {
    return MISSING_VALUE;
  }

  const unit = options.unit ?? chooseUnit(sizeBytes);
  const step = BYTE_UNITS.indexOf(unit);
  const scaled = sizeBytes / Math.pow(BYTES_PER_UNIT, step);
  const digits =
    options.fractionDigits ?? (unit === 'B' ? BYTE_FRACTION_DIGITS : SCALED_FRACTION_DIGITS);

  return `${formatNumber(scaled, { fractionDigits: digits })}${UNIT_SEPARATOR}${unit}`;
}
