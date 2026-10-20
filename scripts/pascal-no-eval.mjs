/**
 * Bật `jitless` của zod 4 ngay trong gói Pascal, trước khi schema nào được dựng.
 *
 * zod 4 dò `new Function("")` để chọn đường JIT. Lỗi bị nuốt trong `try`, nhưng
 * trình duyệt vẫn bắn vi phạm CSP `script-src eval` (nginx không có
 * `'unsafe-eval'`) — bài C4 của `e2e/pascal-fixtures.spec.ts` đỏ vì đúng chỗ ấy.
 * Mount nhúng cũ bật cờ từ trang chủ trước khi thêm thẻ script
 * (`usePascalViewer.ts`, B-V10-05); trang `editor3d.html` thì không có ai làm
 * thay, mà script inline lại bị CSP chặn — nên cờ phải nằm trong chính gói.
 *
 * Chèn vào `zod/v4/core/core.js`, ngay trước dòng zod giữ tham chiếu tới
 * `globalThis.__zod_globalConfig`: `$ZodObjectJIT` đọc `jitless` LÚC DỰNG schema
 * (tầng module của `@pascal-app/core`), bật muộn hơn là vô ích.
 */
export const ZOD_CORE_ID = /[\\/]zod[\\/]v4[\\/]core[\\/]core\.js$/;
const ANCHOR = 'export const globalConfig = globalThis.__zod_globalConfig;';

export function pascalNoEval() {
  let patched = false;
  return {
    name: 'pascal-no-eval',
    transform(code, id) {
      if (!ZOD_CORE_ID.test(id.split('?')[0])) return null;
      if (!code.includes(ANCHOR)) throw new Error(`pascal-no-eval: ${id} không còn dòng "${ANCHOR}" — zod đã đổi, cập nhật scripts/pascal-no-eval.mjs`);
      patched = true;
      return { code: code.replace(ANCHOR, `(globalThis.__zod_globalConfig ??= {}).jitless = true;\n${ANCHOR}`), map: null };
    },
    buildEnd(error) {
      if (error) return;
      if (!patched) throw new Error('pascal-no-eval: không gặp zod/v4/core/core.js — gói Pascal không còn dùng zod 4? cập nhật scripts/pascal-no-eval.mjs');
    },
  };
}
