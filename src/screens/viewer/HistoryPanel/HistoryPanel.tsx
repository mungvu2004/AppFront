/**
 * S-34 — panel lịch sử một trăm bước của viewer, view thuần.
 *
 * VIEW THUẦN (R-60): file này không nhập `@/api`, `@/store`, `@/domain` hay
 * `@/lib/http`, và `local/no-data-layer-in-view` ép điều đó. Nó nhận đúng
 * `HistoryPanelProps` của `historyPanelTypes.ts` — hợp đồng đã chốt, bốn phía
 * cùng đọc — và không thêm bớt một trường nào. Hook và container là hai chỗ được
 * biết dữ liệu từ đâu tới; đây không phải một trong hai.
 *
 * ## Ba file, một view
 *
 * R-22 giới hạn 400 dòng có nội dung cho một file component, và mục D của
 * CLAUDE.md nói cách xử lý: phần con ra file anh em TRONG CÙNG thư mục màn.
 * `HistoryPanel.chrome.tsx` giữ hàng chip, bộ chọn người, nhãn nhóm, khung xương
 * và các trạng thái rỗng/lỗi/nhắc, cùng TOÀN BỘ chuỗi tĩnh;
 * `HistoryPanel.rows.tsx` giữ dòng thời gian và một mục; file này giữ đúng bảy
 * nhánh trạng thái. Cả ba đều là view thuần.
 *
 * ## Bảy trạng thái, không nhánh nào vẽ ra màn trắng (A11)
 *
 * `state` là một union đóng và cả bảy giá trị đều có nhánh riêng: `collapsed`,
 * `loading`, `error`, `empty` trả về sớm, còn `forbidden`, `partial` và `success`
 * dùng chung thân panel — `forbidden` thêm một băng nhắc và mất nút nhảy,
 * `partial` thêm một trong hai lời nhắc tuỳ `partialReason`. Không nhánh nào trả
 * về `null`.
 *
 * `forbidden` KHÔNG thay dòng thời gian bằng một ô trắng: người xem vẫn đọc được
 * các bước đã làm, chỉ là không quay ngược mô hình được và không biết ai đã làm.
 * Đúng khuôn `PropertyInspector` — thân panel như thường, cộng một băng nhắc.
 *
 * ## Hai lối vào "một phần" nói hai câu khác nhau
 *
 * `at-step-limit` là "bước cũ nhất SẮP BỊ BỎ" — không có gì để tải, chỉ có một
 * lời cảnh báo. `archived` là "bước cũ hơn CÒN Ở ĐÂU ĐÓ" — và nút "Tải thêm" nằm
 * ở ĐÁY danh sách, vì đó là chỗ những bước ấy sẽ hiện ra.
 *
 * ## Panel 344, hay tấm trượt đáy dưới 1024
 *
 * `layout` chọn giữa hai vỏ. Cả hai đều là cột flex: đầu panel `shrink-0`, dòng
 * thời gian là thứ duy nhất co giãn và cuộn, nên số bước đổi thì đầu panel đứng
 * yên. Vỏ tấm trượt chép khuôn `ScaleCalibrationPanel` — CSS thuần bằng `lg:`,
 * không media query viết tay (R-71).
 */

import {
  HISTORY_PANEL_TEST_IDS,
  type HistoryPanelProps,
} from './historyPanelTypes';
import {
  HistoryCollapsedBar,
  HistoryEmpty,
  HistoryError,
  HistoryForbiddenNotice,
  HistoryLoadMore,
  HistoryPanelHeader,
  HistoryPanelSkeleton,
  HistoryStepLimitNotice,
  PANEL_CLASS,
  REGION_LABEL,
  SHEET_CLASS,
  SHEET_REGION_LABEL,
} from './HistoryPanel.chrome';
import { HistoryTimeline } from './HistoryPanel.rows';

/**
 * Panel lịch sử của S-34.
 *
 * `layout` chỉ lái vỏ ngoài và nhãn vùng; nó không đổi một dòng nào của dòng thời
 * gian — cùng một danh sách, cùng một song lưng, đọc được như nhau ở cả hai bề
 * rộng.
 */
export function HistoryPanel(props: HistoryPanelProps) {
  const {
    state,
    layout,
    groups,
    visibleCount,
    filters,
    people,
    canJump,
    partialReason,
    onCategoryChange,
    onActorChange,
    onJumpTo,
    onHoverItem,
    onSelectEntity,
    onToggleBatch,
    onToggleCollapse,
    onLoadMore,
    onRetry,
  } = props;

  const isSheet = layout === 'sheet';
  const shellClass = isSheet ? SHEET_CLASS : PANEL_CLASS;
  const regionLabel = isSheet ? SHEET_REGION_LABEL : REGION_LABEL;

  if (state === 'collapsed') {
    return (
      <section
        aria-label={regionLabel}
        className={`${shellClass} h-auto`}
        data-testid={HISTORY_PANEL_TEST_IDS.root}
      >
        <HistoryCollapsedBar onToggleCollapse={onToggleCollapse} visibleCount={visibleCount} />
      </section>
    );
  }

  if (state === 'loading') {
    return (
      <section
        aria-label={regionLabel}
        className={shellClass}
        data-testid={HISTORY_PANEL_TEST_IDS.root}
      >
        <HistoryPanelSkeleton />
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section
        aria-label={regionLabel}
        className={shellClass}
        data-testid={HISTORY_PANEL_TEST_IDS.root}
      >
        <HistoryError onRetry={onRetry} />
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section
        aria-label={regionLabel}
        className={shellClass}
        data-testid={HISTORY_PANEL_TEST_IDS.root}
      >
        <HistoryPanelHeader
          filters={filters}
          onActorChange={onActorChange}
          onCategoryChange={onCategoryChange}
          people={people}
        />
        <HistoryEmpty />
      </section>
    );
  }

  return (
    <section
      aria-label={regionLabel}
      className={shellClass}
      data-testid={HISTORY_PANEL_TEST_IDS.root}
    >
      <div className="shrink-0">
        <HistoryPanelHeader
          filters={filters}
          onActorChange={onActorChange}
          onCategoryChange={onCategoryChange}
          people={people}
        />
        {state === 'forbidden' && <HistoryForbiddenNotice />}
        {state === 'partial' && partialReason === 'at-step-limit' && <HistoryStepLimitNotice />}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <HistoryTimeline
          canJump={canJump}
          groups={groups}
          onHoverItem={onHoverItem}
          onJumpTo={onJumpTo}
          onSelectEntity={onSelectEntity}
          onToggleBatch={onToggleBatch}
        />
        {/* Đáy danh sách là chỗ những bước cũ hơn sẽ hiện ra, nên nút ở đáy. */}
        {state === 'partial' && partialReason === 'archived' && (
          <HistoryLoadMore onLoadMore={onLoadMore} />
        )}
      </div>
    </section>
  );
}
