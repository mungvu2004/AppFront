/**
 * Bảng dịch bổ sung (H6, 01/11/2026): phần còn sót mà người dùng căn hộ gặp được — gợi ý đặt đồ,
 * thanh tra cầu thang, nhiều mục chọn cùng lúc, hộp Phím tắt (nhóm Camera), chip vẽ cong/tô màu,
 * các mốc sàn/trần, tên mặc định. Cùng định dạng `editor.mjs`; chuỗi gốc phải khớp từng byte.
 * Cố ý bỏ: cột (`column/panel.tsx`, ~100 chuỗi, ẩn sau "Thêm"), thanh chọn trên điện thoại
 * (`mobile-selection-bar.tsx`, web chỉ cho máy tính/máy tính bảng), đơn vị Anh-Mỹ của sàn/trần.
 */
const C = 'editor/src/components/';
const UI = `${C}ui/`;
const P = (a, b) => [a, b];
const L = (en, vi) => [`label="${en}"`, `label="${vi}"`];
const T = (en, vi) => [`title="${en}"`, `title="${vi}"`];
const O = (en, vi) => [`{ label: '${en}', value:`, `{ label: '${vi}', value:`];
const Q = (en, vi) => P(`label: '${en}' }`, `label: '${vi}' }`);

export const EDITOR_EXTRA6_VI = {
  // Gợi ý khi đặt đồ (phím như "Left click", "R" giữ nguyên: Pascal đổi sang biểu tượng)
  [`${UI}helpers/item-helper.tsx`]: [
    Q('Place', 'Đặt'),
    Q('Rotate', 'Xoay'),
    Q('Force place', 'Đặt bắt buộc'),
    Q('Cancel', 'Huỷ'),
  ],
  // Chip vẽ cong / tô màu
  [`${UI}helpers/contextual-helper-panel.tsx`]: [
    P('tooltip="Continuation — click or press C to cycle"', 'tooltip="Nối tiếp: bấm hoặc nhấn C để đổi"'),
    P('label="Finish curve (or double-click)"', 'label="Kết thúc đường cong (hoặc bấm đúp)"'),
    P('label="Select a material to paint"', 'label="Chọn vật liệu để tô"'),
    P('label="Hover a surface to paint"', 'label="Rê lên bề mặt để tô"'),
    P('tooltip="Paint scope — click or press Shift to cycle"', 'tooltip="Phạm vi tô: bấm hoặc nhấn Shift để đổi"'),
  ],
  // Phím tắt: nhóm Camera
  [`${UI}sidebar/panels/settings-panel/keyboard-shortcuts-dialog.tsx`]: [P("title: 'Camera'", "title: 'Máy ảnh'")],
  // Tên khi chọn nhiều thứ không cùng loại
  [`${UI}panels/panel-manager.tsx`]: [P("label: 'Selection' }", "label: 'Vùng chọn' }")],
  // Nhiều mục chọn: giá trị lẫn lộn
  [`${UI}panels/parametric-field-control.tsx`]: [
    P('\n                Mixed\n', '\n                Khác nhau\n'),
    P("mixed ? 'Mixed' : str", "mixed ? 'Khác nhau' : str"),
  ],
  [`${UI}panels/multi-height-mode.tsx`]: [
    P("{ label: 'Follows level', value: 'storey' }", "{ label: 'Theo tầng', value: 'storey' }"),
    P("{ label: 'Custom height', value: 'custom' }", "{ label: 'Tự đặt', value: 'custom' }"),
    P(": 'Mixed'", ": 'Khác nhau'"),
  ],
  [`${UI}panels/reference-panel.tsx`]: [
    P('Overlay image unavailable. Replace the image to restore it.', 'Không mở được ảnh nền. Hãy thay ảnh khác để dùng lại.'),
  ],
  // Đèn: ô cường độ
  [`${UI}item-catalog/catalog-items.tsx`]: [P("label: 'Intensity'", "label: 'Độ sáng'")],
  // Tên tường nháp khi vẽ
  'nodes/src/wall/tool.tsx': [P("name: 'Draft wall'", "name: 'Tường đang vẽ'")],
  [`${C}editor/floorplan-panel.tsx`]: [P("name: 'Draft wall'", "name: 'Tường đang vẽ'")],
  // Cửa đi: hướng mở
  'nodes/src/door/panel.tsx': [P('\n                    Direction\n', '\n                    Hướng mở\n')],
  // Sàn / trần: chân sàn, ô tự sinh từ cầu thang
  'nodes/src/slab/panel.tsx': [
    P('\n              Foundation\n', '\n              Phần chân sàn\n'),
    P("'Auto elevator cutout' : 'Auto stair cutout'", "'Ô khoét thang máy (tự động)' : 'Ô khoét cầu thang (tự động)'"),
    P("isAutoHole ? autoLabel : 'Manual'", "isAutoHole ? autoLabel : 'Tự khoét'"),
    P('\n                        Auto\n', '\n                        Tự động\n'),
  ],
  'nodes/src/ceiling/panel.tsx': [
    P("'Auto elevator cutout' : 'Auto stair cutout'", "'Ô khoét thang máy (tự động)' : 'Ô khoét cầu thang (tự động)'"),
    P("isAutoHole ? autoLabel : 'Manual'", "isAutoHole ? autoLabel : 'Tự khoét'"),
    P('\n                        Auto\n', '\n                        Tự động\n'),
  ],
  // Cầu thang
  'nodes/src/stair/panel.tsx': [
    P("node.name || 'Staircase'", "node.name || 'Cầu thang'"),
    P("label: 'None', value: 'none'", "label: 'Không', value: 'none'"),
    O('Left', 'Trái'),
    O('Right', 'Phải'),
    O('Both', 'Hai bên'),
    O('Balusters', 'Con tiện'),
    O('Post & rail', 'Trụ và tay vịn'),
    O('Cable', 'Dây cáp'),
    O('Boards', 'Tấm ván'),
    O('Straight', 'Thẳng'),
    O('Curved', 'Cong'),
    O('Spiral', 'Xoắn ốc'),
    O('Integrated', 'Liền cầu thang'),
    O('Destination', 'Theo tầng đến'),
    P("deck.name || 'Deck'", "deck.name || 'Sàn gác'"),
    P("'Follows deck' : 'Follows level'", "'Theo sàn gác' : 'Theo tầng'"),
    P("label: 'Custom rise'", "label: 'Tự đặt'"),
    P('Currently {', 'Hiện tại {'),
    P('`Segment ${i + 1}`', '`Đoạn ${i + 1}`'),
    P('{seg.segmentType}</span>', "{seg.segmentType === 'landing' ? 'chiếu nghỉ' : 'vế thang'}</span>"),
    P('\n              From Level\n', '\n              Từ tầng\n'),
    P('\n              To\n', '\n              Đến\n'),
    P('\n              Rise\n', '\n              Độ cao lên\n'),
    P('\n                  Landing\n', '\n                  Chiếu nghỉ\n'),
    T('Type', 'Kiểu'),
    T('Opening', 'Ô khoét sàn'),
    T('Segments', 'Các đoạn'),
    T('Geometry', 'Hình dạng'),
    T('Position', 'Vị trí'),
    T('Railing', 'Lan can'),
    T('Actions', 'Thao tác'),
    L('Auto Cutout', 'Tự khoét sàn'),
    L('Rise', 'Độ cao lên'),
    L('Opening Offset', 'Độ lệch ô khoét'),
    L('Top Landing', 'Chiếu nghỉ trên'),
    L('Add flight', 'Thêm vế thang'),
    L('Add landing', 'Thêm chiếu nghỉ'),
    L('Width', 'Rộng'),
    L('Steps', 'Số bậc'),
    L('Fit To Floor', 'Chạm tới sàn'),
    L('Thickness', 'Độ dày'),
    L('Inner Radius', 'Bán kính trong'),
    L('Sweep', 'Góc quét'),
    L('Center Column', 'Cột giữa'),
    L('Step Supports', 'Đỡ bậc'),
    L('Rotation', 'Xoay'),
    L('Height', 'Cao'),
    L('Move', 'Di chuyển'),
    L('Duplicate', 'Nhân bản'),
    L('Delete', 'Xoá'),
  ],
  'nodes/src/stair-segment/panel.tsx': [
    P("node.name || 'Stair Segment'", "node.name || 'Đoạn cầu thang'"),
    P('\n                Editing switches the stair to Custom rise\n', '\n                Sửa ở đây sẽ chuyển cầu thang sang độ cao tự đặt\n'),
    O('Flight', 'Vế thang'),
    O('Landing', 'Chiếu nghỉ'),
    O('Front', 'Phía trước'),
    O('Left', 'Trái'),
    O('Right', 'Phải'),
    T('Type', 'Kiểu'),
    T('Attachment', 'Gắn vào'),
    T('Dimensions', 'Kích thước'),
    T('Structure', 'Kết cấu'),
    T('Position', 'Vị trí'),
    T('Actions', 'Thao tác'),
    L('Width', 'Rộng'),
    L('Length', 'Dài'),
    L('Height', 'Cao'),
    L('Steps', 'Số bậc'),
    L('Fill to floor', 'Chạm tới sàn'),
    L('Thickness', 'Độ dày'),
    L('Rotation', 'Xoay'),
    L('Duplicate', 'Nhân bản'),
    L('Delete', 'Xoá'),
  ],
  // Cây Cảnh: cửa trong tường (thử tay đợt 2 thấy "Door"/"Window")
  [`${UI}sidebar/panels/site-panel/door-tree-node.tsx`]: [P('defaultName="Door"', 'defaultName="Cửa đi"')],
  [`${UI}sidebar/panels/site-panel/window-tree-node.tsx`]: [P('defaultName="Window"', 'defaultName="Cửa sổ"')],
};
