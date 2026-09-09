/**
 * Lớp phủ cộng tác — bọc `useCollaborationLayer` bằng một ranh giới lỗi và nối
 * đủ props để bất cứ màn nào cũng gắn được bằng một dòng.
 *
 * Cùng khuôn `NotificationCenter.container.tsx`, và cùng ba lý do:
 *
 * - **R-62 — ranh giới lỗi.** Lớp này vẽ ĐÈ lên màn đang làm việc. Một ngoại lệ
 *   trong nó mà không có ranh giới sẽ kéo sập cả cây React của màn chủ, tức
 *   người dùng mất luôn bản vẽ đang sửa vì một vòng hiện diện hỏng. Ranh giới ở
 *   đây không phải thủ tục: nó là thứ giữ cho lỗi của lớp phủ nằm trong lớp phủ.
 * - **R-73 — nhận đủ props.** Hôm nay chưa màn nào dựng lớp này. Đó không phải
 *   lý do hoãn: một màn chủ đã giữ sẵn trạng thái thu gọn của riêng nó, hay một
 *   cảnh 3D đã dựng xong, phải cắm vào được mà không sinh ra nguồn sự thật thứ
 *   hai. Nên mọi thứ hook nhận đều đi qua được props của container.
 * - **`ScreenErrorBoundary` của `@/components/feedback`.** Repo có hai thứ trùng
 *   tên: `src/lib/screen-state/screenErrorBoundary.ts` là hàm dựng báo cáo,
 *   không phải component React — `src/lib` cấm React (mục 0.4) — nên nó không
 *   thể là ranh giới. Ranh giới thật là component ở `components/feedback`, đúng
 *   cái `src/App.tsx` và `NotificationCenter.container.tsx` đang dùng.
 *
 * ## Hai handler mà hook KHÔNG dựng, và vì sao container cũng chỉ nhận chúng
 *
 * `onGoToCollaborator` và `onRequestEditAccess` là hai props duy nhất của view
 * mà `useCollaborationLayer` không dựng nổi, và cả hai vì cùng một lẽ: chúng
 * cần thứ mà năng lực đang tắt nói là chưa có.
 *
 * - Đi tới chỗ một người khác cần biết họ đang nhìn đâu — dữ liệu hiện diện,
 *   `presence === false`.
 * - Xin quyền sửa cần một phép ghi chuyển giao khoá, `requestAccess === false`.
 *
 * Nơi gọi truyền vào thì container dùng của nơi gọi. Bỏ trống thì container
 * truyền một hàm KHÔNG làm gì, và đó là một lời từ chối có chú thích chứ không
 * phải chỗ bỏ quên — cùng lối viết `notificationCenterGateway.ts` đã dùng cho
 * `onStateChange` của kênh. View đọc `capabilities` và bỏ hẳn hai nút ấy khỏi
 * DOM khi cờ tắt, nên hai hàm này hôm nay không có đường nào để bị gọi.
 */

import { useCallback } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import {
  ScreenErrorBoundary,
  type ScreenErrorFallback,
} from '@/components/feedback/ScreenErrorBoundary';

import { CollaborationLayer } from './CollaborationLayer';
import { useCollaborationLayer, type UseCollaborationLayerOptions } from './useCollaborationLayer';

/** Tên màn này với ranh giới lỗi, và với bất cứ ai đọc báo cáo của nó. */
const SCREEN_ID = 'system-collaboration-layer';

export interface CollaborationLayerContainerProps extends UseCollaborationLayerOptions {
  /**
   * Đưa khung nhìn tới chỗ một người khác đang xem.
   *
   * Bỏ trống ⇒ không làm gì, vì `presence === false` nghĩa là danh sách người
   * chỉ có bạn và không có ai để đi tới.
   */
  readonly onGoToCollaborator?: ((collaboratorId: string) => void) | undefined;
  /**
   * Xin quyền sửa một đối tượng đang bị người khác giữ.
   *
   * Bỏ trống ⇒ không làm gì, vì `requestAccess === false` nghĩa là chưa có phép
   * ghi nào chuyển giao được khoá.
   */
  readonly onRequestEditAccess?: ((objectId: string) => void) | undefined;
}

/**
 * Thẻ nhỏ thay cho lớp phủ khi nó sập.
 *
 * `pointer-events-none` ở lớp ngoài là bắt buộc chứ không phải trang trí: lớp
 * phủ nằm đè lên bản vẽ, nên một thẻ báo lỗi chắn hết thao tác sẽ biến một lỗi
 * của tính năng phụ thành một màn hình không dùng được.
 */
function CollaborationCrashFallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto max-w-sm rounded-lg border border-border-default bg-bg-surface shadow-overlay">
        <EmptyState
          icon={<div className="h-8 w-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
          title={report.description.title}
          description={report.description.description}
          {...(report.retryable
            ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
            : {})}
        />
      </div>
    </div>
  );
}

/** Hook và view — nối lại thành một lớp phủ đã sẵn sàng. */
function WiredCollaborationLayer(props: CollaborationLayerContainerProps) {
  const { onGoToCollaborator, onRequestEditAccess, ...options } = props;

  const vm = useCollaborationLayer(options);

  const goToCollaborator = useCallback(
    (collaboratorId: string): void => {
      onGoToCollaborator?.(collaboratorId);
    },
    [onGoToCollaborator],
  );

  const requestEditAccess = useCallback(
    (objectId: string): void => {
      onRequestEditAccess?.(objectId);
    },
    [onRequestEditAccess],
  );

  return (
    <CollaborationLayer
      {...vm}
      onGoToCollaborator={goToCollaborator}
      onRequestEditAccess={requestEditAccess}
    />
  );
}

/** `<CollaborationLayerContainer />` — lớp phủ cộng tác, đã nối, một dòng là gắn được. */
export function CollaborationLayerContainer(props: CollaborationLayerContainerProps) {
  return (
    <ScreenErrorBoundary
      key={SCREEN_ID}
      screenId={SCREEN_ID}
      renderFallback={({ report, retry }) => (
        <CollaborationCrashFallback report={report} retry={retry} />
      )}
    >
      <WiredCollaborationLayer {...props} />
    </ScreenErrorBoundary>
  );
}
