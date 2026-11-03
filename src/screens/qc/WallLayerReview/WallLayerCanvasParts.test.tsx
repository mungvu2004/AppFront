import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setQcCompare } from '../shared/qcCompare';
import { WallLayerMiniMap } from './WallLayerCanvasParts';

const renderMiniMap = () =>
  render(
    <WallLayerMiniMap
      miniMapViewport={{ x: 20, y: 20, width: 30, height: 30 }}
      onMiniMapViewportChange={vi.fn()}
      shapes={[]}
      surface={{ x: 0, y: 0, width: 400, height: 300 }}
      zoomPercent={305}
    />,
  );

afterEach(() => {
  cleanup();
  act(() => setQcCompare(false));
});

describe('WallLayerMiniMap', () => {
  it('phóng quá 100%: hiện bản đồ nhỏ', () => {
    renderMiniMap();
    expect(screen.getByRole('region', { name: 'Bản đồ thu nhỏ' })).toBeTruthy();
  });

  it('"So sánh hai bên": ẩn bản đồ nhỏ — nửa trái đã cho ngữ cảnh', () => {
    act(() => setQcCompare(true));
    renderMiniMap();
    expect(screen.queryByRole('region', { name: 'Bản đồ thu nhỏ' })).toBeNull();
  });
});
