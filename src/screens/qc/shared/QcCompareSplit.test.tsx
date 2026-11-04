import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QcCompareSplit, type QcCompareSplitProps } from './QcCompareSplit';
import { QcZoomMenu } from './QcZoomMenu';
import { isQcCompare, placeCompareTag, setQcCompare } from './qcCompare';

const HALO = { x: 40, y: 60, width: 20, height: 10 };
const FRAME = { width: 400, height: 300 };

const renderSplit = (overrides: Partial<QcCompareSplitProps> = {}) => {
  const props = {
    canPick: true,
    drawing: <img alt="bản gốc" src="x.png" style={{ left: 5, top: 7, width: 300, height: 200 }} />,
    haloRect: HALO,
    onPanBy: vi.fn(),
    onZoom: vi.fn(),
    ...overrides,
  };
  render(
    <QcCompareSplit {...props}>
      <div data-testid="right-canvas" />
    </QcCompareSplit>,
  );
  return props;
};

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(FRAME.width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(FRAME.height);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  act(() => setQcCompare(false));
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

describe('QcCompareSplit — "So sánh hai bên"', () => {
  it('tắt: chỉ có canvas phải, không nửa trái', () => {
    renderSplit();
    expect(screen.getByTestId('right-canvas')).toBeTruthy();
    expect(screen.queryByTestId('qc-compare-left')).toBeNull();
  });

  it('bật: nửa trái đặt ảnh gốc đúng lớp phóng; viền chọn ở pixel khung theo cùng khung nhìn', () => {
    act(() => setQcCompare(true));
    renderSplit({ layerView: { offset: { x: 12, y: -4 }, scale: 2 } });

    const left = screen.getByTestId('qc-compare-left');
    const halo = screen.getByTestId('qc-compare-halo');
    expect(left.querySelector('img')?.getAttribute('src')).toBe('x.png');
    expect(screen.getByTestId('qc-compare-layer').style.transform).toBe('translate(12px, -4px) scale(2)');
    /* Điểm x của lớp về khung: tâm + dời + phóng × (x − tâm), đúng phép `transform` của canvas phải. */
    expect(halo.style.left).toBe(`${200 + 12 + 2 * (40 - 200)}px`);
    expect(halo.style.top).toBe(`${150 - 4 + 2 * (60 - 150)}px`);
    expect(halo.style.width).toBe('40px');
  });

  it('không có lớp phóng (Tường): viền chọn đúng toạ độ khung của canvas phải', () => {
    act(() => setQcCompare(true));
    renderSplit();
    const halo = screen.getByTestId('qc-compare-halo');
    expect([halo.style.left, halo.style.top, halo.style.width]).toEqual(['40px', '60px', '20px']);
  });

  it('lăn chuột ở nửa trái phóng chung khung nhìn (một khung nhìn cho hai nửa)', () => {
    act(() => setQcCompare(true));
    const props = renderSplit();
    const left = screen.getByTestId('qc-compare-left');

    act(() => {
      left.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
    });
    expect(props.onZoom).toHaveBeenCalledWith(1);
  });

  it('kéo nửa trái dời chung khung nhìn: đúng độ dời đi lên `onPanBy`', () => {
    act(() => setQcCompare(true));
    const props = renderSplit();
    const left = screen.getByTestId('qc-compare-left');

    fireEvent.pointerDown(left, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(left, { clientX: 130, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(left, { clientX: 130, clientY: 120, pointerId: 1 });
    expect(props.onPanBy).toHaveBeenCalledWith(30, 20);
  });

  it('chưa chọn gì thì nửa trái không vẽ gì: không viền, không thẻ', () => {
    act(() => setQcCompare(true));
    renderSplit({ haloRect: null });
    expect(screen.queryByTestId('qc-compare-halo')).toBeNull();
    expect(screen.queryByTestId('wall-layer-tag')).toBeNull();
  });

  it('thẻ: hai nửa cùng chữ, cùng vị trí; đang rê (chưa chọn) thì chỉ nửa phải có', () => {
    act(() => setQcCompare(true));
    const tag = { rect: HALO, text: '3.450 × 220 mm · Máy chắc chắn', tier: 'certain' as const };
    const { rerender } = render(
      <QcCompareSplit canPick drawing={null} haloRect={HALO} onPanBy={vi.fn()} onZoom={vi.fn()} tag={tag}>
        <div />
      </QcCompareSplit>,
    );

    const tags = screen.getAllByTestId('wall-layer-tag');
    expect(tags).toHaveLength(2);
    expect(tags[0]?.textContent).toBe(tags[1]?.textContent);
    expect(tags[0]?.style.left).toBe(tags[1]?.style.left);
    expect(tags[0]?.style.top).toBe(tags[1]?.style.top);

    rerender(
      <QcCompareSplit canPick drawing={null} haloRect={null} onPanBy={vi.fn()} onZoom={vi.fn()} tag={tag}>
        <div />
      </QcCompareSplit>,
    );
    expect(screen.getAllByTestId('wall-layer-tag')).toHaveLength(1);
    expect(screen.getByTestId('qc-compare-left').querySelector('[data-testid="wall-layer-tag"]')).toBeNull();
  });
});

describe('QcCompareSplit — đồng bộ chọn', () => {
  /** Canvas phải tối giản: một hình có đường chọn, một đa giác nền và một nút nổi, giữ mục chọn như hook của màn. */
  function Harness({ onSelect, onBackground }: { readonly onSelect: (id: string) => void; readonly onBackground: () => void }) {
    const [selected, setSelected] = useState<string | null>(null);
    const select = (id: string) => {
      setSelected(id);
      onSelect(id);
    };

    return (
      <QcCompareSplit canPick drawing={null} haloRect={selected === null ? null : HALO} onPanBy={vi.fn()} onZoom={vi.fn()}>
        <svg data-testid="svg">
          <polygon data-testid="backdrop" onClick={onBackground} />
          <g onClick={() => select('W-1')}>
            <polygon data-testid="shape" />
          </g>
        </svg>
        <button data-testid="float" type="button">
          <svg>
            <g>
              <path data-testid="icon" />
            </g>
          </svg>
        </button>
        {selected === null ? null : <p data-testid="right-selected">{selected}</p>}
      </QcCompareSplit>
    );
  }

  const stubHits = (testIds: readonly string[]) => {
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: () => testIds.map((id) => screen.getByTestId(id)),
    });
  };

  const clickLeft = () => {
    const left = screen.getByTestId('qc-compare-left');
    fireEvent.pointerDown(left, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(left, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.click(left, { clientX: 50, clientY: 50 });
  };

  it('bấm nửa gốc: đi đúng đường chọn của canvas phải, hai nửa cùng hiện mục đó', () => {
    act(() => setQcCompare(true));
    const onSelect = vi.fn();
    render(<Harness onBackground={vi.fn()} onSelect={onSelect} />);
    stubHits(['shape', 'svg']);

    clickLeft();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('W-1');
    expect(screen.getByTestId('right-selected').textContent).toBe('W-1');
    expect(screen.getByTestId('qc-compare-halo')).toBeTruthy();
  });

  it('bấm thẳng canvas phải cũng làm nửa gốc hiện viền', () => {
    act(() => setQcCompare(true));
    render(<Harness onBackground={vi.fn()} onSelect={vi.fn()} />);

    fireEvent.click(screen.getByTestId('shape'));

    expect(screen.getByTestId('qc-compare-halo')).toBeTruthy();
  });

  it('nút nổi và đa giác nền ở cùng chỗ không nhận cú bấm từ nửa gốc', () => {
    act(() => setQcCompare(true));
    const onSelect = vi.fn();
    const onBackground = vi.fn();
    render(<Harness onBackground={onBackground} onSelect={onSelect} />);
    stubHits(['icon', 'backdrop', 'svg']);

    clickLeft();

    expect(onSelect).not.toHaveBeenCalled();
    expect(onBackground).not.toHaveBeenCalled();
  });

  it('kéo ở nửa gốc là dời bản vẽ, không chọn', () => {
    act(() => setQcCompare(true));
    const onSelect = vi.fn();
    render(<Harness onBackground={vi.fn()} onSelect={onSelect} />);
    stubHits(['shape']);
    const left = screen.getByTestId('qc-compare-left');

    fireEvent.pointerDown(left, { button: 0, clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(left, { clientX: 90, clientY: 50, pointerId: 1 });
    fireEvent.click(left, { clientX: 90, clientY: 50 });

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('placeCompareTag — thẻ trong khung, không che vật', () => {
  const TEXT = '3.450 × 220 mm · Máy chắc chắn';
  const inside = (spot: NonNullable<ReturnType<typeof placeCompareTag>>, frame: typeof FRAME, target: typeof HALO) => {
    const halfW = (TEXT.length * 7.3 + 30) / 2;
    expect(spot.tagPx.x - halfW).toBeGreaterThanOrEqual(0);
    expect(spot.tagPx.x + halfW).toBeLessThanOrEqual(frame.width);
    expect(spot.tagPx.y - 12).toBeGreaterThanOrEqual(0);
    expect(spot.tagPx.y + 12).toBeLessThanOrEqual(frame.height);
    const apart =
      spot.tagPx.x + halfW <= target.x ||
      spot.tagPx.x - halfW >= target.x + target.width ||
      spot.tagPx.y + 12 <= target.y ||
      spot.tagPx.y - 12 >= target.y + target.height;
    expect(apart).toBe(true);
  };
  const FRAMES = [FRAME, { width: 460, height: 600 }, { width: 700, height: 260 }];
  const TARGETS = [
    { x: 150, y: 120, width: 40, height: 10 }, // giữa
    { x: 2, y: 2, width: 30, height: 12 }, // góc trên trái
    { x: 250, y: 220, width: 30, height: 12 }, // góc dưới phải
    { x: 100, y: 10, width: 8, height: 230 }, // tường đứng dài
    { x: 10, y: 120, width: 300, height: 8 }, // tường nằm dài
  ];

  it.each(FRAMES.flatMap((frame) => TARGETS.map((target) => [frame, target] as const)))('khung %j, vật %j', (frame, target) => {
    const anchor = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const spot = placeCompareTag(target, anchor, frame, TEXT);
    expect(spot).not.toBeNull();
    inside(spot!, frame, target);
  });

  it('ưu tiên trên phải như ảnh phác; đường dẫn có một khúc gãy và chạm mép thẻ', () => {
    const spot = placeCompareTag({ x: 100, y: 200, width: 40, height: 10 }, { x: 120, y: 205 }, { width: 800, height: 600 }, TEXT)!;
    expect(spot.tagPx.x).toBeGreaterThan(120);
    expect(spot.tagPx.y).toBeLessThan(200);
    expect(spot.leaderPx).toHaveLength(2);
    expect(spot.leaderPx[1]?.y).toBe(spot.tagPx.y + 12);
  });

  it('neo ngoài khung: không có thẻ', () => {
    expect(placeCompareTag({ x: -80, y: 10, width: 40, height: 10 }, { x: -60, y: 15 }, FRAME, TEXT)).toBeNull();
  });
});

describe('QcZoomMenu — nút "So sánh" cạnh nút phóng', () => {
  it('chỉ có ở màn bật `compare`', () => {
    render(<QcZoomMenu viewMode />);
    expect(screen.queryByRole('button', { name: 'So sánh hai bên' })).toBeNull();
  });

  it('thấy ngay, không cần mở menu; bấm bật rồi tắt, trạng thái ở aria-pressed; menu không còn mục trùng', () => {
    render(<QcZoomMenu compare viewMode />);
    const toggle = screen.getByRole('button', { name: 'So sánh hai bên' });
    expect(toggle).toHaveTextContent('So sánh');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggle);
    expect(isQcCompare()).toBe(true);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: /^Mức thu phóng/ }));
    expect(screen.getAllByRole('button', { name: /So sánh/u })).toHaveLength(1);

    fireEvent.click(toggle);
    expect(isQcCompare()).toBe(false);
  });
});
