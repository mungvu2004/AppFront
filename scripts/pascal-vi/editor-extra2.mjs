/**
 * Bảng dịch bổ sung đợt D1c (QA-2): menu đo, bộ chuyển khung nhìn, thanh chế độ,
 * rail "Plugins". Cùng định dạng với `editor.mjs`; `pascal-vi.mjs` nối các bảng.
 */
const UI = 'editor/src/components/ui/';

export const EDITOR_EXTRA2_VI = {
  [`${UI}action-menu/measurement-control.tsx`]: [
    ["label: 'Distance'", "label: 'Khoảng cách'"],
    ["label: 'Angle'", "label: 'Góc'"],
    ["label: 'Area'", "label: 'Diện tích'"],
    ["label: 'Perimeter'", "label: 'Chu vi'"],
    ["label: 'Volume'", "label: 'Thể tích'"],
    ["label: 'Smart'", "label: 'Thông minh'"],
    ["? 'Smart'", "? 'Thông minh'"],
    ["label: 'Linear dimension'", "label: 'Kích thước thẳng'"],
    ["?? 'Linear dimension'", "?? 'Kích thước thẳng'"],
    ["label: 'Continuous dimension'", "label: 'Kích thước liên tiếp'"],
    ["label: 'Radius dimension'", "label: 'Kích thước bán kính'"],
    ["label: 'Diameter dimension'", "label: 'Kích thước đường kính'"],
    ["label: 'Center mark'", "label: 'Dấu tâm'"],
    ["label: 'Chord dimension'", "label: 'Kích thước dây cung'"],
    ["label: 'Arc length'", "label: 'Độ dài cung'"],
    ["label: 'Angular dimension'", "label: 'Kích thước góc'"],
    ["label: 'Coordinate dimensions'", "label: 'Kích thước tọa độ'"],
    ['aria-label={`Measure: ${selectedLabel}`}', 'aria-label={`Đo: ${selectedLabel}`}'],
    ['label={`Measure: ${selectedLabel}`}', 'label={`Đo: ${selectedLabel}`}'],
    ['aria-label="Measurement options"', 'aria-label="Tùy chọn đo"'],
    ['aria-label="Measurement type"', 'aria-label="Loại phép đo"'],
    ['Floor plan\n', 'Mặt bằng\n'],
  ],

  [`${UI}action-menu/control-modes.tsx`]: [
    ["label: 'Select'", "label: 'Chọn'"],
    ["label: 'Zone'", "label: 'Vùng'"],
    ["label: 'Delete'", "label: 'Xóa'"],
  ],

  [`${UI}sidebar/use-plugin-panels.tsx`]: [["label: 'Plugins'", "label: 'Tiện ích'"]],

  [`${UI}sidebar/panels/plugins-panel.tsx`]: [
    ['>Plugins</h2>', '>Tiện ích</h2>'],
    ['Add focused tools and content to this project.', 'Thêm công cụ và nội dung chuyên biệt cho dự án này.'],
    ["'Installed' : 'Not installed'", "'Đã cài' : 'Chưa cài'"],
    ["'Adds a new tool panel to the editor.'", "'Thêm một bảng công cụ mới vào trình chỉnh sửa.'"],
    ['>Plugin ID</dt>', '>Mã tiện ích</dt>'],
    ['>Creator</dt>', '>Tác giả</dt>'],
    ['>Plugin</dt>', '>Tiện ích</dt>'],
    ["'Uninstall' : 'Install'", "'Gỡ cài đặt' : 'Cài đặt'"],
    ['Create a Pascal plugin', 'Tạo tiện ích Pascal'],
  ],

  'editor/src/components/viewer/viewer-stage-switcher.tsx': [
    ['label="Split"', 'label="Chia đôi"'],
    ['aria-label="Viewer layout"', 'aria-label="Bố cục khung nhìn"'],
  ],
};
