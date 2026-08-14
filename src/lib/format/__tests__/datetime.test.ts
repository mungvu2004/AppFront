import { describe, expect, it } from 'vitest';

import type { DiffEntry } from '@/lib/versioning/diff';

import {
  formatCalendarDate,
  formatClockTime,
  formatDuration,
  formatTimestamp,
  isSameCalendarDay,
  JUST_NOW_LABEL,
  SUB_SECOND_LABEL,
} from '../datetime';
import { MISSING_VALUE } from '../number';
import {
  confidenceLevel,
  describeConfidence,
  formatChange,
  formatChanges,
  type ChangeEntry,
  type ConfidenceLevel,
} from '../semantic';

/**
 * The zone is named on every call so the expected strings do not depend on the
 * machine running the suite. `Asia/Ho_Chi_Minh` is UTC+7 with no daylight
 * saving, so a local time is a fixed offset from the UTC instant written below.
 */
const ZONE = 'Asia/Ho_Chi_Minh';
const IN_ZONE = { timeZone: ZONE } as const;

/** Build an instant from the local wall-clock time a reader in Vietnam would see. */
const localTime = (isoUtc: string): Date => new Date(isoUtc);

/** The frozen clock: 14:32 on 14/08/2026, local. */
const NOW = localTime('2026-08-14T07:32:00Z');

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const ago = (milliseconds: number): Date => new Date(NOW.getTime() - milliseconds);

interface TimestampCase {
  readonly label: string;
  readonly value: Date;
  readonly expected: string;
}

/** The seven shapes a timestamp can take, each at the gap that produces it. */
const TIMESTAMP_CASES: readonly TimestampCase[] = [
  { label: 'seconds ago', value: ago(10 * SECOND), expected: JUST_NOW_LABEL },
  { label: 'the last second under a minute', value: ago(MINUTE - 1), expected: JUST_NOW_LABEL },
  { label: 'exactly a minute ago', value: ago(MINUTE), expected: '1 phút trước' },
  { label: 'twelve minutes ago', value: ago(12 * MINUTE), expected: '12 phút trước' },
  { label: 'the last minute under an hour', value: ago(HOUR - 1), expected: '59 phút trước' },
  { label: 'earlier today', value: ago(3 * HOUR), expected: '11:32' },
  { label: 'yesterday', value: ago(24 * HOUR), expected: '13/08/2026 14:32' },
  { label: 'eleven days ago', value: localTime('2026-08-03T07:32:00Z'), expected: '03/08/2026 14:32' },
];

describe('format/datetime.ts — formatTimestamp', () => {
  it.each(TIMESTAMP_CASES)('writes $label as "$expected"', ({ value, expected }) => {
    expect(formatTimestamp(value, NOW, IN_ZONE)).toBe(expected);
  });

  it('switches from the relative phrase to the clock at exactly one hour', () => {
    expect(formatTimestamp(ago(HOUR - 1), NOW, IN_ZONE)).toBe('59 phút trước');
    expect(formatTimestamp(ago(HOUR), NOW, IN_ZONE)).toBe('13:32');
  });

  it('reads "today" as a calendar day, not as the last 24 hours', () => {
    // 01:00 and 23:00 are 22 hours apart and still the same day.
    const earlyToday = localTime('2026-08-13T18:00:00Z');
    const lateToday = localTime('2026-08-14T16:00:00Z');
    expect(formatTimestamp(earlyToday, lateToday, IN_ZONE)).toBe('01:00');

    // 23:50 and 08:00 the next morning are 8 hours apart and different days.
    const lastNight = localTime('2026-08-14T16:50:00Z');
    const thisMorning = localTime('2026-08-15T01:00:00Z');
    expect(formatTimestamp(lastNight, thisMorning, IN_ZONE)).toBe('14/08/2026 23:50');
  });

  it('crosses midnight without losing the relative phrase', () => {
    const beforeMidnight = localTime('2026-08-14T16:50:00Z');
    const afterMidnight = localTime('2026-08-14T17:10:00Z');
    expect(formatTimestamp(beforeMidnight, afterMidnight, IN_ZONE)).toBe('20 phút trước');
  });

  it('treats a small clock skew into the future as "vừa xong"', () => {
    const skewed = new Date(NOW.getTime() + 30 * SECOND);
    expect(formatTimestamp(skewed, NOW, IN_ZONE)).toBe(JUST_NOW_LABEL);
  });

  it('states a genuinely future instant instead of explaining it', () => {
    const laterToday = new Date(NOW.getTime() + 2 * HOUR);
    expect(formatTimestamp(laterToday, NOW, IN_ZONE)).toBe('16:32');

    const nextWeek = localTime('2026-08-21T07:32:00Z');
    expect(formatTimestamp(nextWeek, NOW, IN_ZONE)).toBe('21/08/2026 14:32');
  });

  it('reads the same instant differently in another zone', () => {
    const value = localTime('2026-08-03T07:32:00Z');
    expect(formatTimestamp(value, NOW, IN_ZONE)).toBe('03/08/2026 14:32');
    expect(formatTimestamp(value, NOW, { timeZone: 'UTC' })).toBe('03/08/2026 07:32');
  });

  it('accepts epoch milliseconds as readily as a Date', () => {
    expect(formatTimestamp(ago(12 * MINUTE).getTime(), NOW.getTime(), IN_ZONE)).toBe('12 phút trước');
  });

  it.each([
    { label: 'a missing timestamp', value: null },
    { label: 'an absent timestamp', value: undefined },
    { label: 'an unparsed date string', value: new Date('nonsense') },
    { label: 'a NaN epoch', value: Number.NaN },
    { label: 'an infinite epoch', value: Number.POSITIVE_INFINITY },
  ])('writes the placeholder for $label', ({ value }) => {
    expect(formatTimestamp(value, NOW, IN_ZONE)).toBe(MISSING_VALUE);
  });

  it('writes the placeholder when the clock itself is missing', () => {
    expect(formatTimestamp(NOW, null, IN_ZONE)).toBe(MISSING_VALUE);
  });
});

describe('format/datetime.ts — formatClockTime and formatCalendarDate', () => {
  it('writes the parts the autosave indicator and history header need', () => {
    expect(formatClockTime(NOW, IN_ZONE)).toBe('14:32');
    expect(formatCalendarDate(NOW, IN_ZONE)).toBe('14/08/2026');
  });

  it('uses the 24-hour clock, with no am/pm marker', () => {
    expect(formatClockTime(localTime('2026-08-14T17:00:00Z'), IN_ZONE)).toBe('00:00');
    expect(formatClockTime(localTime('2026-08-14T12:05:00Z'), IN_ZONE)).toBe('19:05');
  });

  it('writes the placeholder for a missing instant', () => {
    expect(formatClockTime(null, IN_ZONE)).toBe(MISSING_VALUE);
    expect(formatCalendarDate(undefined, IN_ZONE)).toBe(MISSING_VALUE);
  });
});

describe('format/datetime.ts — isSameCalendarDay', () => {
  it('answers per zone, not per 24-hour window', () => {
    const lateEvening = localTime('2026-08-14T16:50:00Z');
    const justAfterMidnight = localTime('2026-08-14T17:10:00Z');

    expect(isSameCalendarDay(lateEvening, justAfterMidnight, ZONE)).toBe(false);
    expect(isSameCalendarDay(lateEvening, justAfterMidnight, 'UTC')).toBe(true);
  });

  it('is false when either instant is missing', () => {
    expect(isSameCalendarDay(NOW, null, ZONE)).toBe(false);
    expect(isSameCalendarDay(undefined, NOW, ZONE)).toBe(false);
  });
});

describe('format/datetime.ts — formatDuration', () => {
  it('writes a processing time in minutes and seconds', () => {
    expect(formatDuration(2 * MINUTE + 15 * SECOND)).toBe('2 phút 15 giây');
  });

  it.each([
    { input: 0, expected: '0 giây' },
    { input: 400, expected: SUB_SECOND_LABEL },
    { input: 999, expected: SUB_SECOND_LABEL },
    { input: SECOND, expected: '1 giây' },
    { input: 45 * SECOND, expected: '45 giây' },
    { input: MINUTE - 1, expected: '59 giây' },
    { input: MINUTE, expected: '1 phút' },
    { input: 2 * MINUTE, expected: '2 phút' },
    { input: 2 * MINUTE + 15 * SECOND, expected: '2 phút 15 giây' },
    { input: HOUR - 1, expected: '59 phút 59 giây' },
    { input: HOUR, expected: '1 giờ' },
    { input: HOUR + 5 * MINUTE, expected: '1 giờ 5 phút' },
    { input: HOUR + 5 * MINUTE + 5 * SECOND, expected: '1 giờ 5 phút' },
    { input: 24 * HOUR, expected: '24 giờ' },
    { input: 10_000 * HOUR, expected: '10.000 giờ' },
  ])('writes $input ms as "$expected"', ({ input, expected }) => {
    expect(formatDuration(input)).toBe(expected);
  });

  it.each([-1, -MINUTE, Number.NaN, Number.POSITIVE_INFINITY, null, undefined])(
    'writes the placeholder for %s, which is not a duration',
    (input) => {
      expect(formatDuration(input)).toBe(MISSING_VALUE);
    },
  );
});

describe('format/semantic.ts — formatChange', () => {
  it('writes the wall thickness sentence from the brief', () => {
    expect(
      formatChange({
        entityId: 'W-014',
        entityType: 'wall',
        kind: 'changed',
        field: 'thickness_mm',
        oldValue: 200,
        newValue: 220,
      }),
    ).toBe('Tường W-014 dày 200 mm → 220 mm');
  });

  it('writes both sides of a length change in one unit', () => {
    // 980 mm and 1020 mm straddle the metre boundary; the pair must not switch
    // unit halfway through the sentence.
    expect(
      formatChange({
        entityId: 'W-002',
        entityType: 'wall',
        kind: 'changed',
        field: 'width_mm',
        oldValue: 980,
        newValue: 1020,
      }),
    ).toBe('Tường W-002 rộng 0,98 m → 1,02 m');
  });

  it.each([
    {
      field: 'area_m2',
      oldValue: 248.6,
      newValue: 250,
      entityType: 'room' as const,
      entityId: 'R-01',
      expected: 'Phòng R-01 diện tích 248,60 m² → 250,00 m²',
    },
    {
      field: 'elevation_m',
      oldValue: 3.2,
      newValue: 3.5,
      entityType: 'room' as const,
      entityId: 'R-01',
      expected: 'Phòng R-01 cao độ 3,20 m → 3,50 m',
    },
    {
      field: 'rotation_deg',
      oldValue: 0,
      newValue: 90,
      entityType: 'furniture' as const,
      entityId: 'F-07',
      expected: 'Nội thất F-07 xoay 0,0° → 90,0°',
    },
    {
      field: 'height_mm',
      oldValue: 2100,
      newValue: 2400,
      entityType: 'door' as const,
      entityId: 'D-3',
      expected: 'Cửa đi D-3 cao 2,10 m → 2,40 m',
    },
    {
      field: 'value_mm',
      oldValue: 850,
      newValue: 900,
      entityType: 'dimension' as const,
      entityId: 'M-009',
      expected: 'Kích thước M-009 kích thước 850 mm → 900 mm',
    },
  ])('writes a $field change with its unit', ({ expected, ...entry }) => {
    expect(formatChange({ ...entry, kind: 'changed' })).toBe(expected);
  });

  it('names added and removed entities without inventing a field', () => {
    expect(formatChange({ entityId: 'W-014', entityType: 'wall', kind: 'added' })).toBe(
      'Thêm tường W-014',
    );
    expect(formatChange({ entityId: 'D-3', entityType: 'door', kind: 'removed' })).toBe(
      'Xoá cửa đi D-3',
    );
  });

  it('falls back to naming a field it has no unit for', () => {
    expect(
      formatChange({
        entityId: 'W-014',
        entityType: 'wall',
        kind: 'changed',
        field: 'layer',
        oldValue: 'A-WALL',
        newValue: 'A-WALL-PART',
      }),
    ).toBe('Tường W-014 đổi layer từ A-WALL sang A-WALL-PART');
  });

  it('writes the placeholder for a measured side that has no number', () => {
    expect(
      formatChange({
        entityId: 'W-014',
        entityType: 'wall',
        kind: 'changed',
        field: 'thickness_mm',
        oldValue: undefined,
        newValue: 220,
      }),
    ).toBe(`Tường W-014 dày ${MISSING_VALUE} → 220 mm`);
  });

  it('writes an empty generic side as "(trống)", never "undefined"', () => {
    const sentence = formatChange({
      entityId: 'W-014',
      entityType: 'wall',
      kind: 'changed',
      field: 'layer',
      oldValue: undefined,
      newValue: 'A-WALL',
    });
    expect(sentence).toBe('Tường W-014 đổi layer từ (trống) sang A-WALL');
    expect(sentence).not.toMatch(/undefined|null|NaN/);
  });

  it('keeps the order it was given when writing a whole diff', () => {
    const entries: readonly ChangeEntry[] = [
      { entityId: 'W-014', entityType: 'wall', kind: 'added' },
      {
        entityId: 'W-002',
        entityType: 'wall',
        kind: 'changed',
        field: 'thickness_mm',
        oldValue: 200,
        newValue: 220,
      },
    ];
    expect(formatChanges(entries)).toEqual([
      'Thêm tường W-014',
      'Tường W-002 dày 200 mm → 220 mm',
    ]);
  });

  it('accepts a DiffEntry from the versioning module without a cast', () => {
    const entry: DiffEntry = {
      entityId: 'W-014',
      entityType: 'wall',
      kind: 'changed',
      field: 'thickness_mm',
      oldValue: 200,
      newValue: 220,
    };
    const accepted: ChangeEntry = entry;
    expect(formatChange(accepted)).toBe('Tường W-014 dày 200 mm → 220 mm');
  });
});

describe('format/semantic.ts — describeConfidence', () => {
  it.each([
    { input: 1, level: 'certain' as const, label: 'AI chắc chắn' },
    { input: 0.95, level: 'certain' as const, label: 'AI chắc chắn' },
    { input: 0.9, level: 'certain' as const, label: 'AI chắc chắn' },
    { input: 0.8999, level: 'suggested' as const, label: 'AI đề xuất' },
    { input: 0.7, level: 'suggested' as const, label: 'AI đề xuất' },
    { input: 0.6999, level: 'needsReview' as const, label: 'Cần kiểm tra' },
    { input: 0, level: 'needsReview' as const, label: 'Cần kiểm tra' },
  ])('reads $input as $level', ({ input, level, label }) => {
    expect(describeConfidence(input)).toEqual({ level, label });
    expect(confidenceLevel(input)).toBe(level);
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'separates "no score" from "low score" for %s',
    (input) => {
      expect(describeConfidence(input)).toEqual({ level: 'unknown', label: MISSING_VALUE });
    },
  );

  it('never returns the verified level, which belongs to human approval', () => {
    const levels: ConfidenceLevel[] = [1, 0.8, 0.5, null, undefined].map((value) =>
      confidenceLevel(value),
    );
    expect(levels).toEqual(['certain', 'suggested', 'needsReview', 'unknown', 'unknown']);
    for (const level of levels) {
      expect(level).not.toBe('verified');
    }
  });
});

describe('format — no output carries presentation', () => {
  /** Everything this batch can produce, gathered once. */
  const everyOutput = (): string[] => [
    ...TIMESTAMP_CASES.map((entry) => formatTimestamp(entry.value, NOW, IN_ZONE)),
    formatTimestamp(null, NOW, IN_ZONE),
    formatClockTime(NOW, IN_ZONE),
    formatCalendarDate(NOW, IN_ZONE),
    ...[0, 400, SECOND, 45 * SECOND, MINUTE, 2 * MINUTE + 15 * SECOND, HOUR, 24 * HOUR, -1].map(
      (value) => formatDuration(value),
    ),
    ...[1, 0.95, 0.9, 0.8, 0.7, 0.5, 0].map((value) => describeConfidence(value).label),
    describeConfidence(null).label,
    ...formatChanges([
      { entityId: 'W-014', entityType: 'wall', kind: 'added' },
      { entityId: 'D-3', entityType: 'door', kind: 'removed' },
      {
        entityId: 'W-014',
        entityType: 'wall',
        kind: 'changed',
        field: 'thickness_mm',
        oldValue: 200,
        newValue: 220,
      },
      {
        entityId: 'R-01',
        entityType: 'room',
        kind: 'changed',
        field: 'area_m2',
        oldValue: 248.6,
        newValue: 250,
      },
      {
        entityId: 'W-014',
        entityType: 'wall',
        kind: 'changed',
        field: 'layer',
        oldValue: 'A-WALL',
        newValue: 'A-WALL-PART',
      },
    ]),
  ];

  it('contains no #rrggbb colour code', () => {
    for (const output of everyOutput()) {
      expect(output).not.toMatch(/#[0-9a-fA-F]{6}\b/);
    }
  });

  it('contains no colour of any other notation either', () => {
    for (const output of everyOutput()) {
      expect(output).not.toMatch(/#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|var\(--/i);
    }
  });

  it('contains no leaked internal value', () => {
    for (const output of everyOutput()) {
      expect(output).not.toMatch(/NaN|undefined|null|Invalid Date|\[object/i);
      expect(output.length).toBeGreaterThan(0);
    }
  });

  it('returns a level code rather than anything the view could paint with', () => {
    const { level, label } = describeConfidence(0.95);
    expect(level).toBe('certain');
    expect(label).toBe('AI chắc chắn');
    expect(Object.keys(describeConfidence(0.95))).toEqual(['level', 'label']);
  });
});
