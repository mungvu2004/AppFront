import { z } from 'zod';

/**
 * Bốn mảnh mà mọi hợp đồng mới dùng chung: thời điểm, trang danh sách, thân ghi
 * có version.
 *
 * ## Vì sao bốn thứ này ở chung một file
 *
 * Không phải vì chúng giống nhau về nghiệp vụ — chúng không giống. Chúng ở đây
 * vì cả bốn đều là **hình dạng của giao thức**, không phải hình dạng của một
 * tài nguyên: một danh sách phân trang không nói gì về dự án hay về tầng, nó chỉ
 * nói "còn nữa hay hết rồi". File nào cũng cần chúng, và file nào cũng **không**
 * được nhập `./index` (xem HOP-DONG-MOI §0), nên nếu không có chỗ này thì mỗi
 * schema mới lại khai lại một `z.string().datetime(...)` của riêng nó — và bốn
 * bản sao của cùng một độ chính xác mili giây là bốn cơ hội để một bản trôi.
 *
 * ## `isoInstantSchema` chặt hơn `isoDateTimeSchema` của `./index.ts`, có chủ ý
 *
 * `./index.ts` dùng `z.string().datetime({ offset: true })`: nó nhận cả
 * `+07:00` lẫn số chữ số mili giây tuỳ ý, vì hợp đồng cũ đã chạy như thế và
 * siết lại sẽ làm đỏ dữ liệu đang sống. Hợp đồng **mới** thì chưa có dữ liệu
 * nào, nên nó bắt đầu ở chỗ chặt: UTC `Z`, đúng ba chữ số (quy ước W3 của
 * `BE-00.md` §3). Hai máy chủ ghi cùng một khoảnh khắc mà ra hai chuỗi khác
 * nhau là một lớp lỗi so sánh chuỗi mà không ai gỡ được về sau.
 *
 * Hệ quả có thật, và cố ý: bộ mẫu chuẩn A14
 * (`domain/spatial/__fixtures__/sampleBuilding.ts:200`) dùng `+07:00`, nên nó
 * **hỏng** schema này. Đó là bộ mẫu của màn, không phải của dây.
 */

/** Một khoảnh khắc trên dây: ISO 8601, UTC `Z`, đúng ba chữ số mili giây. */
export const isoInstantSchema = z.string().datetime({ precision: 3 });

/**
 * Một trang của danh sách **mới**: các mục, cộng con trỏ sang trang sau.
 *
 * **Không** `.transform()` — khác mọi schema nhận khác trong thư mục này, và
 * đây là ngoại lệ được ghi trong HOP-DONG-MOI §1.2. Lý do: `zod` đã bỏ hẳn
 * khoá của một `.optional()` vắng mặt, nên "vắng vẫn vắng" giữ nguyên mà không
 * cần dựng lại; còn `.transform()` thì biến kết quả thành `ZodEffects`, và
 * gateway cần gọi `.extend()`/`.pick()` trên trang ở vài chỗ thì không còn làm
 * được nữa.
 *
 * Hàm chứ không phải hằng vì `items` đổi kiểu theo từng đường gọi. Không export
 * kiểu suy ra từ nó: `z.infer` của một hàm generic không nói được gì khi chưa
 * biết `TItem`.
 */
export function CursorPageSchema<TItem extends z.ZodTypeAny>(item: TItem) {
  return z
    .object({
      items: z.array(item),
      nextCursor: z.string().min(1).optional(),
    })
    .strict();
}

/**
 * Cùng một trang, nhưng chưa nhìn vào từng mục.
 *
 * Gateway giải phong bì trước, rồi đưa `items` qua `safeParseList` (`./decode.ts`)
 * — nên một mục hỏng bị bỏ qua kèm cảnh báo thay vì làm rỗng cả màn. Đó là lý
 * do `items` ở đây là `z.unknown()` chứ không phải schema của mục: nếu phong bì
 * đã kiểm luôn từng mục thì `safeParseList` không còn gì để cứu.
 */
export const CursorEnvelopeSchema = z
  .object({
    items: z.array(z.unknown()),
    nextCursor: z.string().min(1).optional(),
  })
  .strict();

export type CursorEnvelope = z.infer<typeof CursorEnvelopeSchema>;

/**
 * Thân của một lượt **ghi có version**: `{baseVersion, body}`.
 *
 * `baseVersion` là `revision` mà người gửi đã nhìn thấy. Máy chủ so nó với
 * `revision` hiện tại và từ chối lượt ghi đã cũ bằng 409 `VERSION_CONFLICT`
 * (`errors.ts`), thay vì lặng lẽ đè lên việc người khác vừa làm.
 *
 * Thiếu hẳn `baseVersion` thì máy chủ trả **428 `PRECONDITION_REQUIRED`**, kiểm
 * trước cả Pydantic — không phải 422. Một lượt ghi không nói nó dựa trên đâu là
 * một lượt ghi không kiểm được, và đó là lỗi giao thức chứ không phải lỗi dữ liệu.
 */
export function VersionedWriteSchema<TBody extends z.ZodTypeAny>(body: TBody) {
  return z
    .object({
      baseVersion: z.number().int().nonnegative(),
      body,
    })
    .strict();
}
