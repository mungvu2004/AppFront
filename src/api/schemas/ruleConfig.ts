import { z } from 'zod';

import { VersionedWriteSchema } from './common';

/**
 * N21, N22 — cấu hình luật của một dự án (HOP-DONG-MOI §6).
 *
 * Zod chỉ kiểm **mẫu** của mã luật và khoá ngưỡng. Tập đúng 25 mã (cộng
 * `GENERAL`) và 26 khoá ngưỡng **không** kiểm ở đây — H4 kiểm, và BE trả
 * `RULE_CODE_UNKNOWN` / `RULE_THRESHOLD_UNKNOWN`.
 *
 * `revision` ở đây là version của **máy chủ**. `RuleConfig.version` của
 * `domain/rules/config.ts` là bộ đếm phía client, không phải `baseVersion`.
 *
 * ## `RuleOverrideSchema` không transform
 *
 * Mục ghi đè đi cả hai chiều: trong bản nhận N21 và trong thân gửi N22.
 * HOP-DONG-MOI §6 chỉ ghi cho nó strict và hai refine, không có transform; và
 * schema gửi chỉ `.strict()` (§0). Nên một schema chung, không transform, dùng
 * được ở cả hai chỗ, còn bản nhận `ProjectRuleConfigSchema` dựng lại từng mục
 * bằng {@link toRuleOverride} để vắng vẫn là vắng.
 */

export const RULE_OVERRIDE_SEVERITIES = ['critical', 'warning', 'suggestion'] as const;

/** Mã luật (`WALL-THICKNESS`, `GENERAL`…). Tập đúng là việc của H4. */
const ruleCodeSchema = z.string().regex(/^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$/);

/** Khoá ngưỡng (`wall.minThicknessMm`, `room.minArea.bedroom`…). */
const thresholdKeySchema = z.string().regex(/^[a-zA-Z]+(\.[a-zA-Z0-9]+)+$/);

/** Mã giả của các dung sai dùng chung — `GENERAL_THRESHOLD_CODE` của `domain/rules/config.ts`. */
const GENERAL_RULE_CODE = 'GENERAL';

/**
 * Điều một dự án đổi ở một luật. Vắng = như lúc giao.
 *
 * Hai refine đều so **giá trị** với `undefined`: zod 3 giữ khoá mang
 * `undefined`, nên `{ enabled: undefined }` là một mục không đổi gì và phải
 * hỏng như `{}`.
 */
export const RuleOverrideSchema = z
  .object({
    enabled: z.boolean().optional(),
    severity: z.enum(RULE_OVERRIDE_SEVERITIES).optional(),
    thresholds: z.record(thresholdKeySchema, z.number().finite()).optional(),
  })
  .strict()
  .refine(
    (override) =>
      override.enabled !== undefined ||
      override.severity !== undefined ||
      override.thresholds !== undefined,
    { path: [] },
  )
  .refine(
    (override) => override.thresholds === undefined || Object.keys(override.thresholds).length > 0,
    { path: ['thresholds'] },
  );

export type RuleOverride = z.infer<typeof RuleOverrideSchema>;

/**
 * Bản ghi `overrides`, kèm luật `GENERAL` không bật/tắt, không đổi mức được.
 *
 * `superRefine` đặt **ở đây**, trên chính bản ghi, với `path` tương đối
 * `['GENERAL', …]`. zod nối path theo chỗ schema con nằm, nên cùng một luật ra
 * `['overrides','GENERAL','enabled']` ở N21 và `['body','overrides','GENERAL',
 * 'enabled']` ở N22 — một luật, không hai bản sao.
 *
 * "Có `enabled`" nghĩa là có **giá trị**: `GENERAL: { enabled: undefined,
 * thresholds: {…} }` đạt, vì trên dây nó chính là `{ thresholds: {…} }`.
 */
const overridesSchema = z
  .record(ruleCodeSchema, RuleOverrideSchema)
  .superRefine((overrides, context) => {
    const general = overrides[GENERAL_RULE_CODE];
    if (general === undefined) return;
    if (general.enabled !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [GENERAL_RULE_CODE, 'enabled'] });
    }
    if (general.severity !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [GENERAL_RULE_CODE, 'severity'] });
    }
  });

function toRuleOverride(wireOverride: RuleOverride) {
  return {
    ...(wireOverride.enabled !== undefined ? { enabled: wireOverride.enabled } : {}),
    ...(wireOverride.severity !== undefined ? { severity: wireOverride.severity } : {}),
    ...(wireOverride.thresholds !== undefined ? { thresholds: wireOverride.thresholds } : {}),
  };
}

/** N21. Chưa sửa lần nào → `{ revision: 0, overrides: {} }`. */
export const ProjectRuleConfigSchema = z
  .object({
    overrides: overridesSchema,
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .transform((wireConfig) => ({
    overrides: Object.fromEntries(
      Object.entries(wireConfig.overrides).map(([code, override]) => [
        code,
        toRuleOverride(override),
      ]),
    ),
    revision: wireConfig.revision,
  }));

export type ProjectRuleConfig = z.infer<typeof ProjectRuleConfigSchema>;

/** N22. 409 trả `remoteChanges: []`, xử lý bằng `kind === 'conflict'` (rào C1). */
export const UpdateRuleConfigSchema = VersionedWriteSchema(
  z.object({ overrides: overridesSchema }).strict(),
);

export type UpdateRuleConfig = z.infer<typeof UpdateRuleConfigSchema>;
