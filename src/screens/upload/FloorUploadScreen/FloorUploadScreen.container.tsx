/**
 * Route `ROUTE_PATTERNS.projectUpload`, nối với client thật, với bộ đệm query và
 * với router.
 *
 * Hai lớp, cố ý tách — cùng khuôn `ProjectSettings.container.tsx`:
 *
 * - {@link FloorUploadScreenContainer} nhận đủ mọi thứ qua props và **không**
 *   gọi `useToast`, `useNavigate` hay `useParams`. Nhờ vậy bất kỳ màn nào cũng
 *   mở được nó bằng một dòng, kể cả khi ở đó chưa có `Toast.Provider` nào
 *   (R-73). Không hành động nào của màn này bị bỏ lại dưới dạng callback không
 *   ai truyền: `onToast` và `onNavigate` đều có nơi cung cấp thật ở
 *   {@link FloorUploadRoute}.
 * - {@link FloorUploadRoute} là nơi duy nhất biết tới router: nó đọc `:id` khỏi
 *   URL, đọc vai khỏi phiên làm việc, dựng `Toast.Provider`, và chuyển
 *   `navigate` xuống cho hook — hook không được gọi `useNavigate()` vì nó phải
 *   test được không cần Router.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`.
 *
 * `gateway` là prop có mặc định chứ không phải hằng bên trong: test và story cắm
 * một cổng chạy trên `createMockApiClient()` vào đúng chỗ này, cùng khuôn tiêm
 * phụ thuộc mà `useFloorUploadScreen.test.ts` đã dùng.
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { Toast, useToast } from '@/components/feedback/Toast';
import { useSession } from '@/hooks/useSession';
import type { ProjectRole } from '@/types/project';

import { FloorUploadScreenView } from './FloorUploadScreen';
import { createAppFloorUploadGateway, type FloorUploadGateway } from './floorUploadGateway';
import { useFloorUploadScreen, type FloorUploadToast } from './useFloorUploadScreen';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'floor-upload';

/** Câu cho trường hợp đường dẫn thiếu mã dự án — cùng khuôn `ProjectSettingsRoute`. */
const MISSING_PROJECT_TITLE = 'Không xác định được dự án';
const MISSING_PROJECT_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải mở màn tải bản vẽ của dự án nào.';

export interface FloorUploadScreenContainerProps {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Toast hoàn tác của A8. Tiêm vào bởi nơi đã dựng `Toast.Provider`. */
  readonly onToast?: (toast: FloorUploadToast) => void;
  /** Điều hướng sau khi lượt xử lý bắt đầu. Hook dựng sẵn đường dẫn bằng `ROUTES`. */
  readonly onNavigate?: (path: string) => void;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  /** Đồng hồ tiêm được (R-29); vé hoàn tác của lượt xoá đọc nó. */
  readonly now?: () => number;
  /** Seam dữ liệu. Mặc định là cổng chạy trên client thật của ứng dụng. */
  readonly gateway?: FloorUploadGateway;
}

/** Cùng khuôn với `ProjectSettingsCrashFallback` — R-62. */
function FloorUploadCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/** Hook cộng view, không có provider nào ở giữa. */
function WiredFloorUpload(props: FloorUploadScreenContainerProps) {
  const fallbackGateway = useMemo(() => createAppFloorUploadGateway(), []);
  const gateway = props.gateway ?? fallbackGateway;

  const model = useFloorUploadScreen({
    gateway,
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onToast !== undefined ? { onToast: props.onToast } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
    ...(props.now !== undefined ? { now: props.now } : {}),
  });

  return <FloorUploadScreenView {...model} />;
}

/** `<FloorUploadScreenContainer projectId={...} />` — màn tải bản vẽ thật, đã nối. */
export function FloorUploadScreenContainer(props: FloorUploadScreenContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <FloorUploadCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredFloorUpload {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong `Toast.Provider`, nên `useToast` ở đây chắc chắn tìm được provider. */
function FloorUploadRouteBody({
  projectId,
  roles,
}: {
  projectId: string;
  roles: readonly ProjectRole[];
}) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  return (
    <FloorUploadScreenContainer
      onNavigate={(path) => navigate(path)}
      onToast={addToast}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn tải bản vẽ, đăng ký tại `src/routes/router.tsx`. */
export function FloorUploadRoute() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();

  if (id === undefined || id.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert
          level="violation"
          message={MISSING_PROJECT_MESSAGE}
          title={MISSING_PROJECT_TITLE}
        />
      </div>
    );
  }

  return (
    <Toast.Provider>
      <FloorUploadRouteBody projectId={id} roles={session.roles} />
    </Toast.Provider>
  );
}
