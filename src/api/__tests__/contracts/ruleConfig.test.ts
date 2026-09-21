import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import {
  ProjectRuleConfigSchema,
  RULE_OVERRIDE_SEVERITIES,
  RuleOverrideSchema,
  UpdateRuleConfigSchema,
} from '../../schemas/ruleConfig';

/**
 * N21, N22 — cấu hình luật (HOP-DONG-MOI §6).
 *
 * Luật `GENERAL` không bật/tắt, không đổi mức được thử ở **cả hai** chỗ: bản
 * nhận (path `['overrides', …]`) và bản gửi (path `['body', 'overrides', …]`).
 */

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

const fullOverride = {
  enabled: false,
  severity: 'warning',
  thresholds: { 'wall.maxThicknessMm': 400, 'wall.minThicknessMm': 80 },
};

const fullOverrides = {
  'DOOR-WIDTH': { severity: 'critical' },
  GENERAL: { thresholds: { 'general.jointToleranceMm': 15, 'general.parallelAngleDeg': 3 } },
  'ROOM-AREA-BELOW-MINIMUM': { thresholds: { 'room.minArea.bedroom': 9 } },
  'WALL-THICKNESS': fullOverride,
};

describe('RULE_OVERRIDE_SEVERITIES', () => {
  it('đúng ba mức của HOP-DONG-MOI §6, cùng thứ tự', () => {
    expect([...RULE_OVERRIDE_SEVERITIES]).toStrictEqual(['critical', 'warning', 'suggestion']);
  });
});

describe('RuleOverrideSchema', () => {
  it('nhận mẫu đầy đủ', () => {
    expect(RuleOverrideSchema.parse(fullOverride)).toStrictEqual(fullOverride);
  });

  it.each([
    ['enabled', { enabled: true }],
    ['severity', { severity: 'suggestion' }],
    ['thresholds', { thresholds: { 'door.minWidthMm': 800 } }],
  ])('nhận mẫu tối thiểu chỉ có %s', (_key, body) => {
    expect(RuleOverrideSchema.parse(body)).toStrictEqual(body);
  });

  it('từ chối khoá lạ', () => {
    expect(issuePaths(RuleOverrideSchema, { ...fullOverride, version: 2 })).toStrictEqual([[]]);
  });

  it.each(['enabled', 'severity', 'thresholds'])('từ chối null ở %s', (key) => {
    expect(issuePaths(RuleOverrideSchema, { ...fullOverride, [key]: null })).toStrictEqual([[key]]);
  });

  it.each([
    ['mức ngoài tập', { severity: 'info' }, ['severity']],
    [
      'khoá ngưỡng không có dấu chấm',
      { thresholds: { minThicknessMm: 80 } },
      ['thresholds', 'minThicknessMm'],
    ],
    [
      'khoá ngưỡng có gạch ngang',
      { thresholds: { 'wall.min-thickness': 80 } },
      ['thresholds', 'wall.min-thickness'],
    ],
    [
      'khoá ngưỡng bắt đầu bằng số',
      { thresholds: { '1wall.minMm': 80 } },
      ['thresholds', '1wall.minMm'],
    ],
    [
      'ngưỡng vô hạn',
      { thresholds: { 'wall.minThicknessMm': Number.POSITIVE_INFINITY } },
      ['thresholds', 'wall.minThicknessMm'],
    ],
    [
      'ngưỡng NaN',
      { thresholds: { 'wall.minThicknessMm': Number.NaN } },
      ['thresholds', 'wall.minThicknessMm'],
    ],
    [
      'ngưỡng là chuỗi',
      { thresholds: { 'wall.minThicknessMm': '80' } },
      ['thresholds', 'wall.minThicknessMm'],
    ],
  ])('từ chối %s', (_label, body, path) => {
    expect(issuePaths(RuleOverrideSchema, body)).toStrictEqual([path]);
  });

  describe('refine: ≥ 1 khoá có giá trị', () => {
    it.each([
      ['mục rỗng', {}],
      ['một khoá mang undefined', { enabled: undefined }],
      [
        'cả ba khoá mang undefined',
        { enabled: undefined, severity: undefined, thresholds: undefined },
      ],
    ])('%s → path []', (_label, body) => {
      expect(issuePaths(RuleOverrideSchema, body)).toStrictEqual([[]]);
    });
  });

  describe('refine: thresholds (nếu có) không rỗng', () => {
    it('thresholds rỗng → path thresholds', () => {
      expect(issuePaths(RuleOverrideSchema, { thresholds: {} })).toStrictEqual([['thresholds']]);
    });

    it('thresholds rỗng kèm khoá khác vẫn hỏng, chỉ ở thresholds', () => {
      expect(issuePaths(RuleOverrideSchema, { enabled: true, thresholds: {} })).toStrictEqual([
        ['thresholds'],
      ]);
    });
  });
});

describe('ProjectRuleConfigSchema', () => {
  const fullConfig = { overrides: fullOverrides, revision: 7 };

  it('nhận mẫu đầy đủ', () => {
    expect(ProjectRuleConfigSchema.parse(fullConfig)).toStrictEqual(fullConfig);
  });

  it('nhận mẫu tối thiểu: overrides {} và revision 0', () => {
    expect(ProjectRuleConfigSchema.parse({ overrides: {}, revision: 0 })).toStrictEqual({
      overrides: {},
      revision: 0,
    });
  });

  it('bỏ hẳn khoá mang undefined của từng mục khỏi đầu ra', () => {
    expect(
      ProjectRuleConfigSchema.parse({
        overrides: {
          'WALL-LENGTH': { enabled: false, severity: undefined, thresholds: undefined },
        },
        revision: 1,
      }),
    ).toStrictEqual({ overrides: { 'WALL-LENGTH': { enabled: false } }, revision: 1 });
  });

  itRequiresKeys(ProjectRuleConfigSchema, fullConfig, ['overrides', 'revision']);

  // Không có trường tuỳ chọn ở cấp này; null ở trường tuỳ chọn của từng mục thử ở RuleOverrideSchema.

  it('từ chối khoá lạ ở cấp ngoài', () => {
    expect(issuePaths(ProjectRuleConfigSchema, { ...fullConfig, version: 3 })).toStrictEqual([[]]);
  });

  it('từ chối khoá lạ trong overrides.WALL-THICKNESS', () => {
    expect(
      issuePaths(ProjectRuleConfigSchema, {
        overrides: { 'WALL-THICKNESS': { ...fullOverride, note: 'x' } },
        revision: 1,
      }),
    ).toStrictEqual([['overrides', 'WALL-THICKNESS']]);
  });

  it.each(['wall-thickness', 'WALL_THICKNESS', 'WALL--THICKNESS', '-WALL', 'WALL-', '1WALL'])(
    'từ chối mã luật sai mẫu %s',
    (code) => {
      expect(
        issuePaths(ProjectRuleConfigSchema, {
          overrides: { [code]: { enabled: true } },
          revision: 1,
        }),
      ).toStrictEqual([['overrides', code]]);
    },
  );

  it.each([
    ['revision âm', { revision: -1 }],
    ['revision thập phân', { revision: 2.5 }],
  ])('từ chối %s', (_label, patch) => {
    expect(issuePaths(ProjectRuleConfigSchema, { ...fullConfig, ...patch })).toStrictEqual([
      ['revision'],
    ]);
  });

  it('áp refine của từng mục, path có tiền tố overrides.<mã>', () => {
    expect(
      issuePaths(ProjectRuleConfigSchema, { overrides: { 'WALL-LENGTH': {} }, revision: 1 }),
    ).toStrictEqual([['overrides', 'WALL-LENGTH']]);
    expect(
      issuePaths(ProjectRuleConfigSchema, {
        overrides: { 'WALL-LENGTH': { thresholds: {} } },
        revision: 1,
      }),
    ).toStrictEqual([['overrides', 'WALL-LENGTH', 'thresholds']]);
  });

  describe('superRefine: GENERAL không có enabled, severity', () => {
    it('GENERAL.enabled → path overrides.GENERAL.enabled', () => {
      expect(
        issuePaths(ProjectRuleConfigSchema, {
          overrides: { GENERAL: { enabled: false } },
          revision: 1,
        }),
      ).toStrictEqual([['overrides', 'GENERAL', 'enabled']]);
    });

    it('GENERAL.severity → path overrides.GENERAL.severity', () => {
      expect(
        issuePaths(ProjectRuleConfigSchema, {
          overrides: { GENERAL: { severity: 'critical' } },
          revision: 1,
        }),
      ).toStrictEqual([['overrides', 'GENERAL', 'severity']]);
    });

    it('cả hai → hai issue, mỗi trường một', () => {
      expect(
        issuePaths(ProjectRuleConfigSchema, {
          overrides: { GENERAL: { enabled: true, severity: 'warning' } },
          revision: 1,
        }),
      ).toStrictEqual([
        ['overrides', 'GENERAL', 'enabled'],
        ['overrides', 'GENERAL', 'severity'],
      ]);
    });

    it('GENERAL với enabled, severity mang undefined đạt, đầu ra chỉ còn thresholds', () => {
      const thresholds = { 'general.jointToleranceMm': 20 };
      expect(
        ProjectRuleConfigSchema.parse({
          overrides: { GENERAL: { enabled: undefined, severity: undefined, thresholds } },
          revision: 2,
        }),
      ).toStrictEqual({ overrides: { GENERAL: { thresholds } }, revision: 2 });
    });

    it('mã khác GENERAL vẫn bật/tắt và đổi mức được', () => {
      expect(
        accepts(ProjectRuleConfigSchema, {
          overrides: { 'WALL-OVERLAP': { enabled: false, severity: 'suggestion' } },
          revision: 1,
        }),
      ).toBe(true);
    });
  });
});

describe('UpdateRuleConfigSchema', () => {
  const write = { baseVersion: 7, body: { overrides: fullOverrides } };

  it('nhận mẫu đầy đủ', () => {
    expect(UpdateRuleConfigSchema.parse(write)).toStrictEqual(write);
  });

  it('nhận mẫu tối thiểu: baseVersion 0, overrides {}', () => {
    const minimal = { baseVersion: 0, body: { overrides: {} } };
    expect(UpdateRuleConfigSchema.parse(minimal)).toStrictEqual(minimal);
  });

  itRequiresKeys(UpdateRuleConfigSchema, write, ['baseVersion', 'body']);

  it('từ chối thân thiếu overrides', () => {
    expect(issuePaths(UpdateRuleConfigSchema, { baseVersion: 0, body: {} })).toStrictEqual([
      ['body', 'overrides'],
    ]);
  });

  it('từ chối revision trong thân', () => {
    expect(
      issuePaths(UpdateRuleConfigSchema, { baseVersion: 0, body: { overrides: {}, revision: 0 } }),
    ).toStrictEqual([['body']]);
  });

  it('từ chối khoá lạ trong overrides.DOOR-WIDTH', () => {
    expect(
      issuePaths(UpdateRuleConfigSchema, {
        baseVersion: 0,
        body: { overrides: { 'DOOR-WIDTH': { enabled: true, label: 'x' } } },
      }),
    ).toStrictEqual([['body', 'overrides', 'DOOR-WIDTH']]);
  });

  it('từ chối baseVersion âm', () => {
    expect(issuePaths(UpdateRuleConfigSchema, { ...write, baseVersion: -1 })).toStrictEqual([
      ['baseVersion'],
    ]);
  });

  describe('superRefine: GENERAL không có enabled, severity (path có tiền tố body)', () => {
    it('GENERAL.enabled → path body.overrides.GENERAL.enabled', () => {
      expect(
        issuePaths(UpdateRuleConfigSchema, {
          baseVersion: 1,
          body: { overrides: { GENERAL: { enabled: false } } },
        }),
      ).toStrictEqual([['body', 'overrides', 'GENERAL', 'enabled']]);
    });

    it('GENERAL.severity → path body.overrides.GENERAL.severity', () => {
      expect(
        issuePaths(UpdateRuleConfigSchema, {
          baseVersion: 1,
          body: { overrides: { GENERAL: { severity: 'suggestion' } } },
        }),
      ).toStrictEqual([['body', 'overrides', 'GENERAL', 'severity']]);
    });

    it('GENERAL với enabled mang undefined đạt', () => {
      expect(
        accepts(UpdateRuleConfigSchema, {
          baseVersion: 1,
          body: {
            overrides: {
              GENERAL: { enabled: undefined, thresholds: { 'general.parallelAngleDeg': 2 } },
            },
          },
        }),
      ).toBe(true);
    });
  });
});
