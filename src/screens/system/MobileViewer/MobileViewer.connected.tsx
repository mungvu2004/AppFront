/**
 * `MobileViewer` đã nối dây — hook cộng view, cộng canvas thật.
 *
 * File này tách khỏi `MobileViewer.container.tsx` vì đúng MỘT lý do, và lý do
 * ấy là một con số: nó nhập TĨNH `mobileViewerScene.ts`, thứ kéo theo cả
 * `three`. Ngân sách `routeChunk` của `scripts/check-bundle-size.mjs` là 280
 * KiB và nó đo **bao đóng nhập tĩnh** của một chunk tải muộn; `Viewer3D` — màn
 * duy nhất khác cũng dựng cảnh riêng — đã đứng ở 253,1 KiB vì đúng phép nhập
 * tĩnh ấy. Container `lazy()` file này, nên `three` rơi vào `dynamicImports`
 * của chunk màn thay vì vào bao đóng tĩnh của nó, và cú nhảy đầu tiên vào
 * `/m/du-an/:projectId` không phải trả tiền cho một cảnh 3D chưa chắc dựng nổi
 * trên máy đang mở nó.
 *
 * ## Canvas ở đâu
 *
 * `MobileViewerProps.canvasRef` là của **container**, không phải của hook —
 * hợp đồng mục 5 ghi thẳng như vậy. Phần tử canvas chỉ tồn tại sau khi view
 * gắn xong, nên nó đi ra bằng callback ref, vào `useState` ở đây, rồi xuống
 * hook làm tham số `canvas`. Cùng khuôn `WiredViewer3DScene`.
 *
 * ## Hai thứ chỉ chỗ này nối được
 *
 * `useMobileViewer` nhận hai tham số BẮT BUỘC mà hợp đồng kiểu không phủ:
 * `mountScene` (cảnh của T5) và một `NotificationBus` (chỗ nhận toast hoàn tác
 * của A8). Cả hai bắt buộc là cố ý — thứ THIẾU không hiện ra trong diff, nên
 * hook đóng nó bằng cấu trúc. Đây là điểm nối duy nhất có cả hai đầu dây, và
 * cũng là nơi `levels` + `tokenOfPartKind` đi xuống cảnh: hook dựng chúng từ
 * đồ thị thật (xem docblock `useMobileViewer.ts`), file này chỉ trao cho hook
 * đúng hàm lắp cảnh để chúng có chỗ mà đi tới.
 *
 * Cả hai vẫn khai TUỲ CHỌN trên props: một bài kiểm cắm cảnh giả vào để chạy
 * không cần WebGL, và một bus riêng để hai bài kiểm không đọc chung một hộp
 * thư. Vắng mặt thì mặc định là bản THẬT — cùng lựa chọn `useViewer3D` đã làm,
 * không phải bản giả như `useViewerShell`.
 */

import { useState } from 'react';

import { appNotificationBus } from '@/hooks/useNotifications';
import type { NotificationBus } from '@/lib/mutations/notificationBus';

import { MobileViewer } from './MobileViewer';
import { mountMobileViewerScene } from './mobileViewerScene';
import { useMobileViewer, type UseMobileViewerOptions } from './useMobileViewer';

/**
 * Mọi thứ hook cần, trừ `canvas` — thứ chỉ file này tạo ra được.
 *
 * `mountScene` và `notifications` hạ xuống tuỳ chọn ở đây; mặc định của chúng
 * nằm ngay dưới, và cả hai đều là bản thật.
 */
export interface ConnectedMobileViewerProps
  extends Omit<UseMobileViewerOptions, 'canvas' | 'mountScene' | 'notifications'> {
  /** Thay module cảnh, cho bài kiểm và story không cần WebGL. */
  readonly mountScene?: UseMobileViewerOptions['mountScene'] | undefined;
  /** Nơi nhận toast hoàn tác của A8; mặc định là bus của phiên. */
  readonly notifications?: Pick<NotificationBus, 'publish'> | undefined;
}

export function ConnectedMobileViewer({
  mountScene,
  notifications,
  ...options
}: ConnectedMobileViewerProps) {
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  const model = useMobileViewer({
    ...options,
    canvas,
    mountScene: mountScene ?? mountMobileViewerScene,
    notifications: notifications ?? appNotificationBus,
  });

  return <MobileViewer {...model} canvasRef={setCanvas} />;
}
