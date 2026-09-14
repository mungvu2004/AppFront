# BÁO CÁO ĐỐI CHIẾU — mã nguồn ↔ bộ prompt v2.3 ↔ đặc tả nghiên cứu

Đo ngày **2026-09-14**, trên `master` (`f13dbb2`). Ba nguồn được đối chiếu:

| Nguồn | Vai trò |
|---|---|
| `BO-PROMPT-FE-HOP-NHAT-v2.3 (1).html` | Bản prompt mới nhất — 56 prompt, thêm mục 0.7 → 0.10 và CL-08 |
| `BO-PROMPT-FE-HOP-NHAT-v2.md` | v2.0, **đã bị v2.3 thay thế**. Chỉ dùng tra ngược |
| `HỆ THỐNG SỐ HÓA TỰ ĐỘNG BẢN VẼ KỸ THUẬT 2D…​.md` | Đặc tả nghiên cứu — pipeline AI phía sau và hợp đồng **Spatial JSON** |

> **Ghi chú phương pháp đo.** Mọi con số trong báo cáo này là **đầu ra của chính lệnh ghi ở
> cột "Kiểm bằng"**, không phải một phép đo song song — đúng bài học mà `BAO_CAO_DO_LECH.md`
> rút ra sau khi chín con số của nó lệch ở lần đo thứ nhất. Mục nào chưa chạy thì ghi **"chưa
> chạy"**, không ghi "đạt" (mục E.10 của `CLAUDE.md`, `scripts/verify.mjs:14`).
>
> Mọi con số trong mục 0 đến mục 5 là ảnh chụp **trước** khi lượt này sửa gì — đó là ích lợi
> của một báo cáo đối chiếu, nên chúng cố ý không được cập nhật sau đó. Những gì lượt này đã
> làm nằm ở **mục 6b**, và chỉ ở đó.

---

## 0. Kết luận một dòng

Mục 0.2 của v2.3 mô tả dự án đang ở *chặng 3 — nền giao diện*, tức **chưa dựng màn nào**.
Thực tế **45/47 màn đã có mã, đủ sáu file, đủ story, đủ test, và 47 route đã gắn**. Tài liệu
đang lên kế hoạch cho công việc đã làm gần xong.

Vì vậy việc cần làm không phải "chạy 56 prompt", mà là đóng **hai lỗ thật** (một lỗ hợp đồng
dữ liệu, một lỗ hai màn) rồi **sửa tài liệu cho khớp mã**.

### Số đo nền

| Hạng mục | Số | Kiểm bằng |
|---|---:|---|
| File `.ts`/`.tsx` trong `src` | 1.294 | `find src \( -name "*.ts" -o -name "*.tsx" \) -type f \| wc -l` |
| Dòng trong `src` | 371.930 | `find … -exec cat {} + \| wc -l` |
| Thư mục màn trong `src/screens` | 47 | `find src/screens -mindepth 2 -maxdepth 2 -type d \| wc -l` |
| Màn thuộc bộ 47 của đặc tả | **45** | so tên thư mục với bảng 0.5 |
| Route đăng ký | 47 | `grep -c "path:" src/routes/router.tsx` |
| Component thật trong `src/components` | 52 | `find src/components -name "*.tsx" ! -name "*.stories.tsx" ! -name "*.test.tsx" \| wc -l` |
| File `.stories.tsx` | 97 | `find src -name "*.stories.tsx" \| wc -l` |
| Tên story có kiểu `Story` (màn) | 359 | `grep -rhoE "^export const \w+: *Story" src/screens --include=*.stories.tsx \| wc -l` |
| Khoá cấp một trong `vi.json` | 50 | đọc JSON |
| Token màu khai trong `globals.css` | 57 custom property | `grep -o -- "--[a-z0-9-]*:" src/styles/globals.css \| sort -u \| wc -l` |

---

## 1. BẢNG ĐỘ LỆCH

**Nghiêm trọng:** Cao = lỗi thật hoặc lỗ hổng bất biến · Trung bình = sẽ thành lỗi khi mã lớn
thêm · Thấp = nhất quán. **Chi phí:** Thấp = dưới 1 giờ · Trung bình = dưới một ngày · Cao =
phải tái cấu trúc.

| Mã | Độ lệch | Số chỗ | Nghiêm trọng | Chi phí | Đề xuất |
|---|---|---:|---|---|---|
| **Đ1** | Spatial JSON từ backend không đi qua `zod` | 4 thực thể (Wall · Opening · Room · Furniture) | **Cao** | Trung bình | sửa — GĐ 2 |
| **Đ2** | Hai hệ kiểu Spatial song song, khác đơn vị | 2 hệ | **Cao** | Trung bình | chốt một nguồn — GĐ 2 |
| **Đ3** | Hai màn của bộ 47 chưa tồn tại | 2 / 47 | **Cao** | Cao | dựng — GĐ 3 |
| **Đ4** | `/projects/:id/share` trỏ màn cũ, không phải S-35 | 1 route | Trung bình | Thấp | sửa — GĐ 4 |
| **Đ5** | Bảng route 0.8 ≠ `paths.ts` | 22 / 26 dòng | Trung bình | Cao nếu theo tài liệu | **sửa tài liệu** |
| **Đ6** | S-47 StateGallery chỉ có ở bản dev | 1 route | Trung bình | Thấp | quyết định — GĐ 4 |
| **Đ7** | CL-08: 9/10 component thiếu khỏi thư viện | 9 | Trung bình | Cao | dựng 1, ghi nợ 6, bỏ 2 |
| **Đ8** | `src/theme/tokens.ts` chưa bao giờ tồn tại; 10/41 token DS-00 thiếu | 10 | Thấp | Thấp | **sửa tài liệu** |
| **Đ9** | `vi.json` 50 nhánh phẳng ≠ 15 nhánh gom của bảng 0.9 | 50 ↔ 15 | Thấp | Trung bình | **sửa tài liệu** |
| **Đ10** | Thang chuyển động: ba tài liệu nói ba kiểu | 3 nguồn | Thấp | Thấp | **sửa tài liệu** |
| **Đ11** | Bộ số mẫu chuẩn: ba nguồn, ba bộ số | 3 nguồn | Trung bình | Thấp | đo lại rồi chốt |
| **Đ12** | Manifest StateGallery báo 329/329 trên một danh sách **không phải** bộ 47 | 2 dòng sai | Trung bình | Thấp | sửa manifest — GĐ 3 |

---

### Đ1 — Spatial JSON từ backend không đi qua `zod`

**Kiểm bằng:** đọc `src/api/client.ts`, `src/api/schemas/`.

Đặc tả nghiên cứu (Phần IV) định nghĩa Spatial JSON là **đầu ra chính thức** của cả hệ
thống. `src/api` có tầng `zod` thật — `schemas/{users,notifications,quality,library}.ts` giải
mã qua `schemas/decode.ts`, báo lỗi tiếng Việt, có ngưỡng bỏ qua phần tử hỏng tối đa 20%.

**Nhưng không có schema nào cho `Wall`, `Opening`, `Room`, `Furniture`, `SpatialGraph`.**
`spatial.readFloor` chỉ giải mã `FloorSchema` (siêu dữ liệu tầng); lớp hình học đi thẳng,
không kiểm. Chính mã thừa nhận, `src/api/client.ts` ~843-849:

> *"this file has no wire-schema vocabulary for `Wall`/`Opening`/`Room`/`Furniture` to
> validate it against — building one is future work"*

`RULE.md` R-08 nói dữ liệu ngoài phải qua `zod`.

**Vì sao đây là mục nghiêm trọng nhất trong báo cáo:** ba mô hình AI ở phía sau (SegFormer,
YOLO, PaddleOCR) đều trả về kết quả *xác suất*. Một tầng không dò được, một OCR đọc nhầm
"4800" thành "48OO", một `wall_id` trỏ vào tường đã bị xoá — tất cả đều là đầu ra hợp lệ về
mặt HTTP nhưng hỏng về mặt cấu trúc. Không có schema thì màn không hiện câu lỗi đọc được,
nó vỡ. Đó đúng là thất bại mà bất biến A11 tồn tại để chặn.

`domain/spatial/{normalize,applyPatch,integrity}.ts` **không** lấp chỗ này: chúng định dạng
lại và kiểm bất biến nội bộ của dữ liệu **đã có kiểu TS**, không phải parser cho payload thô.

### Đ2 — Hai hệ kiểu Spatial song song

**Kiểm bằng:** đọc `src/types/spatial.ts` và `src/domain/spatial/types.ts`.

| | `src/types/spatial.ts` | `src/domain/spatial/types.ts` |
|---|---|---|
| Khớp đặc tả nghiên cứu | **gần như 1-1** — `level_id`, `elevation_m`, `position_t`, `area_m2`, `global_anchor` | không — `id`, `elevationMm`, `centreline`, `outline` |
| Đơn vị chiều dài | **mét** cho cao độ tầng | **milimét** cho mọi chiều dài, kiểu có nhãn `Millimetres` |
| Mô hình tường | `{from, to, thickness_mm}` với `thickness_mm` là enum đóng `110\|220\|330\|'CONCRETE_COLUMN'` | `{centreline{start,end}, thicknessMm: number, kind, openingIds}` |
| `vertices` | `Record<string, Point2D>` | không có khái niệm đỉnh riêng — toạ độ nằm trong `centreline` |
| Ai dùng | `src/mocks/spatial.ts` + 3 màn QC đọc thẳng | store, api, domain — **mô hình thật** |

Đo tiếp bằng `grep -rn "types/spatial" src` thì bức tranh sắc hơn "hai hệ song song": file
`src/types/spatial.ts` có **hai nửa số phận khác hẳn nhau**.

| Nửa | Nơi dùng | Kết luận |
|---|---|---|
| `WallThickness` (110 · 220 · 330 · `CONCRETE_COLUMN`) | **chín nơi** — `components/canvas/{materialMap,WallThicknessLegend}`, `hooks/useWallThicknessLegend`, `lib/geometry/standardize`, và bốn màn QC | đang sống, và **nằm sai tầng**: đây là hằng số nghiệp vụ, chỗ của nó là `src/domain/walls` |
| `SpatialProject`, `Geometry`, `Wall`, `Door`, `Window`, `Room`, `Dimension`, `Point2D`, `Level`, `GlobalAnchor`, `ProjectMetadata` | **đúng một** — `src/mocks/spatial.ts` | hợp đồng của đặc tả nghiên cứu hiện chỉ định hình **dữ liệu giả** |

Không một màn, hook hay module `src/lib` nào nhập nửa thứ hai. Chưa có adapter nào nối hai
bên, và trước lượt này không nguồn nào được tuyên bố là đúng.

**Đã làm trong lượt này:** viết khối chú thích vào đầu `src/types/spatial.ts` nói rõ nó là
hình dạng của hợp đồng nghiên cứu chứ không phải mô hình chạy thật, kèm bảng lệch từng
trường và câu "đừng thêm kiểu mới vào file này". **Chưa làm:** viết adapter — xem mục 6.

Bảng đối chiếu đầy đủ từng trường:

| Trường đặc tả | `types/spatial.ts` | `domain/spatial/types.ts` | Kết luận |
|---|---|---|---|
| `project_metadata.project_name` | — | `Building.name` | thiếu ở hệ kiểu dây |
| `scale_ratio_mm_per_px` | khớp tên | `Level.scaleMillimetresPerPixel` (theo **tầng**) | lệch phạm vi: dự án ↔ tầng |
| `levels[].level_id / elevation_m / height_m` | khớp 100%, đơn vị **m** | `id / elevationMm / heightMm`, đơn vị **mm** | lệch tên + lệch đơn vị |
| `global_anchor{axis_intersection,x_offset,y_offset}` | khớp 100% (nhưng nằm ngoài `project_metadata`) | **không có** | domain thiếu khái niệm mỏ neo toàn cục |
| `walls[].from / to / thickness_mm` | khớp tên; `thickness_mm` là enum | `centreline`, `thicknessMm: number` | lệch tên + lệch kiểu |
| `doors[].position_t` | khớp | `relativePosition` / `offsetMm` | lệch tên |
| `windows[].elevation_m` | khớp | `sillHeightMm` | lệch tên + đơn vị |
| `furniture[].type / x,y / rotation_deg` | khớp (nhưng `FurnitureType` lẫn `'door'\|'window'`) | `kind / centre / rotationDeg` | lệch tên |
| `rooms[].label / vertices[] / area_m2` | khớp | `name / outline(toạ độ) / areaM2 / usage` | lệch tên + lệch ngữ nghĩa `vertices` |
| — | `Dimension` | `Dimension`, `Axis` | cả hai hệ có thêm thực thể ngoài đặc tả |

Quy đổi mm ↔ m chỉ được phép đi qua `src/domain/units/types.ts`
(`metresToMillimetres` / `millimetresToMetres`) — R-44.

### Đ3 — Hai màn của bộ 47 chưa tồn tại

**Kiểm bằng:** `grep -ril "SpatialJsonViewer\|ConnectionStates" src` → **rỗng**.

| Màn | Thư mục đặc tả | Route đặc tả | Tầng logic bên dưới |
|---|---|---|---|
| **S-36 SpatialJsonViewer** | `src/screens/export/SpatialJsonViewer/` | `/du-an/:projectId/du-lieu` | ✅ `domain/spatial/{types,normalize,integrity}.ts` — đã `ls`, có thật |
| **S-45 ConnectionStates** | `src/screens/system/ConnectionStates/` | không route (lớp dùng chung) | ✅ `lib/offline/{queueStore,networkMonitor,replayer}.ts` — đã `ls`, có thật |

Đây là điểm **khác** với bài học "đặc tả khai logic không tồn tại": lần này tầng logic đã
được kiểm từng thư mục và có thật, nên hai màn này dựng được mà không phải mở lại tầng dưới.

### Đ4 — `/projects/:id/share` trỏ vào màn cũ, không phải S-35

`export/ShareDialog/` tồn tại đủ sáu file và **đang được dùng** — nhưng chỉ như dialog con
mở từ `ExportPanel.container.tsx:69`. Route `/projects/:id/share` lại trỏ tới
`project/ShareScreen/` + `ShareRoute.tsx` — khuôn hai file cũ mà `LUAT_MAN_HINH.md:63-65`
gọi đích danh là **"nợ đã ghi nhận, không phải mẫu để chép"**.

`ShareScreen` cũng là **màn duy nhất trong toàn repo không đủ sáu file R-59**:

```
project/ShareScreen | index:Y | View:Y | hook:- | container:- | stories:Y | test:Y
```

(44 màn còn lại đủ cả sáu, cộng `viewer/ViewerShell` cũng đủ sáu.)

### Đ5 — Bảng route 0.8 và `src/routes/paths.ts` nói hai thứ khác nhau

`src/routes.tsx` mà bảng 0.8 và R-66 gọi tên **không tồn tại**. Router thật là
`src/routes/router.tsx` + `src/routes/paths.ts` (bảng `ROUTE_PATTERNS` cho router, bảng
`ROUTES` cho `navigate()`).

Đường dẫn thật viết **tiếng Anh**; bảng 0.8 đòi **tiếng Việt**. Khớp 4/26 dòng:

| Bảng 0.8 | Thật | |
|---|---|---|
| `/` · `/onboarding` · `/tai-khoan` · `/khong-co-quyen` | giống hệt | ✅ |
| `/m/du-an/:projectId` | giống hệt — route **duy nhất** đúng cả đường dẫn lẫn tên tham số | ✅ |
| `/dang-nhap` · `/thanh-toan` · `/thu-vien` · `/nguoi-dung` | `/login` · `/billing` · `/admin/models` · `/admin/users` | ❌ |
| `/du-an/:projectId/…` (14 route) | `/projects/**:id**/…` | ❌ đường dẫn **và** tên tham số |
| `.../tang/:floorId/lop/tuong` | `.../floors/:floorId/layers/walls` | ❌ (`:floorId` thì đúng) |
| `/du-an/:projectId/du-lieu` (S-36) | không có | ❌ thiếu hẳn |

Ngoài ra có route mà bảng 0.8 không có chỗ cho — tách làm hai loại:

**Tám route cho màn mà bảng 0.8 ghi "không route"** (chúng là panel/hộp thoại/lớp phủ theo
tài liệu, nhưng mã cho mỗi cái một URL):

```
S-09  /projects/:id/quality                       S-29  /projects/:id/3d/exploded
S-12  /projects/:id/pipeline/graph                S-30  /projects/:id/3d/measure
S-21  /projects/:id/floors/:floorId/layers/thickness   S-35  /projects/:id/share
S-28  /projects/:id/floors/:floorId/overlay       S-41  /thong-bao
```

**Năm route cũ không ứng với dòng nào của bảng 0.8**, đều thiếu ngữ cảnh dự án:
`/layers/objects` · `/layers/dimensions` · `/floors` (ba cái này trỏ `Placeholder`) ·
`/layers/grids` và `/layers/rooms` (trỏ trùng đích với bản có `:id`).

Cộng **tám route chỉ-dev** (nằm trong nhánh `import.meta.env.DEV`): một là màn thật
(`/design-system/states` = S-47) và bảy là trang demo. Bảng 0.8 dự trù chúng dưới tiền tố
`/design-system/*`, nhưng chỉ **hai** thật sự nằm dưới tiền tố đó (`/design-system`,
`/design-system/states`); sáu cái còn lại ở gốc: `/demo`, `/demo/canvas-overlays`,
`/data-entry-demo`, `/list-review-demo`, `/shell-demo`, `/feedback-demo`.

Lỗi L-02 mà mục 0.7 tuyên bố "✅ đã chuẩn hoá `:projectId` và `:floorId`" **chưa từng vào
mã**: mọi route dự án vẫn dùng `:id`.

### Đ6 — S-47 StateGallery chỉ có ở bản dev

`/design-system/states` nằm trong nhánh `import.meta.env.DEV`, bị Vite loại khỏi bản dựng
sản phẩm — cùng với tám trang demo thư viện khác. Mục 8.1 gọi S-47 là *"cổng chất lượng của
cả dự án"*, mà người dùng sản phẩm không với tới nó.

### Đ7 — CL-08: 9/10 component thiếu khỏi thư viện

`src/components/viewer/` **không tồn tại**.

| Tên CL-08 | Trạng thái | Tương đương hiện có |
|---|---|---|
| `viewer/ViewportFrame` | thiếu | `screens/viewer/ViewerShell/ViewerViewport.tsx` |
| `viewer/ViewCube` | thiếu | `ViewerCube` viết inline trong `ViewerOverlays.tsx:42` |
| `viewer/CameraToolbar` | thiếu | `ViewerToolRail` + `ViewerZoomControls` |
| `viewer/FloorRail` | thiếu | `ViewerStoreyRail.tsx:43` |
| `viewer/PerfBadge` | thiếu | `ViewerPerfChip` (`ViewerOverlays.tsx:157`) |
| `viewer/GizmoHud` | thiếu | không có tương đương |
| `viewer/MeasurementOverlay` | thiếu ở thư viện | `screens/viewer/MeasurementTool/MeasurementOverlay.tsx` — **đúng tên, sai chỗ** |
| `overlay/Popover` | **thiếu, có nơi gọi đang chờ** | không |
| `feedback/SaveIndicator` | **ĐÃ CÓ** (120 dòng, đủ story + test) | CL-08 liệt kê nhầm |
| `ui/Stepper` | thiếu | `feedback/PipelineStepper.tsx` (khác thiết kế, chuyên cho pipeline) |

Bằng chứng viết thẳng trong mã — `screens/system/CollaborationLayer/CommentThread.tsx:8`:

> *"`src/components/overlay/Popover.tsx` không tồn tại (đã grep, 0 kết quả)"*

nên màn đó phải tự dựng "bóng 320" thay cho Popover dùng chung. Đây là cái **duy nhất** trong
chín cái có người dùng đang chờ.

Sáu component `viewer/*` hiện chỉ có **một** nơi dùng là `ViewerShell` — nâng lên thư viện
chung khi chưa có người dùng thứ hai là tái cấu trúc không có lý do.

### Đ8 — `src/theme/tokens.ts` chưa bao giờ tồn tại

**Kiểm bằng:** `ls src/theme` → *No such file or directory*.

Đây là file mà DS-BIND, prompt DS-01 và chính cảnh báo ở mục 0.2 đều xoay quanh. Mục 0.2
đoán file đó *"hoặc đang là bản tạm do agent tự bịa ra, hoặc đang thiếu"*. Câu trả lời là:
**chưa bao giờ có**, và tầng giao diện đã được dựng theo đường khác mà vẫn giữ được bất biến
A1 (`local/no-raw-color`, 0 vi phạm).

Nguồn màu thật, ba chỗ, có thứ tự rõ ràng:

```
src/styles/globals.css      khai biến CSS (:root cho sáng, html.dark cho tối)
tailwind.config.ts          ánh xạ sang tên ngữ nghĩa: bg-app, text-primary, state-verified…
src/lib/coloring/scales.ts  COLOR_TOKEN_NAMES — danh sách tên token cho canvas, kiểu khép kín
```

Đếm token: **38** khoá ánh xạ `var(--…)` trong `tailwind.config.ts`. Mục 8.3 đòi 41, còn
chính prompt DS-01 lại ghi 38 — **tài liệu tự mâu thuẫn với nó**.

Mười token của DS-00 không có trong `globals.css` (kiểm từng cái bằng `grep -c -- "--<tên>:"`):

```
--bg-active   --border-hairline   --accent-border   --wall-centerline
--data-door   --data-window   --data-furniture   --data-dimension   --data-axis   --data-room
```

Tức **31/41** token DS-00 có mặt. Ngược lại `globals.css` có 24 token mà DS-00 chưa bao giờ
đặt tên — 14 `--scene-*` (phong cảnh 3D của `/login`), 5 `--shadow-color-*`, `--bg-overlay`,
`--bg-flash`, `--danger-tint`, `--danger-border`, `--white`, `--black`.

### Đ9 — `vi.json` không phải bảng dịch lúc chạy

**Kiểm bằng:** `grep -r "useTranslation\|react-i18next" src` trong mã sản phẩm → **0**.

Chuỗi tiếng Việt viết thẳng trong từng màn. `src/i18n/vi.json` có hai vai:
1. **Từ điển đối chiếu** cho `lib/testing/expectVietnamese.ts`, và được nạp vào một
   instance i18next thật **chỉ trong** `lib/testing/render.tsx` (môi trường test).
2. Vài nhánh dùng chung mà module đọc trực tiếp — `describeError.ts`, `useSaveIndicator.ts`,
   `useAutosave.ts`, `notificationBus.ts`, `realtime/pipeline.ts`, `NotificationHost.tsx`
   (`viMessages.autosave.idle`…).

File có **50 khoá cấp một**, đặt theo tên màn (`wallLayerReview`, `propertyInspector`,
`stateGallery`…), khớp thư mục `src/screens/**`. Bảng 0.9 đòi 15 nhánh gom nhóm
(`qc.wallLayer.title`, `viewer.propertyInspector.emptyState`).

Khớp đúng 7/15 tên nhánh: `common`, `auth`, `project`, `account`, `onboarding`, `billing`,
`pipeline`. Tám nhánh còn lại (`dashboard`, `upload`, `qc`, `viewer`, `rules`, `export`,
`admin`, `system`) không tồn tại dưới tên đó — nội dung rải theo tên màn. **`dashboard` thiếu
ở cả hai cách đếm**: màn `ProjectDashboard` không có nhánh khoá nào.

Vì `vi.json` không chạy lúc runtime, gom lại 15 nhánh **rẻ** hơn tưởng (không đụng lời gọi
`t()` nào) nhưng cũng **không đổi gì cho người dùng**.

### Đ10 — Thang chuyển động: ba tài liệu, ba câu trả lời

| Nguồn | Nói gì |
|---|---|
| v2.3 mục 0.6a | chốt **120 / 180 / 240 / 340** ms, lý do: "tầng logic đã có test, đổi 240→260 phải sửa `src/lib/motion` mà tầng đó bị khoá" |
| v2.3 mục 5.0 | hỏi chọn cách A (thêm mốc 700 ms) hay cách B; "mọi prompt bên dưới viết theo cách A" |
| `CLAUDE.md` mục B + `RULE.md` R-37 | "**đúng năm giá trị**" 120 / 180 / 260 / 340 / 700 |
| `src/lib/motion/tokens.ts:62-67` (đo thật) | `MOTION_DURATIONS_MS` có **bốn** khoá: `instant 120`, `fast 180`, `standard` **260**, `slow 340`. `AMBIENT_LOOP_MS = 700` (dòng 87) là hằng số **riêng**, docblock nói rõ cố ý không làm khoá thứ năm |

Kết luận: 240 → 260 **đã đổi từ lâu** (0.6a lạc hậu); cách A **đã chọn** (5.0 khép lại);
nhưng `CLAUDE.md` mô tả cấu trúc **chưa chính xác** — 700 không phải "giá trị thứ năm của
thang", nó là một hằng số riêng cho vòng lặp nền.

### Đ11 — Bộ số mẫu chuẩn: ba nguồn, ba bộ số

| Nguồn | Bộ số |
|---|---|
| v2.3 mục 3.0 · `docs/master-brief.md` · `lib/testing/fixtures.ts` | 48 tường · **21 đối tượng** (9 cửa + 7 cửa sổ + 5 nội thất) · 34 kích thước · 14 phòng · 4 tầng · 248,60 m² · 9 mục dưới ngưỡng 0,75 |
| `CLAUDE.md` A14 | 14 phòng · **4 trục** · **16 ô mở** (9+7) · **21 đồ đạc** · 34 kích thước |
| Đo fixture thật ở phiên trước | đường bao ra **238,00 m²**, không phải 248,60 |

Cùng con số **21** được gán cho hai thứ khác nhau (tổng đối tượng ↔ số đồ đạc), và **4** được
gán cho hai thứ khác nhau (số tầng ↔ số trục). Repo có **hai** fixture:
`lib/testing/fixtures.ts` và `domain/spatial/__fixtures__/sampleBuilding.ts`.

Chưa mục nào trong ba nguồn là kết quả của một phép đo chạy được. Việc đúng là **đo**, rồi
sửa hai nguồn còn lại theo số đo — không phải chép số của tài liệu vào test.

### Đ12 — Manifest StateGallery báo 329/329 trên một danh sách không phải bộ 47

**Kiểm bằng:** đọc `src/screens/system/StateGallery/stateGalleryManifest.ts`, đối chiếu
từng tên export story với file `.stories.tsx` tương ứng.

Kết quả kiểm **tốt hơn** dự đoán: manifest khai 47 màn × 7 trạng thái = **329 tên story, và
cả 329 tên đều tồn tại thật trong file** (0 tên khai khống). Đây là một manifest trung thực.

Vấn đề nằm ở **danh sách 47 màn nó duyệt**:

```
manifest có mà không thuộc bộ 47:  project/ShareScreen · viewer/ViewerShell
bộ 47 có mà manifest không có:     export/SpatialJsonViewer · system/ConnectionStates
```

Manifest thay hai màn thật còn thiếu bằng một khoản nợ đã ghi nhận (`ShareScreen`) và một
khối vỏ dùng chung (`ViewerShell`). Con số 329 đúng về số học (47 × 7) nhưng **không chứng
minh bộ 47 của đặc tả đã phủ đủ** — nó đang báo 100% cho một tập khác.

Đây đúng là thứ khối `[NGHIỆM THU]` của khung 12 khối gọi là "điểm chống *xanh mà sai*".

---

## 2. ĐỐI CHIẾU 47 MÀN

Cột "Sáu file" là kết quả `ls` từng thư mục theo R-59
(`index.ts` · `<Name>.tsx` · `use<Name>.ts` · `<Name>.container.tsx` · `<Name>.stories.tsx` · `<Name>.test.tsx`).

| Mã | Thư mục | Có mã | Sáu file | Cách mở | Đường dẫn thật |
|---|---|---|---|---|---|
| S-01 | `auth/AuthScreen` | ✅ | 6/6 | route | `/login` |
| S-02 | `dashboard/ProjectDashboard` | ✅ | 6/6 | route | `/` |
| S-03 | `project/CreateProjectModal` | ✅ | 6/6 | hộp thoại | mở từ `/` |
| S-04 | `project/ProjectSettings` | ✅ | 6/6 | route | `/projects/:id/settings` |
| S-05 | `account/AccountSettings` | ✅ | 6/6 | route | `/tai-khoan` |
| S-06 | `onboarding/WelcomeScreen` | ✅ | 6/6 | route | `/onboarding` |
| S-07 | `billing/BillingScreen` | ✅ | 6/6 | route | `/billing` |
| S-08 | `upload/FloorUploadScreen` | ✅ | 6/6 | route | `/projects/:id/upload` |
| S-09 | `upload/InputQualityGate` | ✅ | 6/6 | route *(0.8 nói không route)* | `/projects/:id/quality` |
| S-10 | `pipeline/ProcessingScreen` | ✅ | 6/6 | route | `/projects/:id/pipeline` |
| S-11 | `pipeline/ScaleCalibration` | ✅ | 6/6 | route | `/projects/:id/floors/:floorId/scale` |
| S-12 | `pipeline/PipelineGraph` | ✅ | 6/6 | route *(0.8 nói không route)* | `/projects/:id/pipeline/graph` |
| S-13 | `pipeline/CadBranchConfirm` | ✅ | 6/6 | route | `.../floors/:floorId/cad-confirm` |
| S-14 | `pipeline/PipelineFailure` | ✅ | 6/6 | lồng trong S-10 | `ProcessingScreen.container.tsx:53` |
| S-15 | `qc/WallLayerReview` | ✅ | 6/6 | route | `.../layers/walls` |
| S-16 | `qc/ObjectLayerReview` | ✅ | 6/6 | route | `.../layers/objects` |
| S-17 | `qc/DimensionOcrReview` | ✅ | 6/6 | route | `.../layers/dimensions` |
| S-18 | `qc/AxisGridManager` | ✅ | 6/6 | route | `.../layers/grids` |
| S-19 | `qc/FloorManager` | ✅ | 6/6 | route | `/projects/:id/floors` |
| S-20 | `qc/RoomLabelReview` | ✅ | 6/6 | route | `.../layers/rooms` |
| S-21 | `qc/ThicknessStandardization` | ✅ | 6/6 | route *(0.8 nói không route)* | `.../layers/thickness` |
| S-22 | `viewer/Viewer3D` | ✅ | 6/6 | route | `/projects/:id/3d` |
| S-23 | `viewer/PropertyInspector` | ✅ | 6/6 | panel, nạp động | `Viewer3DPanels.tsx:64` |
| S-24 | `viewer/FurnitureLibraryPanel` | ✅ | 6/6 | panel, nạp động | `Viewer3DPanels.tsx:58` |
| S-25 | `viewer/WallGeometryEditor` | ✅ | 6/6 | lớp phủ, nạp động | `Viewer3DOverlays.tsx:68` |
| S-26 | `viewer/RoomAreaPanel` | ✅ | 6/6 | panel, nạp động | `Viewer3DPanels.tsx:67` |
| S-27 | `viewer/HistoryPanel` | ✅ | 6/6 | panel, nạp động | `Viewer3DPanels.tsx:61` |
| S-28 | `viewer/OverlayComparison` | ✅ | 6/6 | route *(0.8 nói không route)* | `.../floors/:floorId/overlay` |
| S-29 | `viewer/ExplodedView` | ✅ | 6/6 | route *(0.8 nói không route)* | `/projects/:id/3d/exploded` |
| S-30 | `viewer/MeasurementTool` | ✅ | 6/6 | route *(0.8 nói không route)* | `/projects/:id/3d/measure` |
| S-31 | `rules/RuleReport` | ✅ | 6/6 | route | `/projects/:id/rules` |
| S-32 | `rules/ViolationDetail` | ✅ | 6/6 | tấm trượt trong S-31 | `RuleReport.container.tsx:57` |
| S-33 | `rules/RuleSettings` | ✅ | 6/6 | route | `/projects/:id/rules/settings` |
| S-34 | `export/ExportPanel` | ✅ | 6/6 | route | `/projects/:id/export` |
| S-35 | `export/ShareDialog` | ✅ | 6/6 | hộp thoại trong S-34 | `ExportPanel.container.tsx:69` — **xem Đ4** |
| **S-36** | `export/SpatialJsonViewer` | ✅ **đã dựng trong lượt này** | 6/6 | route | `/projects/:projectId/data` |
| S-37 | `export/VersionHistory` | ✅ | 6/6 | route | `/projects/:id/versions` |
| S-38 | `admin/ModelLibrary` | ✅ | 6/6 | route | `/admin/models` |
| S-39 | `admin/UserManagement` | ✅ | 6/6 | route | `/admin/users` |
| S-40 | `system/EditorTour` | ✅ | 6/6 | lồng trong ViewerShell | `ViewerShell.container.tsx:49` |
| S-41 | `system/NotificationCenter` | ✅ | 6/6 | route *(0.8 nói không route)* | `/thong-bao` |
| S-42 | `system/CollaborationLayer` | ✅ | 6/6 | lớp phủ, nạp động | `Viewer3DOverlays.tsx:65` |
| S-43 | `system/NotFound` | ✅ | 6/6 | route | `*` |
| S-44 | `system/AccessDenied` | ✅ | 6/6 | route | `/khong-co-quyen` |
| **S-45** | `system/ConnectionStates` | ✅ **đã dựng trong lượt này** | 6/6 | lớp dùng chung, **không route** (đúng bảng 0.8) | — |
| S-46 | `system/MobileViewer` | ✅ | 6/6 | route | `/m/du-an/:projectId` |
| S-47 | `system/StateGallery` | ✅ | 6/6 | route **chỉ dev** | `/design-system/states` — **xem Đ6** |

**Ngoài bộ 47:** `project/ShareScreen` (4/6 file — nợ đã ghi nhận),
`viewer/ViewerShell` (6/6 — là khối vỏ VIEWER-SHELL của mục 5.1, không phải một trong 47 màn),
`src/screens/system/StateGallery.tsx` (file lẻ **trùng tên** với thư mục cùng tên),
`MotionDemo.tsx` (không đăng ký route nào), 7 file demo rời khác.

**Tổng sau lượt này: 47/47 có mã.** Trước lượt này: 45/47 · **45/45 đủ sáu file** (màn duy nhất thiếu file là `ShareScreen`, mà
nó không thuộc bộ 47) · 34 mở bằng URL riêng · 11 sống như panel/hộp
thoại/lớp phủ trong màn khác (cả 11 đều xác nhận được bằng import thật từ ngoài thư mục — không
màn nào chết).

---

## 3. ĐỐI CHIẾU 52 THÀNH PHẦN

| Nhóm | Đặc tả | Có | Ghi chú |
|---|---:|---:|---|
| CL-01 Button, IconButton, SegmentedControl, Toggle | 4 | 4 | |
| CL-02 Input, NumericField, Select, Combobox, FieldRow | 5 | 5 | `Combobox` là thư mục ba file |
| CL-03 Table, TreeItem, Badge, ConfidenceMeter | 4 | 4 | |
| CL-04 AppShell, Panel, Breadcrumb, StatusBar, CommandPalette, DevStateSwitcher | 6 | 6 | `CommandPalette` ở `overlay/`, không ở `shell/` |
| CL-05 lớp phủ canvas | 5 | 5 | tên khác: `WallThicknessLegend`, `MeasurementLabel` |
| CL-06 UndoToast, Skeleton, EmptyState, InlineAlert, PipelineStepper, ProgressOverlay | 6 | 6 | `UndoToast` tích hợp trong `Toast.tsx` (`useUndoableToast`) |
| CL-07 Slider…Drawer | 10 | 10 | |
| **CL-08** | 10 | **1** | chỉ `SaveIndicator` — xem Đ7 |
| **Cộng danh sách tên của tài liệu** | **50** | **41** | |
| Component thật trong `src/components` | | **52** | |

Chín component thật **không có tên trong tài liệu**: `canvas/ContextMenu`, `canvas/GridLayer`,
`canvas/SelectionHalo`, `feedback/NotificationHost`, `feedback/ScreenErrorBoundary`,
`shell/GlobalShortcutHelp`, `shell/ShortcutHelp`, `ui/TableActionBar`, `ui/ThicknessField`.
Cộng hai file nội bộ của `Combobox` là đủ 52.

Tiêu đề "52 thành phần" của mục 1.5 và mục 8.3 **không đến từ danh sách của chính tài liệu**
(cộng ra 50). Con số 52 trùng với thực tế là trùng hợp.

---

## 4. TRẠNG THÁI CỔNG KIỂM

`pnpm verify` chạy trên `master` (`f13dbb2`) ngày 2026-09-14, **trước khi báo cáo này chạm
vào mã nào**. Bảng dưới là đầu ra nguyên văn của chính lệnh đó:

```
  đạt       typecheck
  đạt       lint
  đạt       import vòng
  HỎNG      test + độ phủ
  chưa chạy build
  chưa chạy kích thước gói
  chưa chạy độ dài file

Dừng ở bước "test + độ phủ" (mã thoát 1).
```

**Cổng đang đỏ ở HEAD, và nó đỏ vì hết giờ, không vì sai.** Hai lượt đo liên tiếp:

| Lượt | File test hỏng | Bài hỏng | Lý do |
|---|---:|---:|---|
| 1 | 10 / 307 | 15 / 5.873 | 100% là `Test timed out in 5000ms` |
| 2 | 7 / 307 | — | 100% là `Test timed out in 5000ms` |

`grep -oE "(Test timed out in [0-9]+ms\|expected …)"` trên trọn nhật ký lượt hai ra **10 lần
"Test timed out in 5000ms" và không một lỗi khẳng định nào**. Tập file hỏng đổi giữa hai
lượt — dấu hiệu của tải máy, không phải của hồi quy: một lỗi thật thì hỏng đúng chỗ đó mỗi
lần. Cả hai lượt chạy trong lúc máy còn chạy việc khác.

Việc đúng theo E.10 là ghi lại đúng như vậy: **bước 4 chưa đạt trên máy này**, và phán quyết
xanh chỉ có giá trị khi đo lúc máy rảnh.

Vì `verify` dừng ở bước 4, ba bước cuối được chạy **riêng từng lệnh**, sau khi lượt này thêm
`src/api/schemas/spatial.ts` và bài kiểm của nó:

```
BUILD_EXIT=0   SIZE_EXIT=0   LENGTH_EXIT=0
```

| Cổng kích thước gói | Đo được | Ngưỡng | Còn dư |
|---|---:|---:|---:|
| màn hình đầu tiên (chunk vào + nhập tĩnh) | 158,9 KiB | 175 | 16,1 |
| chunk JS lớn nhất | 158,9 KiB | 170 | 11,1 |
| **chi phí thêm cho một màn** | 258,6 KiB | 280 | **21,4** |
| tổng CSS | 10,9 KiB | 12 | 1,1 |
| *tổng JS mọi chunk (chỉ cảnh báo)* | *1.058,8 KiB* | *800* | *quá 258,8* |

Độ dài file: 339 file đã quét · 59 vượt mốc nhắc 250 · **0 vượt mốc hỏng 400** → đạt.

> Hai con số đáng nhớ trước khi dựng thêm màn: **chi phí thêm cho một màn chỉ còn dư
> 21,4 KiB**, và **CSS chỉ còn dư 1,1 KiB**. S-36 dựng cây JSON lớn, nên đó là hai ngân
> sách phải canh chứ không phải hai con số để trích lại.

> Lưu ý cách đo, vì nó suýt làm hỏng chính báo cáo này: lượt đầu chạy
> `pnpm verify 2>&1 | tail -60`, và **ống dẫn nuốt mã thoát** — vỏ trả về mã của `tail`
> (0), không phải của `verify` (1). Bảng "KIỂM TỔNG" mà `scripts/verify.mjs` tự in ra là
> thứ cứu phép đo. Lượt hai chạy `pnpm coverage > tệp 2>&1` rồi đọc `$?`: `EXIT=1`.

Ngân sách bước 6 (`scripts/check-bundle-size.mjs`, đo gzip qua `dist/.vite/manifest.json`):
màn đầu 175 KiB · chunk lớn nhất 170 KiB · **chi phí thêm cho một màn 280 KiB** · CSS 12 KiB.
Tổng JS > 800 KiB chỉ **cảnh báo**, không chặn.

Ngưỡng bước 7 (`scripts/check-file-length.mjs`, đơn vị **dòng có nội dung**): nhắc 250, hỏng 400.

---

## 5. NĂM QUYẾT ĐỊNH

| # | Điểm lệch | Chốt | Vì sao |
|---|---|---|---|
| **Q1** | Đ5 — URL tiếng Anh hay tiếng Việt | **Giữ tiếng Anh, sửa bảng 0.8.** Nhưng đổi `:id` → `:projectId` | URL không phải chuỗi hiển thị nên A6/R-42 không áp; `paths.ts:45-48` đã viết sẵn quy ước và ba ngoại lệ. Đổi 22 route đụng mọi `navigate()`, test router và ảnh chuẩn e2e mà không đổi lấy giá trị nào. Còn hai quy ước tham số trong một cây route **là** lỗi thật |
| **Q2** | Đ9 — `vi.json` 50 nhánh phẳng hay 15 nhánh gom | **Giữ 50 nhánh phẳng, sửa bảng 0.9.** Thêm nhánh `dashboard` còn thiếu | Nhánh đặt theo tên màn khớp thư mục `src/screens/**`; gom lại là diff cơ học lớn trên một file mà chỉ `expectVietnamese` đọc |
| **Q3** | Đ7 — CL-08 | **Dựng `overlay/Popover`.** Sáu component `viewer/*` ghi vào sổ nợ. `ui/Stepper` và `viewer/GizmoHud` bỏ khỏi danh sách | Popover có nơi gọi đang chờ, ghi chú nằm sẵn trong mã. Sáu cái kia chỉ có một nơi dùng — nâng lên thư viện chung là tái cấu trúc không có lý do |
| **Q4** | Đ8 — 10 token thiếu | **Chỉ bổ sung khi có nơi dùng thật**; ghi nhận độ lệch | Thêm đủ 41 token tạo ra 10 biến không ai đọc — màu chết mà lint không bắt được |
| **Q5** | Đ11 — bộ số mẫu | **Đo lại bằng test, chốt một bộ số, sửa hai nguồn còn lại theo số đo** | Chép số của tài liệu vào test là khoá vĩnh viễn một con số chưa ai xác minh |

---

## 6. VIỆC ĐỀ XUẤT, THEO THỨ TỰ

| Thứ tự | Việc | Vì sao trước | Đụng tầng nào |
|---|---|---|---|
| 1 | **Đ1** — `src/api/schemas/spatial.ts` + nối vào `spatial.readFloor` | Đây là chỗ duy nhất trong báo cáo mà lỗi biểu hiện thành **màn vỡ trước mặt người dùng**, và đầu vào của nó là đầu ra xác suất của ba mô hình AI | `src/api` |
| 2 | **Đ2** — chốt số phận `src/types/spatial.ts` ✅ đã làm | Không chốt thì mọi màn đọc Spatial JSON về sau phải tự đoán dùng hệ nào | `src/types` |
| 2b | **Đ2** — adapter hợp đồng nghiên cứu → mô hình miền ⏸ **cố ý chưa làm** | xem khung ngay dưới bảng | — |
| 3 | **Đ3** — dựng S-36 `SpatialJsonViewer` | Là màn đầu tiên hưởng việc 1: dải "Hợp lệ theo schema — 0 lỗi" cần một schema thật mới nói được | `src/screens` |
| 4 | **Đ3** — dựng S-45 `ConnectionStates` | Bất biến "mất kết nối không bao giờ làm mất việc" hiện không có màn nào nói ra | `src/screens` |
| 5 | **Đ12** — sửa manifest StateGallery cho đúng bộ 47 | Làm sau việc 3 và 4, vì lúc đó hai màn mới đã có story để khai | `src/screens` |
| 6 | **Đ4** — `/share` trỏ `ShareDialog`, xoá `ShareScreen` | Xoá khoản nợ cuối cùng không đủ sáu file | `src/routes`, `src/screens` |
| 7 | **Đ7/Q3** — `overlay/Popover`, chuyển `CommentThread` sang dùng | Có nơi gọi đang chờ sẵn | `src/components` |
| 8 | **Đ5/Q1** — `:id` → `:projectId`; xử lý 3 route `Placeholder` | Diff cơ học — làm khi không có nhánh tính năng lớn nào mở | `src/routes` |
| 9 | **Đ6** — quyết định S-47 dev-only | Cần người quyết, không phải việc kỹ thuật | `src/routes` |
| 10 | **Đ8, Đ9, Đ10, Đ11** — đính chính tài liệu | Sau khi mã đã đúng, tài liệu mới chép theo được | tài liệu |

> **Lệch khỏi kế hoạch đã duyệt, nói rõ ở đây thay vì lặng lẽ bỏ qua.** Kế hoạch có mục
> "viết adapter một chiều từ hợp đồng nghiên cứu sang mô hình miền". Sau khi đo, mục đó
> **chưa được làm**, và lý do là chính lý lẽ mà kế hoạch dùng để bác sáu component
> `viewer/*` của CL-08: **chưa có nơi gọi.**
>
> Backend AI chưa tồn tại; đặc tả của S-36 nói màn đọc dữ liệu từ D-11/D-12, tức mô hình
> miền, không phải hình dạng của hợp đồng nghiên cứu. Một adapter viết bây giờ sẽ không có
> bài kiểm nào chạm vào đầu vào thật của nó, và hình dạng thật của nó chỉ lộ ra khi có phản
> hồi thật đầu tiên. Viết nó lúc này là đoán, và R-69 cấm đoán.
>
> Cái làm được ngay mà không phải đoán thì đã làm: độ lệch từng trường được ghi thành bảng
> **trong chính `src/types/spatial.ts`**, kèm câu nói rõ quy đổi mét ↔ milimét chỉ được đi
> qua `domain/units` (R-44). Người nối backend thật đọc được nó ở đúng chỗ họ sẽ mở ra.
>
> Nếu bạn muốn adapter có mặt trước khi backend có, nói một câu là tôi viết — nhưng nó sẽ
> là mã chưa ai gọi, và nên được ghi nhận như vậy.

---

## 6b. ĐÃ LÀM TRONG LƯỢT NÀY

Báo cáo này là giai đoạn 1 của một kế hoạch bốn giai đoạn. Ba giai đoạn còn lại đã chạy —
bốn việc cuối chạy **song song** bằng bốn worker Orca, mỗi worker sở hữu một tập file rời
nhau. Dưới đây là kết quả.

| Độ lệch | Đã làm | Bằng chứng |
|---|---|---|
| **Đ1** | `src/api/schemas/spatial.ts` — zod cho bốn thực thể của `SpatialLayer`, nối vào `spatial.writeLayer`. Ba phép kiểm không suy ra được từ kiểu: A5 (`{source:'ai', reviewed:true}` bị từ chối), đoạn thẳng phải có chiều dài, hộp bao phải đúng chiều | 24 bài kiểm mới; chốt chặn chống trôi đã chứng minh cắn: bỏ `thicknessMm` khỏi schema → typecheck đỏ ngay tại dòng khai báo |
| **Đ2** | Khối chú thích đầu `src/types/spatial.ts`, kèm bảng lệch từng trường. Adapter **cố ý chưa viết** — xem khung ở mục 6 | `grep -rn "types/spatial" src`: `WallThickness` 9 nơi dùng, phần còn lại đúng 1 |
| **Đ3** | **Cả hai màn đã dựng.** S-36 `SpatialJsonViewer` (route `/projects/:projectId/data`) và S-45 `ConnectionStates` (không route, đúng bảng 0.8) | 38 + 35 bài kiểm; đủ sáu file R-59; khối lệnh kiểm R-59..R-73 sạch |
| **Đ4** | Route `/share` **xoá hẳn**, `project/ShareScreen/` và `ShareRoute.tsx` xoá theo | đề xuất ban đầu ("trỏ `/share` sang ShareDialog") **sai**: bảng 0.8 ghi S-35 là "không route". `ExportPanel` đã mở `ShareDialogContainer` thật, có bài kiểm tích hợp |
| **Đ5** | `:id` → `:projectId` trên toàn cây route; **năm** route cũ không có ngữ cảnh dự án đã xoá cùng `Placeholder` và `RouteCanvas` | worker `g4-routes`: 28 file, `rg ":id" src/routes/paths.ts` rỗng, `rg "useParams<\{ *id" src` rỗng |
| **Đ6** | **Chưa quyết** — S-47 vẫn chỉ có ở bản dev. Đây là quyết định sản phẩm, không phải việc kỹ thuật | — |
| **Đ7** | `overlay/Popover` đã dựng (229 dòng, 7 story, 8 bài kiểm); `CommentThread.tsx` chuyển sang dùng nó và ghi chú "Popover không tồn tại" đã xoá. Sáu component `viewer/*` ghi nợ theo Q3 | kiểm độc lập: 0 `framer-motion`, 0 màu thô trong `Popover.tsx` |
| **Đ8** | Ghi nhận, không thêm token chết (Q4). S-36 dùng ba tông **đo được** thay cho `--data-dimension` | bảng tương phản trong `SpatialJsonViewer/types.ts` |
| **Đ9** | Giữ nhánh phẳng (Q2); hai màn mới theo đúng quy ước đang chạy | `vi.json` 52 nhánh cấp một |
| **Đ10, Đ11** | `CLAUDE.md` mục B và A14 sửa theo số đo; `docs/dinh-chinh-v2.3.md` đính chính mười một mục của v2.3 | worker `g4-docs` |
| **Đ12** | Manifest `StateGallery` nay **khớp đúng 48 thư mục màn thật** — bộ 47 của đặc tả cộng `viewer/ViewerShell`. Kiểm hai chiều: manifest-only rỗng, thư-mục-only rỗng | 336 ô trạng thái, từng tên story đã đối chiếu với file `.stories.tsx` thật — 0 tên khai khống |
| **D7** (`BAO_CAO_DO_LECH.md`) | Gỡ `@react-three/fiber`, `@react-three/drei`, `react-hook-form`, `d3-zoom`, `@types/d3-zoom` | kiểm độc lập: cả bốn ra **0 nơi dùng** |

### Bốn điều lượt này học được, và chúng đều là lỗi tự bắt

**1. Một lỗi mà không cổng nào bắt được.** Worker `g4-routes` đổi tên lỗ route sang
`:projectId` nhưng spec cấm nó chạm thư mục của S-36, nên nó **báo lại thay vì làm liều**.
`SpatialJsonViewer.container.tsx` vẫn đọc `useParams<{ id }>`; typecheck, lint và mọi bài
kiểm **vẫn xanh**, vì `useParams` là generic tự do không ràng buộc với `ROUTE_PATTERNS`. Lỗi
chỉ lộ lúc chạy, dưới dạng một màn nói "thiếu mã dự án" ở mọi lượt mở.

**2. Worker dừng đúng lúc còn quý hơn worker làm xong.** Cùng worker ấy **dừng** việc C với
lý do đúng: lúc nó kiểm, manifest vẫn khai `ShareScreen` là một trong 47 màn, nên xoá thư mục
mà giữ dòng manifest sẽ cho ra "xanh mà sai" — và xoá dòng manifest thì R-70 cấm nó sửa test.
Nó hỏi, rồi dừng. Rào cản ấy biến mất khi Đ12 xong, và việc C làm được ngay sau đó.

**3. Một regex tham lam xoá 19 mục thay vì 1.** Lần xoá `ShareScreen` khỏi manifest đầu tiên
dùng `(?:[^
]*
)*?` để dò khối; nó bắt từ một đầu khối sớm hơn nhiều và nuốt 19 mục,
làm `export/SpatialJsonViewer` biến mất. **Bài kiểm vừa thêm ở commit ngay trước đó đỏ ngay** —
đúng lớp lỗi nó sinh ra để bắt. Làm lại bằng cách dò biên khối theo mức thụt lề, có khẳng
định "khối chỉ chứa đúng một `id:`".

**4. Câu hỏi của worker có hạn 900 giây.** Worker `g4-routes` hỏi qua `ask` và hết hạn không
có trả lời vì tôi dò hộp thư quá thưa. Nó xử lý đúng — settle với báo cáo đầy đủ và một
escalation riêng — nhưng lần sau điều phối viên phải dò hộp thư theo nhịp, không theo cảm tính.

---

## 7. VIỆC KHÔNG LÀM

| Không làm | Vì sao |
|---|---|
| Chạy 56 prompt của v2.3 | 45/47 màn đã có mã, đủ sáu file, đủ story, đủ test |
| Đổi 22 route sang tiếng Việt | Q1 |
| Gom `vi.json` về 15 nhánh | Q2 |
| Dựng đủ 9 component CL-08 | Q3 — sáu cái chỉ có một nơi dùng |
| Thêm đủ 41 token | Q4 — tạo màu chết |
| Dựng backend AI | Tài liệu nghiên cứu mô tả hệ thống phía sau; repo này là frontend |
| Tách `viewer/*` khỏi `ViewerShell` | Chưa có nơi dùng thứ hai |
