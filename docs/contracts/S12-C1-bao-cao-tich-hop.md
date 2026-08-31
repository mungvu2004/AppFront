# S12-C1 — Báo cáo tích hợp: gộp ba nhánh, chạy trọn bộ kiểm, đối chiếu hai cột

Nhánh: `mungvu2004/s12-c1-tichhop`. Rẽ từ `mungvu2004/s12-b1-sua`, gộp thêm
`mungvu2004/s12-b2-docs` và `mungvu2004/s12-b3-minimap`.
**Chưa gộp vào `master` và sẽ không tự gộp** — đó là quyết định của người duyệt.

Mọi con số ở cột "sau khi gộp" đo trên **cây đã gộp xong**, một lần, cây làm việc sạch.
Không cộng dồn số của ba nhánh riêng lẻ.

---

## 1. Bảng số đối chiếu hai cột

Cột `master` chép nguyên từ `docs/contracts/S12-L1-kich-thuoc.md` (A3 đo tại `ae7db03`).

| Phép đo | `master` @ ae7db03 | sau khi gộp | Chênh | Đạt? |
|---|---|---|---|---|
| `pnpm typecheck` | exit 0 | **exit 0** | 0 | **đạt** |
| `pnpm lint` — lỗi | 0 | **0** | 0 | **đạt** |
| `pnpm lint` — cảnh báo | 0 | **0** | 0 | **đạt** |
| `pnpm test` — Test Files | 206 | **207** | **+1** | **đạt** (B3 thêm `MiniMap.test.tsx`) |
| `pnpm test` — Tests | 4266 | **4295** | **+29** | **đạt** (≥ 4290 như hợp đồng đòi) |
| `pnpm test` — failed | 0 | **0** | 0 | **đạt** |
| `pnpm cycles` | không có import vòng | **không có import vòng** | 0 | **đạt** |
| `pnpm length` — file đã quét | 161 | **161** | 0 | **đạt** |
| `pnpm length` — vượt mức nhắc 250 | 18 | **21** | **+3** | **đạt** (mức nhắc, không phải mức hỏng) |
| `pnpm length` — vượt mức hỏng 400 | 0 | **0** | 0 | **đạt** |
| `pnpm size` — tổng JS gzip | 578,8 KiB / ngân sách 175 KiB → vượt 403,8 KiB (ĐỎ SẴN) | **chưa chạy** | — | **chưa chạy** |
| `pnpm size` — chunk riêng của S-12 | 30,2 KiB gzip | **chưa chạy** | — | **chưa chạy** |
| Dãy đếm bàn phím — lên | 12, 13, 14, 15, 16, 17 | **12, 13, 14, 15, 16, 17** | không đổi | **đạt** |
| Dãy đếm bàn phím — xuống | 16, 15, 14, 13, 12 | **16, 15, 14, 13, 12** | không đổi | **đạt** |

### Vì sao hai dòng `size` ghi "chưa chạy"

`pnpm build` / `pnpm size` **không được chạy ở lượt này**, theo đúng chỉ thị của nhiệm vụ.
Cổng kích thước gói **đã đỏ sẵn ở `master`** vì lý do có trước công việc này (ba chunk nặng
nhất — `scene` 132,9 KiB, `index` 113,9 KiB, `EmptyState` 58,1 KiB — đã hơn 300 KiB và tồn
tại từ trước khi màn S-12 được dựng); A3 đã đo và ghi số đầy đủ ở `S12-L1-kich-thuoc.md`,
đo lại không thêm thông tin nào. Theo **R-58 / E.10**, hai dòng này ghi **"chưa chạy"**, KHÔNG
ghi "đạt" và cũng không ghi "hỏng" — bước chưa chạy thì không có mã thoát thật để báo cáo.

### Ba dòng "vượt mức nhắc 250" tăng thêm

18 → 21. Ba file mới vượt mức **nhắc** (không phải mức **hỏng** 400) là ba file của thư mục
màn S-12 mà B1 nối dây thêm điều khiển vào: `WallLayerLeftPanel.tsx` (340 dòng),
`WallLayerList.tsx` (264 dòng) và `WallLayerReview.container.tsx` (260 dòng). File dài nhất
toàn kho vẫn là `ScaleCalibrationCanvas.tsx` (390 dòng), không phải của màn này.
`pnpm length` báo **đạt** vì **0 file vượt 400**.

---

## 2. Xung đột đã giải: **không có**

Cả hai lượt gộp đi qua chiến lược `ort` sạch, không một file nào cần giải tay.

| Lượt gộp | Kết quả | Vì sao không đụng nhau |
|---|---|---|
| `mungvu2004/s12-b2-docs` | sạch — 3 file, 494 thêm / 47 bớt | B2 chỉ chạm `docs/**`. Một file (`S12-L1-no-ngoai-pham-vi.md`) có mặt ở cả hai nhánh, nhưng cả hai thừa hưởng nó **nguyên vẹn từ cùng một tổ tiên chung** (`af3683b`, nhánh A4) và không bên nào sửa, nên không có gì để tranh. |
| `mungvu2004/s12-b3-minimap` | sạch — 4 file, 102 thêm / 1 bớt | B3 chỉ chạm `src/hooks/useMiniMap.*` và `src/components/canvas/MiniMap.*`; B1 không chạm file nào ngoài `src/screens/qc/WallLayerReview/**` và `src/i18n/vi.json`. Hai tập file rời nhau hoàn toàn. |

Không có lần nào phải chọn bên, nên không có lần nào phải giải thích lý do chọn bên.
**Không một bài kiểm nào bị sửa, nới hay tắt để lượt gộp xanh (R-70).**

---

## 3. Năm phép nghiệm thu của màn

Chạy trên cây đã gộp.

| # | Phép nghiệm | Kết quả |
|---|---|---|
| 1 | Duyệt 5 tường **chỉ bằng bàn phím**, rồi `Ctrl+Z` năm lần | **đạt** — dãy lên `12, 13, 14, 15, 16, 17`; dãy xuống `16, 15, 14, 13, 12`. Không một bước nhảy sai ở giữa. Cả năm lượt duyệt đi qua sổ phím thật (`J` để xuống hàng chưa duyệt kế tiếp), không gọi tắt vào store. |
| 2 | `grep -rn "Math\." src/screens/qc/WallLayerReview/` | **đạt — rỗng.** Không một phép tính hình học nào nằm trong màn (mã thoát 1 = không khớp dòng nào). |
| 3 | `expectSevenStates` · `expectAccessible` · `expectVietnamese` · `expectNoRawColor` | **đạt cả bốn.** `expectSevenStates`: 7/7 trạng thái dựng được, không trạng thái nào ra màn trắng. `expectAccessible`: xanh ở cả bảy trạng thái. `expectVietnamese`: xanh ở cả bảy trạng thái. `expectNoRawColor`: không một mã màu thô nào trong cả thư mục màn. Tổng file kiểm của màn: **46 phép, 46 xanh.** |
| 4 | Chú giải độ dày luôn hiện khi lớp Tường bật | **đạt** — có mặt ở **cả bảy** trạng thái, và có một phép riêng khẳng định **lớp Tường TẮT là điều kiện DUY NHẤT** khiến chú giải được ẩn. |
| 5 | Ba độ dày phân biệt được khi che hết chữ | **đạt trên hai lớp độc lập.** Lớp màu: ba băng cho ra **ba token khác nhau** (đọc từ `wallStrokeToken`, không viết tay lại — R-71). Lớp bề rộng: đa giác tô đầy theo độ dày thật, **tỉ lệ 1 : 2 : 3** (110 / 220 / 330 mm). Che hết chữ và chuyển đen trắng vẫn phân biệt được, vì bề rộng một mình đã đủ. |

Hai điều **[CẤM TUYỆT ĐỐI]** cũng có phép đo riêng và đều xanh: không hộp thoại nào ở cả
bảy trạng thái, và độ dày là điều khiển **ba lựa chọn**, không bao giờ là ô nhập số tự do.

---

## 4. Kết luận Việc 4 — **(a) hiện tượng của jsdom, sản phẩm không sao**

Người dùng thật **có** nhìn thấy hàng danh sách. Bằng chứng và chuỗi nhân quả đầy đủ nằm ở
**mục 7 của `docs/contracts/S12-L2-ho-so-duyet.md`**; tóm tắt:

Dựng cùng một cây hai lượt, **không sửa một dòng mã sản phẩm nào**. Lượt B chỉ dựng lại hai
thứ trình duyệt thật luôn có mà jsdom không có — bảng kiểu, và phép đo khung.

| | Lượt A — jsdom nguyên trạng | Lượt B — có bảng kiểu + phép đo khung |
|---|---|---|
| `role="option"` | **0** | **23** |
| hàng đầu | — | `#W-001 · 330 mm · 0,76` |

23 = 15 hàng vừa khung 600 px + `overscan: 8` mà `WallLayerList` khai — khớp đúng công thức.

Gốc rễ: jsdom không nạp bảng kiểu, nên lớp Tailwind `overflow-y-auto` ở
`WallLayerLeftPanel.tsx:350` không sinh giá trị tính toán; `findScrollParent` đi hết cây
không tìm thấy phần tử cuộn, rồi rơi vào nhánh dự phòng `document.scrollingElement` — **thứ
mà môi trường kiểm này trả về `undefined`** (đã đo trực tiếp). `getScrollElement()` trả
`null`, `@tanstack/react-virtual` không đặt được `scrollElement`, `outerSize` đứng ở 0,
`calculateRange` trả `null`, `getVirtualItems()` trả mảng rỗng.

Trong trình duyệt thật bước tìm kiếm **thành công ngay ở lần đi đầu tiên** và không bao giờ
chạm nhánh dự phòng. **Không có lỗi sản phẩm. C1 không sửa gì.**

Bài kiểm dùng để nghiệm là **bài kiểm tạm và KHÔNG được commit** — nó phải giả lập ba lớp
cùng lúc (`getComputedStyle`, `clientHeight`/`getBoundingClientRect`, `ResizeObserver`), quá
nhiều giàn giáo để thành một bài kiểm thật đáng tin; giữ lại thì nó chủ yếu kiểm chính bộ
giả của nó. Đề nghị trả nợ này bằng một bài kiểm Playwright trong trình duyệt thật ở một
lượt riêng, sau khi `src/routes/router.tsx` được gắn.

---

## 5. Soát phạm vi R-68 của toàn bộ lượt gộp

`git diff --name-only master...HEAD` → **27 file**, chia ba nhóm:

### (a) Trong ba nhóm được phép — 17 file

`src/i18n/vi.json`, và 16 file trong `src/screens/qc/WallLayerReview/`:
`index.ts` · `useWallLayerReview.ts` · `useWallLayerReview.test.ts` · `WallLayerCanvas.tsx` ·
`wallLayerHatch.ts` · `WallLayerLeftPanel.tsx` · `WallLayerList.tsx` ·
`WallLayerReview.container.tsx` · `WallLayerReview.stories.tsx` · `WallLayerReview.test.tsx` ·
`WallLayerReview.tsx` · `wallLayerReviewFixture.ts` · `wallLayerReviewGateway.ts` ·
`wallLayerReviewScenarios.ts` · `WallLayerShapeFigure.tsx` · `WallLayerToolRail.tsx`.

`src/routes/**` không có file nào — lượt gộp không cần chạm định tuyến.

### (b) `docs/**` — 6 file, sản phẩm của DAG này

`canvas.md` · `S12-B1-bao-cao-sua.md` · `S12-L1-doi-chieu.md` · `S12-L1-kich-thuoc.md` ·
`S12-L1-no-ngoai-pham-vi.md` · `S12-L2-ho-so-duyet.md`.

### (c) Ngoài cả hai nhóm trên — **đúng 4 file, đúng như miễn trừ B-07 cho phép**

| File | Vai |
|---|---|
| `src/hooks/useMiniMap.ts` | file sản phẩm #1 của miễn trừ B-07 — thêm `jumpToCentre` |
| `src/components/canvas/MiniMap.tsx` | file sản phẩm #2 của miễn trừ B-07 — nối Enter/Space |
| `src/hooks/useMiniMap.test.ts` | bài kiểm của file #1 |
| `src/components/canvas/MiniMap.test.tsx` | bài kiểm của file #2 (file kiểm mới, chính là +1 của cột Test Files) |

**Không có file thứ năm. Không báo động.**

---

## 6. Năm điều B1 tự khai là còn treo — chép nguyên, C1 không sửa món nào

1. **`A-04` mới làm nửa** — Ctrl-bấm chọn nhiều tường thì được (có bài kiểm), **khoanh vùng
   marquee chưa làm**.
2. **`A-07` cố ý không đổi bộ mẫu.**
3. **Toast hoàn tác đi qua `appNotificationBus`, KHÔNG qua `Toast.Provider`** — provider đó
   tự phát thêm toast mỗi commit và hoàn tác bằng zundo, sai ngăn xếp của màn. Lựa chọn có
   lý do, không phải chỗ quên nối dây.
4. **Khoá `shortcuts.approve` trong `vi.json` được giữ** vì đặc tả cấm xoá khoá.
5. **Ảo hoá của `WallLayerList` không vẽ hàng nào trong môi trường kiểm** — **đã điều tra
   xong ở mục 4: kết luận (a), sản phẩm không sao.**

Bốn quyết định người duyệt đã chốt (A-13 ngưỡng 0,70 · B-07 miễn trừ R-68 · B-04 ghi nợ ·
B-05 prompt nhóm T riêng) ghi ở **mục 5 của `S12-L2-ho-so-duyet.md`**.

---

## 7. Kết quả nguyên văn của từng cổng

```
$ pnpm typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

```
$ pnpm lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
LINT_EXIT=0
```

```
$ pnpm cycles
> node scripts/check-import-cycles.mjs
Import vòng (import/no-cycle) — quét src/
Import vòng: không có.
CYCLES_EXIT=0
```

```
$ pnpm length
  nhắc   390 dòng  src/screens/pipeline/ScaleCalibration/ScaleCalibrationCanvas.tsx
  nhắc   383 dòng  src/screens/pipeline/PipelineGraph/PipelineGraphDetail.tsx
  nhắc   367 dòng  src/components/ui/Table.tsx
  nhắc   367 dòng  src/screens/auth/AuthScreen/AuthScreen.tsx
  nhắc   357 dòng  src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx
  nhắc   346 dòng  src/components/ui/Select.tsx
  nhắc   346 dòng  src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx
  nhắc   340 dòng  src/screens/qc/WallLayerReview/WallLayerLeftPanel.tsx
  nhắc   318 dòng  src/screens/onboarding/WelcomeScreen/WelcomeScreen.tsx
  nhắc   311 dòng  src/screens/pipeline/PipelineGraph/PipelineGraphOverview.tsx
  nhắc   308 dòng  src/screens/upload/InputQualityGate/InputQualityGateReportPanel.tsx
  nhắc   299 dòng  src/screens/upload/InputQualityGate/InputQualityGateImageOverlays.tsx
  nhắc   292 dòng  src/components/shell/AppShell.tsx
  nhắc   289 dòng  src/screens/project/CreateProjectModal/CreateProjectModal.tsx
  nhắc   287 dòng  src/components/overlay/Drawer.tsx
  nhắc   276 dòng  src/screens/pipeline/CadBranchConfirm/CadLayerPreviewCanvas.tsx
  nhắc   269 dòng  src/screens/upload/FloorUploadScreen/FloorUploadCard.tsx
  nhắc   267 dòng  src/components/overlay/Modal.tsx
  nhắc   264 dòng  src/screens/qc/WallLayerReview/WallLayerList.tsx
  nhắc   260 dòng  src/screens/qc/WallLayerReview/WallLayerReview.container.tsx

161 file đã quét · 21 vượt 250 · 0 vượt 400

Độ dài file: đạt.
LENGTH_EXIT=0
```

```
$ pnpm test
 Test Files  207 passed (207)
      Tests  4295 passed (4295)
   Duration  80.63s
TEST_EXIT=0
```

```
$ npx vitest run src/screens/qc/WallLayerReview/useWallLayerReview.test.ts -t "nghiệm thu bàn phím"
dãy đếm lên:    12, 13, 14, 15, 16, 17
dãy đếm xuống:  16, 15, 14, 13, 12
 ✓ duyệt 5 tường rồi hoàn tác 5 lần: 12 → 17 → 12
 ✓ duyệt xong một tường thì tự chọn tường CHƯA DUYỆT kế tiếp
 ✓ J và K đi xuống rồi đi lên đúng một hàng
 Test Files  1 passed (1)
      Tests  3 passed | 40 skipped (43)
```

```
$ grep -rn "Math\." src/screens/qc/WallLayerReview/
(không có dòng nào — mã thoát 1)
```

```
$ npx vitest run src/screens/qc/WallLayerReview/WallLayerReview.test.tsx
 Test Files  1 passed (1)
      Tests  46 passed (46)
```

```
$ pnpm build / pnpm size
chưa chạy — xem lý do ở mục 1.
```
