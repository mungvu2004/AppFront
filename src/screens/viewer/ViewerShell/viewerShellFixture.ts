/**
 * Bộ mẫu của vỏ 3D: **4 tầng · 14 phòng · 248,60 m²** — đúng toà nhà mà thanh
 * trạng thái trong đặc tả VIEWER-SHELL in ra.
 *
 * File `.ts` thuần. Cùng khuôn `thicknessFixture.ts` của S-18 và
 * `objectLayerFixture.ts` của lớp đối tượng: dữ liệu ĐỒ THỊ thật
 * (`Level[]`, `Room[]`, `Wall[]` của `src/domain/spatial/types`), không phải
 * viewmodel đã tính sẵn. Story, bài kiểm và cổng giả cắm chung bộ này, nên
 * không có bảng số thứ hai để trôi khỏi bảng số thứ nhất (R-70).
 *
 * ## Vì sao 248,60 m², và quan hệ với A14
 *
 * A14 chốt bộ mẫu chuẩn của repo là "34 phòng và sảnh 248,60 m²" — con số diện
 * tích ấy là thứ mọi bài kiểm diện tích trong repo đối chiếu. Đặc tả vỏ 3D lại
 * in "4 tầng · 14 phòng · 248,60 m²": cùng **diện tích**, khác số phòng, vì vỏ
 * đếm phòng của một toà bốn tầng chứ không phải của một mặt bằng. Bộ mẫu này
 * giữ nguyên con số A14 bảo vệ (248,60 m²) và chia nó cho 14 phòng trên 4 tầng.
 *
 * Diện tích ghi trong `Room.areaM2` là số đã chốt của bộ mẫu; `outline` của mỗi
 * phòng là hình chữ nhật dựng ra ĐÚNG diện tích đó, nên `selectRoomsWithArea`
 * — vốn tính lại diện tích từ `outline` qua `src/domain` — cho cùng kết quả
 * thay vì một con số thứ hai. {@link rectangleOutline} là chỗ duy nhất dựng
 * hình, và nó chỉ nhận bề rộng và bề sâu.
 *
 * ## Vì sao mỗi tầng chỉ có bốn bức tường bao
 *
 * Vỏ không soát tường — chín màn nội dung mới soát. Tường ở đây chỉ để cảnh có
 * hình khối, để `boundsOfIds` có gì mà khuôn, và để hộp bao không rỗng. Thêm
 * tường ngăn vào đây là dựng dữ liệu mà không màn nào của vỏ đọc.
 */

import { computeArea } from '@/domain/rooms/area';
import { ID_PREFIX_BY_KIND } from '@/domain/spatial/ids';
import type { PointMm } from '@/domain/units/compare';
import { millimetres, squareMetres } from '@/domain/units/types';
import type {
  Building,
  Level,
  LevelId,
  Point,
  Room,
  RoomId,
  RoomUsage,
  SpatialGraph,
  Wall,
  WallId,
} from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* Mã định danh — cố định, hợp lệ theo domain/spatial/ids.ts.                  */
/* -------------------------------------------------------------------------- */

/**
 * Đuôi cố định gắn sau mã số đọc được, để thân mã đạt tối thiểu mười ký tự mà
 * `domain/spatial/ids.ts:43` (`MIN_BODY_LENGTH`) đòi.
 *
 * `createId` của `ids.ts` KHÔNG dùng được ở đây: nó vừa mang một mẩu ngẫu
 * nhiên bốn ký tự, vừa cộng dồn vào một bộ đếm cấp module — hai thứ bộ mẫu
 * này không được phép có, vì ảnh chuẩn và bài kiểm đối chiếu mã phải lặp lại
 * y hệt giữa các lượt chạy. Nên mã ở đây là chuỗi gõ tay, nhưng vẫn giữ đúng
 * hình dạng `createId` sinh ra: tiền tố lấy từ `ID_PREFIX_BY_KIND` (không tự
 * bịa chữ cái), thân chỉ gồm `[0-9A-Z]`, dài hơn ngưỡng tối thiểu.
 *
 * Tám ký tự, tất cả nằm trong bảng chữ base36 mà `ids.ts` dùng, nên thân mã
 * ngắn nhất của bộ mẫu (mã tầng, hai chữ số) vẫn chạm đúng mười ký tự tối
 * thiểu: `"01" + "FIXTURE0"` = mười ký tự.
 */
const FIXTURE_ID_SUFFIX = 'FIXTURE0';

/**
 * Một mã hợp lệ cho một loại thực thể, từ mã số đọc được của bộ mẫu.
 *
 * `code` giữ nguyên các mã số đã có từ trước (`"01"`, `"001"`, `"0101"`…) làm
 * TIỀN TỐ của thân mã, nên mọi nơi soát bằng khớp chuỗi con (ô tìm phòng của
 * `Viewer3D/roomSearch.ts`) vẫn khớp đúng thứ đã khớp trước khi sửa.
 */
function fixtureId<K extends keyof typeof ID_PREFIX_BY_KIND>(kind: K, code: string): string {
  return `${ID_PREFIX_BY_KIND[kind]}-${code}${FIXTURE_ID_SUFFIX}`;
}

/** Mã phòng hợp lệ, từ số phòng đọc được (`"001"`…`"014"`). */
const roomId = (code: string): RoomId => fixtureId('room', code) as RoomId;

/** Mã tường hợp lệ, từ số tường đọc được (`"0101"`…`"0402"`). */
const wallId = (code: string): WallId => fixtureId('wall', code) as WallId;

/* -------------------------------------------------------------------------- */
/* Những con số đặc tả in ra.                                                  */
/* -------------------------------------------------------------------------- */

/** Số tầng của bộ mẫu. */
export const FIXTURE_STOREY_COUNT = 4;

/** Số phòng của bộ mẫu. */
export const FIXTURE_ROOM_COUNT = 14;

/** Tổng diện tích, mét vuông — con số A14 bảo vệ. */
export const FIXTURE_TOTAL_AREA_M2 = 248.6;

/** Chiều cao mỗi tầng, milimét. Bốn tầng đều nhau. */
export const FIXTURE_STOREY_HEIGHT_MM = 3_200;

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

/** Mọi thứ trong bộ mẫu là dữ liệu người đã duyệt, trừ chỗ nói khác. */
const REVIEWED = { confidence: 1, source: 'human', reviewed: true } as const;

/** Dữ liệu máy đoán, chưa ai duyệt — A5 cấm đặt `reviewed` cho đầu ra của AI. */
const FROM_MODEL = { confidence: 0.82, source: 'ai', reviewed: false } as const;

const point = (xMm: number, yMm: number): Point => ({
  x: millimetres(xMm),
  y: millimetres(yMm),
});

/**
 * Toạ độ bản vẽ, đổi sang điểm CÓ NHÃN ĐƠN VỊ mà `src/domain/rooms/area` nhận.
 *
 * `Point` của `spatial/types.ts` khai `Millimetres = number` không nhãn, còn
 * `PointMm` của `units/compare.ts` mang nhãn `mm`. Hai kiểu ấy tồn tại song song
 * trong repo và `src/store/selectors.ts` bắc cầu bằng đúng hàm này (`pointToMm`,
 * dòng 110). Chép lại cầu ấy thay vì nhập chéo, và KHÔNG ép kiểu bằng `as`:
 * `millimetres()` là hàm gắn nhãn chính thức của `src/domain/units`.
 */
export function toPointMm(corner: Point): PointMm {
  return { x: millimetres(corner.x), y: millimetres(corner.y) };
}

/**
 * Hình chữ nhật `widthMm × depthMm` đặt tại `originX`, `originY`.
 *
 * Bốn đỉnh, ngược chiều kim đồng hồ, KHÔNG lặp lại đỉnh đầu ở cuối — đúng giao
 * kèo `Room.outline` khai. Diện tích của nó là `width × depth`, nên người viết
 * bộ mẫu chọn hai cạnh và diện tích tự đúng, thay vì gõ một con số diện tích rồi
 * gõ một hình không khớp với nó.
 */
export function rectangleOutline(
  originXMm: number,
  originYMm: number,
  widthMm: number,
  depthMm: number,
): readonly Point[] {
  return [
    point(originXMm, originYMm),
    point(originXMm + widthMm, originYMm),
    point(originXMm + widthMm, originYMm + depthMm),
    point(originXMm, originYMm + depthMm),
  ];
}

/** Một tầng của bộ mẫu. Cao độ suy ra từ thứ tự, không gõ tay bốn lần. */
function level(order: number, name: string): Level {
  return {
    ...REVIEWED,
    id: fixtureId('level', String(order + 1).padStart(2, '0')) as LevelId,
    name,
    order,
    elevationMm: millimetres(order * FIXTURE_STOREY_HEIGHT_MM),
    heightMm: millimetres(FIXTURE_STOREY_HEIGHT_MM),
  };
}

/**
 * Một phòng, dựng từ hai cạnh.
 *
 * `areaM2` KHÔNG tính tay ở đây: nó đi qua `computeArea` của
 * `src/domain/rooms/area.ts` — cùng hàm mà `selectRoomsWithArea` gọi khi màn
 * đọc kho. Nên `outline` và `areaM2` không có đường nào nói hai chuyện khác
 * nhau, và bộ mẫu không chứa một phép quy đổi đơn vị thứ hai (R-61,
 * `local/no-raw-number`).
 */
function room(
  id: RoomId,
  levelId: LevelId,
  name: string,
  usage: RoomUsage,
  originXMm: number,
  originYMm: number,
  widthMm: number,
  depthMm: number,
  wallIds: readonly WallId[],
  metadata: typeof REVIEWED | typeof FROM_MODEL = REVIEWED,
): Room {
  const outline = rectangleOutline(originXMm, originYMm, widthMm, depthMm);

  return {
    ...metadata,
    id,
    levelId,
    name,
    usage,
    outline,
    areaM2: computeArea(outline.map(toPointMm)),
    wallIds,
  };
}

/** Bốn bức tường bao của một tầng, hình chữ nhật `widthMm × depthMm`. */
function envelopeWalls(level: Level, widthMm: number, depthMm: number): readonly Wall[] {
  const THICKNESS_MM = 220;
  const levelCode = String(level.order + 1).padStart(2, '0');
  const corners: readonly (readonly [number, number, number, number])[] = [
    [0, 0, widthMm, 0],
    [widthMm, 0, widthMm, depthMm],
    [widthMm, depthMm, 0, depthMm],
    [0, depthMm, 0, 0],
  ];

  return corners.map(([startX, startY, endX, endY], index) => ({
    ...REVIEWED,
    id: wallId(`${levelCode}${String(index + 1).padStart(2, '0')}`),
    levelId: level.id,
    centreline: { start: point(startX, startY), end: point(endX, endY) },
    thicknessMm: millimetres(THICKNESS_MM),
    heightMm: millimetres(FIXTURE_STOREY_HEIGHT_MM),
    kind: 'envelope' as const,
    openingIds: [],
  }));
}

/* -------------------------------------------------------------------------- */
/* Bốn tầng.                                                                   */
/* -------------------------------------------------------------------------- */

const groundLevel = level(0, 'Tầng trệt');
const firstLevel = level(1, 'Tầng 02');
const secondLevel = level(2, 'Tầng 03');
const roofLevel = level(3, 'Tầng mái');

export const VIEWER_FIXTURE_LEVELS: readonly Level[] = Object.freeze([
  groundLevel,
  firstLevel,
  secondLevel,
  roofLevel,
]);

export const GROUND: LevelId = groundLevel.id;
const FIRST: LevelId = firstLevel.id;
const SECOND: LevelId = secondLevel.id;
const ROOF: LevelId = roofLevel.id;

/* -------------------------------------------------------------------------- */
/* Mười bốn phòng, tổng 248,60 m².                                             */
/* -------------------------------------------------------------------------- */

/**
 * Bề rộng và bề sâu của từng phòng, chọn sao cho tổng đúng 248,60 m².
 *
 * Bốn tầng cộng lại: 80,00 + 70,00 + 60,00 + 38,60 = 248,60 m².
 * `viewerShellFixture.test` cộng lại và khẳng định con số ấy chứ không tin
 * dòng chú thích này.
 */
export const VIEWER_FIXTURE_ROOMS: readonly Room[] = Object.freeze([
  /* Tầng trệt — 5 phòng, 80,00 m². */
  room(roomId('001'), GROUND, 'Phòng khách', 'livingRoom', 0, 0, 5_400, 6_000, [wallId('0101')]),
  room(roomId('002'), GROUND, 'Bếp và ăn', 'kitchen', 5_400, 0, 3_750, 5_000, [wallId('0102')]),
  room(roomId('003'), GROUND, 'Phòng ngủ 1', 'bedroom', 0, 6_000, 3_600, 3_500, [wallId('0103')]),
  room(roomId('004'), GROUND, 'Phòng tắm', 'bathroom', 3_600, 6_000, 2_500, 3_940, [wallId('0104')]),
  room(roomId('005'), GROUND, 'Hành lang', 'corridor', 6_100, 6_000, 1_600, 4_000, [wallId('0104')]),

  /* Tầng 02 — 4 phòng, 70,00 m². */
  room(roomId('006'), FIRST, 'Phòng làm việc', 'other', 0, 0, 5_000, 5_700, [wallId('0201')]),
  room(roomId('007'), FIRST, 'Phòng ngủ 2', 'bedroom', 5_000, 0, 4_500, 3_600, [wallId('0202')]),
  room(roomId('008'), FIRST, 'Phòng ngủ 3', 'bedroom', 0, 5_700, 4_400, 3_250, [wallId('0203')]),
  room(roomId('009'), FIRST, 'Kho', 'utility', 4_400, 5_700, 2_750, 4_000, [wallId('0204')]),

  /* Tầng 03 — 3 phòng, 60,00 m². */
  room(roomId('010'), SECOND, 'Phòng sinh hoạt chung', 'livingRoom', 0, 0, 6_000, 4_400, [wallId('0301')]),
  room(roomId('011'), SECOND, 'Phòng ngủ 4', 'bedroom', 6_000, 0, 4_000, 4_900, [wallId('0302')]),
  room(roomId('012'), SECOND, 'Thang bộ', 'stairwell', 0, 4_400, 3_500, 4_000, [wallId('0303')]),

  /* Tầng mái — 2 phòng, 38,60 m². */
  room(roomId('013'), ROOF, 'Sân thượng', 'other', 0, 0, 5_575, 4_000, [wallId('0401')]),
  room(roomId('014'), ROOF, 'Phòng kỹ thuật', 'utility', 5_575, 0, 4_075, 4_000, [wallId('0402')], FROM_MODEL),
]);

/* -------------------------------------------------------------------------- */
/* Tường bao.                                                                  */
/* -------------------------------------------------------------------------- */

const FOOTPRINT_WIDTH_MM = 9_650;
const FOOTPRINT_DEPTH_MM = 10_000;

export const VIEWER_FIXTURE_WALLS: readonly Wall[] = Object.freeze(
  VIEWER_FIXTURE_LEVELS.flatMap((storey) =>
    envelopeWalls(storey, FOOTPRINT_WIDTH_MM, FOOTPRINT_DEPTH_MM),
  ),
);

/* -------------------------------------------------------------------------- */
/* Toà nhà và đồ thị.                                                          */
/* -------------------------------------------------------------------------- */

export const VIEWER_FIXTURE_BUILDING: Building = Object.freeze({
  ...REVIEWED,
  name: 'Nhà phố mẫu',
  datumElevationMm: millimetres(0),
  grossFloorAreaM2: squareMetres(FIXTURE_TOTAL_AREA_M2),
});

/** Đồ thị đầy đủ, sẵn sàng cho `normalizeSpatial`. */
export const VIEWER_FIXTURE_GRAPH: SpatialGraph = Object.freeze({
  building: VIEWER_FIXTURE_BUILDING,
  levels: VIEWER_FIXTURE_LEVELS,
  walls: VIEWER_FIXTURE_WALLS,
  openings: [],
  furniture: [],
  rooms: VIEWER_FIXTURE_ROOMS,
  axes: [],
  dimensions: [],
  notes: [],
});
