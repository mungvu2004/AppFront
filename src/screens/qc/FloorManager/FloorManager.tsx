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
 * | `error`     | ẨN HẲN (không có tầng nào để cắt)                       | `InlineAlert` thay thân bảng            |
 * | `success`   | bốn dải đủ, tổng tỷ lệ = 1                              | bảng đầy đủ, dòng đã duyệt có huy hiệu  |
 * | `forbidden` | vẽ đầy đủ, mất viền chọn/nút                            | bảng chỉ đọc, ẩn mọi hành động sửa      |
 * | `collapsed` | ẨN HẲN, thay bằng nút "hiện lát cắt"                    | chiếm cả bề ngang khung                 |
 *
 * `error` (mọi lỗi đọc, không chỉ 404 của dự án): ẩn cả lát cắt lẫn câu "chỉ sống trong
 * phiên", bảng chiếm cả bề ngang và chỉ nói lỗi; 404 thì nói "không tìm thấy dự án" (BUG-060).
 *
 * Không nhánh nào trả `null` cho cả màn — canh đúng A11: màn trắng là thất bại
 * duy nhất bất biến này tồn tại để chặn.
 *
 * ## Bố cục — số đo mục E của bản thiết kế
 *
 * Nội dung tối đa 1120px, đệm 32px, cột trái 360px, khoảng cách hai cột 24px.
 * Dưới 1024px (`isCompact`, đo ở lớp trên và truyền vào — màn KHÔNG tự đo bề
 * rộng) hai cột xếp dọc và lát cắt được dựng SAU bảng trong DOM, không dời bằng `order`:
 * `order` chỉ dời hình, còn Tab và trình đọc màn hình đi theo DOM, nên "Thu gọn lát cắt"
 * và các dải từng nhận tiêu điểm trước "Thêm tầng" và bảng (WCAG 2.4.3, A12).
 * Mười cột cần ~958px: bảng chỉ trải đủ cột khi lát cắt thu gọn ở khổ rộng (nút "Hiện lát
 * cắt" nằm trên bảng); cạnh lát cắt hay khi `isCompact`, mỗi dòng xếp chồng như thẻ (BUG-250).
 *
 * ## Câu chặn trùng cao độ đi ra bằng prop riêng
 *
 * `duplicateElevationMessage` KHÔNG được nhét vào `errorMessage` — làm vậy lật
 * `state` sang `error` (bất biến 4 của `floorManagerTypes.ts`), tức nói dối.
 * Nó vẽ thành `InlineAlert level="violation"` có `role="status"` ngay trên
 * bảng, cùng khuôn `AxisGridManager.tsx` xử lý `spacingMessage`.
 *
 * ## Hai câu màn PHẢI nói ra, ngay dưới đầu màn
 *
 * - `forbiddenNotice` — vai Người xem thấy một màn KHÔNG còn nút sửa nào. Ẩn
 *   nút mà không nói vì sao là để người dùng đoán; A11 tồn tại đúng để chặn
 *   chuyện đó, nên câu này đi kèm ngay trên bảng.
 * - `unsupportedNotices` — hai khoản cổng khai là chưa làm được
 *   (`persistFloorContents`, `hideFloorFrom3d`; câu thứ hai chỉ khi đang có tầng ẩn).
 *   Màn CẤM im lặng và CẤM bịa một lượt lưu đã xong: một dải nói thẳng phần nào mất
 *   sau khi tải lại trang (BUG-287).
 *
 * Cả hai nằm TRƯỚC bảng và trước mọi nút, không giấu dưới đáy trang, và dùng
 * `role="status"` chứ không `role="alert"`: đây là bối cảnh thường trực của
 * màn, không phải tin khẩn cấp cắt ngang người đang gõ.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Breadcrumb } from '@/components/shell/Breadcrumb';
import { cn } from '@/lib/utils';

import { FloorSectionCut } from './FloorSectionCut';
import { FloorTable } from './FloorTable';
import type { FloorManagerViewProps } from './floorManagerTypes';

const SCREEN_TITLE = 'Quản lý tầng';
/** Cùng component, cùng dấu "›" với màn tải bản vẽ và cổng chất lượng (BUG-079). */
const BREADCRUMB_PROJECTS = 'Dự án';
const SCREEN_DESCRIPTION =
  'Xem cao độ, chiều cao và tiến độ của từng tầng, rồi sắp xếp lại ngăn xếp nếu cần.';
const EXPAND_SECTION_LABEL = 'Hiện lát cắt';
const FORBIDDEN_NOTICE_TITLE = 'Không có quyền sửa tầng';
const UNSUPPORTED_NOTICES_TITLE = 'Một số thay đổi chưa được lưu';

const EXPAND_BUTTON_CLASS_NAME = cn(
  'inline-flex min-h-11 items-center self-start rounded-md px-1.5 text-[13px] text-accent fine:min-h-6',
  'transition-colors duration-120 hover:bg-accent-wash',
  'focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
);

export function FloorManager(props: FloorManagerViewProps) {
  const {
    state,
    isCollapsed,
    isCompact,
    duplicateElevationMessage,
    forbiddenNotice,
    unsupportedNotices,
    onToggleCollapsed,
  } = props;
  /* Đọc hỏng (404, mạng, 5xx): chỉ còn câu lỗi và lối đi — câu "chỉ sống trong phiên" và
     lát cắt trống cạnh nó là nói về những tầng chưa đọc được (BUG-060). */
  const isLoadError = state === 'error';
  const sectionCut =
    isLoadError || isCollapsed ? null : (
      <div className={cn('shrink-0 self-stretch', isCompact ? 'h-[400px] w-full' : 'w-[360px]')}>
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
    );

  return (
    <div aria-label={SCREEN_TITLE} className="flex h-full min-h-0 w-full flex-col overflow-y-auto bg-bg-app" role="region">
      <header className="mx-auto flex w-full max-w-[1120px] shrink-0 flex-col gap-1 px-8 pb-1 pt-8">
        <Breadcrumb
          items={[
            // Cấp "Dự án" về được danh sách dự án khi nơi gọi cho lối về.
            {
              id: 'projects',
              label: BREADCRUMB_PROJECTS,
              ...(props.onBackToProjects ? { onClick: props.onBackToProjects } : {}),
            },
            ...(props.projectName ? [{ id: 'project', label: props.projectName }] : []),
            { id: 'floors', label: SCREEN_TITLE },
          ]}
        />
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[18px] font-semibold text-text-primary">{SCREEN_TITLE}</h2>
          {/* Lối sang 3D là nút "Bước tiếp theo: Mô hình 3D" của thanh bước; màn không vẽ nút
              chính thứ hai cùng đích (K5). Các màn phụ của dự án ở menu dự án trên header. */}
        </div>
        <p className="text-[13px] text-text-secondary">{SCREEN_DESCRIPTION}</p>
      </header>

      {forbiddenNotice === null ? null : (
        <div className="mx-auto w-full max-w-[1120px] shrink-0 px-8 pb-2">
          <InlineAlert
            level="attention"
            message={forbiddenNotice}
            role="status"
            title={FORBIDDEN_NOTICE_TITLE}
          />
        </div>
      )}

      {/* Một dải cho mọi khoản chưa lưu được, không một tiêu đề cộng một dải mỗi câu (BUG-287). */}
      {isLoadError || state === 'loading' || props.rows.length === 0 || unsupportedNotices.length === 0 ? null : (
        <div className="mx-auto w-full max-w-[1120px] shrink-0 px-8 pb-2">
          <InlineAlert
            level="attention"
            message={unsupportedNotices.join(' ')}
            role="status"
            title={UNSUPPORTED_NOTICES_TITLE}
          />
        </div>
      )}

      {duplicateElevationMessage === null ? null : (
        <div className="mx-auto w-full max-w-[1120px] shrink-0 px-8 pb-2">
          <InlineAlert level="violation" message={duplicateElevationMessage} role="status" />
        </div>
      )}

      {/* Vùng nội dung lấp phần còn lại của khung và có chiều cao xác định, nên khung bảng tự
          cuộn còn "Thêm tầng" và lát cắt đứng yên — 50 tầng không kéo cả trang dài 5850 px (BUG-520).
          Khổ gọn: bảng giữ ít nhất 480 px, lát cắt nằm dưới, trang cuộn phần dư. */}
      <div className="mx-auto flex min-h-0 w-full max-w-[1120px] flex-1 flex-col px-8 pb-8">
        <div
          className={cn(
            'flex flex-1 items-stretch gap-6',
            isCompact ? 'min-h-0' : 'min-h-[480px]',
            isCompact || isCollapsed ? 'flex-col' : 'flex-row',
          )}
        >
          {isLoadError || !isCollapsed ? null : (
            <button className={EXPAND_BUTTON_CLASS_NAME} onClick={onToggleCollapsed} type="button">
              {EXPAND_SECTION_LABEL}
            </button>
          )}
          {isCompact ? null : sectionCut}

          {/* Khổ gọn: cột cao theo nội dung (trang cuộn phần dư), không giữ 480 px trống (K5). */}
          <div className={cn('min-h-0 min-w-0 self-stretch', isCompact ? 'flex-none' : 'flex-1')}>
            <FloorTable
              canEdit={props.canEdit}
              emptyNotice={props.emptyNotice}
              errorMessage={props.errorMessage}
              footer={props.footer}
              isProjectMissing={props.isProjectMissing}
              onBackToProjects={props.onBackToProjects}
              isAutoElevation={props.isAutoElevation}
              // Mười cột chỉ vừa khi bảng có cả bề ngang: lát cắt thu gọn, khổ rộng (BUG-250).
              isStacked={isCompact || !isCollapsed}
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
              onOpenOverlay={props.onOpenOverlay}
              onOpenFloorScreen={props.onOpenFloorScreen}
              rows={props.rows}
              state={state}
            />
          </div>
          {isCompact ? sectionCut : null}
        </div>
      </div>
    </div>
  );
}
