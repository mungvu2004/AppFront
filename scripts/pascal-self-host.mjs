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
  /*
   * Phông nhúng của xuất PDF, vendor `editor/src/lib/floorplan/floorplan-pdfkit-document.ts`. Chế độ `lib`
   * của Vite nhúng `new URL('./x.ttf', import.meta.url)` thành `data:font/ttf;base64,…` (~770 KB trong
   * `ids-*.js`), rồi `fetch(data:)` bị `connect-src 'self'` chặn → PDF rơi về phông chuẩn WinAnsi, hỏng
   * chữ có dấu (BUNDLE-GATE, e2e `pascal-viewer.spec.ts`). Trỏ về tệp tự host `/pascal/pdf-fonts/`
   * (`copy-pascal-assets.mjs`); gốc `self.location.href` để Vite không nhận ra mẫu tài sản mà nhúng lại.
   */
  ...['LiberationSans-Regular', 'LiberationSans-Bold', 'GeistMono-Regular', 'GeistMono-Bold'].map((name) => [
    `new URL('./pdf-fonts/${name}.ttf', import.meta.url)`,
    `new URL('/pascal/pdf-fonts/${name}.ttf', self.location.href)`,
  ]),
];

/**
 * Luật cho lượt dựng worker (`worker.plugins` của `vite.pascal.config.ts` — plugin chính
 * không chạy trên worker). Vendor `editor/src/lib/print-shell-compiler-manifold-core.ts`
 * thử `manifold-3d` rồi rơi về jsDelivr; `manifold-3d` không phải phụ thuộc trực tiếp nên
 * không tự host được, ta đổi đường dự phòng thành đường trên chính máy: nạp hỏng như khi
 * offline, không bao giờ gọi CDN.
 * ponytail: xuất vỏ in 3D không chạy trên trình duyệt; cần thì thêm manifold-3d vào deps và chép `manifold.{js,wasm}` vào `public/manifold-3d@<bản>/`.
 */
export const WORKER_SELF_HOST_RULES = [['https://cdn.jsdelivr.net/npm/manifold-3d@', '/manifold-3d@']];

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
