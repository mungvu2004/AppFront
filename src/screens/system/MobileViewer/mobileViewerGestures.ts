/**
 * Bộ nhận cử chỉ chạm của màn `/m/du-an/:projectId` — đọc ngón tay, KHÔNG lái camera.
 *
 * ## Vì sao file này tồn tại
 *
 * Khảo sát đã đo và ghi lại: `src/lib/three/camera` **không gắn một listener
 * nào** — không `pointerdown`, không `touchstart`, không `wheel`. Người gọi duy
 * nhất trên máy tính (`useViewerShell.ts:735-788`) tự nghe sự kiện rồi gọi vào
 * camera, và nó chỉ đọc **một** con trỏ cộng `wheel`. Không có
 * `createTouchCameraController` nào để tái dùng, và trong cả `src/` không file
 * nào giữ một `Map<pointerId, …>` để nhận diện đa chạm.
 *
 * Phần MỚI vì thế hẹp đúng một việc: **đọc nhiều ngón cùng lúc rồi phát ra một
 * {@link MobileViewerGesture}**. Ai làm gì với cử chỉ ấy là chuyện của
 * `mobileViewerScene.ts`.
 *
 * ## Ranh giới tuyệt đối: ở đây KHÔNG có một phép toán camera nào
 *
 * Không ma trận, không góc, không lượng giác, không khoảng cách thế giới. Toàn
 * bộ số học trong file là hai phép đo **trên mặt kính**: khoảng cách pixel giữa
 * hai ngón, và điểm giữa của chúng. Cả hai đều là số đo màn hình, đúng thứ mà
 * `OrbitCameraMode.rotate/pan/dolly` nhận vào — ba hàm ấy tự lo giảm chấn, giới
 * hạn và quy đổi ra mét, nên viết lại một dòng của chúng ở đây là đi sai đường.
 *
 * Đó cũng là lý do cử chỉ thu phóng phát ra `scale` — **tỉ lệ khoảng cách hai
 * ngón**, một số không đơn vị — chứ không phát ra `notches`: một "nấc" là đơn vị
 * của camera (`CAMERA_SETTINGS.orbit.zoomFactorPerNotch`), và biết về nó là biết
 * một phép toán camera. Phép đổi `scale` → `notches` nằm cạnh lời gọi `dolly()`
 * trong `mobileViewerScene.ts`.
 *
 * ## Pointer Events, không phải Touch Events
 *
 * Cùng bốn sự kiện mà `viewer3dScene.ts:780-795` đã dùng — repo không có một
 * `touchstart` nào và không thêm cái đầu tiên ở đây. Khác một điểm: mỗi sự kiện
 * mang theo `pointerId`, và file này giữ nó, vì đó là thứ duy nhất phân biệt
 * được ngón thứ nhất với ngón thứ hai.
 *
 * ## Ngưỡng chạm-nhả đọc từ R-09, không viết lại
 *
 * "Chạm rồi nhả mà không đi quá ngưỡng" dùng đúng `CLICK_SLOP_PX` của
 * `raycast.ts` — cùng con số mà bộ chọn vật trên máy tính dùng để phân biệt một
 * cú nhấp với một cú kéo. Hai ngưỡng khác nhau cho cùng một câu hỏi là hai
 * ngưỡng sẽ lệch nhau.
 */

import { CLICK_SLOP_PX } from '@/lib/three/interaction/raycast';

import type { MobileViewerGesture } from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* Số ngón — đếm, không phải đo.                                               */
/* -------------------------------------------------------------------------- */

/** Một ngón đang chạm: xoay quanh mô hình. */
const ORBIT_TOUCH_COUNT = 1;

/** Hai ngón đang chạm: thu phóng và kéo dịch. */
const PINCH_TOUCH_COUNT = 2;

/* -------------------------------------------------------------------------- */
/* Kiểu công khai.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Một ngón tay tại một thời điểm, đã quy về toạ độ trong canvas.
 *
 * Không phải `PointerEvent`: bộ đọc phải test được mà không dựng một sự kiện DOM
 * nào, đúng lý do `PointerInput` của `raycast.ts` cũng chỉ là một cặp số.
 */
export interface MobileViewerPointer {
  readonly pointerId: number;
  readonly xPx: number;
  readonly yPx: number;
}

/** Tuỳ chọn của bộ đọc. */
export interface MobileViewerGestureOptions {
  /** Một cử chỉ vừa đọc xong. Gọi đồng bộ, ngay trong lượt xử lý sự kiện. */
  readonly onGesture: (gesture: MobileViewerGesture) => void;
  /**
   * Ngưỡng phân biệt chạm-nhả với kéo, px. Vắng mặt thì lấy `CLICK_SLOP_PX` của
   * R-09 — trường này chỉ để bài kiểm nói to ngưỡng nó đang thử.
   */
  readonly clickSlopPx?: number | undefined;
}

/** Bộ đọc: nhận bốn sự kiện con trỏ, phát ra cử chỉ. */
export interface MobileViewerGestureReader {
  readonly pointerDown: (pointer: MobileViewerPointer) => void;
  readonly pointerMove: (pointer: MobileViewerPointer) => void;
  readonly pointerUp: (pointer: MobileViewerPointer) => void;
  readonly pointerCancel: (pointer: MobileViewerPointer) => void;
  /** Số ngón đang chạm. Bài kiểm và cảnh đọc nó để biết lượt chạm đã hết chưa. */
  readonly activeCount: () => number;
  /** Quên mọi ngón đang giữ. Dùng khi cảnh bị gỡ giữa một cử chỉ. */
  readonly reset: () => void;
}

/* -------------------------------------------------------------------------- */
/* Nội bộ.                                                                     */
/* -------------------------------------------------------------------------- */

/** Một điểm trên mặt kính. */
interface PointPx {
  readonly x: number;
  readonly y: number;
}

/** Khoảng cách giữa hai điểm CHẠM, tính bằng pixel màn hình. */
function spanBetween(first: PointPx, second: PointPx): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/** Điểm giữa hai ngón, tính bằng pixel màn hình. */
function centreBetween(first: PointPx, second: PointPx): PointPx {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

/* -------------------------------------------------------------------------- */
/* Bộ đọc.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dựng một bộ đọc cử chỉ.
 *
 * Bốn cử chỉ, và luật quyết định giữa chúng là **số ngón đang chạm**:
 *
 * | Đang chạm | Việc | Phát ra |
 * |---|---|---|
 * | 1 ngón | đi quá ngưỡng chạm-nhả rồi di chuyển | `orbit` |
 * | 1 ngón | đặt xuống rồi nhấc lên trong ngưỡng | `tap` |
 * | 2 ngón | khoảng cách hai ngón đổi | `zoom` |
 * | 2 ngón | điểm giữa hai ngón dịch | `pan` |
 * | ≥3 ngón | — | không gì cả |
 *
 * Một lượt kéo hai ngón phát cả `zoom` lẫn `pan` trong cùng một sự kiện khi cả
 * hai đại lượng cùng đổi, và đó là đúng: bóp vào trong lúc trượt là một cử chỉ
 * người ta làm thật, không phải hai cử chỉ phải chọn một.
 *
 * Ngón thứ hai đặt xuống **huỷ** ứng viên chạm-nhả: nhấc hai ngón khỏi màn hình
 * không bao giờ là một cú chạm chọn vật.
 */
export function createMobileViewerGestureReader(
  options: MobileViewerGestureOptions,
): MobileViewerGestureReader {
  const slopPx = options.clickSlopPx ?? CLICK_SLOP_PX;

  /** Ngón đang chạm, theo `pointerId`, ở vị trí đọc được gần nhất. */
  const points = new Map<number, PointPx>();

  /**
   * Chỗ ngón đầu tiên đặt xuống, khi lượt chạm này còn có thể là một cú chạm-nhả.
   * `null` ngay khi ngón đi quá ngưỡng, hoặc khi ngón thứ hai chạm vào.
   */
  let tapOrigin: PointPx | null = null;

  /** Khoảng cách hai ngón ở lần đọc trước; 0 khi chưa đủ hai ngón. */
  let spanPx = 0;

  /** Điểm giữa hai ngón ở lần đọc trước; `null` khi chưa đủ hai ngón. */
  let centre: PointPx | null = null;

  /** Hai ngón đầu tiên đang chạm, theo đúng thứ tự chúng đặt xuống. */
  const twoPoints = (): readonly [PointPx, PointPx] | null => {
    const held = [...points.values()];
    const first = held[0];
    const second = held[1];

    return first === undefined || second === undefined ? null : [first, second];
  };

  /**
   * Ghi lại khoảng cách và điểm giữa để lần đọc sau có mốc mà so.
   *
   * Gọi mỗi khi TẬP ngón đổi — thêm một ngón, bớt một ngón — chứ không phải mỗi
   * khi ngón di chuyển: mốc phải chụp lại đúng lúc tập đổi, nếu không thì ngón
   * thứ ba nhấc lên sẽ đọc thành một cú bóp rất mạnh.
   */
  const remember = (): void => {
    const pair = points.size === PINCH_TOUCH_COUNT ? twoPoints() : null;

    if (pair === null) {
      spanPx = 0;
      centre = null;
      return;
    }

    spanPx = spanBetween(pair[0], pair[1]);
    centre = centreBetween(pair[0], pair[1]);
  };

  const readOneFinger = (previous: PointPx, next: PointPx): void => {
    // Còn trong ngưỡng thì chưa có gì xảy ra: đây vẫn có thể là một cú chạm.
    if (tapOrigin !== null && spanBetween(tapOrigin, next) <= slopPx) {
      return;
    }

    tapOrigin = null;
    options.onGesture({
      kind: 'orbit',
      deltaXPx: next.x - previous.x,
      deltaYPx: next.y - previous.y,
    });
  };

  const readTwoFingers = (): void => {
    const pair = twoPoints();
    if (pair === null) {
      return;
    }

    const nextSpanPx = spanBetween(pair[0], pair[1]);
    const nextCentre = centreBetween(pair[0], pair[1]);

    // Tỉ lệ, không phải hiệu: bóp từ 200px xuống 100px và từ 100px xuống 50px là
    // cùng một lượng thu phóng đối với người dùng, và `dolly` nhân khoảng cách
    // chứ không trừ nó — nên tỉ lệ là đại lượng đi thẳng vào nó mà không giật cấp.
    if (spanPx > 0 && nextSpanPx > 0 && nextSpanPx !== spanPx) {
      options.onGesture({ kind: 'zoom', scale: nextSpanPx / spanPx });
    }

    if (centre !== null && (nextCentre.x !== centre.x || nextCentre.y !== centre.y)) {
      options.onGesture({
        kind: 'pan',
        deltaXPx: nextCentre.x - centre.x,
        deltaYPx: nextCentre.y - centre.y,
      });
    }

    spanPx = nextSpanPx;
    centre = nextCentre;
  };

  /** Ngón rời màn hình, dù là nhấc lên hay bị hệ điều hành thu mất. */
  const release = (pointer: MobileViewerPointer, isTapAllowed: boolean): void => {
    const held = points.delete(pointer.pointerId);
    const origin = tapOrigin;

    tapOrigin = null;
    remember();

    if (!held || !isTapAllowed || origin === null || points.size > 0) {
      return;
    }

    options.onGesture({ kind: 'tap', xPx: pointer.xPx, yPx: pointer.yPx });
  };

  return {
    pointerDown: (pointer) => {
      points.set(pointer.pointerId, { x: pointer.xPx, y: pointer.yPx });
      // Ngón thứ hai huỷ cú chạm: nhấc hai ngón ra không phải là chọn vật.
      tapOrigin =
        points.size === ORBIT_TOUCH_COUNT ? { x: pointer.xPx, y: pointer.yPx } : null;
      remember();
    },

    pointerMove: (pointer) => {
      const previous = points.get(pointer.pointerId);
      // Con trỏ chưa đặt xuống trên canvas này — chuột đi ngang qua, chẳng hạn.
      if (previous === undefined) {
        return;
      }

      const next: PointPx = { x: pointer.xPx, y: pointer.yPx };
      points.set(pointer.pointerId, next);

      if (points.size === ORBIT_TOUCH_COUNT) {
        readOneFinger(previous, next);
        return;
      }

      // Ba ngón trở lên không có cử chỉ nào: vẫn theo dõi vị trí để lúc rút về
      // hai ngón thì mốc đã đúng, nhưng không phát ra gì.
      if (points.size === PINCH_TOUCH_COUNT) {
        readTwoFingers();
      }
    },

    pointerUp: (pointer) => {
      release(pointer, true);
    },

    // Cử chỉ bị thu mất — cuộn trang, gọi đến, thanh thông báo kéo xuống — không
    // phải một cú chạm chọn vật. Người dùng không hề nhả ngón ra một cách có ý.
    pointerCancel: (pointer) => {
      release(pointer, false);
    },

    activeCount: () => points.size,

    reset: () => {
      points.clear();
      tapOrigin = null;
      spanPx = 0;
      centre = null;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Nối vào DOM.                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Gắn bộ đọc lên một canvas và trả về hàm gỡ.
 *
 * Cùng khuôn `viewer3dScene.ts:780-795`: toạ độ quy về gốc canvas bằng
 * `getBoundingClientRect()`, và mỗi listener gắn vào đều có đúng một dòng gỡ.
 *
 * `touchAction` bị đặt về `none` trong lúc gắn và trả lại nguyên trạng lúc gỡ.
 * Đây **không** phải một quyết định bố cục lấn sang phần của view: không có nó
 * thì trình duyệt tự cuộn và tự thu phóng trang khi thấy hai ngón, rồi bắn
 * `pointercancel` — nghĩa là cử chỉ thu phóng của màn này không bao giờ chạy
 * được. Nó là điều kiện để sự kiện tới nơi, không phải kiểu dáng.
 *
 * @returns hàm gỡ; gọi hai lần không sao, `removeEventListener` với một listener
 * chưa gắn là một lệnh rỗng.
 */
export function attachMobileViewerGestures(
  canvas: HTMLElement,
  options: MobileViewerGestureOptions,
): () => void {
  const reader = createMobileViewerGestureReader(options);
  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  const toPointer = (event: PointerEvent): MobileViewerPointer => {
    const rect = canvas.getBoundingClientRect();

    return {
      pointerId: event.pointerId,
      xPx: event.clientX - rect.left,
      yPx: event.clientY - rect.top,
    };
  };

  const onPointerDown = (event: PointerEvent): void => {
    reader.pointerDown(toPointer(event));
  };
  const onPointerMove = (event: PointerEvent): void => {
    reader.pointerMove(toPointer(event));
  };
  const onPointerUp = (event: PointerEvent): void => {
    reader.pointerUp(toPointer(event));
  };
  const onPointerCancel = (event: PointerEvent): void => {
    reader.pointerCancel(toPointer(event));
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerCancel);
    canvas.style.touchAction = previousTouchAction;
    reader.reset();
  };
}
