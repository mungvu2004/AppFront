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
  // Sàn gỗ sáng như cảnh Blender (`F:/runs/login-tour/pbr.py` herring): `wood` cam quá khi phủ cả sàn.
  floorOak: '#b3916f',
  // Mặt cắt tường (chế độ "Tường: cắt", xem thử nướng) và trình bày studio (`src/pascal-page/realism/studio.ts`).
  cutFace: '#141416',
  // Nắp cắt tường ở chế độ "Tường: cắt" (bench-3d: thay dải gần đen quanh tường bao).
  cutCap: '#ddd9d3',
  studioGround: '#d6d7d8',
  // Màu đất Nắng chiều mong muốn TRÊN ẢNH; giá trị ghi vào shader là `STUDIO_GROUND_SUNSET_LINEAR`.
  studioGroundSunset: '#f6e8d4',
  studioShadow: '#2e3134',
  studioPlinth: '#e6e3de',
  // Màu đèn mặc định trong catalog Pascal (`catalog-items.tsx`), chép nguyên để đối chiếu.
  catalogLight: '#ffffff',
  // Viền đồ chưa xác nhận (C6, `sceneDressing.ts`): cam nhạt.
  unconfirmed: '#f59e0b',
} as const;

/**
 * Màu chủ đạo của app cho trình dựng: tay cầm, viền chọn, nét dựng của Pascal (thay tím, `scripts/realism/u48-accent-no-purple.mjs`
 * đọc thẳng các dòng này) và chữ nhãn phòng 2D (`u49-room-label.mjs`). Chép từ `globals.css`: `--accent*` của chủ đề sáng và tối,
 * `--text-primary` sáng. `scripts/__tests__/u48-accent-no-purple.test.mjs` giữ các giá trị này có mặt trong `pascal-theme.css`.
 */
export const EDITOR_ACCENT_PALETTE = {
  editorAccent: '#4d6e87',
  editorAccentHover: '#436078',
  editorAccentOnDark: '#7fa6c4',
  editorAccentOnDarkActive: '#a7c4d9',
  editorAccentWash: '#edf2f6',
  roomLabelInk: '#33322f',
} as const;

/**
 * Đất Nắng chiều trước chỉnh màu + ACES (tuyến tính, phơi sáng 1): ACES nén sáng và làm nhạt màu nên ghi thẳng
 * `studioGroundSunset` ra ảnh `#e6e2da`. Giải ngược ra giá trị này; đỏ > 1 nên không viết được bằng mã hex.
 */
export const STUDIO_GROUND_SUNSET_LINEAR = [1.95, 1.094, 0.609] as const;

/**
 * Màu của dáng render ấm (`src/pascal-page/renderLook.ts`) — đè chủ đề `night` của Pascal.
 * Phông xám trung tính sáng như ảnh chụp sản phẩm (FE3D-FIX-004 thẻ R; trước là nâu tối
 * #36332f/#2a2825/#3d3a36): tường sáng vẫn nổi rõ trên nền, mặt đất tối hơn phông một bậc để
 * nhà "đứng" trên đế. Đèn chính ấm, mặt dưới bán cầu nâu gỗ (ánh dội sàn).
 * `clay*` là màu đất sét khi tô `solid`.
 */
export const RENDER_LOOK_PALETTE = {
  // Trời = gradient trung tính sáng (trước #8d8c89/#a3a29f qua chỉnh màu ra nâu đục, nhà như
  // đặt trong hộp tối). `background` (dưới chân trời) giữ tối hơn tường sáng (test renderLook).
  // Đất + phông dưới chân trời hơi lạnh, sáng hơn (trước #979899/#74726e): đèn chính/ambient ấm
  // + tương phản hậu kỳ biến xám trung tính thành nâu bùn khi nhìn từ trên. Vẫn tối hơn tường.
  background: '#aaaeb1',
  sky: '#d8dadb',
  // Dáng A: đất sáng + hơi lạnh hơn (#9a9ea1 dưới đèn ấm ra nâu đục 113,103,87 trên ảnh).
  ground: '#a6a9ae',
  ambient: '#fff1e0',
  hemiSky: '#fff6ea',
  hemiGround: '#6b5640',
  key: '#ffe9cf',
  fill: '#ffd9a3',
  clayWall: '#e8e0d2',
  clayFloor: '#c9b79c',
  clayCeiling: '#f2ece2',
  clayRoof: '#8a6f55',
  clayGlazing: '#c9d4d8',
} as const;

// Màu phẳng của 5 phong cách cảnh (`sceneStyles.ts`): sơn tường, tủ bếp, sứ, chậu cây, ánh đèn.
// Tường ngoài xám của ấm áp/tối giản sẫm hơn (than xám) để khối nhà kiểu dollhouse đọc rõ.
export const STYLE_PALETTE = {
  // Dáng A (docs/blender-vs-editor/BAO-CAO.md §2): trắng ngà #f5f3ef chiếm ~65 % khung, ảnh nhạt và phẳng;
  // be ấm sáng giữ phòng sáng mà vẫn có bậc tông với sàn và đồ.
  amApWall: '#ebe2d4',
  amApExterior: '#5f5d5a',
  amApCabinet: '#ebe7e0',
  hienDaiWall: '#f7f8f8',
  hienDaiExterior: '#b9bcbf',
  hienDaiCabinet: '#eef0f1',
  goAmWall: '#eadfcf',
  goAmExterior: '#7d6650',
  goAmCabinet: '#8a5a36',
  toiGianWall: '#d9d9d7',
  toiGianExterior: '#626362',
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

// Realism (`src/pascal-page/realism`): nền trơn, cỏ, màu trung bình đất xa, vật liệu theo khe.
export const REALISM_PALETTE = {
  plainGround: '#d6d9db',
  grassGreen: '#7da35a',
  gravelAverage: '#aaa79b',
  grassAverage: '#978359',
  mirror: '#dfe4e6',
  screen: '#0b0c0e',
  steel: '#cfd2d4',
  porcelain: '#f3f3f0',
} as const;

// Vải bọc đồ (sofa/ghế/giường) theo phong cách — `realism/upholstery.ts` nhuộm vật liệu vải lớn nhất
// của mỗi món về màu này để cả phòng đọc thành một bộ (Blender `apt3.py` main_skin). `*Bedding`: chăn ga.
export const UPHOLSTERY_PALETTE = {
  amAp: '#c9bba6',
  amApBedding: '#efeae2',
  hienDai: '#b8bcbf',
  hienDaiBedding: '#f2f3f3',
  goAm: '#8a5a3c',
  goAmBedding: '#e9dfd0',
  toiGian: '#cfcac2',
  toiGianBedding: '#ebe9e5',
  sangTrong: '#2f2d2c',
  sangTrongBedding: '#d8d3cc',
} as const;
