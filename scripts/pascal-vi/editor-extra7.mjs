/**
 * Bảng dịch + vá editor-hig (04/11/2026): bảng trợ giúp ngữ cảnh khi chọn vật (`contextual-help.ts`),
 * thông báo chế độ mặt bằng ("Switch to Expert"), và hộp xác nhận trước "Xoá hết và làm lại".
 * Cùng định dạng `editor.mjs`; chuỗi gốc phải khớp từng byte. Phím ("Left click", "Cmd/Ctrl"…) giữ
 * nguyên vì Pascal vẽ thành biểu tượng.
 */
const S = (en, vi) => [`'${en}'`, `'${vi}'`];

/** Hỏi trước khi xoá: thao tác này xoá luôn lịch sử hoàn tác nên không Ctrl+Z được. */
export const RESET_CONFIRM =
  "if (!window.confirm('Xoá hết mọi thứ trong dự án và làm lại từ đầu? Lịch sử hoàn tác cũng bị xoá, không thể hoàn tác thao tác này.')) return";

export const EDITOR_EXTRA7_VI = {
  'editor/src/lib/contextual-help.ts': [
    S('Rotating freely (no angle step)', 'Đang xoay tự do (không theo bước góc)'),
    S('Hold to rotate freely', 'Giữ để xoay tự do'),
    S('Add or remove objects from the selection', 'Thêm hoặc bỏ vật khỏi vùng chọn'),
    S('Click or drag the selection to move it as one', 'Bấm hoặc kéo vùng chọn để di chuyển cả nhóm'),
    S('Rotate the selection ±45°', 'Xoay vùng chọn ±45°'),
    S('Group selection (session only)', 'Gộp nhóm vùng chọn (chỉ trong phiên này)'),
    S('Ungroup session selection', 'Bỏ nhóm vùng chọn của phiên'),
    S('Clear the selection (or click outside)', 'Bỏ chọn (hoặc bấm ra ngoài)'),
    S('Click a handle dot to show move arrows', 'Bấm chấm điều khiển để hiện mũi tên di chuyển'),
    S('Detach the joint while dragging an arrow', 'Tách mối nối khi đang kéo mũi tên'),
    S('Click the handle dot to show move + rotate handles', 'Bấm chấm điều khiển để hiện tay nắm di chuyển và xoay'),
    S('Rotate ±45°', 'Xoay ±45°'),
    S('Switch the rotation axis (Y → X → Z)', 'Đổi trục xoay (Y → X → Z)'),
    S('Drag selected movable object', 'Kéo để di chuyển vật đang chọn'),
    S('Drag left or right to rotate selected object', 'Kéo sang trái hoặc phải để xoay vật đang chọn'),
    S('Adjust one side’s corner radius', 'Chỉnh bán kính bo góc một bên'),
  ],
  'editor/src/components/editor/floorplan-mode-coordinator.tsx': [
    ['\n          Switch to Expert\n', '\n          Chuyển sang chế độ chuyên gia\n'],
    [
      '`Switched to Default. The unfinished ${toolLabel} draft was canceled; saved Expert annotations are hidden, not deleted.`',
      '`Đã chuyển về chế độ mặc định. Bản nháp ${toolLabel} đang vẽ dở đã bị huỷ; chú thích chuyên gia đã lưu chỉ bị ẩn, không bị xoá.`',
    ],
  ],
  // Câu thông báo đi kèm nút "Switch to Expert" (tên công cụ đã được dịch ở registry)
  'editor/src/store/use-floorplan-mode.ts': [
    ['`${toolLabel} is available in Expert mode.`', '`${toolLabel} chỉ có ở chế độ chuyên gia.`'],
  ],
  'editor/src/components/ui/action-menu/measurement-control.tsx': [
    ["showExpertModeNotice('Construction Dimension')", "showExpertModeNotice('Kích thước thi công')"],
  ],
  // Vòng 2: nhãn chế độ nối tiếp trong bảng gợi ý công cụ (tường, hàng rào, đặt đồ, tủ, mái hiên)
  'editor/src/lib/continuation.ts': [
    S('Room (auto-close)', 'Phòng (tự khép kín)'),
    S('Single wall', 'Một bức tường'),
    S('Continuous', 'Liên tục'),
    S('Single fence', 'Một đoạn rào'),
    S('Curved fence', 'Rào cong'),
    S('Place once', 'Đặt một lần'),
    S('Place multiple', 'Đặt nhiều lần'),
    S('Single cabinet', 'Một tủ'),
    S('Continuous run', 'Dãy tủ liên tục'),
    S('Single canopy', 'Một mái hiên'),
    S('Continuous canopy', 'Mái hiên liên tục'),
  ],
  'editor/src/components/ui/helpers/contextual-helper-panel.tsx': [
    ['`Continuation: ${label}`', '`Nối tiếp: ${label}`'],
    ["'Straight: Single' : 'Straight: Continuous'", "'Thẳng: Một đoạn' : 'Thẳng: Liên tục'"],
    ["'Type: Curved' : 'Type: Straight'", "'Kiểu: Cong' : 'Kiểu: Thẳng'"],
    ["`Fence type: ${isCurved ? 'Curved' : 'Straight'}`", "`Kiểu hàng rào: ${isCurved ? 'Cong' : 'Thẳng'}`"],
    ['tooltip="Fence type — click or press T to switch between straight and curved"', 'tooltip="Kiểu hàng rào: bấm hoặc nhấn T để đổi thẳng / cong"'],
    ['`Fence continuation: ${straightLabel}`', '`Nối tiếp hàng rào: ${straightLabel}`'],
    S('Straight continuation is unavailable while curved fence type is active', 'Không nối tiếp thẳng được khi đang vẽ rào cong'),
    S('Straight fence continuation — click or press C to toggle', 'Nối tiếp rào thẳng: bấm hoặc nhấn C để đổi'),
    // Chip phạm vi tô của công cụ Sơn
    ['`Paint: ${', '`Tô: ${'],
    ['`Paint scope: ${', '`Phạm vi tô: ${'],
  ],
  // Phạm vi tô: tên loại vật lấy từ registry (đã dịch lúc chạy ở upstream/lib/pascal-vi.ts), thiếu thì giữ id
  'editor/src/lib/paint-scope.ts': [
    [
      'return `Whole ${info.nodeNoun}`',
      "return `Cả ${(nodeRegistry.get(info.nodeNoun)?.presentation?.label ?? info.nodeNoun).toLocaleLowerCase('vi')}`",
    ],
    ["return 'All matching'", "return 'Mọi vật cùng mẫu'"],
    ["return 'Room'", "return 'Cả phòng'"],
    S('This surface', 'Bề mặt này'),
  ],
  // Giữ Shift khi đặt cửa/vùng/ống: dòng gợi ý đổi sang trạng thái "bỏ ràng buộc"
  'editor/src/components/ui/helpers/registered-tool-helper.tsx': [S('Guided constraints bypassed', 'Đang bỏ ràng buộc dẫn hướng')],
  // Gợi ý do vật tự sinh qua `getHints` (chỉ Khối có): sửa lưới đỉnh / cạnh / mặt
  'nodes/src/block/contextual-help.ts': [
    ["  vertex: 'Vertex',\n  edge: 'Edge',\n  face: 'Face',", "  vertex: 'Đỉnh',\n  edge: 'Cạnh',\n  face: 'Mặt',"],
    S('Merge selected vertices', 'Gộp các đỉnh đang chọn'),
    S('Bevel selected edges', 'Vát các cạnh đang chọn'),
    S('Dissolve selected edges', 'Bỏ các cạnh đang chọn'),
    S('Extrude selected faces', 'Đùn các mặt đang chọn'),
    S('Inset selected faces', 'Thu vào các mặt đang chọn'),
    ['`${MODE_LABELS[mode]} mode`', '`Chế độ ${MODE_LABELS[mode].toLowerCase()}`'],
    S('Vertex / Edge / Face', 'Đỉnh / Cạnh / Mặt'),
    S('Move / Rotate / Scale selection', 'Di chuyển / Xoay / Co giãn vùng chọn'),
    S('Exit mesh editing', 'Thoát sửa lưới'),
  ],
  'editor/src/components/ui/sidebar/panels/settings-panel/index.tsx': [
    ['  const handleResetToDefault = () => {\n    clearScene()', `  const handleResetToDefault = () => {\n    ${RESET_CONFIRM}\n    clearScene()`],
  ],
};
