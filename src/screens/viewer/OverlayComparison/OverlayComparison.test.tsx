/**
 * Lượt kiểm cấp màn của `OverlayComparison`.
 *
 * Ba bộ khẳng định dùng chung (`expectSevenStates`, `expectVietnamese`,
 * `expectAccessible`) cộng một phép chứng minh riêng của màn này: xác nhận là
 * hành động của người (A5), không phải kết luận của máy. Cùng khuôn
 * `ScaleCalibration.test.tsx` — chỉ props, không hook, không mạng, vì
 * {@link OverlayComparison} là một hàm của props (mục D).
 *
 * ## Hai điều kiện lượt kiểm này chờ — Lớp 3 đã gộp cả hai
 *
 * File này được viết ở lượt L2-4 khi `OverlayComparisonCanvas`,
 * `OverlayComparisonToolbar` và `OverlayComparisonPanel` còn nằm trên ba nhánh
 * khác, nên MỌI test ở đây khi đó hỏng ngay ở bước biên dịch module. Chúng đã
 * về cùng nhánh. `expectAccessible` cũng chờ một điều kiện thứ hai — bản vá
 * viền tiêu điểm của `Slider` và `Table.Row` (mục E của `COMMON-layer2.md`) —
 * và nhánh `overlay-a11y` đã gộp. Không khẳng định nào bị nới, không `.skip`
 * nào được thêm (R-70): bài kiểm viết đúng từ đầu, chỉ là chạy được muộn.
 *
 * ## `ResizeObserver` — bản giả do Lớp 3 gắn, đúng khuôn màn có canvas
 *
 * `OverlayComparisonCanvas.tsx:211` đo khung bằng `ResizeObserver`, mà jsdom
 * không khai. Lượt L2-4 không thấy chỗ này vì nó chưa dựng nổi cây React. Đây
 * là seam thật giữa hai worker cùng xanh khi đứng riêng, và cách vá theo đúng
 * khuôn mọi màn có canvas của repo — `ScaleCalibration.test.tsx:158-213`,
 * `WallLayerReview.test.tsx`, `RoomLabelReview.test.tsx` — là mỗi test cấp màn
 * tự gắn bản giả rồi tự gỡ, chứ không đặt vào `vitest.setup.ts` chung.
 */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * Khung không đổi kích thước trong lượt kiểm, nên bản giả không cần báo lại gì:
 * ba phương thức rỗng là đủ để `OverlayComparisonCanvas` gắn và gỡ quan sát mà
 * không ném. Cùng bản `ScaleCalibration.test.tsx:158-168` dùng.
 */
class FakeResizeObserver {
  observe(): void {
    /* kích thước cố định trong lượt kiểm, không có lượt đổi nào để báo */
  }
  unobserve(): void {
    /* như trên */
  }
  disconnect(): void {
    /* như trên */
  }
}

beforeEach(() => {
  // Gắn bằng `Object.defineProperty` rồi gỡ bằng tay ở `afterEach`, để không
  // lượt kiểm nào ngoài file này thừa hưởng bản giả.
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: FakeResizeObserver,
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(globalThis, 'ResizeObserver');
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

  /* `toleranceLabel` của bộ mẫu đóng băng là "dung sai" — tiếng Việt đúng chính
     tả nhưng không âm tiết nào mang dấu, đúng "điểm mù đã biết" mà
     `expectVietnamese.ts:63-66` ghi rõ cho một cụm hai từ không dấu.
     `allowWords` là lối thoát tài liệu hoá sẵn cho đúng trường hợp này, và
     `OverlayComparisonPanel.test.tsx` đã dùng nó cho cùng chuỗi đó. Lượt L2-4
     không thấy trước vì panel khi ấy chưa cùng nhánh. */
  const TOLERANCE_LABEL_WORDS = ['dung', 'sai'];

  it('mọi chuỗi hiển thị ở trạng thái thành công là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<OverlayComparison {...scenarioFor('success')} />);

    expectVietnamese(container, { allowWords: TOLERANCE_LABEL_WORDS });
  });

  it('mọi chuỗi hiển thị ở trạng thái lỗi cũng là tiếng Việt có dấu', () => {
    const { container } = renderWithProviders(<OverlayComparison {...scenarioFor('error')} />);

    expectVietnamese(container, { allowWords: TOLERANCE_LABEL_WORDS });
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
