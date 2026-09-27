/**
 * Đổi id giữa hai hệ, và **chỉ** đổi id.
 *
 * Pascal đặt id theo khuôn `<tiền tố>_<thân>` (`schema/base.js`:
 * `generateId = (prefix) => \`${prefix}_${customId()}\``), còn AppFront đặt
 * theo khuôn `<TIỀN TỐ>-<THÂN>` (`domain/spatial/ids.ts`). Hai khuôn không
 * giẫm lên nhau, nên id AppFront **nhét nguyên vẹn** vào thân id Pascal được:
 * `W-WALL0010` thành `wall_W-WALL0010`. Nhờ vậy lượt đi và lượt về là phép
 * cắt chuỗi chứ không phải một bảng tra phải mang theo suốt phiên làm việc.
 *
 * ## Phép kiểm ở lượt về không phải thủ tục
 *
 * Node do Pascal tự đẻ có thân là nanoid (`wall_k3n9…`), dịch ngược ra
 * `k3n9…` — không qua được `isIdOfKind`. Đó là dấu hiệu **duy nhất và đáng
 * tin** phân biệt "đối tượng AppFront đi một vòng rồi về" với "đối tượng
 * người dùng vừa vẽ trong Pascal", và A5 dựa hẳn vào nó: chỉ nhóm thứ nhất
 * mới được mang dấu xác minh của chính nó về.
 */

import { isIdOfKind, type EntityKind, type IdByKind } from '@/domain/spatial/ids';

import type { PascalNodeId, PascalNodeType } from './types';

/**
 * Loại node Pascal tương ứng với từng loại đối tượng AppFront.
 *
 * Ô mở là chỗ duy nhất không một-một: AppFront gộp cửa đi và cửa sổ vào một
 * loại `opening` phân biệt bằng trường `kind`, Pascal tách hẳn thành hai loại
 * node. Bảng này vì thế chỉ ghi phần một-một; ô mở do `toPascal.ts` tự rẽ.
 */
export const PASCAL_TYPE_BY_KIND = {
  level: 'level',
  wall: 'wall',
  room: 'zone',
  furniture: 'item',
} as const satisfies Partial<Record<EntityKind, PascalNodeType>>;

/** Loại đối tượng AppFront có node Pascal tương ứng một-một. */
export type MappedKind = keyof typeof PASCAL_TYPE_BY_KIND;

/** Gắn tiền tố Pascal vào một id AppFront. */
export const toPascalId = (type: PascalNodeType, appFrontId: string): PascalNodeId =>
  `${type}_${appFrontId}`;

/**
 * Cắt tiền tố Pascal ra, trả lại phần thân.
 *
 * Cắt ở dấu gạch dưới **đầu tiên**: thân id AppFront không chứa dấu gạch dưới
 * nào, nên phần còn lại luôn nguyên vẹn.
 */
export const bodyOfPascalId = (nodeId: PascalNodeId): string => {
  const cut = nodeId.indexOf('_');

  return cut === -1 ? nodeId : nodeId.slice(cut + 1);
};

/**
 * Id AppFront mà một node Pascal mang về, hoặc `null` khi node ấy do Pascal đẻ.
 *
 * `null` không phải lỗi — nó là câu trả lời "đối tượng này mới, hãy cấp cho nó
 * một id AppFront".
 */
export const appFrontIdOf = <K extends EntityKind>(
  kind: K,
  nodeId: PascalNodeId,
): IdByKind[K] | null => {
  const body = bodyOfPascalId(nodeId);

  return isIdOfKind(kind, body) ? body : null;
};

/** Id của node khu đất; một cảnh AppFront chỉ có một. */
export const SITE_NODE_ID: PascalNodeId = 'site_APPFRONT';

/** Id của node công trình; một cảnh AppFront chỉ có một. */
export const BUILDING_NODE_ID: PascalNodeId = 'building_APPFRONT';
