# Sổ lỗi sản phẩm — AppFront

Mỗi lỗi một mục. Mỗi mục **tái hiện được bằng tay và bằng máy** (một bài e2e), và mang
**trạng thái** để biết đã sửa chưa. Sổ này là nơi duy nhất ghi trạng thái lỗi; mục 9 của
`plan.md` là bản ghi lịch sử lúc lập kế hoạch.

## Trạng thái

| Trạng thái | Nghĩa | Bài e2e tái hiện ở dạng |
|---|---|---|
| `mở` | dựng lại được, chưa sửa | `test.fixme(...)` — kèm lý do + điều kiện mở lại |
| `đã sửa` | gốc đã chữa, có commit | `test(...)` xanh — từ đây nó là bài chặn hồi quy |
| `không phải lỗi` | dựng lại thì hành vi đúng / ghi chú cũ hiểu nhầm | không cần bài; ghi phép đo đã bác nó |
| `ngoài FE` | gốc nằm ở BE / bộ mẫu dev / hạ tầng | bài ghi nhận nếu có; nói rõ chủ |
| `chờ quyết` | sửa được nhưng đổi hành vi sản phẩm — cần người duyệt | `test.fixme(...)` |

Quy tắc: **chuyển `mở` → `đã sửa` chỉ khi** bài e2e tái hiện đổi từ `test.fixme` sang
`test` và chạy xanh, và mục ghi hash commit. Bài phải đỏ trên mã trước khi sửa — đã kiểm
bằng cách tạm bật/hoàn tác bản sửa, và ghi rằng đã kiểm.

## Khuôn một mục

```
### B-<nhóm>-<số> · <một dòng: người dùng thấy gì sai>

- **Trạng thái:** mở | đã sửa (`<hash>`) | không phải lỗi | ngoài FE | chờ quyết
- **Mức:** cao | trung bình | thấp — <vì sao: người dùng mất gì>
- **Bất biến vi phạm:** A<n> (CLAUDE.md) hoặc "—"
- **Phát hiện:** <ngày> · <bởi gì: bộ dò / spec / đọc mã>
- **Tái hiện bằng tay:**
  1. <bước>
  2. <bước>
  - Kỳ vọng: <...>
  - Thực tế: <...>
- **Tái hiện bằng máy:** `<tệp spec>` › "<tên bài>"
  `E2E_PORT=5181 E2E_SKIP_PASCAL=1 pnpm e2e <tệp spec> -g "<một mảnh tên bài, KHÔNG có |>"`
- **Gốc:** `<tệp>:<dòng>` — <cơ chế, một hai câu>
- **Sửa:** <tệp đã đổi> · bài đơn vị `<tệp test>` · commit `<hash>` — hoặc "chưa"
```

Nhóm: `G` (toàn cục), `V1`…`V12` theo `plan.md` mục 8.

---

## Mục lục

| Mã | Lỗi | Trạng thái | Mức |
|---|---|---|---|
| B-G-01 | Từ màn 404 bấm "về danh sách dự án" thì bảng điều khiển đổ | đã sửa (`e63300c`) | cao |
| B-G-02 | `Escape` ở `/thong-bao` mở trực tiếp đưa trình duyệt ra `about:blank` | đã sửa (`a73007b`) | cao |
| B-G-03 | Mọi trang xin `/favicon.ico` và nhận 404 | mở | thấp |
| B-G-04 | Lúc tải route, màn hiện chữ tiếng Anh `Loading...` | mở | trung bình |
| B-G-05 | Màn đo gọi `/api/projects/:id/measurements` → 404 ở môi trường dev | mở | thấp |
| B-G-06 | `/thong-bao` mở luồng SSE `/api/streams/notifications` → 404 ở môi trường dev | mở | thấp |
| B-V8-01 | Thu phóng (cuộn chuột và nút "Phóng to") chết ở 3/4 góc nhìn 3D | mở | cao |

<!-- Các nhóm V1…V12 thêm mục bên dưới; điều phối viên gộp và cập nhật mục lục. -->

---

## G — toàn cục

### B-G-01 · Từ màn 404 bấm "về danh sách dự án" thì bảng điều khiển đổ

- **Trạng thái:** đã sửa (`e63300c`)
- **Mức:** cao — người dùng gõ sai đường, bấm lối ra duy nhất, và gặp màn lỗi
- **Bất biến vi phạm:** A11
- **Phát hiện:** 2026-10-02 · `scripts/probe-interact.mjs`
- **Tái hiện bằng tay:**
  1. Mở `/duong-khong-ton-tai-xyz`
  2. Bấm "về danh sách dự án"
  - Kỳ vọng: bảng điều khiển "Dự án của tôi" với danh sách dự án
  - Thực tế (trước khi sửa): `ProjectCardTile.tsx:149` ném `Cannot read properties of undefined (reading 'length')`
- **Tái hiện bằng máy:** chưa có — giao nhóm V1
- **Gốc:** một khoá bộ đệm, hai người ghi, hai hình dạng — 404 đọc `client.projects.list()`, bảng điều khiển đọc `SAMPLE_PROJECTS` có thêm `members`
- **Sửa:** 404 dùng khoá riêng `queryKeys.project.recent()` · commit `e63300c`

### B-G-02 · `Escape` ở `/thong-bao` mở trực tiếp đưa trình duyệt ra `about:blank`

- **Trạng thái:** đã sửa (`a73007b`)
- **Mức:** cao — một màn trắng do một phím gây ra
- **Bất biến vi phạm:** A11, A12
- **Phát hiện:** 2026-10-02 · `scripts/probe-interact.mjs`
- **Tái hiện bằng tay:**
  1. Mở tab mới, gõ thẳng `/thong-bao`
  2. Bấm `Escape`
  - Kỳ vọng: về bảng điều khiển, vẫn trong ứng dụng
  - Thực tế (trước khi sửa): trình duyệt ra `about:blank`
- **Tái hiện bằng máy:** chưa có — giao nhóm V2
- **Gốc:** `onDismiss` gọi `navigate(-1)` mù; mở trực tiếp thì không có mục lịch sử phía trước
- **Sửa:** hỏi `location.key`; không có chỗ lùi thì `navigate(ROUTES.dashboard, { replace: true })` · commit `a73007b`

### B-G-03 · Mọi trang xin `/favicon.ico` và nhận 404

- **Trạng thái:** mở — giao nhóm V1
- **Mức:** thấp — người dùng không thấy; nhưng mọi bài "console sạch" phải lọc riêng nó
- **Bất biến vi phạm:** —
- **Phát hiện:** 2026-09-30 · CDP Network (plan.md mục 6, Chặng 1)
- **Tái hiện bằng tay:** mở bất kỳ trang nào, DevTools › Network: `favicon.ico` 404
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` lọc nó ở `isFavicon` — khi sửa, gỡ bộ lọc và lưới phải vẫn xanh
- **Gốc:** `index.html` không có `<link rel="icon">` (questions.md Q10i)
- **Sửa:** chưa

### B-G-04 · Lúc tải route, màn hiện chữ tiếng Anh `Loading...`

- **Trạng thái:** mở — giao nhóm V1
- **Mức:** trung bình — chữ tiếng Anh trên màn sản phẩm (A6), không skeleton (A11 gần màn trắng)
- **Bất biến vi phạm:** A6, A11
- **Phát hiện:** 2026-10-02 · đọc mã, vòng tranh luận Chặng 1
- **Tái hiện bằng tay:** DevTools › Network › Slow 3G, mở `/projects/project-1/3d` — chữ `Loading...` ở góc trên
- **Tái hiện bằng máy:** chưa có
- **Gốc:** `src/routes/router.tsx:22` — `fallback={<div>Loading...</div>}`
- **Sửa:** chưa

### B-G-05 · Màn đo gọi `/api/projects/:id/measurements` → 404 ở môi trường dev

- **Trạng thái:** mở — giao nhóm V9 (xác định: lỗi FE hay chỉ bộ mẫu dev thiếu)
- **Mức:** thấp
- **Phát hiện:** 2026-10-02 · `e2e/smoke-grid.spec.ts` (bộ dò lúc tải trang bỏ sót)
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` › "màn projectMeasure" — dòng `expectedConsole`
- **Gốc:** `measurementToolGateway.ts:609` gọi thẳng mạng; `src/api/__mocks__/client.ts` không phục vụ đường này
- **Sửa:** chưa

### B-G-06 · `/thong-bao` mở luồng SSE `/api/streams/notifications` → 404 ở môi trường dev

- **Trạng thái:** mở — giao nhóm V2 (cùng câu hỏi với B-G-05)
- **Mức:** thấp
- **Phát hiện:** 2026-10-02 · bộ dò 35 màn
- **Tái hiện bằng máy:** `e2e/smoke-grid.spec.ts` › "màn notifications" — dòng `expectedConsole`
- **Gốc:** `notificationCenterGateway.ts:306`
- **Sửa:** chưa

## V8 — vỏ 3D

### B-V8-01 · Thu phóng (cuộn chuột và nút "Phóng to") chết ở 3/4 góc nhìn 3D

- **Trạng thái:** mở — giao nhóm V8
- **Mức:** cao — ở góc Trục đo / Trên xuống / Mặt cắt người dùng không phóng to được bằng bất kỳ cách nào nhìn thấy được
- **Bất biến vi phạm:** A12 (điều khiển nhìn thấy được mà không làm gì)
- **Phát hiện:** 2026-10-02 · chẩn đoán bài chập chờn `viewer3d.spec.ts:546`, đo bằng trình duyệt thật
- **Tái hiện bằng tay:**
  1. Mở `/projects/project-1/3d`, chờ "Mô hình 3D đã dựng xong"
  2. Bấm mặt "Trên xuống" của khối định hướng
  3. Cuộn chuột 5 nấc giữa khung nhìn, rồi bấm "Phóng to" 3 lần
  - Kỳ vọng: nhãn mức thu phóng tăng
  - Thực tế: đứng ở 100% (góc Phối cảnh: 112,6 → 197,6 → 390,6%)
- **Tái hiện bằng máy:** `e2e/viewer3d.spec.ts` › `thu phóng được ở góc "…"` (ba bài `test.fixme`)
  `E2E_PORT=5181 E2E_SKIP_PASCAL=1 pnpm e2e e2e/viewer3d.spec.ts -g "thu phóng được ở góc"`
- **Gốc:** `useViewerShell.ts` `onViewportWheel` chỉ chạy khi bộ điều khiển có `dolly`; `FlatCameraMode` (`lib/three/camera/modes.ts`) chỉ có `zoom`
- **Sửa:** chưa
