import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  PROJECT_BUILDING_TYPES,
  PROJECT_LENGTH_UNITS,
  ProjectSettingsBodySchema,
  ProjectSettingsSchema,
  UpdateProjectSettingsSchema,
} from '../../schemas/projectSettings';

/** N5, N6 — cài đặt dự án (HOP-DONG-MOI §2). */

function issuePaths(schema: z.ZodTypeAny, input: unknown): (string | number)[][] {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path);
}

/** Bản sao của `source` thiếu đúng một khoá. */
function without(source: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([name]) => name !== key));
}

/** Bỏ riêng từng khoá bắt buộc thì hỏng đúng ở khoá đó. */
function itRequiresKeys(schema: z.ZodTypeAny, sample: object, keys: string[]): void {
  it.each(keys)('từ chối thiếu khoá bắt buộc %s', (key) => {
    expect(issuePaths(schema, without(sample, key))).toStrictEqual([[key]]);
  });
}

function accepts(schema: z.ZodTypeAny, input: unknown): boolean {
  return schema.safeParse(input).success;
}

const fullBody = {
  buildingType: 'commercial',
  confidenceThreshold: 0.8,
  defaultScaleMmPerPx: 2.5,
  lengthUnit: 'm',
  notes: 'Khối văn phòng, tầng hầm chưa có bản vẽ.',
  snapToleranceMm: 25,
};

/** Mặc định của FE mà N5 trả khi dự án chưa lưu cài đặt lần nào. */
const defaultBody = {
  buildingType: 'residential',
  confidenceThreshold: 0.75,
  defaultScaleMmPerPx: 1,
  lengthUnit: 'mm',
  snapToleranceMm: 50,
};

const REQUIRED_BODY_KEYS = [
  'buildingType',
  'confidenceThreshold',
  'defaultScaleMmPerPx',
  'lengthUnit',
  'snapToleranceMm',
];

/** Biên của từng trường số và chuỗi, dùng cho cả thân lẫn bản nhận. */
const OUT_OF_RANGE: [string, Record<string, unknown>, string][] = [
  ['buildingType ngoài tập', { buildingType: 'hospital' }, 'buildingType'],
  ['lengthUnit ngoài tập', { lengthUnit: 'cm' }, 'lengthUnit'],
  ['notes rỗng', { notes: '' }, 'notes'],
  ['notes 501 ký tự', { notes: 'a'.repeat(501) }, 'notes'],
  ['snapToleranceMm 0', { snapToleranceMm: 0 }, 'snapToleranceMm'],
  ['snapToleranceMm 121', { snapToleranceMm: 121 }, 'snapToleranceMm'],
  ['snapToleranceMm thập phân', { snapToleranceMm: 12.5 }, 'snapToleranceMm'],
  ['confidenceThreshold âm', { confidenceThreshold: -0.01 }, 'confidenceThreshold'],
  ['confidenceThreshold > 1', { confidenceThreshold: 1.01 }, 'confidenceThreshold'],
  ['defaultScaleMmPerPx 0,009', { defaultScaleMmPerPx: 0.009 }, 'defaultScaleMmPerPx'],
  ['defaultScaleMmPerPx 1000,1', { defaultScaleMmPerPx: 1000.1 }, 'defaultScaleMmPerPx'],
];

describe('hằng — khớp HOP-DONG-MOI §2', () => {
  it('PROJECT_BUILDING_TYPES', () => {
    expect([...PROJECT_BUILDING_TYPES]).toStrictEqual([
      'residential',
      'commercial',
      'industrial',
      'mixed',
      'other',
    ]);
  });

  it('PROJECT_LENGTH_UNITS', () => {
    expect([...PROJECT_LENGTH_UNITS]).toStrictEqual(['mm', 'm']);
  });
});

describe('ProjectSettingsBodySchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(ProjectSettingsBodySchema.parse(fullBody)).toStrictEqual(fullBody);
  });

  it('nhận mẫu tối thiểu, không có notes', () => {
    expect(ProjectSettingsBodySchema.parse(defaultBody)).toStrictEqual(defaultBody);
  });

  itRequiresKeys(ProjectSettingsBodySchema, fullBody, REQUIRED_BODY_KEYS);

  it.each([
    ['areaUnit', { areaUnit: 'm2' }],
    ['revision', { revision: 0 }],
    ['name', { name: 'Nhà phố' }],
  ])('từ chối khoá lạ %s', (_label, patch) => {
    expect(issuePaths(ProjectSettingsBodySchema, { ...fullBody, ...patch })).toStrictEqual([[]]);
  });

  it('từ chối null ở notes', () => {
    expect(issuePaths(ProjectSettingsBodySchema, { ...fullBody, notes: null })).toStrictEqual([
      ['notes'],
    ]);
  });

  it.each(OUT_OF_RANGE)('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(ProjectSettingsBodySchema, { ...fullBody, ...patch })).toStrictEqual([[key]]);
  });

  it.each([
    ['notes 500 ký tự', { notes: 'a'.repeat(500) }],
    ['snapToleranceMm 1', { snapToleranceMm: 1 }],
    ['snapToleranceMm 120', { snapToleranceMm: 120 }],
    ['confidenceThreshold 0', { confidenceThreshold: 0 }],
    ['confidenceThreshold 1', { confidenceThreshold: 1 }],
    ['defaultScaleMmPerPx 0,01', { defaultScaleMmPerPx: 0.01 }],
    ['defaultScaleMmPerPx 1000', { defaultScaleMmPerPx: 1000 }],
  ])('nhận biên %s', (_label, patch) => {
    expect(accepts(ProjectSettingsBodySchema, { ...fullBody, ...patch })).toBe(true);
  });
});

describe('ProjectSettingsSchema', () => {
  const fullSettings = { ...fullBody, revision: 3 };
  const defaultSettings = { ...defaultBody, revision: 0 };

  it('nhận mẫu đầy đủ', () => {
    expect(ProjectSettingsSchema.parse(fullSettings)).toStrictEqual(fullSettings);
  });

  it('nhận mẫu tối thiểu: giá trị mặc định của FE, revision 0', () => {
    expect(ProjectSettingsSchema.parse(defaultSettings)).toStrictEqual(defaultSettings);
  });

  it('bỏ hẳn khoá notes mang undefined khỏi đầu ra', () => {
    expect(ProjectSettingsSchema.parse({ ...defaultSettings, notes: undefined })).toStrictEqual(
      defaultSettings,
    );
  });

  itRequiresKeys(ProjectSettingsSchema, fullSettings, [...REQUIRED_BODY_KEYS, 'revision']);

  it('từ chối khoá lạ', () => {
    expect(issuePaths(ProjectSettingsSchema, { ...fullSettings, areaUnit: 'm2' })).toStrictEqual([
      [],
    ]);
  });

  it('từ chối null ở notes', () => {
    expect(issuePaths(ProjectSettingsSchema, { ...fullSettings, notes: null })).toStrictEqual([
      ['notes'],
    ]);
  });

  it.each([
    ['revision âm', { revision: -1 }, 'revision'],
    ['revision thập phân', { revision: 1.5 }, 'revision'],
    ...OUT_OF_RANGE,
  ])('từ chối %s', (_label, patch, key) => {
    expect(issuePaths(ProjectSettingsSchema, { ...fullSettings, ...patch })).toStrictEqual([[key]]);
  });
});

describe('UpdateProjectSettingsSchema', () => {
  const write = { baseVersion: 3, body: fullBody };

  it('nhận mẫu đầy đủ', () => {
    expect(UpdateProjectSettingsSchema.parse(write)).toStrictEqual(write);
  });

  it('nhận mẫu tối thiểu: baseVersion 0, thân không notes', () => {
    const minimal = { baseVersion: 0, body: defaultBody };
    expect(UpdateProjectSettingsSchema.parse(minimal)).toStrictEqual(minimal);
  });

  itRequiresKeys(UpdateProjectSettingsSchema, write, ['baseVersion', 'body']);

  it('từ chối revision trong thân', () => {
    expect(
      issuePaths(UpdateProjectSettingsSchema, { ...write, body: { ...fullBody, revision: 3 } }),
    ).toStrictEqual([['body']]);
  });

  it('từ chối khoá lạ ở vỏ', () => {
    expect(issuePaths(UpdateProjectSettingsSchema, { ...write, force: true })).toStrictEqual([[]]);
  });

  it('từ chối baseVersion âm', () => {
    expect(issuePaths(UpdateProjectSettingsSchema, { ...write, baseVersion: -1 })).toStrictEqual([
      ['baseVersion'],
    ]);
  });

  it('áp biên của thân, path có tiền tố body', () => {
    expect(
      issuePaths(UpdateProjectSettingsSchema, {
        ...write,
        body: { ...fullBody, snapToleranceMm: 121 },
      }),
    ).toStrictEqual([['body', 'snapToleranceMm']]);
  });
});
