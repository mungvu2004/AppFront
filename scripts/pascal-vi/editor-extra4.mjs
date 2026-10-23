/**
 * Bang dich bo sung (D3 dot 2): nhan/tieu de con tieng Anh trong panel 3D (thuoc tinh `label=`, `title=`,
 * `aria-label=`, vai `<option>`). Cung dinh dang `editor.mjs`; chuoi goc phai khop tung byte.
 */
const UI = 'editor/src/components/ui/';
const L = (en, vi) => [`label="${en}"`, `label="${vi}"`];

export const EDITOR_EXTRA4_VI = {
  [`${UI}action-menu/view-toggles.tsx`]: [L('Opacity', 'Độ mờ')],
  [`${UI}panels/multi-selection-panel.tsx`]: [
    L('Group', 'Nhóm'),
    L('Ungroup', 'Bỏ nhóm'),
    L('Duplicate', 'Nhân bản'),
    L('Delete', 'Xoá'),
    ['title="Group (Ctrl/Cmd+G)"', 'title="Nhóm (Ctrl/Cmd+G)"'],
    ['title="Ungroup (Ctrl/Cmd+Shift+G)"', 'title="Bỏ nhóm (Ctrl/Cmd+Shift+G)"'],
  ],
  [`${UI}controls/material-properties-editor.tsx`]: [
    L('Roughness', 'Độ nhám'),
    L('Metalness', 'Độ kim loại'),
    L('Opacity', 'Độ mờ'),
    ['<option value="front">Front</option>', '<option value="front">Mặt trước</option>'],
    ['<option value="back">Back</option>', '<option value="back">Mặt sau</option>'],
    ['<option value="double">Double</option>', '<option value="double">Hai mặt</option>'],
  ],
  [`${UI}controls/terrain-sculpt-panel.tsx`]: [
    L('Size', 'Kích thước'),
    L('Strength', 'Cường độ'),
    L('Softness', 'Độ mềm'),
    L('Target', 'Độ cao đích'),
    ['aria-label="Pick target height from the ground"', 'aria-label="Lấy độ cao đích từ mặt đất"'],
  ],
  [`${UI}panels/multi-height-mode.tsx`]: [L('Height', 'Chiều cao')],
  [`${UI}panels/parametric-inspector.tsx`]: [
    ['title="Actions"', 'title="Thao tác"'],
    L('Move', 'Di chuyển'),
    L('Delete with contents', 'Xoá cả nội dung'),
    L('Delete', 'Xoá'),
  ],
  [`${UI}panels/reference-panel.tsx`]: [
    ['title="Image"', 'title="Ảnh"'],
    ['title="Reference Scale"', 'title="Tỷ lệ tham chiếu"'],
    ['title="Quick Actions"', 'title="Thao tác nhanh"'],
    ['title="Capture"', 'title="Chụp"'],
    ['title="Position"', 'title="Vị trí"'],
    ['title="Rotation"', 'title="Xoay"'],
    ['title="Scale & Opacity"', 'title="Tỷ lệ và độ mờ"'],
    L('Clear Scale', 'Xoá tỷ lệ'),
    L('Reset Rotation', 'Đặt lại góc xoay'),
    L('Reset Image Scale', 'Đặt lại tỷ lệ ảnh'),
    L('Center', 'Căn giữa'),
    L('Delete', 'Xoá'),
    L('Move', 'Di chuyển'),
    L('Opacity', 'Độ mờ'),
  ],
  'editor/src/components/editor/floorplan-mode-coordinator.tsx': [['aria-label="Dismiss"', 'aria-label="Đóng"']],
};
