/**
 * `WallGeometryEditor` ĐÃ NỐI DÂY — hook cộng view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ MỘT MÀN KHÁC gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <WallGeometryEditorContainer
 *   wallId={selectedWallId}
 *   selectedWallIds={selectedIds}
 *   isSectionOrthographic={camera.isSectionOrthographic}
 *   isCollapsed={isNarrowViewport}
 *   onExitEditMode={leaveGeometryMode}
 *   onGeometryChanged={rebuildScene}
 * />
 * ```
 *
 * Màn này là một CHẾ ĐỘ bên trong `Viewer3D`, không phải một route: nó không
 * đọc `useParams` và không dựng vỏ route riêng. `Viewer3D` là màn đã xong và
 * nằm trong danh sách cấm sửa, nên chưa nơi nào gọi container này — đó là nợ đã
 * ghi nhận, không phải lý do để bỏ trống một trường nào của
 * `WallGeometryEditorContainerProps`: cả bảy trường đều được nối tới
 * `useWallGeometryEditor` ngay tại đây, ngay bây giờ.
 *
 * ## Vai không phải một prop — container tự đọc
 *
 * `WallGeometryEditorContainerProps` cố ý không có `canEdit`, đúng khuôn
 * `PropertyInspectorContainerProps`: màn gọi tấm phủ này không cần biết chuyện
 * phân quyền. Container đọc `useSession().roles` rồi hỏi đúng cổng phân quyền
 * dùng chung `can('edit', 'layer', { roles })` — cùng lệnh `useViewer3D` đã gọi
 * cho khung nhìn 3D, nên vai Người xem khoá đúng một chỗ cho cả khung nhìn lẫn
 * lớp phủ sửa hình học của nó.
 *
 * ## `overlayRef` — container cấp, không phải hook
 *
 * Phần tử DOM chỉ tồn tại SAU lượt gắn đầu tiên, nên nó không nằm trong
 * `UseWallGeometryEditorResult` (`Omit<…, 'overlayRef'>`). Container giữ nó
 * trong `useState` và đưa ngược xuống hook, đúng cách `Viewer3DProps.canvasRef`
 * làm với canvas.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62). Phần dự phòng dựng bằng `EmptyState`
 * từ `report.description`, nên lớp phủ không bao giờ ra ô trắng (A11). Không
 * `key` theo `wallId`: đổi tường đang sửa là chuyện xảy ra ở mọi cú bấm, không
 * phải một mốc điều hướng, và gắn lại ranh giới ở đó sẽ xoá trạng thái hook mỗi
 * lần người dùng chọn một bức tường khác.
 */

import { useCallback, useMemo, useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';

import { WallGeometryEditor } from './WallGeometryEditor';
import { useWallGeometryEditor } from './useWallGeometryEditor';
import type { WallGeometryEditorGatewayInjection } from './wallGeometryEditorGateway';
import {
  WALL_GEOMETRY_EDITOR_TEXT,
  type WallGeometryEditorContainerProps,
} from './wallGeometryEditorTypes';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const WALL_GEOMETRY_EDITOR_SCREEN_ID = 'wall-geometry-editor';

/** Props thật của container: hợp đồng của T5 cộng chỗ tiêm cổng của T6 (R-73). */
export type WallGeometryEditorContainerInput = WallGeometryEditorContainerProps &
  WallGeometryEditorGatewayInjection;

/**
 * Cùng khuôn `Viewer3DCrashFallback`/`PropertyInspectorCrashFallback` — R-62.
 *
 * Lớp phủ không có viền bao ngoài, kể cả lúc sập: chỉ nền `bg-bg-surface` lấp
 * đúng khung mà khung nhìn đã dành cho nó.
 */
function WallGeometryEditorCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-surface">
      <EmptyState
        description={report.description.description}
        icon={<div aria-hidden="true" className="h-8 w-8 rounded-full bg-state-violation-tint" />}
        title={report.description.title}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

/** Hook cộng view, không provider nào ở giữa. */
function WiredWallGeometryEditor(props: WallGeometryEditorContainerInput) {
  const session = useSession();
  const canEdit = useMemo(() => can('edit', 'layer', { roles: session.roles }), [session.roles]);
  const [overlayElement, setOverlayElement] = useState<HTMLElement | null>(null);

  /**
   * `onGeometryChanged` là sợi dây để khung nhìn dựng lại theo — R-73.
   *
   * Vắng mặt thì nó là một hàm không làm gì, chứ không phải một chỗ trống: hook
   * đòi một hàm, và một `undefined` chạy tới đó sẽ là một lỗi lúc chạy ở đúng
   * lúc người dùng vừa sửa xong hình.
   */
  const onGeometryChanged = useCallback(
    (wallId: string) => {
      props.onGeometryChanged?.(wallId);
    },
    [props],
  );

  /**
   * `forceState` là chỗ tiêm của story và bài kiểm (R-73), và nó đi vào ĐẦU VÀO
   * của hook chứ không đè lên đầu ra.
   *
   * Ba trạng thái có một đầu vào thật đứng sau chúng thì ép được thật: `empty`
   * là "chưa chọn tường nào", `collapsed` là khung nhìn thu gọn, `forbidden` là
   * vai không sửa được. `loading` chỉ được nghe khi màn CHƯA có gì để nói ngược
   * lại. Ba trạng thái còn lại — `partial`, `error`, `success` — là kết luận
   * của dữ liệu thật (nhiều tường đang chọn, một lượt ghi bị từ chối, hoặc
   * không có gì chặn), nên cờ này KHÔNG dựng chúng: một màn hình nói "đã từ
   * chối" mà không có lượt từ chối nào là đúng thứ E.10 cấm. Bài kiểm dựng ba
   * nhánh ấy bằng cách tiêm một cổng, không bằng một cờ.
   */
  const forced = props.forceState;

  const model = useWallGeometryEditor({
    canEdit: forced === 'forbidden' ? false : canEdit,
    isCollapsed: forced === 'collapsed' ? true : (props.isCollapsed ?? false),
    isSectionOrthographic: props.isSectionOrthographic ?? false,
    onExitEditMode: props.onExitEditMode,
    onGeometryChanged,
    overlayElement,
    selectedWallIds: props.selectedWallIds,
    wallId: forced === 'empty' ? null : props.wallId,
    ...(props.gateway === undefined ? {} : { gateway: props.gateway }),
  });

  const state =
    forced === 'loading' && model.state.kind === 'empty'
      ? { kind: 'loading' as const, message: WALL_GEOMETRY_EDITOR_TEXT.states.loading.message }
      : model.state;

  return <WallGeometryEditor overlayRef={setOverlayElement} state={state} />;
}

/** `<WallGeometryEditorContainer>` — lớp phủ đã nối dây, gắn được bằng một thẻ. */
export function WallGeometryEditorContainer(props: WallGeometryEditorContainerInput) {
  return (
    <ScreenErrorBoundary
      renderFallback={(fallback) => <WallGeometryEditorCrashFallback {...fallback} />}
      screenId={WALL_GEOMETRY_EDITOR_SCREEN_ID}
    >
      <WiredWallGeometryEditor {...props} />
    </ScreenErrorBoundary>
  );
}
