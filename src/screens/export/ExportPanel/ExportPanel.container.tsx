/**
 * Route `ROUTE_PATTERNS.projectExport` — nối hook với view, và với ranh giới
 * lỗi. Cùng khuôn `RuleSettings.container.tsx`.
 *
 * ## Vai không phải một prop — container tự đọc
 *
 * `ExportPanelContainerProps` cố ý không có trường `roles`: màn gọi container
 * này không cần biết chuyện phân quyền. Container đọc `useSession().roles`
 * rồi hỏi đúng cổng phân quyền dùng chung `can('export', 'model', { roles })`
 * (`@/lib/auth/permissions.ts`) — cùng khoá `model.export` mà
 * `l1b-format-telemetry.md` đã khảo sát: `admin: true`, `engineer: true`,
 * `viewer: false`. Vai Người xem không xuất được **bất cứ định dạng nào** —
 * khoá này gác cả bốn, không có quyền riêng cho ảnh dù đặc tả cũ có nói vậy.
 * `false` là lý do hook trả trạng thái `forbidden` kèm `permissionCaption`;
 * container chỉ đưa `canExport` vào, không tự vẽ trạng thái đó.
 *
 * ## `onNavigateToFix` — có mặc định thật, không phải một prop chết
 *
 * Mỗi `PreflightRow.fixHref` là một đường dẫn thật lấy từ `ROUTES` (không phải
 * một khả năng còn thiếu như `onUploadModel` của `FurnitureLibraryPanel`), nên
 * để hành động này là một prop tuỳ chọn không ai truyền sẽ biến nút "sửa"
 * thành một nút chết — đúng lỗi R-73 sinh ra để chặn. Container tự có
 * `useNavigate()` làm mặc định; `onNavigateToFix` chỉ tồn tại để một màn nhúng
 * container này thay bằng điều hướng riêng của nó.
 *
 * ## `onToast` — đi lên, tuỳ chọn, cùng lý do của `RuleSettings`
 *
 * Repo chưa có nhà cung cấp toast toàn cục, nên chủ của bề mặt toast tự quyết
 * định toast hiện ở đâu. Vắng `onToast` thì màn vẫn chạy đủ — danh sách tệp đã
 * xuất và khối lỗi trong `ExportPanelProps` đã tự nói đủ mọi thứ cần nói, chỉ
 * là không có thêm một lời nhắc nổi lên ở nơi khác.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn
 * (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự phòng
 * dựng bằng `EmptyState` từ `report.description`, cùng khuôn `RuleSettings`.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';
import type { Announcer } from '@/lib/input/announcer';

import { ExportPanel } from './ExportPanel';
import { useExportPanel, type ExportPanelToast } from './useExportPanel';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'export-panel';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên chưa mở được màn xuất. Quay lại danh sách dự án rồi chọn lại dự án cần xuất.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface ExportPanelContainerProps {
  /** Mã dự án. Khi có, dùng nó thay vì đọc URL — để màn khác nhúng được container. */
  readonly projectId?: string;
  /** Vỏ ngoài báo màn đang ở chế độ thu gọn (`isCollapsed` của A11 trạng thái 7). */
  readonly isCompact?: boolean;
  /** Nơi nhận toast báo kết quả xuất. Vắng mặt thì màn vẫn chạy đủ, chỉ không ai mời bấm. */
  readonly onToast?: (toast: ExportPanelToast) => void;
  /**
   * Điều hướng khi bấm "sửa" ở một dòng kiểm tra trước khi xuất. Mặc định là
   * `useNavigate()` thật của container — chỉ truyền prop này khi một màn khác
   * nhúng container và cần tự quyết định cách điều hướng.
   */
  readonly onNavigateToFix?: (href: string) => void;
  /** Đồng hồ tiêm được, để bài kiểm lái các mốc thời gian trong danh sách tệp. */
  readonly now?: () => number;
  /** Trạng thái mạng tiêm được, để bài kiểm dựng lượt xuất hỏng vì mất kết nối. */
  readonly isOnline?: () => boolean;
  /** Người xướng cho trình đọc màn hình — nói ra các bước tiến trình thật. */
  readonly announcer?: Announcer;
}

/** Cùng khuôn `RuleSettingsCrashFallback` — R-62, chữ lấy từ `report.description`. */
function ExportPanelCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
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

interface WiredExportPanelProps extends Omit<ExportPanelContainerProps, 'projectId'> {
  readonly projectId: string;
}

/**
 * Hook cộng view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `RuleSettings.container.tsx`.
 */
function WiredExportPanel(props: WiredExportPanelProps) {
  const session = useSession();
  const navigate = useNavigate();

  const canExport = useMemo(
    () => can('export', 'model', { roles: session.roles }),
    [session.roles],
  );

  const navigateToFix = props.onNavigateToFix ?? ((href: string) => navigate(href));

  const viewProps = useExportPanel({
    canExport,
    navigateToFix,
    projectId: props.projectId,
    ...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {}),
    ...(props.onToast !== undefined ? { onToast: props.onToast } : {}),
    ...(props.now !== undefined ? { now: props.now } : {}),
    ...(props.isOnline !== undefined ? { isOnline: props.isOnline } : {}),
    ...(props.announcer !== undefined ? { announcer: props.announcer } : {}),
  });

  return <ExportPanel {...viewProps} />;
}

/**
 * `<ExportPanelContainer />` khi gắn qua router (đọc `:id` từ URL), hoặc
 * `<ExportPanelContainer projectId={...} />` khi một màn khác nhúng nó.
 */
export function ExportPanelContainer(props: ExportPanelContainerProps) {
  const params = useParams<{ id: string }>();
  const projectId = props.projectId ?? params.id;

  if (projectId === undefined || projectId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          message={MISSING_PARAMS_MESSAGE}
          title={MISSING_PARAMS_TITLE}
        />
      </div>
    );
  }

  return (
    <ScreenErrorBoundary
      key={projectId}
      renderFallback={({ report, retry }) => (
        <ExportPanelCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredExportPanel
        projectId={projectId}
        {...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {})}
        {...(props.onToast !== undefined ? { onToast: props.onToast } : {})}
        {...(props.onNavigateToFix !== undefined ? { onNavigateToFix: props.onNavigateToFix } : {})}
        {...(props.now !== undefined ? { now: props.now } : {})}
        {...(props.isOnline !== undefined ? { isOnline: props.isOnline } : {})}
        {...(props.announcer !== undefined ? { announcer: props.announcer } : {})}
      />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn xuất, đăng ký tại `src/routes/router.tsx`. */
export function ExportPanelRoute() {
  return <ExportPanelContainer />;
}
