/**
 * Reading lengths typed by a person.
 *
 * The input box is the one place where an arbitrary string turns into a
 * measurement, so the whole grammar is spelled out here and the result is a
 * discriminated union rather than a number that might silently be `NaN`.
 *
 * `parseFloat` and `Number()` are deliberately not used on user text: both
 * accept things this domain must reject (`"3.5abc"`, `"1e3"`, `"0x10"`,
 * `" "`), and neither understands the Vietnamese decimal comma. Digits are
 * accumulated by hand instead, and the fraction is applied as an exact integer
 * division so `"3,5 m"` yields exactly `3500`, not `3499.9999999999995`.
 *
 * Accepted shapes:
 *   "3500"      "3500 mm"   "350cm"    "35 dm"
 *   "3,5"       "3,5 m"     "3.5"      "3.500" (Vietnamese thousands grouping)
 *   "+3500"     "-250 mm"   "3 500 mm" (spaces are ignored inside the number)
 */

import {
  MILLIMETRES_PER_CENTIMETRE,
  MILLIMETRES_PER_DECIMETRE,
  MILLIMETRES_PER_METRE,
  millimetres,
  type Millimetres,
} from './types';

/** Length units a person may type. */
export type LengthUnit = 'mm' | 'cm' | 'dm' | 'm';

/** The only failure a caller has to handle. */
export type ParseErrorCode = 'unreadable';

/** Outcome of reading a typed length. */
export type ParseLengthResult =
  | { readonly ok: true; readonly value: Millimetres }
  | { readonly ok: false; readonly error: ParseErrorCode };

export interface ParseLengthOptions {
  /**
   * Unit assumed when the text carries none.
   *
   * Millimetres by default, matching how walls and openings are stored; a form
   * that collects elevations can pass `'m'` instead.
   */
  readonly defaultUnit?: LengthUnit;
}

/** How many millimetres one of each accepted unit is worth. */
const UNIT_FACTORS: Readonly<Record<LengthUnit, number>> = {
  mm: 1,
  cm: MILLIMETRES_PER_CENTIMETRE,
  dm: MILLIMETRES_PER_DECIMETRE,
  m: MILLIMETRES_PER_METRE,
};

/** Beyond this many significant digits a double can no longer hold the value. */
const MAX_SIGNIFICANT_DIGITS = 15;

const UNREADABLE: ParseLengthResult = { ok: false, error: 'unreadable' };

/** Any space, including the no-break variants a paste can carry (`\s` covers them). */
const WHITESPACE_PATTERN = /\s+/g;

/** The typographic minus sign, which keyboards and spreadsheets both produce. */
const UNICODE_MINUS_PATTERN = /−/g;

const TRAILING_LETTERS_PATTERN = /[a-z]+$/;

const DIGITS_ONLY_PATTERN = /^[0-9]+$/;

const NUMBER_BODY_PATTERN = /^[0-9.,]+$/;

const ZERO_CODE_POINT = 48;

/** A number split into its digits and how many of them are decimals. */
interface ScannedNumber {
  readonly digits: string;
  readonly fractionLength: number;
}

function isLengthUnit(candidate: string): candidate is LengthUnit {
  return Object.prototype.hasOwnProperty.call(UNIT_FACTORS, candidate);
}

/**
 * Decide which separator carries the decimals, or `null` when the number has
 * none.
 *
 * Vietnamese notation uses `,` for decimals and `.` for thousands, but people
 * paste English notation too, so the rules are:
 * - both separators present: the rightmost one is the decimal separator;
 * - only commas: one comma is a decimal separator, several are grouping;
 * - only dots: several are grouping, and a single one is grouping when it looks
 *   like `3.500` — one to three leading digits that do not start with `0`,
 *   followed by exactly three digits. Anything else (`3.5`, `0.500`) is a
 *   decimal point.
 */
function findDecimalSeparator(body: string): ',' | '.' | null {
  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    return lastComma > lastDot ? ',' : '.';
  }
  if (lastComma >= 0) {
    return body.indexOf(',') === lastComma ? ',' : null;
  }
  if (lastDot >= 0) {
    if (body.indexOf('.') !== lastDot) {
      return null;
    }
    const head = body.slice(0, lastDot);
    const tail = body.slice(lastDot + 1);
    const looksLikeGrouping =
      tail.length === 3 && head.length >= 1 && head.length <= 3 && !head.startsWith('0');
    return looksLikeGrouping ? null : '.';
  }
  return null;
}

/** The separator left over for thousands once the decimal one is known. */
function findGroupingSeparator(body: string, decimalSeparator: ',' | '.' | null): ',' | '.' {
  if (decimalSeparator === ',') {
    return '.';
  }
  if (decimalSeparator === '.') {
    return ',';
  }
  return body.includes('.') ? '.' : ',';
}

/** Check `1.234.567` style grouping and give back the bare digits. */
function readGroupedDigits(text: string, separator: ',' | '.' | null): string | null {
  if (separator === null) {
    return DIGITS_ONLY_PATTERN.test(text) ? text : null;
  }
  const groups = text.split(separator);
  const [first, ...rest] = groups;
  if (
    first === undefined ||
    first.length < 1 ||
    first.length > 3 ||
    !DIGITS_ONLY_PATTERN.test(first)
  ) {
    return null;
  }
  for (const group of rest) {
    if (group.length !== 3 || !DIGITS_ONLY_PATTERN.test(group)) {
      return null;
    }
  }
  return groups.join('');
}

/** Turn the numeric body of the input into digits and a fraction length. */
function scanNumber(body: string): ScannedNumber | null {
  if (!NUMBER_BODY_PATTERN.test(body)) {
    return null;
  }

  const decimalSeparator = findDecimalSeparator(body);
  const groupingSeparator = findGroupingSeparator(body, decimalSeparator);

  let integerPart = body;
  let fractionPart = '';
  if (decimalSeparator !== null) {
    const splitAt = body.lastIndexOf(decimalSeparator);
    integerPart = body.slice(0, splitAt);
    fractionPart = body.slice(splitAt + 1);
    if (fractionPart.length === 0 || !DIGITS_ONLY_PATTERN.test(fractionPart)) {
      return null;
    }
    // ",5" is read as "0,5"; a bare separator was already rejected above.
    if (integerPart.length === 0) {
      integerPart = '0';
    }
  }

  const usesGrouping = integerPart.includes(groupingSeparator);
  const integerDigits = readGroupedDigits(integerPart, usesGrouping ? groupingSeparator : null);
  if (integerDigits === null) {
    return null;
  }

  return {
    digits: integerDigits + fractionPart,
    fractionLength: fractionPart.length,
  };
}

/** Accumulate validated digits without handing the string to `parseFloat`. */
function digitsToInteger(digits: string): number {
  let total = 0;
  for (const character of digits) {
    total = total * 10 + (character.charCodeAt(0) - ZERO_CODE_POINT);
  }
  return total;
}

/**
 * Read a length typed by a person and return it in millimetres.
 *
 * Never throws: unusable input comes back as `{ ok: false, error: 'unreadable' }`.
 */
export function parseLength(input: string, options: ParseLengthOptions = {}): ParseLengthResult {
  const defaultUnit = options.defaultUnit ?? 'mm';

  const normalised = input
    .replace(UNICODE_MINUS_PATTERN, '-')
    .replace(WHITESPACE_PATTERN, '')
    .toLowerCase();
  if (normalised.length === 0) {
    return UNREADABLE;
  }

  let signed = normalised;
  let negative = false;
  if (signed.startsWith('-') || signed.startsWith('+')) {
    negative = signed.startsWith('-');
    signed = signed.slice(1);
  }
  if (signed.length === 0) {
    return UNREADABLE;
  }

  let unit: LengthUnit = defaultUnit;
  let body = signed;
  const unitMatch = TRAILING_LETTERS_PATTERN.exec(signed);
  if (unitMatch !== null) {
    const candidate = unitMatch[0];
    if (!isLengthUnit(candidate)) {
      return UNREADABLE;
    }
    unit = candidate;
    body = signed.slice(0, unitMatch.index);
  }

  const scanned = scanNumber(body);
  if (scanned === null) {
    return UNREADABLE;
  }

  const significantDigits = scanned.digits.replace(/^0+/, '');
  if (significantDigits.length > MAX_SIGNIFICANT_DIGITS) {
    return UNREADABLE;
  }

  // Multiply before dividing so whole millimetres stay exact: "3,5 m" is
  // 35 * 1000 / 10, never 3.5 * 1000.
  const magnitude = digitsToInteger(scanned.digits);
  const value = (magnitude * UNIT_FACTORS[unit]) / 10 ** scanned.fractionLength;
  if (!Number.isFinite(value)) {
    return UNREADABLE;
  }

  return { ok: true, value: millimetres(negative ? -value : value) };
}
