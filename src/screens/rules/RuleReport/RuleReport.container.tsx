/**
 * Route `ROUTE_PATTERNS.projectRules` — nối hook với view, và với ranh giới lỗi.
 *
 * Khác các container 3D khác trong repo (vốn tách `*.container.tsx` yêu cầu
 * `projectId: string` khỏi một `*Route` mỏng đọc `useParams`), màn này gộp cả
 * hai việc vào đúng một component, theo `wiring.md` mục A: "Làm trong
 * container, chuyển tiếp cho view qua props (khuôn D)". Lý do là R-73 ở đây đòi
 * `projectId` là **tuỳ chọn** — một màn khác nhúng `RuleReportContainer` phải
 * tự truyền được `projectId` của nó vào mà không cần dựng một route giả, nên
 * container đọc `useParams()` làm phương án dự phòng thay vì đòi hỏi nó ở nơi
 * gọi.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn
 * (R-62). Phần dự phòng dựng bằng `EmptyState` từ `report.description`, cùng
 * khuôn `BillingScreen.container.tsx`, `ExplodedView.container.tsx`.
 */

import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

import { RuleReport } from './RuleReport';
import { useRuleReport } from './useRuleReport';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'rule-report';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên chưa mở được báo cáo kiểm tra luật. Quay lại danh sách dự án rồi chọn lại dự án cần xem.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface RuleReportContainerProps {
  /** Mã dự án. Khi có, dùng nó thay vì đọc URL — để màn khác nhúng được `RuleReportContainer`. */
  readonly projectId?: string;
  /** Quyền của người đang xem. Chuyển thẳng xuống hook, quyết định trạng thái 6. */
  readonly canEdit?: boolean;
  /** Vỏ ngoài báo màn đang ở chế độ thu gọn. Chuyển thẳng xuống hook, quyết định trạng thái 7. */
  readonly isCompact?: boolean;
}

/** Cùng khuôn `ExplodedViewCrashFallback` — R-62, chữ lấy từ `report.description`. */
function RuleReportCrashFallback({ report, retry }: ScreenErrorFallback) {
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

interface WiredRuleReportProps {
  readonly projectId: string;
  readonly canEdit?: boolean;
  readonly isCompact?: boolean;
}

/**
 * Hook cộng view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `ExplodedView.container.tsx`.
 */
function WiredRuleReport(props: WiredRuleReportProps) {
  const viewProps = useRuleReport({
    projectId: props.projectId,
    ...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {}),
    ...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {}),
  });

  return <RuleReport {...viewProps} />;
}

/**
 * `<RuleReportContainer />` khi gắn qua router (đọc `:id` từ URL), hoặc
 * `<RuleReportContainer projectId={...} />` khi một màn khác nhúng nó.
 */
export function RuleReportContainer(props: RuleReportContainerProps) {
  const params = useParams<{ id: string }>();
  const projectId = props.projectId ?? params.id;

  if (projectId === undefined || projectId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert level="violation" message={MISSING_PARAMS_MESSAGE} title={MISSING_PARAMS_TITLE} />
      </div>
    );
  }

  return (
    <ScreenErrorBoundary
      key={projectId}
      renderFallback={({ report, retry }) => <RuleReportCrashFallback report={report} retry={retry} />}
      screenId={SCREEN_ID}
    >
      <WiredRuleReport
        projectId={projectId}
        {...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {})}
        {...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {})}
      />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn báo cáo luật, đăng ký tại `src/routes/router.tsx`. */
export function RulesRoute() {
  return <RuleReportContainer />;
}
