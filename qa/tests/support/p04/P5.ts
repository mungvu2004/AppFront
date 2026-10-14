/**
 * QA-04c P5 helpers (SCR-20 "Duyệt tên phòng", flows FL-20-*). Owned by P5 only; the shared seeds stay in
 * `../layerSeed.ts` / `../phase03Seed.ts` / `../drawingSeed.ts` (re-used, never edited).
 *
 * - Seeds: layer builders named after the flow plan (`rooms3`, `rooms1`, `roomsAB`, `roomsNormalize`, `roomsMerge`,
 *   `roomsGaps`, `roomsMeasure`, `roomsUi`) — every builder is `(levelId) => layer` for `layerSeed.writeLayer` (#35 at the
 *   floor's revision) and returns the room ids it wrote, so a test derives the screen's display codes with
 *   `displayCodesOf` (src/domain/spatial/ids.ts) exactly like the screen.
 * - {@link openSession}: a browser context signed in as `who` (one `POST /api/auth/login`), its page, the response log
 *   (`watchApi`) and a request log with the sent bodies (the layer PUTs are read from it).
 * - Screen helpers: {@link openRooms}, {@link roomOptions}, {@link toastOf}, {@link settle} ...
 *
 * Geometry used by the seeds (so a number in a test is explainable): walls are 200 mm, so the clear face of a wall loop
 * is 100 mm inside its centreline (domain/rooms/detect.ts "measured to the clear face"); a room whose outline is the clear
 * face has the area detection finds, which the merge / split commands compare with (roomLabelReviewGateway.ts
 * buildMergeRoomCommand / buildSplitRoomCommandFromWalls, AREA_TOLERANCE_M2 0,01).
 */
import { randomUUID } from 'node:crypto';

import { expect, type Browser, type BrowserContext, type Locator, type Page, type Request } from '@playwright/test';

import { displayCodesOf } from '../../../../src/domain/spatial/ids';
import { formatArea } from '../../../../src/lib/format/measure';
import { ROUTES } from '../../../../e2e/fixtures/routes';
import { navigateThenWaitForApi, waitForApiWhere, watchApi, type ApiEntry, type ApiResult } from '../../../../e2e/fullstack/apiWatch';
import { AUTOSAVE_TIMEOUT_MS, readBaseUrl } from '../../../../e2e/fullstack/env';
import { captureEvidence } from '../evidence';
import { writeLayer, type LayerApi } from '../layerSeed';
import type { Credentials } from '../p03/P5';

export type Json = Record<string, unknown>;
export type Pt = readonly [number, number];

export const DESKTOP = { width: 1440, height: 900 } as const;

export const asRecord = (value: unknown, what: string): Json => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${what}: not a JSON object`);
  return value as Json;
};
export const arrayOf = (value: unknown, what: string): Json[] => {
  if (!Array.isArray(value)) throw new Error(`${what}: not an array`);
  return value.map((item, index) => asRecord(item, `${what}[${String(index)}]`));
};
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
export const uniq = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------------------------------------------------------------- copy (each cites its FE source) */

/** SCR-20 copy. RRV RoomLabelReview.tsx, RLL RoomLabelList.tsx, RLP RoomLabelLeftPanel.tsx, RIN RoomLabelInspector.tsx,
 *  RIF RoomLabelInspectorFields.tsx, RNF RoomLabelNameField.tsx, RAD RoomLabelActionDialogs.tsx, RNP RoomLabelNormalizePreview.tsx,
 *  RCG roomLabelCanvasGeometry.ts, URR useRoomLabelReview.ts. */
export const ROOM = {
  screen: 'Duyệt tên phòng', // RRV:80
  breadcrumb: 'Dự án > Nhãn phòng', // RRV:82
  description: 'Đối chiếu tên và công năng từng phòng với bản vẽ gốc, rồi xác nhận từng phòng một.', // RRV:84
  canvasSection: 'Khung xem bản vẽ duyệt tên phòng', // RRV:86
  canvas: 'Mặt bằng duyệt tên phòng', // RCG:224
  list: 'Danh sách phòng', // RLL:35
  unnamedWord: 'Chưa đặt tên', // RLL:36
  statusUnnamed: 'Cần chú ý', // RLL:51
  statusSuggested: 'AI đề xuất, chưa duyệt', // RLL:53
  statusConfirmed: 'Đã duyệt', // RLL:55
  emptyTitle: 'Chưa dò ra phòng nào', // RRV:84
  emptyNotice:
    'Chưa dò ra phòng nào ở tầng này: vòng tường bao quanh các phòng chưa khép kín. Sang lớp tường khép các đoạn còn hở, rồi bấm "Kiểm tra lại vòng hở" để dò lại.', // URR:153
  emptyFiltered: 'Không còn phòng nào chưa đặt tên. Tắt bộ lọc "Chưa đặt tên" để xem lại toàn bộ phòng của tầng.', // URR:155
  canvasEmpty: 'Chưa dò được phòng nào trên bản vẽ này.', // RCG:229
  checkGaps: 'Kiểm tra lại vòng hở', // RRV:85
  filter: 'Chưa đặt tên', // RLP:44
  gapsTitle: 'Vòng tường hở', // RLP:47
  gapsEmpty: 'Chưa thấy vòng tường hở nào ở tầng này.', // RLP:48
  gapWalls: 'Tường liên quan', // RLP:52
  toWalls: 'Xem tại lớp tường', // RLP:54
  normalize: 'Chuẩn hoá tên', // RLP:50
  normalizeDialog: 'Xem trước chuẩn hoá tên', // RNP:35
  normalizeCaption: 'Tên phòng trước và sau khi chuẩn hoá', // RNP:36
  normalizeColumns: ['Mã phòng', 'Tên hiện tại', 'Tên sẽ thành'], // RNP:37-39
  normalizeNothing: 'Không có tên nào cần chuẩn hoá — mọi tên phòng đã đúng kiểu câu.', // RNP:40
  cancel: 'Huỷ', // RNP:41
  close: 'Đóng', // RNP:42
  apply: 'Áp dụng', // RNP:43
  inspector: 'Phòng', // RIN:82
  inspectorEmpty: 'Chọn một phòng trên bản vẽ hoặc trong danh sách để xem chi tiết.', // RIN:84
  name: 'Tên phòng', // RNF:34
  nameHint: 'Gợi ý bên dưới chỉ để chọn nhanh — tên tự gõ luôn được giữ nguyên.', // RNF:36
  nameEmpty: 'Tên phòng không được để trống.', // RNF:37
  suggestions: 'Gợi ý tên phòng', // RNF:38
  usage: 'Công năng', // RIN:83
  approve: 'Duyệt phòng này', // RIN:85
  merge: 'Gộp phòng', // RIN:87
  split: 'Tách phòng', // RIN:88
  splitHint: 'Muốn tách phòng, sang lớp tường vẽ một đoạn tường chia phòng rồi quay lại.', // RoomLabelInspector.tsx:98 SPLIT_MISSING_POINT
  mergeDialog: 'Gộp hai phòng', // RAD:25
  mergeSelect: 'Phòng sẽ gộp vào', // RAD:26
  mergePlaceholder: 'Chọn phòng', // RAD:27
  mergeEmpty: 'Không còn phòng nào khác ở tầng này để gộp.', // RAD:28
  splitDialog: 'Tách phòng', // RAD:30
  closeX: 'Đóng hộp thoại', // Modal.tsx:171
  area: 'Diện tích', // RIF:36
  areaCaption: 'Diện tích sàn đo trong mép thông thuỷ của ranh phòng.', // URR:219
  perimeter: 'Chu vi phòng', // RIF:37
  clearHeight: 'Chiều cao thông thuỷ', // RIF:38
  clearHeightMissing: 'Chưa có số đo chiều cao thông thuỷ cho phòng này.', // RIF:39
  confidence: 'Độ tin cậy', // RIF:46
  crop: 'Ảnh cắt gốc', // RIF:47
  cropOcr: 'Tên do máy đọc nhưng chưa có ảnh bản vẽ để cắt vùng ghi tên.', // RIF:48
  cropHuman: 'Tên do người duyệt đặt nên không có ảnh cắt gốc để đối chiếu.', // RIF:49
  notices: 'Nhắc công năng', // RIF:50
  noticeLink: 'Xem luật không gian', // RIF:51
  provisional: 'Chưa có — tỷ lệ tạm', // provisionalScale.ts:14
  provisionalBanner: 'Tỷ lệ tạm — số đo chưa tin được, hãy hiệu chỉnh tỷ lệ.', // provisionalScale.ts:16
  toScale: 'Hiệu chỉnh tỷ lệ', // PSB:21
  conflict: 'Tầng này vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.', // vi.json floorLayerSave.reloadConflict
  reload: 'Tải lại', // FSB:37
  reloadFailed: 'Không tải lại được tầng này. Thử lại sau.', // vi.json floorLayerSave.reloadFailed
  confirmTitle: 'Bỏ thay đổi chưa lưu của tầng này?', // FSC:63
  confirmBody:
    'Bản mới nhất trên máy chủ sẽ thay mọi sửa đổi chưa lưu của tầng này. Thao tác này không hoàn tác được.', // FSC:68
  confirmReload: 'Tải lại và bỏ thay đổi', // FSC:61
  reloadedToast: 'Đã tải lại bản mới nhất của tầng; các thay đổi chưa lưu đã bị bỏ.', // useAutosave.ts:278
  saveFailedGeneric: 'Không lưu được thay đổi của tầng này.', // vi.json floorLayerSave.unknown
  undo: 'Hoàn tác', // Toast.tsx
  toasts: 'Thông báo', // Toast.tsx:176
  viewerTitle: 'Không có quyền sửa lớp phòng', // RRV:91
  viewerNotice:
    'Bạn đang xem với vai người xem: đổi tên, đổi công năng, gộp, tách và duyệt đều tắt. Nhờ người quản trị dự án đổi vai nếu bạn cần sửa lớp phòng.', // URR:158
  viewerCanvas: 'Bản vẽ vẫn xem được, nhưng không chọn được phòng nào ở đây. Nhờ người có quyền sửa dự án duyệt giúp.', // RCG:226
  readErrorTitle: 'Không đọc được lớp phòng', // RRV:90
  retry: 'Thử lại', // RRV:92
  unknownTitle: 'Có trục trặc', // vi.json errors.unknown.title
  unknownText: 'Hệ thống đã ghi nhận và sẽ kiểm tra. Hãy thử lại sau ít phút.', // vi.json errors.unknown.description
  networkTitle: 'Mất kết nối',
  networkText: 'Không liên lạc được với máy chủ. Kiểm tra mạng rồi thử lại.',
  projectMissing: 'Không tìm thấy dự án này', // ProjectSpatialGate
  toDashboard: 'Về danh sách dự án',
  floorMissingTitle: 'Không mở được tầng này', // floorLayerReadFailure.ts:15
  floorMissingText: 'Tầng này không còn tồn tại. Mở Quản lý tầng để chọn một tầng khác.',
  toFloors: 'Về quản lý tầng',
} as const;

/** The eight chips (URR ROOM_NAME_TARGETS = sentence-cased ROOM_USAGE_LABELS, RRG:1021), in the order the screen shows. */
export const SUGGESTIONS = ['Phòng khách', 'Phòng ngủ', 'Bếp', 'Phòng tắm', 'Hành lang', 'Buồng thang', 'Phòng kỹ thuật', 'Phòng khác'] as const;

/* ---------------------------------------------------------------- ids and layer builders */

let sequence = 100;
/** W4 id `<letter>-<6-digit counter><10 random>`: counter-led, so the screen's display code is `<letter>-<counter>`
 *  (src/domain/spatial/ids.ts displayCodesOf); counters here start at 101, away from the app's own `createId` counters. */
const newId = (letter: 'W' | 'R' | 'F'): string => {
  sequence += 1;
  return `${letter}-${String(sequence).padStart(6, '0')}${randomUUID().replace(/-/gu, '').toUpperCase().slice(0, 10)}`;
};

const ai = (confidence = 0.9): Json => ({ confidence, reviewed: false, source: 'ai' });
const human = (reviewed: boolean): Json => ({ confidence: 1, reviewed, source: 'human' });

export const rect = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** m² of a polygon (shoelace) — what the screen's `computeArea` finds for the same outline. */
export const areaM2Of = (outline: readonly Pt[]): number => {
  let twice = 0;
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length] as Pt;
    twice += p[0] * q[1] - q[0] * p[1];
  });
  return Math.abs(twice) / 2 / 1_000_000;
};

/** Area text the list / inspector show for `outline` (formatArea of the same area, "16,00 m²"). */
export const areaTextOf = (outline: readonly Pt[]): string => formatArea(areaM2Of(outline));

export interface RoomSpec {
  readonly key: string;
  readonly name: string;
  readonly outline: readonly Pt[];
  readonly usage?: string;
  /** 'human' (reviewed or not) instead of the default AI proposal. */
  readonly human?: 'reviewed' | 'unreviewed';
  readonly confidence?: number;
}

export interface TableSpec {
  readonly room: string;
  readonly at: Pt;
}

export interface LayerSpec {
  readonly rooms?: readonly RoomSpec[];
  readonly walls?: readonly WallSpec[];
  readonly tables?: readonly TableSpec[];
}

export interface WallSpec {
  readonly key: string;
  readonly from: Pt;
  readonly to: Pt;
  readonly thicknessMm?: number;
}

/** A seed: the id of every room / wall by its key, and the #35 layer for a level. */
export interface Seed {
  readonly rooms: Readonly<Record<string, string>>;
  readonly walls: Readonly<Record<string, string>>;
  readonly build: (levelId: string) => Json;
}

/** Builds a {@link Seed}: ids are fixed when the seed is made, so a test knows them before the layer is written. */
export function seedOf(spec: LayerSpec): Seed {
  const rooms: Record<string, string> = {};
  const walls: Record<string, string> = {};
  for (const room of spec.rooms ?? []) rooms[room.key] = newId('R');
  for (const wall of spec.walls ?? []) walls[wall.key] = newId('W');
  return {
    rooms,
    walls,
    build: (levelId) => ({
      walls: (spec.walls ?? []).map((wall) => ({
        ...ai(),
        centreline: { start: { x: wall.from[0], y: wall.from[1] }, end: { x: wall.to[0], y: wall.to[1] } },
        heightMm: 3_000,
        id: walls[wall.key],
        kind: 'partition',
        levelId,
        openingIds: [],
        thicknessMm: wall.thicknessMm ?? 200,
      })),
      openings: [],
      rooms: (spec.rooms ?? []).map((room) => ({
        ...(room.human === undefined ? ai(room.confidence) : human(room.human === 'reviewed')),
        areaM2: areaM2Of(room.outline),
        id: rooms[room.key],
        levelId,
        name: room.name,
        outline: room.outline.map((p) => ({ x: p[0], y: p[1] })),
        usage: room.usage ?? 'bedroom',
        wallIds: [],
      })),
      furniture: (spec.tables ?? []).map((table) => ({
        ...ai(),
        boundingBox: { min: { x: table.at[0] - 400, y: table.at[1] - 300 }, max: { x: table.at[0] + 400, y: table.at[1] + 300 } },
        centre: { x: table.at[0], y: table.at[1] },
        id: newId('F'),
        kind: 'table',
        levelId,
        roomId: rooms[table.room],
        rotationDeg: 0,
      })),
    }),
  };
}

/**
 * Four 200 mm walls around the centreline rectangle (x0,y0)-(x1,y1); `splitX` cuts the top and bottom walls at those x
 * (a partition ends on a shared vertex there instead of teeing into the middle of a run). Keys `<prefix>-t0..`.
 */
export function loopWalls(prefix: string, x0: number, y0: number, x1: number, y1: number, splitX: readonly number[] = []): WallSpec[] {
  const xs = [x0, ...splitX, x1];
  const side = (edge: 't' | 'b', y: number): WallSpec[] =>
    xs.slice(0, -1).map((x, i) => ({ key: `${prefix}-${edge}${String(i)}`, from: [x, y], to: [xs[i + 1] as number, y] }));
  return [
    ...side('t', y0),
    { key: `${prefix}-r`, from: [x1, y0], to: [x1, y1] },
    ...side('b', y1),
    { key: `${prefix}-l`, from: [x0, y0], to: [x0, y1] },
  ];
}

/** Clear face of a 200 mm loop: 100 mm inside the centreline rectangle. */
export const clear = (x0: number, y0: number, x1: number, y1: number): Pt[] => rect(x0 + 100, y0 + 100, x1 - 100, y1 - 100);

/* ---- the named seeds of the flow plan ---- */

export const NAMES = {
  unnamed: '   ',
  ai: 'qa phòng máy',
  reviewed: 'qa phòng duyệt',
  one: 'qa phòng một',
} as const;

/** QC:rooms-3 — unnamed "   " (AI), AI-named, reviewed human; no wall, so every room carries a ROOM-NOT-CLOSED notice. */
export const rooms3 = (): Seed =>
  seedOf({
    rooms: [
      { key: 'unnamed', name: NAMES.unnamed, outline: rect(0, 0, 4000, 4000) },
      { key: 'ai', name: NAMES.ai, outline: rect(5000, 0, 9000, 4000), usage: 'kitchen' },
      { key: 'reviewed', name: NAMES.reviewed, outline: rect(10000, 0, 14000, 4000), human: 'reviewed' },
    ],
  });

/** QC:rooms-1 — one AI room. */
export const rooms1 = (): Seed => seedOf({ rooms: [{ key: 'one', name: NAMES.one, outline: rect(0, 0, 4000, 4000) }] });

/** QC:rooms-AB — "A", "B", and the whitespace-named room. */
export const roomsAB = (): Seed =>
  seedOf({
    rooms: [
      { key: 'a', name: 'A', outline: rect(0, 0, 4000, 4000) },
      { key: 'b', name: 'B', outline: rect(5000, 0, 9000, 4000) },
      { key: 'blank', name: '   ', outline: rect(10000, 0, 14000, 4000) },
    ],
  });

/** QX:rooms-normalize, floor 1: "PHONG NGU 2", "bep", "Bếp 2", "Kho", "PHONG NGU" + "Phòng ngủ" (RRG:1043-1131). */
export const roomsNormalize = (): Seed =>
  seedOf({
    rooms: ['PHONG NGU 2', 'bep', 'Bếp 2', 'Kho', 'PHONG NGU', 'Phòng ngủ'].map((name, i) => ({
      key: name,
      name,
      outline: rect(i * 5000, 0, i * 5000 + 4000, 4000),
    })),
  });

/** QX:rooms-normalize, floor 2: "Bếp" only → nothing to change. */
export const roomsBep = (): Seed => seedOf({ rooms: [{ key: 'bep', name: 'Bếp', outline: rect(0, 0, 4000, 4000), usage: 'kitchen' }] });

/** Merge floor 1: one 8 x 4 m loop, rooms "Mẹ" + "Con" side by side on the clear face, a table in "Con". */
export const mergeLoop = (): Seed =>
  seedOf({
    walls: loopWalls('m', 0, 0, 8000, 4000),
    rooms: [
      { key: 'target', name: 'qa gộp mẹ', outline: rect(100, 100, 4000, 3900) },
      { key: 'absorbed', name: 'qa gộp con', outline: rect(4000, 100, 7900, 3900) },
    ],
    tables: [{ room: 'absorbed', at: [6000, 2000] }],
  });

/** Merge floor 2: two rooms, each in its own wall loop (a dividing wall between them). */
export const mergeSeparate = (): Seed =>
  seedOf({
    walls: [...loopWalls('p', 0, 0, 4000, 4000), ...loopWalls('q', 5000, 0, 9000, 4000)],
    rooms: [
      { key: 'p', name: 'qa vòng một', outline: clear(0, 0, 4000, 4000) },
      { key: 'q', name: 'qa vòng hai', outline: clear(5000, 0, 9000, 4000) },
    ],
  });

/** Merge floor 3: three rooms, one of them "   " (no wall needed: the dialog is only opened). */
export const mergeThree = (): Seed =>
  seedOf({
    rooms: [
      { key: 'a', name: 'qa phòng A', outline: rect(0, 0, 4000, 4000) },
      { key: 'blank', name: '   ', outline: rect(5000, 0, 9000, 4000) },
      { key: 'c', name: 'qa phòng C', outline: rect(10000, 0, 14000, 4000) },
    ],
  });

/** Merge floor 4: two rooms, no wall at all. */
export const mergeNoWall = (): Seed =>
  seedOf({
    rooms: [
      { key: 'a', name: 'qa không tường A', outline: rect(0, 0, 4000, 4000) },
      { key: 'b', name: 'qa không tường B', outline: rect(5000, 0, 9000, 4000) },
    ],
  });

/** Merge floor 5: both rooms span the whole clear face of one loop, so the detected region cannot hold their summed area. */
export const mergeOversized = (): Seed =>
  seedOf({
    walls: loopWalls('o', 0, 0, 8000, 4000),
    rooms: [
      { key: 'a', name: 'qa quá khổ A', outline: clear(0, 0, 8000, 4000) },
      { key: 'b', name: 'qa quá khổ B', outline: clear(0, 0, 8000, 4000) },
    ],
  });

/** Split floor: two 8 x 4 m loops, each cut by a 200 mm partition at x = 4000 (+12000); a room over each whole clear face;
 *  a table in the right half of the first. */
export const splitLoops = (): Seed =>
  seedOf({
    walls: [
      ...loopWalls('s', 0, 0, 8000, 4000, [4000]),
      { key: 's-mid', from: [4000, 0], to: [4000, 4000] },
      ...loopWalls('u', 12000, 0, 20000, 4000, [16000]),
      { key: 'u-mid', from: [16000, 0], to: [16000, 4000] },
    ],
    rooms: [
      { key: 's', name: 'qa tách S', outline: clear(0, 0, 8000, 4000) },
      { key: 'u', name: 'qa tách U', outline: clear(12000, 0, 20000, 4000) },
    ],
    tables: [{ room: 's', at: [6000, 2000] }],
  });

/** QX:rooms-gaps, floor 1: one 4 x 4 m loop whose top-right corner has a 50 mm hole (welded, so the room still closes),
 *  a named room and, beside it, an unnamed one in its own closed loop. */
export const gapsLoop = (): Seed =>
  seedOf({
    walls: [
      { key: 'top', from: [0, 0], to: [3950, 0] },
      { key: 'right', from: [4000, 0], to: [4000, 4000] },
      { key: 'bottom', from: [4000, 4000], to: [0, 4000] },
      { key: 'left', from: [0, 4000], to: [0, 0] },
      ...loopWalls('n', 6000, 0, 10000, 4000),
    ],
    rooms: [
      { key: 'named', name: 'qa vòng hở', outline: clear(0, 0, 4000, 4000) },
      { key: 'blank', name: '   ', outline: clear(6000, 0, 10000, 4000) },
    ],
  });

/** QX:rooms-gaps, floor 2: a closed loop with a room on its clear face (no gap, no unclosed room). */
export const gapsClosed = (): Seed =>
  seedOf({ walls: loopWalls('c', 0, 0, 4000, 4000), rooms: [{ key: 'room', name: 'qa vòng kín', outline: clear(0, 0, 4000, 4000) }] });

/** QX:rooms-gaps, floor 3: walls close the loop except one room side (the room is bigger than the loop on one side) →
 *  no hole to weld, but an unclosed room (BUG-407 wording). */
export const gapsUnclosed = (): Seed =>
  seedOf({
    walls: loopWalls('k', 0, 0, 4000, 4000),
    rooms: [{ key: 'room', name: 'qa chưa kín', outline: rect(100, 100, 6000, 3900) }],
  });

/** QX:rooms-measure for the drawing floor (D1): two AI rooms whose bounding box (9 x 4 m, 2,25:1) is not the drawing's. */
export const drawRooms = (): Seed =>
  seedOf({
    rooms: [
      { key: 'ai', name: 'qa phòng vẽ', outline: rect(0, 0, 5000, 4000) },
      { key: 'two', name: 'qa phòng hai', outline: rect(5000, 0, 9000, 4000) },
    ],
  });

/** QX:rooms-measure, floor 1: a 4 x 4 m AI room with confidence 0,6, a human room (OCR hint off) beside it. */
export const measureTwo = (): Seed =>
  seedOf({
    rooms: [
      { key: 'ai', name: 'qa đo máy', outline: rect(0, 0, 4000, 4000), confidence: 0.6 },
      { key: 'human', name: 'qa đo người', outline: rect(5000, 0, 9000, 4000), human: 'unreviewed' },
    ],
  });

/** QX:rooms-measure, floor 2: thirty rooms in a 6 x 5 grid. */
export const measureMany = (): Seed =>
  seedOf({
    rooms: Array.from({ length: 30 }, (_, i) => ({
      key: `r${String(i)}`,
      name: `qa phòng ${String(i + 1)}`,
      outline: rect((i % 6) * 5000, Math.floor(i / 6) * 5000, (i % 6) * 5000 + 4000, Math.floor(i / 6) * 5000 + 4000),
    })),
  });

export const LONG_NAME = 'Phòng sinh hoạt chung của gia đình nhiều thế hệ, tầng một khu A'.slice(0, 60);

/** QX:rooms-measure, floor 3: one room with a 60-character name. */
export const measureLong = (): Seed => seedOf({ rooms: [{ key: 'long', name: LONG_NAME, outline: rect(0, 0, 4000, 4000) }] });

/* ---------------------------------------------------------------- projects */

/** Writes `seed` on `floorId` through #35 at the floor's current revision (layerSeed.writeLayer). */
export async function seedFloor(api: LayerApi, projectId: string, floorId: string, seed: Seed): Promise<Json> {
  return writeLayer(api, projectId, floorId, seed.build);
}

/** Display code the screen shows for each room id of `ids` (`#R-101`), as `roomCodeLabel` builds it. */
export function codesOf(ids: readonly string[]): Map<string, string> {
  const codes = displayCodesOf(ids);
  return new Map(ids.map((id) => [id, `#${codes.get(id) ?? id}`] as const));
}

/* ---------------------------------------------------------------- browser session */

export interface Req {
  readonly method: string;
  readonly path: string;
  readonly body: string | null;
}

export interface Session {
  readonly context: BrowserContext;
  readonly page: Page;
  /** Every `/api/` response of the page, in order. */
  readonly log: ApiEntry[];
  /** Every `/api/` request of the page, in order, with its body. */
  readonly reqs: Req[];
}

/** A fresh context signed in as `who` (one login through the context's cookie jar), page + logs. */
export async function openSession(
  browser: Browser,
  who: Credentials,
  options: { readonly viewport?: { width: number; height: number }; readonly reducedMotion?: boolean } = {},
): Promise<Session> {
  const context = await browser.newContext({
    baseURL: readBaseUrl(),
    viewport: options.viewport ?? DESKTOP,
    ...(options.reducedMotion === true ? { reducedMotion: 'reduce' as const } : {}),
  });
  try {
    const res = await context.request.post('/api/auth/login', {
      data: { email: who.email, password: who.password, rememberMe: false },
      headers: { Origin: readBaseUrl() },
    });
    expect(res.status(), 'setup: POST /api/auth/login (flow session)').toBe(204);
    const page = await context.newPage();
    const reqs: Req[] = [];
    page.on('request', (request: Request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) reqs.push({ method: request.method(), path: url.pathname, body: request.postData() });
    });
    return { context, page, log: watchApi(page), reqs };
  } catch (error) {
    await context.close();
    throw error;
  }
}

export async function closeSession(s: Session | undefined): Promise<void> {
  await s?.context.close().catch(() => undefined);
}

/** Writes (non-GET, minus session / telemetry chatter) the page sent since `mark` (an index into `reqs`). */
export const writesSince = (s: Session, mark: number): string[] =>
  s.reqs
    .slice(mark)
    .filter((r) => r.method !== 'GET' && r.path !== '/api/auth/refresh' && !r.path.startsWith('/api/telemetry'))
    .map((r) => `${r.method} ${r.path}`);

export const layerPath = (projectId: string, floorId: string): string => `/api/projects/${projectId}/floors/${floorId}/spatial/layer`;
export const layerRe = (projectId: string, floorId: string): RegExp => new RegExp(`^${escapeRegExp(layerPath(projectId, floorId))}$`, 'u');
export const floorRe = (projectId: string, floorId: string): RegExp =>
  new RegExp(`^/api/projects/${escapeRegExp(projectId)}/floors/${escapeRegExp(floorId)}/spatial$`, 'u');

export interface SentLayer {
  readonly baseVersion: number;
  readonly layer: Json;
  readonly rooms: Json[];
}

/** The #35 PUTs of a floor sent since `mark`, with their parsed bodies. */
export function layerPutsSince(s: Session, projectId: string, floorId: string, mark = 0): SentLayer[] {
  return s.reqs
    .slice(mark)
    .filter((r) => r.method === 'PUT' && r.path === layerPath(projectId, floorId))
    .map((r) => {
      const data = asRecord(JSON.parse(r.body ?? 'null'), 'PUT #35');
      const layer = asRecord(asRecord(data.body, 'PUT #35 body').layer, 'PUT #35 layer');
      return { baseVersion: Number(data.baseVersion), layer, rooms: arrayOf(layer.rooms, 'layer.rooms') };
    });
}

export const countSince = (s: Session, mark: number, method: string, path: string): number =>
  s.reqs.slice(mark).filter((r) => r.method === method && r.path === path).length;

/** A same-origin round trip: anything the page sent before it (a PUT the debounce just fired) is in `reqs` after it. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => fetch('/api/health', { cache: 'no-store' }).then(() => undefined));
}

/**
 * "Nothing is pending": Ctrl+S flushes any autosave right now (router.tsx global.save → flushAutosaves), then a same-origin
 * round trip lets the page's own requests reach `reqs`. A change still waiting for its 800 ms debounce would be sent by it,
 * so "no PUT after `flush`" proves no write was pending or sent — with no fixed wait and no fake clock.
 */
export async function flush(page: Page): Promise<void> {
  await page.keyboard.press('Control+s');
  await settle(page);
}

/** Runs the page clock `ms` ahead (debounce / retry timers) and syncs with the network — needs `page.clock.install()`. */
export async function advance(page: Page, ms: number): Promise<void> {
  await page.clock.runFor(ms);
  await settle(page);
}

/* ---------------------------------------------------------------- screen helpers */

export const roomsUrl = (projectId: string, floorId: string): string => ROUTES.project.rooms(projectId, floorId);

/** Opens SCR-20 with a fresh document load and waits for its N16 read (200) and the screen region. */
export async function openRooms(page: Page, projectId: string, floorId: string): Promise<void> {
  await navigateThenWaitForApi(page, () => page.goto(roomsUrl(projectId, floorId), { waitUntil: 'commit' }), 'GET', layerRe(projectId, floorId), [200]);
  await expect(page.getByRole('region', { name: ROOM.screen, exact: true })).toBeVisible();
}

export const roomList = (page: Page): Locator => page.getByRole('listbox', { name: ROOM.list, exact: true });
export const roomOptions = (page: Page): Locator => roomList(page).getByRole('option');
/** The list option of a room: its name starts with the display code and contains the name. */
export const optionOf = (page: Page, code: string): Locator =>
  roomList(page).getByRole('option', { name: new RegExp(`^${escapeRegExp(code)} · `, 'u') });
export const nameField = (page: Page): Locator => page.getByRole('textbox', { name: ROOM.name, exact: true });
export const inspector = (page: Page): Locator => page.getByRole('heading', { name: ROOM.inspector, exact: true, level: 3 }).locator('xpath=../..');
export const canvasGroup = (page: Page): Locator => page.getByRole('group', { name: ROOM.canvas, exact: true });
export const canvasButton = (page: Page, name: string | RegExp): Locator =>
  canvasGroup(page).getByRole('button', typeof name === 'string' ? { name, exact: true } : { name });
/** The selection / hover halo (SelectionHalo.tsx): the only `div[role=presentation][aria-hidden]` inside the canvas group. */
export const halo = (page: Page): Locator => canvasGroup(page).locator('div[role="presentation"][aria-hidden="true"]');
export const toastRegion = (page: Page): Locator => page.getByRole('region', { name: ROOM.toasts, exact: true });
export const toastOf = (page: Page, text: string | RegExp): Locator => toastRegion(page).getByRole('status').filter({ hasText: text });
export const filterToggle = (page: Page): Locator => page.getByRole('button', { name: new RegExp(`^${ROOM.filter}`, 'u') });
export const saveChip = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text });
export const SAVED_AT = /^Đã lưu lúc \d{1,2}:\d{2}$/u; // vi.json common.saved_at
export const SAVING = 'Đang lưu…'; // vi.json autosave.saving

/** Opens a custom `Select` (components/ui/Select.tsx): the open listbox is the trigger's `aria-controls`. */
export async function openSelectOf(page: Page, trigger: Locator): Promise<Locator> {
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const id = await trigger.getAttribute('aria-controls');
  if (id === null || id === '') throw new Error('select trigger has no aria-controls once open');
  return page.locator(`[id="${id}"]`);
}

/** Opens the "Công năng" select and returns its listbox. */
export const openUsage = (page: Page): Promise<Locator> => openSelectOf(page, page.getByRole('combobox', { name: ROOM.usage, exact: true }));

/** Selects the room `code` from the list and waits for the inspector. */
export async function selectRoom(page: Page, code: string): Promise<void> {
  await optionOf(page, code).click();
  await expect(optionOf(page, code)).toHaveAttribute('aria-selected', 'true');
}

/** The option name the list builds: `{code} · {name|Chưa đặt tên} · {area} · {status}` (RLL:70). */
export const optionName = (code: string, name: string, outline: readonly Pt[], status: string): string =>
  `${code} · ${name.trim() === '' ? ROOM.unnamedWord : name} · ${areaTextOf(outline)} · ${status}`;

/**
 * The next `PUT …/spatial/layer` of a floor whose sent rooms pass `sent` (any status). Register BEFORE the action.
 * `status` narrows the answer (default: any).
 */
export function waitForLayerPut(
  page: Page,
  projectId: string,
  floorId: string,
  sent?: (rooms: Json[]) => boolean,
  statuses?: readonly number[],
): Promise<ApiResult> {
  return waitForApiWhere(
    page,
    (response) => {
      const request = response.request();
      if (request.method() !== 'PUT' || new URL(response.url()).pathname !== layerPath(projectId, floorId)) return false;
      if (statuses !== undefined && !statuses.includes(response.status())) return false;
      if (sent === undefined) return true;
      try {
        const body = asRecord(asRecord(request.postDataJSON(), '#35').body, '#35.body');
        return sent(arrayOf(asRecord(body.layer, '#35.layer').rooms, '#35.layer.rooms'));
      } catch {
        return false;
      }
    },
    AUTOSAVE_TIMEOUT_MS,
    'PUT …/spatial/layer',
  );
}

/** Rooms of the layer a PUT sent. */
export const sentRooms = (result: ApiResult): Json[] => {
  const body = asRecord(asRecord(result.response.request().postDataJSON(), '#35').body, '#35.body');
  return arrayOf(asRecord(body.layer, '#35.layer').rooms, '#35.layer.rooms');
};

/** The list option of the room named `name` (the option name carries ` · {name} · `). */
export const optionNamed = (page: Page, name: string): Locator =>
  roomList(page).getByRole('option', { name: new RegExp(` · ${escapeRegExp(name)} · `, 'u') });

/**
 * A second writer: reads N16, applies `mutate` to its layer and PUTs it at the revision just read (#35, 200). The page that
 * loaded the floor earlier now holds a stale base, so its next save answers 409 (BE spatial_write/writer.py:347-372).
 */
export async function writeElsewhere(api: LayerApi, projectId: string, floorId: string, mutate: (layer: Json) => Json): Promise<number> {
  const path = layerPath(projectId, floorId);
  const read = await api.request.get(path, { headers: api.headers });
  expect(read.status(), `setup: GET ${path} (N16)`).toBe(200);
  const doc = asRecord(await read.json(), 'N16');
  const put = await api.request.put(path, {
    headers: api.headers,
    data: { baseVersion: doc.revision, body: { layer: mutate(asRecord(doc.layer, 'N16.layer')) } },
  });
  expect(put.status(), `setup: PUT ${path} (second writer): ${(await put.text()).slice(0, 300)}`).toBe(200);
  return Number(asRecord(await put.json(), '#35').revision);
}

/**
 * Evidence while the page clock is PAUSED: `captureEvidence` waits on animation frames, which a paused fake clock never
 * delivers (the shot hangs). Resumes the clock for the shot (well under a toast's 8 s), then pauses again 100 ms ahead.
 */
export async function shotPaused(page: Page, name: string): Promise<void> {
  await page.clock.resume();
  try {
    await captureEvidence(page, name);
  } finally {
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100)).catch(() => undefined);
  }
}
