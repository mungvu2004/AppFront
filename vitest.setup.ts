/**
 * Cửa vào chuẩn bị test — chia theo môi trường.
 *
 * Toàn bộ phần chuẩn bị của dự án chỉ có nghĩa khi có DOM: bộ so khớp của
 * `jest-dom`, `@testing-library/react` (qua `configureTestProviders`), và bản vá
 * `window.scrollTo`. Nạp chúng cho một bài kiểm hàm thuần là trả tiền cho thứ
 * không dùng — và hoá đơn không nhỏ.
 *
 * Số đo trên `src/domain` (1.148 bài, 36 file) khi mọi file đều chạy jsdom:
 *
 *     tests 2,09 s  ·  environment 34,15 s  ·  setup 26,20 s
 *
 * Hai phần ba phút để chạy hai giây phép kiểm. `vitest.config.ts` nay cho
 * `src/domain/**` chạy môi trường `node`, và nhánh dưới đây giữ cho file chuẩn
 * bị DOM không bị nạp ở đó — `import()` động chứ không phải `import` tĩnh, vì
 * một `import` tĩnh vẫn chạy dù nhánh không vào.
 *
 * Đây là lý do file `vitest.setup.dom.ts` tồn tại tách riêng, chứ không phải vì
 * nó có gì khác biệt.
 */

if (typeof window !== 'undefined') {
  await import('./vitest.setup.dom');
}
