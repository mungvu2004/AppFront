/**
 * Thẻ R6 (GĐ6): bật sẵn fascia + máng xối tự động cho mái MỚI, phào chân ngoài
 * cho tường MỚI. Chỉ vá chỗ CÔNG CỤ VẼ dựng node; nạp dự án cũ không đi qua đây
 * và schema `core` không đổi, nên node đã lưu giữ nguyên từng byte.
 * Giá trị nằm ở src/pascal-page/realism/details.ts (alias @pascal-realism).
 * Trải realism TRƯỚC `...defaults` để preset công cụ của người dùng thắng.
 * Bỏ qua có chủ ý: nhánh mái nón (conical, không có gutter/fascia), bóng xem trước
 * (roof/tool.tsx ~1062), nhân bản node cũ (floating-action-menu), lean-to.
 */
const ROOF_IMPORT = "import { realismRoofSegmentDefaults } from '@pascal-realism/details'\n"
const WALL_IMPORT = "import { realismWallDefaults } from '@pascal-realism/details'\n"

// Vendor checkout có thể là CRLF: mọi neo chỉ dùng "\n" ở ĐẦU (ngay trước thụt lề),
// không neo qua hết dòng. `import` ESM đặt giữa tệp vẫn hợp lệ (được hoist).
export const RULES = {
  'nodes/src/roof/tool.tsx': [
    ['\nconst DEFAULT_WALL_HEIGHT = 0.5', '\n' + ROOF_IMPORT + 'const DEFAULT_WALL_HEIGHT = 0.5', 1],
    // Thêm phân đoạn vào mái có sẵn (phân đoạn mới, thụt 6).
    [
      '\n      wallHeight: DEFAULT_WALL_HEIGHT,',
      '\n      ...realismRoofSegmentDefaults(),\n      wallHeight: DEFAULT_WALL_HEIGHT,',
      1,
    ],
    // Mái mới vẽ khung chữ nhật + mái mới dựng trên tường chọn (thụt 2; mái nón,
    // phân đoạn thêm và bóng xem trước thụt 4 nên không khớp).
    [
      '\n  const segment = RoofSegmentNode.parse({',
      '\n  const segment = RoofSegmentNode.parse({\n    ...realismRoofSegmentDefaults(),',
      2,
    ],
  ],
  'editor/src/components/tools/wall/wall-drafting.ts': [
    ['\nexport function getSegmentGridStep(): number {', '\n' + WALL_IMPORT + 'export function getSegmentGridStep(): number {', 1],
    [
      'wallDefaults: useEditor.getState().toolDefaults.wall ?? {},',
      'wallDefaults: { ...realismWallDefaults(), ...(useEditor.getState().toolDefaults.wall ?? {}) },',
      1,
    ],
  ],
  'nodes/src/wall/rectangle-command.ts': [
    ['\nexport function createWallRectangle(', '\n' + WALL_IMPORT + 'export function createWallRectangle(', 1],
    ['wallDefaults: defaults })', 'wallDefaults: { ...realismWallDefaults(), ...defaults } })', 1],
  ],
};
