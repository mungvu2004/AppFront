# L3 — Ghép màn, đăng ký route, trộn i18n, nghiệm thu

Commit: `edef46d` trên `mungvu2004/cad-l3-integrate`.

---

## 1. Việc đã làm

| Việc | File | Ghi chú |
|---|---|---|
| A. Vỏ màn | `src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx` | 346 dòng có nội dung |
| B. Container | `…/CadBranchConfirm.container.tsx` | `ScreenErrorBoundary` của `@/components/feedback` (R-62) |
| C. `index.ts` | `…/index.ts` | xuất `CadBranchConfirmRoute` cho router |
| D. Story | `…/CadBranchConfirm.stories.tsx` | bảy story + `meta.excludeStories` (bẫy CSF) |
| E. Test | `…/CadBranchConfirm.test.tsx` | 17 test, gọi đủ bốn bộ khẳng định |
| F. Đường dẫn | `src/routes/paths.ts` | `ROUTE_PATTERNS.projectCadConfirm` + `ROUTES.project.cadConfirm(projectId, floorId)` |
| G. Router | `src/routes/router.tsx` | `RouteCadBranchConfirm` qua `lazy(...)`, THÊM route mới (không xoá Placeholder nào) |
| H. i18n | `src/i18n/vi.json` | trộn fragment, xoá `src/i18n/vi.json.fragment` |
| Ngoại lệ | `…/CadLayerPreviewCanvas.tsx` | vá đúng một hàm `cssColorOfToken` |

### Hai giai đoạn nối tiếp, một route

- Giai đoạn 1 là `CadBranchConfirmDialog` (hộp thoại 560). Chọn **CAD** → hộp
  thoại đóng, `stage` thành `layerMapping`, panel ánh xạ mở ra bên dưới. Không
  lồng hộp thoại: test `[NGHIEM-2]` khẳng định `queryByRole('dialog')` rỗng sau
  khi giai đoạn 2 mở.
- Chọn **AI** → hộp thoại đóng, khối bàn giao hoà tan bằng `animate-panel-rise`
  = nấc `slow` = 340 ms của `MOTION_DURATIONS_MS` (R-71, không con số viết tay),
  kèm caption mức "cần chú ý" `AI_BRANCH_NOTICE`.
- Khối bàn giao ấy cũng là câu trả lời cho nút "Huỷ" — hộp thoại đóng mà chưa
  chốt nhánh thì màn không trắng (A11), và vẫn còn ĐÚNG HAI lựa chọn để chốt
  lại. Nhánh AI không bao giờ bị khoá.

### Dòng tóm tắt và con số chạy

Câu tóm tắt là hai chuỗi ĐÃ GHÉP XONG của hook (`mappedCountLabel`,
`objectCountLabel`) đặt cạnh nhau — view không đếm, không định dạng, không ghép
số. Con số lớn bên cạnh là phần chuyển động: `@/hooks/useCountUp` (lớp bọc
React), `aria-hidden` nên trình đọc màn hình chỉ nghe đúng câu của hook một lần.
Đã đọc cả hai file trùng tên: `@/lib/motion/useCountUp` là engine thuần (`src/lib`
cấm React), `@/hooks/useCountUp` là lớp bọc — view là tầng React nên dùng lớp bọc.

### Bảy trạng thái A11

| `state` | vỏ màn vẽ gì |
|---|---|
| `empty` | `InlineAlert` mức attention + `emptyNotice` |
| `loading` | `Skeleton preset="canvas"` trong vùng `role="status"` |
| `partial` | attention + `partialNotice` + danh sách thực thể không hỗ trợ, gọi tên từng loại |
| `error` | violation + `errorMessage` + `Mã lỗi: …` + nút "Vẫn dùng AI" + nút "Đọc lại tệp" |
| `success` | verified + `successNotice` |
| `forbidden` | attention + `forbiddenNotice`, nút "Nhập hình học" BIẾN MẤT |
| `collapsed` | panel thu lại, canvas rộng ra, nút "Mở bảng lớp" |

---

## 2. Ngoại lệ phạm vi đã dùng

`cssColorOfToken` trong `CadLayerPreviewCanvas.tsx` nay nhận cả ba cách viết
token và bọc dạng trần:

```ts
if (colorToken.startsWith('var(')) return colorToken;
if (colorToken.startsWith('--')) return `var(${colorToken})`;
return `var(--${colorToken})`;
```

Không hook nào bị sửa, `useCadBranchConfirm.test.ts` vẫn xanh nguyên. Test
`[NGHIEM-4]` khẳng định mọi ô màu chú giải nhận một giá trị khớp `/^var\(--wall-/`.

---

## 3. Nghiệm thu — kết quả nguyên văn

**Lưu ý công cụ:** máy này không có `rg` trên PATH (`which rg` → không thấy), nên
khối lệnh Phần 4 chạy bằng `grep -rnE` với cùng biểu thức và cùng phạm vi tệp
(`--include='*.tsx' --exclude='*.container.tsx' --exclude='*.test.tsx'
--exclude='*.stories.tsx'` thay cho `--glob`).

```
R-59 sáu file:
CadBranchCompareTable.tsx
CadBranchConfirm.container.tsx
CadBranchConfirm.stories.tsx
CadBranchConfirm.test.tsx
CadBranchConfirm.tsx
CadBranchConfirmDialog.tsx
cadBranchConfirmGateway.ts
cadBranchConfirmText.ts
CadFloorAvailability.tsx
CadImportOptions.tsx
CadLayerMappingPanel.tsx
CadLayerPreviewCanvas.tsx
index.ts
types.ts
useCadBranchConfirm.test.ts
useCadBranchConfirm.ts
R-60 view chạm dữ liệu:
R-62 ranh giới lỗi:
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.container.tsx:114:    <ScreenErrorBoundary
R-63 bảy trạng thái:
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.stories.tsx:274: * lỗi biên dịch ở đây, và `expectSevenStates` bắt lại lần nữa lúc chạy.
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.test.tsx:4: * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.test.tsx:41:import { expectSevenStates } from '@/lib/testing/expectSevenStates';
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.test.tsx:139:/* Mảng thứ hai của `expectSevenStates`.                                       */
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.test.tsx:215:    expectSevenStates((scenario) => {
R-64 tự viết loading:
src/screens/pipeline/CadBranchConfirm/useCadBranchConfirm.ts:42: * Không `useState` nào ở đây giữ `isLoading` hay `error` — đó là việc của
R-65 đường dẫn thô:
src/screens/pipeline/CadBranchConfirm/types.ts:3: * `/projects/:id/floors/:floorId/cad-confirm`.
src/screens/pipeline/CadBranchConfirm/types.ts:398: * ở giai đoạn 2); `mapping`/`preview`/`importOptions` là `null` cho tới khi
src/screens/pipeline/CadBranchConfirm/useCadBranchConfirm.test.ts:353:    expect(onNavigate).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/pipeline`);
src/screens/pipeline/CadBranchConfirm/useCadBranchConfirm.ts:38: * — đi qua `useShortcut`/`shortcutRegistry` (R-54), không `addEventListener`.
src/screens/pipeline/CadBranchConfirm/useCadBranchConfirm.ts:43: * `useQuery`/`useMutation` (`useShareLinks.ts` là ngoại lệ đi trước, không phải
R-69 stub/nợ:
R-70 test bị tắt:
R-71 hằng số thô:
R-73 container tồn tại:
src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.container.tsx
```

Đọc kết quả:

- **Rỗng thật:** R-60, R-69, R-70, R-71.
- **Có kết quả (đúng như yêu cầu):** `ls`, `<ScreenErrorBoundary`,
  `expectSevenStates`, container tồn tại.
- **R-64 và R-65 không rỗng, nhưng không dòng nào là mã chạy được của lượt này.**
  Bảy dòng in ra: sáu dòng nằm trong chú thích `/** */` (LUAT_MAN_HINH Phần 4 nói
  rõ phải bỏ qua dòng trong chú thích), và một dòng là mã thật —
  `useCadBranchConfirm.test.ts:353`, một khẳng định của test do L2-A giao, có
  trước lượt này và nằm ngoài phạm vi sửa của tôi. **Không file mới nào của L3
  thêm một dòng nào vào hai danh sách này.**

### Hai lệnh riêng của màn này

```
$ grep -n "sourceColor" src/screens/pipeline/CadBranchConfirm/CadLayerPreviewCanvas.tsx
(rỗng)

$ grep -rn "sourceColor" src/screens/pipeline/CadBranchConfirm/ | grep -i canvas
src/screens/pipeline/CadBranchConfirm/CadLayerMappingPanel.tsx:33: * canvas xem trước tô theo VAI TRÒ, và không bao giờ chạm `sourceColor`.
```

Lệnh thứ nhất **rỗng** — đúng yêu cầu: canvas xem trước không chạm `sourceColor`.

Lệnh thứ hai **không rỗng, và không thể làm rỗng trong phạm vi được cấp.** Dòng
duy nhất in ra là một CHÚ THÍCH trong `CadLayerMappingPanel.tsx` — một trong tám
file L2 mà tôi bị cấm sửa — và nó lọt lưới vì `grep -i canvas` lọc theo NỘI DUNG
dòng chứ không theo tên tệp: câu chú thích ấy chứa cả chữ "canvas" lẫn chữ
`sourceColor`, và nội dung của nó nói đúng điều lệnh này muốn kiểm ("canvas xem
trước … không bao giờ chạm `sourceColor`"). Lọc theo tên tệp thì kết quả rỗng:

```
$ grep -rn "sourceColor" src/screens/pipeline/CadBranchConfirm/*Canvas*.tsx
(rỗng)
```

Tôi **không** sửa `CadLayerMappingPanel.tsx` để làm lệnh kia rỗng: đó là sửa file
ngoài phạm vi để làm vừa lòng một phép kiểm (R-70), và điều lệnh muốn kiểm thì đã
đúng rồi.

---

## 4. `pnpm verify` — bảng tổng kết nguyên văn

```
========================================================================
KIỂM TỔNG
========================================================================
  đạt       typecheck
  đạt       lint
  đạt       import vòng
  đạt       test + độ phủ
  đạt       build
  HỎNG      kích thước gói
  chưa chạy độ dài file

Dừng ở bước "kích thước gói" (mã thoát 1). Sửa mã cho đạt, không hạ ngưỡng và không tắt luật.
```

Bước 7 (`độ dài file`) **chưa chạy** trong `pnpm verify` vì cổng dừng ở bước 6.
Tôi chạy nó riêng để có số thật:

```
$ pnpm length
  nhắc   346 dòng  src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx
  nhắc   276 dòng  src/screens/pipeline/CadBranchConfirm/CadLayerPreviewCanvas.tsx

143 file đã quét · 17 vượt 250 · 0 vượt 400

Độ dài file: đạt.
```

---

## 5. Kích thước gói — phần đóng góp của MÀN NÀY

Cổng thứ 6 đỏ sẵn trước lượt này; nợ có sẵn, không phải do màn này. Đo phần đóng
góp bằng hai lượt `pnpm build && pnpm size` trên cùng cây mã:

| Lượt đo | tổng JS (gzip) | ngân sách | vượt |
|---|---|---|---|
| (1) route ĐÃ gắn — trạng thái giao nộp | **538,9 KiB** | 175 KiB | 363,9 KiB |
| (2) tạm gỡ hai dòng route trong `router.tsx` | **526,9 KiB** | 175 KiB | 351,9 KiB |
| **Hiệu số — phần màn này thêm vào** | **+12,0 KiB** | — | — |

`tổng CSS 9,2 KiB / 12 KiB` và `chunk JS lớn nhất 132,9 KiB / 170 KiB` **đạt** ở
cả hai lượt, không đổi giữa hai lượt.

Hai dòng route đã được HOÀN NGUYÊN ngay sau lượt đo (2) — `git diff --stat
src/routes/router.tsx` cho `1 file changed, 2 insertions(+)` so với `HEAD~1`, và
lượt build cuối cùng (số 538,9 KiB ở trên) là lượt build của cây đã hoàn nguyên.

Không ngưỡng nào trong `scripts/` bị hạ, không luật nào bị tắt, không ngân sách
nào bị sửa.

---

## 6. Ba lệnh bắt buộc — số thật

| Lệnh | Kết quả |
|---|---|
| `pnpm typecheck` | **0 lỗi** |
| `pnpm lint` | **0 error, 0 warning** (mã thoát 0) |
| `pnpm test` | **202 file, 4142 test — 4142 passed, 0 failed, 0 skipped** |

Test của riêng màn: `CadBranchConfirm.test.tsx` 17/17 xanh,
`useCadBranchConfirm.test.ts` 59/59 xanh (không sửa một dòng nào của nó).

---

## 7. Còn nợ gì

1. **Cổng kích thước gói vẫn đỏ** — nợ có sẵn trên `master`, vượt 363,9 KiB. Màn
   này đóng góp 12,0 KiB trong đó. Không xử lý trong phạm vi task này.
2. **`grep -rn "sourceColor" … | grep -i canvas` còn một dòng chú thích** trong
   `CadLayerMappingPanel.tsx` (xem mục 3). Làm nó rỗng đòi sửa một file L2 nằm
   ngoài phạm vi; cần điều phối viên quyết nếu muốn dọn.
3. **Chưa chạy Storybook thật.** Bảy story dựng theo khuôn và mọi export phụ đã
   vào `meta.excludeStories`, nhưng `pnpm storybook` chưa được mở để nhìn bằng
   mắt — `pnpm verify` không có bước nào dựng Storybook.
4. **Chưa chạy `pnpm e2e`.** Màn mới chưa có ảnh chuẩn Playwright; cổng visual
   của CI vốn đã thiếu ảnh `linux` (Bẫy số 6 trong CLAUDE.md).
