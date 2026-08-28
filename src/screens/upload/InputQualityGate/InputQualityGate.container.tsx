/**
 * Route `ROUTE_PATTERNS.projectQuality`, nối hook với router.
 *
 * Cùng khuôn `FloorUploadScreen.container.tsx` — hai lớp, cố ý tách:
 *
 * - {@link InputQualityGateContainer} nhận đủ mọi thứ qua props và **không**
 *   gọi `useNavigate` hay `useParams`. Nhờ vậy bất kỳ màn nào cũng mở được nó
 *   bằng một dòng, kể cả trong test hay story (R-73).
 * - {@link InputQualityGateRoute} là nơi duy nhất biết tới router: nó đọc
 *   `:id` khỏi URL, đọc vai khỏi phiên làm việc, và chuyển `navigate` xuống
 *   cho hook — hook không được gọi `useNavigate()` để còn test được không cần
 *   Router.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`.
 */

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

import { InputQualityGateView } from './InputQualityGate';
import type { InputQualityGateway } from './inputQualityGateway';
import { useInputQualityGate, type InputQualityToast } from './useInputQualityGate';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'input-quality-gate';

/** Câu cho trường hợp đường dẫn thiếu mã dự án — cùng khuôn `FloorUploadRoute`. */
const MISSING_PROJECT_TITLE = 'Không xác định được dự án';
const MISSING_PROJECT_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải mở màn kiểm tra chất lượng của dự án nào.';

export interface InputQualityGateContainerProps {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Điều hướng sau khi bấm tiếp tục hoặc tải bản vẽ khác. */
  readonly onNavigate?: (path: string) => void;
  /**
   * Toast hoàn tác của A8. Tiêm vào bởi nơi đã dựng `Toast.Provider` — container
   * cố ý **không** gọi `useToast()` để màn khác mở được nó ở chỗ chưa có
   * provider nào (R-73). Không nối dây này thì nắn thẳng và gửi bốn góc vẫn
   * hoàn tác được nhưng người dùng không bao giờ thấy lối hoàn tác — A8 hỏng.
   */
  readonly onToast?: (toast: InputQualityToast) => void;
  /**
   * Cổng dữ liệu. Có mặc định thật bên trong hook, nên nơi gọi bình thường bỏ
   * trống; test và story cắm `createInputQualityGateway(createMockApiClient())`
   * vào đúng phép ánh xạ mà bản sản phẩm dùng (R-70), cùng khuôn
   * `FloorUploadScreenContainerProps.gateway`.
   */
  readonly gateway?: InputQualityGateway;
  /** Đồng hồ tiêm được (R-29) — vé hoàn tác của A8 đọc nó. */
  readonly now?: () => number;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** Cùng khuôn với `FloorUploadCrashFallback` — R-62. */
function InputQualityGateCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredInputQualityGate(props: InputQualityGateContainerProps) {
  const { actions, model } = useInputQualityGate({
    projectId: props.projectId,
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.onNavigate !== undefined ? { onNavigate: props.onNavigate } : {}),
    ...(props.onToast !== undefined ? { onToast: props.onToast } : {}),
    ...(props.gateway !== undefined ? { gateway: props.gateway } : {}),
    ...(props.now !== undefined ? { now: props.now } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
  });

  return <InputQualityGateView actions={actions} model={model} />;
}

/** `<InputQualityGateContainer projectId={...} />` — màn kiểm tra chất lượng thật, đã nối. */
export function InputQualityGateContainer(props: InputQualityGateContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <InputQualityGateCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredInputQualityGate {...props} />
    </ScreenErrorBoundary>
  );
}

/** Bên trong router thật và `Toast.Provider`, nên `useNavigate`/`useToast` chắc chắn tìm được provider. */
function InputQualityGateRouteBody({
  projectId,
  roles,
}: {
  projectId: string;
  roles: readonly ProjectRole[];
}) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  return (
    <InputQualityGateContainer
      onNavigate={(path) => navigate(path)}
      onToast={({ message, onUndo }) => {
        addToast({ message, onUndo });
      }}
      projectId={projectId}
      roles={roles}
    />
  );
}

/** Route thật của màn kiểm tra chất lượng, đăng ký tại `src/routes/router.tsx`. */
export function InputQualityGateRoute() {
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
      <InputQualityGateRouteBody projectId={id} roles={session.roles} />
    </Toast.Provider>
  );
}
