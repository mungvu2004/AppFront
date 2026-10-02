/**
 * S-33 đã nối: cổng thật, phiên đăng nhập, quyền, ranh giới lỗi.
 *
 * Lớp mỏng nhất có thể trên {@link VersionHistory}, cùng khuôn
 * `ExportPanel.container.tsx` và `ShareDialog.container.tsx`: dựng cổng mà hook được tiêm
 * vào, bọc màn trong một {@link ScreenErrorBoundary} để một lần sập không kéo cả trang theo
 * (A11 / R-62), rồi truyền `model`/`actions` xuống view thuần.
 *
 * ## R-73: mở được bằng đúng một thẻ
 *
 * `<VersionHistoryContainer projectId floorId />` là đủ. Cổng dữ liệu, phiên đăng nhập,
 * quyền phục hồi, ngưỡng thu gọn — file này tự lo, nên một màn khác nhúng nó không phải viết
 * một dòng logic lịch sử phiên bản nào. Ba prop còn lại (`gateway`, `onToast`,
 * `onExportVersion`) là đường tiêm cho test, story, và cho một vỏ ứng dụng muốn nói ra đường
 * xuất thật của nó.
 *
 * ## Vì sao `onExportVersion` quyết định `canExportVersion`
 *
 * Xuất một phiên bản là ĐIỀU HƯỚNG sang S-34, không phải một thao tác dữ liệu của màn này
 * (hợp đồng, `VersionHistoryModel.canExportVersion`). Nên khả năng ấy đúng bằng "nơi gọi có
 * cấp callback không", và cổng thật được dựng với `canExportVersion` bằng đúng điều đó.
 *
 * ## Vì sao quyền phục hồi đọc từ `layer.edit`
 *
 * `lib/auth/permissions.ts` không có khoá nào tên `version.restore` — bảng quyền chỉ có tám
 * khoá và không khoá nào nói về phiên bản. Phục hồi ghi đè lớp của một tầng, nên khoá gần
 * nhất và đúng nghĩa nhất là `layer.edit`; đây là dùng lại bảng quyền đang có, không phải
 * dựng thêm một tầng quyền mới (R-69). Cùng khuôn `useExportPanel.ts:277-278`, kể cả lượt
 * lùi từ vai theo dự án sang vai của phiên đăng nhập.
 *
 * ## Vì sao `onToast` là prop, không phải `useToast()`
 *
 * Cùng lý do `ShareDialog.container.tsx` ghi lại: `Toast.Provider` được gắn ở màn chứa, không
 * ở đây. Gọi `useToast()` từ file này sẽ ném ngay khi màn được gắn ở một chỗ không có
 * provider nào bên trên.
 */

import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { createAppApiClient } from '@/api/appClient';

import { EmptyState } from '@/components/feedback/EmptyState';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Skeleton } from '@/components/feedback/Skeleton';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';
import { can } from '@/lib/auth/permissions';
import { queryKeys } from '@/lib/query/queryKeys';
import { useStore } from '@/store';
import type { ProjectRole } from '@/types/project';

import { VersionHistory } from './VersionHistory';
import { createApiVersionLoader, createVersionHistoryGateway } from './versionHistoryGateway';
import type { VersionHistoryContainerProps, VersionHistoryGateway } from './types';
import { useVersionHistory } from './useVersionHistory';

/** Đặt tên màn cho ranh giới lỗi, và cho bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'version-history';

/** Trạng thái 7 của hợp đồng: dưới 1024 thì danh sách thành `Select`, so sánh xếp dọc. */
const NARROW_QUERY = '(max-width: 1023px)';

/** Không đọc được ai đang đăng nhập thì phiên bản mới không mang tên ai — chuỗi rỗng, không id giả. */
const NO_CREATOR_ID = '';

const MISSING_PARAMS_TITLE = 'Không xác định được bản vẽ';
const MISSING_PARAMS_MESSAGE =
  'Đường dẫn thiếu mã dự án, nên không biết phải hiện lịch sử phiên bản của dự án nào.';

const FLOORS_FAILED_MESSAGE =
  'Chưa đọc được danh sách tầng của dự án, nên chưa biết phải hiện lịch sử phiên bản của tầng nào. Tải lại trang sau ít phút.';

const NO_FLOOR_TITLE = 'Dự án chưa có tầng nào';
const NO_FLOOR_MESSAGE =
  'Lịch sử phiên bản đi theo từng tầng. Thêm tầng và xử lý bản vẽ của nó, rồi quay lại đây.';

/**
 * Ngưỡng thu gọn, theo dõi tại chỗ.
 *
 * `useAppShell.ts:5` có một `useBreakpoint` làm đúng việc này nhưng nó là hàm riêng tư của
 * file đó, và R-68 cấm lượt này sửa `src/hooks`. Nên đây là bản chép ngắn của cùng khuôn
 * (`Drawer.tsx:14-17`), sống trong thư mục màn và không rò ra ngoài.
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
function VersionHistoryCrashFallback({ report, retry }: ScreenErrorFallback) {
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

/** Màn thật, bên trong ranh giới lỗi. */
function WiredVersionHistory(props: VersionHistoryContainerProps) {
  const { floorId, gateway: injectedGateway, onExportVersion, onToast, projectId } = props;

  const session = useSession();
  const storeRoles = useStore((state) => state.userRoles);
  const isNarrow = useIsNarrow();

  // Vai theo dự án đang mở là nguồn đúng nhất; phiên đăng nhập là nguồn dự phòng cho tới khi
  // một dự án được mở — khuôn `useExportPanel.ts:277`.
  const roles: readonly ProjectRole[] = storeRoles.length > 0 ? storeRoles : session.roles;
  const canRestore = can('edit', 'layer', { roles });
  const creatorId = session.user?.id ?? NO_CREATOR_ID;
  const canExportVersion = onExportVersion !== undefined;

  const gateway: VersionHistoryGateway = useMemo(
    () =>
      injectedGateway ??
      createVersionHistoryGateway({
        canExportVersion,
        creatorId,
        floorId,
        loadVersions: createApiVersionLoader(createAppApiClient(), projectId),
      }),
    [injectedGateway, canExportVersion, creatorId, floorId, projectId],
  );

  const [model, actions] = useVersionHistory({
    gateway,
    projectId,
    floorId,
    canRestore,
    isNarrow,
    ...(onToast !== undefined ? { onToast } : {}),
    ...(onExportVersion !== undefined ? { onExportVersion } : {}),
  });

  return <VersionHistory model={model} actions={actions} />;
}

/**
 * `<VersionHistoryContainer projectId floorId />` — màn lịch sử phiên bản đã nối.
 *
 * `key` trên ranh giới là cặp dự án + tầng: đổi bản vẽ thì ranh giới gắn lại, nên một lỗi của
 * bản vẽ trước không đứng lại trên bản vẽ sau (khuôn `src/App.tsx:96`).
 */
export function VersionHistoryContainer(props: VersionHistoryContainerProps) {
  return (
    <ScreenErrorBoundary
      key={`${props.projectId}:${props.floorId}`}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <VersionHistoryCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredVersionHistory {...props} />
    </ScreenErrorBoundary>
  );
}

/**
 * Tầng đầu tiên (theo `order`) của dự án — dùng khi đường dẫn không nói tầng nào.
 *
 * Khoá con riêng dưới `floor.list`: khoá cha mang hình dạng của màn quản lý tầng, và một
 * khoá hai người ghi hai hình dạng là đúng lỗi B-G-01. Nằm dưới khoá cha nên một lượt vô
 * hiệu hoá danh sách tầng vẫn kéo theo nó.
 */
function useFirstFloorId(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.floor.list(projectId), 'firstFloorId'],
    enabled,
    queryFn: async ({ signal }): Promise<string | null> => {
      const result = await createAppApiClient().floors.list({ projectId, signal });

      if (!result.ok) {
        throw new Error(FLOORS_FAILED_MESSAGE);
      }

      const [first] = [...result.data].sort((a, b) => a.order - b.order);

      return first?.id ?? null;
    },
  });
}

/**
 * Route thật của màn lịch sử phiên bản, đăng ký tại `src/routes/router.tsx`.
 *
 * Mã dự án đọc từ URL. Tầng: `?floorId=` nếu đường dẫn mang nó, không thì tầng đang mở
 * trong kho, không nữa thì tầng đầu tiên của dự án — trước đây chỉ có nguồn thứ hai, mà
 * không màn nào đặt nó, nên màn không bao giờ mở được (B-V12-10).
 */
export function VersionHistoryRoute() {
  const { projectId: id } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const activeFloorId = useStore((state) => state.activeFloorId);
  const projectId = id ?? '';
  const requestedFloorId = searchParams.get('floorId') ?? activeFloorId;
  const firstFloor = useFirstFloorId(projectId, projectId.length > 0 && requestedFloorId === null);

  if (projectId.length === 0) {
    return (
      <div className="p-6">
        <InlineAlert level="violation" title={MISSING_PARAMS_TITLE} message={MISSING_PARAMS_MESSAGE} />
      </div>
    );
  }

  if (requestedFloorId !== null) {
    return <VersionHistoryContainer projectId={projectId} floorId={requestedFloorId} />;
  }

  if (firstFloor.isPending) {
    return (
      <div className="p-6">
        <Skeleton preset="property-panel" />
      </div>
    );
  }

  if (firstFloor.isError) {
    return (
      <div className="p-6">
        <InlineAlert level="violation" title={MISSING_PARAMS_TITLE} message={FLOORS_FAILED_MESSAGE} />
      </div>
    );
  }

  if (firstFloor.data === null) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<History aria-hidden="true" />}
          title={NO_FLOOR_TITLE}
          description={NO_FLOOR_MESSAGE}
        />
      </div>
    );
  }

  return <VersionHistoryContainer projectId={projectId} floorId={firstFloor.data} />;
}
