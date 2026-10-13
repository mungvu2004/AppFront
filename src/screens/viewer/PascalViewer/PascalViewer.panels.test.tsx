/**
 * Cột ba bảng phụ của màn Pascal (#45, #46, #33).
 *
 * View là thuần, nên "loại trừ nhau" kiểm được thẳng từ props mà không cần
 * WebGL, không cần Pascal, không cần store. Bài quan trọng nhất ở đây là bài
 * cuối: `activePanel` là MỘT giá trị, nên hai bảng cùng mở không biểu diễn
 * được — bài kiểm chỉ xác nhận view không tự chế ra một bảng thứ hai.
 */

import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import { PascalViewer } from './PascalViewer';
import {
  PASCAL_SIDE_PANEL_LABELS,
  PASCAL_VIEWER_CAPTIONS,
  PASCAL_VIEWER_TITLE,
  type PascalSidePanel,
  type PascalSidePanelId,
  type PascalViewerViewModel,
} from './pascalViewerTypes';

const VIEW_MODEL: PascalViewerViewModel = {
  state: 'success',
  title: PASCAL_VIEWER_TITLE,
  caption: PASCAL_VIEWER_CAPTIONS.success,
  summary: null,
  skipped: [],
  errorCode: null,
  saveLabel: null,
};

const PANELS: readonly PascalSidePanel[] = [
  {
    id: 'rooms',
    label: PASCAL_SIDE_PANEL_LABELS.rooms,
    render: () => <p>Nội dung bảng diện tích phòng</p>,
  },
  {
    id: 'history',
    label: PASCAL_SIDE_PANEL_LABELS.history,
    render: () => <p>Nội dung bảng lịch sử thao tác</p>,
  },
  {
    id: 'furniture',
    label: PASCAL_SIDE_PANEL_LABELS.furniture,
    render: () => <p>Nội dung bảng thư viện đồ đạc</p>,
  },
];

const renderPanels = (
  activePanel: PascalSidePanelId | null,
  onPanelChange: (panel: PascalSidePanelId | null) => void = vi.fn(),
) =>
  renderWithProviders(
    <PascalViewer
      viewModel={VIEW_MODEL}
      canvasRef={{ current: null }}
      onRetry={vi.fn()}
      onExpand={vi.fn()}
      panels={PANELS}
      activePanel={activePanel}
      onPanelChange={onPanelChange}
    />,
  );

describe('[#45] ba bảng phụ loại trừ nhau', () => {
  it('dựng đủ ba tab, chưa mở bảng nào', () => {
    renderPanels(null);

    for (const label of Object.values(PASCAL_SIDE_PANEL_LABELS)) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }

    for (const label of Object.values(PASCAL_SIDE_PANEL_LABELS)) {
      expect(screen.queryByRole('region', { name: label })).not.toBeInTheDocument();
    }
  });

  it('mở đúng MỘT bảng, và chỉ bảng ấy có nội dung', () => {
    renderPanels('history');

    expect(
      screen.getByRole('region', { name: PASCAL_SIDE_PANEL_LABELS.history }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: PASCAL_SIDE_PANEL_LABELS.rooms }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Nội dung bảng lịch sử thao tác')).toBeInTheDocument();
    expect(screen.queryByText('Nội dung bảng diện tích phòng')).not.toBeInTheDocument();
  });

  it('cột bảng rộng đúng 344 px', () => {
    renderPanels('rooms');

    expect(screen.getByRole('region', { name: PASCAL_SIDE_PANEL_LABELS.rooms })).toHaveClass(
      'w-[344px]',
    );
  });

  it('tab đang mở nói ra trạng thái của nó', () => {
    renderPanels('furniture');

    expect(
      screen.getByRole('button', { name: PASCAL_SIDE_PANEL_LABELS.furniture }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: PASCAL_SIDE_PANEL_LABELS.rooms })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('bấm tab đang mở thì đóng nó, bấm tab khác thì đổi sang', () => {
    const onPanelChange = vi.fn();
    renderPanels('history', onPanelChange);

    fireEvent.click(screen.getByRole('button', { name: PASCAL_SIDE_PANEL_LABELS.history }));
    expect(onPanelChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('button', { name: PASCAL_SIDE_PANEL_LABELS.rooms }));
    expect(onPanelChange).toHaveBeenLastCalledWith('rooms');
  });

  it('không truyền bảng nào thì không có cột bảng', () => {
    renderWithProviders(
      <PascalViewer
        viewModel={VIEW_MODEL}
        canvasRef={{ current: null }}
        onRetry={vi.fn()}
        onExpand={vi.fn()}
      />,
    );

    expect(screen.queryByRole('group', { name: 'Bảng phụ' })).not.toBeInTheDocument();
  });
});

describe('[#33] giảm chuyển động', () => {
  it('hoạt cảnh của cột tắt khi người dùng xin giảm chuyển động', () => {
    renderPanels('rooms');

    expect(screen.getByRole('region', { name: PASCAL_SIDE_PANEL_LABELS.rooms })).toHaveClass(
      'motion-reduce:transition-none',
    );
  });
});

describe('[A6] chữ của cột bảng là tiếng Việt có dấu', () => {
  it('ba nhãn tab đều qua được bộ soát', () => {
    const { container } = renderPanels('history');

    expectVietnamese(container);
  });
});
