# Kiến trúc Frontend: Hệ thống Số hóa Bản vẽ 2D sang 3D

## 1. Cây thư mục (Directory Structure)
Cấu trúc dự án được tổ chức nghiêm ngặt như sau, không được phép tạo thư mục ngoài danh sách này:

```text
src/
├── styles/         # Chứa tokens.css, globals.css, focus.css
├── lib/            # Logic thuần không chứa React. geometry/, rules/, format.ts, v.v.
├── types/          # Định nghĩa kiểu dữ liệu TS (spatial.ts, project.ts, pipeline.ts)
├── mocks/          # Dữ liệu giả lập chuẩn (48 tường, 21 đối tượng, v.v.)
├── store/          # Zustand store slices (projectSlice, spatialSlice, uiSlice, v.v.)
├── hooks/          # React hooks tùy chỉnh chứa logic giao diện (useCanvasViewport, useTheme, v.v.)
├── components/     # Components UI
│   ├── ui/         # Components nguyên thủy (nhập liệu, hiển thị dữ liệu)
│   ├── overlay/    # Modal, drawer, command palette
│   ├── shell/      # Khung ứng dụng, panel, breadcrumb, status bar
│   ├── canvas/     # Nguyên liệu vẽ 2D/3D
│   └── feedback/   # Toast, skeleton, empty, alert, stepper, progress
├── screens/        # Các màn hình chính (auth, dashboard, project, 3d viewer, qc, v.v.)
├── i18n/           # File ngôn ngữ (vi.json)
└── routes.tsx      # Bản đồ định tuyến chính
```

## 2. Luật Import Một Chiều (One-way Data Flow)
Để đảm bảo logic không bị lẫn vào giao diện, luồng phụ thuộc phải đi từ trên xuống dưới (hoặc từ ngoài vào trong):

`screens → components → hooks → store → lib → types`

- **screens** được phép import mọi lớp dưới.
- **components** được import hooks, lib, types; KHÔNG được import screens.
- **hooks** được import store, lib, types; KHÔNG import components hoặc screens.
- **store** được import lib, types; KHÔNG import hooks, components, screens.
- **lib** chỉ được import types. TUYỆT ĐỐI không import React.
- **types** không import gì.

*(Luật này được cưỡng chế bằng `eslint-plugin-import` hoặc rule `no-restricted-imports` trong `.eslintrc.cjs` ở mức `error`)*

## 3. Thang Z-Index
Mọi component phải sử dụng thang z-index chuẩn hóa được định nghĩa trong `src/lib/zIndex.ts`. Cấm khai báo z-index rời rạc trong CSS/Tailwind.

| Tầng (Layer) | Z-Index | Mục đích |
| :--- | :--- | :--- |
| canvas | 0 | Không gian vẽ 2D/3D chính |
| canvasOverlay | 10 | Các lớp phủ trên canvas (lưới, thước đo) |
| panel | 20 | Bảng điều khiển công cụ, thuộc tính |
| statusBar | 30 | Thanh trạng thái dưới cùng |
| dropdown | 40 | Menu sổ xuống, select list |
| drawer | 50 | Ngăn kéo trượt từ cạnh bên |
| modal | 60 | Hộp thoại chặn màn hình (chỉ dùng khi tạo/xoá/publish) |
| commandPalette | 70 | Thanh tìm kiếm lệnh (Ctrl+K) |
| toast | 80 | Thông báo hệ thống có thể hoàn tác |
| tooltip | 90 | Chú thích khi hover (luôn nằm trên cùng) |

## 4. Bản Đồ Định Tuyến (Routing Map)
Tất cả route liên quan đến không gian vẽ 2D (canvas) và 3D đều phải được `React.lazy` load.

- `/login`
- `/` (dashboard)
- `/projects/:id/settings`
- `/projects/:id/upload`
- `/projects/:id/pipeline`
- `/projects/:id/scale`
- **Canvas / 2D Routes:**
  - `/projects/:id/floors/:floorId/layers/walls`
  - `/layers/objects`
  - `/layers/dimensions`
  - `/layers/grids`
  - `/floors`
  - `/layers/rooms`
- **3D Route:**
  - `/projects/:id/3d`
- `/projects/:id/rules`
- `/projects/:id/export`
- `/projects/:id/share`
- `/admin/models`
- `/admin/users`
- `/tai-khoan`
- `/billing`
- `/design-system`
- `/design-system/states`
- `*` (404 Not Found)
