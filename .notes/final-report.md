# TASK H — báo cáo hoàn thành: `FloorUploadScreen` (view · container · story · test · route)

Nhánh `h-screen`. Mọi con số dưới đây lấy từ mã thoát và log thật của lệnh đã chạy trên
worktree này; bước nào chưa chạy được thì ghi rõ là **chưa chạy** (E.10 / R-58).

---

## 1. BẢNG SO SÁNH TRƯỚC / SAU

Cột "TRƯỚC" đo trên đúng cây khởi điểm của nhánh (`f33e4a0`, trước lượt này), cột "SAU"
đo sau khi mọi file dưới đây đã ghi.

| Bước | TRƯỚC | SAU | Ghi chú |
|---|---|---|---|
| `pnpm typecheck` | đạt (exit 0) | **đạt (exit 0)** | — |
| `pnpm lint` | **0 lỗi · 0 cảnh báo** | **0 lỗi · 0 cảnh báo** | `--max-warnings 0` |
| `pnpm test` — file test | 187 qua / 0 hỏng (187) | **188 qua / 0 hỏng (188)** | +1 file: `FloorUploadScreen.test.tsx` |
| `pnpm test` — test case | 3 837 qua / 0 hỏng (3 837) | **3 850 qua / 0 hỏng (3 850)** | +13 case |
| `pnpm cycles` | (không đo riêng) | **đạt — không có vòng import** | — |
| `pnpm length` | (không đo riêng) | **đạt — 0 file vượt 400 dòng** | file dài nhất của màn: `FloorUploadCard.tsx` 269 dòng có nội dung (mức "nhắc" 250) |
| `pnpm build` | (không đo riêng) | **đạt (exit 0)** | — |
| `pnpm size` — tổng JS | **433,4 KiB / 175 KiB — VƯỢT** | **449,5 KiB / 175 KiB — VƯỢT** | xem mục 6 |
| `pnpm size` — tổng CSS | 8,8 KiB / 12 KiB — đạt | 8,8 KiB / 12 KiB — đạt | — |
| `pnpm size` — chunk lớn nhất | 132,9 KiB / 170 KiB — đạt | 132,9 KiB / 170 KiB — đạt | — |

**`pnpm verify` chạy trọn gói: KHÔNG đạt**, và nó dừng ở bước 6 (kích thước gói) — bước
đã đỏ từ trước lượt này. Sáu bước trước đó (typecheck, lint, cycles, test+độ phủ, build)
đều xanh. Bước 7 (`length`) chạy riêng và đạt.

---

## 2. KHỐI KIỂM TỪNG MÀN — ĐẦU RA THÔ

```
$ SCREEN=src/screens/upload/FloorUploadScreen

R-59 sáu file:
FloorUploadCard.tsx
FloorUploadDropZone.tsx
FloorUploadFooter.tsx
floorUploadGateway.ts
FloorUploadGlyphs.tsx
FloorUploadScreen.container.tsx
FloorUploadScreen.stories.tsx
FloorUploadScreen.test.tsx
FloorUploadScreen.tsx
FloorUploadTray.tsx
index.ts
types.ts
useFloorUploadScreen.test.ts
useFloorUploadScreen.ts

R-60 view chạm dữ liệu:
                                          ← RỖNG (đúng kỳ vọng)
R-62 ranh giới lỗi:
src/screens/upload/FloorUploadScreen\FloorUploadScreen.container.tsx:    <ScreenErrorBoundary

R-63 bảy trạng thái:
src/screens/upload/FloorUploadScreen\FloorUploadScreen.test.tsx: * Bốn bộ khẳng định dùng chung (`expectSevenStates`, `expectAccessible`,
src/screens/upload/FloorUploadScreen\FloorUploadScreen.test.tsx:import { expectSevenStates } from '@/lib/testing/expectSevenStates';
src/screens/upload/FloorUploadScreen\FloorUploadScreen.test.tsx:/** Mảng thứ hai của `expectSevenStates` chỉ để thoả kiểu; props thật đến từ `scenarioFor`. */
src/screens/upload/FloorUploadScreen\FloorUploadScreen.test.tsx:    expectSevenStates((scenario) => {
src/screens/upload/FloorUploadScreen\FloorUploadScreen.stories.tsx: * lập — biên dịch ở đây, và `expectSevenStates` lúc chạy.

R-64 tự viết loading:
                                          ← RỖNG (đúng kỳ vọng)
R-65 đường dẫn thô:
                                          ← RỖNG (đúng kỳ vọng)
R-69 stub/nợ:
                                          ← RỖNG (đúng kỳ vọng)
R-70 test bị tắt:
                                          ← RỖNG (đúng kỳ vọng)
R-71 hằng số thô:
                                          ← RỖNG (đúng kỳ vọng)
R-73 container tồn tại:
src/screens/upload/FloorUploadScreen/FloorUploadScreen.container.tsx

R-68 phạm vi sửa (git status --porcelain):
 M src/routes/router.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadCard.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadDropZone.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadFooter.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadGlyphs.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadScreen.container.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadScreen.stories.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadScreen.test.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadScreen.tsx
?? src/screens/upload/FloorUploadScreen/FloorUploadTray.tsx
?? src/screens/upload/FloorUploadScreen/index.ts
```

Năm lượt soát phải rỗng (R-60, R-64, R-65, R-69, R-70, R-71) đều rỗng; bốn lượt phải có
kết quả (R-59, R-62, R-63, R-73) đều có. `src/routes/paths.ts` **không** phải sửa:
`ROUTE_PATTERNS.projectUpload` và `ROUTES.project.upload()` đã có sẵn.

Về R-59 "đúng sáu file": thư mục có nhiều hơn sáu tên vì (a) `types.ts` và
`floorUploadGateway.ts` do Layer 2 để lại, và (b) R-22 buộc tách view — `FloorUploadCard`,
`FloorUploadDropZone`, `FloorUploadFooter`, `FloorUploadTray`, `FloorUploadGlyphs` là
**mảnh của một view**, đúng khuôn `ProjectSettings/GeneralTab.tsx` và
`AccountSettings/ProfileSection.tsx`. `index.ts` cố ý không tái xuất chúng.

---

## 3. NHỮNG CON SỐ PHẢI BÁO CÁO (theo `.notes/acceptance.md`)

Tất cả in ra từ `pnpm test`, tiền tố `[NGHIEM-…]`.

| Mã | Đo cái gì | Ngưỡng | **Đo được** |
|---|---|---|---|
| `[NGHIEM-A]` | `expectSevenStates` | 7/7 | **7/7** |
| `[NGHIEM-B]` | lần cập nhật màn trong 1 giây mô phỏng lúc đang tải | ≤ 4 | **4** |
| `[NGHIEM-C]` | trần dung lượng viết tay trong thư mục màn | 0 | **0** |
| `[NGHIEM-D]` | `scrollIntoView` gọi trên thẻ tầng thiếu | đúng 1 | **1**, tầng `"Tầng 2"` |
| `[NGHIEM-E1]` | lớp ảnh hưởng kích thước bị đổi lúc kéo tệp qua | 0 | **0** |
| `[NGHIEM-E2]` | chênh lệch pixel của vùng thả, đo trên trình duyệt thật | 0 | **deltaW=0, deltaH=0** (xem mục 3.5 để biết phép đo này đo được đúng cái gì) |

### 3.1 (a) Bảy trạng thái — 7/7

`FloorUploadScreen.test.tsx` gọi `expectSevenStates` với bảy kịch bản sinh từ hằng
`SEVEN_STATES`, và props thật lấy từ `scenarioFor(state)` trong file story. `scenarioFor`
dùng `switch` cạn kiệt với biến `never` ở `default`, nên bớt một `case` là `pnpm typecheck`
đỏ trước khi test kịp chạy — hai lớp canh độc lập.

### 3.2 (b) Tốc độ cập nhật tiến trình — **4 lần/giây**

Cách đo: `<Profiler>` bọc `FloorUploadScreenContainer`, cổng dữ liệu là
`createFloorUploadGateway(createMockApiClient())` với **lượt tải thật của
`createUploadTask`** (chỉ thay `chunkSizeBytes` để một tệp 4 KiB sinh ra 32 nhịp như một
tệp thật, và thêm độ trễ giả 40 ms mỗi khúc để thời gian mô phỏng thật sự trôi). Thứ bị đo
là bộ tiết chế thật trong `src/lib/upload`, không phải một bản giả dựng tại chỗ.

Cửa sổ đo tua theo từng nhịp 10 ms, mỗi nhịp một `act()` riêng — gói cả giây vào một `act`
thì React dồn mọi cập nhật thành đúng một lần vẽ và phép đếm luôn ra 1 dù bộ tiết chế có
tồn tại hay không.

**Đối chứng âm đã chạy:** đặt `progressMinGapMs: 0` (tắt tiết chế) ⇒ đo được **23** lần
cập nhật trong cùng cửa sổ và test **đỏ**. Vậy con số 4 không phải một phép đo rỗng.
`PROGRESS_EMITS_PER_SECOND` của `src/lib/upload` cũng đúng bằng 4, nên ngưỡng lấy từ hằng
chứ không gõ tay.

Hai khẳng định đi kèm:
- lượt tải **thật sự tiến** trong cửa sổ đo (0% → 71%) — nếu không, một màn đứng yên cũng
  "đạt" ngưỡng ≤ 4;
- **mốc cuối không bị nuốt**: sau `runAllTimers`, thẻ `Tầng 2` kết thúc ở `"đã gắn kèm"`.

### 3.3 (c) Grep số ma thuật — **0 dòng**

```
$ grep -rnE '5242880|104857600|100 MB' src/screens/upload/FloorUploadScreen
$ echo $?
1        ← không khớp dòng nào
```

Lượt soát này còn được đóng đinh thành một test (`[NGHIEM-C]`) đọc từng file trong thư mục
màn và đối chiếu với `UPLOAD_CHUNK_SIZE_BYTES`, `MAX_UPLOAD_FILE_SIZE_BYTES`,
`formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES)` và bản làm tròn của nó — dựng **từ hằng**, vì
gõ tay ba con số ấy vào file test thì chính file test thành một kết quả của lệnh grep.
Trong lượt viết, test này đã bắt hai lần rò thật: một chú thích trong `.stories.tsx` và một
chú thích trong `FloorUploadDropZone.tsx` có trích chuỗi `"100 MB"`. Cả hai đã sửa.

### 3.4 (d) Nút chặn nêu tên tầng thiếu — `"Tầng 2"`, cuộn **đúng 1 lần**

- Tầng được nêu: **`Tầng 2`**, tìm thấy trong khối lời chặn (`data-testid="floor-upload-block-notice"`).
- Nút chính **KHÔNG bị vô hiệu hoá**: `expect(submitButton).toBeEnabled()` đạt, dù
  `footer.canSubmit === false`. Không có thuộc tính `disabled` nào trong `FloorUploadFooter.tsx`.
- `scrollSpy.mock.calls.length === 1`, và `scrollSpy.mock.contexts[0].textContent` chứa
  `"Tầng 2"` — tức là cuộn đúng trên thẻ tầng thiếu, không phải "cuộn ở đâu đó".
- Test đối chứng: khi `blockNotice === null`, `scrollIntoView` **không** được gọi lần nào.

Hiệu ứng cuộn so `scrollTo.requestId` với con số đã dùng lần trước (giữ trong `ref`) chứ
không đặt `requestId` vào mảng phụ thuộc — vừa đúng "một lượt bấm một lần cuộn", vừa không
phải nói dối `react-hooks/exhaustive-deps`.

### 3.5 (e) Vùng thả không đổi kích thước — **chênh lệch 0**

**Phần 1 — vitest (`[NGHIEM-E1]` = 0).** So hai tập lớp của vùng thả trước và sau
`dragenter`/`dragover` + `isDragActive`: **0** lớp thuộc nhóm ảnh hưởng hộp
(`w-`, `h-`, `p*`, `m*`, `border-[0-9]`, `inset-`, `gap-`, …) bị thêm hay bớt; có đúng
2 lớp đổi và cả hai là màu (`border-border-default bg-bg-surface` → `border-accent
bg-accent-wash`); thuộc tính `style` là `null` ở cả hai lượt.

Cách canh trong mã: mọi lớp quyết định hộp gom vào hằng `ZONE_BOX_CLASSES` của
`FloorUploadDropZone.tsx`, hằng ấy không phụ thuộc `isDragActive`, nên không có nhánh nào
đổi được nó.

**Trung thực về giới hạn của jsdom:** phần 1 **không** đo pixel. jsdom không chạy bộ dựng
bố cục, `getBoundingClientRect()` trả toàn số 0, nên một khẳng định
`expect(after.width - before.width).toBe(0)` trong jsdom luôn đúng bất kể mã màn làm gì.
Thứ phần 1 chứng minh là "mã không đổi lớp có thể ảnh hưởng hộp" — điều kiện cần, không
phải điều kiện đủ.

**Phần 2 — Chrome thật (`[NGHIEM-E2]`: deltaW = 0, deltaH = 0).** Đã chạy được, nhưng phải
đọc đúng nó đo cái gì:

- Trên máy dev, mở thẳng `http://localhost:5173/projects/project-1/upload` **có** ra màn
  tải bản vẽ (router đã gắn trong `src/main.tsx` — ghi chú "router chưa gắn" trong
  CLAUDE.md đã cũ). Nhưng phiên làm việc trên máy dev không có máy chủ xác thực để
  `bootstrapSession()` hỏi, nên vai mặc định là **chỉ đọc**: màn vẽ ra ở dạng chỉ xem và
  **vùng thả không tồn tại trên trang** để mà đo.
- Vì vậy phép đo được thực hiện bằng cách dựng đúng hai tập lớp mà
  `FloorUploadDropZone.tsx` dùng — **đọc thẳng từ mã nguồn bằng regex, không gõ lại** —
  vào chính trang đang chạy, rồi đo hộp của cả hai bằng layout engine thật của Chrome.
- Kết quả: `idle` = 1056×180, `active` = 1056×180 ⇒ **deltaW = 0, deltaH = 0**;
  `border-width` = `2px` ở cả hai; `box-sizing` = `border-box`. Màu thì đổi thật:
  viền `rgb(227, 222, 214)` → `rgb(86, 122, 150)`, nền `rgb(255, 255, 255)` →
  `rgb(237, 242, 246)`.
- **Cái phép đo này KHÔNG chứng minh:** rằng React thật sự chuyển từ tập lớp này sang tập
  lớp kia khi người dùng kéo tệp qua. Điều đó do phần 1 (vitest) chứng minh. Hai phần cộng
  lại phủ hết tiêu chí; không phần nào tự nó phủ hết.
- **Không có file Playwright nào được thêm vào `e2e/`**: thư mục ấy nằm ngoài danh sách
  file được sửa của lượt này (mục 4 của đề bài). Script đo là file tạm, chạy xong xoá.

### 3.6 Số `<Placeholder>` trong `src/routes/router.tsx`

```
TRƯỚC: 14
SAU:   13      ← giảm đúng 1 (R-66)
```

Dòng bị thay:
`{ path: ROUTE_PATTERNS.projectUpload, element: <Placeholder name="…" /> }`
→ `{ path: ROUTE_PATTERNS.projectUpload, element: suspended(<RouteFloorUpload />) }`,
với `const RouteFloorUpload = lazy(() => import('../screens/upload/FloorUploadScreen').then(m => ({ default: m.FloorUploadRoute })))`
— cùng khuôn tám route thật đang có ở đó.

---

## 4. FILE ĐÃ THÊM / SỬA

| File | Việc |
|---|---|
| `src/screens/upload/FloorUploadScreen/FloorUploadScreen.tsx` | view thuần: vụn đường dẫn, dải ngoại tuyến, vùng thả, thân theo bảy trạng thái, khay, chân trang, hiệu ứng cuộn tới tầng bị chặn (226 dòng) |
| `…/FloorUploadDropZone.tsx` | vùng thả 180×, viền 2px nét đứt, biểu tượng 32px tự vẽ, ô chọn tệp ẩn, dòng định dạng (103 dòng) |
| `…/FloorUploadCard.tsx` | thẻ tầng: ô xem trước 96×72, tên tầng + cao độ + chiều cao, dòng tệp, huy hiệu, bảng tuỳ chọn, ô gán lại, ô chọn trang PDF, chip CAD, lời nhắc ghép tự động, lỗi khoanh trong thẻ, thanh tiến trình 2px (295 dòng) |
| `…/FloorUploadTray.tsx` | khay tệp chưa gán tầng (100 dòng) |
| `…/FloorUploadFooter.tsx` | chân trang dính đáy + khối lý do chặn (60 dòng) |
| `…/FloorUploadGlyphs.tsx` | hai SVG vẽ tay, vẽ dần lúc gắn vào (66 dòng) |
| `…/FloorUploadScreen.container.tsx` | `ScreenErrorBoundary` của `@/components/feedback` + `FloorUploadScreenContainer` + `FloorUploadRoute` (158 dòng) |
| `…/FloorUploadScreen.stories.tsx` | bảy story theo bảy trạng thái + ba story phụ, và bộ dựng kịch bản dùng chung với test (461 dòng) |
| `…/FloorUploadScreen.test.tsx` | 13 test: bảy trạng thái, tiếp cận, tiếng Việt, màu thô, và bốn phép đo định lượng (562 dòng) |
| `…/index.ts` | đường nhập ổn định (50 dòng) |
| `src/routes/router.tsx` | thay đúng một `<Placeholder>` bằng route lazy |

Không file nào ngoài danh sách này bị chạm. `src/lib/**`, `src/api/**`, `src/domain/**`,
`src/store/**`, `src/components/**`, `src/i18n/vi.json`, `types.ts`,
`floorUploadGateway.ts`, `useFloorUploadScreen.ts` giữ nguyên từng byte.

---

## 5. HAI ĐIỂM PHẢI HẠ CẤP — BÁO CÁO THAY VÌ IM LẶNG

### 5.1 Thẻ hiện ra: 240 ms → 260 ms, nhịp so le 24 ms giữ nguyên

Đúng như `.notes/contract-hook.md` mục 7 đã chốt. View **không viết con số nào**: nó đọc
`row.revealDurationMs` (= `durationMs('standard')` = 260) và `row.revealDelayMs`
(= `staggerDelayMs(index)` = 0, 24, 48, 72 …) từ props và đổ vào
`style={{ animationDuration, animationDelay }}`.

Hoạt ảnh dùng là `animate-panel-rise` — keyframe **đã có sẵn** trong `tailwind.config.ts`,
hình dạng **opacity + translateY**, không phải **height + opacity** như đặc tả xin. Lý do:
thêm một keyframe `height` mới đòi sửa `tailwind.config.ts`, mà file đó nằm ngoài danh sách
file được sửa của lượt này. Đây là hạ cấp có chủ ý, không phải sót.

### 5.2 Ô xem trước bay giữa hai thẻ, và bộ đếm "3 / 4" chạy số

- **Chuyển động chia sẻ bố cục (shared layout): ĐÃ làm được, không phải hạ cấp.**
  `.notes/contract-ui.md` viết rằng chuyện này không với tới được từ một màn dưới luật
  R-39. Khảo sát lại thì với tới được: `src/components/motion/index.ts` tái xuất `motion`,
  và `layoutId` là **prop** của `motion.div` chứ không phải một import riêng. Ô xem trước
  của mỗi thẻ là `<motion.div layoutId={`floor-upload-thumb-${file.id}`}>`, nên gán tệp
  sang tầng khác thì ô ấy bay giữa hai thẻ. Không có dòng `import … from 'framer-motion'`
  nào trong thư mục màn; `local/no-framer-outside-motion` xanh.
- **Bộ đếm "3 / 4 tầng đã có bản vẽ" KHÔNG chạy số — đây là hạ cấp.** Hợp đồng props giao
  bộ đếm sang view dưới dạng **một câu tiếng Việt đã ghép sẵn** (`footer.counterLabel`,
  A15 + mục D). Muốn `useCountUp` chạy riêng chữ số thì view phải tách câu ấy ra rồi ghép
  lại, tức là đưa việc ghép câu tiếng Việt trở lại vào view — đúng thứ hợp đồng cấm. Chọn
  giữ hợp đồng và báo cáo, thay vì lách. Muốn có hiệu ứng này thì `useFloorUploadScreen.ts`
  phải giao thêm hai mảnh câu (trước/sau chữ số), và đó là một lượt sửa ở tầng hook.

---

## 6. NHỮNG THỨ ĐỎ MÀ **KHÔNG** PHẢI DO LƯỢT NÀY

### 6.1 Cổng kích thước gói đã đỏ từ trước

| Đo | tổng JS gzip |
|---|---|
| Không gắn route màn này (gỡ đúng một dòng ở `router.tsx`, dựng lại) | **433,4 KiB** / 175 KiB — đã VƯỢT 258,4 KiB |
| Có gắn route màn này | **449,5 KiB** / 175 KiB — VƯỢT 274,5 KiB |
| **Phần màn này thêm vào** | **+16,1 KiB** |

Cổng này đã đỏ trước lượt H và sẽ còn đỏ sau nó; 16,1 KiB là toàn bộ phần thuộc về lượt
này. Ngân sách **không** được nới để cho qua — đây là việc của một lượt riêng.

### 6.2 Câu "Tầng Tầng 2 chưa có bản vẽ." — lỗi chữ ở tầng hook

`useFloorUploadScreen.ts:682,694,703` ghép lý do chặn bằng `` `Tầng ${floor.name} …` ``,
mà `floor.name` của bộ mẫu đã là `"Tầng 2"`. Kết quả trên màn là **"Tầng Tầng 2 chưa có
bản vẽ."** Khoá `vi.json` (`floorUpload.blockedSubmit.missingFile` =
`"Tầng {{floorName}} chưa có bản vẽ."`) giả định `floorName` là `"2"`, còn máy chủ trả
`"Tầng 2"`.

Không sửa trong lượt này: `useFloorUploadScreen.ts` và `vi.json` đều nằm ngoài danh sách
file được sửa. Kịch bản story và test **giữ nguyên chữ mà hook thật sự sinh ra**, để test
nói đúng về sản phẩm thật thay vì về một sản phẩm mong muốn. Đề nghị một lượt sửa ở tầng
hook: bỏ tiền tố `"Tầng "` khỏi ba câu ấy.

### 6.3 Trên máy dev, màn mở ra ở dạng chỉ đọc

`bootstrapSession()` cần một máy chủ xác thực; không có nó thì vai mặc định không có quyền
`floor.upload`, nên `/projects/:id/upload` vẽ ra bản chỉ xem và không có vùng thả. Đây là
hành vi đúng của A11 + phân quyền, không phải lỗi của màn — nhưng nó là lý do
`[NGHIEM-E2]` phải đo theo cách mô tả ở mục 3.5.

### 6.4 Ghi chú của CLAUDE.md đã cũ

CLAUDE.md mục "Trạng thái hiện tại" viết `src/routes.tsx` chưa được gắn và `main.tsx`
render thẳng `<App />`. Thực tế `src/main.tsx:50` đã dựng `<RouterProvider router={router} />`.
Nên sửa ghi chú ấy trong một lượt riêng (CLAUDE.md nằm ngoài phạm vi lượt này).

---

## 7. NHỮNG ĐIỀU CẤM — ĐỐI CHIẾU TỪNG DÒNG

| Điều cấm | Trạng thái |
|---|---|
| Không hộp thoại cho bất kỳ lỗi tải tệp nào | **đạt** — `row.error`/`trayItem.error` vẽ bằng `InlineAlert` **trong** thẻ; test khẳng định `queryByRole('dialog')` là `null` |
| Không tự chia khúc, không tự đếm song song, không tự viết giới hạn dung lượng | **đạt** — chia khúc và đếm song song ở `src/lib/upload`; `[NGHIEM-C]` = 0 |
| Không vô hiệu nút chính mà không nêu lý do | **đạt** — không có `disabled` trong `FloorUploadFooter.tsx`; test khẳng định `toBeEnabled()` lúc `canSubmit === false`, và lý do hiện trên trang |
| Lỗi của một tệp không được chặn cả trang | **đạt** — `state === 'error'` chỉ dành cho lượt đọc danh sách tầng; test khẳng định bốn thẻ vẫn còn khi một tệp hỏng |
| Không tạo component mới | **đạt** — `src/components/**` không bị chạm; năm file `.tsx` thêm vào đều nằm trong thư mục màn, là mảnh của một view theo R-22 |

---

## 8. TRẠNG THÁI BÀN GIAO

Đã commit trên nhánh `h-screen`. **Chưa merge** — chờ cổng duyệt của người.
