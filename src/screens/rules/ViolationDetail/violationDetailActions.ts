/**
 * Cổng năng lực của khối 7 ("Lựa chọn xử lý"), tách khỏi file component.
 *
 * Ở đây chứ không ở `./ViolationDetailSections` vì hai nơi cùng cần nó — phần dựng hàng
 * và phần quyết định có nói câu "chưa có cách sửa tự động nào" — mà một file component
 * xuất thêm hàm thường thì làm hỏng fast refresh.
 *
 * Đây là cái cổng THỨ HAI. Gateway (`./violationDetailGateway`) đã lọc một lượt trước khi
 * hook phát ra `actions`; view gác lại lần nữa, và gác trên `capabilities` chứ không trên
 * "mảng `actions` có gì". Một cái cổng chỉ đứng ở một phía thì hở ngay lúc phía kia sai,
 * và điều hợp đồng đòi là: năng lực `false` ⇒ phần giao diện ấy **biến khỏi DOM** — không
 * nút vô hiệu hoá, không ô trống.
 */

import type {
  ViolationActionKind,
  ViolationDetailCapabilities,
  ViolationDetailViewProps,
} from './types';

/** Năng lực gác từng hàng lựa chọn. Bảng đã chốt ở mục 1 của hợp đồng. */
const ACTION_CAPABILITY: Readonly<Record<ViolationActionKind, keyof ViolationDetailCapabilities>> =
  {
    deleteObject: 'canDeleteObject',
    renameRoom: 'canRenameRoom',
    dismiss: 'canDismiss',
  };

/**
 * Những hàng lựa chọn THẬT SỰ dựng ra được, sau khi qua cổng năng lực.
 *
 * Câu "chưa có cách sửa tự động nào" chỉ đúng khi KHÔNG hàng nào dựng được, chứ không
 * phải khi mảng `actions` rỗng. Hai nơi đếm theo hai cách là cách chắc chắn nhất để có
 * một tấm trượt vừa im lặng vừa trống.
 */
export function allowedActionsOf(
  actions: ViolationDetailViewProps['actions'],
  capabilities: ViolationDetailCapabilities,
): ViolationDetailViewProps['actions'] {
  return actions.filter((action) => capabilities[ACTION_CAPABILITY[action.kind]]);
}
