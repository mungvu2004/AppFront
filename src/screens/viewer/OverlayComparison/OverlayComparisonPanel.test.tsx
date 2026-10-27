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
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
    canEdit: true,
    onSetToleranceMm: vi.fn(),
    onSelectRegion: vi.fn(),
    ...overrides,
  };
}

/** Chốt tay: gõ rồi rời khỏi ô, đúng khuôn `CreateProjectModal.test.tsx:289-293`. */
function setTolerance(text: string): void {
  const field = screen.getByLabelText('Dung sai');
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
}

describe('OverlayComparisonPanel', () => {
  it('hiện hai con số sai số ở kịch bản một phần, và toàn màn là tiếng Việt', () => {
    const { container } = renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('partial')} />);

    /* "41 mm" trùng với độ lệch lớn nhất TRONG BẢNG, nên khoanh vùng đúng khối sai số.
       Số vùng vượt dung sai nằm ở câu trạng thái đầu màn (S-28 v6), xem OverlayComparison.test. */
    const metricsRegion = screen.getByRole('group', { name: 'Sai số đo được' });

    expect(within(metricsRegion).getByText('8 mm')).toBeInTheDocument();
    expect(within(metricsRegion).getByText('41 mm')).toBeInTheDocument();

    /* "Dung sai" (từ `toleranceLabel` đóng băng trong overlayComparisonScenarios.ts)
       là tiếng Việt đúng chính tả nhưng không âm tiết nào mang dấu — đúng "điểm
       mù đã biết" mà `expectVietnamese.ts:63-66` ghi rõ cho một cụm hai từ không
       dấu. `allowWords` là lối thoát tài liệu hoá sẵn cho đúng trường hợp này. */
    expectVietnamese(container, { allowWords: ['dung', 'sai'] });
  });

  it('chưa đo được: một dòng nói thẳng, không ba ô gạch ngang, không "0 mm" (BUG-331)', () => {
    renderWithProviders(<OverlayComparisonPanel {...panelPropsOf('empty')} />);

    expect(screen.queryByText('0 mm')).not.toBeInTheDocument();
    expect(screen.getByText('Máy chưa đo được độ lệch. So hai lớp bằng mắt; lệch nhiều thì đặt lại tỷ lệ.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('[G4b-25] chưa đo được thì có lối sang màn căn ảnh', () => {
    renderWithProviders(
      <MemoryRouter initialEntries={['/projects/p/floors/f/overlay']}>
        <Routes>
          <Route
            element={<OverlayComparisonPanel {...panelPropsOf('empty')} alignHref="/projects/p/floors/f/scale" />}
            path="/projects/p/floors/f/overlay"
          />
          <Route element={<p>Màn hiệu chỉnh</p>} path="/projects/p/floors/f/scale" />
        </Routes>
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Lệch nhiều? Đặt tỷ lệ' });
    expect(link).toHaveAttribute('href', '/projects/p/floors/f/scale');
    // RV4#8: router Link, so the app navigates in place instead of reloading the page.
    fireEvent.click(link);
    expect(screen.getByText('Màn hiệu chỉnh')).toBeInTheDocument();
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
      .filter((row) => row.querySelector('td') !== null) // bỏ hàng tiêu đề cột và tiêu đề nhóm
      .map((row) => row.querySelector('td')?.textContent);

    const expectedOrder = OVERLAY_COMPARISON_SCENARIOS.partial.rows.map((row) => row.referenceLabel);

    expect(renderedOrder).toEqual(expectedOrder);
  });
});
