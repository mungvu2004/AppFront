/**
 * `S-45` — lớp trạng thái kết nối. Đường nhập duy nhất của thư mục này.
 *
 * - {@link ConnectionStatesContainer} là lớp ĐÃ NỐI: `<ConnectionStatesContainer projectId />`
 *   là đủ (R-73). Nó tự dựng bộ theo dõi mạng và tự đọc hàng đợi ngoại tuyến.
 * - {@link ConnectionStates} là markup thuần, cho story và test (mục D, R-60).
 * - {@link useConnectionStates} là toàn bộ logic.
 * - {@link createConnectionStatesGateway} là cửa vào duy nhất tới `lib/offline`.
 *
 * **Không có `ConnectionStatesRoute`, và đó là chủ ý:** bảng route chuẩn ghi S-45
 * là "không route". Đây là lớp dùng chung của mọi màn, nhúng vào vỏ ứng dụng,
 * không phải một trang người dùng đi tới.
 */

export { ConnectionStates } from './ConnectionStates';

export { ConnectionStatesContainer } from './ConnectionStates.container';

export { useConnectionStates } from './useConnectionStates';
export type { UseConnectionStatesOptions, UseConnectionStatesResult } from './useConnectionStates';

export { createConnectionStatesGateway, isQueueFull } from './connectionStatesGateway';
export type { ConnectionStatesGateway } from './connectionStatesGateway';

export { SYNCED_NOTICE_MS } from './connectionStatesModel';

export type {
  ConnectionCase,
  ConnectionStatesActions,
  ConnectionStatesContainerProps,
  ConnectionStatesModel,
  ConnectionStatesProps,
  ConnectionTier,
  PendingCommandRow,
} from './types';
