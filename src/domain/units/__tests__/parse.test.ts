import { describe, expect, it } from 'vitest';

import { parseLength, type ParseLengthResult } from '../parse';
import {
  DEFAULT_ROUNDING_STEP,
  degrees,
  degreesToRadians,
  metres,
  metresToMillimetres,
  millimetres,
  millimetresToMetres,
  normaliseDegrees,
  radians,
  radiansToDegrees,
  rectangleArea,
  roundMeasurement,
} from '../types';

/** One row of the acceptance table: what a person typed and what it means. */
interface ParseCase {
  readonly input: string;
  /** Expected millimetres, or `null` when the string must be rejected. */
  readonly expected: number | null;
  readonly reason: string;
}

const PARSE_CASES: readonly ParseCase[] = [
  { input: '3,5', expected: 3.5, reason: 'comma is the decimal separator' },
  { input: '3.5', expected: 3.5, reason: 'a dot with a one digit tail is decimal too' },
  { input: '3500 mm', expected: 3500, reason: 'explicit millimetres with a space' },
  { input: '3,5 m', expected: 3500, reason: 'metres are scaled by a thousand' },
  { input: '350cm', expected: 3500, reason: 'centimetres need no space' },
  { input: '35 DM', expected: 3500, reason: 'the unit is case insensitive' },
  { input: '3.500', expected: 3500, reason: 'a dot before three digits groups thousands' },
  { input: '1.234.567', expected: 1234567, reason: 'repeated dots are all grouping' },
  { input: '1,234.5', expected: 1234.5, reason: 'the rightmost separator wins' },
  { input: '3 500 mm', expected: 3500, reason: 'spaces inside the number are ignored' },
  { input: '-250 mm', expected: -250, reason: 'offsets may be negative' },
  { input: '+3500', expected: 3500, reason: 'a leading plus is accepted' },
  { input: '', expected: null, reason: 'an empty box is not a measurement' },
  { input: '   ', expected: null, reason: 'whitespace alone is not a measurement' },
  { input: 'abc', expected: null, reason: 'plain rubbish' },
  { input: '3,5,5', expected: null, reason: 'two decimal separators' },
  { input: '3,', expected: null, reason: 'a dangling separator' },
  { input: '1e3', expected: null, reason: 'scientific notation is not offered' },
  { input: '0x10', expected: null, reason: 'hexadecimal must not slip through Number()' },
  { input: '3.5abc', expected: null, reason: 'parseFloat would have accepted this prefix' },
  { input: '3500 km', expected: null, reason: 'kilometres are not an accepted unit' },
  { input: 'mm', expected: null, reason: 'a unit with no digits' },
  { input: '-', expected: null, reason: 'a sign with no digits' },
  { input: '12.34.5', expected: null, reason: 'a broken grouping run' },
];

describe('parseLength', () => {
  it.each(PARSE_CASES)('reads $input ($reason)', ({ input, expected }) => {
    const result = parseLength(input);

    if (expected === null) {
      expect(result).toEqual<ParseLengthResult>({ ok: false, error: 'unreadable' });
      return;
    }

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(expected);
    }
  });

  it('covers at least twelve accepted and rejected strings', () => {
    expect(PARSE_CASES.filter((entry) => entry.expected !== null).length).toBeGreaterThanOrEqual(12);
    expect(PARSE_CASES.filter((entry) => entry.expected === null).length).toBeGreaterThanOrEqual(12);
  });

  it('assumes millimetres when the text carries no unit', () => {
    const result = parseLength('3500');

    expect(result).toEqual<ParseLengthResult>({ ok: true, value: millimetres(3500) });
  });

  it('lets the caller assume metres instead', () => {
    const result = parseLength('3,5', { defaultUnit: 'm' });

    expect(result).toEqual<ParseLengthResult>({ ok: true, value: millimetres(3500) });
  });

  it('keeps whole millimetres exact when scaling from metres', () => {
    const result = parseLength('2,745 m');

    expect(result.ok && result.value).toBe(2745);
  });

  it('reads a leading decimal separator as a zero', () => {
    const result = parseLength(',5');

    expect(result.ok && result.value).toBe(0.5);
  });

  it('rejects a number with more significant digits than a double can hold', () => {
    expect(parseLength('1234567890123456789')).toEqual<ParseLengthResult>({
      ok: false,
      error: 'unreadable',
    });
  });

  it('never throws on rubbish', () => {
    expect(() => parseLength('!!!')).not.toThrow();
    expect(() => parseLength('∞')).not.toThrow();
  });
});

describe('roundMeasurement', () => {
  it('rounds to whole millimetres by default', () => {
    expect(roundMeasurement(millimetres(3.4))).toBe(3);
    expect(roundMeasurement(millimetres(3.6))).toBe(4);
    expect(DEFAULT_ROUNDING_STEP).toBe(1);
  });

  it('rounds halfway values away from zero', () => {
    expect(roundMeasurement(millimetres(2.5))).toBe(3);
    expect(roundMeasurement(millimetres(-2.5))).toBe(-3);
  });

  it('snaps onto a coarser step', () => {
    expect(roundMeasurement(millimetres(3487), millimetres(5))).toBe(3485);
    expect(roundMeasurement(millimetres(3487), millimetres(10))).toBe(3490);
    expect(roundMeasurement(millimetres(3487), millimetres(25))).toBe(3475);
  });

  it('keeps a fractional step free of floating point dust', () => {
    expect(roundMeasurement(millimetres(0.34), millimetres(0.1))).toBe(0.3);
  });

  it('refuses a step that is not a positive length', () => {
    expect(() => roundMeasurement(millimetres(10), millimetres(0))).toThrow(RangeError);
    expect(() => roundMeasurement(millimetres(10), millimetres(-5))).toThrow(RangeError);
  });

  it('pairs with the parser to normalise typed input', () => {
    const parsed = parseLength('3,49 m');

    expect(parsed.ok && roundMeasurement(parsed.value, millimetres(10))).toBe(3490);
  });
});

describe('unit conversions', () => {
  it('converts lengths both ways', () => {
    expect(metresToMillimetres(metres(3.5))).toBe(3500);
    expect(millimetresToMetres(millimetres(3500))).toBe(3.5);
  });

  it('converts angles both ways', () => {
    expect(degreesToRadians(degrees(180))).toBeCloseTo(Math.PI, 12);
    expect(radiansToDegrees(radians(Math.PI / 2))).toBeCloseTo(90, 12);
  });

  it('folds an angle into a single turn', () => {
    expect(normaliseDegrees(degrees(450))).toBe(90);
    expect(normaliseDegrees(degrees(-90))).toBe(270);
  });

  it('computes an area in square metres from millimetre sides', () => {
    expect(rectangleArea(millimetres(5000), millimetres(4000))).toBe(20);
  });

  it('refuses to tag a value that is not finite', () => {
    expect(() => millimetres(Number.NaN)).toThrow(RangeError);
    expect(() => metres(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('compile time separation of units', () => {
  it('rejects mixing labelled quantities', () => {
    // Each line below must fail to compile; `pnpm typecheck` fails if any of
    // these expectations stops being an error, which is the real assertion.

    // @ts-expect-error metres may not be passed where millimetres are expected
    roundMeasurement(metres(3.5));

    // @ts-expect-error millimetres may not be passed where metres are expected
    metresToMillimetres(millimetres(3500));

    // @ts-expect-error a bare number is not a length
    roundMeasurement(3500);

    // @ts-expect-error radians may not be passed where degrees are expected
    degreesToRadians(radians(1));

    // @ts-expect-error an area is not a length
    millimetresToMetres(rectangleArea(millimetres(1000), millimetres(1000)));

    expect(true).toBe(true);
  });
});
