/**
 * Bảng dịch chuỗi giao diện của gói `@pascal-app/editor` (G5-03, G5-15).
 * Khoá: đường dẫn tệp tính từ `vendor/pascal/packages/`. Giá trị: cặp
 * `[chuỗi gốc đúng từng byte, chuỗi Việt]`. Chuỗi gốc kèm ngữ cảnh (`>`, `title="`…)
 * để không trúng tên biến. Nguồn tiếng Việt: bảng cũ ở `git show 1548e9a2^`.
 */
export const EDITOR_VI = {
  'editor/src/components/ui/sidebar/panels/settings-panel/index.tsx': [
    ['uppercase">Floors</label>', 'uppercase">Các tầng</label>'],
    ['\n          Add floor\n', '\n          Thêm tầng\n'],
    ['\n          Add basement\n', '\n          Thêm tầng hầm\n'],
    ['>No floors yet<', '>Chưa có tầng nào<'],
    ["'Remove floor' : 'The ground floor cannot be removed'", "'Xoá tầng' : 'Không thể xoá tầng trệt'"],
    [
      'Select a floor to make it active. The ground floor is always kept as the building datum.',
      'Chọn một tầng để kích hoạt. Tầng trệt luôn được giữ làm mốc của toà nhà.',
    ],
    [
      'description="Reference this project from the API, MCP tools, or support."',
      'description="Tham chiếu dự án này từ API, công cụ MCP hoặc bộ phận hỗ trợ."',
    ],
    ['title="Project"', 'title="Dự án"'],
    ['aria-label="Project ID"', 'aria-label="Mã dự án"'],
    ['description="Control who can open this project." title="Sharing"', 'description="Quản lý ai được mở dự án này." title="Chia sẻ"'],
    ['label="Public project"', 'label="Dự án công khai"'],
    ['description="Visible in the public viewer."', 'description="Hiện trong trình xem công khai."'],
    ['label="Show 3D scans"', 'label="Hiện bản quét 3D"'],
    ['label="Show floor plans"', 'label="Hiện mặt bằng"'],
    [
      'description="Rendering options for this editor session." title="Viewer"',
      'description="Tuỳ chọn hiển thị cho phiên làm việc này." title="Trình xem"',
    ],
    ['description="Cast shadows from lights."', 'description="Đổ bóng từ đèn."'],
    ['label="Shadows"', 'label="Đổ bóng"'],
    [
      'description="Download the scene or hand it to another app." title="Export"',
      'description="Tải cảnh xuống hoặc gửi sang ứng dụng khác." title="Xuất"',
    ],
    ['\n                Export options\n', '\n                Tuỳ chọn xuất\n'],
    ['\n                      Visible nodes only\n', '\n                      Chỉ phần đang hiện\n'],
    [
      'Exclude hidden furniture and other hidden scene nodes',
      'Bỏ qua đồ vật ẩn và các phần ẩn khác của cảnh',
    ],
    ['aria-label="Export visible nodes only"', 'aria-label="Chỉ xuất phần đang hiện"'],
    ['>Include in file<', '>Gồm trong tệp<'],
    ['No optional procedural content is present.', 'Không có nội dung tạo sinh tuỳ chọn nào.'],
    [
      'Viewer surroundings are excluded unless selected separately below.',
      'Bối cảnh trình xem bị bỏ qua trừ khi được chọn riêng ở dưới.',
    ],
    ['>Viewer surroundings<', '>Bối cảnh trình xem<'],
    ['<SettingsSubheading>Floor plan</SettingsSubheading>', '<SettingsSubheading>Mặt bằng</SettingsSubheading>'],
    ['\n                Full floor plan\n', '\n                Mặt bằng đầy đủ\n'],
    ['\n                Structure only\n', '\n                Chỉ kết cấu\n'],
    [
      'description="Refresh the preview shown in your project list."',
      'description="Làm mới ảnh xem trước trong danh sách dự án."',
    ],
    ['title="Thumbnail"', 'title="Ảnh thu nhỏ"'],
    [
      'description="Keep a JSON copy of the scene, or restore one."',
      'description="Giữ một bản JSON của cảnh hoặc khôi phục từ bản đó."',
    ],
    ['title="Save and load"', 'title="Lưu và nạp"'
    ],
    ['\n              Save build\n', '\n              Lưu bản dựng\n'],
    ['\n              Load build\n', '\n              Nạp bản dựng\n'],
    [
      'description="Sound levels and keyboard shortcuts." title="Preferences"',
      'description="Âm lượng và phím tắt." title="Tuỳ chọn"',
    ],
    [
      'description="Inspect how nodes are nested in this scene."',
      'description="Xem các phần trong cảnh lồng nhau thế nào."',
    ],
    ['title="Scene graph"', 'title="Cây cảnh"'],
    ['\n                  Explore scene graph\n', '\n                  Mở cây cảnh\n'],
    [
      'description="Removes every node from this scene. This cannot be undone."',
      'description="Xoá mọi phần khỏi cảnh này. Không thể hoàn tác."',
    ],
    ['title="Danger zone"', 'title="Vùng nguy hiểm"'],
    ['\n              Clear and start new\n', '\n              Xoá hết và làm lại\n'],
  ],
  'editor/src/components/viewer/viewer-scene-header.tsx': [
    ["return 'Wall'", "return 'Tường'"],
    ["return 'Fence'", "return 'Hàng rào'"],
    ["|| 'Item'", "|| 'Đồ vật'"],
    ["return 'Slab'", "return 'Sàn'"],
    ["return 'Ceiling'", "return 'Trần'"],
    ["return 'Roof'", "return 'Mái'"],
    ["return 'Roof Segment'", "return 'Mảng mái'"],
    ['aria-label="Back"', 'aria-label="Quay lại"'],
    ["{projectName || 'Untitled'}", "{projectName || 'Chưa đặt tên'}"],
    ['\n                Site\n', '\n                Khu đất\n'],
    ["{building.name || 'Building'}", "{building.name || 'Toà nhà'}"],
    ['\n            Levels\n', '\n            Tầng\n'],
  ],
  'editor/src/components/ui/floating-level-selector.tsx': [
    ['title="Drag to reorder"', 'title="Kéo để đổi thứ tự"'],
    ['title="Focused unit has zones here"', 'title="Căn hộ đang chọn có vùng ở tầng này"'],
    ['title="Level height"', 'title="Chiều cao tầng"'],
    ['label="Level height"', 'label="Chiều cao tầng"'],
    ['\n                Duplicate level\n', '\n                Nhân bản tầng\n'],
    ['\n                Duplicate with options...\n', '\n                Nhân bản có tuỳ chọn…\n'],
    ['\n                  Paste copied selection\n', '\n                  Dán phần đã sao chép\n'],
    ["'Delete level' : 'The ground level cannot be deleted'", "'Xoá tầng' : 'Không thể xoá tầng trệt'"],
    ['\n                Delete level\n', '\n                Xoá tầng\n'],
    ['<DialogTitle>Delete level</DialogTitle>', '<DialogTitle>Xoá tầng</DialogTitle>'],
    ['aria-label="Exit unit focus"', 'aria-label="Thoát chế độ xem căn hộ"'],
    ['title="Exit unit focus"', 'title="Thoát chế độ xem căn hộ"'],
    ['title="Add level above"', 'title="Thêm tầng phía trên"'],
    ['title="Add level below"', 'title="Thêm tầng phía dưới"'],
    ['title="Insert level here"', 'title="Chèn tầng ở đây"'],
  ],
};
