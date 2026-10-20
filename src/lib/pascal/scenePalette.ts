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

/**
 * Màu của dáng render ấm (`src/pascal-page/renderLook.ts`) — đè chủ đề `night` của Pascal cho
 * gần nhà 3D ở trang đăng nhập (nền #2b2a28). `clay*` là màu đất sét khi tô `solid`.
 */
export const RENDER_LOOK_PALETTE = {
  background: '#36332f',
  sky: '#2a2825',
  ground: '#3d3a36',
  ambient: '#fff1e0',
  hemiSky: '#fff6ea',
  hemiGround: '#2b2a28',
  key: '#fff4e6',
  fill: '#ffd9a3',
  clayWall: '#e8e0d2',
  clayFloor: '#c9b79c',
  clayCeiling: '#f2ece2',
  clayRoof: '#8a6f55',
  clayGlazing: '#c9d4d8',
} as const;

// Màu phẳng của 5 phong cách cảnh (`sceneStyles.ts`): sơn tường, tủ bếp, sứ, chậu cây, ánh đèn.
export const STYLE_PALETTE = {
  amApWall: '#f5f3ef',
  amApExterior: '#8c8a86',
  amApCabinet: '#ebe7e0',
  hienDaiWall: '#f7f8f8',
  hienDaiExterior: '#b9bcbf',
  hienDaiCabinet: '#eef0f1',
  goAmWall: '#eadfcf',
  goAmExterior: '#7d6650',
  goAmCabinet: '#8a5a36',
  toiGianWall: '#d9d9d7',
  toiGianExterior: '#7f807f',
  toiGianCabinet: '#c4c5c3',
  sangTrongWall: '#7d756c',
  sangTrongExterior: '#3a3735',
  sangTrongCabinet: '#26282b',
  ceramicWhite: '#f3f3f1',
  ceramicIvory: '#ece4d6',
  potTerracotta: '#b0643f',
  potConcrete: '#9a9893',
  potBlack: '#2b2b2b',
  lampWarm: '#ffd9a3',
  lampNeutral: '#fff1de',
  lampAmber: '#ffc98a',
} as const;
