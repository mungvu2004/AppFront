/**
 * Bài kiểm của bộ nhận cử chỉ — không dựng màn nào, không cần React.
 *
 * Bảy điều dưới đây là toàn bộ hợp đồng của file:
 *
 * 1. Một ngón đi quá ngưỡng phát `orbit` với đúng độ dời **kể từ lần đọc trước**.
 * 2. Trong ngưỡng thì KHÔNG phát gì — đó là điều làm một cú chạm còn là cú chạm.
 * 3. Chạm rồi nhả trong ngưỡng phát `tap`; đi quá ngưỡng rồi nhả thì không.
 * 4. Hai ngón tách ra phát `zoom` với `scale` là **tỉ lệ** khoảng cách, không phải hiệu.
 * 5. Hai ngón trượt song song phát `pan` theo điểm giữa, và KHÔNG phát `zoom`.
 * 6. `pointercancel` không bao giờ là một cú chạm.
 * 7. Ngưỡng lấy từ `CLICK_SLOP_PX` của R-09 — file này không có ngưỡng của riêng nó.
 *
 * Và một điều nữa, kiểm bằng cách đọc chính mã nguồn: **không một phép toán
 * camera nào** sống trong file. Bài kiểm cuối cùng khẳng định điều đó.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { CLICK_SLOP_PX } from '@/lib/three/interaction/raycast';

import {
  attachMobileViewerGestures,
  createMobileViewerGestureReader,
  type MobileViewerGestureReader,
} from './mobileViewerGestures';
import type { MobileViewerGesture } from './mobileViewerTypes';

/* -------------------------------------------------------------------------- */
/* Bộ dựng.                                                                    */
/* -------------------------------------------------------------------------- */

interface Recorded {
  readonly reader: MobileViewerGestureReader;
  readonly gestures: MobileViewerGesture[];
}

function recordingReader(clickSlopPx?: number): Recorded {
  const gestures: MobileViewerGesture[] = [];
  const reader = createMobileViewerGestureReader({
    onGesture: (gesture) => gestures.push(gesture),
    ...(clickSlopPx === undefined ? {} : { clickSlopPx }),
  });

  return { reader, gestures };
}

/** Một ngón, đã quy về toạ độ canvas. */
function finger(pointerId: number, xPx: number, yPx: number): {
  pointerId: number;
  xPx: number;
  yPx: number;
} {
  return { pointerId, xPx, yPx };
}

/* -------------------------------------------------------------------------- */
/* Một ngón.                                                                   */
/* -------------------------------------------------------------------------- */

describe('mobileViewerGestures — một ngón', () => {
  it('không phát gì khi ngón chưa đi quá ngưỡng chạm-nhả', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 100, 100));
    reader.pointerMove(finger(1, 100 + CLICK_SLOP_PX, 100));

    expect(gestures).toEqual([]);
  });

  it('phát orbit với độ dời kể từ lần đọc trước, một khi đã qua ngưỡng', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 100, 100));
    reader.pointerMove(finger(1, 140, 130));
    reader.pointerMove(finger(1, 150, 125));

    expect(gestures).toEqual([
      { kind: 'orbit', deltaXPx: 40, deltaYPx: 30 },
      // Kể từ (140,130), KHÔNG phải kể từ chỗ đặt ngón xuống.
      { kind: 'orbit', deltaXPx: 10, deltaYPx: -5 },
    ]);
  });

  it('bỏ qua con trỏ chưa từng đặt xuống trên canvas này', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerMove(finger(7, 400, 400));

    expect(gestures).toEqual([]);
    expect(reader.activeCount()).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Chạm-nhả.                                                                   */
/* -------------------------------------------------------------------------- */

describe('mobileViewerGestures — chạm-nhả', () => {
  it('phát tap ở chỗ ngón nhấc lên khi cả lượt chạm nằm trong ngưỡng', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 60, 80));
    reader.pointerMove(finger(1, 61, 81));
    reader.pointerUp(finger(1, 61, 81));

    expect(gestures).toEqual([{ kind: 'tap', xPx: 61, yPx: 81 }]);
    expect(reader.activeCount()).toBe(0);
  });

  it('không phát tap sau khi ngón đã đi quá ngưỡng', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 60, 80));
    reader.pointerMove(finger(1, 160, 80));
    reader.pointerUp(finger(1, 160, 80));

    expect(gestures.map((gesture) => gesture.kind)).toEqual(['orbit']);
  });

  it('không phát tap khi cử chỉ bị hệ điều hành thu mất', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 60, 80));
    reader.pointerCancel(finger(1, 60, 80));

    expect(gestures).toEqual([]);
    expect(reader.activeCount()).toBe(0);
  });

  it('ngón thứ hai huỷ cú chạm: nhấc hai ngón ra không phải là chọn vật', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 60, 80));
    reader.pointerDown(finger(2, 160, 80));
    reader.pointerUp(finger(2, 160, 80));
    reader.pointerUp(finger(1, 60, 80));

    expect(gestures).toEqual([]);
  });

  it('lấy ngưỡng của R-09 khi người gọi không nói gì', () => {
    const inside = recordingReader();
    inside.reader.pointerDown(finger(1, 0, 0));
    inside.reader.pointerMove(finger(1, CLICK_SLOP_PX, 0));

    const outside = recordingReader();
    outside.reader.pointerDown(finger(1, 0, 0));
    outside.reader.pointerMove(finger(1, CLICK_SLOP_PX + 1, 0));

    expect(inside.gestures).toEqual([]);
    expect(outside.gestures.map((gesture) => gesture.kind)).toEqual(['orbit']);
  });
});

/* -------------------------------------------------------------------------- */
/* Hai ngón.                                                                   */
/* -------------------------------------------------------------------------- */

describe('mobileViewerGestures — hai ngón', () => {
  it('phát zoom với TỈ LỆ khoảng cách, không phải hiệu', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 0, 0));
    reader.pointerDown(finger(2, 100, 0));
    // Hai ngón tách ra gấp đôi, điểm giữa đứng yên: 100px → 200px.
    reader.pointerMove(finger(1, -50, 0));
    reader.pointerMove(finger(2, 150, 0));

    const scales = gestures
      .filter((gesture) => gesture.kind === 'zoom')
      .map((gesture) => (gesture.kind === 'zoom' ? gesture.scale : 0));

    // Hai sự kiện, mỗi sự kiện một nửa đường: tích của chúng là cả cú bóp.
    expect(scales).toHaveLength(2);
    expect(scales[0] ?? 0).toBeGreaterThan(1);
    expect((scales[0] ?? 0) * (scales[1] ?? 0)).toBeCloseTo(2, 10);
  });

  it('phát pan theo điểm giữa, và một cú trượt song song KHÔNG thu phóng gì', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 0, 0));
    reader.pointerDown(finger(2, 100, 0));
    // Cả hai ngón trượt cùng một véc-tơ (20, 40). Sự kiện tới từng ngón một, nên
    // ở giữa đường khoảng cách hai ngón có đổi — nhưng KHI XONG thì nó về đúng
    // chỗ cũ, và đó là điều phải đúng: trượt song song không phải là thu phóng.
    reader.pointerMove(finger(1, 20, 40));
    reader.pointerMove(finger(2, 120, 40));

    const netScale = gestures.reduce(
      (product, gesture) => (gesture.kind === 'zoom' ? product * gesture.scale : product),
      1,
    );
    const totalX = gestures.reduce(
      (sum, gesture) => (gesture.kind === 'pan' ? sum + gesture.deltaXPx : sum),
      0,
    );
    const totalY = gestures.reduce(
      (sum, gesture) => (gesture.kind === 'pan' ? sum + gesture.deltaYPx : sum),
      0,
    );

    expect(netScale).toBeCloseTo(1, 10);
    // Điểm giữa đi hết quãng của cử chỉ, qua hai bước nửa quãng: (50,0) → (70,40).
    expect(totalX).toBeCloseTo(20, 10);
    expect(totalY).toBeCloseTo(40, 10);
  });

  it('ba ngón không phát cử chỉ nào, và rút về hai ngón không thành một cú bóp giả', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 0, 0));
    reader.pointerDown(finger(2, 100, 0));
    reader.pointerDown(finger(3, 300, 300));
    reader.pointerMove(finger(3, 320, 300));

    expect(gestures).toEqual([]);
    expect(reader.activeCount()).toBe(3);

    // Ngón thứ ba rời đi: mốc phải chụp lại tập ngón CÒN LẠI, không phải tập cũ.
    reader.pointerUp(finger(3, 320, 300));
    reader.pointerMove(finger(1, 0, 0));

    expect(gestures).toEqual([]);
  });

  it('quên mọi ngón khi bị reset giữa một cử chỉ', () => {
    const { reader, gestures } = recordingReader();

    reader.pointerDown(finger(1, 0, 0));
    reader.reset();
    reader.pointerUp(finger(1, 0, 0));

    expect(gestures).toEqual([]);
    expect(reader.activeCount()).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Nối vào DOM.                                                                */
/* -------------------------------------------------------------------------- */

describe('attachMobileViewerGestures', () => {
  it('gắn bốn listener, đặt touchAction, rồi trả lại nguyên trạng lúc gỡ', () => {
    const canvas = document.createElement('canvas');
    canvas.style.touchAction = 'pan-y';
    const add = vi.spyOn(canvas, 'addEventListener');
    const remove = vi.spyOn(canvas, 'removeEventListener');

    const detach = attachMobileViewerGestures(canvas, { onGesture: vi.fn() });

    expect(add.mock.calls.map((call) => call[0])).toEqual([
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
    ]);
    expect(canvas.style.touchAction).toBe('none');

    detach();

    expect(remove.mock.calls.map((call) => call[0])).toEqual([
      'pointerdown',
      'pointermove',
      'pointerup',
      'pointercancel',
    ]);
    expect(canvas.style.touchAction).toBe('pan-y');
  });

  it('quy toạ độ về gốc canvas rồi đọc thành cử chỉ', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
    } as unknown as DOMRect);

    const gestures: MobileViewerGesture[] = [];
    const detach = attachMobileViewerGestures(canvas, {
      onGesture: (gesture) => gestures.push(gesture),
    });

    const fire = (type: string, clientX: number, clientY: number): void => {
      const event = new Event(type) as Event & {
        pointerId: number;
        clientX: number;
        clientY: number;
      };
      Object.assign(event, { pointerId: 1, clientX, clientY });
      canvas.dispatchEvent(event);
    };

    fire('pointerdown', 40, 60);
    fire('pointerup', 40, 60);

    expect(gestures).toEqual([{ kind: 'tap', xPx: 30, yPx: 40 }]);

    detach();
  });
});

/* -------------------------------------------------------------------------- */
/* Ranh giới.                                                                  */
/* -------------------------------------------------------------------------- */

describe('mobileViewerGestures — ranh giới', () => {
  it('không chứa một phép toán camera nào', () => {
    // Bỏ bình luận trước khi soát: docblock của file CÓ nói về `notches` và về
    // `CAMERA_SETTINGS` — nó giải thích vì sao hai thứ ấy KHÔNG ở đây, và một
    // lời giải thích không phải là một phép tính.
    const source = readFileSync('src/screens/system/MobileViewer/mobileViewerGestures.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // Lượng giác, ma trận, quaternion, và mọi tên nói về không gian THẾ GIỚI.
    for (const forbidden of [
      'Math.atan',
      'Math.sin',
      'Math.cos',
      'Math.tan',
      'Matrix4',
      'Quaternion',
      'Vector3',
      'azimuth',
      'polar',
      'distanceM',
      'notches',
      'CAMERA_SETTINGS',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
