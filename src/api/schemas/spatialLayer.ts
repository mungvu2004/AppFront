import { z } from 'zod';

import { VersionedWriteSchema } from './common';
import { AxisSchema, DimensionSchema, LevelSchema, SpatialLayerSchema } from './spatial';

/**
 * `GET` và `PUT /api/projects/{project_id}/floors/{floor_id}/spatial/layer` —
 * lớp không gian của **một** tầng, là thứ sáu màn QC đọc và là thứ duy nhất
 * chúng ghi.
 *
 * ## Bọc `SpatialLayerSchema`, không `.extend()` nó
 *
 * `SpatialLayerSchema` (`./spatial.ts:306`) khai kiểu trả về là
 * `z.ZodType<SpatialLayerShape>`, và `ZodType` không có `.extend()` — chỉ
 * `ZodObject` mới có. Gỡ lời khai ấy ra để `.extend()` được thì mất luôn phép
 * kiểm mà nó tồn tại để giữ: thêm một trường bắt buộc vào `SpatialLayer` mà
 * quên sửa schema sẽ hết đỏ lúc `pnpm typecheck`.
 *
 * Nên tài liệu tầng **chứa** lớp trong một trường `layer` thay vì trải nó ra.
 * Hình dạng ấy cũng đúng hơn về nghiệp vụ: `revision`, `level` và `scaleStatus`
 * nói về *tầng*, còn bốn danh sách nói về *nội dung vẽ trên tầng* — trộn chín
 * khoá vào một mặt phẳng thì chỗ đọc không còn phân biệt được hai chuyện.
 *
 * ## `scaleStatus` chỉ có một giá trị, và đó là chủ ý
 *
 * Trên dây chỉ tồn tại `'unresolved'`, nghĩa là "tầng này có một tỉ lệ, nhưng
 * nó do pipeline suy ra hoặc lấy từ mặc định của dự án, chưa ai xác nhận".
 * Tầng đã hiệu chỉnh thì **vắng hẳn** khoá này — không phải mang một giá trị
 * `'resolved'` nào đó. Lý do là W2: vắng trường, không `null`, và cũng không
 * một giá trị canh gác. `SCALE_UNRESOLVED` mà pipeline dùng là mã **nội bộ**
 * của nó, không bao giờ lên dây (HOP-DONG-MOI §4.2).
 *
 * Hệ quả cho `ScaleCalibration`: nó coi tỉ lệ của một tầng `unresolved` là
 * `null`, tức chưa hiệu chỉnh (`screens/pipeline/ScaleCalibration/useScaleCalibration.ts:515-523`).
 *
 * ## Ghi: hai trường, cả hai tuỳ chọn, và ít nhất một phải có
 *
 * `PUT` nhận `layer`, hoặc tỉ lệ, hoặc cả hai. Cả hai cùng vắng là một request
 * rỗng — nó sẽ tiêu một `baseVersion`, sinh một `revision` mới và không đổi gì,
 * nên nó bị `.refine()` chặn ngay ở biên giới thay vì đi hết một vòng mạng.
 *
 * Đó cũng là lý do `FloorLayerWriteBodySchema` được nhét vào
 * `VersionedWriteSchema` **sau khi** đã refine: `zod` gắn tiền tố đường dẫn của
 * cha vào mọi issue của con, nên vi phạm ấy hiện ra ở `['body']` của thân ngoài
 * — đúng chỗ người đọc lỗi đang đứng.
 */

/** Số hiệu bản ghi của tài liệu tầng. */
const revisionSchema = z.number().int().nonnegative();

/**
 * Tỉ lệ bản vẽ mà người dùng vừa hiệu chỉnh, mm trên mỗi pixel của trang đã nắn.
 *
 * Không nhận nhãn `MillimetresPerPixel` ở đây, khác `LevelSchema`: đây là schema
 * **gửi đi**, và HOP-DONG-MOI §0 nói schema gửi chỉ `.strict()` — không
 * `.transform()`, nên không có chỗ nào để gán nhãn. Nhãn là chuyện của đường
 * đọc, nơi một số lạ mới thật sự đi vào ứng dụng.
 */
const scaleMillimetresPerPixelSchema = z.number().positive().finite();

/**
 * Thân `GET`: `revision`, siêu dữ liệu tầng, lớp vẽ, trục và kích thước.
 *
 * `axes` là `[]` ở v1 và `dimensions` chỉ để đọc — nhưng cả hai vẫn **bắt
 * buộc** có mặt, cùng lý do với `SpatialGraphSchema`: danh sách rỗng trả lời
 * được "chưa có", khoá vắng thì không.
 *
 * `notes` **không** ở đây, khác `SpatialGraphSchema`: không màn QC nào đọc ghi
 * chú, và W1 nói cái gì không màn nào cần thì không lên dây.
 */
export const FloorLayerDocumentSchema = z
  .object({
    axes: z.array(AxisSchema),
    dimensions: z.array(DimensionSchema),
    layer: SpatialLayerSchema,
    level: LevelSchema,
    revision: revisionSchema,
    scaleStatus: z.literal('unresolved').optional(),
  })
  .strict()
  .refine(
    (document) =>
      document.scaleStatus === undefined || document.level.scaleMillimetresPerPixel !== undefined,
    { path: ['level', 'scaleMillimetresPerPixel'] },
  )
  .transform((wireDocument) => ({
    axes: wireDocument.axes,
    dimensions: wireDocument.dimensions,
    layer: wireDocument.layer,
    level: wireDocument.level,
    revision: wireDocument.revision,
    ...(wireDocument.scaleStatus !== undefined ? { scaleStatus: wireDocument.scaleStatus } : {}),
  }));

export type FloorLayerDocument = z.infer<typeof FloorLayerDocumentSchema>;

/**
 * Thân `PUT` trước khi bọc version: lớp mới, tỉ lệ mới, hoặc cả hai.
 *
 * Gửi cả hai thì `layer` được hiểu ở hệ tỉ lệ **cũ** và máy chủ tính lại —
 * nên "áp tỉ lệ cho mọi tầng" không phải gửi trọn lớp của từng tầng
 * (HOP-DONG-MOI §4, #35).
 */
export const FloorLayerWriteBodySchema = z
  .object({
    layer: SpatialLayerSchema.optional(),
    scaleMillimetresPerPixel: scaleMillimetresPerPixelSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { path: [] });

export type FloorLayerWriteBody = z.infer<typeof FloorLayerWriteBodySchema>;

/** Thân `PUT` đầy đủ: `{baseVersion, body}`. */
export const FloorLayerWriteSchema = VersionedWriteSchema(FloorLayerWriteBodySchema);

export type FloorLayerWrite = z.infer<typeof FloorLayerWriteSchema>;

/**
 * Phản hồi của `PUT`: bản đã lưu, cộng `revision` mới.
 *
 * `layer` trả về là **nguồn thay kho** của F-04b, không phải một lời xác nhận
 * để bỏ đi: máy chủ tính lại `Room.areaM2` từ `outline` (W18) và quy đổi lại mm
 * cho mọi thực thể chưa duyệt khi tỉ lệ đổi, nên bản nó gửi về khác bản client
 * vừa gửi lên.
 */
export const FloorLayerWriteResultSchema = z
  .object({
    layer: SpatialLayerSchema,
    revision: revisionSchema,
  })
  .strict();

export type FloorLayerWriteResult = z.infer<typeof FloorLayerWriteResultSchema>;
