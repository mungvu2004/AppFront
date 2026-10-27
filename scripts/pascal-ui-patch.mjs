/**
 * Vá lớp giao diện cứng của vendor Pascal LÚC DỰNG (thẻ T5 pascal-polish).
 *
 * Chỉ những chỗ CSS không đè gọn được: vendor gắn `.dark` lên khung nên biến thể
 * `dark:` luôn bật (nền tối ở chế độ sáng), hoặc lớp xuất hiện ở nhiều nơi.
 * Lớp thay vào PHẢI đã có sẵn trong style.css (Tailwind chỉ quét nguồn vendor,
 * không quét kết quả vá): bg-background, bg-card, bg-muted, border-border, hover:bg-accent.
 * Neo mất hoặc sai số lần → ném lỗi, lượt dựng hỏng (như scripts/pascal-vi.mjs).
 *
 * Bỏ qua có chủ ý (CSS đè được, không cần vá): hover:bg-white/*, bg-[#2C2C2E], bg-[#3e3e3e],
 * bg-black/5, bg-neutral-950/85 (overlay chụp ảnh, cố ý tối), viewer-stage.tsx bg-neutral-100.
 */
import path from 'node:path';

/** file → [[trước, sau, số lần xuất hiện]] */
export const UI_PATCHES = {
  // Nền khung sau canvas + khe giữa các panel: neutral-100 sáng chói ở chế độ tối.
  'editor/src/components/editor/index.tsx': [
    ['"dark relative h-full w-full overflow-hidden bg-neutral-100 text-foreground"', '"dark relative h-full w-full overflow-hidden bg-background text-foreground"', 1],
    ['"dark flex h-full w-full gap-3 bg-neutral-100 p-3 text-foreground"', '"dark flex h-full w-full gap-3 bg-background p-3 text-foreground"', 1],
  ],
  // La bàn: dark:* luôn bật nên ở chế độ sáng vẫn nền tối; chuyển sang token.
  'editor/src/components/viewer/floorplan-compass-button.tsx': [
    [
      'border border-black/10 bg-white/85 shadow-sm backdrop-blur-md transition hover:bg-white hover:shadow-md dark:border-white/10 dark:bg-neutral-900/85 dark:hover:bg-neutral-900"',
      'border border-border bg-card shadow-sm transition hover:bg-accent hover:shadow-md"',
      1,
    ],
    ['bg-[#b8b8b8] shadow-inner dark:bg-neutral-700"', 'bg-muted shadow-inner"', 1],
  ],
  // Nhãn trình đọc màn hình cho nút chỉ-biểu-tượng (chỉ thêm thuộc tính). Nhãn Mở/Thu gọn đã do pascal-vi dịch.
  'editor/src/components/ui/panels/panel-wrapper.tsx': [
    ['onClick={onBack}', 'aria-label="Quay lại" title="Quay lại" onClick={onBack}', 1],
    ['onClick={onReset}', 'aria-label="Đặt lại" title="Đặt lại" onClick={onReset}', 1],
    ['onClick={onClose}', 'aria-label="Đóng bảng" title="Đóng bảng" onClick={onClose}', 1],
  ],
  // UX-R1 K48: nút thanh dưới chỉ có hình + chữ phím, tên đọc ra là "V"/"Z"/"X". Đặt tên = nhãn (phím),
  // như tooltip; nút tự truyền aria-label (Đo) vẫn thắng vì `{...props}` đứng sau.
  'editor/src/components/ui/action-menu/action-button.tsx': [
    ['ref={ref}\n            {...props}', 'aria-label={shortcut ? `${label} (${shortcut})` : label}\n            ref={ref}\n            {...props}', 1],
  ],
  'editor/src/components/ui/floating-level-selector.tsx': [
    [
      'className="flex h-5 w-4 shrink-0 items-center justify-center text-muted-foreground/40 opacity-0 transition-all hover:text-foreground group-hover/level:opacity-100"',
      'aria-label="Tùy chọn tầng" className="flex h-5 w-4 shrink-0 items-center justify-center text-muted-foreground/40 opacity-0 transition-all hover:text-foreground group-hover/level:opacity-100"',
      1,
    ],
    // UX-R1 K39/K46 (Codex P2): nút "+" chèn tầng nằm giữa ô (left-1/2), đè lên tên tầng. Có từ hai tầng
    // thì danh sách mở cột riêng bên trái (`data-level-gutter`); nút chèn (`data-level-insert`) đứng
    // trong cột đó — pascal-chrome.css xếp chỗ, chỉ hiện khi rê chuột/focus. Một tầng: không cột, vendor
    // cũng không vẽ nút chèn. Chỉ thêm thuộc tính: lớp Tailwind mới không có trong style.css.
    [
      'className="flex flex-col gap-0.5 rounded-xl border border-border bg-background/90 p-1 shadow-2xl backdrop-blur-md"',
      "data-level-gutter={reversedLevels.length > 1 ? '' : undefined} className=\"flex flex-col gap-0.5 rounded-xl border border-border bg-background/90 p-1 shadow-2xl backdrop-blur-md\"",
      1,
    ],
    ['onClick={() => handleInsertBetween(sortedIndex - 1)}', 'data-level-insert="" onClick={() => handleInsertBetween(sortedIndex - 1)}', 1],
  ],
};

export function applyUiPatches(code, file, pairs) {
  let out = code;
  for (const [from, to, times] of pairs) {
    const n = out.split(from).length - 1;
    if (n !== times) {
      throw new Error(`pascal-ui-patch: chuỗi ${JSON.stringify(from)} trong ${file} xuất hiện ${n} lần, cần ${times} — upstream đã đổi, cập nhật scripts/pascal-ui-patch.mjs`);
    }
    out = out.split(from).join(to);
  }
  return out;
}

export function pascalUiPatch({ packagesDir, patches = UI_PATCHES } = {}) {
  const root = path.resolve(packagesDir);
  const seen = new Set();
  return {
    name: 'pascal-ui-patch',
    enforce: 'pre',
    transform(code, id) {
      const file = path.relative(root, id.split('?')[0]).split(path.sep).join('/');
      const pairs = patches[file];
      if (!pairs) return null;
      seen.add(file);
      return { code: applyUiPatches(code, file, pairs), map: null };
    },
    buildEnd(error) {
      if (error) return;
      const missing = Object.keys(patches).filter((f) => !seen.has(f));
      if (missing.length) throw new Error(`pascal-ui-patch: tệp không được dựng tới: ${missing.join(', ')}`);
    },
  };
}
