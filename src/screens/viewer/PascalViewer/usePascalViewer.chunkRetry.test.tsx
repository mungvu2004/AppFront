// @vitest-environment jsdom
/**
 * 23-B-014 / BUG-646 — chunk `toPascal` nạp hỏng thì "Thử lại" phải tải lại trang.
 *
 * Trình duyệt giữ lỗi của một `import()` theo URL suốt đời trang: gọi lại cùng
 * `import()` chỉ trả lỗi cũ, không gửi request nào, nên thử lại tại chỗ là lối
 * thoát giả. Chunk do bundler đặt tên nên không xin được URL khác như gói vách
 * ngăn (B-V10-01); tải lại trang là cách duy nhất xin lại nó.
 *
 * Bộ đổi dữ liệu NẠP ĐƯỢC mà ném lỗi lúc chạy thì vẫn thử lại tại chỗ — bài
 * B-V10-04 ở `usePascalViewer.test.tsx`.
 */

import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';

import { usePascalViewer, type UsePascalViewerOptions, type UsePascalViewerResult } from './usePascalViewer';

vi.mock('@/lib/pascal/toPascal', () => {
  throw new Error('Failed to fetch dynamically imported module');
});

function Probe({ onResult, ...options }: UsePascalViewerOptions & {
  readonly onResult: (result: UsePascalViewerResult) => void;
}) {
  const result = usePascalViewer(options);
  onResult(result);

  return <div ref={result.canvasRef} />;
}

describe('[23-B-014 · BUG-646] chunk bộ đổi dữ liệu hỏng', () => {
  it('"Thử lại" tải lại trang thay vì gọi lại import() đã hỏng', async () => {
    const reloadPage = vi.fn();
    const loadMount = vi.fn(() => new Promise<never>(() => undefined)) as unknown as never;
    let latest: UsePascalViewerResult | null = null;

    render(
      <Probe
        graph={createSampleBuilding()}
        loadMount={loadMount}
        reloadPage={reloadPage}
        onResult={(result) => {
          latest = result;
        }}
      />,
    );

    await vi.waitFor(() => {
      expect(latest?.viewModel.errorCode).toBe('PASCAL-01');
    }, { timeout: 10_000 });

    act(() => {
      latest?.onRetry();
    });

    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});
