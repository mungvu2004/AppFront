/**
 * Route `ROUTE_PATTERNS.projectRuleSettings` — nối hook với view, và với ranh
 * giới lỗi.
 *
 * Chép nguyên khuôn `RuleReport.container.tsx`, kể cả lý do gộp hai việc (đọc
 * `:id` và nối hook) vào một component: R-73 đòi `projectId` là **tuỳ chọn**,
 * để một màn khác mở được màn này với mã dự án nó đã biết mà không phải dựng
 * một route giả. Nên container đọc `useParams()` làm phương án dự phòng chứ
 * không đòi hỏi nơi gọi.
 *
 * Ranh giới lỗi là bản ở `@/components/feedback` — bản `src/App.tsx` đang gắn
 * (R-62), **không** phải bản ở `lib/screen-state`. Phần dự phòng dựng bằng
 * `EmptyState` từ `report.description`, cùng khuôn `RuleReport` và
 * `ExplodedView`.
 *
 * `onToast` vẫn là prop để màn nhúng tự quyết toast hiện ở đâu. Route thì đẩy vào
 * `appNotificationBus` — `NotificationHost` (`src/main.tsx`) vẽ nó với nút "Hoàn tác"
 * gọi đúng vé của lượt sửa, và nó còn sống khi người dùng rời màn trong cửa sổ hoàn
 * tác. Cùng khuôn `FloorManager.container.tsx`, `UserManagement.container.tsx`; không
 * bọc `Toast.Provider` (nó tháo cùng màn). Trước đây route không truyền gì nên không
 * có toast nào (A8, B-V12-04).
 */

import { useParams } from 'react-router-dom';

import { EmptyState } from '@/components/feedback/EmptyState';
import { ProjectSpatialGate } from '@/components/feedback/ProjectSpatialGate';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { appNotificationBus } from '@/hooks/useNotifications';
import type { Announcer } from '@/lib/input/announcer';

import { RuleSettings } from './RuleSettings';
import { useRuleSettings, type RuleSettingsToast } from './useRuleSettings';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'rule-settings';

const MISSING_PARAMS_TITLE = 'Thiếu mã dự án';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên chưa mở được cài đặt bộ luật. Quay lại danh sách dự án rồi chọn lại dự án cần chỉnh.';

/** Props thật của container — mọi thứ một màn khác cần để mở màn này (R-73). */
export interface RuleSettingsContainerProps {
  /** Mã dự án. Khi có, dùng nó thay vì đọc URL — để màn khác nhúng được container. */
  readonly projectId?: string;
  /** Quyền của người đang xem. Chuyển thẳng xuống hook, quyết định trạng thái 6. */
  readonly canEdit?: boolean;
  /** Vỏ ngoài báo màn đang ở chế độ thu gọn. Chuyển thẳng xuống hook, quyết định trạng thái 7. */
  readonly isCompact?: boolean;
  /** Nơi nhận toast hoàn tác 8 giây (A8). Vắng mặt thì vé vẫn có, chỉ không ai mời bấm. */
  readonly onToast?: (toast: RuleSettingsToast) => void;
  /** Đồng hồ tiêm được, để bài kiểm lái cửa sổ hoàn tác và chỉ báo tự lưu. */
  readonly now?: () => number;
  /** Trạng thái mạng tiêm được, để bài kiểm dựng lượt lưu hỏng. */
  readonly isOnline?: () => boolean;
  /** Người xướng cho trình đọc màn hình — A7 nói ra trạng thái tự lưu. */
  readonly announcer?: Announcer;
}

/** Cùng khuôn `RuleReportCrashFallback` — R-62, chữ lấy từ `report.description`. */
function RuleSettingsCrashFallback({ report, retry }: ScreenErrorFallback) {
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

interface WiredRuleSettingsProps extends Omit<RuleSettingsContainerProps, 'projectId'> {
  readonly projectId: string;
}

/**
 * Hook cộng view, không có provider nào ở giữa.
 *
 * `exactOptionalPropertyTypes` bật, nên một prop tuỳ chọn vắng mặt phải VẮNG
 * MẶT chứ không mang giá trị `undefined` — cùng khuôn trải có điều kiện của
 * `RuleReport.container.tsx`.
 */
function WiredRuleSettings(props: WiredRuleSettingsProps) {
  const viewProps = useRuleSettings({
    projectId: props.projectId,
    ...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {}),
    ...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {}),
    ...(props.onToast !== undefined ? { onToast: props.onToast } : {}),
    ...(props.now !== undefined ? { now: props.now } : {}),
    ...(props.isOnline !== undefined ? { isOnline: props.isOnline } : {}),
    ...(props.announcer !== undefined ? { announcer: props.announcer } : {}),
  });

  return <RuleSettings {...viewProps} />;
}

/**
 * `<RuleSettingsContainer />` khi gắn qua router (đọc `:id` từ URL), hoặc
 * `<RuleSettingsContainer projectId={...} />` khi một màn khác nhúng nó.
 */
export function RuleSettingsContainer(props: RuleSettingsContainerProps) {
  const params = useParams<{ projectId: string }>();
  const projectId = props.projectId ?? params.projectId;

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
        <RuleSettingsCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredRuleSettings
        projectId={projectId}
        {...(props.canEdit !== undefined ? { canEdit: props.canEdit } : {})}
        {...(props.isCompact !== undefined ? { isCompact: props.isCompact } : {})}
        {...(props.onToast !== undefined ? { onToast: props.onToast } : {})}
        {...(props.now !== undefined ? { now: props.now } : {})}
        {...(props.isOnline !== undefined ? { isOnline: props.isOnline } : {})}
        {...(props.announcer !== undefined ? { announcer: props.announcer } : {})}
      />
    </ScreenErrorBoundary>
  );
}

/** Route thật của màn cài đặt bộ luật, đăng ký tại `src/routes/router.tsx`. */
export function RuleSettingsRoute() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ProjectSpatialGate projectId={projectId}>
      <RuleSettingsContainer onToast={publishRuleSettingsToast} />
    </ProjectSpatialGate>
  );
}

/** Loại thông báo của màn này trong `notificationBus` — bus gộp các lượt cùng loại. */
const RULE_SETTINGS_NOTIFICATION_TYPE = 'rule-settings';

function publishRuleSettingsToast(toast: RuleSettingsToast): void {
  appNotificationBus.publish({
    type: RULE_SETTINGS_NOTIFICATION_TYPE,
    title: toast.message,
    description: '',
    undoTicket: toast.undoTicket,
  });
}
