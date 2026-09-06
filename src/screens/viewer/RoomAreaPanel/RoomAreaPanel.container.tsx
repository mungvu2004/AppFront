/**
 * S-33 ĐÃ NỐI DÂY — hook cộng hai view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ MỘT MÀN KHÁC gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <RoomAreaPanelContainer
 *   onCheckWallGaps={() => openWallGapReview()}
 *   onOpenExport={() => openExportScreen()}
 *   scene={sceneHandle}
 *   projectId={projectId}
 * />
 * ```
 *
 * Không một trường nào của {@link RoomAreaPanelContainerProps} bị bỏ trống vì
 * "chưa có nơi gọi": `Viewer3D` là màn đã xong và nằm trong danh sách cấm sửa,
 * nên hôm nay chưa ai dựng thẻ này — đó là nợ đã ghi nhận, không phải lý do để
 * hoãn một sợi dây. Mọi trường đều nối thẳng xuống `useRoomAreaPanel` hoặc
 * xuống view ngay tại đây, ngay bây giờ.
 *
 * ## Vai không phải một prop — container tự đọc
 *
 * Cùng khuôn `WallGeometryEditor.container.tsx` và `PropertyInspector`: màn gọi
 * bảng này không cần biết chuyện phân quyền. Container đọc `useSession()` rồi
 * đưa `roles` xuống hook, và hook hỏi `can('edit', 'layer', …)`. `status` được
 * đọc chứ không bỏ qua: `'unknown'` là "CHƯA BIẾT vai", khác hẳn "biết là không
 * có quyền", và A11 phân biệt hai thứ đó — nên lúc phiên chưa tới, `roles`
 * KHÔNG được truyền, và bảng ở `loading` chứ không nhảy sang `forbidden`.
 *
 * ## Hover: props thật, phía 3D CHƯA NỐI
 *
 * `ViewerSceneHandle` (`viewer3dTypes.ts:276`) có đúng sáu phương thức —
 * `update`, `status`, `frameRate`, `frameEntities`, `preview`, `dispose`.
 * Không phương thức nào nâng nền một phòng từ 5% lên 10% khi trỏ vào, và không
 * sự kiện nào đi TỪ mô hình 3D về đây. Đã kiểm chứng; `Viewer3D` là màn đã
 * xong, không được sửa (PQ-8). Vậy nên:
 *
 * - `onRoomHover` phơi ra NGOÀI mọi lượt trỏ của bảng, để nơi nào nối được thì
 *   nghe được — không bản tạm, không ghi chú hoãn lại (R-69).
 * - `hoveredRoomId` nhận hover đi vào từ bên ngoài và ĐÈ lên trạng thái trong
 *   hook, để khi phía 3D nói được thì hàng vẫn sáng đúng mà không phải sửa một
 *   dòng nào của màn này.
 *
 * Trong nội bộ bảng hai props ấy chạy thật ngay hôm nay: trỏ vào một hàng thì
 * hàng đó sáng lên. Thứ chưa nối là phía 3D, và nó chưa nối vì phía 3D chưa có
 * API — không phải vì màn này để trống chỗ.
 *
 * ## Bấm một dòng thì CÓ chạy tới 3D
 *
 * `scene.frameEntities([roomId])` là API có thật, và hook gọi nó. Container chỉ
 * chuyển tiếp tay cầm; vắng tay cầm thì bấm một dòng vẫn CHỌN phòng, chỉ camera
 * đứng yên.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải `lib/screen-state`. Phần
 * dự phòng dựng bằng `EmptyState` từ `report.description`, nên bảng không bao
 * giờ ra ô trắng (A11).
 */

import { useCallback, useMemo } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import type { RoomId } from '@/domain/spatial/types';
import { useSession } from '@/hooks/useSession';

import { RoomAreaPanel } from './RoomAreaPanel';
import { RoomAreaTable } from './RoomAreaTable';
import type { RoomAreaScreenState } from './roomAreaTypes';
import { useRoomAreaPanel, type UseRoomAreaPanelOptions } from './useRoomAreaPanel';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const ROOM_AREA_PANEL_SCREEN_ID = 'room-area-panel';

/**
 * Props thật của container — mọi thứ một màn khác cần để mở bảng này.
 *
 * Hai trường đầu BẮT BUỘC: chúng là hai hành động rời màn, và R-73 nói mỗi
 * hành động phải có một đích thật chứ không phải một mặc định im lặng.
 */
export interface RoomAreaPanelContainerProps {
  /** Sang S-34. Màn này **không** tự sinh tệp. */
  readonly onOpenExport: () => void;
  /** Trạng thái rỗng: sang chỗ soát khe hở tường. Khác `onRetry` (đo lại). */
  readonly onCheckWallGaps: () => void;
  /** Tay cầm cảnh 3D. Vắng mặt thì bấm một dòng vẫn chọn, chỉ camera đứng yên. */
  readonly scene?: UseRoomAreaPanelOptions['scene'];
  /** Hover đi VÀO từ ngoài (mô hình 3D). Đè lên hover nội bộ của hook khi có. */
  readonly hoveredRoomId?: RoomId | null;
  /** Hover đi RA ngoài — mọi lượt trỏ của bảng đều báo qua đây. */
  readonly onRoomHover?: (roomId: RoomId | null) => void;
  /** Vỏ đang thu gọn tấm trượt hay không. Nút thu gọn thuộc vỏ, không thuộc bảng. */
  readonly isCollapsed?: boolean;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: RoomAreaScreenState;
  /** Dự án đang mở; đi vào khoá làm mất hiệu lực cache sau một lượt đổi tên. */
  readonly projectId?: string;
  /**
   * Bộ nhớ đệm truy vấn của vỏ, để dọn `space.byFloor` · `room.byFloor` ·
   * `violation.byProject` sau một lượt đổi tên.
   *
   * Là một PROPS chứ không phải `useQueryClient()`: màn này không đọc gì qua
   * mạng (PQ-3), nên bắt nó ném lỗi khi thiếu `QueryClientProvider` sẽ là đòi
   * hỏi một thứ nó không dùng. Vỏ nào đang giữ cache thì đưa xuống.
   */
  readonly queryClient?: UseRoomAreaPanelOptions['queryClient'];
  /** Ai đang thao tác — đi vào `Command.actorId` và nhật ký hoạt động. */
  readonly actorId?: string;
}

/** Cùng khuôn `WallGeometryEditorCrashFallback` — R-62, chữ từ `report.description`. */
function RoomAreaPanelCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-surface">
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
function WiredRoomAreaPanel(props: RoomAreaPanelContainerProps) {
  const session = useSession();

  /*
   * `'unknown'` là chưa biết vai, không phải không có quyền: bỏ hẳn trường
   * `roles` để hook đọc ra `undefined` và ở `loading`. Truyền một mảng rỗng
   * thay vào đó sẽ là nói "vai này không sửa được" trong khi chưa ai hỏi xong.
   */
  const roleOption = useMemo(
    () => (session.status === 'unknown' ? {} : { roles: session.roles }),
    [session.roles, session.status],
  );

  const model = useRoomAreaPanel({
    ...roleOption,
    onCheckWallGaps: props.onCheckWallGaps,
    isCollapsed: props.isCollapsed ?? false,
    ...(props.scene === undefined ? {} : { scene: props.scene }),
    ...(props.forceState === undefined ? {} : { forceState: props.forceState }),
    ...(props.projectId === undefined ? {} : { projectId: props.projectId }),
    ...(props.queryClient === undefined ? {} : { queryClient: props.queryClient }),
    ...(props.actorId === undefined ? {} : { actorId: props.actorId }),
  });

  const outerHover = props.onRoomHover;
  const modelHover = model.onRoomHover;

  const onRoomHover = useCallback(
    (roomId: RoomId | null) => {
      modelHover(roomId);
      outerHover?.(roomId);
    },
    [modelHover, outerHover],
  );

  /* Hover từ ngoài thắng: nó là thứ đang xảy ra trên mô hình 3D. */
  const hoveredRoomId = props.hoveredRoomId ?? model.hoveredRoomId;

  const shared = { ...model, hoveredRoomId, onRoomHover, onOpenExport: props.onOpenExport };

  return model.mode === 'table' ? <RoomAreaTable {...shared} /> : <RoomAreaPanel {...shared} />;
}

/** `<RoomAreaPanelContainer>` — bảng diện tích đã nối dây, gắn được bằng một thẻ. */
export function RoomAreaPanelContainer(props: RoomAreaPanelContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={(fallback) => <RoomAreaPanelCrashFallback {...fallback} />}
      screenId={ROOM_AREA_PANEL_SCREEN_ID}
    >
      <WiredRoomAreaPanel {...props} />
    </ScreenErrorBoundary>
  );
}
