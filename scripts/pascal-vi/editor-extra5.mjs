/**
 * Bảng dịch bổ sung (G3, 01/11/2026): tên mặc định của sàn/trần/phòng/cửa, cây Cảnh, chế độ đi bộ,
 * thanh điều khiển Xem trước, Cài đặt (âm thanh, lỗi xuất), command palette, chụp ảnh, chủ đề cảnh,
 * "Tách tường"/"Nối tường", chiều cao đùn. Cùng định dạng `editor.mjs`; chuỗi gốc phải khớp từng byte.
 */
const C = 'editor/src/components/';
const UI = `${C}ui/`;
const TREE = `${UI}sidebar/panels/site-panel/`;
const P = (a, b) => [a, b];

export const EDITOR_EXTRA5_VI = {
  // Tên mặc định khi vẽ mới + tiêu đề bảng
  'nodes/src/slab/tool.tsx': [P('`Slab ${slabCount + 1}`', '`Sàn ${slabCount + 1}`')],
  'nodes/src/ceiling/tool.tsx': [P('`Ceiling ${ceilingCount + 1}`', '`Trần ${ceilingCount + 1}`')],
  'nodes/src/door/tool.tsx': [P('`Door ${doorCount + 1}`', '`Cửa đi ${doorCount + 1}`')],
  'nodes/src/window/tool.tsx': [P('`Window ${windowCount + 1}`', '`Cửa sổ ${windowCount + 1}`')],
  [`${C}tools/zone/zone-tool.tsx`]: [P('`Zone ${zoneCount + 1}`', '`Phòng ${zoneCount + 1}`')],
  [`${C}editor/floorplan-panel.tsx`]: [
    P('`Zone ${zoneCount + 1}`', '`Phòng ${zoneCount + 1}`'),
    P('`Slab ${slabCount + 1}`', '`Sàn ${slabCount + 1}`'),
    P('`Ceiling ${ceilingCount + 1}`', '`Trần ${ceilingCount + 1}`'),
  ],
  'nodes/src/door/panel.tsx': [P("title={node.name || 'Door'}", "title={node.name || 'Cửa đi'}"),
    P("X<sub className=\"ml-[1px] text-[11px] opacity-70\">wall</sub>", 'Cách tường'),
    P('Size is limited to the wall, including clearance for the opening frame.', 'Kích thước bị giới hạn bởi bức tường, đã trừ chỗ cho khung ô trống.'),
    P('Hinges Side', 'Bên bản lề'),
    P('Handle Side', 'Bên tay nắm'),
  ],
  'nodes/src/window/panel.tsx': [P("title={node.name || 'Window'}", "title={node.name || 'Cửa sổ'}"),
    P('Size is limited to the wall, including clearance for the opening frame.', 'Kích thước bị giới hạn bởi bức tường, đã trừ chỗ cho khung ô trống.'),
    P('Col Widths', 'Độ rộng từng cột'),
    P('Row Heights', 'Độ cao từng hàng'),
  ],
  'nodes/src/slab/panel.tsx': [
    P("title={node.name || 'Slab'}", "title={node.name || 'Sàn'}"),
    P("label: 'Sunken (15cm)'", "label: 'Hạ thấp (15 cm)'"),
    P("label: 'Thin (2cm)'", "label: 'Mỏng (2 cm)'"),
    P("label: 'Standard (5cm)'", "label: 'Chuẩn (5 cm)'"),
    P("label: 'Thick (15cm)'", "label: 'Dày (15 cm)'"),
    P('Extends the perimeter down to terrain. The flat surface, base, and thickness stay\n                unchanged.', 'Kéo phần viền xuống tới mặt đất. Mặt phẳng, đáy và độ dày giữ nguyên.'),
  ],
  'nodes/src/ceiling/panel.tsx': [
    P("title={node.name || 'Ceiling'}", "title={node.name || 'Trần'}"),
    P("label: 'Low (2.4m)'", "label: 'Thấp (2,4 m)'"),
    P("label: 'Standard (2.5m)'", "label: 'Chuẩn (2,5 m)'"),
    P("label: 'High (3.0m)'", "label: 'Cao (3,0 m)'"),
  ],
  'nodes/src/zone/quantities-panel.tsx': [
    P('Zone boundary unavailable', 'Chưa có đường bao phòng'),
    P('aria-label="Top view with zone edge dimensions"', 'aria-label="Nhìn từ trên, kèm kích thước các cạnh phòng"'),
  ],
  'nodes/src/spawn/tool.tsx': [P("name: 'Spawn Point'", "name: 'Điểm xuất phát'")],
  'nodes/src/site/panel.tsx': [
    P('<option value="0">none</option>', '<option value="0">không</option>'),
    P('every 6 in', 'mỗi 15 cm'),
    P('every 12 in', 'mỗi 30 cm'),
    P('every 24 in', 'mỗi 60 cm'),
    P('Show the contour lines in 3D', 'Hiện đường đồng mức trong 3D'),
    P('Auto — most north-facing edge', 'Tự động: cạnh hướng bắc nhất'),
  ],
  // Cây Cảnh
  [`${TREE}slab-tree-node.tsx`]: [P('`Slab (${', '`Sàn (${')],
  [`${TREE}ceiling-tree-node.tsx`]: [P('`Ceiling (${', '`Trần (${')],
  [`${TREE}zone-tree-node.tsx`]: [P('`Zone (${', '`Phòng (${')],
  [`${TREE}roof-tree-node.tsx`]: [
    P("`Roof (${segmentCount} segment${segmentCount !== 1 ? 's' : ''})`", '`Mái (${segmentCount} mảng)`'),
  ],
  [`${TREE}unit-tree-node.tsx`]: [P("{zone.name || 'Zone'}", "{zone.name || 'Phòng'}")],
  // Tường
  'nodes/src/wall/actions.tsx': [
    P('aria-label="Split wall"\n      title="Split wall"', 'aria-label="Tách tường"\n      title="Tách tường"'),
    P("'These walls cannot be merged.'", "'Không nối được các tường này.'"),
    P('aria-label="Merge walls"', 'aria-label="Nối tường"'),
    P("title={reason ? undefined : 'Merge walls'}", "title={reason ? undefined : 'Nối tường'}"),
  ],
  // Đi bộ
  [`${C}walkthrough-hud.tsx`]: [
    P('      to exit\n', '      để thoát\n'),
    P('>Click</span>', '>Bấm chuột</span>'),
    P('<span>or</span>', '<span>hoặc</span>'),
    P('<span>to resume</span>', '<span>để tiếp tục đi</span>'),
    P('              free cursor\n', '              dùng chuột tự do\n'),
    P('or click to</span>', 'hoặc bấm chuột để</span>'),
  ],
  [`${C}editor/first-person-controls.tsx`]: [
    P(
      'Place a spawn point from the Build tab to control where walkthrough starts.',
      'Chưa có điểm xuất phát: vào tab Dựng, thêm "Điểm xuất phát" để chọn chỗ bắt đầu đi bộ.',
    ),
  ],
  // Xem trước (thanh điều khiển)
  [`${C}viewer/viewer-controls-bar.tsx`]: [
    P("label: 'Full height'", "label: 'Tường đủ cao'"),
    P('alt="Full height"', 'alt="Tường đủ cao"'),
    P("label: 'Cutaway'", "label: 'Cắt lát'"),
    P('alt="Cutaway"', 'alt="Cắt lát"'),
    P("label: 'Low'", "label: 'Tường thấp'"),
    P('alt="Low"', 'alt="Tường thấp"'),
    P("name: 'Solid', detail: 'Flat and fast — no ambient occlusion'", "name: 'Đặc', detail: 'Phẳng và nhanh, không đổ bóng góc'"),
    P("name: 'Rendered', detail: 'Full ambient occlusion'", "name: 'Chi tiết', detail: 'Đổ bóng góc đầy đủ'"),
    P("name: 'Off', detail: 'No edge lines'", "name: 'Tắt', detail: 'Không vẽ đường viền'"),
    P("name: 'Soft', detail: 'Faint outline of major creases'", "name: 'Nhẹ', detail: 'Viền mờ ở các nếp chính'"),
    P("name: 'Strong', detail: 'Crisp, opaque edge lines'", "name: 'Đậm', detail: 'Đường viền sắc nét'"),
    P('label="Visibility"', 'label="Hiển thị"'),
    P('<span>Scans</span>', '<span>Bản quét</span>'),
    P('<span>Guides</span>', '<span>Ảnh tham chiếu</span>'),
    P('label="Display settings"', 'label="Cài đặt hiển thị"'),
    P('<span>Shadows</span>', '<span>Bóng đổ</span>'),
    P('<span>Colors</span>', '<span>Màu sắc</span>'),
    P('<span>Render</span>', '<span>Kiểu hiển thị</span>'),
    P('<span>Theme</span>', '<span>Chủ đề</span>'),
    P('<span>Edges</span>', '<span>Đường viền</span>'),
    P("stacked: 'Stacked',\n  exploded: 'Exploded',\n  solo: 'Solo',", "stacked: 'Xếp chồng',\n  exploded: 'Tách rời',\n  solo: 'Riêng một tầng',"),
    P("`Levels: ${levelMode === 'manual' ? 'Manual' : ", "`Tầng: ${levelMode === 'manual' ? 'Thủ công' : "),
    P('`Walls: ${wallModeConfig', '`Tường: ${wallModeConfig'),
    P("`Walkthrough: ${walkthroughActive ? 'On' : 'Off'}`", "`Đi bộ: ${walkthroughActive ? 'Bật' : 'Tắt'}`"),
    P('label="Orbit left"', 'label="Xoay sang trái"'),
    P('label="Orbit right"', 'label="Xoay sang phải"'),
    P('label="Top view"', 'label="Nhìn từ trên"'),
  ],
  // Chủ đề cảnh
  'viewer/src/lib/scene-themes.ts': [
    P("name: 'Studio'", "name: 'Phòng chụp'"),
    P("name: 'Paper'", "name: 'Giấy'"),
    P("name: 'Sunset'", "name: 'Hoàng hôn'"),
    P("name: 'Overcast'", "name: 'Trời âm u'"),
    P("name: 'Blueprint'", "name: 'Bản vẽ xanh'"),
    P("name: 'Mediterranean'", "name: 'Địa Trung Hải'"),
    P("name: 'Twilight'", "name: 'Chạng vạng'"),
    P("name: 'Night'", "name: 'Ban đêm'"),
    P("name: 'Verdant'", "name: 'Xanh mướt'"),
  ],
  // Cài đặt
  [`${UI}sidebar/panels/settings-panel/audio-settings-dialog.tsx`]: [
    P('          Audio settings\n        </Button>', '          Âm thanh\n        </Button>'),
    P('<DialogTitle>Audio settings</DialogTitle>', '<DialogTitle>Âm thanh</DialogTitle>'),
    P('Adjust volume levels and mute settings', 'Chỉnh âm lượng và tắt tiếng'),
    P('>Master Volume<', '>Âm lượng chung<'),
    P('>Radio Volume<', '>Âm lượng radio<'),
    P('>Sound Effects<', '>Hiệu ứng âm thanh<'),
  ],
  [`${UI}sidebar/panels/settings-panel/index.tsx`]: [
    P("'File could not be parsed as JSON.'", "'Không đọc được tệp này (không phải JSON hợp lệ).'"),
    P('`Couldn’t export ${label}. Try again.`', '`Không xuất được ${label}. Thử lại nhé.`'),
    P("`Couldn’t export the floor plan. ${error instanceof Error ? error.message : 'Try again.'}`", "`Không xuất được mặt bằng. ${error instanceof Error ? error.message : 'Thử lại nhé.'}`"),
  ],
  // Command palette
  [`${UI}command-palette/index.tsx`]: [
    P('heading="Wall Mode"', 'heading="Chế độ tường"'),
    P('heading="Level Mode"', 'heading="Chế độ tầng"'),
    P('heading="Go to Level"', 'heading="Đi tới tầng"'),
    P('heading="Rename Level"', 'heading="Đổi tên tầng"'),
    P('Type a new name above…', 'Gõ tên mới ở ô phía trên…'),
  ],
  // Chụp ảnh
  [`${C}editor/snapshot-capture-overlay.tsx`]: [
    P('aria-label="Close capture mode"', 'aria-label="Đóng chế độ chụp ảnh"'),
    P('aria-label="Field of view"', 'aria-label="Góc nhìn"'),
    P('aria-label="Reset field of view"', 'aria-label="Đặt lại góc nhìn"'),
  ],
  // Chiều cao khối của thước đo
  'nodes/src/measurement/tool.tsx': [P('Extrusion height', 'Chiều cao khối')],
};
