/**
 * S-34 ĐÃ NỐI DÂY — hook cộng view, bọc trong ranh giới lỗi.
 *
 * Đây là thứ MỘT MÀN KHÁC gắn vào bằng ĐÚNG MỘT THẺ (R-73):
 *
 * ```tsx
 * <HistoryPanelContainer
 *   history={sessionHistoryStack}
 *   scene={sceneHandle}
 *   actorId={currentUserId}
 * />
 * ```
 *
 * Không một trường nào của {@link HistoryPanelContainerProps} bị bỏ trống vì
 * "chưa có nơi gọi": `Viewer3D` là màn đã xong và nằm trong danh sách cấm sửa,
 * nên hôm nay chưa ai dựng thẻ này — đó là nợ đã ghi nhận, không phải lý do để
 * hoãn một sợi dây. Mọi trường đều nối thẳng xuống `useHistoryPanel` hoặc xuống
 * view ngay tại đây, ngay bây giờ. Cùng khuôn `RoomAreaPanel.container.tsx`.
 *
 * ## `history` là một props, không phải một thứ container tự dựng
 *
 * Ngăn xếp hoàn tác của S-06 là một ĐỐI TƯỢNG của phiên làm việc, không phải
 * một kho toàn cục: `createHistoryStack()` sinh ra instance rời nhau, và bảy
 * màn QC đều nhận nó qua `options.history`. Nếu panel này tự dựng một ngăn xếp
 * thì nó sẽ hiện lịch sử RỖNG của riêng nó trong lúc màn cha đang đẩy bước vào
 * một ngăn xếp khác — đúng thứ sai lặng lẽ nhất mà một panel lịch sử có thể
 * mắc. Vắng `history` thì panel ở trạng thái rỗng một cách THÀNH THẬT, không
 * mượn lịch sử của ai.
 *
 * ## Vai không phải một prop — container tự đọc
 *
 * Cùng khuôn `RoomAreaPanel.container.tsx` và `PropertyInspector`: màn gọi panel
 * này không cần biết chuyện phân quyền. Container đọc `useSession()` rồi đưa
 * `roles` xuống hook. `status` được đọc chứ không bỏ qua: `'unknown'` là "CHƯA
 * BIẾT vai", khác hẳn "biết là không có quyền", và A11 phân biệt hai thứ đó —
 * nên lúc phiên chưa tới, `roles` KHÔNG được truyền, và panel ở `loading` chứ
 * không nhảy sang `forbidden`.
 *
 * Người đang thao tác cũng đọc từ đấy: `session.user.id` là thứ duy nhất trong
 * repo trả lời được "ai là tôi", và mọi `actorId` khác nó là người khác. Màn cha
 * ĐÈ được bằng props khi nó biết rõ hơn.
 *
 * ## `layout` chọn theo bề ngang thật, không phải theo một props bắt buộc
 *
 * Dưới 1024 là tấm trượt đáy, từ 1024 trở lên là panel 344 — đúng ngưỡng `lg`
 * mà `SHEET_CLASS` đã dùng cho phần CSS của nó. Đọc bằng `matchMedia` qua
 * `useSyncExternalStore`, nên panel đổi vỏ ngay khi người dùng kéo cửa sổ chứ
 * không đợi một lượt vẽ lại tình cờ. Nơi nào cần ép một vỏ (story, tấm trượt đã
 * mở sẵn) thì truyền `layout` và lượt đo bị bỏ qua.
 *
 * ## Ranh giới lỗi: bản ở `@/components/feedback`
 *
 * Đúng bản `src/App.tsx` đang gắn (R-62), không phải `lib/screen-state`. Phần
 * dự phòng dựng bằng `EmptyState` từ `report.description`, nên panel không bao
 * giờ ra ô trắng (A11).
 */

import { useMemo, useSyncExternalStore } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';
import { useSession } from '@/hooks/useSession';

import { HistoryPanel } from './HistoryPanel';
import type { HistoryPanelGateway, HistorySceneHandle } from './historyPanelGateway';
import type { HistoryPanelLayout, HistoryPanelState } from './historyPanelTypes';
import { useHistoryPanel, type UseHistoryPanelOptions } from './useHistoryPanel';

/** Mã màn, cho ranh giới lỗi và cho nhật ký — một chỗ viết duy nhất (R-71). */
export const HISTORY_PANEL_SCREEN_ID = 'history-panel';

/**
 * Ngưỡng đổi vỏ, viết đúng một lần.
 *
 * 1024 là điểm `lg` của Tailwind, và `SHEET_CLASS` đã treo toàn bộ phần CSS của
 * nó lên đúng điểm ấy. Hai chỗ đọc cùng một con số thì vỏ không bao giờ lệch
 * nửa nhịp so với lớp CSS đang vẽ nó.
 */
const SHEET_MEDIA_QUERY = '(max-width: 1023px)';

/** Không đọc được bề ngang thì dựng panel — vỏ mặc định của viewer trên desktop. */
const FALLBACK_LAYOUT: HistoryPanelLayout = 'panel';

/** Cùng lập luận `reducedMotion.ts`: Storybook, test Node và worker đều thiếu `matchMedia`. */
function hasMatchMedia(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.matchMedia === 'function';
}

/**
 * Vỏ nào hợp bề ngang hiện tại.
 *
 * `useSyncExternalStore` chứ không phải `useState` + `useEffect`: lượt đọc đầu
 * tiên đã đúng ngay ở lượt vẽ đầu, nên panel không nháy một nhịp sai vỏ rồi mới
 * sửa mình.
 */
function useViewportLayout(): HistoryPanelLayout {
  const subscribe = useMemo(
    () =>
      (onChange: () => void): (() => void) => {
        if (!hasMatchMedia()) {
          return () => undefined;
        }

        const media = globalThis.matchMedia(SHEET_MEDIA_QUERY);

        media.addEventListener('change', onChange);

        return () => media.removeEventListener('change', onChange);
      },
    [],
  );

  const read = (): HistoryPanelLayout => {
    if (!hasMatchMedia()) {
      return FALLBACK_LAYOUT;
    }

    return globalThis.matchMedia(SHEET_MEDIA_QUERY).matches ? 'sheet' : 'panel';
  };

  return useSyncExternalStore(subscribe, read, () => FALLBACK_LAYOUT);
}

/**
 * Props thật của container — mọi thứ một màn khác cần để mở panel này.
 *
 * Không trường nào bắt buộc, và đó là một quyết định chứ không phải một lối
 * lười: panel này KHÔNG có hành động rời màn nào (khác `RoomAreaPanel`, nơi
 * `onOpenExport` và `onCheckWallGaps` phải có đích thật). Mọi việc nó làm —
 * nhảy trạng thái, tô sáng, khuôn camera — đều xảy ra bên trong viewer.
 */
export interface HistoryPanelContainerProps {
  /**
   * Ngăn xếp hoàn tác của phiên làm việc (S-06).
   *
   * Vắng mặt thì panel hiện lịch sử RỖNG của chính nó thay vì mượn của người
   * khác — xem ghi chú "history là một props" ở đầu file.
   */
  readonly history?: UseHistoryPanelOptions['history'];
  /** Tay cầm cảnh 3D. Vắng mặt thì camera đứng yên; mọi thứ khác vẫn chạy. */
  readonly scene?: HistorySceneHandle | null;
  /** Ai đang thao tác. Vắng mặt thì đọc từ phiên đăng nhập. */
  readonly actorId?: string;
  /** Panel mở ra ở trạng thái thu gọn hay không. */
  readonly isCollapsed?: boolean;
  /** Ép một vỏ. Vắng mặt thì vỏ đọc theo bề ngang cửa sổ. */
  readonly layout?: HistoryPanelLayout;
  /** Múi giờ IANA đọc mốc thời gian; vắng mặt thì dùng múi giờ của máy. */
  readonly timeZone?: string;
  /** Ép một trong bảy trạng thái, cho story và bài kiểm A11. */
  readonly forceState?: HistoryPanelState;
  /** Cổng thay thế, cho bài kiểm. Vắng mặt thì hook dựng cổng THẬT. */
  readonly gateway?: HistoryPanelGateway;
}

/** Cùng khuôn `RoomAreaPanelCrashFallback` — R-62, chữ từ `report.description`. */
function HistoryPanelCrashFallback({ report, retry }: ScreenErrorFallback) {
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
function WiredHistoryPanel(props: HistoryPanelContainerProps) {
  const session = useSession();
  const viewportLayout = useViewportLayout();

  /*
   * `'unknown'` là chưa biết vai, không phải không có quyền: bỏ hẳn trường
   * `roles` để hook đọc ra `undefined` và ở `loading`. Truyền một mảng rỗng
   * thay vào đó sẽ là nói "vai này không nhảy được" trong khi chưa ai hỏi xong.
   */
  const roleOption = useMemo(
    () => (session.status === 'unknown' ? {} : { roles: session.roles }),
    [session.roles, session.status],
  );

  /* Màn cha biết rõ hơn thì nó thắng; còn lại thì "tôi" là người đang đăng nhập. */
  const actorId = props.actorId ?? session.user?.id;

  const model = useHistoryPanel({
    ...roleOption,
    isCollapsed: props.isCollapsed ?? false,
    ...(props.history === undefined ? {} : { history: props.history }),
    ...(props.scene === undefined ? {} : { scene: props.scene }),
    ...(actorId === undefined ? {} : { actorId }),
    ...(props.timeZone === undefined ? {} : { timeZone: props.timeZone }),
    ...(props.forceState === undefined ? {} : { forceState: props.forceState }),
    ...(props.gateway === undefined ? {} : { gateway: props.gateway }),
  });

  return <HistoryPanel {...model} layout={props.layout ?? viewportLayout} />;
}

/** `<HistoryPanelContainer>` — panel lịch sử đã nối dây, gắn được bằng một thẻ. */
export function HistoryPanelContainer(props: HistoryPanelContainerProps) {
  return (
    <ScreenErrorBoundary
      renderFallback={(fallback) => <HistoryPanelCrashFallback {...fallback} />}
      screenId={HISTORY_PANEL_SCREEN_ID}
    >
      <WiredHistoryPanel {...props} />
    </ScreenErrorBoundary>
  );
}
