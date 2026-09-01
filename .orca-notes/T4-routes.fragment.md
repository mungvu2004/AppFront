# T4 — mảnh route/i18n cho `ObjectLayerReview`

Mảnh này để T8 gộp tay vào `src/routes/paths.ts`, `src/routes/router.tsx`,
`src/i18n/vi.json`. T4 KHÔNG sửa ba file đó (whitelist chỉ cho phép
`objectLayerTypes.ts`, `objectLayerFixture.ts`, file này).

Route: `/du-an/:projectId/tang/:floorId/lop/doi-tuong` của đặc tả gốc → theo
QĐ-1, dùng đường dẫn tiếng Anh, đúng khuôn `projectWalls`.

---

## 1. Thêm vào `ROUTE_PATTERNS` (`src/routes/paths.ts`)

Chèn theo thứ tự bảng chữ cái, ngay dưới dòng `projectExport` (trước
`projectPipeline`), đúng khuôn `projectWalls` (dòng 72):

```ts
projectObjects: `${PROJECTS_ROOT}/:id/floors/:floorId/layers/objects`,
```

## 2. Thêm vào `ROUTES.project` (`src/routes/paths.ts`)

Chèn vào khối `project: { ... }`, đúng khuôn `walls` (dòng 112-113):

```ts
objects: (projectId: string, floorId: string): string =>
  `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${LAYERS_ROOT}/objects`,
```

## 3. Thêm vào `src/routes/router.tsx`

Một dòng lazy-import, đúng khuôn `RouteWallLayerReview` (dòng 33):

```ts
const RouteObjectLayerReview = lazy(() => import('../screens/qc/ObjectLayerReview').then(m => ({ default: m.ObjectLayerReviewRoute })));
```

Và một dòng route trong mảng `router` của `createBrowserRouter`, ngay dưới
dòng `ROUTE_PATTERNS.projectWalls` (dòng 84):

```ts
{ path: ROUTE_PATTERNS.projectObjects, element: suspended(<RouteObjectLayerReview />) },
```

**Ghi chú:** `ROUTE_PATTERNS.layerObjects` (đã có sẵn, dòng 55 của
`paths.ts`) hiện trỏ tới `<RouteCanvas />` — tức `<Placeholder name="Canvas" />`
— ở dòng 85 của `router.tsx`. Đó là một hằng số KHÁC `projectObjects` (không
có `:id`/`:floorId`, dùng cho bốn route lớp chưa xong khác: dimensions,
grids, rooms, floors). T8 KHÔNG cần đụng tới `layerObjects`/dòng 85 khi gắn
route này — mảnh trên tạo một khoá `projectObjects` MỚI, riêng, đi kèm route
mới, đúng khuôn `projectWalls`/`layerObjects` đã tách nhau từ trước. Việc
giảm số `<Placeholder>` từ 11 xuống 10 (R-66) đến từ chính route mới này
(`projectObjects` không còn là placeholder), không phải từ việc sửa route
`layerObjects` có sẵn.

Export `ObjectLayerReviewRoute` từ `index.ts` của thư mục màn là việc của T8
(T8 sở hữu `index.ts`), theo đúng khuôn `WallLayerReviewRoute` của
`screens/qc/WallLayerReview`.

---

## 4. Khoá i18n cần thêm vào `src/i18n/vi.json`

Chuỗi lấy nguyên văn, có dấu, từ `.orca-notes/S13-SPEC-GOC.md` (Phần IV).
Tên khoá gợi ý theo khuôn namespace màn — T8 tự đặt khoá cuối cùng, đây là
nội dung chuỗi phải khớp:

| Khoá gợi ý | Chuỗi tiếng Việt (nguyên văn, có dấu) |
|---|---|
| `objectLayerReview.title` | `lớp đối tượng` |
| `objectLayerReview.reviewCounter` | `9/21 đối tượng đã duyệt` |
| `objectLayerReview.layer.door` | `cửa đi` |
| `objectLayerReview.layer.window` | `cửa sổ` |
| `objectLayerReview.layer.furniture` | `nội thất` |
| `objectLayerReview.layerTreeTotal` | `tổng 21 đối tượng` |
| `objectLayerReview.subtype.singleDoor` | `cửa đơn` |
| `objectLayerReview.subtype.doubleDoor` | `cửa đôi` |
| `objectLayerReview.subtype.window` | `cửa sổ` |
| `objectLayerReview.subtype.bed` | `giường` |
| `objectLayerReview.subtype.sofa` | `sofa` |
| `objectLayerReview.subtype.diningTable` | `bàn ăn` |
| `objectLayerReview.subtype.toilet` | `bồn cầu` |
| `objectLayerReview.subtype.basin` | `chậu rửa` |
| `objectLayerReview.inspector.title` | `Đối tượng` |
| `objectLayerReview.field.width` | `chiều rộng` |
| `objectLayerReview.field.height` | `chiều cao` |
| `objectLayerReview.field.hostWall` | `tường chứa nó` |
| `objectLayerReview.field.position` | `vị trí trên tường` |
| `objectLayerReview.field.swing` | `hướng mở` |
| `objectLayerReview.field.confidence` | `độ tin cậy` |
| `objectLayerReview.field.sillHeight` | `cao độ bệ cửa` |
| `objectLayerReview.badge.unattached` | `Chưa gắn vào tường nào` |
| `objectLayerReview.action.attachNearest` | `Gắn vào tường gần nhất` |
| `objectLayerReview.empty.title` | `chưa nhận ra đối tượng nào` |
| `objectLayerReview.empty.explanation` | `nhận diện nội thất phụ thuộc kiểu vẽ của bản gốc, nên bản vẽ ít ký hiệu quy ước có thể không ra kết quả nào.` |
| `objectLayerReview.empty.action` | `thêm thủ công` |
| `objectLayerReview.partial.notice` | `5 mục dưới ngưỡng tin cậy, đã lọc sẵn` |
| `objectLayerReview.partial.furnitureAttention` | `nhận diện nội thất lỗi, cửa vẫn xong` |
| `objectLayerReview.success` | `21/21 đối tượng đã duyệt` |
| `objectLayerReview.forbidden` | `bạn không có quyền xem lớp đối tượng của dự án này` |

Đơn vị hiển thị dùng lại định dạng chung `P-01` (`"900 × 2.200 mm"`, dấu
thập phân là dấu phẩy) — không phải khoá i18n riêng, đã có sẵn ở tầng
`src/lib/format`.
