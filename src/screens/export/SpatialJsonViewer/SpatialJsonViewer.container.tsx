/**
 * S-36 đã nối: kho, quyền, ranh giới lỗi, route.
 *
 * Lớp mỏng nhất có thể trên {@link SpatialJsonViewer}, cùng khuôn
 * `VersionHistory.container.tsx`.
 *
 * ## Dữ liệu đến từ kho, không từ mạng
 *
 * `spatialSlice` đã giữ đồ thị của tầng đang mở ở dạng phẳng
 * (`NormalizedSpatial`). {@link denormalizeSpatial} dựng lại dạng lồng — và
 * theo docblock của chính nó, `denormalizeSpatial(normalizeSpatial(g))` bằng
 * `g`, nên thứ màn hiện đúng là thứ đã lưu, không phải một bản dựng lại gần
 * đúng.
 *
 * ## Vì sao `canView` đọc từ vai, không từ bảng quyền
 *
 * `lib/auth/permissions.ts` có tám khoá và **không khoá nào là "view"** — bảng
 * ấy nói về sửa, tải lên, xuất, quản trị. Nên câu hỏi "người này có được xem dữ
 * liệu không" không có khoá để tra, và điều gần nhất có thật là: họ có vai nào
 * trên dự án này không. Không vai nào thì không thấy gì — đó là trạng thái
 * "không có quyền" của A11, và nó **có thật**, không phải một trạng thái dựng
 * ra cho đủ bảy.
 *
 * ## Trạng thái "lỗi" đến từ đâu
 *
 * Kho không có trường lỗi cho dữ liệu không gian, nên nếu chỉ đọc kho thì
 * trạng thái lỗi sẽ không bao giờ chạm tới được. Nhưng có một đường hỏng có
 * thật: dữ liệu trong kho méo thì {@link denormalizeSpatial} hoặc
 * {@link checkIntegrity} ném. Bắt lấy chỗ đó và nói ra câu lỗi là đường lỗi
 * thật của màn này.
 *
 * Đường ra của trạng thái ấy **không** phải "thử lại" — xem chú thích của
 * `onReopenFloors` bên dưới. Lỗi ném từ lúc dựng cây React thì vẫn là việc của
 * {@link ScreenErrorBoundary}.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { checkIntegrity } from '@/domain/spatial/integrity';
import { denormalizeSpatial } from '@/domain/spatial/normalize';
import type { SpatialGraph } from '@/domain/spatial/types';
import { useSession } from '@/hooks/useSession';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { SpatialJsonViewer } from './SpatialJsonViewer';
import type { SpatialJsonIssue, SpatialJsonViewerContainerProps } from './types';
import { useSpatialJsonViewer } from './useSpatialJsonViewer';

const SCREEN_ID = 'spatial-json-viewer';

/** Dưới 1024 thì nửa phải ẩn đi — trạng thái "thu gọn" của A11. */
const NARROW_QUERY = '(max-width: 1023px)';

const MISSING_PROJECT_TITLE = 'Không xác định được dự án';
const MISSING_PROJECT_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải hiện dữ liệu không gian của dự án nào.';

const BROKEN_GRAPH_MESSAGE =
  'Dữ liệu không gian đang giữ trong phiên làm việc này không đọc được. Hãy mở lại bản vẽ từ màn quản lý tầng.';

/**
 * Ngưỡng thu gọn, theo dõi tại chỗ.
 *
 * Bản chép ngắn của cùng khuôn trong `VersionHistory.container.tsx` và
 * `Drawer.tsx:14-17`: `useBreakpoint` là hàm riêng tư của `useAppShell.ts`, và
 * R-68 cấm lượt dựng màn sửa `src/hooks`.
 */
function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(NARROW_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);

    setIsNarrow(media.matches);

    const listener = (event: MediaQueryListEvent): void => {
      setIsNarrow(event.matches);
    };

    media.addEventListener('change', listener);

    return (): void => {
      media.removeEventListener('change', listener);
    };
  }, []);

  return isNarrow;
}

/** Lỗi toàn vẹn của D-13 thành hàng của dải kiểm tra. Câu tiếng Việt đã có sẵn ở đó. */
const toScreenIssue = (issue: { rule: string; severity: 'critical' | 'warning'; entityId: string; message: string }): SpatialJsonIssue => ({
  id: `${issue.rule}:${issue.entityId}`,
  path: issue.entityId,
  problem: issue.message,
  severity: issue.severity,
});

interface DerivedGraph {
  readonly graph: SpatialGraph | null;
  readonly issues: readonly SpatialJsonIssue[];
  readonly errorMessage: string | null;
}

function SpatialJsonViewerCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-bg-app">
      <EmptyState
        icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

function WiredSpatialJsonViewer({ onCopy, onDownload, projectId }: SpatialJsonViewerContainerProps) {
  const navigate = useNavigate();
  const session = useSession();
  const storeRoles = useStore((state) => state.userRoles);
  const spatial = useStore((state) => state.spatial);
  const isLoading = useStore((state) => state.spatialLoading);
  const isNarrow = useIsNarrow();

  const roles: readonly ProjectRole[] = storeRoles.length > 0 ? storeRoles : session.roles;
  const canView = roles.length > 0;

  const derived: DerivedGraph = useMemo(() => {
    if (spatial === null) {
      return { errorMessage: null, graph: null, issues: [] };
    }

    try {
      return {
        errorMessage: null,
        graph: denormalizeSpatial(spatial),
        issues: checkIntegrity(spatial).map(toScreenIssue),
      };
    } catch {
      return { errorMessage: BROKEN_GRAPH_MESSAGE, graph: null, issues: [] };
    }
  }, [spatial]);

  /**
   * Đường ra khi dữ liệu trong phiên hỏng.
   *
   * Bản đầu ở đây là một nút "thử lại" đổi một `retryKey` để ép tính lại. ESLint
   * chỉ ra ngay rằng `retryKey` không được dùng trong thân `useMemo` — và nó
   * đúng theo một nghĩa sâu hơn một cảnh báo phụ thuộc: phép dựng cây là **hàm
   * thuần của `spatial`**, nên tính lại trên cùng dữ liệu hỏng cho ra đúng lỗi
   * cũ. Một nút như thế trông như một lối thoát mà không dẫn đi đâu.
   *
   * Việc có ích thật là đi lấy lại dữ liệu, và đó là màn quản lý tầng.
   */
  const onReopenFloors = useCallback(() => {
    navigate(ROUTES.project.floors(projectId));
  }, [navigate, projectId]);

  const [model, actions] = useSpatialJsonViewer({
    canView,
    errorMessage: derived.errorMessage,
    graph: derived.graph,
    isLoading,
    isNarrow,
    issues: derived.issues,
    onReopenFloors,
    ...(onCopy !== undefined ? { onCopy } : {}),
    ...(onDownload !== undefined ? { onDownload } : {}),
  });

  return <SpatialJsonViewer model={model} actions={actions} />;
}

/** `<SpatialJsonViewerContainer projectId />` — màn dữ liệu đã nối (R-73). */
export function SpatialJsonViewerContainer(props: SpatialJsonViewerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={props.projectId}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <SpatialJsonViewerCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredSpatialJsonViewer {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật, đăng ký tại `src/routes/router.tsx`. */
export function SpatialJsonViewerRoute() {
  const { id } = useParams<{ id: string }>();

  if (id === undefined || id.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          title={MISSING_PROJECT_TITLE}
          message={MISSING_PROJECT_MESSAGE}
        />
      </div>
    );
  }

  return <SpatialJsonViewerContainer projectId={id} />;
}
