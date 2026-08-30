/**
 * Route `ROUTE_PATTERNS.projectPipelineGraph`, nối hook với router.
 *
 * Cùng khuôn `ScaleCalibration.container.tsx` — hai lớp, cố ý tách:
 *
 * - {@link PipelineGraphContainer} nhận đủ mọi thứ qua props và **không** gọi
 *   `useNavigate` hay `useParams`, nên bất kỳ màn nào cũng mở được nó bằng một
 *   dòng, kể cả trong test hay story (R-73). Nó cũng là nơi tiêm cổng dữ liệu
 *   thật vào hook.
 * - {@link PipelineGraphRoute} là nơi duy nhất biết tới router. `router.tsx` nạp
 *   đúng tên này qua `lazy(...)`.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản đang được `src/App.tsx`
 * gắn (R-62), **không** phải bản chưa nối ở `src/lib/screen-state`. Phần dự
 * phòng dựng bằng `EmptyState` từ `report.description`, nên màn không bao giờ
 * trắng (A11).
 *
 * ## Vì sao `run` là props chứ không đọc từ URL
 *
 * Dòng sự kiện của T-08 cần `(projectId, uploadId)`, còn route chỉ mang `:id`.
 * KHÔNG endpoint nào liệt kê được các `uploadId` đang chạy của một dự án (đã
 * soát `src/api/endpoints.ts` toàn bộ) — cùng ràng buộc mà
 * `ProcessingScreen.container.tsx` đã ghi lại. Nơi biết `uploadId` là màn tải
 * bản vẽ, nên nó truyền sang. Mở màn này từ URL trần vẫn hợp lệ và trung thực:
 * không có lượt xử lý nào để kể thì màn ở trạng thái `empty`, không phải một sơ
 * đồ bịa.
 */

import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import type { ProjectRole } from '@/types/project';

import { PipelineGraph } from './PipelineGraph';
import { createAppPipelineGraphGateway } from './pipelineGraphGateway';
import type { PipelineGraphGateway } from './pipelineGraphGateway';
import { usePipelineGraph } from './usePipelineGraph';
import type { PipelineGraphRun } from './usePipelineGraph';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'pipeline-graph';

const MISSING_PROJECT_TITLE = 'Không xác định được dự án';
const MISSING_PROJECT_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải mở sơ đồ xử lý của dự án nào.';

export interface PipelineGraphContainerProps {
  readonly projectId: string;
  /** Lượt xử lý để theo dõi. Vắng mặt là câu trả lời hợp lệ — xem ghi chú đầu file. */
  readonly run?: PipelineGraphRun;
  readonly roles?: readonly ProjectRole[];
  /**
   * Cổng dữ liệu. Có mặc định thật, dựng ngay tại container; test và story cắm
   * `createMockPipelineGraphGateway()` vào đúng chỗ bản sản phẩm dùng (R-70).
   */
  readonly gateway?: PipelineGraphGateway;
  /** Ép sơ đồ xếp dọc — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** Cùng khuôn `ScaleCalibrationCrashFallback` — R-62. */
function PipelineGraphCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredPipelineGraph(props: PipelineGraphContainerProps) {
  const appGateway = useMemo(() => createAppPipelineGraphGateway(), []);

  const screenProps = usePipelineGraph({
    projectId: props.projectId,
    gateway: props.gateway ?? appGateway,
    ...(props.run !== undefined ? { run: props.run } : {}),
    ...(props.roles !== undefined ? { roles: props.roles } : {}),
    ...(props.forceCollapsed !== undefined ? { forceCollapsed: props.forceCollapsed } : {}),
  });

  return <PipelineGraph actions={screenProps.actions} model={screenProps.model} />;
}

/** `<PipelineGraphContainer projectId={...} />` — màn Sơ đồ xử lý thật, đã nối. */
export function PipelineGraphContainer(props: PipelineGraphContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <PipelineGraphCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredPipelineGraph {...props} />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn Sơ đồ xử lý, đăng ký tại `src/routes/router.tsx`. */
export function PipelineGraphRoute() {
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

  return <PipelineGraphContainer projectId={id} roles={session.roles} />;
}
