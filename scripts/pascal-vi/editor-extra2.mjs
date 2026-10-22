/**
 * Bảng dịch bổ sung đợt D1c (QA-2): menu đo, bộ chuyển khung nhìn, thanh chế độ,
 * rail "Plugins". Cùng định dạng với `editor.mjs`; `pascal-vi.mjs` nối các bảng.
 */
const UI = 'editor/src/components/ui/';

export const EDITOR_EXTRA2_VI = {
  // F4 (N-01): overlay chụp ảnh. Giữ nguyên aria-label (e2e tìm nút theo 'Take snapshot').
  ['editor/src/components/editor/snapshot-capture-overlay.tsx']: [
    ["  standard: 'Standard',\n  viewport: 'Viewport',\n  area: 'Area',\n", "  standard: 'Tiêu chuẩn',\n  viewport: 'Khung nhìn',\n  area: 'Vùng chọn',\n"],
    ["action: 'move' }", "action: 'di chuyển' }"],
    ["action: 'jump' }", "action: 'nhảy' }"],
    ["action: 'open' }", "action: 'mở' }"],
    ["action: 'lens' }", "action: 'ống kính' }"],
    ["action: 'free cursor' }", "action: 'thả chuột' }"],
    ["action: 'shoot' }", "action: 'chụp' }"],
    ["action: 'up' }", "action: 'lên' }"],
    ["action: 'down' }", "action: 'xuống' }"],
    ["action: 'boost' }", "action: 'tăng tốc' }"],
    ["action: 'slow' }", "action: 'chậm' }"],
    ["'Wheel'", "'Con lăn'"],
    ["'Click'", "'Nhấp'"],
    ["'Switch back to orbit to drag a capture area'", "'Về chế độ Xoay để kéo vùng chụp'"],
    ["'Drag the area you want to capture'", "'Kéo chọn vùng muốn chụp'"],
    ['\n              Crop\n', '\n              Khung\n'],
    ['\n              Format\n', '\n              Cỡ ảnh\n'],
    ["'Preset · square'", "'Mẫu · vuông'"],
    ['\n                  Lens\n', '\n                  Ống kính\n'],
    ["{!isMobile && 'Esc to cancel'}", "{!isMobile && 'Esc để huỷ'}"],
    ['label="Orbit"', 'label="Xoay"'],
    ['label="Walk"', 'label="Đi bộ"'],
    ['label="Drone"', 'label="Bay"'],
    ["label={isMobile ? undefined : 'Standard'}", "label={isMobile ? undefined : 'Tiêu chuẩn'}"],
    ["label={isMobile ? undefined : 'Viewport'}", "label={isMobile ? undefined : 'Khung nhìn'}"],
    ["label={isMobile ? undefined : 'Area'}", "label={isMobile ? undefined : 'Vùng chọn'}"],
    ["? 'Capturing…'", "? 'Đang chụp…'"],
    ["? 'Saved'", "? 'Đã lưu'"],
    ["\n                ? 'Capture'\n                : 'Take snapshot'}", "\n                ? 'Chụp'\n                : 'Chụp ảnh'}"],
  ],
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
    ["label: 'Coordinate dimensions'", "label: 'Kích thước toạ độ'"],
    ['aria-label={`Measure: ${selectedLabel}`}', 'aria-label={`Đo: ${selectedLabel}`}'],
    ['label={`Measure: ${selectedLabel}`}', 'label={`Đo: ${selectedLabel}`}'],
    ['aria-label="Measurement options"', 'aria-label="Tuỳ chọn đo"'],
    ['aria-label="Measurement type"', 'aria-label="Loại phép đo"'],
    ['Floor plan\n', 'Mặt bằng\n'],
  ],

  [`${UI}action-menu/control-modes.tsx`]: [
    ["label: 'Select'", "label: 'Chọn'"],
    ["label: 'Zone'", "label: 'Vùng'"],
    ["label: 'Delete'", "label: 'Xoá'"],
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

  // K6: dấu phẩy thập phân (CLAUDE.md 0.4) cho số Pascal CHỈ HIỂN THỊ. Gốc chung: ba hàm định
  // dạng đo đạc (mọi nhãn đo/kích thước/cao độ 2D-3D đi qua chúng) + dạng đọc của ô số
  // metric/slider. Ô đang gõ (`inputValue`, đọc lại bằng `parseFloat`) giữ dấu chấm.
  'editor/src/lib/measurements.ts': [
    ['.toFixed(fractionDigits)}${getAreaUnitLabel', ".toFixed(fractionDigits).replace('.', ',')}${getAreaUnitLabel"],
    ['.toFixed(fractionDigits)}${getVolumeUnitLabel', ".toFixed(fractionDigits).replace('.', ',')}${getVolumeUnitLabel"],
    ['return `${sign}${roundedMeters}m`', "return `${sign}${String(roundedMeters).replace('.', ',')}m`"],
  ],
  'editor/src/components/editor/floorplan-panel.tsx': [
    ['{Number.parseFloat(scaledAreaSqM.toFixed(1))}', "{String(Number.parseFloat(scaledAreaSqM.toFixed(1))).replace('.', ',')}"],
  ],
  'nodes/src/shared/construction-length.ts': [
    ['return `${sign}${rounded}m`', "return `${sign}${String(rounded).replace('.', ',')}m`"],
  ],
  [`${UI}controls/metric-control.tsx`]: [
    ['{Number(displayValue.toFixed(precision)).toFixed(precision)}', "{Number(displayValue.toFixed(precision)).toFixed(precision).replace('.', ',')}"],
  ],
  [`${UI}controls/slider-control.tsx`]: [
    ['{Number(displayValue.toFixed(precision)).toFixed(precision)}', "{Number(displayValue.toFixed(precision)).toFixed(precision).replace('.', ',')}"],
  ],
  [`${UI}floating-level-selector.tsx`]: [
    ["formattedStoreyHeight.replace(/0$/, '') :", "formattedStoreyHeight.replace(/0$/, '').replace('.', ',') :"],
    ["{ label: '2.5 m'", "{ label: '2,5 m'"],
    ["{ label: '3.0 m'", "{ label: '3,0 m'"],
    ["{ label: '3.5 m'", "{ label: '3,5 m'"],
  ],
  [`${UI}helpers/contextual-helper-panel.tsx`]: [
    ['ariaLabel={`Grid step: ${gridSnapStep.toFixed(2)} m`}', "ariaLabel={`Bước lưới: ${gridSnapStep.toFixed(2).replace('.', ',')} m`}"],
    ['label={`Grid: ${gridSnapStep.toFixed(2)} m`}', "label={`Lưới: ${gridSnapStep.toFixed(2).replace('.', ',')} m`}"],
    // K6b: chip bắt dính — nhãn, chế độ, tooltip.
    ["  grid: 'Grid',\n  lines: 'Lines',\n  angles: 'Angles',\n  off: 'Off',", "  grid: 'Lưới',\n  lines: 'Đường',\n  angles: 'Góc',\n  off: 'Tắt',"],
    ['ariaLabel={`Snapping: ${', 'ariaLabel={`Bắt dính: ${'],
    ['label={`Snapping: ${', 'label={`Bắt dính: ${'],
    ['tooltip="Snapping mode — click or press Shift to cycle"', 'tooltip="Chế độ bắt dính — bấm hoặc nhấn Shift để đổi"'],
    ['tooltip="Grid step — click or tap Ctrl to cycle"', 'tooltip="Bước lưới — bấm hoặc nhấn Ctrl để đổi"'],
  ],
};
// K6b: hộp "đặt tỉ lệ ảnh tham chiếu" của mặt bằng 2D. Số hiển thị dùng dấu phẩy; ví dụ cú pháp
// nhập ("3.5") giữ dấu chấm vì ô nhập đọc theo cú pháp của bộ phân tích gốc.
EDITOR_EXTRA2_VI['editor/src/components/editor/floorplan-panel.tsx'].push(
  ['>Set overlay scale</div>', '>Đặt tỉ lệ ảnh nền</div>'],
  [
    '\n                  Enter the real-world length of the line you just drew. The image will resize to\n                  match it.\n',
    '\n                  Nhập độ dài thực của đoạn vừa vẽ. Ảnh sẽ co giãn cho khớp.\n',
  ],
  ['\n                Drawn line\n', '\n                Đoạn đã vẽ\n'],
  ['\n                Real length\n', '\n                Độ dài thực\n'],
  ['<option value="meters">Meters</option>', '<option value="meters">Mét</option>'],
  ['<option value="centimeters">Centimeters</option>', '<option value="centimeters">Xen-ti-mét</option>'],
  ['<option value="feet">Feet</option>', '<option value="feet">Foot</option>'],
  ['<option value="inches">Inches</option>', '<option value="inches">Inch</option>'],
  [
    "'Any decimal works. Use the known real length, not the drawn value.'",
    "'Nhập số thập phân bất kỳ. Dùng độ dài thực đã biết, không phải số đo trên bản vẽ.'",
  ],
  [
    '`Image will scale ${formatNumber(pendingReferenceImageScaleFactor, 3)}x from the first point.`',
    "`Ảnh sẽ co giãn ${formatNumber(pendingReferenceImageScaleFactor, 3).replace('.', ',')} lần tính từ điểm đầu.`",
  ],
  ["'Enter a length greater than 0.'", "'Nhập độ dài lớn hơn 0.'"],
  ["'Enter the real length of the line.'", "'Nhập độ dài thực của đoạn.'"],
  ['`Enter a length like 3.5, 180cm or 5\'11".`', '`Nhập độ dài dạng 3.5, 180cm hoặc 5\'11".`'],
  ["'Length must be greater than 0.'", "'Độ dài phải lớn hơn 0.'"],
  ['\n                Cancel\n              </button>\n              <button\n                className="h-8 rounded-lg bg-foreground', '\n                Huỷ\n              </button>\n              <button\n                className="h-8 rounded-lg bg-foreground'],
  ['\n                Save Scale\n', '\n                Áp dụng tỉ lệ\n'],
);
