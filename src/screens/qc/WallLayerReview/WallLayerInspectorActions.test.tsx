import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WallId } from '@/domain/spatial/types';
import { renderWithProviders } from '@/lib/testing/render';

import type { WallLayerViewProps } from './types';
import { parseCustomThickness } from './customThickness';
import { WallLayerInspectorPanel } from './WallLayerInspectorPanel';
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

    renderWithProviders(<WallLayerInspectorPanel panel={lockedPanel(onOpenScale)} />);

    expect(screen.getByRole('combobox', { name: 'Độ dày tường' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Duyệt đoạn này/u })).toBeNull();
    expect(screen.getByText(reason)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt tỷ lệ' }));
    expect(onOpenScale).toHaveBeenCalledTimes(1);
  });

  it('panel: mục Kích thước/Độ tin cậy/Loại; điểm tin cậy chỉ ở "Thông số nâng cao"; một hàng nút ở chân', () => {
    const unlocked = { ...lockedPanel(vi.fn()), scaleLock: null, onDelete: vi.fn() } as unknown as WallLayerViewProps;

    renderWithProviders(<WallLayerInspectorPanel panel={unlocked} />);

    expect(screen.queryByRole('heading', { name: 'Đoạn tường' })).toBeNull();
    const size = screen.getByRole('region', { name: 'Kích thước' });
    expect(size).toHaveTextContent('Dài');
    expect(size).toHaveTextContent('5.757 mm');
    expect(screen.getByRole('region', { name: 'Độ tin cậy' })).toHaveTextContent('Máy chưa chắc');
    expect(screen.getByRole('region', { name: 'Loại' })).toHaveTextContent('Chiều cao');
    expect(screen.getByText('Vật liệu')).toBeInTheDocument();
    expect(screen.queryByText('Điểm tin cậy')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thông số nâng cao' }));
    expect(screen.getByText('Điểm tin cậy')).toBeInTheDocument();

    const approve = screen.getByRole('button', { name: 'Duyệt đoạn này' });
    expect(approve.parentElement).toBe(screen.getByRole('button', { name: 'Để sau' }).parentElement);
    expect(approve.parentElement).toBe(screen.getByRole('button', { name: 'Xoá đoạn này' }).parentElement);
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
    fireEvent.click(screen.getByRole('button', { name: 'Xoá thật' }));
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
describe('UX-10: độ dày "Khác…" nhận số mm của bản vẽ', () => {
  it('nhận số nguyên 60–600, từ chối ngoài khoảng và chữ', () => {
    expect(parseCustomThickness('240')).toBe(240);
    expect(parseCustomThickness(' 120 ')).toBe(120);
    expect(parseCustomThickness('59')).toBeNull();
    expect(parseCustomThickness('601')).toBeNull();
    expect(parseCustomThickness('12.5')).toBeNull();
    expect(parseCustomThickness('')).toBeNull();
  });
});
