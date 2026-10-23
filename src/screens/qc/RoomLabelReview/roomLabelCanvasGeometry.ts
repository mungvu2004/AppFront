/**
 * Hình học và hằng số dựng hình của canvas màn "Duyệt tên phòng" — file `.ts`
 * thuần, không một thẻ JSX nào, tách khỏi `RoomLabelCanvas.tsx` khi file đó
 * chạm trần 400 dòng của R-22 (đúng khuôn `wallLayerHatch.ts`/
 * `objectLayerSymbols.ts` của hai màn anh em).
 *
 * ## Vì sao canvas này TỰ quy đổi mm → px, khác hai canvas anh em
 *
 * `WallLayerCanvasViewProps`/`ObjectLayerCanvasViewProps` nhận toạ độ đã tính
 * sẵn ra PIXEL — hook của họ làm việc đó. `RoomLabelCanvasProps` (đóng băng,
 * T4) thì khác: {@link RoomLabelViewModel.outlineMm} và `.labelAnchorMm` giữ
 * NGUYÊN đơn vị milimét (đúng tên trường), và prop duy nhất canvas có để quy
 * đổi là `millimetresPerPixel` — không có `drawingSizePx`/`contentBoundsPx`
 * nào được cấp sẵn. Vì vậy phép chia `mm / millimetresPerPixel` ở
 * {@link mmToPx} là việc BẮT BUỘC của canvas này, không phải một lối tắt hình
 * học bị cấm: nó không tính diện tích, không tính giao điểm, không tính pháp
 * tuyến — chỉ đổi đơn vị một toạ độ đã có sẵn để `<svg>` vẽ được. Luật
 * `local/no-raw-number` (chỉ bắt chia cho HẰNG SỐ đơn vị dạng
 * `_PER_`/luỹ thừa 10) không bắt cách chia này, đúng như docstring của rule đó
 * ghi: "Plain view arithmetic … is left alone".
 *
 * Việc còn lại — gộp các đa giác phòng thành một hộp bao ({@link
 * computeContentBoundsPx}) để đặt `viewBox` — cũng KHÔNG phải hình học nghiệp
 * vụ: nó là kỹ thuật dựng hình SVG thuần tuý (min/max toạ độ), tương đương
 * `object-fit: contain` viết tay, không đụng tới một quy tắc không gian nào
 * của `src/domain`.
 */

import type {
  RoomLabelCanvasProps,
  RoomLabelViewModel,
} from './roomLabelTypes';

/** Mã một phòng, đọc lại từ chính hợp đồng props — không một dòng nhập nào trỏ vào `src/domain`. */
export type RoomLabelRoomId = NonNullable<RoomLabelCanvasProps['selectedRoomId']>;

/** Một điểm phẳng, đơn vị PIXEL bản vẽ — kết quả của {@link mmToPx}. */
export interface RoomLabelPointPx {
  readonly x: number;
  readonly y: number;
}

/** Hộp bao trục thẳng, đơn vị pixel. */
export interface RoomLabelBoundsPx {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/* -------------------------------------------------------------------------- */
/* Quy đổi mm → px và chuỗi điểm SVG.                                          */
/* -------------------------------------------------------------------------- */

/** Một milimét của bản vẽ, ra pixel — theo đúng tỷ lệ `millimetresPerPixel` của tầng. */
export function mmToPx(valueMm: number, millimetresPerPixel: number): number {
  return valueMm / millimetresPerPixel;
}

/** Một điểm `{x, y}` tính bằng mm, ra điểm tính bằng px. */
export function pointToPx(
  point: { readonly x: number; readonly y: number },
  millimetresPerPixel: number,
): RoomLabelPointPx {
  return { x: mmToPx(point.x, millimetresPerPixel), y: mmToPx(point.y, millimetresPerPixel) };
}

/** Đa giác đóng của một phòng, mm → px. */
export function roomOutlinePx(
  room: RoomLabelViewModel,
  millimetresPerPixel: number,
): readonly RoomLabelPointPx[] {
  return room.outlineMm.map((corner) => pointToPx(corner, millimetresPerPixel));
}

/** Chuỗi `points` cho thẻ `<polygon>`, nối bằng dấu cách — không một phép hình học nào thêm. */
export function svgPointsAttr(points: readonly RoomLabelPointPx[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

/* -------------------------------------------------------------------------- */
/* Hộp bao.                                                                    */
/* -------------------------------------------------------------------------- */

/** Đệm quanh hộp bao nội dung, để đa giác sát mép không bị viền khung nuốt mất. */
export const CONTENT_PADDING_PX = 48;

/** Đệm theo khung: khung hẹp thì đệm co lại, kẻo đệm nuốt hết chỗ vẽ (BUG-393). */
export function contentPaddingFor(frame: { readonly width: number; readonly height: number }): number {
  return frame.width > 0 && frame.height > 0
    ? Math.min(CONTENT_PADDING_PX, frame.width / 8, frame.height / 8)
    : CONTENT_PADDING_PX;
}

/** Hộp bao trục thẳng của MỘT phòng, đơn vị px — dùng cho `SelectionHalo` và nút bàn phím. */
export function computeRoomBoundsPx(
  room: RoomLabelViewModel,
  millimetresPerPixel: number,
): RoomLabelBoundsPx {
  const points = roomOutlinePx(room, millimetresPerPixel);

  return boundsOfPoints(points) ?? { x: 0, y: 0, width: 0, height: 0 };
}

/** Cỡ ảnh nền tính bằng mm; ảnh đặt ở gốc (0, 0) của hệ toạ độ mặt bằng. */
export type RoomLabelBackgroundSizeMm = { readonly widthMm: number; readonly heightMm: number } | null | undefined;

/**
 * Điểm (mm) mà khung phải ôm trọn: mọi góc phòng, cộng hai góc ảnh nền nếu biết
 * cỡ — QA-1: chỉ ôm phòng thì phần mặt bằng nằm ngoài các phòng bị khung cắt mất.
 */
function contentPointsMm(
  rooms: readonly RoomLabelViewModel[],
  backgroundSizeMm: RoomLabelBackgroundSizeMm,
): readonly RoomLabelPointPx[] {
  const roomPoints = rooms.flatMap((room) => room.outlineMm);

  return roomPoints.length === 0 || backgroundSizeMm == null
    ? roomPoints
    : [...roomPoints, { x: 0, y: 0 }, { x: backgroundSizeMm.widthMm, y: backgroundSizeMm.heightMm }];
}

/** Hộp bao của TOÀN BỘ nội dung (mọi phòng + ảnh nền), cộng đệm — dùng cho `viewBox`. `null` khi không có phòng. */
export function computeContentBoundsPx(
  rooms: readonly RoomLabelViewModel[],
  millimetresPerPixel: number,
  padding: number = CONTENT_PADDING_PX,
  backgroundSizeMm: RoomLabelBackgroundSizeMm = null,
): RoomLabelBoundsPx | null {
  const allPoints = contentPointsMm(rooms, backgroundSizeMm).map((point) => pointToPx(point, millimetresPerPixel));
  const bounds = boundsOfPoints(allPoints);

  if (bounds === null) {
    return null;
  }

  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

/**
 * BUG-393: tỷ lệ HIỂN THỊ (mm mỗi px màn) để toàn bộ mặt bằng — cộng đệm
 * {@link contentPaddingFor} — vừa khung `frame`. Tầng chưa hiệu chỉnh dùng 1 mm/px
 * nên một phòng 4 m đã rộng 4000 px, nằm ngoài khung. Chưa đo được khung (jsdom,
 * lần vẽ đầu) hay chưa có phòng thì giữ nguyên tỷ lệ bản vẽ.
 */
export function fitMillimetresPerPixel(
  rooms: readonly RoomLabelViewModel[],
  millimetresPerPixel: number,
  frame: { readonly width: number; readonly height: number },
  backgroundSizeMm: RoomLabelBackgroundSizeMm = null,
): number {
  const bounds = boundsOfPoints(contentPointsMm(rooms, backgroundSizeMm));
  const padding = contentPaddingFor(frame);
  const usableWidth = frame.width - padding * 2;
  const usableHeight = frame.height - padding * 2;

  if (bounds === null || usableWidth <= 0 || usableHeight <= 0) {
    return millimetresPerPixel;
  }

  const fitted = Math.max(bounds.width / usableWidth, bounds.height / usableHeight);

  return fitted > 0 ? fitted : millimetresPerPixel;
}

function boundsOfPoints(points: readonly RoomLabelPointPx[]): RoomLabelBoundsPx | null {
  if (points.length === 0) {
    return null;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Tâm của một hộp bao — dùng làm gốc phóng to 10% và đích dịch chuyển camera. */
export function centreOfBounds(bounds: RoomLabelBoundsPx): RoomLabelPointPx {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

/* -------------------------------------------------------------------------- */
/* Token màu — chuyển tên token thành chuỗi CSS `var(--…)`.                    */
/* -------------------------------------------------------------------------- */

/** `'--wall-330'` → `'var(--wall-330)'`. Không có mã hex/rgb/hsl nào ở đây (A1). */
export function cssVar(token: string): string {
  return `var(${token})`;
}

/* -------------------------------------------------------------------------- */
/* Hằng số dựng hình — mọi con số vẽ đều đặt tên ở đây, không rải trong JSX.   */
/* -------------------------------------------------------------------------- */

/** Tối thiểu 640 từ 1280px; dưới 1280 tối thiểu 60vh (như FIX-1506), dưới 1024 lấp vùng 360 px — BUG-317, BUG-404. */
export const ROOM_LABEL_CANVAS_FRAME_CLASSES =
  'relative h-full min-h-80 w-full overflow-hidden rounded-2xl border border-border-default bg-canvas-2d p-3 lg:min-h-[60vh] xl:min-h-[640px]';

/** Độ mờ ảnh nền bản vẽ gốc — cùng mức với `ObjectLayerCanvas` (đặc tả gốc). */
export { QC_BACKGROUND_OPACITY as BACKGROUND_IMAGE_OPACITY } from '../shared/qcBackground';

/** Viền mặc định của một đa giác phòng chưa chọn — chỉ để phân tách hai phòng cùng một băng màu. */
export const ROOM_STROKE_TOKEN = '--border-control';
export const ROOM_STROKE_WIDTH_PX = 1;

/** Viền của phòng đang chọn — đúng "2px màu --accent" của đặc tả (A2: màu nhấn chỉ cho thứ tương tác được). */
export const ROOM_SELECTED_STROKE_TOKEN = '--accent';
export const ROOM_SELECTED_STROKE_WIDTH_PX = 2;

/** Phòng đang chọn "nâng lên 10%": phóng to quanh tâm hộp bao của chính nó. */
export const ROOM_SELECTED_SCALE = 1.1;

/** Cỡ chữ hai dòng nhãn giữa phòng (px, SVG `font-size`, không phải class Tailwind). */
export const ROOM_LABEL_NAME_FONT_PX = 15;
export const ROOM_LABEL_AREA_FONT_PX = 13;
/** Cỡ chữ nhãn rút gọn khi phòng quá nhỏ để vừa nhãn hai dòng (xem `labelFits`). */
export const ROOM_LABEL_CODE_FONT_PX = 12;

/** Khoảng cách mỗi dòng lệch khỏi tâm nhãn theo trục dọc. */
export const ROOM_LABEL_LINE_OFFSET_PX = 9;

/** Màu chữ nhãn — MỘT token duy nhất cho mọi băng, xem ghi chú đo tương phản ở `RoomLabelCanvas.tsx`. */
export const ROOM_LABEL_TEXT_TOKEN = '--text-primary';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt của canvas. Bản sao khai báo nằm ở t6.i18n.fragment.json.  */
/* -------------------------------------------------------------------------- */

export const ROOM_LABEL_CANVAS_COPY = {
  canvasLabel: 'Mặt bằng duyệt tên phòng',
  waitingFrameLabel: 'Chưa có ảnh bản vẽ của tầng này',
  forbiddenNotice:
    'Bản vẽ vẫn xem được, nhưng không chọn được phòng nào ở đây. Nhờ người có quyền sửa dự án duyệt giúp.',
  unnamedPlaceholder: '(chưa đặt tên)',
  emptyCanvas: 'Chưa dò được phòng nào trên bản vẽ này.',
} as const;
