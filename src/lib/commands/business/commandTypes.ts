/**
 * Tên của mười sáu lệnh tường và ô mở — chỉ tên, không có phần thân.
 *
 * Hai bảng dưới đây từng nằm ở đầu `wallCommands.ts` và `openingCommands.ts`,
 * ngay cạnh phần thực hiện lệnh. Đúng chỗ về mặt đọc hiểu, nhưng nó buộc mọi
 * người gọi CHỈ cần cái tên phải nhập cả hai file ấy: `src/lib/tools/tools.ts`
 * dùng đúng bốn chuỗi (`wall.draw`, `wall.split`, `opening.add`,
 * `furniture.add`) để khai bốn công cụ, và nhận về `domain/walls/edit`,
 * `domain/walls/joints`, `domain/walls/cleanup`, `domain/openings/reflow` cùng
 * toàn bộ phần thân lệnh — 9,8 KiB gzip. Màn `MeasurementTool` chỉ đo khoảng
 * cách, không dựng tường nào, mà vẫn trả chừng ấy trong bao đóng nhập tĩnh.
 *
 * Cùng một hình dạng với việc W8 tách siêu dữ liệu ngưỡng khỏi đồ thị tĩnh của
 * engine luật: **dữ liệu mô tả tách khỏi mã thực hiện**, để nhập cái này không
 * kéo cái kia.
 *
 * File này không nhập gì cả, và phải giữ nguyên như vậy — thêm một `import` vào
 * đây là dựng lại đúng sợi dây vừa cắt. `wallCommands.ts` và `openingCommands.ts`
 * tái xuất hai bảng này nên mọi đường nhập cũ giữ nguyên.
 */

/** The eight wall commands, as `dispatch` and the telemetry see them. */
export const WALL_COMMAND_TYPES = {
  draw: 'wall.draw',
  dragEnd: 'wall.dragEnd',
  changeThickness: 'wall.changeThickness',
  changeHeight: 'wall.changeHeight',
  changeKind: 'wall.changeKind',
  split: 'wall.split',
  merge: 'wall.merge',
  remove: 'wall.delete',
} as const;

/** The nine opening and furniture commands. */
export const OPENING_COMMAND_TYPES = {
  addOpening: 'opening.add',
  moveOpening: 'opening.move',
  resizeOpening: 'opening.resize',
  removeOpening: 'opening.delete',
  addFurniture: 'furniture.add',
  moveFurniture: 'furniture.move',
  rotateFurniture: 'furniture.rotate',
  resizeFurniture: 'furniture.resize',
  removeFurniture: 'furniture.delete',
} as const;
