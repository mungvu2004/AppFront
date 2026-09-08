/**
 * S-25 đã nối: cổng thật, phiên đăng nhập, quyền `library.manage`, ranh giới lỗi.
 *
 * Lớp mỏng nhất có thể trên {@link ModelLibrary}, cùng khuôn
 * `VersionHistory.container.tsx` và `FurnitureLibraryPanel.container.tsx`: dựng cổng mà hook
 * được tiêm vào, bọc màn trong một {@link ScreenErrorBoundary} để một lần sập không kéo cả
 * trang theo (A11 / R-62), rồi truyền `model`/`actions` xuống view thuần.
 *
 * ## R-73: mở được bằng đúng một thẻ
 *
 * `<ModelLibraryContainer />` là đủ — không prop nào bắt buộc. Client API, vai trò của phiên,
 * ngưỡng thu gọn, đường dẫn bộ giải mã Draco: file này tự lo. Ba prop của
 * `ModelLibraryContainerProps` đều là đường tiêm cho test và story.
 *
 * ## Vì sao ranh giới lỗi lấy bản ở `@/components/feedback`
 *
 * `src/lib/screen-state/screenErrorBoundary.ts` có một bản thứ hai nhưng CHƯA nơi nào gắn nó;
 * bản đang chạy thật — thứ `src/App.tsx` và cả năm container đã xong đều dùng — là bản dưới
 * đây (R-62). Màn mới chép khuôn đang chạy, không dựng đường thứ hai.
 *
 * ## Vì sao `dracoDecoderPath` được gõ ở đây chứ không ở cổng
 *
 * `modelLibraryGateway.ts:355-364` ghi rõ: hằng `'/draco/'` hiện là biến cục bộ của
 * `AuthScreen/houseScene.ts:62` và không xuất khẩu, nên cổng nhận đường dẫn ấy TỪ NƠI RÁP
 * thay vì tự gõ. Đây là nơi ráp. Không truyền thì mọi model nén Draco rớt ở bước parse —
 * một nhánh hợp lệ nhưng là một nhánh hỏng không cần thiết, vì `pnpm draco` chép bộ giải mã
 * về đúng `public/draco/`.
 *
 * ## Vì sao `onToast` là prop, không phải `useToast()`
 *
 * Cùng lý do `VersionHistory.container.tsx` ghi lại: `Toast.Provider` được gắn ở màn chứa,
 * không ở đây. Trong bản này hook không phát toast nào (chín khả năng ghi đều `false` nên
 * không có thay đổi nào để hoàn tác — `useModelLibrary.ts` mục 2), nhưng đường dẫn vẫn có
 * mặt để ngày có endpoint ghi thì nơi gọi không phải sửa chữ ký.
 */

import { useEffect, useMemo, useState } from 'react';

import { createAppApiClient } from '@/api/appClient';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { ModelLibrary } from './ModelLibrary';
import { createModelLibraryGateway } from './modelLibraryGateway';
import type { ModelLibraryContainerProps, ModelLibraryGateway } from './types';
import { useModelLibrary } from './useModelLibrary';

/** Đặt tên màn cho ranh giới lỗi, và cho bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'model-library';

/** Trạng thái 7 của hợp đồng: dưới 1024 thì bảng thành thẻ, panel thành lớp phủ. */
const NARROW_QUERY = '(max-width: 1023px)';

/**
 * Thư mục bộ giải mã Draco trong `public/`.
 *
 * `pnpm draco` chép bộ giải mã về đây; `public/draco/` bị `.gitignore` loại nên đường dẫn
 * này là hợp đồng triển khai, không phải một hằng nghiệp vụ.
 */
const DRACO_DECODER_PATH = '/draco/';

/**
 * Ngưỡng thu gọn, theo dõi tại chỗ.
 *
 * Bản chép ngắn của cùng khuôn `VersionHistory.container.tsx:74-95` và `Drawer.tsx:14-17`:
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
 * Thứ người dùng thấy thay cho màn đã sập.
 *
 * Chữ lấy thẳng từ `report.description`, nút "thử lại" chỉ hiện khi lỗi thuộc loại đáng thử
 * lại — cùng khuôn `ScreenCrashFallback` trong `src/App.tsx`. Ranh giới không vẽ gì, mọi màu
 * ở đây đều là token (A1).
 */
function ModelLibraryCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredModelLibrary(props: ModelLibraryContainerProps) {
  const { forceCompact = false, gateway: injectedGateway, onToast } = props;

  const session = useSession();
  const storeRoles = useStore((state) => state.userRoles);
  const mediaIsNarrow = useIsNarrow();

  // Vai theo dự án đang mở là nguồn đúng nhất; phiên đăng nhập là nguồn dự phòng cho tới khi
  // một dự án được mở — khuôn `VersionHistory.container.tsx:134` và `useExportPanel.ts:277`.
  const roles: readonly ProjectRole[] = storeRoles.length > 0 ? storeRoles : session.roles;

  const gateway: ModelLibraryGateway = useMemo(
    () =>
      injectedGateway ??
      createModelLibraryGateway({
        libraryApi: createAppApiClient().library,
        roles,
        dracoDecoderPath: DRACO_DECODER_PATH,
      }),
    [injectedGateway, roles],
  );

  const [model, actions] = useModelLibrary({
    gateway,
    isNarrow: forceCompact || mediaIsNarrow,
    ...(onToast !== undefined ? { onToast } : {}),
  });

  return <ModelLibrary actions={actions} model={model} />;
}

/**
 * `<ModelLibraryContainer />` — màn thư viện model đã nối.
 *
 * Không có `key` phụ thuộc tham số nào vì `/admin/models` không có tham số nào: màn này là
 * một danh mục toàn hệ thống, không phải một khung nhìn của một dự án cụ thể.
 */
export function ModelLibraryContainer(props: ModelLibraryContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={({ report, retry }) => (
        <ModelLibraryCrashFallback report={report} retry={retry} />
      )}
      screenId={SCREEN_ID}
    >
      <WiredModelLibrary {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Route thật của màn thư viện model, đăng ký tại `src/routes/router.tsx`.
 *
 * Không đọc tham số nào: `ROUTE_PATTERNS.adminModels` là `/admin/models`, một đường dẫn phẳng
 * không có lỗ `:id`. Nên route ở đây đúng bằng container, và nó tồn tại để router có một thứ
 * duy nhất để mount — cùng khuôn `VersionHistoryRoute`.
 */
export function ModelLibraryRoute() {
  return <ModelLibraryContainer />;
}
