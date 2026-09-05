/**
 * `PropertyInspector` ĐÃ NỐI DÂY — hook cộng view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ MỘT MÀN KHÁC gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <PropertyInspectorContainer
 *   selectedEntityId={selectedId}
 *   selectedEntityIds={selectedIds}
 *   onDismiss={closePanel}
 *   onNavigateToObject={flyToEntity}
 *   onOpenRuleScreen={openRuleScreen}
 * />
 * ```
 *
 * Panel này là một PHẦN của `Viewer3D` (quyết định đã chốt của điều phối viên —
 * xem đầu `docs/contracts/property-inspector/commands.md`), không phải một
 * route: nó không đọc `useParams`, không dựng vỏ route riêng kiểu
 * `Viewer3DRoute`/`AuthRoute`. Chưa nơi nào gọi container này (K6 của nhiệm vụ)
 * — đó là nợ đã ghi nhận, không phải lý do để bỏ trống bất kỳ callback nào của
 * `PropertyInspectorContainerProps` (R-73): mọi trường của nó đều được nối tới
 * `usePropertyInspector` ngay tại đây, ngay bây giờ.
 *
 * ## Vai không phải một prop — container tự đọc
 *
 * `PropertyInspectorContainerProps` (`propertyInspectorTypes.ts`) cố ý không có
 * trường `roles`/`canEdit`, khác `Viewer3DContainerProps`/`ViewerShellContainerProps`:
 * màn gọi panel này không cần biết chuyện phân quyền. Container tự đọc
 * `useSession().roles` rồi tính `canEdit` bằng đúng cổng phân quyền dùng chung
 * `can('edit', 'layer', { roles })` (`@/lib/auth/permissions.ts:127`) — cùng lệnh
 * `useViewer3D.ts:386` đã gọi cho khung nhìn 3D, nên vai Người xem khoá đúng một
 * chỗ cho cả khung nhìn lẫn panel thanh tra của nó. `canEdit === false` là lý do
 * hook trả trạng thái `forbidden` (K4, mục 2 của `strings.md`).
 *
 * ## Không có tầng máy chủ ở đây
 *
 * `usePropertyInspector` đọc dữ liệu không gian đang sửa thẳng từ store (đồng
 * bộ, không qua `useQuery` — mục C7 của `commands.md`: đây là dữ liệu ĐANG SỬA,
 * không phải một lượt gọi mạng), nên container không dựng gateway, không gọi
 * `useQuery`/`useMutation` nào — nó chỉ chuyển tiếp props cộng vai đã tính
 * xuống hook, đúng tinh thần "container mỏng nhất có thể" của
 * `CreateProjectModal.container.tsx` và `AuthScreen.container.tsx`.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải bản chưa nối ở
 * `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, nên panel không bao giờ ra ô trắng (A11) — kể cả khi
 * nó chỉ là một mảnh trong một màn lớn hơn. Không `key` theo
 * `selectedEntityId`: đổi đối tượng đang chọn là chuyện xảy ra ở MỌI cú bấm,
 * không phải một mốc điều hướng như đổi dự án (`key={projectId}` của
 * `Viewer3DContainer`) hay đổi màn demo (`key={activeScreen}` của `App.tsx`) —
 * gắn lại ranh giới ở đó sẽ xoá trạng thái hook mỗi lần người dùng bấm chọn một
 * đối tượng khác.
 */

import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ScreenErrorBoundary, type ScreenErrorFallback } from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';

import { PropertyInspector } from './PropertyInspector';
import { usePropertyInspector } from './usePropertyInspector';
import type { PropertyInspectorContainerProps } from './propertyInspectorTypes';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const PROPERTY_INSPECTOR_SCREEN_ID = 'property-inspector';

/**
 * Cùng khuôn `Viewer3DCrashFallback`/`ViewerShellCrashFallback` — R-62.
 *
 * Panel không có viền bao ngoài (CẤM TUYỆT ĐỐI), kể cả lúc sập: chỉ nền
 * `bg-bg-surface` lấp đúng khung mà nơi gọi đã dành cho panel, không `border`,
 * không `shadow`.
 */
function PropertyInspectorCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/**
 * Hook cộng view, không provider nào ở giữa.
 *
 * Cả năm trường của `PropertyInspectorContainerProps` đều bắt buộc — không
 * trường tuỳ chọn nào bị bỏ quên (R-73) — nên không cần trải có điều kiện kiểu
 * `exactOptionalPropertyTypes` như các container khác trong `src/screens/viewer`.
 */
function WiredPropertyInspector(props: PropertyInspectorContainerProps) {
  const session = useSession();
  const canEdit = useMemo(() => can('edit', 'layer', { roles: session.roles }), [session.roles]);

  const model = usePropertyInspector({
    canEdit,
    onDismiss: props.onDismiss,
    onNavigateToObject: props.onNavigateToObject,
    onOpenRuleScreen: props.onOpenRuleScreen,
    selectedEntityId: props.selectedEntityId,
    selectedEntityIds: props.selectedEntityIds,
  });

  return <PropertyInspector {...model} />;
}

/** `<PropertyInspectorContainer>` — panel đã nối dây, gắn được bằng một thẻ. */
export function PropertyInspectorContainer(props: PropertyInspectorContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={(fallback) => <PropertyInspectorCrashFallback {...fallback} />}
      screenId={PROPERTY_INSPECTOR_SCREEN_ID}
    >
      <WiredPropertyInspector {...props} />
    </ScreenErrorBoundary>
  );
}
