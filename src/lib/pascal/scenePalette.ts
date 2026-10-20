/**
 * Bảng màu của cảnh Pascal — chỗ DUY NHẤT trong `src/` (ngoài test màu) được viết mã màu.
 *
 * Nhà 3D ở trang đăng nhập đọc màu từ token `--scene-*` của `globals.css` lúc chạy
 * (`lib/three/present/palette.ts`). Trang Pascal (`editor3d.html`) không nạp `globals.css`,
 * và màu ở đây là DỮ LIỆU giao cho Pascal (`SceneMaterial.properties.color`, màu đèn
 * của item), nên phải là chuỗi màu thật. `noRawColor.test.ts` cho riêng tệp này qua;
 * `scenePalette.test.ts` giữ các màu có token bằng đúng giá trị trong `globals.css`.
 */

/** Màu nào khớp token nào của trang đăng nhập — `scenePalette.test.ts` đối chiếu. */
export const SCENE_PALETTE_TOKENS = {
  wood: '--scene-wood',
  tile: '--scene-tile',
  mosaic: '--scene-mosaic',
  decking: '--scene-decking',
  plaster: '--white',
  exterior: '--scene-exterior',
  lamp: '--scene-lamp',
} as const;

export const SCENE_PALETTE = {
  wood: '#b9874d',
  tile: '#e9e5dd',
  mosaic: '#6f7377',
  decking: '#6a4a2d',
  plaster: '#ffffff',
  exterior: '#8c8a86',
  lamp: '#ffd9a3',
  // Màu trung bình ảnh vân của ba loại gỗ Pascal (`core/src/procedural-items/library-colors.ts`).
  oak: '#a77440',
  walnut: '#663020',
  bark: '#88654c',
  // Màu đèn mặc định trong catalog Pascal (`catalog-items.tsx`), chép nguyên để đối chiếu.
  catalogLight: '#ffffff',
} as const;
