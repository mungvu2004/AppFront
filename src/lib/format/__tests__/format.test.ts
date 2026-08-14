import { describe, expect, it } from 'vitest';

import { formatArea, formatAngle, formatLength, METRE_THRESHOLD_MM } from '../measure';
import { formatNumber, formatPercent, isFormattable, MISSING_VALUE } from '../number';

/**
 * Every value the formatters are expected to survive, in one place.
 *
 * The guard tests at the bottom run the whole list through every entry point, so
 * adding a row here widens the coverage of all five functions at once.
 */
const HOSTILE_INPUTS: readonly (number | null | undefined)[] = [
  0,
  -0,
  1,
  -1,
  0.5,
  -0.5,
  850,
  3450,
  -3450,
  248.6,
  1e21,
  -1e21,
  Number.MAX_SAFE_INTEGER,
  Number.MIN_SAFE_INTEGER,
  Number.MAX_VALUE,
  Number.MIN_VALUE,
  Number.EPSILON,
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  null,
  undefined,
];

interface LengthCase {
  readonly input: number | null | undefined;
  readonly expected: string;
  readonly reason: string;
}

/** The fifteen lengths the unit-switching rule has to get right. */
const LENGTH_CASES: readonly LengthCase[] = [
  { input: 0, expected: '0 mm', reason: 'zero stays in millimetres' },
  { input: 1, expected: '1 mm', reason: 'the smallest whole millimetre' },
  { input: 220, expected: '220 mm', reason: 'a wall thickness' },
  { input: 850, expected: '850 mm', reason: 'the brief: under a metre reads in millimetres' },
  { input: 999, expected: '999 mm', reason: 'the last millimetre before the switch' },
  { input: 1000, expected: '1,00 m', reason: 'the brief: one metre is already metres' },
  { input: 3450, expected: '3,45 m', reason: 'the brief: 3450 mm reads as 3,45 m' },
  { input: 12400, expected: '12,40 m', reason: 'a trailing zero is kept so columns align' },
  { input: -850, expected: '-850 mm', reason: 'the unit is chosen on the magnitude, not the sign' },
  { input: -3450, expected: '-3,45 m', reason: 'a negative length still switches to metres' },
  { input: -0, expected: '0 mm', reason: 'negative zero is the same length as zero' },
  {
    input: 123456789,
    expected: '123.456,79 m',
    reason: 'thousands are grouped with a dot, decimals with a comma',
  },
  {
    input: Number.MAX_SAFE_INTEGER,
    expected: '9.007.199.254.740,99 m',
    reason: 'a very large value stays in full digits, never exponent notation',
  },
  { input: Number.NaN, expected: MISSING_VALUE, reason: 'an unusable number is not a length' },
  { input: null, expected: MISSING_VALUE, reason: 'a missing length shows the placeholder' },
  { input: undefined, expected: MISSING_VALUE, reason: 'an absent length shows the placeholder' },
];

describe('format/measure.ts — formatLength', () => {
  it.each(LENGTH_CASES)('writes $input as $expected ($reason)', ({ input, expected }) => {
    expect(formatLength(input)).toBe(expected);
  });

  it('switches unit at exactly one metre', () => {
    expect(METRE_THRESHOLD_MM).toBe(1000);
    expect(formatLength(METRE_THRESHOLD_MM - 1)).toBe('999 mm');
    expect(formatLength(METRE_THRESHOLD_MM)).toBe('1,00 m');
  });

  it('reads a short length in metres when the caller forces the unit', () => {
    expect(formatLength(850, { unit: 'm' })).toBe('0,85 m');
    expect(formatLength(0, { unit: 'm' })).toBe('0,00 m');
  });

  it('reads a long length in millimetres when the caller forces the unit', () => {
    expect(formatLength(3450, { unit: 'mm' })).toBe('3.450 mm');
    expect(formatLength(12400, { unit: 'mm' })).toBe('12.400 mm');
  });

  it('lets the caller widen or narrow the decimals', () => {
    expect(formatLength(3449.7, { fractionDigits: 0 })).toBe('3 m');
    expect(formatLength(3449.7, { fractionDigits: 4 })).toBe('3,4497 m');
    expect(formatLength(220.5, { unit: 'mm', fractionDigits: 1 })).toBe('220,5 mm');
  });

  it('shows the placeholder for a forced unit too, never "NaN mm"', () => {
    expect(formatLength(null, { unit: 'mm' })).toBe(MISSING_VALUE);
    expect(formatLength(Number.POSITIVE_INFINITY, { unit: 'm' })).toBe(MISSING_VALUE);
  });
});

describe('format/measure.ts — formatArea', () => {
  it('writes the standard sample area with two decimals', () => {
    expect(formatArea(248.6)).toBe('248,60 m²');
  });

  it.each([
    { input: 0, expected: '0,00 m²' },
    { input: 1234.5, expected: '1.234,50 m²' },
    { input: -12.345, expected: '-12,35 m²' },
    { input: 1e12, expected: '1.000.000.000.000,00 m²' },
    { input: Number.NaN, expected: MISSING_VALUE },
    { input: null, expected: MISSING_VALUE },
    { input: undefined, expected: MISSING_VALUE },
  ] as const)('writes $input as $expected', ({ input, expected }) => {
    expect(formatArea(input)).toBe(expected);
  });

  it('lets the caller change the decimals', () => {
    expect(formatArea(248.6, { fractionDigits: 1 })).toBe('248,6 m²');
    expect(formatArea(248.6, { fractionDigits: 0 })).toBe('249 m²');
  });
});

describe('format/measure.ts — formatAngle', () => {
  it.each([
    { input: 0, expected: '0,0°' },
    { input: 90, expected: '90,0°' },
    { input: -45.25, expected: '-45,3°' },
    { input: 1234.56, expected: '1.234,6°' },
    { input: Number.NEGATIVE_INFINITY, expected: MISSING_VALUE },
    { input: null, expected: MISSING_VALUE },
    { input: undefined, expected: MISSING_VALUE },
  ] as const)('writes $input as $expected', ({ input, expected }) => {
    expect(formatAngle(input)).toBe(expected);
  });

  it('writes the angle it was given without folding it into a turn', () => {
    expect(formatAngle(-90)).toBe('-90,0°');
    expect(formatAngle(270)).toBe('270,0°');
    expect(formatAngle(450)).toBe('450,0°');
  });
});

describe('format/number.ts — formatNumber', () => {
  it.each([
    { input: 0, expected: '0', reason: 'zero needs no decimals' },
    { input: -0, expected: '0', reason: 'negative zero loses its sign' },
    { input: 1234567.891, expected: '1.234.567,891', reason: 'dot groups, comma separates' },
    { input: -1234.5, expected: '-1.234,5', reason: 'a negative number keeps its sign' },
    { input: 1e21, expected: '1.000.000.000.000.000.000.000', reason: 'never exponent notation' },
    {
      input: Number.MAX_SAFE_INTEGER,
      expected: '9.007.199.254.740.991',
      reason: 'the largest exact integer is written in full',
    },
    { input: Number.NaN, expected: MISSING_VALUE, reason: 'NaN is not a number a person reads' },
    { input: Number.POSITIVE_INFINITY, expected: MISSING_VALUE, reason: 'infinity has no digits' },
    { input: null, expected: MISSING_VALUE, reason: 'null shows the placeholder' },
    { input: undefined, expected: MISSING_VALUE, reason: 'undefined shows the placeholder' },
  ] as const)('writes $input as $expected ($reason)', ({ input, expected }) => {
    expect(formatNumber(input)).toBe(expected);
  });

  it('pads to a fixed number of decimals', () => {
    expect(formatNumber(3.5, { fractionDigits: 2 })).toBe('3,50');
    expect(formatNumber(3, { fractionDigits: 2 })).toBe('3,00');
  });

  it('drops trailing zeros under a maximum', () => {
    expect(formatNumber(3.5, { maxFractionDigits: 2 })).toBe('3,5');
    expect(formatNumber(3.456, { maxFractionDigits: 2 })).toBe('3,46');
  });

  it('drops the thousands separator when the number is an identifier', () => {
    expect(formatNumber(2026, { grouping: false })).toBe('2026');
    expect(formatNumber(2026)).toBe('2.026');
  });

  it('clamps an out-of-range decimal count instead of throwing', () => {
    expect(() => formatNumber(1.5, { fractionDigits: -3 })).not.toThrow();
    expect(formatNumber(1.5, { fractionDigits: -3 })).toBe('2');
    expect(() => formatNumber(1.5, { fractionDigits: 999 })).not.toThrow();
    // Clamped to the twenty fraction digits every runtime accepts: "5" + 19 zeros.
    expect(formatNumber(1.5, { fractionDigits: 999 })).toMatch(/^1,50{19}$/);
  });
});

describe('format/number.ts — formatPercent', () => {
  it.each([
    { input: 0, expected: '0%' },
    { input: 0.125, expected: '12,5%' },
    { input: 0.8, expected: '80%' },
    { input: 1, expected: '100%' },
    { input: -0.045, expected: '-4,5%' },
    { input: Number.NaN, expected: MISSING_VALUE },
    { input: null, expected: MISSING_VALUE },
    { input: undefined, expected: MISSING_VALUE },
  ] as const)('reads the ratio $input as $expected', ({ input, expected }) => {
    expect(formatPercent(input)).toBe(expected);
  });

  it('reads an already-scaled value when told to', () => {
    expect(formatPercent(50, { source: 'percent' })).toBe('50%');
    expect(formatPercent(12.3, { source: 'percent' })).toBe('12,3%');
    expect(formatPercent(100, { source: 'percent' })).toBe('100%');
    expect(formatPercent(0, { source: 'percent' })).toBe('0%');
  });

  it('pads to a fixed number of decimals', () => {
    expect(formatPercent(0.8, { fractionDigits: 1 })).toBe('80,0%');
    expect(formatPercent(0.8, { fractionDigits: 0 })).toBe('80%');
  });
});

describe('format — invariants that hold for every entry point', () => {
  interface NamedFormatter {
    readonly name: string;
    readonly run: (value: number | null | undefined) => string;
  }

  const formatters: readonly NamedFormatter[] = [
    { name: 'formatNumber', run: (value) => formatNumber(value) },
    { name: 'formatPercent', run: (value) => formatPercent(value) },
    { name: 'formatLength', run: (value) => formatLength(value) },
    { name: 'formatArea', run: (value) => formatArea(value) },
    { name: 'formatAngle', run: (value) => formatAngle(value) },
  ];

  it.each(formatters)('$name never writes "NaN", "undefined", "null" or "Infinity"', ({ run }) => {
    for (const input of HOSTILE_INPUTS) {
      const output = run(input);
      expect(output).not.toMatch(/NaN|undefined|null|Infinity|e\+/i);
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it.each(formatters)('$name gives the placeholder for every unusable input', ({ run }) => {
    for (const input of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(run(input)).toBe(MISSING_VALUE);
    }
  });

  it('uses a comma for decimals and a dot for thousands, never the reverse', () => {
    expect(formatNumber(1234.5, { fractionDigits: 1 })).toBe('1.234,5');
    expect(formatLength(1234567, { unit: 'm' })).toBe('1.234,57 m');
    expect(formatArea(1234.5)).toBe('1.234,50 m²');
  });

  it('formats for display without rounding the value it was given', () => {
    const surveyed = 3449.7;

    expect(formatLength(surveyed)).toBe('3,45 m');
    expect(surveyed).toBe(3449.7);
    // The full precision is still there for the next calculation.
    expect(surveyed / 1000).toBeCloseTo(3.4497, 10);
    expect(formatLength(surveyed, { fractionDigits: 4 })).toBe('3,4497 m');
  });

  it('agrees with isFormattable about what can be written', () => {
    for (const input of HOSTILE_INPUTS) {
      expect(formatNumber(input) === MISSING_VALUE).toBe(!isFormattable(input));
    }
  });
});
