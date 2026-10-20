/**
 * Plugin vite tự host bộ giải nén Draco và Basis LÚC DỰNG (FE3D-FIX-001 T01).
 *
 * Pascal và drei trỏ cứng tới CDN (gstatic, jsdelivr); trang 3D chạy dưới CSP chỉ cho
 * phép chính máy, nên mô hình nén không tải được. Không sửa vendor (quyết định A — giữ
 * `vendor/pascal/**` nguyên byte), ta thay chuỗi trên mã nguồn trước mọi plugin khác
 * sang `/draco/`, `/basis/` (`scripts/copy-draco.mjs`, `copy-pascal-assets.mjs` chép sẵn).
 *
 * Báo đỏ thay vì im lặng: một luật không khớp module nào trong cả lượt dựng (upstream
 * đổi chữ hoặc đổi phiên bản) → ném lỗi ở `buildEnd`, lượt dựng hỏng.
 */
export const SELF_HOST_RULES = [
  // vendor `nodes/src/item/renderer.tsx` và drei `core/Gltf.js`.
  ['https://www.gstatic.com/draco/versioned/decoders/1.5.5/', '/draco/'],
  // vendor `viewer/src/lib/ktx2-loader.ts`.
  ['https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/basis/', '/basis/'],
];

export function pascalSelfHost({ rules = SELF_HOST_RULES } = {}) {
  const seen = new Set();
  return {
    name: 'pascal-self-host',
    enforce: 'pre',
    transform(code) {
      let out = code;
      for (const [from, to] of rules) {
        if (!out.includes(from)) continue;
        seen.add(from);
        out = out.split(from).join(to);
      }
      return out === code ? null : { code: out, map: null };
    },
    buildEnd(error) {
      if (error) return;
      const missing = rules.filter(([from]) => !seen.has(from)).map(([from]) => from);
      if (missing.length) throw new Error(`pascal-self-host: luật không khớp module nào: ${missing.join(', ')} — upstream đã đổi chữ, cập nhật scripts/pascal-self-host.mjs`);
    },
  };
}
