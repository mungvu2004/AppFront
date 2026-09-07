/**
 * Test của `OverlayComparisonToolbar` — dựng từ props, không store, không mạng
 * (R-60). Dữ liệu lấy nguyên từ `overlayComparisonScenarios.ts` (R-70): không
 * bịa một con số hay một chuỗi nào tại chỗ.
 *
 * ## Vì sao file này do Lớp 3 viết, không phải worker viết thanh công cụ
 *
 * Worker L2-3 viết cả `OverlayComparisonToolbar.tsx` lẫn
 * `OverlayComparisonPanel.tsx`, nhưng danh sách trắng của nó chỉ có
 * `OverlayComparisonPanel.test.tsx`. Nó theo đúng phạm vi được giao — chỗ hụt
 * nằm ở brief, không ở worker. Bốn phép chứng minh dưới đây là bốn thứ ĐẶC TẢ
 * NÊU ĐÍCH DANH mà chưa có gì khẳng định.
 *
 * ## `expectAccessible` chạy được ở đây, khác với test của panel
 *
 * Test của panel cố ý bỏ `expectAccessible` vì `Table.Row` khi đó còn trượt
 * vòng tiêu điểm. Thanh công cụ dùng `Slider` — chốt chặn thứ hai của mục E —
 * và bản vá `src/components/ui/Slider.tsx` ĐÃ được gộp vào nhánh này từ
 * `overlay-a11y`, nên phép soát chạy thật chứ không bị bỏ qua.
 */

import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';

import { OverlayComparisonToolbar } from './OverlayComparisonToolbar';
import { OVERLAY_COMPARISON_SCENARIOS } from './overlayComparisonScenarios';
import { COMPARE_MODE_LABELS } from './types';
import type { OverlayComparisonState, OverlayComparisonToolbarProps } from './types';

/**
 * Props của thanh công cụ, lấy từ một trong bảy kịch bản.
 *
 * `isStacked` và `canEdit` không nằm trong viewmodel — hook suy chúng ra từ
 * `state` và `role` — nên chúng được suy lại đúng cách đó ở đây: `collapsed` là
 * trạng thái thanh xếp hai hàng, `forbidden` là trạng thái chỉ được xem.
 */
function toolbarPropsOf(
  state: OverlayComparisonState,
  overrides: Partial<OverlayComparisonToolbarProps> = {},
): OverlayComparisonToolbarProps {
  const scenario = OVERLAY_COMPARISON_SCENARIOS[state];

  return {
    floors: scenario.floors,
    activeFloorId: scenario.activeFloorId,
    compareMode: scenario.compareMode,
    disabledCompareModes: scenario.disabledCompareModes,
    scanOpacityPercent: scenario.scanOpacityPercent,
    scanOpacityText: scenario.scanOpacityText,
    isAlignmentLocked: scenario.isAlignmentLocked,
    isStacked: state === 'collapsed',
    canEdit: state !== 'forbidden',
    onSelectFloor: vi.fn(),
    onSetCompareMode: vi.fn(),
    onSetScanOpacity: vi.fn(),
    onToggleAlignmentLock: vi.fn(),
    ...overrides,
  };
}

/** Nút của một kiểu đối chiếu trong `SegmentedControl` — nó dựng `radiogroup`. */
function compareModeButton(label: string): HTMLElement {
  return within(screen.getByRole('radiogroup', { name: 'kiểu đối chiếu' })).getByRole('radio', {
    name: label,
  });
}

/**
 * Nút kéo của `Slider`.
 *
 * `Slider` không dựng `<input type="range">` mà một `div role="slider"`, nên
 * `toBeDisabled()` không áp được: hợp đồng "đang tắt" của nó là nút kéo rơi
 * khỏi đường đi bàn phím (`tabIndex={-1}`, `Slider.tsx:143`) và cả hai tay cầm
 * chuột/phím đều thoát sớm. Đọc đúng hợp đồng đó thay vì đòi component một
 * thuộc tính nó không hứa — sửa `src/components/ui` là việc R-68 cấm ở đây.
 */
function scanOpacitySlider(): HTMLElement {
  return screen.getByRole('slider', { name: 'độ mờ ảnh nguồn' });
}

describe('OverlayComparisonToolbar', () => {
  it('tắt kiểu "cạnh nhau" kèm caption ĐỌC ĐƯỢC khi nó nằm trong disabledCompareModes', () => {
    /* Kịch bản `collapsed` là chỗ duy nhất của bộ mẫu có `disabledCompareModes`,
       và lý do nó mang chính là câu đặc tả đòi: "Dưới 1280: kiểu 'Cạnh nhau' bị
       tắt kèm caption giải thích vì sao." */
    const scenario = OVERLAY_COMPARISON_SCENARIOS.collapsed;
    const reason = scenario.disabledCompareModes.sideBySide;

    renderWithProviders(<OverlayComparisonToolbar {...toolbarPropsOf('collapsed')} />);

    expect(compareModeButton(COMPARE_MODE_LABELS.sideBySide)).toBeDisabled();

    /* Hai kiểu còn lại KHÔNG bị tắt lây — nếu không, phép kiểm trên vẫn xanh
       với một thanh công cụ chết hoàn toàn. */
    expect(compareModeButton(COMPARE_MODE_LABELS.overlay)).toBeEnabled();
    expect(compareModeButton(COMPARE_MODE_LABELS.swipe)).toBeEnabled();

    /* Cốt lõi: caption là VĂN BẢN THẬT trong cây, không phải thuộc tính `title`.
       `getByText` chỉ thấy nội dung đọc được, nên nó phân biệt được đúng hai
       thứ mà đặc tả phân biệt. Câu in ra nêu tên kiểu bị tắt để người nghe biết
       lý do nói về kiểu nào. */
    if (reason === undefined) {
      throw new Error('kịch bản collapsed phải mang lý do tắt kiểu "cạnh nhau"');
    }

    const caption = screen.getByText(`${COMPARE_MODE_LABELS.sideBySide} — ${reason}`);
    expect(caption).toBeInTheDocument();
    expect(caption.getAttribute('title')).toBeNull();
  });

  it('không in caption nào khi mọi kiểu đối chiếu đều dùng được', () => {
    renderWithProviders(<OverlayComparisonToolbar {...toolbarPropsOf('success')} />);

    for (const label of Object.values(COMPARE_MODE_LABELS)) {
      expect(compareModeButton(label)).toBeEnabled();
    }

    expect(
      screen.queryByText(OVERLAY_COMPARISON_SCENARIOS.collapsed.disabledCompareModes.sideBySide ?? ''),
    ).not.toBeInTheDocument();
  });

  it('xếp hai hàng khi isStacked, và một hàng cao 40 khi không', () => {
    const { unmount } = renderWithProviders(
      <OverlayComparisonToolbar {...toolbarPropsOf('collapsed')} />,
    );

    const stacked = screen.getByRole('toolbar', { name: 'thanh công cụ đối chiếu bản vẽ' });
    expect(stacked.className).toContain('flex-col');
    expect(stacked.className).not.toContain('h-10');

    unmount();

    renderWithProviders(<OverlayComparisonToolbar {...toolbarPropsOf('success')} />);

    const inline = screen.getByRole('toolbar', { name: 'thanh công cụ đối chiếu bản vẽ' });
    expect(inline.className).toContain('h-10');
    expect(inline.className).not.toContain('flex-col');
  });

  it('canEdit === false tắt MỌI điều khiển, và nói ra được vì sao', () => {
    const { container } = renderWithProviders(
      <OverlayComparisonToolbar {...toolbarPropsOf('forbidden')} />,
    );

    /* Bốn cụm điều khiển của thanh, kiểm từng cái một: một cụm quên `disabled`
       là một đường người chỉ-được-xem vẫn đổi được căn chỉnh. */
    expect(screen.getByLabelText('chọn tầng')).toBeDisabled();
    expect(scanOpacitySlider()).toHaveAttribute('tabindex', '-1');
    expect(screen.getByLabelText('khoá căn')).toBeDisabled();
    for (const label of Object.values(COMPARE_MODE_LABELS)) {
      expect(compareModeButton(label)).toBeDisabled();
    }

    /* "Nói ra được vì sao": lý do là văn bản trong cây, không phải một ô xám
       không giải thích gì. */
    expect(
      screen.getByText('bạn không có quyền sửa, các điều khiển đang tắt.'),
    ).toBeInTheDocument();

    expectVietnamese(container);
  });

  it('hiện đúng scanOpacityText của bộ mẫu, và Slider mang aria-label tiếng Việt', () => {
    const scenario = OVERLAY_COMPARISON_SCENARIOS.success;
    const { container } = renderWithProviders(
      <OverlayComparisonToolbar {...toolbarPropsOf('success')} />,
    );

    /* Chuỗi phần trăm ĐÃ được hook ghép sẵn (A15) — view chỉ in lại. Đọc thẳng
       từ kịch bản để test không thể tự chốt một cách định dạng khác. */
    expect(screen.getByText(scenario.scanOpacityText)).toBeInTheDocument();

    const slider = scanOpacitySlider();
    expect(slider).toHaveAttribute('aria-valuenow', String(scenario.scanOpacityPercent));
    /* Còn với `canEdit === true` thì nút kéo phải NẰM TRÊN đường đi bàn phím —
       vế đối của phép kiểm ở bài trên, để "tắt" và "bật" không cùng xanh. */
    expect(slider).toHaveAttribute('tabindex', '0');

    /* Chốt chặn mục E: `Slider` đã được vá trên nhánh `overlay-a11y`, nên phép
       soát này chạy thật. */
    expectAccessible(container);
    expectVietnamese(container);
  });
});
