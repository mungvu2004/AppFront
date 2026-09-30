# Bản đồ điều phối — lượt lập kế hoạch test tích hợp

Ghi lại **lượt chạy thật**, không phải lượt chạy dự kiến. Số đo trong tệp này là số
của máy này, ngày **2026-09-30**, và nó sẽ lệch khi máy khác chạy — đo lại trước khi
dùng làm ngân sách.

Run Orca: `run_93d9ed568733`
Thư mục điều phối: `C:/Users/mxuan/orca/dieu-phoi/e2e-plan/`
Nhánh làm việc: `e2e/prep` (base từ `mungvu2004/tich-hop-pascal`)

---

## 1. Dữ kiện máy — đo đầu lượt

| Thứ | Số thật |
|---|---|
| RAM | 23,7 GB tổng · **7,3 GB rảnh** lúc đo (Orca + Chrome đang chạy) |
| CPU | 12 luồng |
| Worktree AppFront tồn đọng lúc bắt đầu | **6** (đặc tả ghi 5) |
| — sau khi dọn | **1** còn lại: `t-verify`, **có 2 tệp chưa commit** nên cố ý giữ |
| Orca | app `running`, runtime `ready` v1.4.201 |
| `orca status --json` | **không** in trần đồng thời ⇒ trần thật là **RAM** |

**Dọn worktree trên Windows không sạch.** `git worktree remove --force` gỡ được cả sáu
khỏi `git worktree list`, nhưng bốn thư mục thật vẫn nằm lại trên đĩa với lỗi
`Filename too long`. Xoá được bằng `cmd //c rmdir //s //q "\\?\<đường>"`; hai thư mục
vẫn sót. Ngoài ra còn **bảy** thư mục của các lượt cũ hơn (`ad-merge`, `ad-view`,
`f01b-luong`, `f01b-review`, `f02-basemaster`, `s12-c1-tichhop`, `explodedview-logic`)
đã không còn là worktree của git. Dọn chúng là một việc riêng, không nằm trong lượt này.

---

## 2. Cổng nền — chạy TRƯỚC khi giao việc đầu tiên

Bắt buộc theo mục **E.10**: cổng đỏ sẵn thì đừng đổ cho test viết sau.

| Lệnh | Kết quả | Thời gian |
|---|---|---|
| `pnpm verify` | **7/7 đạt**, exit 0 | ~9 phút |
| — typecheck · lint · import vòng · test+độ phủ · build · kích thước gói · độ dài file | cả bảy `đạt` | |
| — độ phủ | 84,42 % stmts · 86,43 % branch · 80,11 % funcs | |
| — kích thước gói, sát trần nhất | "chi phí thêm cho một màn" **279,8 / 280 KiB — còn dư 0,2 KiB** | |
| `pnpm e2e` | **18 passed**, 0 failed, 0 skipped | 1,1 phút, 6 worker |

**Cổng kích thước gói còn dư 0,2 KiB.** Không liên quan tới e2e, nhưng ai thêm một
`import` vào đường tải của màn đầu tiên sẽ làm nó đỏ — ghi lại ở đây để lượt sau không
mất thời gian đi tìm thủ phạm (xem cả bài học "đo nhánh gốc trước khi kết luận").

---

## 3. Việc P0 — cổng 5173 dùng chung, và nó hỏng ÂM THẦM

Làm **trước** mọi việc song song. Ước 6 dòng, thực tế 3 chỗ sửa, ~10 phút.

### Lỗi

- `playwright.config.ts:11` — `baseURL: 'http://127.0.0.1:5173'`, viết thẳng.
- `scripts/run-playwright.mjs:8` — `const baseUrl = 'http://127.0.0.1:5173'`, viết thẳng.
- `vite.config.ts` **không** đặt `server.port` ⇒ mọi worktree đều lấy 5173.
- `run-playwright.mjs` — nếu cổng đã có người thì script **không** dựng máy chủ mới,
  chỉ in một dòng cảnh báo rồi chạy test trên máy chủ cũ.

Hệ quả: hai worker cùng chạy `pnpm e2e` ở hai worktree ⇒ worker thứ hai **kiểm mã của
worker thứ nhất và báo xanh**. Không đỏ, không xung đột, không dấu vết.

### Đã sửa

| Chỗ | Sửa |
|---|---|
| `scripts/run-playwright.mjs` | `const port = process.env.E2E_PORT ?? '5173'`; `baseUrl` dựng từ nó; truyền `--port <port> --strictPort` cho `vite` |
| `playwright.config.ts` | `baseURL` đọc cùng biến, cùng mặc định |
| `run-playwright.mjs`, nhánh "máy chủ đã chạy sẵn" | `E2E_PORT` đặt tường minh ⇒ **`process.exit(1)`** kèm câu giải thích. `E2E_PORT` không đặt ⇒ giữ nguyên dòng cảnh báo cũ |

### Nghiệm thu — ba phép đo, và một cái KHÔNG đạt theo nghĩa đặc tả đòi

**1. Cổng riêng dựng được.** `vite --port 5199 --strictPort` lên được, `curl` trả
**HTTP 200**, bộ dò 35 màn chạy trọn trên cổng đó. `pnpm e2e` trần vẫn dùng 5173 và vẫn
**18/18 xanh** (`pnpm verify` sau P0: **7/7 đạt**, exit 0).

**2. Nhánh chống-trùng-cổng chạy đúng.** Giữ 5183 bằng một máy chủ giả rồi chạy
`E2E_PORT=5183 pnpm e2e`: nó in đúng dòng đã viết và **dừng** —

> `Cổng 5183 đã có người. E2E_PORT được đặt tường minh nên lượt này DỪNG: chạy tiếp là đi
> kiểm mã của một worktree khác và báo xanh.`

**3. Hai lượt đầy đủ song song: 5181 XANH, 5182 ĐỎ — và lý do KHÔNG phải P0.**

| Lượt | Kết quả |
|---|---|
| `E2E_PORT=5181 pnpm e2e` | **18 passed**, exit 0, 1,4 ph |
| `E2E_PORT=5182 pnpm e2e` | **13 passed · 5 failed**, exit 1 |

Cả 5 bài đỏ là `page.goto: Test timeout of 30000ms exceeded`, và thông báo lỗi ghi rõ:

> `- navigating to "http://127.0.0.1:5182/demo", waiting until "load"`

**Cổng 5182, cổng của chính nó.** Đó là bằng chứng P0 làm đúng việc của nó: không có
lượt nào đi gõ cửa máy chủ của lượt kia, và `--strictPort` bảo đảm mỗi lượt có máy chủ
riêng. Nếu P0 chưa có thì lượt thứ hai đã **báo xanh** trên máy chủ của lượt thứ nhất —
đúng cái lỗi âm thầm mà P0 tồn tại để chặn.

Cái đỏ là **máy hết CPU**. Lúc ấy trên 12 luồng có: hai `pnpm pascal` (≈19 MB mã mỗi
lượt), hai máy chủ Vite nguội, hai Chrome thật, **cộng hai agent LLM đang đọc kế hoạch
2 587 dòng**. Và `/demo` là route đắt nhất để tải nguội — nó `lazy()` bảy màn demo, nên
lượt yêu cầu đầu tiên bắt Vite dịch cả bảy.

⇒ Kết luận phải ghi đúng, không làm tròn: **cơ chế đạt, trần đồng thời không đạt ở mức
đặc tả giả định.** Trần thật trên máy này là **một** lượt e2e đầy đủ khi còn việc khác
chạy; hai lượt chỉ an toàn khi máy rảnh. Bảng ở mục 8 đã ước "3 cùng lúc" — số đo này
nói ước ấy **quá lạc quan khi có agent chạy kèm**.

**4. Và một tài nguyên dùng chung THỨ HAI mà P0 không chạm tới — đây là phát hiện đắt nhất
của cả phần P0.**

Chạy lại hai lượt song song, lần này **nhẹ** (chỉ bài `smoke`, để loại bỏ giả thuyết CPU):

| Lượt | Kết quả |
|---|---|
| `E2E_PORT=5184` | chạy được, vào tới `smoke.spec.ts` |
| `E2E_PORT=5185` | **exit 1 ngay ở bước dựng**, không tới bài nào |

Lỗi của 5185 **không** phải timeout:

```
x Build failed in 33.86s
error during build:
EPERM, Permission denied: \?\F:\AppFront\publicssets\pascalloorplan-tool-BoqadmlL.js
    at Object.rmSync (node:fs:1222:18)
    at emptyDir (…/vite/dist/node/chunks/dep-D8YhmIY-.js:16952:19)
    at prepareOutDir (…)
```

Nguyên nhân đọc ra ngay: `vite.pascal.config.ts:65-66` đặt
`outDir: 'public/assets/pascal'` với **`emptyOutDir: true`**. Mỗi `pnpm e2e` chạy
`pnpm pascal` trước, và `pnpm pascal` **xoá sạch rồi dựng lại** đúng thư mục ấy. Hai lượt
song song trong **cùng một worktree** vì thế có một lượt đang ghi trong lúc lượt kia đang
xoá.

⇒ **P0 giải đúng một nửa vấn đề.** Cổng là tài nguyên dùng chung thứ nhất, và P0 chữa nó.
`public/assets/pascal/` là tài nguyên dùng chung **thứ hai**, và không ai trong đặc tả gốc
nêu nó. Khác biệt quan trọng:

- **Hai worktree khác nhau:** mỗi worktree có `public/` riêng ⇒ chỗ này **không** đụng.
  Đó đúng là tình huống §9.2 của đặc tả nhắm tới, nên P0 vẫn đủ cho nó. **Chưa đo.**
- **Cùng một worktree, hai cổng khác nhau:** đụng, và đụng ở bước dựng nên không bài nào
  chạy. **Đã đo.** Đây là tình huống người ta dễ rơi vào nhất, vì `E2E_PORT` khiến nó
  *trông như* đã được cô lập.

Điều đáng nói nhất: lỗi này **ồn ào** (exit 1, thông báo rõ), không âm thầm như lỗi cổng.
Nên nó không nguy hiểm bằng — nhưng nó làm lời hứa "đặt `E2E_PORT` là chạy song song
được" thành nửa đúng, và kế hoạch phải nói nửa còn lại.

### Hệ quả cho CI và cho người chạy tại máy

CI đặt `workers: 1` và chạy **một** lượt `pnpm e2e`, nên không điều nào ở trên chạm tới CI.

Tại máy, câu đúng gồm ba phần:
1. Đặt `E2E_PORT` riêng — nó chặn lỗi âm thầm, và đó là phần quan trọng nhất.
2. **Một lượt `pnpm e2e` đầy đủ mỗi worktree**, không hai; và không hai lượt trong cùng
   một worktree (vách ngăn Pascal).
3. Trần đồng thời thật thấp hơn ước ở mục 8 khi còn agent chạy kèm.

**5. Tài nguyên dùng chung THỨ BA: một `pnpm dev` còn chạy trên cùng worktree làm `pnpm e2e`
chập chờn.** Đo được tình cờ, và nó là dữ kiện hữu ích nhất của cả phần này.

Suốt lượt khảo sát tôi để một dev server chạy trên **5199** cho 12 worker dùng chung. Sau
khi xong việc tôi quên tắt nó, rồi chạy lại cả bộ e2e hai lượt:

| Lượt | Kết quả | Bài đỏ |
|---|---|---|
| Lượt 1 (5199 còn chạy) | **17 passed · 1 failed** | `viewer3d.spec.ts:656` — chờ 5 s sau đăng nhập, `getByRole('main', …)` không hiện |
| Lượt 2 (5199 còn chạy) | **17 passed · 1 failed** | `viewer3d.spec.ts:546` — nhãn thu phóng đứng ở `100`, `toBeGreaterThan(100)` hỏng |
| Bài `:656` chạy **một mình** | **1 passed** | — |
| **Lượt 3 (đã tắt 5199)** | **18 passed**, exit 0 | — |

**Hai bài đỏ khác nhau ở hai lượt, hai cơ chế khác nhau** — dấu hiệu của chập chờn, không
phải hồi quy. Và tắt dev server thì hết. Lý do: hai bản Vite cùng theo dõi và cùng dịch
`F:/AppFront`; lượt e2e dựng máy chủ riêng nhưng **watcher và bộ dịch của bản kia vẫn giành
cùng tệp**. Máy lúc đó còn 8,8 GB rảnh và chỉ 2 tiến trình node — **không phải thiếu RAM**.

⇒ Quy ước phải vào kế hoạch: **tắt mọi `pnpm dev` trên cùng worktree trước khi chạy
`pnpm e2e`.** Ba tài nguyên dùng chung, theo thứ tự nguy hiểm:

| # | Tài nguyên | Triệu chứng | P0 chữa? |
|---|---|---|---|
| 1 | **cổng 5173** | **âm thầm** — lượt thứ hai kiểm mã của lượt thứ nhất rồi báo xanh | **có** |
| 2 | `public/assets/pascal/` (`emptyOutDir: true`) | ồn ào — `EPERM` ở bước dựng, exit 1 | không (chỉ ảnh hưởng hai lượt trong **cùng** worktree) |
| 3 | **bộ dịch/watcher của Vite trên cùng worktree** | **chập chờn** — bài khác nhau đỏ mỗi lượt | không |

Cái số 3 tệ hơn số 2 vì nó không nói ra mình là gì: nó trông như "spec có sẵn hay hỏng".
Hai bài đỏ ấy đều là bài đã có từ trước (`viewer3d.spec.ts`), nên người gặp nó sẽ đi sửa
spec chứ không đi tắt dev server.

**Hai hạn chờ 5 s trong spec có sẵn là chỗ mỏng đã lộ ra:** `viewer3d.spec.ts:203`
(`toBeVisible` sau đăng nhập, trên một route tải muộn) và `:452` (`expect.poll` nhãn thu
phóng). Fixture `session.ts` của chặng 0 **chép khuôn đăng nhập từ dòng 185-205 ấy** — nên
nó **không** được chép luôn hạn 5 s. Đây là một khuyến nghị cụ thể cho chặng 0, và nó đến
từ một lượt đỏ thật.

Commit: `e1554b0` trên `e2e/prep`.

---

## 4. Bộ dò khảo sát — thứ thay cho việc click tay 35 màn

`scripts/probe-survey.mjs`. Không phải bài kiểm, không nằm trong `e2e/`, `pnpm e2e`
không chạy nó.

Nó mở từng màn có route một lượt bằng một `BrowserContext` riêng, chờ `networkidle`
cộng 1,5 s, rồi ghi ra: chữ nhìn thấy được (400 ký tự đầu) · `h1`/`h2` · nhãn và
`aria-label` của mọi `button` hiện · `label` · `role="status"`/`aria-live` ·
`role="dialog"` · `role="tab"` · kích thước mọi `<canvas>` · mọi `data-testid` · số
skeleton (`[aria-busy=true], .animate-pulse`) · nút mang chữ "lưu" · chuỗi nghi là
dấu thập phân · lỗi console · URL cuối.

| Đo | Số |
|---|---|
| Màn dò được | **35 / 35** |
| Thời gian | **~2 phút** |
| Đầu ra | `probe-35-routes.json` |

**Vì sao nó tồn tại:** khảo sát bằng người (hay bằng LLM) phải *chép lại* nhãn, và một
nhãn chép sai là một `getByRole` không bao giờ khớp — cả chặng viết spec đổ theo nó.
Bộ dò không chép, nó *đọc*. Đặc tả gốc dự định 12 worker click qua 65 bề mặt; hai phút
máy làm xong phần của 35 bề mặt trong đó, chính xác hơn, và để lại một tệp JSON mà
worker lớp sau trích dẫn được.

Lượt dò thứ hai (`probe-pascal-viewer.json`) đo ba thứ bộ dò đầu không tới:
cờ Pascal **bật**, vai `viewer` trên vỏ 3D, vai `viewer` trên `/admin/users`.

---

## 5. Chia việc — 12 việc, hai lớp, hai lượt mỗi lớp

Bảng này vừa là bảng nhóm của `plan.md`, vừa là bảng chia việc của DAG. Một bảng,
không hai.

| Việc | Nhóm | Bề mặt | Số |
|---|---|---|---|
| **V1** | Cổng vào & phiên | `login` · `onboarding` · `accessDenied` · `notFound` · `mobileViewer` | 5 |
| **V2** | Lớp tự mở & thông báo | `ConnectionStates` · `CollaborationLayer` · `EditorTour` · `NotificationCenter` · `StateGallery` | 5 |
| **V3** | Dự án | `dashboard` · `CreateProjectModal` · `projectSettings` · `ShareDialog` | 4 |
| **V4** | Nhận bản vẽ | `projectUpload` · `projectQuality` · `ProcessingScreen` · `PipelineFailure` | 4 |
| **V5** | Dây chuyền | `projectPipelineGraph` · `projectScale` · `projectCadConfirm` | 3 |
| **V6** | QC-a | `projectWalls` · `projectObjects` · `projectDimensions` · `projectGrids` | 4 |
| **V7** | QC-b | `projectRooms` · `projectFloors` · `projectThickness` | 3 |
| **V8** | Vỏ 3D & panel | `projectViewer` · `ViewerShell` · `PropertyInspector` · `RoomAreaPanel` · `HistoryPanel` · `FurnitureLibraryPanel` · `WallGeometryEditor` | 7 |
| **V9** | 3D khác | `projectExploded` · `projectMeasure` · `projectOverlay` | 3 |
| **V10** | Pascal — vỏ | `projectViewerPascal` | 1 |
| **V11** | Pascal — trình soạn thảo | ~16 bề mặt của fork | 16 |
| **V12** | Luật · xuất · quản trị | `projectRules` · `projectRuleSettings` · `ViolationDetail` · `projectExport` · `projectData` · `projectVersions` · `account` · `billing` · `adminModels` · `adminUsers` | 10 |

Tổng màn sản phẩm: 5+5+4+4+3+4+3+7+3+1+10 = **49** ✓ · cộng 16 bề mặt Pascal của V11.

### Thứ tự hai lượt — cân theo THỜI GIAN, không theo đầu màn

| Lượt | Việc | Vì sao ở lượt này |
|---|---|---|
| **1** | V1 · V6 · V8 · V11 · V12 · V4 | V1 là nguồn của fixture đăng nhập (mọi việc khác chờ nó); V8 và V11 nặng và ẩn số nhất; V12 nhiều màn nhất; V6 phải đo lại bẫy vòng tròn; V4 là cửa vào dây chuyền |
| **2** | V2 · V3 · V5 · V7 · V9 · V10 | nhẹ hơn; V10 mở rộng một spec đã có nên rẻ nhất |

V12 có 10 màn nhưng phần lớn là bảng và biểu mẫu nhẹ. V8 chỉ 7 bề mặt nhưng nặng
nhất — canvas cộng bốn panel chồng nhau. V11 là ẩn số lớn nhất, và hoá ra là ẩn số
theo chiều không ai đoán (xem mục 7).

---

## 6. Lớp khảo sát KHÔNG dùng worktree — và đó là chỗ tiết kiệm nhiều nhất

Worker lớp này **chỉ đọc**, nên không có gì để cô lập.

| | Đặc tả gốc | Lượt này |
|---|---|---|
| Worktree cho lớp khảo sát | 12 | **0** |
| `pnpm install` phải chạy | 12 lượt | **0** |
| Thư mục phải dọn sau | 12 | **0** |
| Dev server | 1 dùng chung | 1 dùng chung, cổng **5199** |

Cả sáu worker chạy `--worktree current` trên chính `F:/AppFront`, cùng đọc, cùng mở
`http://127.0.0.1:5199`. Mỗi worker ghi **đúng một** tệp, và tệp ấy nằm **ngoài repo**:
`C:/Users/mxuan/orca/dieu-phoi/e2e-plan/ghi-chu-<việc>.md`. Nhờ vậy `git status` sạch
suốt lượt, và mọi worktree của lớp sau đọc được bằng đường tuyệt đối.

Spec worker bắt chứng minh: `git status --short` phải rỗng hoặc chỉ còn đúng dòng
`?? prompts/` đã có trước lượt này.

### Model

`sonnet` cho cả 12. **Không `haiku`** — lớp này phải chép nguyên văn nhãn tiếng Việt,
`aria-label` và số đo; đo ở một lượt trước (AppBack B0-09) thấy `haiku` bịa số rồi dán
kèm "output lệnh" không tồn tại. Nhãn bịa ⇒ mốc neo sai ⇒ cả chặng viết kế hoạch đổ.

V11 thêm `--effort medium` và được chỉ đúng tệp phải đọc trước
(`docs/pascal/04-doi-chieu-tung-tinh-nang.md`) — bảng đó đã đối chiếu từng tính năng,
bắt worker đối chiếu lại từ đầu là trả tiền hai lần cho một việc.

---

## 7. `E2E_PORT` từng worker — bảng dành cho lớp VIẾT, chưa dùng ở lượt này

Lớp khảo sát không chạy `pnpm e2e` nên chưa worker nào dùng bảng này. Nó có ở đây để
chặng viết spec khỏi phải chia lại.

| Worker | Sở hữu thư mục | `E2E_PORT` |
|---|---|---|
| V1 | `e2e/auth/**` | 5181 |
| V2 | `e2e/system/**` | 5182 |
| V3 | `e2e/project/**` | 5183 |
| V4 | `e2e/upload/**` | 5184 |
| V5 | `e2e/pipeline/**` | 5185 |
| V6 | `e2e/qc/walls*` `objects*` `dimensions*` `grids*` | 5186 |
| V7 | `e2e/qc/rooms*` `floors*` `thickness*` | 5187 |
| V8 | `e2e/viewer/shell*` `panels*` | 5188 |
| V9 | `e2e/viewer/exploded*` `measure*` `overlay*` | 5189 |
| V10 | `e2e/pascal/viewer*` | 5190 |
| V11 | `e2e/pascal/editor/**` | 5191 |
| V12 | `e2e/rules/**` `e2e/export/**` `e2e/admin/**` | 5192 |
| **chủ tệp dùng chung** | `e2e/fixtures/**` · `playwright.config.ts` · `scripts/run-playwright.mjs` | **worker gộp** |

Một thư mục đúng một chủ ⇒ không có xung đột gộp. Ai cần thêm vào tệp dùng chung thì
ghi `e2e/fixtures/<tên>.fragment.ts` để lớp gộp trộn. Ai thấy fixture thiếu thì **dừng
và `orca orchestration ask`**, không tự sửa `fixtures/`.

---

## 8. Trần đồng thời — đếm bằng RAM, không bằng số worker

Ước từ 7,3 GB rảnh đo được:

| Loại việc | Chi phí mỗi lượt | Trần |
|---|---|---|
| worker khảo sát (đọc + 1 tab Chrome) | ~0,3–0,5 GB | **6 cùng lúc** |
| worker viết, không chạy e2e | ~0,3 GB | **6 cùng lúc** |
| một lượt `pnpm e2e` (vite + Chrome thật + `pnpm pascal`) | ~1,5–2 GB | **3 cùng lúc**, không hơn |
| một lượt e2e **của Pascal** (1,6× CPU + WebGL thật) | ~2–2,5 GB | **2 cùng lúc** |
| `pnpm verify` (có build + terser) | ~2 GB | **1 lúc**, chạy một mình |

**Fan-out rộng ở lớp viết, xếp hàng ở lớp chạy.** Sáu worker viết song song là được;
sáu worker cùng `pnpm e2e` là không. Hai worker cùng đếm rồi cùng chạy vẫn vượt trần,
nên **điều phối viên** là chỗ soát, không phải worker.

### Worker nào được chạy lệnh gì (L2)

| Vai | Được chạy | Cấm |
|---|---|---|
| worker khảo sát | không lệnh kiểm nào | `pnpm verify`, `pnpm e2e`, sửa tệp |
| worker viết spec | `pnpm typecheck`, `pnpm lint` đúng đường của mình, `E2E_PORT=<của mình> pnpm e2e <đúng thư mục của mình>` | **`pnpm verify`** — cổng tổng là việc của lớp gộp |
| worker gộp | `pnpm verify` **một** lần + `pnpm e2e` toàn bộ **một** lần, sau khi gộp và vá mối nối | chạy lại vòng hai khi không đổi mã |
| reviewer | đọc log cổng của worker gộp, đúng sha | chạy lại cổng |

`pnpm verify` là bảy bước tuần tự dừng ở bước hỏng đầu tiên, và ở máy này nó mất
~9 phút. Mười hai worker cùng chạy nó là cách chắc chắn nhất để một lượt hai giờ
thành cả ngày.

---

## 9. Ngân sách — dự kiến so với thực tế

| Chặng | Dự kiến | Thực tế |
|---|---|---|
| Đo nền (`verify` + `e2e` + bộ dò 35 màn) | — | **~15 ph** (`verify` chạy nền song song với đọc mã) |
| P0 sửa cổng + nghiệm thu | 25 ph | **~10 ph** |
| Viết hợp đồng + 12 spec khảo sát | 20 ph | **~12 ph** (sinh bằng script, phần chung viết một lần) |
| DAG-1 lượt 1, 6 worker | ~22 ph | *xem mục 11* |
| DAG-1 lượt 2, 6 worker | ~22 ph | *xem mục 11* |
| Cổng rà hợp đồng | — | *xem mục 11* |
| DAG-2 viết 65 mục, 2 lượt × 6 worker | 70 ph | *xem mục 11* |
| Gộp + hai vai đối nghịch đọc lại | 30 + 20 ph | *xem mục 11* |

Làm một mình tuần tự: 65 bề mặt × ~8 phút khảo sát ≈ **8,5 giờ**, chưa tính viết mục.
Đó là chỗ song song hoá trả về tiền thật — và cũng là lý do đừng tách nhỏ hơn 3 màn
một worker: dưới ngưỡng ~20 phút một việc thì phí spec và mối nối ăn hết phần lợi (L7).

---

## 10. Kỷ luật đã áp dụng, và chỗ đã trả giá

- **Thư gửi giữa chừng không tới worker đang chạy.** Lượt này vẫn gửi một thư cho V11
  (phát hiện Pascal editor không render) vì preamble bắt worker gọi `check` trước khi
  gửi `worker_done` — nên nó sẽ đọc được, muộn nhưng đọc được. Phát hiện sau khi đã
  giao mà **phải** tới ngay thì đường đúng là `worker-start --retry-of` với spec sửa,
  không phải gửi thư rồi tưởng đã tới.
- **`send` đòi `--subject`.** Lượt gửi đầu thiếu cờ đó và bị từ chối
  `invalid_argument`. Lấy cờ thật bằng `--help`, đừng đoán.
- **Chờ bằng một vòng lặp nền**, không peek từng heartbeat. Mỗi lần peek là một lượt.
- **Sau mỗi `worker_done`: `worker-release` rồi mới `--ack`.**
- **Kiểm chứng lời worker nói, cả hai chiều.** Nó báo "NOT FOUND" thì tự `grep` lại;
  nó báo "test đỏ không phải lỗi tôi" thì chạy baseline trên `master` mới biết ai đúng.
- **Timeout hoặc `count: 0` là điểm kiểm tra, không phải worker chết.**
- **Không mở pane RUNNER.** Lệnh dài chạy bằng `run_in_background` với log ra tệp.

---

## 11. Kết quả thật của từng lượt

### 11.1 Hình DAG thật khác hình DAG dự kiến, và đây là chỗ khác

Đặc tả dự kiến hai lớp × hai lượt × sáu worker = 24 lượt giao, mỗi lượt là một lô sáu worker
chạy rồi chờ cả lô xong. Lượt chạy thật **không xếp thành lô** — nó là một hàng đợi:

> Mỗi khi một worker gửi `worker_done`, terminal của nó được **giao việc tiếp theo ngay**,
> thay vì đóng lại chờ cả lô.

Vì sao: một lô sáu worker chỉ nhanh bằng worker chậm nhất của nó. V12 (10 bề mặt) mất lâu hơn
V10 (1 bề mặt) nhiều lần; chờ V12 để mở lượt hai là để năm terminal đứng không. Hàng đợi giữ
**đúng sáu worker chạy liên tục** từ đầu tới cuối.

Cách làm ấy còn được một thứ không tính trước: **worker kế thừa ngữ cảnh.** Terminal vừa
khảo sát Pascal editor (V11) nhận luôn việc Pascal vỏ (V10); terminal vừa đo tầng QC-a (V6)
nhận QC-b (V7); terminal vừa đo phiên (V1) nhận màn dự án (V3). Spec của việc sau nói thẳng
"**ba dữ kiện của chính bạn dùng lại được, ĐỪNG đo lại**" — và worker không đo lại.

| | Dự kiến | Thật |
|---|---|---|
| Hình | 2 lớp × 2 lượt × 6 | hàng đợi, trần 6 đồng thời |
| Số lượt giao | 24 | **24** (12 khảo sát + 12 viết mục) |
| Worktree tạo mới | 12 | **0** |
| `pnpm install` phải chạy | 12 lượt | **0** |
| Terminal dùng | 12 | **6**, mỗi cái chạy 4 việc |
| `pnpm verify` chạy | có thể 12 lượt nếu worker nào cũng chạy | **1** (điều phối viên, trước khi giao việc đầu tiên) |
| `pnpm e2e` chạy | tới 12 lượt | **1** (mốc nền) |

### 11.2 Sản lượng

| Lớp | Tệp | Dòng | Byte |
|---|---|---|---|
| Khảo sát (12 ghi chú) | `ghi-chu-V1..V12.md` | **3 156** | 419 583 |
| Viết mục (12 tệp) | `muc-V1..V12.md` | **2 227+** | 439 604+ |
| Hợp đồng của điều phối viên | `HOP-DONG.md` + `HOP-DONG-BO-SUNG.md` | 400+ | — |

Tệp khảo sát lớn nhất: `ghi-chu-V12.md` (69 750 B, 10 bề mặt). Tệp mục lớn nhất:
`muc-V8.md` (63 750 B, 7 bề mặt chồng nhau).

### 11.3 Mười ba chỗ hợp đồng của điều phối viên SAI, và worker bắt được

Đây là số đáng ghi nhất của cả lượt, vì nó nói ra giá trị của lớp thứ hai. `HOP-DONG-BO-SUNG.md`
mục 7 có đủ mười ba; ba chỗ đắt nhất:

1. **`EditorTour` "không tự mở, 0/35 màn".** Phép đo đếm `[role="dialog"]` ngay sau khi tải
   trang. Tour **cố ý không mang `role="dialog"`**, và nó hiện **sau một sự kiện** (resize,
   hoặc một cú bấm trên `/3d`). Nếu không ai bắt chỗ này thì kế hoạch đã bỏ hẳn fixture
   `tour.ts`, và mọi ca của ba màn có tour sẽ vỡ vì một tấm tối `z-40` không ai giải thích được.
2. **Bốn con số Pascal lệch A14 "do bộ đổi dữ liệu".** Sai hướng: bộ đổi trung thực; số là
   `graph.walls.length` đếm trên **một bộ mẫu khác**. Đi theo hướng sai sẽ là vài giờ đọc
   `toPascal.ts` không tìm ra gì.
3. **Đường dẫn `src/vendor/pascal/...`** — thật ra `vendor/pascal/...`, không nằm trong `src`.

Chiều ngược lại cũng xảy ra, và cũng phải ghi: **điều phối viên kiểm lại và sắc lại hai kết
luận của worker** — dây chuyền `empty` là **chủ ý đã ghi lý do**
(`PipelineGraph.container.tsx:18-27`), không phải một lỗ; và cờ `persist*` là một biến
`canPersist` chứ không phải hằng `false`. Cả hai đều là "đọc docblock trước khi gọi một hành
vi là lỗi".

### 11.4 Bài học phương pháp

**Một phép đo "lúc tải trang" không nói được gì về "trong luồng".** Bộ dò rẻ (2 phút cho 35
màn), chính xác, và đúng ở đúng chỗ nó đo — nhưng nó không bấm. Mọi thứ chỉ hiện sau một cú
bấm, một lượt resize, hay một lượt chọn đối tượng đều nằm ngoài tầm nó. Hai lớp khảo sát tồn
tại chính vì chỗ này, và nếu phải cắt một lớp thì cắt lớp bộ dò, không cắt lớp bấm thật.

**Giao việc tiếp theo cho terminal vừa xong, đừng chờ hết lô.** Nó giữ trần đồng thời luôn
đầy và cho worker kế thừa ngữ cảnh miễn phí.

**Bắt worker in con số vào `worker_done` là thứ làm cả lượt kiểm chứng được.** Mọi dòng trong
mục 11.3 tìm ra được vì spec đòi mỗi worker nói ra "chỗ ghi chú lớp trước thiếu hoặc sai".
Không đòi thì không ai nói.
