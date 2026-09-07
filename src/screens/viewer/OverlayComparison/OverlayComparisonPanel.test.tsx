/**
 * Test của `OverlayComparisonPanel` — dựng từ props, không store, không mạng
 * (R-60). Dữ liệu lấy nguyên từ `overlayComparisonScenarios.ts` (R-70): không
 * bịa một con số hay một chuỗi nào tại chỗ.
 *
 * `expectAccessible` KHÔNG được gọi ở đây — `Table.Row` đang trượt vì viền
 * tiêu điểm do prop `focused` điều khiển (`COMMON-layer2.md` mục E), và bản vá
 * do worker `overlay-a11y` viết song song chưa có trong worktree này.
 *
 * ## Vì sao số vùng vượt ngưỡng được đọc từ đoạn `role="status"`, không phải
 * đoạn `aria-hidden`
 *
 * `OverToleranceStat` chạy số bằng `useCountUp` (khung hình thật, không giả
 * lập đồng hồ ở đây) — đoạn hiển thị (`aria-hidden`) có thể còn đang chạy giữa
 * chừng ngay sau khi render. Đoạn dành cho trình đọc màn hình
 * (`role="status"`) in thẳng con số thô ngay từ khung đầu tiên (đúng khuôn
 * `ThicknessSummary.tsx:40-58`), nên đó là chỗ đọc được số cuối cùng mà không
 * cần chờ hoạt cảnh.
 */

import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import { OverlayComparisonPanel } from './OverlayComparisonPanel';
import { OVERLAY_COMPARISON_SCENARIOS } from './overlayComparisonScenarios';
import type { OverlayComparisonPanelProps, OverlayComparisonState } from './types';

function panelPropsOf(
  state: OverlayComparisonState,
  overrides: Partial<OverlayComparisonPanelProps> = {},
): OverlayComparisonPanelProps {
  const scenario = OVERLAY_COMPARISON_SCENARIOS[state];

  return {
    metrics: scenario.metrics,
    toleranceMm: scenario.toleranceMm,
    toleranceLabel: scenario.toleranceLabel,
    rows: scenario.rows,
    confirmation: scenario.confirmation,
    canEdit: true,
    onSetToleranceMm: vi.fn(),
    onSelectRegion: vi.fn(),
    onConfirmMatch: vi.fn(),
    ...overrides,
  };
}

/** Chốt tay: gõ rồi rời khỏi ô, đúng khuôn `CreateProjectModal.test.tsx:289-293`. */
function setTolerance(text: string): void {
  const field = screen.getByLabelText('dung sai');
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
}

describe('OverlayComparisonPanel', () => {
  it('hiện đúng ba con số khớp ở kịch bản một phần, và toàn màn là tiếng Việt', () => {
    const { container } = renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('partial')} />);

    /* "41 mm" trùng với độ lệch lớn nhất TRONG BẢNG (cùng là 41), nên khoanh
       vùng đúng khối ba con số đầu panel — không phải cả màn — để tránh khớp
       nhầm sang ô của bảng. */
    const metricsRegion = screen.getByRole('status').closest('.grid');
    if (metricsRegion === null) {
      throw new Error('không tìm thấy khối ba con số khớp');
    }

    expect(within(metricsRegion as HTMLElement).getByText('8 mm')).toBeInTheDocument();
    expect(within(metricsRegion as HTMLElement).getByText('41 mm')).toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('3 số vùng vượt ngưỡng');

    /* "dung sai" (từ `toleranceLabel` đóng băng trong overlayComparisonScenarios.ts)
       là tiếng Việt đúng chính tả nhưng không âm tiết nào mang dấu — đúng "điểm
       mù đã biết" mà `expectVietnamese.ts:63-66` ghi rõ cho một cụm hai từ không
       dấu. `allowWords` là lối thoát tài liệu hoá sẵn cho đúng trường hợp này. */
    expectVietnamese(container, { allowWords: ['dung', 'sai'] });
  });

  it('hiện dấu gạch ngang cho ca chưa đo được, không phải "0 mm"', () => {
    renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('empty')} />);

    expect(screen.queryByText('0 mm')).not.toBeInTheDocument();
    expect(screen.getByRole('status').textContent).toBe('— số vùng vượt ngưỡng');
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('gọi onSetToleranceMm với số milimét khi đổi dung sai', () => {
    const onSetToleranceMm = vi.fn();
    renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('partial', { onSetToleranceMm })} />);

    setTolerance('25');

    expect(onSetToleranceMm).toHaveBeenCalledWith(25);
  });

  it('bấm một hàng gọi onSelectRegion đúng id', () => {
    const onSelectRegion = vi.fn();
    const { rows } = OVERLAY_COMPARISON_SCENARIOS.partial;
    renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('partial', { onSelectRegion })} />);

    const firstRow = rows[0];
    if (firstRow === undefined) {
      throw new Error('kịch bản partial phải có ít nhất một vùng lệch');
    }

    fireEvent.click(screen.getByText(firstRow.referenceLabel));

    expect(onSelectRegion).toHaveBeenCalledWith(firstRow.id);
    expect(onSelectRegion).toHaveBeenCalledTimes(1);
  });

  it('giữ nguyên thứ tự hàng nhận được, không tự sắp lại', () => {
    renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('partial')} />);

    const renderedOrder = screen
      .getAllByRole('row')
      .slice(1) // bỏ hàng tiêu đề
      .map((row) => row.querySelector('td')?.textContent);

    const expectedOrder = OVERLAY_COMPARISON_SCENARIOS.partial.rows.map((row) => row.referenceLabel);

    expect(renderedOrder).toEqual(expectedOrder);
  });

  it('nút xác nhận không tự bật ở kịch bản xong khi canConfirm là false', () => {
    renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('success')} />);

    const confirmButton = screen.getByRole('button', {
      name: OVERLAY_COMPARISON_SCENARIOS.success.confirmation.buttonLabel,
    });

    expect(confirmButton).toBeDisabled();
  });
});
