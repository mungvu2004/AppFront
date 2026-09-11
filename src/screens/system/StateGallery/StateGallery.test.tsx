/**
 * Lượt kiểm cấp màn của `StateGallery` (S-47) — `/design-system/states`,
 * trang duyệt bảy trạng thái của cả 47 màn trong dự án.
 *
 * `StateGallery.tsx`, `stateGalleryManifest.ts`, `stateGalleryScenarios.ts`
 * CHƯA tồn tại trong worktree này — một worker khác đang viết cả ba, song
 * song, từ cùng hợp đồng `stateGalleryTypes.ts` (đóng băng ở commit trước).
 * File này vì vậy ĐỎ ngay ở ba dòng `import` dưới cho tới khi lớp gộp nối
 * nhánh lại; đó là kết quả ĐÚNG của lượt này (không `.skip`, không nới điều
 * kiện — R-70), cùng khuôn `MobileViewer.test.tsx`. View thuần: test được
 * chỉ từ props, không chạm store, không chạm mạng (mục D).
 *
 * ## Tên hàm/hằng dùng ở đây không phải bịa
 *
 * `stateGalleryScenarioFor`, `STATE_GALLERY_MANIFEST`, `galleryCoverage`,
 * `screenCoverage` là những tên thật của lớp manifest/scenario mà worker kia
 * đang dựng — không phải suy đoán tại chỗ (R-70): hợp đồng
 * `stateGalleryTypes.ts` đã ghi rõ "presentCount/totalCount do hàm dẫn xuất
 * tính, KHÔNG viết tay", nên một hàm dẫn xuất kiểu `galleryCoverage` là điều
 * bắt buộc phải tồn tại để hợp đồng tự nhất quán.
 *
 * ## Bài kiểm (a) — con số 329 là NGHIỆM THU của cả dự án
 *
 * `presentCount = 329`, `totalCount = 329`, `screenCount = 47` không phải số
 * viết tay: 47 màn × 7 trạng thái = 329. Bài kiểm dưới gọi thẳng
 * `galleryCoverage(STATE_GALLERY_MANIFEST)` — nếu worker kia bỏ sót một
 * story ở bất kỳ màn nào, con số tụt xuống dưới 329 và bài kiểm này đỏ đúng
 * như nó phải đỏ.
 *
 * ## Ba giả định phải đợi view thật để xác nhận
 *
 * Hợp đồng `StateGalleryProps` không nói rõ view dựng UI cách nào cho: (1)
 * hai công tắc/nút bấm dùng `role="switch"` hay `role="button"`, (2) bảng bốn
 * phép kiểm dùng `<table>`/`role="row"` hay div lưới, (3) Esc "đóng lớp trên
 * cùng" nghĩa là gì khi trang không có prop `onCloseXxx`/dialog nào trong hợp
 * đồng — suy luận hợp lý nhất viết ở đây là Esc xoá ô tìm kiếm
 * (`onSearchTextChange('')`) vì đó là lớp lọc "nổi trên" cây bên trái duy
 * nhất mà kiểu dữ liệu cho phép đóng mà không đổi kiểu `onSelectScreen`
 * (nó nhận `string`, không nhận `null`). Ba bài kiểm liên quan đánh dấu rõ
 * bằng bình luận NGAY TRÊN từng bài — nếu lớp gộp chọn cơ chế khác, chỉ sửa
 * đúng các bài đó, không sửa phần còn lại của file.
 */

import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { renderWithProviders } from '@/lib/testing/render';
import { SEVEN_STATES, SEVEN_STATE_LABELS, type SevenStateScenario } from '@/lib/testing/sevenStateScenarios';

import { StateGallery } from './StateGallery';
import { galleryCoverage, STATE_GALLERY_MANIFEST } from './stateGalleryManifest';
import { stateGalleryScenarioFor } from './stateGalleryScenarios';
import {
  QUICK_CHECK_IDS,
  type GalleryScreenEntry,
  type QuickCheckRow,
  type StateGalleryProps,
} from './stateGalleryTypes';

function renderStateGallery(props: StateGalleryProps) {
  return renderWithProviders(<StateGallery {...props} />);
}

const ALL_STATE_SCENARIOS = SEVEN_STATES.map((state) => ({
  state,
  props: stateGalleryScenarioFor(state),
}));

/* -------------------------------------------------------------------------- */
/* [A11] Bảy trạng thái, không lần nào ra màn trắng.                           */
/* -------------------------------------------------------------------------- */

function scenarioIndex(): readonly SevenStateScenario[] {
  return SEVEN_STATES.map((state) => {
    const props = stateGalleryScenarioFor(state);

    return {
      state,
      label: SEVEN_STATE_LABELS[state],
      rows: [],
      totalCount: props.coverage.totalCount,
      isLoading: state === 'loading',
      isCollapsed: state === 'collapsed',
      canView: state !== 'forbidden',
      error: state === 'error' ? new Error('không tải được danh sách màn') : null,
    };
  });
}

describe('StateGallery — bảy trạng thái (A11, R-63)', () => {
  it('vẽ đủ bảy trạng thái, không lần nào ném lỗi và không lần nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const props = stateGalleryScenarioFor(scenario.state);
      const { container, unmount } = renderStateGallery(props);

      rendered += 1;

      return { container, unmount };
    }, scenarioIndex());

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });
});

/* -------------------------------------------------------------------------- */
/* [R-72] Khả năng tiếp cận, tiếng Việt, không mã màu thô.                     */
/* -------------------------------------------------------------------------- */

describe('StateGallery — khả năng tiếp cận, tiếng Việt, không mã màu thô (R-72)', () => {
  it.each(ALL_STATE_SCENARIOS)('trạng thái "$state" tiếp cận được — bàn phím hạng nhất, nút icon có aria-label (A12)', ({ props }) => {
    const { container } = renderStateGallery(props);

    expectAccessible(container);
  });

  it.each(ALL_STATE_SCENARIOS)('trạng thái "$state": mọi chuỗi hiển thị là tiếng Việt có dấu', ({ props }) => {
    const { container } = renderStateGallery(props);

    expectVietnamese(container);
  });

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/system/StateGallery');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* (a) Đếm story — NGHIỆM THU của cả dự án: 329/329 trên 47 màn.              */
/* -------------------------------------------------------------------------- */

describe('StateGallery — đếm story trên toàn manifest (nghiệm thu S-47)', () => {
  it('manifest đầy đủ ra đúng presentCount = 329, totalCount = 329, screenCount = 47', () => {
    const coverage = galleryCoverage(STATE_GALLERY_MANIFEST);

    expect(coverage.presentCount).toBe(329);
    expect(coverage.totalCount).toBe(329);
    expect(coverage.screenCount).toBe(47);
    expect(coverage.incompleteScreens).toHaveLength(0);
  });

  it('47 màn × 7 trạng thái — hai vế của phép nhân khớp với con số đã khai (không viết tay 329)', () => {
    expect(STATE_GALLERY_MANIFEST.screens).toHaveLength(47);

    const coverage = galleryCoverage(STATE_GALLERY_MANIFEST);

    expect(coverage.totalCount).toBe(STATE_GALLERY_MANIFEST.screens.length * SEVEN_STATES.length);
  });
});

/* -------------------------------------------------------------------------- */
/* (b) Trạng thái "một phần" — "5/7" và đúng tên trạng thái còn thiếu.        */
/* -------------------------------------------------------------------------- */

describe('StateGallery — trạng thái "một phần" hiện đúng số đếm và tên trạng thái thiếu (b)', () => {
  it('màn thiếu hai trạng thái hiện "5/7" và liệt kê đúng tên hai trạng thái đó', () => {
    const props = stateGalleryScenarioFor('partial');

    expect(props.state).toBe('partial');
    expect(props.selectedScreenId).not.toBeNull();

    const selectedId = props.selectedScreenId;

    if (selectedId === null) {
      throw new Error('không thể tới đây — đã khẳng định ở trên');
    }

    const partialEntry = props.coverageByScreen[selectedId];

    expect(partialEntry).toBeDefined();

    if (partialEntry === undefined) {
      throw new Error('không thể tới đây — đã khẳng định ở trên');
    }

    expect(partialEntry.presentCount).toBe(5);
    expect(partialEntry.totalCount).toBe(7);
    expect(partialEntry.missingLabels.length).toBe(2);

    const { container } = renderStateGallery(props);
    const text = container.textContent ?? '';

    expect(text).toContain('5/7');

    for (const missingLabel of partialEntry.missingLabels) {
      expect(text).toContain(missingLabel);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* (c) "chạy kiểm nhanh" — bấm gọi callback; có checkRows thì bảng hiện đủ.    */
/* -------------------------------------------------------------------------- */

describe('StateGallery — bấm "chạy kiểm nhanh" (c)', () => {
  it('bấm nút "chạy kiểm nhanh" gọi đúng onRunQuickCheck', () => {
    const onRunQuickCheck = vi.fn();
    const props: StateGalleryProps = { ...stateGalleryScenarioFor('success'), onRunQuickCheck };

    const { getByRole } = renderStateGallery(props);

    fireEvent.click(getByRole('button', { name: /chạy kiểm nhanh/iu }));

    expect(onRunQuickCheck).toHaveBeenCalledTimes(1);
  });

  it('isCheckRunning=true: nút "chạy kiểm nhanh" báo đang chạy (không dựng ra màn trắng)', () => {
    const props = stateGalleryScenarioFor('loading');

    expect(props.isCheckRunning).toBe(true);

    const { container } = renderStateGallery(props);

    expect(container.childElementCount).toBeGreaterThan(0);
  });

  /**
   * GIẢ ĐỊNH (xem đầu file): bảng kết quả dùng `role="row"`, một hàng cho
   * mỗi màn trong `checkRows`. `checkRows` ở đây dựng đúng hình dạng
   * `QuickCheckRow`/`QuickCheckCell` của hợp đồng, từ chính `screens` của
   * kịch bản "success" — không bịa một hình dạng props thứ hai (R-70).
   */
  it('khi checkRows có dữ liệu, bảng kết quả hiện đủ bốn phép kiểm cho từng màn', () => {
    const base = stateGalleryScenarioFor('success');
    const sampleScreens = base.screens.slice(0, 2);

    expect(sampleScreens.length).toBe(2);

    const checkRows: readonly QuickCheckRow[] = sampleScreens.map((screen: GalleryScreenEntry) => ({
      screenId: screen.id,
      screenLabel: screen.label,
      cells: QUICK_CHECK_IDS.map((checkId) => ({
        checkId,
        status: 'pass' as const,
        detail: null,
      })),
    }));

    for (const row of checkRows) {
      expect(row.cells).toHaveLength(QUICK_CHECK_IDS.length);
      expect(row.cells).toHaveLength(4);
    }

    const props: StateGalleryProps = { ...base, checkRows, isCheckRunning: false };
    const { container, getAllByRole } = renderStateGallery(props);

    const rows = getAllByRole('row');

    expect(rows.length).toBeGreaterThanOrEqual(sampleScreens.length);

    const text = container.textContent ?? '';

    for (const screen of sampleScreens) {
      expect(text).toContain(screen.label);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* (d) Ba công tắc gọi đúng callback tương ứng.                                */
/* -------------------------------------------------------------------------- */

/**
 * GIẢ ĐỊNH (xem đầu file): ba công tắc dựng bằng `role="switch"`, tên (aria-
 * label/text) chứa từ khoá của chính công tắc đó. "Công tắc" là từ chính hợp
 * đồng dùng cho `ReviewToolbarState` — không phải suy đoán tuỳ tiện, nhưng
 * `role` cụ thể thì hợp đồng không ghi, nên đây là điều lớp gộp cần xác nhận.
 */
describe('StateGallery — ba công tắc thanh công cụ gọi đúng callback (d)', () => {
  it('công tắc chủ đề tối gọi onToggleDarkTheme', () => {
    const onToggleDarkTheme = vi.fn();
    const props: StateGalleryProps = { ...stateGalleryScenarioFor('success'), onToggleDarkTheme };

    const { getByRole } = renderStateGallery(props);

    fireEvent.click(getByRole('switch', { name: /tối/iu }));

    expect(onToggleDarkTheme).toHaveBeenCalledTimes(1);
  });

  it('công tắc giảm chuyển động gọi onToggleReducedMotion', () => {
    const onToggleReducedMotion = vi.fn();
    const props: StateGalleryProps = { ...stateGalleryScenarioFor('success'), onToggleReducedMotion };

    const { getByRole } = renderStateGallery(props);

    fireEvent.click(getByRole('switch', { name: /chuyển động/iu }));

    expect(onToggleReducedMotion).toHaveBeenCalledTimes(1);
  });

  it('công tắc lưới đo khoảng cách gọi onToggleSpacingGrid', () => {
    const onToggleSpacingGrid = vi.fn();
    const props: StateGalleryProps = { ...stateGalleryScenarioFor('success'), onToggleSpacingGrid };

    const { getByRole } = renderStateGallery(props);

    fireEvent.click(getByRole('switch', { name: /khoảng cách|lưới/iu }));

    expect(onToggleSpacingGrid).toHaveBeenCalledTimes(1);
  });
});

/* -------------------------------------------------------------------------- */
/* (e) Esc đóng lớp trên cùng (A12).                                          */
/* -------------------------------------------------------------------------- */

/**
 * GIẢ ĐỊNH ĐÃ ĐƯỢC THAY BẰNG CƠ CHẾ THẬT — lớp gộp, đúng lời dặn ở đầu file
 * ("nếu lớp gộp chọn cơ chế khác, chỉ sửa đúng các bài đó").
 *
 * Bài này trước đây đoán "lớp trên cùng" là ô tìm kiếm và Esc xoá nó bằng
 * `onSearchTextChange('')`. View thật chọn khác, và chọn đúng hơn: lớp duy
 * nhất thực sự NỔI LÊN TRÊN ở trang này là bảng kết quả kiểm nhanh, nên
 * `StateGalleryToolbar` gắn Esc vào đúng nó qua registry dùng chung
 * (`useShortcut`, `id: 'stateGallery.closeCheckPanel'`, `scope: 'sidePanel'`,
 * bật khi bảng đang mở) — không `addEventListener('keydown')` nào tự viết,
 * đúng A12.
 *
 * Ô tìm kiếm là bộ lọc nằm TRONG cây, không phải lớp phủ; buộc Esc xoá nó sẽ
 * là binding Escape thứ hai tranh chấp với lớp thật đang mở — đúng thứ "Esc
 * đóng LỚP TRÊN CÙNG" của A12 tồn tại để ngăn. Nên phép kiểm đổi mục tiêu,
 * KHÔNG nới lỏng: nó vẫn bấm Esc thật và vẫn đòi một lớp phải đóng.
 */
describe('StateGallery — Esc đóng lớp trên cùng (A12, e)', () => {
  it('bảng kết quả kiểm nhanh đang mở: Esc đóng nó', () => {
    const base = stateGalleryScenarioFor('success');
    const checkRows: readonly QuickCheckRow[] = base.screens.slice(0, 2).map((screen: GalleryScreenEntry) => ({
      screenId: screen.id,
      screenLabel: screen.label,
      cells: QUICK_CHECK_IDS.map((checkId) => ({ checkId, status: 'pass' as const, detail: null })),
    }));

    const props: StateGalleryProps = { ...base, checkRows, isCheckRunning: false };
    const { queryByRole } = renderStateGallery(props);

    // Lớp đang mở: nút đóng của bảng kết quả có mặt.
    expect(queryByRole('button', { name: /đóng bảng kết quả/iu })).not.toBeNull();

    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(queryByRole('button', { name: /đóng bảng kết quả/iu })).toBeNull();
  });
});
