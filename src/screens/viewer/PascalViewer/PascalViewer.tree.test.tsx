/**
 * Màn Pascal chạy qua **cây component thật**: container → view → hook.
 *
 * ## Vì sao tệp này tồn tại
 *
 * Một vòng chết đã sống sót qua **41 bài kiểm đơn vị**:
 *
 * - `PascalViewer.tsx` chỉ dựng hộp `data-testid="pascal-canvas"` ở `success`
 *   và `partial`;
 * - `usePascalViewer.ts` chỉ nạp gói khi `canvasRef.current !== null`;
 * - mà muốn tới `success` thì phải nạp xong.
 *
 * Kết quả: màn kẹt ở `loading` **vĩnh viễn**, và không lượt gọi nào tới
 * `/assets/pascal/pascal-mount.js` được gửi đi. Người dùng thấy một khung xương
 * không bao giờ dừng.
 *
 * Bốn mươi mốt bài kia không bắt được vì bộ dựng thử của hook
 * (`usePascalViewer.test.tsx`) gắn `canvasRef` vào một `div` **vô điều kiện** —
 * đi vòng qua đúng nhánh điều kiện gây ra lỗi. Bài e2e là thứ đầu tiên chạm tới
 * cây thật, và nó chạy mất vài phút.
 *
 * Tệp này là cùng phép kiểm ấy, chạy trong một giây, không cần WebGL: nó dựng
 * đúng `PascalViewerContainer` như router dựng, và chỉ thay **một** thứ — cửa
 * nạp gói.
 *
 * Quy tắc rút ra, đáng ghi vì nó không chỉ đúng cho màn này: **một bộ dựng thử
 * đơn giản hoá mất nhánh điều kiện thì nó cũng đơn giản hoá mất lỗi nằm trong
 * nhánh ấy.**
 */

import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { renderWithProviders } from '@/lib/testing/render';
import {
  __resetFeatureFlagsForTests,
  setFeatureFlagOverride,
} from '@/lib/telemetry/flags';

import { PascalViewerContainer } from './PascalViewer.container';

const GRAPH = createSampleBuilding();

/** Gói vách ngăn giả, đủ đúng hợp đồng `mount(el, options)`. */
const stubMount = () => {
  const dispose = vi.fn();
  const mounted: { element: HTMLElement | null } = { element: null };
  let announceReady: ((ready: boolean) => void) | undefined;

  const loadMount = vi.fn(() =>
    Promise.resolve({
      mount: (element: HTMLElement, options: Record<string, unknown>) => {
        mounted.element = element;
        announceReady = options['onReadyChange'] as (ready: boolean) => void;

        return { dispose };
      },
    }),
  );

  return {
    dispose,
    mounted,
    loadMount: loadMount as unknown as never,
    calls: () => loadMount.mock.calls.length,
    ready: () => announceReady?.(true),
  };
};

beforeEach(() => {
  __resetFeatureFlagsForTests();
  setFeatureFlagOverride('scene.pascal-viewer', true);
});

afterEach(() => {
  __resetFeatureFlagsForTests();
});

describe('cây thật: container → view → hook', () => {
  it('hộp cho Pascal cắm vào CÓ MẶT ngay lúc đang nạp', () => {
    const bench = stubMount();

    renderWithProviders(<PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />);

    // Đây là dòng bắt được vòng chết: lúc này màn vẫn `loading`.
    expect(screen.getByTestId('pascal-canvas')).toBeInTheDocument();
  });

  it('gói vách ngăn ĐƯỢC nạp, và nạp vào đúng cái hộp ấy', async () => {
    const bench = stubMount();

    renderWithProviders(<PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />);

    await waitFor(() => {
      expect(bench.calls()).toBe(1);
    });

    expect(bench.mounted.element).toBe(screen.getByTestId('pascal-canvas'));
  });

  it('nạp xong thì màn rời khỏi "đang nạp" và nói ra số đo', async () => {
    const bench = stubMount();

    renderWithProviders(<PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />);

    await waitFor(() => {
      expect(bench.calls()).toBe(1);
    });

    bench.ready();

    await waitFor(() => {
      expect(screen.getByRole('status')).not.toHaveTextContent('đang nạp');
    });

    // Bộ mẫu chuẩn A14: 48 tường.
    expect(screen.getByText('48')).toBeInTheDocument();
  });

  it('cờ tắt thì KHÔNG dựng hộp và KHÔNG nạp gói', () => {
    setFeatureFlagOverride('scene.pascal-viewer', false);
    const bench = stubMount();

    renderWithProviders(<PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />);

    expect(screen.queryByTestId('pascal-canvas')).not.toBeInTheDocument();
    expect(bench.calls()).toBe(0);
  });

  it('rời màn thì gọi dispose', async () => {
    const bench = stubMount();

    const view = renderWithProviders(
      <PascalViewerContainer graph={GRAPH} loadMount={bench.loadMount} />,
    );

    await waitFor(() => {
      expect(bench.calls()).toBe(1);
    });

    view.unmount();

    await waitFor(() => {
      expect(bench.dispose).toHaveBeenCalled();
    });
  });
});
