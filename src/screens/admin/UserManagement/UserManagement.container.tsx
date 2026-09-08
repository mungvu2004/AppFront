/**
 * T9 — lớp ráp của màn quản lý người dùng (`/admin/users`): cổng thật, phiên đăng nhập,
 * ngưỡng thu gọn, ranh giới lỗi.
 *
 * Lớp mỏng nhất có thể trên {@link UserManagement}, cùng khuôn
 * `ModelLibrary.container.tsx`: dựng cổng mà hook được tiêm vào, bọc màn trong một
 * {@link ScreenErrorBoundary} để một lần sập không kéo cả trang theo (A11 / R-62), rồi
 * truyền `model`/`actions` xuống view thuần.
 *
 * ## Vì sao ranh giới lỗi lấy bản ở `@/components/feedback`
 *
 * `src/lib/screen-state/screenErrorBoundary.ts` có một bản thứ hai nhưng CHƯA nơi nào gắn
 * nó; bản đang chạy thật — thứ `src/App.tsx` và mọi container đã xong đều dùng — là bản
 * dưới đây (R-62). Màn mới chép khuôn đang chạy, không dựng đường thứ hai.
 *
 * ## R-73: mở được bằng đúng một thẻ, và HAI đường ra ngoài đều nối thật
 *
 * `<UserManagementContainer />` là đủ — không prop nào bắt buộc. Nhưng "không bắt buộc"
 * không được phép nghĩa là "không ai truyền": ca `ProjectDashboard.onCreateProject` đã trả
 * giá cho đúng chỗ này — một callback tuỳ chọn mà không màn nào cung cấp làm hai màn đều
 * "xong" nhưng ghép lại không bấm được. Nên hai đường ra ngoài của màn này đều có mặc định
 * CHẠY THẬT, và đều có một nơi gọi thật trong repo:
 *
 * | Prop | Mặc định khi không ai truyền | Nơi truyền thật |
 * |---|---|---|
 * | `onNavigateBack` | thẻ `<a>` tự điều hướng như thường | {@link UserManagementRoute} bắc `useNavigate` vào |
 * | `onToast` | bus thông báo của phiên (`appNotificationBus`) vẫn phát, `NotificationHost` vẫn vẽ | {@link WiredUserManagement} nối thẳng vào bus mà cổng phát toast |
 *
 * `onToast` KHÔNG được {@link UserManagementRoute} truyền một hàm rỗng cho đủ lệ — đúng khuôn
 * `FloorManager.container.tsx` với `notifications?`: mặc định đã là đường chạy thật, nên một
 * hàm rỗng ở route chỉ làm người đọc tưởng có thêm một đường đi. Prop này đi THẬT vào
 * {@link forwardingBus} rồi vào cổng — nơi gọi nào truyền nó vào là nghe được từng toast, không
 * phải viết thêm một dòng logic nào.
 *
 * ## Vì sao `onNavigateBack` phải là một lượt CHẶN CLICK
 *
 * Hợp đồng (`types.ts`, `BreadcrumbItemModel`) nói đường dẫn đi vào model dưới dạng `href`
 * dựng từ `@/routes/paths`, và view vẽ chúng bằng thẻ `<a href>` thường. Trong một ứng dụng
 * router, một thẻ `<a>` để nguyên sẽ nạp lại cả trang — nên chỗ ráp phải chặn lượt bấm và
 * đẩy đường dẫn qua router. `UserManagementProps` chỉ có `model` + `actions` và nó là hợp
 * đồng đông cứng, nên không có đường truyền một callback xuống view; lượt chặn ở đây là
 * đường duy nhất không phải sửa `types.ts`.
 *
 * Chỉ chặn lượt bấm trái không kèm phím bổ trợ: `Ctrl`/`Cmd`/`Shift`-click và chuột giữa là
 * "mở ở tab khác", A12 không cho lấy mất chúng.
 *
 * ## Vì sao `onToast` đi vào BUS chứ không phải một `Toast.Provider`
 *
 * Cùng lý do `FloorManager.container.tsx` và `VersionHistory.container.tsx` ghi lại: toast
 * hoàn tác của A8 đi qua `notificationBus`, và `NotificationHost` (gắn ở `src/main.tsx`) là
 * thứ vẽ chúng. Hook không biết gì về toast — nó gọi `gateway.notify`. Nên muốn một nơi gọi
 * nghe được kết quả, chỗ ráp bọc bus lại: phát cho bus thật TRƯỚC, rồi mới gọi `onToast`,
 * để một nơi gọi ném lỗi cũng không nuốt mất toast của người dùng.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { appNotificationBus } from '@/hooks/useNotifications';
import type { NotificationBus, NotificationInput } from '@/lib/mutations/notificationBus';

import { UserManagement } from './UserManagement';
import { createAppUserManagementGateway } from './userManagementGateway';
import type { UserManagementGateway } from './userManagementGateway';
import { COLLAPSE_BREAKPOINT_PX, useUserManagement } from './useUserManagement';

/** Đặt tên màn cho ranh giới lỗi, và cho bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'user-management';

/**
 * Trạng thái 7 của hợp đồng: dưới {@link COLLAPSE_BREAKPOINT_PX} thì bảng thành thẻ, panel
 * thành lớp phủ. Con số đến từ hook — R-71 cấm gõ lại một ngưỡng đã có tên.
 */
const NARROW_QUERY = `(max-width: ${String(COLLAPSE_BREAKPOINT_PX - 1)}px)`;

export interface UserManagementContainerProps {
  /** Cổng tiêm cho test và story. Không truyền thì container dựng cổng thật. */
  readonly gateway?: UserManagementGateway;
  /** Ép bố cục hẹp bất kể bề ngang thật — story chụp trạng thái 7 bằng cờ này. */
  readonly forceCompact?: boolean;
  /** Đồng hồ tiêm được, để ảnh chụp không đổi theo giờ máy chạy. */
  readonly now?: () => number;
  /**
   * Người dùng bấm breadcrumb hoặc liên kết quay lại. Nhận `href` đã dựng sẵn từ
   * `@/routes/paths` (R-65: chỗ này không gõ chuỗi đường dẫn nào).
   */
  readonly onNavigateBack?: (href: string) => void;
  /** Mỗi toast màn này phát, sau khi bus của phiên đã nhận nó. */
  readonly onToast?: (notification: NotificationInput) => void;
}

/**
 * Ngưỡng thu gọn, theo dõi tại chỗ.
 *
 * Bản chép ngắn của cùng khuôn `ModelLibrary.container.tsx` và `Drawer.tsx:14-17`:
 * `useAppShell.ts:5` có một `useBreakpoint` làm đúng việc này nhưng nó là hàm riêng tư của
 * file đó, và R-68 cấm lượt này sửa `src/hooks`.
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

/**
 * Bus của phiên, cộng một người nghe.
 *
 * `list` và `subscribe` đi thẳng sang bus thật — `NotificationHost` phải thấy đúng một
 * nguồn — chỉ `publish` là rẽ đôi.
 */
function forwardingBus(
  bus: NotificationBus,
  onToast: (notification: NotificationInput) => void,
): NotificationBus {
  return {
    list: bus.list,
    subscribe: bus.subscribe,
    publish: (input: NotificationInput): void => {
      bus.publish(input);
      onToast(input);
    },
  };
}

/**
 * Thứ người dùng thấy thay cho màn đã sập.
 *
 * Chữ lấy thẳng từ `report.description`, nút "thử lại" chỉ hiện khi lỗi thuộc loại đáng thử
 * lại — cùng khuôn `ScreenCrashFallback` trong `src/App.tsx`. Ranh giới không vẽ gì, mọi màu
 * ở đây đều là token (A1).
 */
function UserManagementCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/** Hook cộng view, không provider nào ở giữa. */
function WiredUserManagement(props: UserManagementContainerProps) {
  const { forceCompact = false, gateway: injectedGateway, now, onNavigateBack, onToast } = props;

  const mediaIsNarrow = useIsNarrow();

  // Nơi gọi có thể thay `onToast` mỗi lượt render; cổng thì không được dựng lại vì thế —
  // dựng lại cổng là dựng lại mọi khoá truy vấn của màn.
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;

  const gateway: UserManagementGateway = useMemo(() => {
    if (injectedGateway !== undefined) {
      return injectedGateway;
    }

    const bus = forwardingBus(appNotificationBus, (notification) => {
      onToastRef.current?.(notification);
    });

    return createAppUserManagementGateway(createAppApiClient().users, bus);
  }, [injectedGateway]);

  const { actions, model } = useUserManagement({
    gateway,
    isNarrow: forceCompact || mediaIsNarrow,
    ...(now !== undefined ? { now } : {}),
  });

  const backHrefs = useMemo(() => {
    const hrefs = model.breadcrumbItems
      .map((item) => item.href)
      .filter((href): href is string => href !== null);

    return model.backLink.href === null ? hrefs : [...hrefs, model.backLink.href];
  }, [model.backLink.href, model.breadcrumbItems]);

  /**
   * Chặn lượt bấm vào một liên kết ra ngoài màn và đẩy nó qua `onNavigateBack`.
   *
   * Không có `onNavigateBack` thì không chặn gì cả — thẻ `<a>` giữ nguyên hành vi mặc định,
   * nên màn vẫn dùng được khi ai đó dựng nó ngoài một router.
   */
  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      if (onNavigateBack === undefined || event.defaultPrevented || event.button !== 0) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as Element | null)?.closest?.('a[href]') ?? null;

      if (anchor === null) {
        return;
      }

      const href = anchor.getAttribute('href');

      if (href === null || !backHrefs.includes(href)) {
        return;
      }

      event.preventDefault();
      onNavigateBack(href);
    },
    [backHrefs, onNavigateBack],
  );

  return (
    <div onClickCapture={onClickCapture}>
      <UserManagement actions={actions} model={model} />
    </div>
  );
}

/**
 * `<UserManagementContainer />` — màn quản lý người dùng đã nối.
 *
 * Không có `key` phụ thuộc tham số nào vì `/admin/users` không có tham số nào: màn này quản
 * lý người dùng của cả hệ thống, không phải của một dự án cụ thể.
 */
export function UserManagementContainer(props: UserManagementContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <UserManagementCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredUserManagement {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Route thật của màn quản lý người dùng, đăng ký tại `src/routes/router.tsx`.
 *
 * Đây là nơi gọi thật của hai prop R-73: `useNavigate` chỉ tìm được provider bên TRONG
 * router, nên nó ở đây chứ không ở `UserManagementContainer` — cùng cách
 * `CadBranchConfirm.container.tsx` tách `CadBranchConfirmRouteBody` ra khỏi container để
 * container còn dựng được trong story và bài kiểm không có router.
 */
export function UserManagementRoute() {
  const navigate = useNavigate();

  const handleNavigateBack = useCallback(
    (href: string): void => {
      void navigate(href);
    },
    [navigate],
  );

  return <UserManagementContainer onNavigateBack={handleNavigateBack} />;
}
