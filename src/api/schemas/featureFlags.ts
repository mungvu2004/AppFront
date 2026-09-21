import { z } from 'zod';

/**
 * #9 — bảng cờ tính năng.
 *
 * ## Schema này cố ý KHÔNG có nơi gọi lúc chạy
 *
 * `lib/telemetry/flags.ts:60-72` đọc bảng cờ mà **không** giải mã nó, và đó là
 * một quyết định đã ghi: mô-đun ấy nằm trên đường khởi động ứng dụng, còn
 * `zod` là 65 kB. Một file có việc là giữ cho thứ nặng khỏi lên trang đầu thì
 * không được là lý do một bộ phân tích cú pháp lên trang đầu.
 *
 * Nên schema này phục vụ hai chỗ khác: **H1** — runner đối chiếu golden của
 * backend chạy đúng schema zod này trên phản hồi thật — và **test**. Ở cả hai
 * chỗ, cái giá của `zod` bằng không.
 *
 * ## Năm khoá có dấu chấm, và mọi khoá đều tuỳ chọn
 *
 * Tên cờ là mã an toàn trên dây (`scene.instanced-walls`), không phải định danh
 * JavaScript — nên chúng là chuỗi có dấu nháy. Dấu chấm nhóm cờ theo vùng nó
 * tác động, và `flags.ts:74` giữ danh sách nguồn.
 *
 * Tuỳ chọn vì máy chủ chỉ gửi cờ nó có ý kiến. Vắng khoá nghĩa là "theo mặc
 * định của client", khác hẳn `false` nghĩa là "tắt". `.strict()` chặn một cờ
 * mới mà client chưa biết — nếu không, một cái tên gõ sai sẽ lặng lẽ thành
 * "chưa bật" và không ai tìm ra.
 */
export const FeatureFlagsSchema = z
  .object({
    'export.pdf-vector': z.boolean().optional(),
    'qc.live-collaboration': z.boolean().optional(),
    'rules.parallel-run': z.boolean().optional(),
    'scene.instanced-walls': z.boolean().optional(),
    'scene.soft-shadows': z.boolean().optional(),
  })
  .strict()
  .transform((wireFlags) => ({
    ...(wireFlags['export.pdf-vector'] !== undefined
      ? { 'export.pdf-vector': wireFlags['export.pdf-vector'] }
      : {}),
    ...(wireFlags['qc.live-collaboration'] !== undefined
      ? { 'qc.live-collaboration': wireFlags['qc.live-collaboration'] }
      : {}),
    ...(wireFlags['rules.parallel-run'] !== undefined
      ? { 'rules.parallel-run': wireFlags['rules.parallel-run'] }
      : {}),
    ...(wireFlags['scene.instanced-walls'] !== undefined
      ? { 'scene.instanced-walls': wireFlags['scene.instanced-walls'] }
      : {}),
    ...(wireFlags['scene.soft-shadows'] !== undefined
      ? { 'scene.soft-shadows': wireFlags['scene.soft-shadows'] }
      : {}),
  }));

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
