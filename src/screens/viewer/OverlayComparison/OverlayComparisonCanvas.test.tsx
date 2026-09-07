/**
 * Lượt kiểm của canvas Đối chiếu bản vẽ.
 *
 * Dựng **chỉ từ props** — không store, không mạng, không hook của màn. Đó là
 * điều kiện của mục D, và cũng là lý do file này chạy nhanh: `OverlayComparisonCanvas`
 * là một hàm của `OverlayComparisonCanvasProps`, nên mọi khẳng định dưới đây là
 * một khẳng định về hợp đồng chứ không phải về một lượt tích hợp.
 *
 * Dữ liệu đến từ `overlayComparisonScenarios.ts` — bộ mẫu đóng băng dùng chung
 * cho cả bốn worker. Không con số nào ở đây được viết lại tại chỗ (R-70).
 *
 * ## Ba thứ jsdom không có, và vì sao chúng được gắn vào chứ không bị né
 *
 * - **`ResizeObserver`** — jsdom không khai. Bản giả dưới đây báo lại một kích
 *   thước THẬT ngay lúc `observe`, vì `MeasurementLabel` nhận toạ độ pixel: một
 *   observer im lặng sẽ khiến đường đo không bao giờ được vẽ, và phép kiểm sẽ
 *   xanh vì sai lý do.
 * - **`getBoundingClientRect`** — jsdom trả hình chữ nhật rỗng cho mọi phần tử,
 *   nên một `pointermove` giả lập sẽ đo được đúng con số không. Gắn một khung
 *   rộng {@link FRAME_WIDTH_PX} là cách cấp cho phép kiểm cái layout mà jsdom
 *   không tự có — không phải cách nới lỏng khẳng định.
 * - **`setPointerCapture`** — jsdom khai mà không cài. Bản rỗng là đủ: điều đang
 *   được kiểm là *toạ độ đi ra ngoài*, không phải cơ chế bắt con trỏ của trình
 *   duyệt.
 *
 * Chế độ giảm chuyển động được bật mặc định, để `useTransition` về đích ngay ở
 * lượt render đầu và không lượt kiểm nào phải chờ một vòng `requestAnimationFrame`.
 * Đúng một lượt kiểm tắt nó đi — lượt đo thời lượng của tay cầm.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MOTION_DURATIONS_MS, REDUCED_MOTION_QUERY } from '@/lib/motion';

import { OverlayComparisonCanvas } from './OverlayComparisonCanvas';
import {
  buildLayers,
  buildMarks,
  DEFAULT_TOLERANCE_MM,
  IDENTITY_VIEWPORT,
  SAMPLE_DEVIATIONS_MM,
  SAMPLE_GEOMETRY,
  SAMPLE_SCAN_URL,
} from './overlayComparisonScenarios';
import { COMPARE_MODE_IDS, OVERLAY_LAYER_IDS } from './types';
import type { CompareModeId, OverlayComparisonCanvasProps } from './types';

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

/** Bề rộng khung mà bản giả `getBoundingClientRect` trả về. */
const FRAME_WIDTH_PX = 800;
const FRAME_HEIGHT_PX = 600;

/**
 * `PointerEvent`, thứ jsdom không khai.
 *
 * Thiếu nó, `fireEvent.pointerMove` rơi về một `Event` trần: `clientX` và
 * `movementX` không tồn tại, và mọi phép tính toạ độ ra `NaN` — một phép kiểm
 * đỏ vì môi trường, không phải vì màn. Bản giả kế thừa `MouseEvent` để lấy đúng
 * ngữ nghĩa của `clientX`/`button`, rồi gắn thêm ba trường mà lớp đó không mang.
 */
class FakePointerEvent extends MouseEvent {
  readonly pointerId: number;
  readonly movementX: number;
  readonly movementY: number;

  constructor(type: string, init: PointerEventInit & { movementX?: number; movementY?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
    this.movementX = init.movementX ?? 0;
    this.movementY = init.movementY ?? 0;
  }
}

class FakeResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(): void {
    this.callback(
      [{ contentRect: { width: FRAME_WIDTH_PX, height: FRAME_HEIGHT_PX } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve(): void {
    /* bản giả không theo dõi gì để mà bỏ theo dõi */
  }

  disconnect(): void {
    /* như trên */
  }
}

function setReducedMotion(isReducedMotion: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isReducedMotion && query === REDUCED_MOTION_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

beforeEach(() => {
  setReducedMotion(true);

  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: FakeResizeObserver,
  });

  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    bottom: FRAME_HEIGHT_PX,
    height: FRAME_HEIGHT_PX,
    left: 0,
    right: FRAME_WIDTH_PX,
    toJSON: () => ({}),
    top: 0,
    width: FRAME_WIDTH_PX,
    x: 0,
    y: 0,
  });

  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    writable: true,
    value: FakePointerEvent,
  });

  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
  Reflect.deleteProperty(window, 'PointerEvent');
  // Gán thẳng lên prototype thì `restoreAllMocks` không gỡ được — gỡ bằng tay,
  // để không file kiểm nào thừa hưởng bản giả của file này.
  Reflect.deleteProperty(Element.prototype, 'setPointerCapture');
  Reflect.deleteProperty(Element.prototype, 'releasePointerCapture');
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Bộ dựng props.                                                              */
/* -------------------------------------------------------------------------- */

const SCAN_OPACITY_PERCENT = 25;

function makeProps(
  overrides: Partial<OverlayComparisonCanvasProps> = {},
): OverlayComparisonCanvasProps {
  return {
    compareMode: 'overlay',
    geometry: SAMPLE_GEOMETRY,
    isInteractive: true,
    layers: buildLayers(SCAN_OPACITY_PERCENT, true),
    marks: buildMarks(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM),
    measurement: null,
    onSelectRegion: vi.fn(),
    onSetSwipePosition: vi.fn(),
    onSetViewport: vi.fn(),
    scanUrl: SAMPLE_SCAN_URL,
    swipePosition: 0.5,
    viewport: IDENTITY_VIEWPORT,
    ...overrides,
  };
}

function layerElements(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('[data-overlay-layer]'));
}

function planeTransforms(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-comparison-plane]')).map(
    (plane) => plane.style.transform,
  );
}

/* -------------------------------------------------------------------------- */
/* Ba lớp, và chỉ ba.                                                          */
/* -------------------------------------------------------------------------- */

describe('ba lớp thị giác', () => {
  it.each(COMPARE_MODE_IDS)('kiểu %s vẽ đúng ba lớp, không hơn', (compareMode: CompareModeId) => {
    const { container } = render(<OverlayComparisonCanvas {...makeProps({ compareMode })} />);

    const layers = layerElements(container);

    expect(layers).toHaveLength(3);
    expect(layers.map((layer) => layer.getAttribute('data-overlay-layer'))).toEqual([
      ...OVERLAY_LAYER_IDS,
    ]);
  });

  it('lớp hình học vẽ đủ nét của bộ mẫu, bằng --accent', () => {
    const { container } = render(<OverlayComparisonCanvas {...makeProps()} />);

    const paths = container.querySelectorAll('[data-geometry-polyline]');

    expect(paths).toHaveLength(SAMPLE_GEOMETRY.length);
    expect(paths[0]?.getAttribute('stroke')).toBe('var(--accent)');
  });

  it('tầng không có ảnh quét vẫn giữ đủ ba lớp', () => {
    const { container } = render(<OverlayComparisonCanvas {...makeProps({ scanUrl: null })} />);

    expect(layerElements(container)).toHaveLength(3);
    expect(container.querySelector('img')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Gạch chéo chỉ cho vùng vượt dung sai.                                       */
/* -------------------------------------------------------------------------- */

describe('gạch chéo', () => {
  it('chỉ vùng vượt dung sai mới có gạch chéo', () => {
    const marks = buildMarks(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM);
    const { container } = render(<OverlayComparisonCanvas {...makeProps({ marks })} />);

    const expectedOverTolerance = marks.filter((mark) => mark.isOverTolerance).length;

    expect(expectedOverTolerance).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-hatched="true"]')).toHaveLength(expectedOverTolerance);
    expect(container.querySelectorAll('[data-hatched="false"]')).toHaveLength(
      marks.length - expectedOverTolerance,
    );
  });

  it('vùng trong dung sai không mang một mảng sơn nào', () => {
    const marks = buildMarks(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM);
    const { container } = render(<OverlayComparisonCanvas {...makeProps({ marks })} />);

    for (const element of container.querySelectorAll<HTMLElement>('[data-hatched="false"]')) {
      expect(element.style.backgroundImage).toBe('');
    }

    for (const element of container.querySelectorAll<HTMLElement>('[data-hatched="true"]')) {
      expect(element.style.backgroundImage).toContain('var(--state-attention)');
    }
  });

  it('bấm một dấu gạch chéo báo đúng vùng ra ngoài', () => {
    const marks = buildMarks(SAMPLE_DEVIATIONS_MM, DEFAULT_TOLERANCE_MM);
    const onSelectRegion = vi.fn();
    const { container } = render(
      <OverlayComparisonCanvas {...makeProps({ marks, onSelectRegion })} />,
    );

    const first = container.querySelector<HTMLElement>('[data-deviation-mark]');

    expect(first).not.toBeNull();
    fireEvent.click(first as HTMLElement);

    expect(onSelectRegion).toHaveBeenCalledWith(marks[0]?.id);
  });
});

/* -------------------------------------------------------------------------- */
/* Đường chia đôi — kéo, và bàn phím.                                          */
/* -------------------------------------------------------------------------- */

describe('đường chia đôi', () => {
  function renderSwipe(overrides: Partial<OverlayComparisonCanvasProps> = {}) {
    const onSetSwipePosition = vi.fn();
    const result = render(
      <OverlayComparisonCanvas
        {...makeProps({ compareMode: 'swipe', onSetSwipePosition, ...overrides })}
      />,
    );

    return { ...result, divider: screen.getByRole('slider'), onSetSwipePosition };
  }

  it('kéo tới giữa khung báo ra đúng tỉ lệ', () => {
    const { divider, onSetSwipePosition } = renderSwipe();

    fireEvent.pointerDown(divider, { clientX: FRAME_WIDTH_PX / 2, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 600, pointerId: 1 });

    expect(onSetSwipePosition).toHaveBeenLastCalledWith(0.75);
  });

  it('kéo ra ngoài hai mép vẫn nằm trong 0..1', () => {
    const { divider, onSetSwipePosition } = renderSwipe();

    fireEvent.pointerDown(divider, { clientX: FRAME_WIDTH_PX / 2, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: -4000, pointerId: 1 });
    fireEvent.pointerMove(divider, { clientX: 9000, pointerId: 1 });
    fireEvent.pointerUp(divider, { pointerId: 1 });

    for (const call of onSetSwipePosition.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(0);
      expect(call[0]).toBeLessThanOrEqual(1);
    }

    expect(onSetSwipePosition).toHaveBeenCalledWith(0);
    expect(onSetSwipePosition).toHaveBeenCalledWith(1);
  });

  it('thả con trỏ rồi thì di chuột không còn dịch đường chia đôi', () => {
    const { divider, onSetSwipePosition } = renderSwipe();

    fireEvent.pointerDown(divider, { clientX: FRAME_WIDTH_PX / 2, pointerId: 1 });
    fireEvent.pointerUp(divider, { pointerId: 1 });
    onSetSwipePosition.mockClear();
    fireEvent.pointerMove(divider, { clientX: 600, pointerId: 1 });

    expect(onSetSwipePosition).not.toHaveBeenCalled();
  });

  it('mũi tên trái và phải dịch được đường chia đôi (A12)', () => {
    const { divider, onSetSwipePosition } = renderSwipe({ swipePosition: 0.5 });

    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(onSetSwipePosition).toHaveBeenLastCalledWith(0.52);

    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(onSetSwipePosition).toHaveBeenLastCalledWith(0.48);

    fireEvent.keyDown(divider, { key: 'Home' });
    expect(onSetSwipePosition).toHaveBeenLastCalledWith(0);

    fireEvent.keyDown(divider, { key: 'End' });
    expect(onSetSwipePosition).toHaveBeenLastCalledWith(1);
  });

  it('tay cầm focus được và tự nói ra nó là gì', () => {
    const { divider } = renderSwipe();

    expect(divider).toHaveAttribute('tabindex', '0');
    expect(divider).toHaveAccessibleName('đường chia đôi, dùng phím mũi tên trái và phải để dịch');
    expect(divider).toHaveAttribute('aria-valuenow', '0.5');
  });

  it('chỉ kiểu trượt mới có đường chia đôi', () => {
    render(<OverlayComparisonCanvas {...makeProps({ compareMode: 'overlay' })} />);

    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('khung bị khoá thì kéo không báo gì ra ngoài', () => {
    const { divider, onSetSwipePosition } = renderSwipe({ isInteractive: false });

    fireEvent.pointerDown(divider, { clientX: 600, pointerId: 1 });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });

    expect(onSetSwipePosition).not.toHaveBeenCalled();
  });

  it('nét tay cầm to lên đúng nhịp instant của bảng thời lượng (R-71)', () => {
    setReducedMotion(false);

    const { divider } = renderSwipe();
    const stroke = divider.querySelector<HTMLElement>('span');

    expect(stroke?.style.transitionDuration).toBe(`${MOTION_DURATIONS_MS.instant}ms`);
    expect(stroke?.className).toContain('group-hover:w-[6px]');
  });
});

/* -------------------------------------------------------------------------- */
/* Camera.                                                                     */
/* -------------------------------------------------------------------------- */

describe('camera', () => {
  const FLOWN_VIEWPORT = { x: 40, y: -12, zoom: 2 };

  it('đổi kiểu đối chiếu không làm mất camera', () => {
    const props = makeProps({ compareMode: 'overlay', viewport: FLOWN_VIEWPORT });
    const { container, rerender } = render(<OverlayComparisonCanvas {...props} />);

    const before = planeTransforms(container);

    rerender(<OverlayComparisonCanvas {...props} compareMode="swipe" />);
    expect(planeTransforms(container)).toEqual(before);

    rerender(<OverlayComparisonCanvas {...props} compareMode="sideBySide" />);
    for (const transform of planeTransforms(container)) {
      expect(transform).toBe(before[0]);
    }
  });

  it('hai khung cạnh nhau đọc chung một viewport', () => {
    const { container } = render(
      <OverlayComparisonCanvas
        {...makeProps({ compareMode: 'sideBySide', viewport: FLOWN_VIEWPORT })}
      />,
    );

    const transforms = planeTransforms(container);

    expect(transforms).toHaveLength(2);
    expect(transforms[0]).toBe(transforms[1]);
    expect(transforms[0]).toContain('scale(2)');
  });

  it('kéo nền báo một viewport mới ra ngoài, giữ nguyên mức thu phóng', () => {
    const onSetViewport = vi.fn();
    const { container } = render(
      <OverlayComparisonCanvas {...makeProps({ onSetViewport, viewport: FLOWN_VIEWPORT })} />,
    );

    const root = container.firstElementChild as HTMLElement;

    fireEvent.pointerDown(root, { button: 1, pointerId: 2 });
    fireEvent.pointerMove(root, { movementX: 10, movementY: -6, pointerId: 2 });

    expect(onSetViewport).toHaveBeenCalledWith({ x: 50, y: -18, zoom: 2 });
  });
});

/* -------------------------------------------------------------------------- */
/* Đường đo.                                                                   */
/* -------------------------------------------------------------------------- */

describe('đường đo của vùng được chọn', () => {
  const MEASUREMENT = {
    from: { x: 0.2, y: 0.3 },
    to: { x: 0.6, y: 0.5 },
    valueText: '41 mm',
  };

  it('chưa chọn vùng nào thì không có đường đo', () => {
    const { container } = render(<OverlayComparisonCanvas {...makeProps()} />);

    expect(container.querySelector('line')).toBeNull();
  });

  it('chọn một vùng thì MeasurementLabel vẽ đường đo kèm giá trị', () => {
    const { container } = render(
      <OverlayComparisonCanvas {...makeProps({ measurement: MEASUREMENT })} />,
    );

    const plane = container.querySelector<HTMLElement>('[data-comparison-plane]');

    expect(plane).not.toBeNull();
    expect(within(plane as HTMLElement).getByText('41 mm')).toBeInTheDocument();

    // Đường nét đứt, hai tick và đường dẫn — cả bốn do MeasurementLabel vẽ. Màn
    // không vẽ thêm đường nào, nên đếm được đúng bốn là đếm được rằng nó không
    // tự vẽ lại đường đo.
    expect(container.querySelectorAll('line')).toHaveLength(4);
  });
});
