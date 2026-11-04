import { useSyncExternalStore } from 'react';

/**
 * "So sánh hai bên" của Tường và Cửa và nội thất: bên trái bản vẽ gốc, bên phải lớp đã nhận diện,
 * một khung nhìn chung. Bật/tắt bằng nút "So sánh" cạnh nút phóng (`QcZoomMenu`); Esc thoát sau khi đã bỏ chọn.
 * Nhớ trong phiên (sessionStorage) để chuyển bước Tường ↔ Cửa vẫn giữ; trình duyệt chặn kho thì chỉ nhớ trong module.
 */
const STORAGE_KEY = 'qc.compareSplit';

const read = (): boolean => {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

let compare = typeof window === 'undefined' ? false : read();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function setQcCompare(next: boolean): void {
  if (next === compare) return;
  compare = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* Kho bị chặn (chế độ riêng tư): vẫn đổi trong phiên này. */
  }
  for (const listener of listeners) listener();
}

/** Giá trị hiện tại, cho handler phím (không cần dựng lại). */
export const isQcCompare = (): boolean => compare;

export function useQcCompare(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => compare,
    () => compare,
  );
}

/* Thẻ có đường dẫn gấp khúc, dùng chung cho hai nửa: cùng khổ khung nên cùng một chỗ. */

interface PointPx {
  readonly x: number;
  readonly y: number;
}

/** Chữ mono 12 px rộng ~7,3 px một ký tự; cộng lề 16 và chấm màu 14. */
const TAG_CHAR_PX = 7.3;
const TAG_CHROME_PX = 30;
const TAG_HEIGHT_PX = 24;
/** Thẻ cách mép vật theo chiều dọc và cách neo theo chiều ngang. */
const TAG_RISE_PX = 36;
const TAG_SIDE_PX = 28;
/** Né nhãn "Bản vẽ gốc"/"Đã nhận diện" ở trên và cụm phóng ở dưới. */
const TAG_TOP_RESERVE_PX = 44;
const TAG_BOTTOM_RESERVE_PX = 52;
const TAG_EDGE_PX = 6;
/** Đường dẫn chạm mép thẻ, cách góc chừng này. */
const TAG_ATTACH_INSET_PX = 14;
/** Điểm chạm lệch neo ít nhất chừng này theo ngang: đường dẫn luôn có khúc gãy, kể cả khi thẻ nằm ngay trên neo. */
const TAG_MIN_RUN_PX = 28;
/** Khúc gãy: đi dốc gần thẳng đứng trước, rồi xiên sang thẻ (ảnh phác của người dùng). */
const ELBOW_ALONG_X = 0.2;
const ELBOW_ALONG_Y = 0.55;

export interface QcCompareTagSpot {
  readonly anchorPx: PointPx;
  /** Tâm thẻ. */
  readonly tagPx: PointPx;
  /** Khúc gãy rồi điểm chạm mép thẻ. */
  readonly leaderPx: readonly PointPx[];
}

const clampTo = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Chỗ đặt thẻ trong khung, pixel khung: thử trên phải (như ảnh phác) → trên trái → dưới phải → dưới trái,
 * kẹp trong khung, lấy chỗ đầu tiên không che `target`; hết chỗ thì chỗ che ít nhất.
 * `centre` (tâm vật) ra ngoài khung → `null`: không vẽ đường dẫn tới hư không.
 * Đường dẫn dừng ở mép vật phía thẻ, không chạy dọc trên vật.
 */
export function placeCompareTag(
  target: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  centre: PointPx,
  frame: { readonly width: number; readonly height: number },
  text: string,
): QcCompareTagSpot | null {
  if (centre.x < 0 || centre.y < 0 || centre.x > frame.width || centre.y > frame.height) {
    return null;
  }

  const halfW = (text.length * TAG_CHAR_PX + TAG_CHROME_PX) / 2;
  const halfH = TAG_HEIGHT_PX / 2;
  const overlapOf = (at: PointPx): number =>
    Math.max(0, Math.min(at.x + halfW, target.x + target.width) - Math.max(at.x - halfW, target.x)) *
    Math.max(0, Math.min(at.y + halfH, target.y + target.height) - Math.max(at.y - halfH, target.y));

  let tagPx: PointPx = centre;
  let bestOverlap = Number.POSITIVE_INFINITY;

  for (const [sideX, sideY] of [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const) {
    const at = {
      x: clampTo(centre.x + sideX * (TAG_SIDE_PX + halfW), TAG_EDGE_PX + halfW, frame.width - TAG_EDGE_PX - halfW),
      y: clampTo(
        sideY < 0 ? target.y - TAG_RISE_PX - halfH : target.y + target.height + TAG_RISE_PX + halfH,
        TAG_TOP_RESERVE_PX + halfH,
        frame.height - TAG_BOTTOM_RESERVE_PX - halfH,
      ),
    };
    const overlap = overlapOf(at);

    if (overlap < bestOverlap) {
      tagPx = at;
      bestOverlap = overlap;
    }
    if (overlap === 0) break;
  }

  const bottom = target.y + target.height;
  const isBeside = tagPx.y + halfH > target.y && tagPx.y - halfH < bottom;
  const anchorPx = {
    x: clampTo(isBeside ? (tagPx.x > centre.x ? target.x + target.width : target.x) : centre.x, 0, frame.width),
    y: clampTo(isBeside ? tagPx.y : tagPx.y < target.y ? target.y : bottom, 0, frame.height),
  };
  const toward = tagPx.x >= anchorPx.x ? 1 : -1;
  const attach = isBeside
    ? { x: tagPx.x - toward * halfW, y: tagPx.y }
    : {
        x: clampTo(anchorPx.x + toward * TAG_MIN_RUN_PX, tagPx.x - halfW + TAG_ATTACH_INSET_PX, tagPx.x + halfW - TAG_ATTACH_INSET_PX),
        y: tagPx.y < anchorPx.y ? tagPx.y + halfH : tagPx.y - halfH,
      };
  const elbow = {
    x: anchorPx.x + (attach.x - anchorPx.x) * ELBOW_ALONG_X,
    y: anchorPx.y + (attach.y - anchorPx.y) * ELBOW_ALONG_Y,
  };

  return { anchorPx, tagPx, leaderPx: [elbow, attach] };
}
