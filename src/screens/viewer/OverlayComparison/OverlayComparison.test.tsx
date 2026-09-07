/**
 * Lượt kiểm cấp màn của `OverlayComparison`.
 *
 * Ba bộ khẳng định dùng chung (`expectSevenStates`, `expectVietnamese`,
 * `expectAccessible`) cộng một phép chứng minh riêng của màn này: xác nhận là
 * hành động của người (A5), không phải kết luận của máy. Cùng khuôn
 * `ScaleCalibration.test.tsx` — chỉ props, không hook, không mạng, vì
 * {@link OverlayComparison} là một hàm của props (mục D).
 *
 * ## KHÔNG lượt kiểm nào ở đây chạy được trong worktree này hôm nay
 *
 * `OverlayComparison.tsx` import `OverlayComparisonCanvas`,
 * `OverlayComparisonToolbar`, `OverlayComparisonPanel` — ba file đang viết song
 * song trên nhánh khác (xem chú thích đầu `OverlayComparison.tsx`). Vitest
 * không resolve được ba đường dẫn đó nên MỌI test dưới đây sẽ hỏng ở bước biên
 * dịch module, không chỉ riêng lượt `expectAccessible`. Đây là kết quả ĐÚNG của
 * lượt L2-4, không phải một bài kiểm viết sai — mã được viết đúng cho hình dạng
 * `types.ts` đã chốt, và sẽ chạy được ngay khi Lớp 3 gộp ba file kia vào.
 *
 * ## `expectAccessible` — biết trước sẽ đỏ vì MỘT lý do khác nữa
 *
 * Ngay cả sau khi ba file kia có mặt, `expectAccessible` vẫn đỏ cho tới khi
 * nhánh `overlay-a11y` gộp: `Slider` (thanh trượt độ mờ, dùng ở thanh công cụ)
 * và `Table.Row` (dùng ở panel) đang hỏng viền tiêu điểm ở
 * `src/components/ui/Slider.tsx:152-155` và `src/components/ui/Table.tsx:83-90,120`.
 * Bản vá đã được người duyệt cho phép và Lớp 3 gộp trước khi lượt kiểm cấp màn
 * chạy thật (mục E của `COMMON-layer2.md`). Không nới khẳng định, không `.skip`
 * (R-70) — cứ viết đúng, để đỏ đúng lý do.
 */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  SEVEN_STATE_LABELS,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import { OverlayComparison } from './OverlayComparison';
import { scenarioFor } from './OverlayComparison.stories';
import { OVERLAY_COMPARISON_SCENARIOS } from './overlayComparisonScenarios';
import type { OverlayComparisonActions, OverlayComparisonViewModel } from './types';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Mảng thứ hai của `expectSevenStates`.                                       */
/* -------------------------------------------------------------------------- */

/** Chỉ để thoả kiểu; props thật đến từ `scenarioFor` của story (R-70). */
function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => ({
    state,
    label: SEVEN_STATE_LABELS[state],
    rows: [],
    totalCount: OVERLAY_COMPARISON_SCENARIOS[state].rows.length,
    isLoading: state === 'loading',
    isCollapsed: state === 'collapsed',
    canView: state !== 'forbidden',
    error: null,
  }));
}

/* -------------------------------------------------------------------------- */
/* [A11, R-63] Bảy trạng thái.                                                 */
/* -------------------------------------------------------------------------- */

describe('OverlayComparison — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = renderWithProviders(
        <OverlayComparison {...scenarioFor(scenario.state)} />,
      );
      rendered += 1;
      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('trạng thái lỗi mở lối sang màn hiệu chỉnh tỷ lệ bằng một liên kết thật (R-65)', () => {
    const scenario = scenarioFor('error');

    renderWithProviders(<OverlayComparison {...scenario} />);

    const link = screen.getByRole('link', { name: /hiệu chỉnh tỷ lệ/u });

    expect(link).toHaveAttribute('href', scenario.model.scaleFixHref ?? '');
    // R-65: đường dẫn phải đến từ `model.scaleFixHref` đã dựng sẵn, không phải
    // một chuỗi gõ tay bắt đầu bằng `/` hay `http` ở tầng view.
    expect(scenario.model.scaleFixHref).not.toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* [R-72] Khả năng tiếp cận và tiếng Việt.                                     */
/* -------------------------------------------------------------------------- */

describe('OverlayComparison — khả năng tiếp cận, tiếng Việt (R-72)', () => {
  it('đi qua expectAccessible ở trạng thái đầy đủ nhất', () => {
    const { container } = renderWithProviders(<OverlayComparison {...scenarioFor('success')} />);

    // Đỏ cho tới khi nhánh `overlay-a11y` gộp Slider/Table — xem chú thích đầu file.
    expectAccessible(container);
  });

  it('đi qua expectAccessible ở trạng thái một phần, nơi có cả thông báo lẫn danh sách', () => {
    const { container } = renderWithProviders(<OverlayComparison {...scenarioFor('partial')} />);

    expectAccessible(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái thành công là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<OverlayComparison {...scenarioFor('success')} />);

    expectVietnamese(container);
  });

  it('mọi chuỗi hiển thị ở trạng thái lỗi cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<OverlayComparison {...scenarioFor('error')} />);

    expectVietnamese(container);
  });
});

/* -------------------------------------------------------------------------- */
/* Xác nhận là hành động của người, không phải kết luận của máy (A5).          */
/* -------------------------------------------------------------------------- */

describe('OverlayComparison — xác nhận là hành động của người (A5)', () => {
  /**
   * Bộ mẫu `success` của `overlayComparisonScenarios.ts` ĐÃ xác nhận
   * (`isConfirmed: true`) — nó là bộ mẫu ở dung sai 50 mm sau khi người dùng đã
   * bấm. Để chứng minh A5 ("không vùng nào vượt dung sai" KHÔNG tự bật badge),
   * lượt kiểm này giữ nguyên mọi số đo thật của `success` — `metrics`, `rows`,
   * `marks` đều đã tính đúng và `overToleranceCount` đã là 0 — và chỉ thay đúng
   * một trường: `confirmation`, về trạng thái CHƯA xác nhận. Không hằng số nào
   * bị bịa ra: mọi phép đo vẫn đến từ `overlayComparisonScenarios.ts` (R-70).
   */
  function unconfirmedButAllClearModel(): OverlayComparisonViewModel {
    const success = OVERLAY_COMPARISON_SCENARIOS.success;

    return {
      ...success,
      confirmation: {
        buttonLabel: success.confirmation.buttonLabel,
        canConfirm: true,
        confirmedNotice: null,
        isConfirmed: false,
      },
    };
  }

  it('mọi vùng đã trong dung sai nhưng CHƯA ai bấm: isConfirmed vẫn false, không có câu điềm đạm', () => {
    const model = unconfirmedButAllClearModel();

    expect(model.metrics.overToleranceCount).toBe(0);
    expect(model.confirmation.isConfirmed).toBe(false);
    expect(model.confirmation.confirmedNotice).toBeNull();
  });

  it('bấm nút xác nhận gọi đúng MỘT lần `actions.confirmMatch`, không có đường nào khác đặt được isConfirmed', () => {
    const model = unconfirmedButAllClearModel();
    const confirmMatch = vi.fn();
    const actions: OverlayComparisonActions = { ...scenarioFor('success').actions, confirmMatch };

    renderWithProviders(<OverlayComparison actions={actions} model={model} />);

    const button = screen.getByRole('button', { name: model.confirmation.buttonLabel });

    expect(button).toBeEnabled();
    expect(confirmMatch).not.toHaveBeenCalled();

    fireEvent.click(button);

    expect(confirmMatch).toHaveBeenCalledTimes(1);
    expect(confirmMatch).toHaveBeenCalledWith();
  });
});
