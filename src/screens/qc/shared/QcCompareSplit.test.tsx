import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QcCompareSplit } from './QcCompareSplit';
import { QcZoomMenu } from './QcZoomMenu';
import { isQcCompare, setQcCompare } from './qcCompare';

const HALO = { x: 40, y: 60, width: 20, height: 10 };

const renderSplit = (overrides: Partial<Parameters<typeof QcCompareSplit>[0]> = {}) => {
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

afterEach(() => {
  cleanup();
  act(() => setQcCompare(false));
});

describe('QcCompareSplit — "So sánh hai bên"', () => {
  it('tắt: chỉ có canvas phải, không nửa trái', () => {
    renderSplit();
    expect(screen.getByTestId('right-canvas')).toBeTruthy();
    expect(screen.queryByTestId('qc-compare-left')).toBeNull();
  });

  it('bật: nửa trái đặt ảnh gốc và vòng chọn ở đúng toạ độ khung của canvas phải, cùng lớp phóng', () => {
    act(() => setQcCompare(true));
    renderSplit({ layerTransform: 'translate(12px, -4px) scale(2)' });

    const left = screen.getByTestId('qc-compare-left');
    const halo = screen.getByTestId('qc-compare-halo');
    expect(left.querySelector('img')?.getAttribute('src')).toBe('x.png');
    expect(halo.style.left).toBe('40px');
    expect(halo.style.top).toBe('60px');
    expect(halo.style.width).toBe('20px');
    expect((halo.parentElement as HTMLElement).style.transform).toBe('translate(12px, -4px) scale(2)');
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

  it('chưa chọn gì thì nửa trái không vẽ vòng chọn', () => {
    act(() => setQcCompare(true));
    renderSplit({ haloRect: null });
    expect(screen.queryByTestId('qc-compare-halo')).toBeNull();
  });
});

describe('QcZoomMenu — mục "So sánh hai bên"', () => {
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: /^Mức thu phóng/ }));

  it('chỉ có ở màn bật `compare`', () => {
    render(<QcZoomMenu viewMode />);
    openMenu();
    expect(screen.queryByRole('button', { name: 'So sánh hai bên' })).toBeNull();
  });

  it('bấm bật rồi tắt chế độ, trạng thái hiện ở aria-pressed', () => {
    render(<QcZoomMenu compare viewMode />);
    openMenu();
    const item = screen.getByRole('button', { name: 'So sánh hai bên' });
    expect(item.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(item);
    expect(isQcCompare()).toBe(true);

    openMenu();
    const again = screen.getByRole('button', { name: 'So sánh hai bên' });
    expect(again.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(again);
    expect(isQcCompare()).toBe(false);
  });
});
