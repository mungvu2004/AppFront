/**
 * VỎ CHUNG CỦA CHÍN MÀN 3D — view thuần, test được chỉ từ props.
 *
 * Không nhập `src/api`, `src/store`, `src/domain`, `src/lib/http` (R-60,
 * `local/no-data-layer-in-view`). Mọi thứ đến qua {@link ViewerShellProps}, do
 * `useViewerShell.ts` dựng và `ViewerShell.container.tsx` truyền xuống.
 *
 * ## Vì sao vỏ này KHÔNG nhập `AppShell`
 *
 * Đặc tả nói "dùng lại AppShell của CL-04 ở chế độ 3D". `AppShell` không có chế
 * độ ấy: `TOOLS` của nó (`components/shell/AppShell.tsx:60-65`) khoá cứng bốn
 * công cụ sửa 2D và không nhận prop nào để đổi, còn `StatusBar` dùng chung chỉ
 * nhận toạ độ chuột với tỉ lệ bản vẽ chứ không nhận "4 tầng · 14 phòng". Thêm
 * `mode="3d"` vào nó là sửa `src/components/**`, thứ R-68 cấm trong lúc dựng
 * màn.
 *
 * Repo đã tự chốt lối đi thứ ba và ghi lại bằng văn bản:
 * `ObjectLayerReview.tsx:13-18` nói vỏ QC "tự dựng layout ba cột bằng `div`
 * trần" chứ không nhập `AppShell`/`Panel`/`StatusBar`, vì `StatusBar` tự làm
 * tròn số thô bên trong view — thứ `local/no-raw-number` cấm. File này chép
 * đúng cấu trúc ấy với tiền tố `Viewer*` của riêng nó.
 *
 * Cái ĐƯỢC, ngoài chuyện qua luật: vai Người xem gỡ được công cụ sửa khỏi ray
 * thật sự (`ViewerToolRail` nhận danh sách đã lọc), chứ không chỉ làm mờ chúng.
 *
 * ## Bảy trạng thái (A11) — nơi từng trạng thái được vẽ
 *
 * | `state` | vẽ ở đâu |
 * |---|---|
 * | `empty` | khung nhìn: nền + mặt đất + chân trời; panel phải: `EmptyState` |
 * | `loading` | khung nhìn: `Skeleton` trên nền thật; panel phải: `Skeleton` |
 * | `partial` | ray tầng mờ những tầng chưa dựng xong; phần còn lại bình thường |
 * | `error` | `InlineAlert` kèm nút thử lại trong panel phải; khung nhìn VẪN xem được |
 * | `success` | đủ bốn tầng, đủ số trên thanh trạng thái |
 * | `forbidden` | công cụ sửa BỊ GỠ khỏi ray; panel phải nói rõ vai |
 * | `collapsed` | hai ray và panel phải ẩn; khung nhìn và lớp nổi còn nguyên |
 *
 * Không nhánh nào trả `null`: khung nhìn và thanh trạng thái luôn được vẽ, nên
 * màn trắng — thất bại duy nhất A11 tồn tại để chặn — không có chỗ xảy ra.
 *
 * ## Không hộp thoại nào đè lên khung nhìn
 *
 * Vỏ không dựng `Modal`, `Drawer` hay `Dialog` nào. Đó là một lời hứa của đặc
 * tả, và cách giữ nó là đơn giản nhất có thể: không nhập chúng.
 */

import { cn } from '@/lib/utils';

import { ViewerInspector } from './ViewerInspector';
import {
  ViewerElevationScale,
  ViewerLegend,
  ViewerPerfChip,
  ViewerTopRightControls,
  ViewerZoomControls,
} from './ViewerOverlays';
import { ViewerStatusBar } from './ViewerStatusBar';
import { ViewerStoreyRail } from './ViewerStoreyRail';
import { ViewerToolRail } from './ViewerToolRail';
import { ViewerTopBar } from './ViewerTopBar';
import { ViewerViewport } from './ViewerViewport';
import { VIEWER_LAYOUT, type ViewerShellProps } from './viewerShellTypes';

/** Nhãn vùng của cả màn — bài kiểm tìm màn bằng đúng tên này. */
export const VIEWER_SHELL_LABEL = 'Vỏ khung nhìn 3D';

export function ViewerShell(props: ViewerShellProps) {
  const {
    state,
    breadcrumbs,
    viewMode,
    onViewModeChange,
    presets,
    activePresetId,
    onPresetChange,
    tools,
    activeToolId,
    onToolChange,
    storeys,
    onStoreyActivate,
    onStoreyVisibilityToggle,
    separation,
    onSeparationChange,
    separationLabel,
    frame,
    renderScene,
    sceneActions,
    onViewportPointerMove,
    onViewportPointerDown,
    onViewportPointerUp,
    onViewportWheel,
    onViewportDoubleClick,
    hoverLabel,
    hoverPointPx,
    onCubeFaceSelect,
    zoomLabel,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onFitAll,
    legend,
    perf,
    selection,
    inspectorHint,
    scrollToEntityId,
    status,
    errorMessage,
    onRetry,
  } = props;

  const isCollapsed = state === 'collapsed';

  return (
    <section
      aria-label={VIEWER_SHELL_LABEL}
      className="flex h-full w-full flex-col overflow-hidden bg-bg-app"
    >
      <ViewerTopBar
        activePresetId={activePresetId}
        breadcrumbs={breadcrumbs}
        isLoading={state === 'loading'}
        onPresetChange={onPresetChange}
        onViewModeChange={onViewModeChange}
        presets={presets}
        viewMode={viewMode}
      />

      <div className="flex min-h-0 flex-1">
        {!isCollapsed && (
          <>
            <ViewerToolRail
              activeToolId={activeToolId}
              onToolChange={onToolChange}
              tools={tools}
            />
            <ViewerStoreyRail
              onSeparationChange={onSeparationChange}
              onStoreyActivate={onStoreyActivate}
              onStoreyVisibilityToggle={onStoreyVisibilityToggle}
              separation={separation}
              separationLabel={separationLabel}
              storeys={storeys}
            />
          </>
        )}

        <ViewerViewport
          frame={frame}
          hoverLabel={hoverLabel}
          hoverPointPx={hoverPointPx}
          onDoubleClick={onViewportDoubleClick}
          onPointerDown={onViewportPointerDown}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onWheel={onViewportWheel}
          sceneActions={sceneActions}
          state={state}
          {...(renderScene !== undefined ? { renderScene } : {})}
        >
          {/* Ray công cụ nổi lên khung nhìn khi hai ray đã thu gọn. */}
          {isCollapsed && (
            <div className={cn('absolute left-2 top-2 rounded-[12px] bg-bg-surface/90 shadow-float')}>
              <ViewerToolRail
                activeToolId={activeToolId}
                onToolChange={onToolChange}
                tools={tools}
              />
            </div>
          )}

          {/* Thang cao độ tầng, dọc mép trái. */}
          <div className="pointer-events-none absolute bottom-16 left-2 top-2 flex items-center">
            <ViewerElevationScale storeys={storeys} />
          </div>

          {/* ViewCube 72 góc trên phải, bản đồ nhỏ ngay dưới. */}
          <div className="absolute right-2 top-2">
            <ViewerTopRightControls
              activePresetId={activePresetId}
              onCubeFaceSelect={onCubeFaceSelect}
              presets={presets}
            />
          </div>

          {/* Cụm thu phóng góc phải dưới. */}
          <div className="absolute bottom-2 right-2">
            <ViewerZoomControls
              onFitAll={onFitAll}
              onZoomIn={onZoomIn}
              onZoomOut={onZoomOut}
              onZoomReset={onZoomReset}
              zoomLabel={zoomLabel}
            />
          </div>

          {/* Chú giải góc trái dưới. */}
          <div className="absolute bottom-2 left-2">
            <ViewerLegend legend={legend} />
          </div>
        </ViewerViewport>

        {/* Panel phải trượt vào bằng cách kẹp `width`/`opacity`, không gỡ
            khỏi DOM — nên `aria-hidden` là dấu hiệu "thu gọn" thật cho trình
            đọc màn hình thay vì việc phần tử biến mất đột ngột. Giữ nguyên
            câu chuyện cho người dùng giảm chuyển động: `frame.reducedMotion`
            tắt hẳn transition thay vì chỉ chạy nhanh hơn. */}
        <div
          aria-hidden={isCollapsed}
          className={cn(
            'shrink-0 overflow-hidden',
            isCollapsed ? 'py-0 pr-0 opacity-0' : 'py-3 pr-3 opacity-100',
            frame.reducedMotion
              ? 'transition-none'
              : 'transition-all duration-standard ease-in-out',
          )}
          style={{ width: isCollapsed ? 0 : VIEWER_LAYOUT.inspectorPx }}
        >
          <ViewerInspector
            errorMessage={errorMessage}
            inspectorHint={inspectorHint}
            onRetry={onRetry}
            scrollToEntityId={scrollToEntityId}
            selection={selection}
            state={state}
          />
        </div>
      </div>

      <ViewerStatusBar status={status}>
        <ViewerPerfChip perf={perf} />
      </ViewerStatusBar>
    </section>
  );
}
