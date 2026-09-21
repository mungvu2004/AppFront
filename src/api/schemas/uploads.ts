import { z } from 'zod';

import { CursorPageSchema } from './common';

/**
 * N7 — `GET /api/projects/{project_id}/drawings/uploads/latest`: lượt tải mới
 * nhất của từng tầng, để màn xử lý biết theo dõi `uploadId` nào
 * (HOP-DONG-MOI §2 N7).
 *
 * Mục sắp theo `Floor.order` là H1 ngữ cảnh, không zod.
 */

const uploadIdSchema = z.string().regex(/^upl_[0-9A-HJKMNP-TV-Z]{26}$/);

/** Mã tầng: chuỗi không rỗng, không regex (HOP-DONG-MOI §0.1). `ProcessingFloorUpload.floorId` là `string`. */
const floorIdSchema = z.string().min(1);

/** `sourceImageUrl` là ảnh trang **đã nắn** (HOP-DONG-MOI §4.2), không phải tệp gốc. */
export const LatestFloorUploadSchema = z
  .object({
    floorId: floorIdSchema,
    floorName: z.string().min(1),
    sourceImageUrl: z.string().url().optional(),
    uploadId: uploadIdSchema,
  })
  .strict()
  .transform((wireUpload) => ({
    floorId: wireUpload.floorId,
    floorName: wireUpload.floorName,
    ...(wireUpload.sourceImageUrl !== undefined
      ? { sourceImageUrl: wireUpload.sourceImageUrl }
      : {}),
    uploadId: wireUpload.uploadId,
  }));

export type LatestFloorUpload = z.infer<typeof LatestFloorUploadSchema>;

/** N7. ≤ 50 tầng nên vừa một trang. */
export const LatestFloorUploadPageSchema = CursorPageSchema(LatestFloorUploadSchema);

export type LatestFloorUploadPage = z.infer<typeof LatestFloorUploadPageSchema>;
