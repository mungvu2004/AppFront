import { z } from 'zod';

import { VersionedWriteSchema } from './common';

/**
 * N5, N6 — cài đặt dự án (HOP-DONG-MOI §2).
 *
 * Tên, mã, địa chỉ **không** ở đây — chúng vẫn đi #26. F-07 gửi hai request và
 * báo riêng phần hỏng.
 *
 * ## Một thân, hai chiều
 *
 * `ProjectSettingsBodySchema` là thân dùng chung, strict và **không** transform
 * để còn `.extend()` được (HOP-DONG-MOI §0, "Schema hai chiều"). Bản nhận thêm
 * `revision` rồi mới transform; bản gửi bọc thân trong `{baseVersion, body}`.
 *
 * Biên số khớp `PROJECT_SETTINGS_LIMITS` của màn
 * (`screens/project/ProjectSettings/projectSettingsGateway.ts`): bắt điểm 1–120
 * (`SNAP_THRESHOLDS.captureRadiusMm`), tỉ lệ 0,01–1000.
 */

export const PROJECT_BUILDING_TYPES = [
  'residential',
  'commercial',
  'industrial',
  'mixed',
  'other',
] as const;

export const PROJECT_LENGTH_UNITS = ['mm', 'm'] as const;

/** FE3D-B2 — kiểu cảnh 3D của dự án; khớp `SCENE_STYLE_IDS` (`lib/pascal/sceneStyles.ts`). */
export const PROJECT_SCENE_STYLES = ['am-ap', 'hien-dai-sang', 'go-am', 'toi-gian', 'sang-trong-toi'] as const;

/**
 * `notes` vắng nghĩa là rỗng — F-07 không gửi `''`, nên `.min(1)`.
 * `confidenceThreshold` chỉ để hiển thị; BE không bao giờ dùng nó để đặt
 * `reviewed` (A5).
 */
export const ProjectSettingsBodySchema = z
  .object({
    buildingType: z.enum(PROJECT_BUILDING_TYPES),
    confidenceThreshold: z.number().min(0).max(1),
    defaultScaleMmPerPx: z.number().min(0.01).max(1000),
    lengthUnit: z.enum(PROJECT_LENGTH_UNITS),
    notes: z.string().min(1).max(500).optional(),
    /* FE3D-FIX-003 W4a — kiểu cảnh 3D. PUT vắng = giữ nguyên (BE aed24f10), nên màn Cài đặt
       gửi đủ thân mà không mang trường này vẫn không xoá nó. BE nhận cả `null` = xoá, nhưng FE
       chưa có lối xoá nên thân gửi không nhận `null`. */
    sceneStyle: z.enum(PROJECT_SCENE_STYLES).optional(),
    /* UX-R2 K34 — "Các tầng là các căn hộ riêng": bật thì các tầng không chồng thành một nhà.
       BE mặc định `false`; vắng ở thân gửi = giữ nguyên (như `sceneStyle`). */
    separateUnits: z.boolean().optional(),
    snapToleranceMm: z.number().int().min(1).max(120),
  })
  .strict();

export type ProjectSettingsBody = z.infer<typeof ProjectSettingsBodySchema>;

/**
 * N5. Chưa lưu lần nào → `revision: 0` cùng mặc định của FE.
 *
 * `sceneStyle`: BE bỏ trường khi NULL, nhưng vẫn nhận `null` cho chắc; `null` ra như vắng.
 */
export const ProjectSettingsSchema = ProjectSettingsBodySchema.extend({
  revision: z.number().int().nonnegative(),
  sceneStyle: z.enum(PROJECT_SCENE_STYLES).nullable().optional(),
})
  .strict()
  /* Kiểu ra nhận `sceneStyle: undefined` để thân gửi (zod `.optional()`) trải thẳng vào được, như
     mock N6 và `settingsFromBody` vẫn làm; `notes` giữ vắng hẳn như trước. */
  .transform((wireSettings): Omit<ProjectSettingsBody, 'notes'> & { notes?: string; revision: number } => ({
    buildingType: wireSettings.buildingType,
    confidenceThreshold: wireSettings.confidenceThreshold,
    defaultScaleMmPerPx: wireSettings.defaultScaleMmPerPx,
    lengthUnit: wireSettings.lengthUnit,
    ...(wireSettings.notes !== undefined ? { notes: wireSettings.notes } : {}),
    revision: wireSettings.revision,
    ...(wireSettings.sceneStyle != null ? { sceneStyle: wireSettings.sceneStyle } : {}),
    ...(wireSettings.separateUnits !== undefined ? { separateUnits: wireSettings.separateUnits } : {}),
    snapToleranceMm: wireSettings.snapToleranceMm,
  }));

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

/** N6. 409 trả `remoteChanges: []`, xử lý bằng `kind === 'conflict'` (rào C1). */
export const UpdateProjectSettingsSchema = VersionedWriteSchema(ProjectSettingsBodySchema);

export type UpdateProjectSettings = z.infer<typeof UpdateProjectSettingsSchema>;
