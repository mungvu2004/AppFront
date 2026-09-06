/**
 * `FurnitureLibraryPanel` ĐÃ NỐI DÂY — hook cộng view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ MỘT MÀN KHÁC gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <FurnitureLibraryPanelContainer
 *   floorId={activeFloorId}
 *   onModelDropped={(modelId, targetEntityId) => flashInserted(modelId, targetEntityId)}
 * />
 * ```
 *
 * Không một dòng logic nào phải viết thêm ở nơi gọi: bộ lọc, ô tìm, phiên kéo
 * thả, hộp xem trước "Thay thế tất cả", bảy trạng thái và cả phán quyết phân
 * quyền đều đã nằm trọn phía sau thẻ đó.
 *
 * Panel này là một PHẦN của `Viewer3D`, không phải một route — nên nó không đọc
 * `useParams`, không gọi `useNavigate`, không dựng vỏ route riêng. `rg
 * "Placeholder" src/routes/` không trả về một chỗ giữ chỗ nào của panel này (chỉ
 * `/projects/:id/rules`, `/projects/:id/export`, `/admin/models`,
 * `/admin/users`, `/design-system/states` và `404`), nên R-66 không áp: không
 * hằng số route nào được thêm cho panel này, và bịa một route ra "cho đủ luật"
 * sẽ là một đường cụt dẫn người dùng vào màn trắng — đúng thứ A11 sinh ra để
 * chặn.
 *
 * ## Vai không phải một prop — container tự đọc
 *
 * `FurnitureLibraryPanelContainerProps` cố ý không có trường `roles`/`canEdit`:
 * màn gọi panel này không cần biết chuyện phân quyền. Container đọc
 * `useSession().roles` rồi hỏi đúng cổng phân quyền dùng chung
 * `can('manage', 'library', { roles })` (`@/lib/auth/permissions.ts`) — cùng
 * khoá `library.manage` mà `.notes` mục (h) đã khảo sát: `admin: true`,
 * `engineer: false`, `viewer: false`. `false` là lý do hook trả trạng thái
 * `forbidden`: thẻ vẫn xem được, nhưng khoá kéo và không có nút tải lên.
 *
 * ## `onUploadModel` — tuỳ chọn, và đó là câu trả lời trung thực
 *
 * Repo CHƯA có đường tải mô hình lên: `ENDPOINTS.library` chỉ có `list` và
 * `detail`, `LibraryApi` chỉ có `list()`/`read()`, `src/lib/upload` cắt và băm
 * BẢN VẼ cho `DrawingsApi` chứ không đụng tới `.glb`. R-69 cấm bịa một endpoint,
 * cấm dựng hàm giả và cấm hẹn nợ bằng ghi chú, nên hành động ấy KHÔNG được
 * container tự chế ra: nó là một prop tuỳ chọn của màn cha, và khi màn cha chưa
 * cấp được thì `canUploadModel` là `false` và nút "Tải lên mô hình" không hiện.
 *
 * Quyền và đường đi là HAI điều kiện, cả hai đều cần: một quản trị viên ngồi
 * trong một màn chưa nối đường tải lên vẫn không thấy nút, vì bấm vào nó sẽ
 * chẳng đi tới đâu.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải bản chưa nối ở
 * `src/lib/screen-state`. `key={props.floorId}` gắn lại ranh giới mỗi lần đổi
 * tầng — đổi tầng LÀ mốc điều hướng của panel này (cùng lý lẽ `key={projectId}`
 * của `Viewer3DContainer` và `key={activeScreen}` của `App.tsx`), khác hẳn một
 * cú bấm chọn thẻ. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, nên panel không bao giờ ra ô trắng (A11).
 */

import { useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';

import { FurnitureLibraryPanel } from './FurnitureLibraryPanel';
import { useFurnitureLibraryPanel } from './useFurnitureLibraryPanel';
import type { FurnitureLibraryPanelContainerProps } from './furnitureLibraryPanelTypes';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const FURNITURE_LIBRARY_PANEL_SCREEN_ID = 'furniture-library-panel';

/**
 * Thứ người dùng thấy thay cho panel đã sập.
 *
 * Cùng khuôn `PropertyInspectorCrashFallback` bên cạnh: chữ lấy thẳng từ
 * `report.description` (đã là tiếng Việt có dấu), nút "thử lại" chỉ hiện khi lỗi
 * thuộc loại đáng thử lại, và nền lấp đúng khung mà nơi gọi đã dành cho panel.
 */
function FurnitureLibraryPanelCrashFallback({ report, retry }: ScreenErrorFallback) {
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
 * `onUploadModel` của hook là bắt buộc còn của container là tuỳ chọn, nên chỗ
 * này có đúng một hàm rỗng — và nó KHÔNG BAO GIỜ chạy: `canUploadModel` chỉ
 * `true` khi màn cha đã cấp một hàm thật, và hook trả `onUploadModel: null` cho
 * view ở mọi trường hợp còn lại, tức nút không được vẽ ra để mà bấm.
 */
function WiredFurnitureLibraryPanel(props: FurnitureLibraryPanelContainerProps) {
  const session = useSession();

  const canManageLibrary = useMemo(
    () => can('manage', 'library', { roles: session.roles }),
    [session.roles],
  );

  const uploadModel = props.onUploadModel;

  const model = useFurnitureLibraryPanel({
    floorId: props.floorId,
    canUploadModel: canManageLibrary && uploadModel !== undefined,
    onModelDropped: props.onModelDropped,
    onUploadModel: uploadModel ?? ((): void => undefined),
  });

  return <FurnitureLibraryPanel {...model} />;
}

/** `<FurnitureLibraryPanelContainer>` — panel đã nối dây, gắn được bằng một thẻ. */
export function FurnitureLibraryPanelContainer(props: FurnitureLibraryPanelContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.floorId}
      renderFallback={(fallback) => <FurnitureLibraryPanelCrashFallback {...fallback} />}
      screenId={FURNITURE_LIBRARY_PANEL_SCREEN_ID}
    >
      <WiredFurnitureLibraryPanel {...props} />
    </ScreenErrorBoundary>
  );
}
