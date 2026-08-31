# Mảnh route cho T8 — màn Duyệt lớp tường (`WallLayerReview`)

File này KHÔNG được T8 import — nó chỉ là ghi chú cho người/worker gộp route thật vào
`src/routes/paths.ts` và `src/routes/router.tsx`. Worker L1 (task này) không chạm hai
file đó (whitelist của task chỉ cho phép sửa các file trong
`src/screens/qc/WallLayerReview/`).

## Xác minh `src/routes.tsx` không còn tồn tại

Đặc tả gốc ghi "cập nhật `src/routes.tsx`". File đó KHÔNG CÒN TỒN TẠI. Đã xác minh bằng:

```
$ ls src/routes/
index.ts
paths.ts
router.tsx
```

Nay `src/routes/` là một thư mục ba file: `paths.ts` (lá, không import gì) ·
`router.tsx` (router thật, lazy-import mọi màn) · `index.ts` (gom `export { ROUTES,
ROUTE_PATTERNS } from './paths'; export { router } from './router';`). Xem R-65 của
`LUAT_MAN_HINH.md:144-162` — đây là quyết định đã ghi ngày 21-08-2026, sau khi gộp trực
tiếp vào `src/routes.tsx` (một file) từng tạo ba điểm vòng import mà `pnpm cycles` bắt
được.

## TIN TỐT: hằng đường dẫn và route đã có sẵn — không cần thêm hằng mới

Khác với giả định "tự đề xuất một hằng đường dẫn mới" — `src/routes/paths.ts` đã có
đúng cặp cần dùng, không cần thêm gì vào `ROUTE_PATTERNS`/`ROUTES`:

```ts
// src/routes/paths.ts — ĐÃ CÓ, dòng 72
projectWalls: `${PROJECTS_ROOT}/:id/floors/:floorId/layers/walls`,
// tức '/projects/:id/floors/:floorId/layers/walls'

// src/routes/paths.ts — ĐÃ CÓ, dòng 112-113
walls: (projectId: string, floorId: string): string =>
  `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/walls`,
```

Mẫu đường dẫn thật là **`/projects/:id/floors/:floorId/layers/walls`** — tiếng Anh,
KHÔNG phải `/du-an/:projectId/tang/:floorId/lop/tuong` như đặc tả gốc gợi ý. Toàn bộ
`ROUTE_PATTERNS` hiện tại dùng tiếng Anh (`/projects`, `/floors`, `/layers`…); ngoại lệ
DUY NHẤT là `account: '/tai-khoan'`, có ghi chú riêng ngay tại chỗ khai báo giải thích vì
sao (đường dẫn cài đặt tài khoản là thứ người dùng gõ/đọc). Không có lý do tương tự cho
màn QC nội bộ này, nên **giữ nguyên `projectWalls`/`ROUTES.project.walls`, đừng thêm một
hằng tiếng Việt song song** — hai hằng cùng trỏ một màn là nguồn lệch chắc chắn sẽ xảy
ra.

Trong hook (`useWallLayerReview.ts`), lấy `projectId`/`floorId` từ props rồi build URL nếu
cần bằng `ROUTES.project.walls(projectId, floorId)` — nhập từ `@/routes/paths`, KHÔNG
phải `@/routes` (xem cảnh báo R-65 bên dưới).

## Route đã có trong `router.tsx` — CHỈ CẦN THAY MỘT DÒNG, không thêm route mới

`src/routes/router.tsx` dòng 83 (trong mảng `createBrowserRouter([...])`):

```tsx
{ path: ROUTE_PATTERNS.projectWalls, element: <RouteCanvas /> },
```

`RouteCanvas` là lazy component đặt ở dòng 19:

```tsx
const RouteCanvas = lazy(() => Promise.resolve({ default: () => <Placeholder name="Canvas" /> }));
```

### `<Placeholder>` cần xoá: `name="Canvas"`, dùng qua biến `RouteCanvas`

Không có `<Placeholder name="WallLayerReview">` hay tương tự — placeholder của route này
là generic, tên `"Canvas"`, và được DÙNG CHUNG cho NĂM route khác nhau (dòng 83-88):

```tsx
{ path: ROUTE_PATTERNS.projectWalls, element: <RouteCanvas /> },     // ← ĐÂY, đổi dòng này
{ path: ROUTE_PATTERNS.layerObjects, element: <RouteCanvas /> },     // giữ nguyên
{ path: ROUTE_PATTERNS.layerDimensions, element: <RouteCanvas /> },  // giữ nguyên
{ path: ROUTE_PATTERNS.layerGrids, element: <RouteCanvas /> },       // giữ nguyên
{ path: ROUTE_PATTERNS.floors, element: <RouteCanvas /> },           // giữ nguyên
{ path: ROUTE_PATTERNS.layerRooms, element: <RouteCanvas /> },       // giữ nguyên
```

**CẢNH BÁO QUAN TRỌNG:** T8 chỉ được đổi DÒNG `projectWalls`. Bốn dòng còn lại
(`layerObjects`, `layerDimensions`, `layerGrids`, `floors`, `layerRooms`) PHẢI tiếp tục
dùng `<RouteCanvas />` — chúng chưa có màn thật, xoá `RouteCanvas` hẳn hoặc đổi luôn cả
năm dòng là phá năm route khác ngoài phạm vi của task này.

### Việc T8 cần làm (mẫu, theo đúng khuôn năm route thật khác trong cùng file)

1. Thêm MỘT lazy import mới, đặt cạnh các `RouteXxx` khác (dòng 20-32), trỏ tới container
   thật của màn thay vì tới `App`/`ProjectDashboard` như các dòng mẫu dưới đây:

   ```tsx
   const RouteWallLayerReview = lazy(() =>
     import('../screens/qc/WallLayerReview').then((m) => ({ default: m.WallLayerReviewRoute })),
   );
   ```

   (Tên xuất `WallLayerReviewRoute` là GIẢ ĐỊNH theo khuôn `ShareRoute`/`AuthRoute`/
   `ProjectDashboardRoute` mà các dòng khác trong file đang dùng — người viết container
   L2 xác nhận lại tên xuất thật của `index.ts` trước khi T8 gộp.)

2. Đổi ĐÚNG một dòng, từ:

   ```tsx
   { path: ROUTE_PATTERNS.projectWalls, element: <RouteCanvas /> },
   ```

   thành:

   ```tsx
   { path: ROUTE_PATTERNS.projectWalls, element: suspended(<RouteWallLayerReview />) },
   ```

   Dùng `suspended(...)` (helper đã có ở dòng 13-15 của `router.tsx`) chứ không phải
   JSX trần — đúng khuôn mọi route màn thật khác trong file (`RouteShare`, `RouteAuth`,
   `RouteDashboard`…). Năm dòng `<RouteCanvas />` còn lại KHÔNG dùng `suspended(...)`,
   đừng bắt chước chúng.

## CẢNH BÁO R-65 — vòng import nếu đặt hằng sai chỗ

`LUAT_MAN_HINH.md` R-65 nhắc lại nguyên do thư mục `src/routes/` bị tách làm hai: màn
nhập `@/routes/paths` (lá, không import gì); phần vỏ (router, `main.tsx`, `App.tsx`)
nhập `@/routes` (tức `router.tsx`, thứ lazy-import mọi màn). Nếu `useWallLayerReview.ts`
hay bất kỳ file nào trong `src/screens/qc/WallLayerReview/` nhập từ `@/routes` (thay vì
`@/routes/paths`), `router.tsx` → màn → `router.tsx` khép thành vòng và `pnpm cycles`
(bước riêng trong `pnpm verify`, tách khỏi `pnpm lint` vì chạy chậm trên 500+ file) sẽ đỏ.
Vì `projectWalls`/`ROUTES.project.walls` đã có sẵn ở `paths.ts`, không ai trong màn này
có lý do gì để nhập `@/routes` cả — chỉ cần nhớ import đúng từ `@/routes/paths`.
