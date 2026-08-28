/**
 * Khung hook của màn Xử lý (`ProcessingScreen`) — CHƯA nối logic thật.
 *
 * `types.ts` là hợp đồng props DUY NHẤT của màn; hook này chỉ giữ đúng chữ ký
 * `(options) => ProcessingScreenProps` để `ProcessingScreen.container.tsx` biên
 * dịch được, và để nhiệm vụ kế tiếp (V7) có một chỗ đã định hình để viết logic
 * thật vào.
 *
 * Bốn việc còn thiếu — tiến độ trực tiếp, huỷ xử lý, chạy nền, vị trí hàng đợi
 * — đều chưa có endpoint (xem `processingGateway.ts`). Nối `useQuery`/dây tiến
 * độ trực tiếp thật, xếp bảy trạng thái (A11), và định dạng mọi chuỗi (A15) là
 * việc của V7, sau khi bốn endpoint trên tồn tại. Hook KHÔNG tự bịa số phần
 * trăm hay tự đặt trạng thái để "có gì đó hiện ra" — làm vậy đúng thứ R-69 cấm
 * ("khong tu che, khong stub tra gia tri bia, khong TODO").
 *
 * Nên bây giờ gọi hook này NÉM LỖI ngay khi render — không phải một khiếm
 * khuyết mà là điều duy nhất trung thực nó có thể làm khi chưa có gì để trả.
 * `ProcessingScreen.container.tsx` bọc nó bằng `ScreenErrorBoundary` (bản đã
 * gắn ở `src/App.tsx`, R-62), nên màn không bao giờ trắng (A11): người xem
 * thấy đúng thông báo "chưa xong", không phải một màn hình chết cứng.
 */

import type { ProjectRole } from '@/types/project';

import type { ProcessingGateway } from './processingGateway';
import type { ProcessingScreenProps } from './types';

export interface UseProcessingScreenOptions {
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /**
   * Cổng dữ liệu. Không có mặc định bên trong (khác `useInputQualityGate`):
   * `processingGateway.ts` không có factory, vì chưa có endpoint thật nào để
   * factory đó gọi.
   */
  readonly gateway?: ProcessingGateway;
  readonly onNavigate?: (path: string) => void;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
}

/** `(options) => ProcessingScreenProps` cho `ProcessingScreen.tsx` — xem ghi chú đầu file. */
export function useProcessingScreen(options: UseProcessingScreenOptions): ProcessingScreenProps {
  throw new Error(
    `useProcessingScreen: chưa nối logic thật cho dự án "${options.projectId}" — ` +
      'chờ endpoint xử lý (subscribeProgress / requestCancel / runInBackground / ' +
      'readQueuePosition), xem processingGateway.ts.',
  );
}
