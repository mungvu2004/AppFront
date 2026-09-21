import { z } from 'zod';

/**
 * #16–#18 — các phép đo người dùng ghim lại trên mô hình (LG-3).
 *
 * ## Hai chiều, một schema
 *
 * Khác mọi file khác trong thư mục này, `MeasurementRecordSchema` vừa giải mã
 * thứ `GET` trả về, vừa kiểm thứ `POST` gửi lên — vì cả hai là **cùng một bản
 * ghi**. Id do client sinh, nên client đã biết trọn hình dạng trước khi máy chủ
 * nhìn thấy nó lần đầu; không có trường nào máy chủ thêm vào.
 *
 * ## Hai miễn trừ được ghi rõ, không phải hai chỗ lỏng tay
 *
 * - **Id do client sinh** (`MS-0001`, `MS-0002`…), không phải ULID do máy chủ
 *   cấp. Người dùng chấm một phép đo trong lúc ngoại tuyến vẫn phải có một bản
 *   ghi hoàn chỉnh để ghim, và một id "sẽ có sau" thì không ghim được. Máy chủ
 *   nhận tối đa 15 chữ số — số lớn hơn vượt `Number.MAX_SAFE_INTEGER` của chính
 *   bộ sinh FE, nên nó không thể là một id thật.
 * - **Toạ độ là số thực**, không phải số nguyên milimét như `./spatial.ts`.
 *   Một điểm đo là chỗ con trỏ chạm vào mặt phẳng 3D, không phải một đỉnh tường
 *   đã bắt điểm; làm tròn nó về mm trước khi đo sẽ đẩy sai số vào chính con số
 *   mà người dùng đang muốn biết.
 *
 * Cả hai là ngoại lệ của W3/W4 và được ghi thẳng trong HOP-DONG-MOI §7.1, chứ
 * không suy ra từ việc schema này lỏng hơn.
 *
 * ## `rawValueMm` đổi đơn vị theo `mode`
 *
 * Với ba chế độ đo chiều dài, nó là milimét. Với `floorArea`, nó là **milimét
 * vuông**. Tên trường không nói ra điều đó, và đổi tên nó là việc của một prompt
 * khác — nhưng chỗ nào đọc trường này mà không rẽ theo `mode` thì đang sai một
 * triệu lần.
 */

/** Bốn chế độ đo. Cùng thứ tự với `MeasurementRecordMode` của `types/measurement.ts:12`. */
export const MEASUREMENT_RECORD_MODES = [
  'pointToPoint',
  'perpendicular',
  'height',
  'floorArea',
] as const;

/**
 * Một điểm đã chấm.
 *
 * `z` vắng mặt nghĩa là điểm nằm trên cốt nền — không phải `z: 0` ngầm hiểu,
 * mà là **vắng khoá**, đúng như `MeasurePoint` của `domain/measure/measure.ts:61-66`
 * khai. Một phép đo trên mặt bằng là ca phẳng của phép đo tổng quát, không phải
 * một nhánh mã riêng.
 */
export const MeasurementPointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite().optional(),
  })
  .strict()
  .transform((wirePoint) => ({
    x: wirePoint.x,
    y: wirePoint.y,
    ...(wirePoint.z !== undefined ? { z: wirePoint.z } : {}),
  }));

export type MeasurementPoint = z.infer<typeof MeasurementPointSchema>;

/**
 * Một phép đo đã ghim.
 *
 * `.refine()` đếm điểm theo chế độ: một đa giác cần **ba** đỉnh mới có diện
 * tích, ba chế độ còn lại cần **hai** điểm mới có khoảng cách. Đây là phép kiểm
 * duy nhất ở đây mà kiểu không nói được, và thiếu nó thì một bản ghi một điểm
 * đi qua biên giới rồi vỡ ở `measurePolygonArea`, xa chỗ dữ liệu vào tới mức
 * không lần ngược được.
 *
 * Danh sách điểm **không** có trần trên: `measureChain` nhận chuỗi dài tuỳ ý,
 * và trần của cả danh sách phép đo (1000) đã ở chỗ khác.
 */
export const MeasurementRecordSchema = z
  .object({
    id: z.string().regex(/^MS-\d{4,}$/),
    mode: z.enum(MEASUREMENT_RECORD_MODES),
    name: z.string().min(1),
    points: z.array(MeasurementPointSchema),
    rawValueMm: z.number().finite().nonnegative(),
  })
  .strict()
  .refine((record) => record.points.length >= (record.mode === 'floorArea' ? 3 : 2), {
    path: ['points'],
  })
  .transform((wireRecord) => ({
    id: wireRecord.id,
    mode: wireRecord.mode,
    name: wireRecord.name,
    points: wireRecord.points,
    rawValueMm: wireRecord.rawValueMm,
  }));

export type MeasurementRecordBody = z.infer<typeof MeasurementRecordSchema>;
