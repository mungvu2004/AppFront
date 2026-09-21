import { z } from 'zod';

import { CursorPageSchema, VersionedWriteSchema, isoInstantSchema } from './common';
import { DimensionSchema, SpatialLayerSchema } from './spatial';

/**
 * N17–N20 — lịch sử phiên bản **theo tầng**.
 *
 * ## `floorRevision` là trường làm cả màn này chạy đúng
 *
 * Một phiên bản có hai con số. `sequence` đếm các bản chụp của tầng, tăng đều
 * và không nói gì về tài liệu. `floorRevision` là `revision` của tài liệu tầng
 * **tại lúc chụp** — và đó mới là thứ so được với hiện tại.
 *
 * Không có nó, "bản này có phải bản đang dùng không" phải đoán bằng
 * `index === 0` của danh sách, và câu trả lời sai ngay khi một lượt tự lưu chen
 * vào giữa hai lần tải: hàng đầu vẫn là phiên bản mới nhất, nhưng tài liệu đã
 * đi tiếp. Với `floorRevision`, câu hỏi thành một phép so hai số
 * (`isCurrent ⇔ floorRevision === revision hiện tại`), và `baseVersion` của lượt
 * khôi phục lấy từ `revision` của tầng chứ không từ `sequence` — lấy nhầm sẽ
 * đè im lặng lên việc người khác vừa làm.
 *
 * ## `creatorName` có mặt vì màn không có chỗ nào khác lấy tên
 *
 * `creatorId` là `usr_` + ULID, hoặc literal `system:pipeline`. Không một màn
 * nào trong repo tra được id ấy ra tên người, nên nếu máy chủ không ghép sẵn
 * thì lịch sử phiên bản sẽ in nguyên chuỗi `usr_01J…` cho người đọc. Máy chủ
 * ghép, và `system:pipeline` thành "hệ thống AI".
 *
 * ## `hasSnapshot` phân biệt "không có" với "chưa tải"
 *
 * Chỉ 50 bản gần nhất còn giữ nội dung. Bản cũ hơn vẫn nằm trong danh sách —
 * lịch sử là lịch sử — nhưng `hasSnapshot: false`, nên màn tắt nút xem và nút
 * khôi phục **trước khi** người dùng bấm, thay vì để họ nhận một 422
 * `VERSION_SNAPSHOT_PURGED` sau một vòng mạng.
 */

/** Id phiên bản: `ver_` + ULID (HOP-DONG-MOI §0.1). */
const versionIdSchema = z.string().regex(/^ver_[0-9A-HJKMNP-TV-Z]{26}$/);

/** Người tạo phiên bản, hoặc chính ống pipeline. */
const actorIdSchema = z.string().regex(/^(usr_[0-9A-HJKMNP-TV-Z]{26}|system:pipeline)$/);

/** Mã tầng: chuỗi không rỗng, không regex — xem `./spatialGraph.ts`. */
const floorIdSchema = z.string().min(1);

/**
 * Dài nhất một nhãn phiên bản được phép.
 *
 * Nhãn là thứ người dùng tự đặt để nhận ra một bản giữa hai mươi bản khác —
 * "trước khi sửa trục", "bản gửi chủ đầu tư". Sáu mươi ký tự là một dòng đọc
 * lướt được; dài hơn là một ghi chú, và `note` đã là chỗ cho ghi chú.
 */
const MAX_VERSION_LABEL_LENGTH = 60;

/**
 * Một dòng trong lịch sử phiên bản.
 *
 * `note` do máy chủ ghép ("trạng thái trước khi ghi kết quả AI"); `label` do
 * người dùng gõ. Hai thứ khác nhau nên là hai trường: đặt nhãn **không** sinh
 * phiên bản mới, còn `note` thì gắn chặt với lý do bản ấy ra đời.
 */
export const FloorVersionSummarySchema = z
  .object({
    createdAt: isoInstantSchema,
    creatorId: actorIdSchema,
    creatorName: z.string().min(1),
    floorRevision: z.number().int().nonnegative(),
    hasSnapshot: z.boolean(),
    id: versionIdSchema,
    label: z.string().min(1).max(MAX_VERSION_LABEL_LENGTH).optional(),
    note: z.string().min(1).optional(),
    sequence: z.number().int().positive(),
  })
  .strict()
  .transform((wireVersion) => ({
    createdAt: wireVersion.createdAt,
    creatorId: wireVersion.creatorId,
    creatorName: wireVersion.creatorName,
    floorRevision: wireVersion.floorRevision,
    hasSnapshot: wireVersion.hasSnapshot,
    id: wireVersion.id,
    ...(wireVersion.label !== undefined ? { label: wireVersion.label } : {}),
    ...(wireVersion.note !== undefined ? { note: wireVersion.note } : {}),
    sequence: wireVersion.sequence,
  }));

export type FloorVersionSummary = z.infer<typeof FloorVersionSummarySchema>;

/** N17 — một trang lịch sử. `sequence` giảm dần; thứ tự là H1 ngữ cảnh, không zod. */
export const FloorVersionPageSchema = CursorPageSchema(FloorVersionSummarySchema);

/**
 * N18 — nội dung một bản chụp.
 *
 * Chỉ `layer` và `dimensions`: `level`, `axes` và tỉ lệ **giữ hiện trạng** khi
 * khôi phục, nên chụp lại chúng là chụp một thứ sẽ không được dùng tới. Tỉ lệ
 * đặc biệt không được chụp — khôi phục một tỉ lệ cũ sẽ lặng lẽ đổi kích thước
 * thật của mọi thứ trên tầng.
 */
export const FloorVersionSnapshotSchema = z
  .object({
    dimensions: z.array(DimensionSchema),
    layer: SpatialLayerSchema,
    versionId: versionIdSchema,
  })
  .strict();

export type FloorVersionSnapshot = z.infer<typeof FloorVersionSnapshotSchema>;

/**
 * N19 — khôi phục, là một lượt **ghi có version**.
 *
 * `baseVersion` ở đây là `revision` hiện tại của **tầng**, không phải
 * `sequence` của phiên bản đang khôi phục: khôi phục ghi đè cả lớp, nên nó phải
 * dựa trên trạng thái mà người bấm nút đang nhìn thấy.
 */
export const RestoreVersionSchema = VersionedWriteSchema(
  z.object({ floorId: floorIdSchema }).strict(),
);

export type RestoreVersion = z.infer<typeof RestoreVersionSchema>;

/**
 * N20 — đặt hoặc gỡ nhãn.
 *
 * `''` là **gỡ nhãn**, không phải một nhãn rỗng — nên không có `.min(1)` ở đây,
 * khác `label` của `FloorVersionSummarySchema`, nơi một chuỗi rỗng đi lên từ
 * máy chủ sẽ là một nhãn không hiện ra được. `.trim()` trước `.max()` để sáu
 * mươi dấu cách cũng là gỡ nhãn.
 */
export const LabelVersionSchema = z
  .object({
    label: z.string().trim().max(MAX_VERSION_LABEL_LENGTH),
  })
  .strict();

export type LabelVersion = z.infer<typeof LabelVersionSchema>;
