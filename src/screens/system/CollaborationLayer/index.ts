/**
 * Lớp phủ cộng tác — vòng hiện diện, khoá đối tượng, ghim bình luận và panel
 * xung đột, vẽ đè lên màn đang làm việc. Đường nhập duy nhất của thư mục này.
 *
 * - {@link CollaborationLayerContainer} là lớp đã nối (ranh giới lỗi + hook),
 *   cho một màn chủ muốn gắn bằng một dòng (R-62, R-73).
 * - {@link CollaborationLayer} là markup thuần, cho story và bộ kiểm.
 * - {@link useCollaborationLayer} là tầng logic, cho ai cần tự nối theo cách khác.
 * - {@link createCollaborationGateway} là cổng, cho bộ kiểm muốn tiêm phiên đăng
 *   nhập và đồng hồ của riêng nó.
 *
 * ## Đọc trước khi sửa: ba năng lực, hai đang tắt
 *
 * `presence`, `comments`, `locks` và `requestAccess` là bốn cổng thật, không
 * phải bốn cờ trang trí. Ba trong bốn tắt vì `src/api/endpoints.ts` không có
 * nhóm nào cấp dữ liệu cho chúng — chi tiết từng cái, kèm tên đúng thứ còn
 * thiếu, nằm ở `COLLABORATION_CAPABILITIES` trong `collaborationGateway.ts` và
 * ở `LOGIC-REQUESTS.md` cạnh file này. Bật một cờ mà chưa có dây là dựng một
 * nhánh giao diện gọi vào chỗ trống.
 *
 * Phần chạy được thật là panel xung đột: `src/lib/versioning/conflict.ts` có
 * thật, có test, và màn **gọi** nó chứ không tự xử.
 *
 * ## Bảng chủ sở hữu — đọc trước khi sửa bất cứ file nào ở đây
 *
 * Bốn người dựng lớp này song song từ một hợp đồng đông cứng (`types.ts`).
 * Ranh giới dưới đây tồn tại để không ai phải chờ ai:
 *
 * | File | Chủ | Việc |
 * |---|---|---|
 * | `types.ts` | hợp đồng | hình dạng dữ liệu, bốn cờ năng lực, chữ ký cổng |
 * | `collaborationGateway.ts` · `useCollaborationLayer.ts` · `CollaborationLayer.container.tsx` · `index.ts` | L2-A | cổng, tầng logic, ranh giới lỗi, đường nhập |
 * | `CollaborationLayer.tsx` và các phần con của nó | L2-B | view thuần: vòng hiện diện, khoá, ghim, panel xung đột |
 * | `CollaborationLayer.test.tsx` · `.stories.tsx` | L2-C | bảy trạng thái + tiếp cận + tiếng Việt |
 * | `src/i18n/vi.json` | lớp gộp | từ điển soát tiếng Việt |
 *
 * `CollaborationLayerProps` là **một nguồn duy nhất**: khai trong `types.ts`,
 * mọi file khác nhập bằng `import type`, không khai lại.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { CollaborationLayerContainer } from './CollaborationLayer.container';
export type { CollaborationLayerContainerProps } from './CollaborationLayer.container';
export { CollaborationLayer } from './CollaborationLayer';
export {
  COLLABORATION_TEXT,
  deriveSyncState,
  editingFieldKeyOf,
  useCollaborationLayer,
} from './useCollaborationLayer';
export type {
  CollaborationSceneTarget,
  SyncStateInput,
  UseCollaborationLayerOptions,
  UseCollaborationLayerResult,
} from './useCollaborationLayer';
export {
  COLLABORATION_CAPABILITIES,
  SELF_FALLBACK_NAME,
  createCollaborationGateway,
  initialsOf,
  readActorName,
  readSelfName,
  toFieldLabel,
  toValueLabel,
} from './collaborationGateway';
export type {
  CollaborationActor,
  CreateCollaborationGatewayOptions,
} from './collaborationGateway';
export type {
  CollaborationCapabilities,
  CollaborationGateway,
  CollaborationLayerProps,
  CollaborationSyncState,
  CollaboratorVm,
  CommentPinVm,
  ConflictChoice,
  ConflictSideVm,
  ConflictVm,
  LockVm,
} from './types';
