/**
 * Nối hook với view, và với ranh giới lỗi.
 *
 * Khác các container khác trong `src/screens`, container này **không phải một route**.
 * S-34 là một tấm trượt mở TRÊN màn báo cáo luật (S-33), không phải một trang có đường
 * dẫn riêng, nên không có `ViolationDetailRoute` và không có gì đăng ký ở `router.tsx`.
 * R-66 không áp ở đây; R-73 thì có, và đó là lý do file này tồn tại: một màn khác phải
 * mở được tấm trượt bằng đúng một thẻ,
 *
 * ```tsx
 * <ViolationDetailContainer
 *   violations={report.violations}
 *   initialIndex={openedIndex}
 *   floorId={levelId}
 *   onClose={close}
 * />
 * ```
 *
 * mà không phải viết thêm một dòng logic nào. Cha đưa xuống **cả danh sách** vi phạm
 * chứ không phải một cặp `ruleCode`/`entityId`: tấm trượt duyệt qua lại bằng `J`/`K`
 * (`onPrevious`/`onNext` của view), và tấm trượt KHÔNG được chạy lại bộ luật để tự
 * dựng lại danh sách — S-33 vừa chạy nó xong, chạy lần hai là hai sự thật khác nhau
 * trên cùng một màn hình. `projectId` là **tuỳ chọn** vì màn cha thường đã cầm sẵn nó;
 * khi vắng, container đọc `useParams()` làm phương án dự phòng, đúng khuôn
 * `RuleReport.container.tsx`.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn (R-62),
 * KHÔNG phải bản ở `src/lib/screen-state`. Phần dự phòng dựng bằng `EmptyState` từ
 * `report.description`, cùng khuôn `RuleReport.container.tsx` và
 * `ExplodedView.container.tsx`.
 *
 * `key={...}` trên ranh giới lỗi ghép từ mã luật và mã đối tượng của vi phạm được mở
 * đầu tiên: cha mở sang vi phạm khác là gắn lại ranh giới, nên một lần hỏng ở vi phạm
 * này không dính sang vi phạm sau.
 */

import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { Violation } from '@/domain/rules/registry';

import { ViolationDetail } from './ViolationDetail';
import { useViolationDetail } from './useViolationDetail';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'violation-detail';

/** Props thật của container — mọi thứ một màn khác cần để mở tấm trượt này (R-73). */
export interface ViolationDetailContainerProps {
  /** Mã dự án. Khi có, dùng nó thay vì đọc URL — để màn khác nhúng được container này. */
  readonly projectId?: string;
  /**
   * Danh sách vi phạm của màn cha, đã sắp sẵn. Chuyển thẳng xuống hook.
   *
   * Cha sở hữu danh sách này vì cha vừa chạy `runRules` qua `queryKeys.violation.byProject`.
   */
  readonly violations: readonly Violation[];
  /** Vi phạm được mở đầu tiên. `J`/`K` đi tiếp từ đây. */
  readonly initialIndex: number;
  /** Tầng đang mở ở vỏ — khoá mất-hiệu-lực của lượt chạy lại luật cần nó. */
  readonly floorId: string;
  /** Quyền của người đang xem. Chuyển thẳng xuống hook, quyết định trạng thái 6. */
  readonly canEdit?: boolean;
  /** Vỏ ngoài báo màn đang ở chế độ thu gọn. Chuyển thẳng xuống hook, quyết định trạng thái 7. */
  readonly isCompact?: boolean;
  readonly onClose: () => void;
}

/**
 * Cùng khuôn `RuleReportCrashFallback` — R-62, chữ lấy từ `report.description`.
 *
 * Một chỗ lệch khuôn có chủ ý: phần dự phòng của các màn khác trải `inset-0`, phần dự
 * phòng ở đây giữ đúng khung 420 bên phải. Lệnh cấm "tấm trượt không bao giờ che khuất
 * mô hình" không nghỉ khi tấm trượt hỏng — phủ kín màn hình lúc đó là lấy mất bản vẽ
 * đúng vào lúc người dùng cần nhìn nó nhất.
 */
function ViolationDetailCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="absolute right-0 top-0 flex h-full w-[420px] items-center justify-center border-l border-border-default bg-bg-surface">
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

interface WiredViolationDetailProps extends ViolationDetailContainerProps {
  /** Đã phân giải xong ở container, nên ở đây không còn tuỳ chọn nữa. */
  readonly projectId: string;
}

/**
 * Hook cộng view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG MẶT chứ
 * không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `RuleReport.container.tsx`.
 */
function WiredViolationDetail(props: WiredViolationDetailProps) {
  const viewProps = useViolationDetail({
    violations: props.violations,
    initialIndex: props.initialIndex,
    projectId: props.projectId,
    floorId: props.floorId,
    onClose: props.onClose,
    ...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {}),
    ...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {}),
  });

  return <ViolationDetail {...viewProps} />;
}

/**
 * `<ViolationDetailContainer violations initialIndex floorId onClose />` — tấm trượt đã nối dây.
 *
 * Không có mã dự án ở props lẫn ở URL thì tấm trượt **không dựng gì cả**. Đó là quyết
 * định có chủ ý: S-34 là một lớp phụ mở trên một màn khác, và một tấm trượt rỗng báo lỗi
 * chồng lên mô hình còn tệ hơn không mở tấm trượt nào. Màn cha vẫn đứng nguyên, người
 * dùng vẫn nhìn thấy bản vẽ.
 */
export function ViolationDetailContainer(props: ViolationDetailContainerProps) {
  const params = useParams<{ id: string }>();
  const projectId = props.projectId ?? params.id;
  const opened = props.violations[props.initialIndex];

  if (projectId === undefined || projectId.length === 0) {
    return null;
  }

  return (
    <ScreenErrorBoundary
      key={opened === undefined ? 'none' : `${opened.ruleCode}:${opened.entityId}`}
      renderFallback={({ report, retry }) => (
        <ViolationDetailCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredViolationDetail {...props} projectId={projectId} />
    </ScreenErrorBoundary>
  );
}
