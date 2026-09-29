/**
 * Màn xem Pascal — bảy trạng thái, tiếng Việt, khả năng tiếp cận.
 *
 * View là thuần nên cả bảy trạng thái dựng được **mà không cần WebGL**, không
 * cần gói vách ngăn, không cần Pascal. Đó là điểm của mục D, và nó là lý do
 * bài kiểm này chạy trong một giây thay vì phải mở trình duyệt.
 *
 * Bài đáng chú ý nhất là bài cuối: Pascal dựng `fallback={null}` khi lỗi render
 * (`viewer/src/components/viewer/render-error.tsx:29-45`), tức **màn trắng
 * thật** — đúng thất bại duy nhất A11 tồn tại để chặn. Nên màn này phải chứng
 * minh điều ngược lại: không nhánh nào ra rỗng.
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import { PascalViewer } from './PascalViewer';
import {
  PASCAL_VIEWER_CAPTIONS,
  PASCAL_VIEWER_TITLE,
  type PascalViewerState,
  type PascalViewerViewModel,
} from './pascalViewerTypes';

const STATES: readonly PascalViewerState[] = [
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
];

const SUMMARY = {
  levelLabel: '4',
  wallLabel: '48',
  openingLabel: '16',
  roomLabel: '14',
} as const;

const SKIPPED = [
  { kind: 'trục định vị', countLabel: '4', reason: 'Pascal chưa có loại node nào cho trục định vị.' },
  { kind: 'kích thước', countLabel: '34', reason: 'Kích thước của bản vẽ chưa được chuyển sang Pascal.' },
] as const;

const viewModelFor = (state: PascalViewerState): PascalViewerViewModel => ({
  state,
  title: PASCAL_VIEWER_TITLE,
  caption: PASCAL_VIEWER_CAPTIONS[state],
  summary: state === 'success' || state === 'partial' ? SUMMARY : null,
  skipped: state === 'partial' ? SKIPPED : [],
  errorCode: state === 'error' ? 'PASCAL-01' : null,
});

const renderState = (state: PascalViewerState) =>
  renderWithProviders(
    <PascalViewer
      viewModel={viewModelFor(state)}
      canvasRef={{ current: null }}
      onRetry={vi.fn()}
      onExpand={vi.fn()}
    />,
  );

describe('[A11] bảy trạng thái', () => {
  it.each(STATES)('dựng được trạng thái "%s" và KHÔNG ra màn trắng', (state) => {
    const { container } = renderState(state);

    expect(container.firstElementChild).not.toBeNull();
    expect(container.textContent?.trim()).not.toBe('');
  });

  it('dựng đủ bảy, không thiếu cái nào', () => {
    expect(new Set(STATES).size).toBe(7);
  });

  it('mỗi trạng thái nói ra chính nó cho trình đọc màn hình', () => {
    for (const state of STATES) {
      const { unmount } = renderState(state);
      expect(screen.getByRole('status')).toHaveTextContent(PASCAL_VIEWER_CAPTIONS[state]);
      unmount();
    }
  });
});

describe('[A6] nhãn tiếng Việt', () => {
  it.each(STATES)('trạng thái "%s" không sót chữ Anh và không mất dấu', (state) => {
    const { container } = renderState(state);
    // `Pascal` là tên sản phẩm — ngoại lệ hợp lệ, cùng loại với tên phím và mã lỗi.
    expectVietnamese(container, { allowWords: ['Pascal'] });
  });
});

describe('khả năng tiếp cận', () => {
  it.each(STATES)('trạng thái "%s" qua được bộ soát', (state) => {
    const { container } = renderState(state);
    expectAccessible(container);
  });
});

describe('khung nhúng chỉ có mặt khi có cảnh thật', () => {
  it('loading, success và partial đều có hộp cho Pascal cắm vào', () => {
    // `loading` PHẢI có hộp. Thiếu nó là vòng chết: hook cần hộp mới nạp gói,
    // mà muốn tới `success` thì phải nạp xong. Xem chú thích trong PascalViewer.tsx.
    for (const state of ['loading', 'success', 'partial'] as const) {
      const { unmount } = renderState(state);
      expect(screen.getByTestId('pascal-canvas')).toBeInTheDocument();
      unmount();
    }
  });

  it('bốn trạng thái còn lại KHÔNG dựng hộp — không chạy WebGL khi không cần', () => {
    for (const state of ['empty', 'error', 'forbidden', 'collapsed'] as const) {
      const { unmount } = renderState(state);
      expect(screen.queryByTestId('pascal-canvas')).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe('lỗi và thu gọn đều có đường đi tiếp', () => {
  it('lỗi hiện mã đọc được, để báo người trực', () => {
    renderState('error');
    expect(screen.getByText(/PASCAL-01/)).toBeInTheDocument();
  });

  it('lỗi có nút thử lại, và nó gọi đúng hàm', () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <PascalViewer
        viewModel={viewModelFor('error')}
        canvasRef={{ current: null }}
        onRetry={onRetry}
        onExpand={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('thu gọn có nút mở khung xem, và nó gọi đúng hàm', () => {
    const onExpand = vi.fn();
    renderWithProviders(
      <PascalViewer
        viewModel={viewModelFor('collapsed')}
        canvasRef={{ current: null }}
        onRetry={vi.fn()}
        onExpand={onExpand}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'mở khung xem' }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});

describe('phần bị bỏ qua nói rõ cái gì và vì sao', () => {
  it('partial liệt kê từng loại kèm số đếm và lý do', () => {
    renderState('partial');

    const list = screen.getByRole('list');

    for (const item of SKIPPED) {
      expect(list).toHaveTextContent(item.kind);
      expect(list).toHaveTextContent(item.countLabel);
      expect(list).toHaveTextContent(item.reason);
    }
  });

  it('success không liệt kê gì — không có gì bị bỏ qua thì không có khối ấy', () => {
    renderState('success');
    expect(screen.queryByText('chưa chuyển sang được')).not.toBeInTheDocument();
  });
});
