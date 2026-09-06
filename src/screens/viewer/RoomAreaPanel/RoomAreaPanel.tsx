/**
 * S-33 — bảng diện tích phòng, chế độ panel rộng 344px.
 *
 * VIEW THUẦN (R-60): file này không nhập `src/api`, `src/store`, `src/domain`
 * hay `src/lib/http`, và `local/no-data-layer-in-view` ép điều đó. Nó nhận đúng
 * `RoomAreaPanelProps` của `roomAreaTypes.ts` — hợp đồng đã chốt, ba phía cùng
 * đọc — và không thêm bớt một trường nào. `use RoomAreaPanel` (hook) cùng
 * `RoomAreaPanel.container.tsx` là hai chỗ được biết dữ liệu từ đâu tới; đây
 * không phải một trong hai.
 *
 * ## Ba file, một view
 *
 * R-22 giới hạn 400 dòng CÓ NỘI DUNG cho một file component, và mục D của
 * CLAUDE.md nói cách xử lý: phần con ra file anh em TRONG CÙNG thư mục màn.
 * `RoomAreaPanel.chrome.tsx` giữ các mảnh giao diện cùng toàn bộ chuỗi tĩnh,
 * `RoomAreaPanel.rows.tsx` giữ danh sách gộp nhóm và một hàng phòng, còn file
 * này giữ đúng bảy nhánh trạng thái. Cả ba đều là view thuần.
 *
 * ## Mọi con số tới đây đã là chữ
 *
 * A15 đặt việc định dạng ở viewmodel, `local/no-raw-number` chặn hai phương
 * thức định dạng số của JavaScript và mọi phép quy đổi đơn vị trong
 * `src/screens` — xem đầu `eslint-rules/no-raw-number.js`. Panel này
 * không cộng, không làm tròn, không nối đơn vị vào chuỗi số: `totals.unitLabel`
 * đứng CẠNH `totals.totalText` như một phần tử riêng, đúng "đơn vị nằm NGOÀI
 * con số" của đặc tả, và tổng phụ từng nhóm tới sẵn trong `group.subtotalText`
 * (PQ-4 — tổng chỉ có một nguồn và chỉ làm tròn đúng một lần).
 *
 * ## Ngoại lệ mono-lg
 *
 * Diện tích là dữ liệu chính của màn, nên ô tổng dùng lớp chữ đều lớn — đây là
 * ngoại lệ DUY NHẤT được dùng cỡ chữ đó ngoài mã đối tượng. `mono-lg` không có
 * thật trong `tailwind.config.ts` (không khai `fontFamily` nào); lớp đang chạy
 * thật trong repo cho vai trò đó là `font-mono text-[24px]`, đúng
 * `FloorSectionCut.tsx:23-26` đã ghi lại và `PlanComparison.tsx:44` đang dùng.
 *
 * ## Thang chuyển động
 *
 * Không có con số thời lượng nào viết tay ở đây (R-71, `local/no-raw-duration`).
 * Đặc tả viết 240ms — số đó KHÔNG tồn tại trong thang 120/180/260/340 của
 * `src/lib/motion/tokens.ts`. Chạy số khi đổi tầng đi nhịp `standard` (260ms) vì
 * `useCountUp` đã tự chốt `COUNT_UP_DURATION = 'standard'`; nâng nền hàng khi
 * trỏ vào đi nhịp `fast` (180ms); hàng đổi chỗ khi đổi sắp xếp đi nhịp `fast`,
 * đúng `MOVE_DURATION` của `listMotion.ts`. Hoạt ảnh bố cục vào qua đúng cửa
 * `@/components/motion` (R-39).
 *
 * ## Bảy trạng thái, không trạng thái nào vẽ ra màn trắng (A11)
 *
 * `state` là một union đóng và cả bảy giá trị đều có nhánh vẽ riêng ở dưới:
 * bốn nhánh trả về sớm (`loading`, `forbidden`, `error`, `empty`), một nhánh
 * `collapsed`, rồi `ready` và `partial` dùng chung thân panel với `partial`
 * thêm lời nhắc gọi tên tầng còn thiếu. Không nhánh nào trả về `null`.
 *
 * ## Hai chỗ hợp đồng chưa với tới, và cách file này xử lý mà KHÔNG bịa
 *
 * 1. **"Kiểm tra khe hở tường" ở trạng thái rỗng** không có callback riêng
 *    trong `RoomAreaPanelProps`. Nút đó gọi `onRetry` — hành động "đo lại" duy
 *    nhất hợp đồng có. Không bản tạm, không ghi chú hoãn lại, không prop tự
 *    chế (R-69).
 * 2. **"Năm phòng lớn nhất" ở trạng thái thu gọn** là một phép CHỌN, và chọn
 *    thì thuộc về hook (PQ-7 cho phép gộp/sắp xếp trong hook). Panel vẽ đúng
 *    `groups` được trao, phẳng hoá rồi cắt theo sức chứa của tấm trượt —
 *    `areaRatio` là tỷ lệ TRONG NHÓM nên view không có cách nào so hai nhóm với
 *    nhau, và nó không giả vờ có. Hook phải trao đúng năm phòng lớn nhất khi
 *    `state === 'collapsed'`.
 */

import { AlertCircle, Lock, Ruler, Unlink } from 'lucide-react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/utils';

import {
  COLLAPSED_CAPTION,
  COLLAPSED_ROW_CAPACITY,
  EMPTY_ACTION_LABEL,
  EMPTY_DESCRIPTION,
  EMPTY_TITLE,
  ERROR_TITLE,
  FORBIDDEN_DESCRIPTION,
  FORBIDDEN_TITLE,
  PANEL_CLASS,
  REGION_LABEL,
  RETRY_LABEL,
  RoomAreaBandBar,
  RoomAreaPanelControls,
  RoomAreaPanelFooter,
  RoomAreaPanelHeader,
  RoomAreaPanelSkeleton,
  RoomAreaPartialNotice,
  RoomAreaTotalsBlock,
} from './RoomAreaPanel.chrome';
import { RoomAreaGroupList, RoomAreaRowList } from './RoomAreaPanel.rows';
import type { RoomAreaPanelProps } from './roomAreaTypes';

/* -------------------------------------------------------------------------- */
/* Panel.                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Panel 344 của S-33.
 *
 * Panel là một CỘT FLEX cao hết khung được cấp: đầu panel và chân panel
 * `shrink-0`, danh sách là thứ duy nhất co giãn và cuộn — nên số phòng đổi thì
 * chân panel đứng yên. Bề rộng cố định 344px, đúng khuôn `PropertyInspector`.
 */
export function RoomAreaPanel(props: RoomAreaPanelProps) {
  const {
    state,
    groups,
    totals,
    bands,
    levels,
    activeLevelId,
    missingLevelNames,
    errorMessage,
    onLevelChange,
    onModeChange,
    onRetry,
    onCopyAsText,
    onOpenExport,
  } = props;

  if (state === 'loading') {
    return (
      <section aria-label={REGION_LABEL} className={PANEL_CLASS}>
        <RoomAreaPanelSkeleton />
      </section>
    );
  }

  if (state === 'forbidden') {
    return (
      <section aria-label={REGION_LABEL} className={PANEL_CLASS}>
        <EmptyState
          description={FORBIDDEN_DESCRIPTION}
          icon={<Lock />}
          title={FORBIDDEN_TITLE}
        />
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section aria-label={REGION_LABEL} className={PANEL_CLASS}>
        <EmptyState
          action={{ label: RETRY_LABEL, onClick: onRetry }}
          description={errorMessage}
          icon={<AlertCircle />}
          title={ERROR_TITLE}
        />
      </section>
    );
  }

  if (state === 'empty') {
    return (
      <section aria-label={REGION_LABEL} className={PANEL_CLASS}>
        {/* Hợp đồng không có callback riêng cho việc soát khe hở; `onRetry` là
            hành động "đo lại" duy nhất nó có, nên nút gọi đúng cái đó. */}
        <EmptyState
          action={{ label: EMPTY_ACTION_LABEL, onClick: onRetry, variant: 'secondary' }}
          description={EMPTY_DESCRIPTION}
          icon={<Unlink />}
          title={EMPTY_TITLE}
        />
      </section>
    );
  }

  if (state === 'collapsed') {
    return (
      <section aria-label={REGION_LABEL} className={cn(PANEL_CLASS, 'h-auto')}>
        <div className="flex items-center gap-2 px-4 pt-4 text-text-secondary">
          <Ruler aria-hidden="true" size={16} strokeWidth={1.5} />
          <p className="text-[13px] leading-[18px]">{COLLAPSED_CAPTION}</p>
        </div>
        <RoomAreaTotalsBlock totals={totals} />
        <div className="px-2 pb-3">
          <RoomAreaRowList
            flashedRoomId={props.flashedRoomId}
            hoveredRoomId={props.hoveredRoomId}
            onRoomActivate={props.onRoomActivate}
            onRoomHover={props.onRoomHover}
            onRoomRename={props.onRoomRename}
            rows={groups.flatMap((group) => group.rows).slice(0, COLLAPSED_ROW_CAPACITY)}
            unitLabel={totals.unitLabel}
          />
        </div>
      </section>
    );
  }

  const hasUnnamedRoom = groups.some((group) => group.rows.some((row) => row.isUnnamed));

  return (
    <section aria-label={REGION_LABEL} className={PANEL_CLASS}>
      <div className="shrink-0">
        <RoomAreaPanelHeader
          activeLevelId={activeLevelId}
          levels={levels}
          onLevelChange={onLevelChange}
          onModeChange={onModeChange}
        />
        <RoomAreaTotalsBlock totals={totals} />
        {state === 'partial' && (
          <RoomAreaPartialNotice
            hasUnnamedRoom={hasUnnamedRoom}
            missingLevelNames={missingLevelNames}
          />
        )}
        <RoomAreaPanelControls
          grouping={props.grouping}
          onGroupingChange={props.onGroupingChange}
          onSortChange={props.onSortChange}
          sort={props.sort}
        />
        <RoomAreaBandBar bands={bands} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <RoomAreaGroupList
          flashedRoomId={props.flashedRoomId}
          groups={groups}
          hoveredRoomId={props.hoveredRoomId}
          onRoomActivate={props.onRoomActivate}
          onRoomHover={props.onRoomHover}
          onRoomRename={props.onRoomRename}
          unitLabel={totals.unitLabel}
        />
      </div>

      <RoomAreaPanelFooter onCopyAsText={onCopyAsText} onOpenExport={onOpenExport} />
    </section>
  );
}
