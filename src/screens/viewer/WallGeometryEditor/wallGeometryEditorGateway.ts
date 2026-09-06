/**
 * Cổng dữ liệu và tầng lệnh của màn `WallGeometryEditor` (S-19) — mọi lời gọi
 * ra khỏi màn đi qua đây, và đây là nơi DUY NHẤT chạm `commit` / `dispatch` /
 * `previewEdit` (A10, `local/no-direct-set`).
 *
 * Hình dạng của mục 5 trong `notes/wall-geometry-editor/contract-screen.md`
 * được chép nguyên: `supports`, `WallGeometryEditorResult`, bảy việc nghiệp vụ,
 * ba cửa của phiên kéo. Khuôn cài đặt lấy từ hai màn anh em đã chạy —
 * `wallLayerReviewGateway.ts` (đường ghi `dispatch` → `commit`) và
 * `propertyInspectorGateway.ts` (bảng khả năng + nhánh từ chối mang câu tiếng
 * Việt).
 *
 * ## Ba quyết định phạm vi, và vì sao
 *
 * 1. **`readOriginalTrace` luôn trả `null`, `supports.readOriginalTrace` là
 *    `false`.** `contract-geometry.md` (LỖ HỔNG 1) đã đo: không tầng nào trong
 *    repo giữ hình học GỐC của một bức tường — `Wall` không có trường ấy,
 *    `ReviewMetadata` chỉ có `confidence`/`source`/`reviewed`, và
 *    `src/lib/versioning` chỉ lưu ảnh chụp chung, không định danh được "bản của
 *    AI". Chip đối chiếu vì thế KHÔNG vẽ, và không có loại bắt điểm thứ tư.
 *    Bịa một con số lệch là điều bị cấm.
 * 2. **Đúng BA loại bắt điểm**, mỗi loại một nhãn gọi tên nó trên màn:
 *    `otherVertex` → "Đỉnh khác", `perpendicular` → "Vuông góc", `axis` →
 *    "Trục lưới". Ba mã lấy từ `KNOWN_SNAP_KIND_IDS`, ba nhãn lấy từ
 *    `WALL_GEOMETRY_EDITOR_TEXT.snap` — không chuỗi nào được gõ lại ở đây.
 *    Loại "trục có tên" của đặc tả không dựng được (LỖ HỔNG 2: `SnapTargetKind`
 *    không có nhánh trục), nên nó chạy trên lưới của cùng `SNAP_THRESHOLDS` mà
 *    gizmo 3D đọc, và được gọi đúng tên là lưới.
 * 3. **"Đỉnh" là ĐẦU MÚT tường.** `Wall.centreline` là một `Segment` hai đầu
 *    (`domain/spatial/types.ts:123-132`), không phải đa tuyến N đỉnh. Nên thêm
 *    đỉnh = `wall.split`, xoá đỉnh = `wall.merge` — hai lệnh CÓ THẬT của
 *    `wallCommands.ts`, không phải hai lệnh mới bịa ra.
 *
 * ## Sau MỖI lệnh: M-04 → M-05 → M-09
 *
 * {@link reviewWallGeometry} gọi lại `resolveJoints` (M-04), `cleanupWalls`
 * (M-05) và `reflowOpenings` (M-09) trên đồ thị SAU lệnh. Nó là một hàm THUẦN
 * của đồ thị, nên hook gọi nó trong một `useMemo` khoá theo chính đồ thị: không
 * có đường nào để một lệnh chạy xong mà ba phép này bị bỏ qua. Kết quả của cả
 * ba đều ra tới màn — khe hở và tường phụ thuộc (M-04), cạnh cần chú ý (M-05),
 * câu về ô mở bị dịch (M-09) — chứ không có phép nào chạy để rồi vứt đi.
 *
 * Ba phép ấy **không tự ghi lại** vào bản vẽ: một lượt ghi thứ hai sau mỗi lệnh
 * là một bước hoàn tác thứ hai, đúng thứ D-06 cấm ("một phiên kéo sinh ĐÚNG MỘT
 * bước"). Chúng chạy để GIẢI THÍCH, và việc dọn hình là lệnh của người dùng.
 */

import { lockDirection } from '@/domain/measure/constraints';
import { placeOnWall } from '@/domain/openings/attach';
import { reflowOpenings, reflowOpeningsAcrossSplit } from '@/domain/openings/reflow';
import type { AttachedOpening } from '@/domain/openings/types';
import { checkDanglingWallEnds, checkWallOverlap } from '@/domain/rules/geometry';
import { createId, isIdOfKind } from '@/domain/spatial/ids';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Level, LevelId, Point, Wall as GraphWall, WallId } from '@/domain/spatial/types';
import { millimetresPerPixel, pixels, scaleFromRatio, type Scale } from '@/domain/units/scale';
import {
  distanceBetween,
  snapToTargets,
  SNAP_THRESHOLDS,
  type SnapTarget,
} from '@/domain/units/snap';
import { millimetres } from '@/domain/units/types';
import { CLEANUP_THRESHOLDS, cleanupWalls } from '@/domain/walls/cleanup';
import { resolveJoints, type Joint } from '@/domain/walls/joints';
import { centrelineLength, type Wall as SolidWall, type WallEnd } from '@/domain/walls/types';
import {
  levelOfWall,
  openingsOfWall,
  readOf,
  toAttachedOpening,
  toPointMm,
  toSolidWall,
  wallsOnLevel,
  type CommandContext,
  type CommandResult,
} from '@/lib/commands/business/shared';
import {
  createChangeWallHeightCommand,
  createDragWallEndCommand,
  createMergeWallsCommand,
  createSplitWallCommand,
} from '@/lib/commands/business/wallCommands';
import {
  createIncrementalRuleRunner,
  dispatch,
  type DispatchDeps,
  type DispatchResult,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import {
  createHistoryStack,
  type HistoryStack,
  type SelectionSnapshot,
} from '@/lib/commands/history';
import { KEYBOARD_STEP_MM } from '@/lib/input/dragDrop';
import { formatLength } from '@/lib/format/measure';
import { formatNumber, parseNumber } from '@/lib/format/number';
import { useStore } from '@/store';
import { commit, discardPreview, previewEdit } from '@/store/commit';

import {
  KNOWN_SNAP_KIND_IDS,
  WALL_GEOMETRY_EDITOR_TEXT,
  type SnapKindId,
  type WallGeometryNudgeDirection,
  type WallGeometryPointPx,
} from './wallGeometryEditorTypes';

const TEXT = WALL_GEOMETRY_EDITOR_TEXT;

/* -------------------------------------------------------------------------- */
/* 5.1 — Đơn vị và kết quả.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Một điểm trên mặt bằng, milimét — đơn vị của MÔ HÌNH, không phải của màn hình.
 *
 * Khai ở đây thay vì nhập `Point` của `@/domain/spatial/types` vì cổng này là
 * chỗ DUY NHẤT được phép biết hình dạng thật của domain. Hậu tố `Mm` để một chỗ
 * gọi lỡ truyền pixel là lỗi biên dịch chứ không phải một bức tường sai tỉ lệ.
 */
export interface WallGeometryPointMm {
  readonly xMm: number;
  readonly yMm: number;
}

/**
 * Vì sao một lượt ghi bị từ chối.
 *
 * `explanation` bắt buộc và không rỗng — hình học không hợp lệ phải được GIẢI
 * THÍCH, không bao giờ bị từ chối im lặng. `offendingEdgeIds` là những cạnh
 * view tô sáng; rỗng khi lời từ chối không chỉ vào cạnh nào.
 */
export interface WallGeometryRefusal {
  readonly explanation: string;
  readonly offendingEdgeIds: readonly string[];
}

/** Kết quả một việc cổng làm. */
export type WallGeometryEditorResult<TValue> =
  | { readonly ok: true; readonly data: TValue }
  | { readonly ok: false; readonly refusal: WallGeometryRefusal };

/* -------------------------------------------------------------------------- */
/* 5.2 — Hình học đọc ra.                                                      */
/* -------------------------------------------------------------------------- */

/** Một đỉnh, như tầng dưới đưa lên. */
export interface WallGeometryVertexSnapshot {
  readonly id: string;
  readonly atMm: WallGeometryPointMm;
}

/**
 * Hình học của bức tường đang sửa.
 *
 * `vertices` là MẢNG, không phải `start`/`end`. `gapMm` khác `null` là nguồn
 * của nhánh `partial` "vòng hở".
 */
export interface WallGeometrySnapshot {
  readonly wallId: string;
  readonly vertices: readonly WallGeometryVertexSnapshot[];
  readonly heightMm: number;
  readonly gapMm: number | null;
}

/** Vết vẽ gốc của AI — kiểu tồn tại, đường tới nó thì không (xem đầu file). */
export interface WallGeometryOriginalTrace {
  readonly wallId: string;
  readonly vertices: readonly WallGeometryVertexSnapshot[];
  readonly maxDeviationMm: number;
}

/* -------------------------------------------------------------------------- */
/* 5.3 — Bắt điểm.                                                             */
/* -------------------------------------------------------------------------- */

/** Một câu hỏi bắt điểm, hỏi lúc con trỏ đang ở đâu đó. */
export interface WallGeometrySnapQuery {
  readonly wallId: string;
  readonly vertexId: string;
  readonly atMm: WallGeometryPointMm;
  /** Bán kính bắt điểm tính bằng PIXEL — 8px ở xa và ở gần là hai khoảng cách thật khác nhau. */
  readonly radiusPx: number;
  /** Tỉ lệ hiện tại, để CỔNG đổi bán kính pixel sang milimét (R-61). */
  readonly millimetresPerPixel: number;
}

/** Một chỗ bắt được. */
export interface WallGeometrySnapCandidate {
  readonly kindId: SnapKindId;
  /** Tên loại này, tiếng Việt, để hiện lên màn. */
  readonly label: string;
  /** Chỗ tay nắm sẽ lắng xuống. */
  readonly atMm: WallGeometryPointMm;
  /** Đầu kia của đường dẫn nét đứt — chỗ con trỏ đang thật sự ở. */
  readonly fromMm: WallGeometryPointMm;
}

/* -------------------------------------------------------------------------- */
/* 5.4 — Đầu vào của bảy việc nghiệp vụ.                                       */
/* -------------------------------------------------------------------------- */

/** Kéo một đỉnh tới một chỗ. Dùng cho cả lượt xem trước lẫn lượt ghi thật. */
export interface WallGeometryMoveVertexInput {
  readonly wallId: string;
  readonly vertexId: string;
  readonly toMm: WallGeometryPointMm;
}

/** Thêm một đỉnh vào giữa một cạnh — tức tách bức tường tại đó. */
export interface WallGeometryInsertVertexInput {
  readonly wallId: string;
  readonly edgeId: string;
  readonly atMm: WallGeometryPointMm;
}

/** Xoá một đỉnh — tức nối hai bức tường gặp nhau tại đỉnh ấy. */
export interface WallGeometryRemoveVertexInput {
  readonly wallId: string;
  readonly vertexId: string;
}

/** Tách một bức tường tại một điểm trên nó. */
export interface WallGeometrySplitWallInput {
  readonly wallId: string;
  readonly atMm: WallGeometryPointMm;
}

/** Nối hai bức tường ở hai đầu mút. Đúng HAI, và kiểu nói ra điều đó. */
export interface WallGeometryJoinWallsInput {
  readonly wallIds: readonly [string, string];
}

/** Đặt lại chiều cao. Nhận MỘT DANH SÁCH vì `partial` cho đổi nhiều tường. */
export interface WallGeometryChangeHeightInput {
  readonly wallIds: readonly string[];
  readonly heightMm: number;
}

/** Đóng khe hở của một vòng hở. */
export interface WallGeometryCloseGapInput {
  readonly wallId: string;
}

/* -------------------------------------------------------------------------- */
/* 5.5 — Khả năng và cổng.                                                     */
/* -------------------------------------------------------------------------- */

/** Việc màn này cần từ bên ngoài. Mỗi khoá là một khả năng, không có khả năng nào khác. */
export type WallGeometryEditorCapability =
  | 'readWallGeometry'
  | 'readOriginalTrace'
  | 'findSnapCandidates'
  | 'moveVertex'
  | 'insertVertex'
  | 'removeVertex'
  | 'splitWall'
  | 'joinWalls'
  | 'changeHeight'
  | 'closeGap';

/** Mỗi phương thức là một việc màn cần từ bên ngoài, và không có việc nào khác. */
export interface WallGeometryEditorGateway {
  /** Khả năng nào cổng làm được, trả lời ĐỒNG BỘ — `supports` quyết định nút nào có mặt. */
  readonly supports: Readonly<Record<WallGeometryEditorCapability, boolean>>;
  /** Ai đang thao tác — đi vào lệnh và nhật ký hoạt động. */
  readonly actorId: string;
  /** Hình học của tường đang sửa, BẤT ĐỒNG BỘ — nguồn DUY NHẤT của cờ tải và cờ hỏng (R-64). */
  readonly readWallGeometry: (wallId: string) => Promise<WallGeometrySnapshot | null>;
  /** Vết vẽ gốc của AI. `null` là một câu trả lời HỢP LỆ; ở bản này nó luôn là câu trả lời ấy. */
  readonly readOriginalTrace: (wallId: string) => Promise<WallGeometryOriginalTrace | null>;
  /** Những chỗ bắt được quanh con trỏ, ĐỒNG BỘ — nó chạy mỗi khung hình của một phiên kéo. */
  readonly findSnapCandidates: (
    query: WallGeometrySnapQuery,
  ) => readonly WallGeometrySnapCandidate[];
  /** ĐANG kéo: đề nghị một hình TẠM, mô hình đã lưu không bị đụng tới. Gọi mỗi khung hình. */
  readonly previewVertexMove: (input: WallGeometryMoveVertexInput) => void;
  /** Esc giữa lúc kéo: bỏ hình tạm, không để lại gì trong lịch sử. */
  readonly discardVertexPreview: () => void;
  /** THẢ TAY: kéo một đỉnh xong — ĐÚNG MỘT bước hoàn tác cho cả phiên kéo. */
  readonly commitVertexMove: (
    input: WallGeometryMoveVertexInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;
  /** Thêm một đỉnh. */
  readonly insertVertex: (
    input: WallGeometryInsertVertexInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;
  /** Xoá một đỉnh. */
  readonly removeVertex: (
    input: WallGeometryRemoveVertexInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;
  /** Tách tường tại một điểm. Trả về mã HAI bức tường sau khi tách. */
  readonly splitWall: (
    input: WallGeometrySplitWallInput,
  ) => Promise<WallGeometryEditorResult<readonly [string, string]>>;
  /** Nối hai tường. Trả về mã bức tường còn lại sau khi nối. */
  readonly joinWalls: (
    input: WallGeometryJoinWallsInput,
  ) => Promise<WallGeometryEditorResult<string>>;
  /** Đặt lại chiều cao một hoặc nhiều tường. */
  readonly changeHeight: (
    input: WallGeometryChangeHeightInput,
  ) => Promise<WallGeometryEditorResult<readonly WallGeometrySnapshot[]>>;
  /** Đóng khe hở của một vòng hở — nút của nhánh `partial`. */
  readonly closeGap: (
    input: WallGeometryCloseGapInput,
  ) => Promise<WallGeometryEditorResult<WallGeometrySnapshot>>;
}

/**
 * Chỗ tiêm cổng, khai ở ĐÂY chứ không ở file kiểu.
 *
 * `wallGeometryEditorTypes.ts` là của T5 và không được nhập file này, nên hai
 * chữ ký thật của T6 là phép giao của hai kiểu.
 */
export interface WallGeometryEditorGatewayInjection {
  /** Cổng ra tầng lệnh. Vắng mặt thì hook tự dựng cổng thật. */
  readonly gateway?: WallGeometryEditorGateway | undefined;
}

/** Ai thao tác khi nơi gọi không nói. Chuỗi ĐẶT TÊN: `validateCommands` từ chối `actorId` rỗng. */
export const WALL_GEOMETRY_EDITOR_ACTOR_ID = 'wall-geometry-editor';

/** Cửa đọc đồ thị đang sửa. Mặc định là store; test cắm một đồ thị cố định. */
export interface WallGeometryGraphPort {
  readonly read: () => NormalizedSpatial | null;
}

export interface CreateWallGeometryEditorGatewayOptions {
  readonly actorId?: string | undefined;
  /** Đồ thị đang sửa. Vắng mặt thì cổng đọc thẳng store. */
  readonly graph?: WallGeometryGraphPort | undefined;
  /** Ngăn xếp hoàn tác của tầng lệnh. Vắng mặt thì cổng dựng một cái mới. */
  readonly history?: HistoryStack | undefined;
  /** Vùng chọn trước lượt ghi. Vắng mặt thì cổng đọc `selectedIds` của store. */
  readonly selection?: (() => SelectionSnapshot) | undefined;
}

/* -------------------------------------------------------------------------- */
/* Mã đỉnh, mã cạnh, nhãn người đọc.                                           */
/* -------------------------------------------------------------------------- */

/** Ngăn giữa mã tường và phần đuôi trong mã đỉnh/mã cạnh. */
const PART_SEPARATOR = '#';

/** Đuôi của mã cạnh — một `Segment` có đúng MỘT cạnh, là chính tim tường. */
const EDGE_SUFFIX = 'edge';

/** Mã đỉnh: mã tường cộng đầu mút nó đứng. Ổn định qua mọi lượt vẽ lại. */
export const vertexIdOf = (wallId: string, end: WallEnd): string =>
  `${wallId}${PART_SEPARATOR}${end}`;

/** Mã cạnh của một bức tường — chỗ "thêm đỉnh" bấm vào. */
export const edgeIdOf = (wallId: string): string => `${wallId}${PART_SEPARATOR}${EDGE_SUFFIX}`;

/** Đầu mút mà một mã đỉnh trỏ tới, hoặc `null` khi mã không phải của một đỉnh. */
export function wallEndOfVertexId(vertexId: string): WallEnd | null {
  const suffix = vertexId.slice(vertexId.lastIndexOf(PART_SEPARATOR) + 1);

  if (suffix === 'start' || suffix === 'end') {
    return suffix;
  }

  return null;
}

/** Mã tường mà một mã đỉnh hoặc mã cạnh thuộc về. */
export const wallIdOfPartId = (partId: string): string =>
  partId.slice(0, Math.max(partId.indexOf(PART_SEPARATOR), 0));

/** Số chữ số của nhãn người đọc: "W-014", không phải "W-14". */
const DISPLAY_CODE_DIGITS = 3;

/** Số chữ số bộ đếm mà `createId` sinh ra. */
const ID_COUNTER_LENGTH = 6;

/**
 * Nhãn người đọc của một mã tường: `W-000014WALL` → `W-014`.
 *
 * Thuần cắt chuỗi, không một phép hình học nào — cùng cách màn S-12 rút nhãn
 * từ mã máy, chép lại ở đây vì màn không được nhập màn (ranh giới mục 0.4).
 */
export function wallDisplayCode(id: string): string {
  const counter = id.slice(2).slice(0, ID_COUNTER_LENGTH).replace(/^0+/u, '');

  return `${id.slice(0, 1)}-${(counter === '' ? '0' : counter).padStart(DISPLAY_CODE_DIGITS, '0')}`;
}

/** Số chữ số của mã đỉnh: "V-01". */
const VERTEX_CODE_DIGITS = 2;

/** Nhãn người đọc của đỉnh thứ `index` trên bảng: "V-01". Chữ hoa là ngoại lệ A6 cho mã. */
export const vertexDisplayCode = (index: number): string =>
  `V-${String(index + 1).padStart(VERTEX_CODE_DIGITS, '0')}`;

/* -------------------------------------------------------------------------- */
/* Định dạng số (A15) — xảy ra ở đây, không ở view.                            */
/* -------------------------------------------------------------------------- */

/** Một chiều dài để ĐỌC: "4.250 mm", dấu thập phân là dấu phẩy. */
export const formatLengthLabel = (valueMm: number): string =>
  formatLength(valueMm, { unit: 'mm' });

/** Một toạ độ trong ô sửa được: số đã định dạng, không kèm đơn vị (cột đã nói đơn vị). */
export const formatCoordinate = (valueMm: number): string =>
  formatNumber(valueMm, { fractionDigits: 0 });

/** Đọc lại những ký tự người dùng gõ vào ô toạ độ; `null` khi chưa ra số nào. */
export function parseCoordinate(text: string): number | null {
  const value = parseNumber(text);

  return value === undefined || !Number.isFinite(value) ? null : value;
}

/* -------------------------------------------------------------------------- */
/* Chiếu toạ độ — mô hình (mm) ↔ lớp phủ (px).                                 */
/* -------------------------------------------------------------------------- */

/** Nửa của một bề dài, để lấy tâm lớp phủ. */
const HALF = 2;

/** Khung nhìn mà lớp phủ đang trình bày. */
export interface WallGeometryViewport {
  readonly widthPx: number;
  readonly heightPx: number;
  /** Điểm mô hình nằm giữa lớp phủ. */
  readonly centreMm: WallGeometryPointMm;
  /** Tỉ lệ bản vẽ của tầng, milimét trên mỗi pixel ở mức thu phóng 1. */
  readonly millimetresPerPixel: number;
  /** Mức thu phóng hiện tại của khung nhìn. */
  readonly zoom: number;
}

/** Phép chiếu hai chiều giữa milimét mô hình và pixel lớp phủ. */
export interface WallGeometryProjection {
  /** Milimét trên mỗi pixel SAU thu phóng — con số câu hỏi bắt điểm cần. */
  readonly millimetresPerPixel: number;
  readonly toPx: (point: WallGeometryPointMm) => WallGeometryPointPx;
  readonly toMm: (point: WallGeometryPointPx) => WallGeometryPointMm;
}

/**
 * Phép chiếu của một khung nhìn.
 *
 * Quy đổi thật nằm trong `Scale` của `@/domain/units/scale`
 * (`pixelsToMillimetres`/`millimetresToPixels`), nên màn không viết một công
 * thức đổi đơn vị nào (R-61); ở đây chỉ còn phép dời gốc về tâm lớp phủ.
 */
export function createWallGeometryProjection(
  viewport: WallGeometryViewport,
): WallGeometryProjection {
  const ratio = viewport.millimetresPerPixel / viewport.zoom;
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const scale: Scale = scaleFromRatio(millimetresPerPixel(safeRatio));
  const centreXPx = viewport.widthPx / HALF;
  const centreYPx = viewport.heightPx / HALF;

  return {
    millimetresPerPixel: safeRatio,
    toPx: (point) => ({
      xPx: centreXPx + scale.millimetresToPixels(millimetres(point.xMm - viewport.centreMm.xMm)),
      yPx: centreYPx + scale.millimetresToPixels(millimetres(point.yMm - viewport.centreMm.yMm)),
    }),
    toMm: (point) => ({
      xMm: viewport.centreMm.xMm + scale.pixelsToMillimetres(pixels(point.xPx - centreXPx)),
      yMm: viewport.centreMm.yMm + scale.pixelsToMillimetres(pixels(point.yPx - centreYPx)),
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Khoá trục và bước dời bàn phím — hai phép của domain, không phải của màn.   */
/* -------------------------------------------------------------------------- */

/**
 * Giữ Shift: kéo điểm về đúng phương ngang hoặc phương dọc so với chỗ nó xuất
 * phát.
 *
 * `lockDirection` của `@/domain/measure/constraints` làm toàn bộ phép tính;
 * `allowDiagonal: false` là chỗ "khoá TRỤC" khác với "khoá 45°" — đặc tả nói
 * Shift khoá trục, nên bốn hướng chéo không được phép.
 */
export function lockToAxis(
  anchorMm: WallGeometryPointMm,
  pointMm: WallGeometryPointMm,
  enabled: boolean,
): WallGeometryPointMm {
  const locked = lockDirection(
    { x: millimetres(anchorMm.xMm), y: millimetres(anchorMm.yMm) },
    { x: millimetres(pointMm.xMm), y: millimetres(pointMm.yMm) },
    { allowDiagonal: false, enabled, plane: 'xy' },
  );

  return { xMm: locked.point.x, yMm: locked.point.y };
}

/**
 * Chỗ một đỉnh đi tới sau một lần bấm phím mũi tên (A12).
 *
 * Hai bước, cả hai đều là con số CÓ TÊN của repo, không phải hằng viết tay
 * (R-71): bước thường là `KEYBOARD_STEP_MM` — bước dời bàn phím duy nhất repo
 * đã đặt tên (`lib/input/dragDrop.ts:63`) — và bước lớn của Shift là
 * `SNAP_THRESHOLDS.captureRadiusMm`, vì một bước lớn phải đưa đỉnh RA KHỎI bán
 * kính bắt điểm; ngắn hơn thế thì lượt bắt điểm kế tiếp kéo nó về chỗ cũ và
 * phím mũi tên trông như hỏng.
 */
export function nudgeTargetOf(
  fromMm: WallGeometryPointMm,
  direction: WallGeometryNudgeDirection,
  isCoarse: boolean,
): WallGeometryPointMm {
  const stepMm = isCoarse ? SNAP_THRESHOLDS.captureRadiusMm : KEYBOARD_STEP_MM;

  switch (direction) {
    case 'left':
      return { xMm: fromMm.xMm - stepMm, yMm: fromMm.yMm };
    case 'right':
      return { xMm: fromMm.xMm + stepMm, yMm: fromMm.yMm };
    case 'up':
      return { xMm: fromMm.xMm, yMm: fromMm.yMm - stepMm };
    case 'down':
      return { xMm: fromMm.xMm, yMm: fromMm.yMm + stepMm };
  }
}

/* -------------------------------------------------------------------------- */
/* Đọc đồ thị.                                                                 */
/* -------------------------------------------------------------------------- */

/** Một điểm mô hình thành điểm của đồ thị. */
const toGraphPoint = (point: WallGeometryPointMm): Point => ({
  x: millimetres(point.xMm),
  y: millimetres(point.yMm),
});

/** Chiều ngược lại. */
const fromGraphPoint = (point: Point): WallGeometryPointMm => ({ xMm: point.x, yMm: point.y });

/** Bức tường và tầng nó đứng, hoặc `null` khi thiếu một trong hai. */
export interface WallGeometryTarget {
  readonly wall: GraphWall;
  readonly level: Level;
}

/** Tìm bức tường đang sửa cùng tầng của nó. `null` khi mã không phải của một tường. */
export function readWallTarget(
  graph: NormalizedSpatial | null,
  wallId: string,
): WallGeometryTarget | null {
  if (graph === null || !isIdOfKind('wall', wallId)) {
    return null;
  }

  const wall = readOf(graph, 'wall', wallId);

  if (wall === null) {
    return null;
  }

  const level = levelOfWall(graph, wall);

  return level === null ? null : { wall, level };
}

/** Mọi tường của tầng, đã đổi sang vựng hình học. Tường không dùng được bị bỏ qua. */
function solidWallsOnLevel(
  graph: NormalizedSpatial,
  levelId: LevelId,
): readonly SolidWall[] {
  const solids: SolidWall[] = [];

  for (const wall of wallsOnLevel(graph, levelId)) {
    const level = levelOfWall(graph, wall);

    if (level === null) {
      continue;
    }

    try {
      solids.push(toSolidWall(wall, level));
    } catch {
      /* Một bức tường có số đo hỏng không được làm trắng màn (A11). */
    }
  }

  return solids;
}

/** Khe hở đọc được ở một đầu mút hở, và chỗ đầu mút ấy phải đi tới để khép lại. */
export interface WallGeometryGapReading {
  readonly end: WallEnd;
  readonly gapMm: number;
  readonly toMm: WallGeometryPointMm;
}

/** Đầu mút này có nằm trong một nút nối nào không (M-04). */
const endIsJointed = (joints: readonly Joint[], wallId: WallId, end: WallEnd): boolean =>
  joints.some((joint) =>
    joint.members.some((member) => member.wallId === wallId && member.end === end),
  );

/**
 * Khe hở của bức tường: đầu mút nào chưa nối vào ai, và đầu mút gần nhất mà nó
 * còn với tới trong khoảng hàn của `CLEANUP_THRESHOLDS`.
 *
 * Cả hai phép đo đều là hàm của domain — `resolveJoints` cho biết đầu nào đã
 * nối, `distanceBetween` cho biết còn cách bao xa. Màn không tự tính khoảng
 * cách nào.
 */
export function readGap(
  graph: NormalizedSpatial,
  target: WallGeometryTarget,
): WallGeometryGapReading | null {
  const solids = solidWallsOnLevel(graph, target.level.id);
  const joints = resolveJoints(solids).joints;
  const mine = solids.find((solid) => solid.id === target.wall.id);

  if (mine === undefined) {
    return null;
  }

  let best: WallGeometryGapReading | null = null;

  for (const end of ['start', 'end'] as const) {
    if (endIsJointed(joints, target.wall.id, end)) {
      continue;
    }

    const from = mine.centreline[end];

    for (const other of solids) {
      if (other.id === target.wall.id) {
        continue;
      }

      for (const otherEnd of ['start', 'end'] as const) {
        const to = other.centreline[otherEnd];
        const gapMm = distanceBetween(from, to);

        if (gapMm <= 0 || gapMm > CLEANUP_THRESHOLDS.weldGapMm) {
          continue;
        }

        if (best === null || gapMm < best.gapMm) {
          best = { end, gapMm, toMm: { xMm: to.x, yMm: to.y } };
        }
      }
    }
  }

  return best;
}

/** Ảnh chụp hình học của một bức tường, như cổng đưa lên. */
export function snapshotOf(
  graph: NormalizedSpatial,
  target: WallGeometryTarget,
): WallGeometrySnapshot {
  const gap = readGap(graph, target);

  return {
    wallId: target.wall.id,
    vertices: (['start', 'end'] as const).map((end) => ({
      id: vertexIdOf(target.wall.id, end),
      atMm: fromGraphPoint(target.wall.centreline[end]),
    })),
    heightMm: target.wall.heightMm,
    gapMm: gap?.gapMm ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* M-04 → M-05 → M-09, chạy lại sau MỖI lệnh.                                  */
/* -------------------------------------------------------------------------- */

/** Một cạnh màn phải tô sáng, kèm câu giải thích của chính domain. */
export interface WallGeometryEdgeFinding {
  readonly wallId: string;
  /** `violation` cho tường cắt nhau; `attention` cho thứ bước dọn hình muốn sửa. */
  readonly severity: 'violation' | 'attention';
  readonly message: string;
  readonly fromMm: WallGeometryPointMm;
  readonly toMm: WallGeometryPointMm;
}

/** Kết quả của ba phép hình học chạy lại sau một lệnh. */
export interface WallGeometryReview {
  /** M-04 — những tường dùng chung đầu mút với tường đang sửa; chiều dài của chúng đổi theo. */
  readonly dependentWallIds: readonly string[];
  /** M-04 — khe hở còn hở, đã đo bằng số. */
  readonly gap: WallGeometryGapReading | null;
  /** M-05 + kiểm tường cắt nhau — cạnh phải tô sáng, mỗi cạnh một câu tiếng Việt. */
  readonly findings: readonly WallGeometryEdgeFinding[];
  /** M-09 — câu về những ô mở bị lượt dọn hình làm dịch chỗ. */
  readonly openingNotices: readonly string[];
  /**
   * Câu của domain về đầu mút còn hở, thì hiện tại.
   *
   * `checkDanglingWallEnds` (`domain/rules/geometry/index.ts:481`) đã viết sẵn
   * câu này kèm số milimét thật, nên màn không phải tự nghĩ ra một câu thứ hai
   * để nói cùng một chuyện.
   */
  readonly danglingNotices: readonly string[];
}

/** Không tường nào, không cạnh nào — dùng khi chưa có gì để soát. */
export const EMPTY_WALL_GEOMETRY_REVIEW: WallGeometryReview = Object.freeze({
  dependentWallIds: [],
  gap: null,
  findings: [],
  openingNotices: [],
  danglingNotices: [],
});

/** Cạnh của một tường, bằng toạ độ mô hình. */
const edgeOf = (wall: SolidWall): { from: WallGeometryPointMm; to: WallGeometryPointMm } => ({
  from: { xMm: wall.centreline.start.x, yMm: wall.centreline.start.y },
  to: { xMm: wall.centreline.end.x, yMm: wall.centreline.end.y },
});

/** M-04 — tường nào dùng chung một nút nối với tường đang sửa. */
function dependentWallIdsOf(joints: readonly Joint[], wallId: WallId): readonly string[] {
  const ids = new Set<string>();

  for (const joint of joints) {
    if (!joint.members.some((member) => member.wallId === wallId)) {
      continue;
    }

    for (const member of joint.members) {
      if (member.wallId !== wallId) {
        ids.add(member.wallId);
      }
    }
  }

  return [...ids];
}

/** M-05 — lượt dọn hình đề nghị làm gì với bức tường này. */
function cleanupFindingsFor(
  solids: readonly SolidWall[],
  wallId: WallId,
  byId: ReadonlyMap<string, SolidWall>,
  openings: readonly AttachedOpening[],
): { readonly findings: readonly WallGeometryEdgeFinding[]; readonly notices: readonly string[] } {
  const findings: WallGeometryEdgeFinding[] = [];
  const notices: string[] = [];

  let log: ReturnType<typeof cleanupWalls>['log'];

  try {
    log = cleanupWalls(solids).log;
  } catch {
    return { findings, notices };
  }

  for (const change of log) {
    if (!change.wallIds.includes(wallId)) {
      continue;
    }

    const wall = byId.get(wallId);

    if (wall !== undefined) {
      const edge = edgeOf(wall);

      findings.push({
        wallId,
        severity: 'attention',
        message: change.message,
        fromMm: edge.from,
        toMm: edge.to,
      });
    }

    notices.push(...reflowNoticesOf(change.before, change.after, wallId, openings));
  }

  return { findings, notices };
}

/**
 * M-09 — ô mở đi theo tường tới đâu, nếu lượt dọn hình ở trên được áp dụng.
 *
 * `reflowOpeningsAcrossSplit` khi bước dọn cắt một tường thành hai mảnh,
 * `reflowOpenings` cho mọi bước còn lại. Chỉ những ô mở CẦN NGƯỜI QUYẾT ĐỊNH
 * mới thành câu trên màn: một ô mở giữ nguyên vị trí tương đối là chuyện bình
 * thường, không phải tin tức.
 */
function reflowNoticesOf(
  before: readonly SolidWall[],
  after: readonly SolidWall[],
  wallId: WallId,
  openings: readonly AttachedOpening[],
): readonly string[] {
  const previous = before.find((wall) => wall.id === wallId);

  if (previous === undefined || openings.length === 0) {
    return [];
  }

  const pieces = after.filter((wall) => wall.id === wallId || before.every((old) => old.id !== wall.id));
  const first = pieces[0];
  const second = pieces[1];

  if (first === undefined) {
    return [];
  }

  const result =
    second === undefined
      ? reflowOpenings(previous, first, openings)
      : reflowOpeningsAcrossSplit(previous, [first, second], openings);

  return result.changes
    .filter((change) => change.status === 'needsDecision')
    .map((change) => change.message);
}

/**
 * Ba phép hình học của mục M chạy lại trên đồ thị SAU lệnh.
 *
 * Thuần: cùng một đồ thị vào thì cùng một kết quả ra, nên hook gọi nó trong một
 * `useMemo` khoá theo đồ thị và không có đường nào bỏ sót một lệnh.
 */
export function reviewWallGeometry(
  graph: NormalizedSpatial | null,
  wallId: string,
): WallGeometryReview {
  const target = readWallTarget(graph, wallId);

  if (graph === null || target === null) {
    return EMPTY_WALL_GEOMETRY_REVIEW;
  }

  const solids = solidWallsOnLevel(graph, target.level.id);
  const byId = new Map(solids.map((solid) => [String(solid.id), solid] as const));
  const mine = byId.get(target.wall.id);
  const openings: readonly AttachedOpening[] =
    mine === undefined
      ? []
      : openingsOfWall(graph, target.wall.id).map((opening) => toAttachedOpening(opening, mine));

  const joints = resolveJoints(solids).joints;
  const cleanup = cleanupFindingsFor(solids, target.wall.id, byId, openings);
  const findings: WallGeometryEdgeFinding[] = [...cleanup.findings];

  for (const finding of checkWallOverlap({ graph, levelId: target.level.id })) {
    for (const relatedId of finding.relatedIds) {
      const wall = byId.get(relatedId);

      if (wall === undefined) {
        continue;
      }

      const edge = edgeOf(wall);

      findings.push({
        wallId: relatedId,
        severity: 'violation',
        message: finding.message,
        fromMm: edge.from,
        toMm: edge.to,
      });
    }
  }

  const context = { graph, levelId: target.level.id };

  return {
    dependentWallIds: dependentWallIdsOf(joints, target.wall.id),
    gap: readGap(graph, target),
    findings,
    openingNotices: cleanup.notices,
    danglingNotices: checkDanglingWallEnds(context)
      .filter((finding) => finding.entityId === target.wall.id)
      .map((finding) => finding.message),
  };
}

/* -------------------------------------------------------------------------- */
/* Chuỗi kích thước — chiều dài và điểm giữa, đều của domain.                  */
/* -------------------------------------------------------------------------- */

/** Một đoạn của chuỗi kích thước, còn ở đơn vị mô hình. */
export interface WallGeometryMeasureReading {
  readonly wallId: string;
  readonly lengthMm: number;
  readonly midpointMm: WallGeometryPointMm;
}

/** Giữa tim tường — `placeOnWall` của domain, không phải một phép trung bình viết tay. */
const HALFWAY_ALONG_WALL = 0.5;

/** Chiều dài và điểm giữa của một tường, đọc bằng hàm của domain. */
export function measureWall(
  graph: NormalizedSpatial | null,
  wallId: string,
): WallGeometryMeasureReading | null {
  const target = readWallTarget(graph, wallId);

  if (target === null) {
    return null;
  }

  try {
    const solid = toSolidWall(target.wall, target.level);
    const midpoint = placeOnWall(solid, HALFWAY_ALONG_WALL);

    return {
      wallId: target.wall.id,
      lengthMm: centrelineLength(solid),
      midpointMm: { xMm: midpoint.x, yMm: midpoint.y },
    };
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Bắt điểm — ba loại, mỗi loại một nhãn gọi tên nó.                           */
/* -------------------------------------------------------------------------- */

/** Nhãn của ba loại bắt điểm, khoá theo mã của `KNOWN_SNAP_KIND_IDS`. */
export const WALL_GEOMETRY_SNAP_LABELS: Readonly<Record<string, string>> = Object.freeze({
  [KNOWN_SNAP_KIND_IDS.otherVertex]: TEXT.snap.otherVertex,
  [KNOWN_SNAP_KIND_IDS.perpendicular]: TEXT.snap.perpendicular,
  [KNOWN_SNAP_KIND_IDS.axis]: TEXT.snap.axis('lưới'),
});

/**
 * Ba loại bắt điểm màn này nối được, theo đúng thứ tự `SNAP_PRIORITY` của
 * domain — hook lấy phần tử đầu tiên làm chỗ tay nắm lắng xuống.
 */
export const WALL_GEOMETRY_SNAP_KIND_IDS: readonly SnapKindId[] = Object.freeze([
  KNOWN_SNAP_KIND_IDS.otherVertex,
  KNOWN_SNAP_KIND_IDS.perpendicular,
  KNOWN_SNAP_KIND_IDS.axis,
]);

/** Mọi đầu mút của các tường KHÁC, làm mồi bắt điểm loại "đỉnh khác". */
function vertexTargetsOf(solids: readonly SolidWall[], wallId: string): readonly SnapTarget[] {
  const targets: SnapTarget[] = [];

  for (const solid of solids) {
    if (String(solid.id) === wallId) {
      continue;
    }

    for (const end of ['start', 'end'] as const) {
      targets.push({
        kind: 'wallVertex',
        id: vertexIdOf(String(solid.id), end),
        position: solid.centreline[end],
      });
    }
  }

  return targets;
}

/** Tim của các tường KHÁC, làm mồi bắt điểm loại "vuông góc". */
function perpendicularTargetsOf(
  solids: readonly SolidWall[],
  wallId: string,
): readonly SnapTarget[] {
  const targets: SnapTarget[] = [];

  for (const solid of solids) {
    if (String(solid.id) === wallId) {
      continue;
    }

    targets.push({
      kind: 'perpendicular',
      id: String(solid.id),
      segment: { start: solid.centreline.start, end: solid.centreline.end },
    });
  }

  return targets;
}

/* -------------------------------------------------------------------------- */
/* Đường ghi — `dispatch` chạy qua `commit`.                                   */
/* -------------------------------------------------------------------------- */

/** Ngữ cảnh mà các hàm dựng lệnh của tầng nghiệp vụ đọc. */
export const commandContextOf = (
  graph: NormalizedSpatial,
  actorId: string,
): CommandContext => ({ graph, actorId });

/**
 * `SpatialPort` ghi bằng `commit`, đường ghi duy nhất A10 cho phép: không đường
 * nào ở đây chạm hàm ghi thẳng của kho hay bộ áp vá riêng của nó.
 *
 * Nhãn của lượt ghi là mô tả của chính lệnh, nên nút hoàn tác và nhật ký hoạt
 * động đọc cùng một câu.
 */
export function createCommitSpatialPort(
  graph: WallGeometryGraphPort,
  labelOf: () => string,
): SpatialPort {
  return {
    read: () => graph.read(),
    applyPatches: (patches) => {
      commit(patches, labelOf());
    },
  };
}

/** Bộ phụ thuộc năm bước của `dispatch`, gắn với ngăn xếp hoàn tác của tầng lệnh. */
export interface WallGeometryDispatchBundle {
  readonly deps: DispatchDeps;
  readonly history: HistoryStack;
  readonly setLabel: (label: string) => void;
}

export interface CreateWallGeometryDispatchOptions {
  readonly graph: WallGeometryGraphPort;
  readonly selection: () => SelectionSnapshot;
  readonly history?: HistoryStack | undefined;
}

/**
 * Dựng `DispatchDeps` đủ năm cổng.
 *
 * `sync` không làm gì: màn này chưa có endpoint nào nhận hình học tường (cùng
 * sự thật `persistWallLayer` của S-12), và tự lưu của A7 theo dõi `state.spatial`
 * mà `commit` vừa ghi vào — nên một lượt xếp hàng đồng bộ ở đây sẽ là một lời
 * hứa không có ai giữ.
 */
export function createWallGeometryDispatchDeps(
  options: CreateWallGeometryDispatchOptions,
): WallGeometryDispatchBundle {
  const history = options.history ?? createHistoryStack();
  let label = '';

  const deps: DispatchDeps = {
    spatial: createCommitSpatialPort(options.graph, () => label),
    history: {
      push: (entry) => {
        const selection = options.selection();

        history.push({ entry, selectionBefore: selection, selectionAfter: selection });
      },
      drop: (entryId) => {
        history.drop(entryId);
      },
    },
    rules: createIncrementalRuleRunner(),
    sync: {
      enqueue: () => {
        /* Chưa có đường lưu hình học tường lên máy chủ; xem docblock ở trên. */
      },
    },
  };

  return {
    deps,
    history,
    setLabel: (next) => {
      label = next;
    },
  };
}

/** Câu từ chối, ghép từ những lý do tầng dưới đưa lên. Không bao giờ rỗng. */
function refusalOf(
  reasons: readonly string[],
  fallback: string,
  offendingEdgeIds: readonly string[] = [],
): WallGeometryRefusal {
  const explanation = reasons.filter((reason) => reason.trim() !== '').join(' ');

  return { explanation: explanation === '' ? fallback : explanation, offendingEdgeIds };
}

/** Một lượt ghi bị từ chối, đóng gói đúng hình dạng kết quả của cổng. */
const refused = <TValue,>(refusal: WallGeometryRefusal): WallGeometryEditorResult<TValue> => ({
  ok: false,
  refusal,
});

/** Chạy một lệnh đã dựng xong qua đủ năm bước của `dispatch`. */
async function runCommand(
  built: CommandResult,
  bundle: WallGeometryDispatchBundle,
): Promise<WallGeometryEditorResult<null>> {
  if (!built.ok) {
    return refused(refusalOf(built.error.reasons, TEXT.refusal.serverRejected(built.error.type)));
  }

  bundle.setLabel(built.data.description);

  const result: DispatchResult = await dispatch(built.data, bundle.deps);

  if (!result.ok) {
    return refused(
      refusalOf(result.error.reasons, TEXT.refusal.serverRejected(result.error.stage)),
    );
  }

  return { ok: true, data: null };
}

/* -------------------------------------------------------------------------- */
/* Cổng thật.                                                                  */
/* -------------------------------------------------------------------------- */

/** Vùng chọn hiện tại của kho, cho `HistoryStack` khôi phục lại sau một lượt hoàn tác. */
const storeSelection = (): SelectionSnapshot => ({
  selectedIds: useStore.getState().selectedIds,
});

/**
 * Cổng thật — đọc kho, ghi qua tầng lệnh.
 *
 * Mọi phương thức ghi đi theo cùng một đường: đọc đồ thị → dựng lệnh bằng hàm
 * CÓ SẴN của `wallCommands.ts` → `dispatch` năm bước → đọc lại ảnh chụp. Không
 * hàm nào ở đây tự tính hình học, và không hàm nào tự viết câu từ chối: câu
 * tiếng Việt tới từ `validate*` của tầng nghiệp vụ.
 */
export function createWallGeometryEditorGateway(
  options: CreateWallGeometryEditorGatewayOptions = {},
): WallGeometryEditorGateway {
  const graphPort: WallGeometryGraphPort = options.graph ?? {
    read: () => useStore.getState().spatial,
  };
  const actorId = options.actorId ?? WALL_GEOMETRY_EDITOR_ACTOR_ID;
  const bundle = createWallGeometryDispatchDeps({
    graph: graphPort,
    selection: options.selection ?? storeSelection,
    ...(options.history === undefined ? {} : { history: options.history }),
  });

  /** Đồ thị và bức tường đang sửa, hoặc câu "chưa có nơi để lưu". */
  const targetOf = (
    wallId: string,
  ):
    | { readonly ok: true; readonly graph: NormalizedSpatial; readonly target: WallGeometryTarget }
    | { readonly ok: false; readonly refusal: WallGeometryRefusal } => {
    const graph = graphPort.read();
    const target = readWallTarget(graph, wallId);

    if (graph === null || target === null) {
      return { ok: false, refusal: { explanation: TEXT.refusal.noSaveTarget, offendingEdgeIds: [] } };
    }

    return { ok: true, graph, target };
  };

  /** Ảnh chụp của bức tường sau một lượt ghi thành công. */
  const snapshotAfter = (wallId: string): WallGeometryEditorResult<WallGeometrySnapshot> => {
    const after = targetOf(wallId);

    return after.ok
      ? { ok: true, data: snapshotOf(after.graph, after.target) }
      : refused(after.refusal);
  };

  return {
    supports: {
      readWallGeometry: true,
      /* Không tầng nào giữ hình học gốc — xem quyết định phạm vi #1 ở đầu file. */
      readOriginalTrace: false,
      findSnapCandidates: true,
      moveVertex: true,
      insertVertex: true,
      removeVertex: true,
      splitWall: true,
      joinWalls: true,
      changeHeight: true,
      closeGap: true,
    },

    actorId,

    readWallGeometry: (wallId) => {
      const graph = graphPort.read();
      const target = readWallTarget(graph, wallId);

      return Promise.resolve(
        graph === null || target === null ? null : snapshotOf(graph, target),
      );
    },

    readOriginalTrace: () => Promise.resolve(null),

    findSnapCandidates: (query) => {
      const graph = graphPort.read();
      const target = readWallTarget(graph, query.wallId);

      if (graph === null || target === null) {
        return [];
      }

      const solids = solidWallsOnLevel(graph, target.level.id);
      const point = toPointMm(toGraphPoint(query.atMm));
      const radiusMm = query.radiusPx * query.millimetresPerPixel;

      if (!Number.isFinite(radiusMm) || radiusMm <= 0) {
        return [];
      }

      const captureRadiusMm = millimetres(radiusMm);
      const candidates: WallGeometrySnapCandidate[] = [];

      const vertexHit = snapToTargets(point, vertexTargetsOf(solids, query.wallId), {
        captureRadiusMm,
        gridEnabled: false,
      });

      if (vertexHit.snapped) {
        candidates.push(candidateOf(KNOWN_SNAP_KIND_IDS.otherVertex, vertexHit.point, query.atMm));
      }

      const perpendicularHit = snapToTargets(
        point,
        perpendicularTargetsOf(solids, query.wallId),
        { captureRadiusMm, gridEnabled: false },
      );

      if (perpendicularHit.snapped) {
        candidates.push(
          candidateOf(KNOWN_SNAP_KIND_IDS.perpendicular, perpendicularHit.point, query.atMm),
        );
      }

      const gridHit = snapToTargets(point, [], {
        captureRadiusMm,
        gridEnabled: true,
        gridStepMm: SNAP_THRESHOLDS.gridStepMm,
      });

      if (gridHit.snapped) {
        candidates.push(candidateOf(KNOWN_SNAP_KIND_IDS.axis, gridHit.point, query.atMm));
      }

      return candidates;
    },

    previewVertexMove: (input) => {
      const graph = graphPort.read();
      const target = readWallTarget(graph, input.wallId);
      const end = wallEndOfVertexId(input.vertexId);

      if (target === null || end === null) {
        return;
      }

      const moved = toGraphPoint(input.toMm);
      const centreline =
        end === 'start'
          ? { ...target.wall.centreline, start: moved }
          : { ...target.wall.centreline, end: moved };

      previewEdit(target.wall.id, { ...target.wall, centreline });
    },

    discardVertexPreview: () => {
      discardPreview();
    },

    commitVertexMove: async (input) => {
      const found = targetOf(input.wallId);

      if (!found.ok) {
        return refused(found.refusal);
      }

      const end = wallEndOfVertexId(input.vertexId);

      if (end === null) {
        return refused({ explanation: TEXT.refusal.vertexFloor, offendingEdgeIds: [] });
      }

      const run = await runCommand(
        createDragWallEndCommand(
          { wallId: found.target.wall.id, end, to: toGraphPoint(input.toMm) },
          commandContextOf(found.graph, actorId),
        ),
        bundle,
      );

      return run.ok ? snapshotAfter(input.wallId) : refused(run.refusal);
    },

    insertVertex: async (input) => {
      const found = targetOf(input.wallId);

      if (!found.ok) {
        return refused(found.refusal);
      }

      const run = await runCommand(
        createSplitWallCommand(
          {
            wallId: found.target.wall.id,
            at: toGraphPoint(input.atMm),
            secondWallId: createId('wall'),
          },
          commandContextOf(found.graph, actorId),
        ),
        bundle,
      );

      return run.ok ? snapshotAfter(input.wallId) : refused(run.refusal);
    },

    removeVertex: async (input) => {
      const found = targetOf(input.wallId);

      if (!found.ok) {
        return refused(found.refusal);
      }

      const end = wallEndOfVertexId(input.vertexId);

      if (end === null) {
        return refused({ explanation: TEXT.refusal.vertexFloor, offendingEdgeIds: [] });
      }

      const partner = jointPartnerOf(found.graph, found.target, end);

      if (partner === null) {
        return refused({
          explanation: TEXT.refusal.vertexFloor,
          offendingEdgeIds: [edgeIdOf(found.target.wall.id)],
        });
      }

      if (partner.otherWallId === null) {
        return refused({
          explanation: TEXT.refusal.joinNeedsTwoEnds,
          offendingEdgeIds: [edgeIdOf(found.target.wall.id)],
        });
      }

      const run = await runCommand(
        createMergeWallsCommand(
          { wallId: found.target.wall.id, otherWallId: partner.otherWallId },
          commandContextOf(found.graph, actorId),
        ),
        bundle,
      );

      return run.ok ? snapshotAfter(input.wallId) : refused(run.refusal);
    },

    splitWall: async (input) => {
      const found = targetOf(input.wallId);

      if (!found.ok) {
        return refused(found.refusal);
      }

      const secondWallId = createId('wall');
      const run = await runCommand(
        createSplitWallCommand(
          { wallId: found.target.wall.id, at: toGraphPoint(input.atMm), secondWallId },
          commandContextOf(found.graph, actorId),
        ),
        bundle,
      );

      return run.ok
        ? { ok: true, data: [found.target.wall.id, secondWallId] as const }
        : refused(run.refusal);
    },

    joinWalls: async (input) => {
      const [firstId, secondId] = input.wallIds;
      const found = targetOf(firstId);
      const other = targetOf(secondId);

      if (!found.ok) {
        return refused(found.refusal);
      }

      if (!other.ok) {
        return refused(other.refusal);
      }

      const run = await runCommand(
        createMergeWallsCommand(
          { wallId: found.target.wall.id, otherWallId: other.target.wall.id },
          commandContextOf(found.graph, actorId),
        ),
        bundle,
      );

      if (!run.ok) {
        return refused(run.refusal);
      }

      /* Tường DÀI HƠN giữ mã; đọc lại đồ thị để biết mã nào còn đứng đó. */
      const kept = targetOf(firstId).ok ? firstId : secondId;

      return { ok: true, data: kept };
    },

    changeHeight: async (input) => {
      const snapshots: WallGeometrySnapshot[] = [];

      for (const wallId of input.wallIds) {
        const found = targetOf(wallId);

        if (!found.ok) {
          return refused(found.refusal);
        }

        const run = await runCommand(
          createChangeWallHeightCommand(
            { wallId: found.target.wall.id, heightMm: input.heightMm },
            commandContextOf(found.graph, actorId),
          ),
          bundle,
        );

        if (!run.ok) {
          return refused(run.refusal);
        }

        const after = snapshotAfter(wallId);

        if (!after.ok) {
          return refused(after.refusal);
        }

        snapshots.push(after.data);
      }

      return { ok: true, data: snapshots };
    },

    closeGap: async (input) => {
      const found = targetOf(input.wallId);

      if (!found.ok) {
        return refused(found.refusal);
      }

      const gap = readGap(found.graph, found.target);

      if (gap === null) {
        return refused({
          explanation: TEXT.refusal.splitOffWall,
          offendingEdgeIds: [edgeIdOf(found.target.wall.id)],
        });
      }

      const run = await runCommand(
        createDragWallEndCommand(
          { wallId: found.target.wall.id, end: gap.end, to: toGraphPoint(gap.toMm) },
          commandContextOf(found.graph, actorId),
        ),
        bundle,
      );

      return run.ok ? snapshotAfter(input.wallId) : refused(run.refusal);
    },
  };
}

/** Một chỗ bắt được, đã mang đúng nhãn gọi tên loại của nó. */
function candidateOf(
  kindId: SnapKindId,
  at: { readonly x: number; readonly y: number },
  fromMm: WallGeometryPointMm,
): WallGeometrySnapCandidate {
  return {
    kindId,
    label: WALL_GEOMETRY_SNAP_LABELS[kindId] ?? kindId,
    atMm: { xMm: at.x, yMm: at.y },
    fromMm,
  };
}

/** Nút nối tại một đầu mút, và bức tường kia của nút ấy nếu nút có đúng hai đầu. */
function jointPartnerOf(
  graph: NormalizedSpatial,
  target: WallGeometryTarget,
  end: WallEnd,
): { readonly otherWallId: WallId | null } | null {
  const solids = solidWallsOnLevel(graph, target.level.id);
  const joint = resolveJoints(solids).joints.find((candidate) =>
    candidate.members.some(
      (member) => member.wallId === target.wall.id && member.end === end,
    ),
  );

  if (joint === undefined) {
    return null;
  }

  const others = joint.members.filter((member) => member.wallId !== target.wall.id);
  const only = others.length === 1 ? others[0] : undefined;

  return { otherWallId: only?.wallId ?? null };
}
