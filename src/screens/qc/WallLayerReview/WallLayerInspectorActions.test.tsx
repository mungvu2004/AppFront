import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WallId } from '@/domain/spatial/types';
import { renderWithProviders } from '@/lib/testing/render';

import type { WallLayerViewProps } from './types';
import { WallLayerInspector } from './WallLayerInspector';
import { WallLayerInspectorActions } from './WallLayerInspectorActions';
import type { WallRowExtra } from './wallReviewQueue';

const panel = {
  isViewerRole: false,
  viewerRoleNotice: '',
  onApprove: vi.fn(),
  onUnapprove: vi.fn(),
  onSkip: vi.fn(),
} as unknown as WallLayerViewProps;
const extra = { targetMm: 220 } as unknown as WallRowExtra;
const wallId = 'W-001' as WallId;

afterEach(cleanup);

describe('K09: chưa có tỷ lệ thì không ép về chuẩn', () => {
  it('có câu khoá: ẩn "Đổi về … mm", hiện câu dẫn đi đặt tỷ lệ', () => {
    const onStandardize = vi.fn();
    const lockText = 'Tường đo ra 12–30 mm vì chưa có tỷ lệ. Đặt tỷ lệ trước.';

    renderWithProviders(
      <WallLayerInspectorActions
        extra={extra}
        isNonStandard
        isReviewed={false}
        lockText={lockText}
        onStandardize={onStandardize}
        panel={panel}
        thicknessMm={27}
        wallId={wallId}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Đổi về 220 mm' })).toBeNull();
    expect(screen.getByText(lockText)).toBeInTheDocument();
  });

  it('không khoá: nút "Đổi về … mm" chạy lệnh', () => {
    const onStandardize = vi.fn();

    renderWithProviders(
      <WallLayerInspectorActions
        extra={extra}
        isNonStandard
        isReviewed={false}
        lockText={null}
        onStandardize={onStandardize}
        panel={panel}
        thicknessMm={260}
        wallId={wallId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đổi về 220 mm' }));
    expect(onStandardize).toHaveBeenCalledWith(wallId);
  });
});

describe('khoá tỷ lệ (useScaleLock) ở thanh tra', () => {
  const reason = 'Đặt tỷ lệ trước: tầng này chưa có tỷ lệ đúng';
  const lockedPanel = (onOpenScale: () => void, onChangeThickness = vi.fn()) =>
    ({
      ...panel,
      rows: [],
      thicknessChoices: [100, 220],
      thicknessFocusRequest: 0,
      onChangeThickness,
      scaleLock: { reason, onOpenScale },
      inspector: {
        id: wallId,
        codeLabel: '#W-001',
        thicknessMm: 220,
        lengthLabel: '5.757 mm',
        heightLabel: '3.000 mm',
        confidence: 0.5,
        confidenceText: 'Máy chưa chắc',
        kindLabel: 'Tường gạch',
        advanced: { confidenceLabel: '0,50', elevationOffsetLabel: '0 mm', startPointLabel: '(0, 0)', endPointLabel: '(1, 0)' },
      },
    }) as unknown as WallLayerViewProps;

  it('ô độ dày tắt, không nút duyệt; có lý do và nút "Đặt tỷ lệ"', () => {
    const onOpenScale = vi.fn();

    renderWithProviders(<WallLayerInspector panel={lockedPanel(onOpenScale)} />);

    expect(screen.getByRole('combobox', { name: 'Độ dày tường' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Duyệt đoạn này/u })).toBeNull();
    expect(screen.getByText(reason)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt tỷ lệ' }));
    expect(onOpenScale).toHaveBeenCalledTimes(1);
  });
});

describe('U16: nút "Xoá đoạn này" ở thanh tra', () => {
  it('đoạn chưa duyệt có nút xoá, bấm thì gọi onDelete', () => {
    const onDelete = vi.fn();

    renderWithProviders(
      <WallLayerInspectorActions
        extra={undefined}
        isNonStandard={false}
        isReviewed={false}
        panel={{ ...panel, onDelete } as unknown as WallLayerViewProps}
        thicknessMm={220}
        wallId={wallId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xoá đoạn này' }));
    expect(onDelete).toHaveBeenCalledWith(wallId);
  });

  it('U50: tường bao hỏi lại một câu trước khi xoá', () => {
    const onDelete = vi.fn();

    renderWithProviders(
      <WallLayerInspectorActions
        confirmDelete
        extra={undefined}
        isNonStandard={false}
        isReviewed={false}
        panel={{ ...panel, onDelete } as unknown as WallLayerViewProps}
        thicknessMm={330}
        wallId={wallId}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Xoá đoạn này' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Giữ lại' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xoá đoạn này' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá tường bao' }));
    expect(onDelete).toHaveBeenCalledWith(wallId);
  });

  it('vai người xem: không có nút xoá', () => {
    renderWithProviders(
      <WallLayerInspectorActions
        extra={undefined}
        isNonStandard={false}
        isReviewed={false}
        panel={{ ...panel, isViewerRole: true, onDelete: vi.fn() } as unknown as WallLayerViewProps}
        thicknessMm={220}
        wallId={wallId}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Xoá đoạn này' })).toBeNull();
  });
});
