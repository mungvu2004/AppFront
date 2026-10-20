/**
 * Plugin vite chỉnh chất lượng dựng hình của Pascal LÚC DỰNG (FE3D-FIX-002 U06).
 *
 * Không sửa vendor (quyết định A), cùng cách `pascal-vi.mjs`: thay chuỗi trên mã nguồn
 * trước mọi plugin khác. Các luật (nghiên cứu ở `qa-results/fe3d-fix/v2/Q2.md`):
 * 1. cờ góc khu đất chỉ hiện ở pha site, không hiện ở chế độ chọn;
 * 2. Preview có `<SceneEnvironment />` (IBL) như khung sửa;
 * 3. bóng đổ 2048 thay 1024, `normalBias` 0.04 (texel nhỏ hơn nên bias nhỏ hơn);
 * 4. ánh sáng môi trường nền tối 0.2 → 0.4;
 * 5. khu đất không vẽ đường ranh vàng (nền + bóng đổ vẫn vẽ) — cái đế dưới nhà như trang đăng nhập.
 *
 * Báo đỏ thay vì im lặng: chuỗi gốc không còn hoặc xuất hiện hơn một lần trong tệp, hay
 * tệp trong bảng không được dựng tới → ném lỗi, lượt dựng hỏng.
 */

/** Đường dẫn tương đối từ `vendor/pascal/packages` → các cặp `[gốc, mới]`, mỗi gốc đúng một lần. */
export const RENDER_RULES = {
  'editor/src/lib/site-boundary.ts': [
    ["return args.phase === 'site' || args.mode === 'select'", "return args.phase === 'site'"],
  ],
  'editor/src/components/editor/index.tsx': [
    [
      '      selectionManager="default"\n    >\n      <ExportManager />',
      '      selectionManager="default"\n    >\n      <SceneEnvironment />\n      <ExportManager />',
    ],
  ],
  'viewer/src/components/viewer/lights.tsx': [
    ['shadow-mapSize={[1024, 1024]}', 'shadow-mapSize={[2048, 2048]}'],
    ['const SHADOW_NORMAL_BIAS = 0.08', 'const SHADOW_NORMAL_BIAS = 0.04'],
  ],
  'nodes/src/site/renderer.tsx': [
    ['{showSiteSurfaces && !ribbons && (', '{false && showSiteSurfaces && !ribbons && ('],
  ],
  'viewer/src/components/viewer/scene-environment.tsx': [
    ['const ENV_INTENSITY_DARK = 0.2', 'const ENV_INTENSITY_DARK = 0.4'],
  ],
};

const fileOf = (id) => {
  const norm = id.split('?')[0].replaceAll('\\', '/');
  return Object.keys(RENDER_RULES).find((f) => norm.endsWith(`/packages/${f}`));
};

/** Áp luật cho một module; tệp ngoài bảng → `null`. */
export function transformRender(code, id) {
  const file = fileOf(id);
  if (!file) return null;
  const crlf = code.includes('\r\n');
  let out = code;
  for (const [rawFrom, rawTo] of RENDER_RULES[file]) {
    const from = crlf ? rawFrom.replaceAll('\n', '\r\n') : rawFrom;
    const to = crlf ? rawTo.replaceAll('\n', '\r\n') : rawTo;
    const count = out.split(from).length - 1;
    if (count !== 1) {
      throw new Error(`pascal-render: chuỗi gốc ${JSON.stringify(rawFrom)} gặp ${count} lần (cần đúng 1) trong ${file} — upstream đã đổi, cập nhật scripts/pascal-render.mjs`);
    }
    out = out.replace(from, () => to);
  }
  return out;
}

export function pascalRender() {
  const seen = new Set();
  return {
    name: 'pascal-render',
    enforce: 'pre',
    transform(code, id) {
      const out = transformRender(code, id);
      if (out === null) return null;
      seen.add(fileOf(id));
      return { code: out, map: null };
    },
    buildEnd(error) {
      if (error) return;
      const missing = Object.keys(RENDER_RULES).filter((f) => !seen.has(f));
      if (missing.length) throw new Error(`pascal-render: tệp trong bảng không được dựng tới: ${missing.join(', ')}`);
    },
  };
}
