/**
 * Màn S-16 "Quản lý tầng" (`FloorManager`) — VIEW THUẦN, vỏ hai cột: cột trái
 * 360px là lát cắt đứng (`FloorSectionCut`), cột phải là bảng tầng
 * (`FloorTable`). Khuôn chép từ `AxisGridManager.tsx` (mục 1 TASK-SPEC.md).
 *
 * Nhận HẾT qua props ({@link FloorManagerViewProps}) và chỉ dựng thẻ. Không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Không tính hình học, không so ngưỡng, không
 * định dạng một con số nào — mọi chuỗi tới đây đã xong ở `useFloorManager`
 * (A15).
 *
 * ## Bảy trạng thái (A11, R-63) — nơi từng trạng thái được vẽ
 *
 * | `state`     | Cột trái (`FloorSectionCut`)                          | Cột phải (`FloorTable`)               |
 * |-------------|--------------------------------------------------------|-----------------------------------------|
 * | `empty`     | khung + thang cao độ chỉ có vạch "0,0 m"               | `EmptyState` thay chỗ cả bảng           |
 * | `loading`   | một `Skeleton` lấp kín khung                            | khung bảng + bốn dòng `Skeleton`        |
 * | `partial`   | bốn dải đúng tỷ lệ, dải chưa có bản vẽ tô cảnh báo      | bảng đầy đủ, dòng thiếu bản vẽ có nhãn  |
 * | `error`     | khung + thang cao độ, không dải nào                     | `InlineAlert` thay thân bảng            |
 * | `success`   | bốn dải đủ, tổng tỷ lệ = 1                              | bảng đầy đủ, dòng đã duyệt có huy hiệu  |
 * | `forbidden` | vẽ đầy đủ, mất viền chọn/nút                            | bảng chỉ đọc, ẩn mọi hành động sửa      |
 * | `collapsed` | ẨN HẲN, thay bằng nút "hiện lát cắt"                    | chiếm cả bề ngang khung                 |
 *
 * Không nhánh nào trả `null` cho cả màn — canh đúng A11: màn trắng là thất bại
 * duy nhất bất biến này tồn tại để chặn.
 *
 * ## Bố cục — số đo mục E của bản thiết kế
 *
 * Nội dung tối đa 1120px, đệm 32px, cột trái 360px, khoảng cách hai cột 24px.
 * Dưới 1024px (`isCompact`, đo ở lớp trên và truyền vào — màn KHÔNG tự đo bề
 * rộng) hai cột xếp dọc và lát cắt xuống DƯỚI bảng bằng `order`, không đảo thứ
 * tự trong DOM, để luồng đọc của trình đọc màn hình vẫn là bảng trước.
 *
 * ## Câu chặn trùng cao độ đi ra bằng prop riêng
 *
 * `duplicateElevationMessage` KHÔNG được nhét vào `errorMessage` — làm vậy lật
 * `state` sang `error` (bất biến 4 của `floorManagerTypes.ts`), tức nói dối.
 * Nó vẽ thành `InlineAlert level="violation"` có `role="status"` ngay trên
 * bảng, cùng khuôn `AxisGridManager.tsx` xử lý `spacingMessage`.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { cn } from '@/lib/utils';

import { FloorSectionCut } from './FloorSectionCut';
import { FloorTable } from './FloorTable';
import type { FloorManagerViewProps } from './floorManagerTypes';

const SCREEN_BREADCRUMB = 'Dự án > Quản lý tầng';
const SCREEN_TITLE = 'quản lý tầng';
const SCREEN_DESCRIPTION =
  'Xem cao độ, chiều cao và tiến độ của từng tầng, rồi sắp xếp lại ngăn xếp nếu cần.';
const EXPAND_SECTION_LABEL = 'hiện lát cắt';

const EXPAND_BUTTON_CLASS_NAME = cn(
  'self-start rounded-[6px] px-1.5 py-0.5 text-[13px] text-accent',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

export function FloorManager(props: FloorManagerViewProps) {
  const { state, isCollapsed, isCompact, duplicateElevationMessage, onToggleCollapsed } = props;

  return (
    <div aria-label={SCREEN_TITLE} className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-bg-app" role="region">
      <header className="mx-auto w-full max-w-[1120px] shrink-0 px-8 pb-1 pt-6">
        <p className="text-[12px] text-text-muted">{SCREEN_BREADCRUMB}</p>
        <h2 className="text-[18px] font-semibold text-text-primary">{SCREEN_TITLE}</h2>
        <p className="text-[13px] text-text-secondary">{SCREEN_DESCRIPTION}</p>
      </header>

      {duplicateElevationMessage === null ? null : (
        <div className="mx-auto w-full max-w-[1120px] shrink-0 px-8 pb-2">
          <InlineAlert level="violation" message={duplicateElevationMessage} role="status" />
        </div>
      )}

      <div className="mx-auto w-full max-w-[1120px] flex-1 px-8 pb-8">
        <div className={cn('flex min-h-[480px] items-stretch gap-6', isCompact ? 'flex-col' : 'flex-row')}>
          {isCollapsed ? (
            <button className={EXPAND_BUTTON_CLASS_NAME} onClick={onToggleCollapsed} type="button">
              {EXPAND_SECTION_LABEL}
            </button>
          ) : (
            <div className={cn('shrink-0 self-stretch', isCompact ? 'order-2 w-full' : 'order-1 w-[360px]')}>
              <FloorSectionCut
                bands={props.bands}
                elevationTicks={props.elevationTicks}
                onHoverFloor={props.onHoverFloor}
                onSelectFloor={props.onSelectFloor}
                onToggleCollapsed={props.onToggleCollapsed}
                state={state}
                totalHeightText={props.totalHeightText}
              />
            </div>
          )}

          <div className={cn('min-h-0 min-w-0 flex-1 self-stretch', isCompact ? 'order-1' : 'order-2')}>
            <FloorTable
              canEdit={props.canEdit}
              emptyNotice={props.emptyNotice}
              errorMessage={props.errorMessage}
              footer={props.footer}
              isAutoElevation={props.isAutoElevation}
              onAddFloor={props.onAddFloor}
              onDuplicateFloor={props.onDuplicateFloor}
              onFloorFieldCancel={props.onFloorFieldCancel}
              onFloorFieldChange={props.onFloorFieldChange}
              onFloorFieldCommit={props.onFloorFieldCommit}
              onHoverFloor={props.onHoverFloor}
              onRemoveFloor={props.onRemoveFloor}
              onReorderFloors={props.onReorderFloors}
              onRetry={props.onRetry}
              onSelectFloor={props.onSelectFloor}
              onToggleAutoElevation={props.onToggleAutoElevation}
              onToggleHiddenIn3d={props.onToggleHiddenIn3d}
              onUploadDrawing={props.onUploadDrawing}
              rows={props.rows}
              state={state}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
