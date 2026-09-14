# Đính chính v2.3

Phụ lục cho `BO-PROMPT-FE-HOP-NHAT-v2.3 (1).html`. Mười một mục dưới đây đã lạc hậu so với
mã tại thời điểm đối chiếu (`master@f13dbb2`, 2026-09-14) — người chạy prompt lần sau nên đọc
phần này **trước** khi làm theo mục tương ứng của v2.3.

Đây không phải bản tóm tắt của `BAO_CAO_DOI_CHIEU_v2.3.md` — báo cáo đó là cho người đọc mã,
liệt kê đủ mười hai độ lệch (Đ1..Đ12) kèm lệnh đã chạy; phụ lục này chỉ giữ lại phần một người
đang cầm bộ 56 prompt cần biết để khỏi đi theo đường cụt.

---

## Mục 0.2 — "Chuỗi thực thi"

**v2.3 nói:** dự án đang ở chặng 3 — nền giao diện — tức chưa dựng màn nào, và bước tiếp theo
là bắt đầu dựng từ đầu bộ 47 màn.

**Mã thật:** 45/47 màn đã có mã, đủ sáu file R-59, đủ story và test; 47 route đã gắn vào
`src/routes/router.tsx`; `src/components` có 52 component thật.

**Chốt theo mã.** Đọc mục 0.2 như một mô tả tiến độ tại một thời điểm đã qua, không phải hiện
trạng. Việc còn lại không phải "chạy 56 prompt" mà là dựng 2 màn còn thiếu (S-36, S-45 — cả
hai đã dựng xong tính đến lượt đối chiếu gần nhất) và đóng các lỗ hợp đồng dữ liệu nêu ở Đ1/Đ2
của báo cáo đối chiếu.

## Mục 0.6a — bảng thời lượng

**v2.3 nói:** chốt thang 120 / 180 / **240** / 340 ms.

**Mã thật:** `MOTION_DURATIONS_MS` (`src/lib/motion/tokens.ts`) có bốn khoá
`instant` 120, `fast` 180, `standard` **260**, `slow` 340. Số 240 → 260 đã đổi từ lâu, và
`motion.test.ts` cùng mọi nơi gọi `durationMs('standard')` đã khoá theo 260 — tầng này có test,
đúng như lý do 0.6a tự đưa ra để KHÔNG đổi ("đổi 240→260 phải sửa `src/lib/motion` mà tầng đó
bị khoá").

**Chốt theo mã (260).** Chính lý lẽ của 0.6a giờ quay ngược lại nó: tầng đã bị khoá theo hướng
260, nên sửa lại tài liệu rẻ hơn nhiều so với sửa mã và toàn bộ test đi kèm.

## Mục 5.0 — mốc 700 ms, chọn cách A hay B

**v2.3 nói:** hỏi người đọc chọn cách A (thêm mốc 700 ms cho vòng lặp nền) hay cách B, và ghi
chú "mọi prompt bên dưới viết theo cách A" như một giả định chờ xác nhận.

**Mã thật:** cách A đã chọn xong từ lâu — `AMBIENT_LOOP_MS = 700` tồn tại như một hằng số
riêng trong `src/lib/motion/tokens.ts`, dùng cho skeleton sweep và progress sheen.

**Chốt: câu hỏi đã đóng.** Đọc mục 5.0 như đã trả lời "A", không phải như một quyết định còn
treo — nếu không, người chạy prompt lần sau sẽ dừng lại hỏi lần hai một việc đã xong.

## Mục 0.8 — bảng route

**v2.3 nói:** mọi route dự án viết bằng tiếng Việt (`/du-an/:projectId/...`), tham số dự án là
`:projectId`.

**Mã thật:** router thật (`src/routes/router.tsx` + `src/routes/paths.ts` — `src/routes.tsx` mà
0.8 và R-66 gọi tên không tồn tại) dùng đường dẫn tiếng Anh (`/projects/:id/...`); chỉ khớp
4/26 dòng của bảng 0.8. Tham số vẫn là `:id`, không phải `:projectId`.

**Chốt theo Q1: giữ tiếng Anh, sửa bảng 0.8 — nhưng đổi `:id` thành `:projectId`.** Vì sao giữ
tiếng Anh: URL không phải chuỗi hiển thị nên A6/R-42 không áp vào nó, và đổi 22 route sang
tiếng Việt đụng mọi `navigate()`, test router và ảnh chuẩn e2e mà không đổi lấy giá trị nào cho
người dùng. Vì sao vẫn đổi tên tham số: hai quy ước tham số cùng sống trong một cây route
(`:id` lẫn `:projectId` ở `paths.ts`) **là** một lỗi thật, không phải chỗ tài liệu sai.

## Mục 0.9 — bảng khoá `vi.json`

**v2.3 nói:** đòi gom 50 khoá cấp một về 15 nhánh theo tầng nghiệp vụ
(`qc.wallLayer.title`, `viewer.propertyInspector.emptyState`…).

**Mã thật:** `src/i18n/vi.json` có 51 nhánh phẳng đặt theo tên màn (`wallLayerReview`,
`propertyInspector`, `stateGallery`…), khớp trực tiếp tên thư mục `src/screens/**`. Chỉ
7/15 tên nhánh của bảng 0.9 khớp cách đặt tên thật. Và quan trọng hơn cấu trúc: `vi.json`
**không phải bảng dịch lúc chạy** — `useTranslation`/`react-i18next` không xuất hiện trong mã
sản phẩm; file này chỉ là từ điển đối chiếu cho `lib/testing/expectVietnamese.ts`, nạp qua
i18next thật duy nhất trong môi trường test.

**Chốt theo Q2: giữ 51 nhánh phẳng, sửa bảng 0.9.** Gom lại 15 nhánh là diff cơ học lớn trên
một file mà chỉ một bộ khẳng định test đọc tới — không đổi gì cho người dùng, vì file không
chạy lúc runtime. Vẫn còn một việc thật: nhánh `dashboard` (màn `ProjectDashboard`) chưa có
trong 51 nhánh hiện tại.

## Mục DS-00

**v2.3 nói:** DS-00 yêu cầu dựng bằng `react-three-fiber`, và liệt kê 41 token màu.

**Mã thật:** `CLAUDE.md` (mục Dự án) cấm đích danh `react-three-fiber` — toàn bộ three.js
trong repo dựng tay. Về token: chính prompt DS-01 lại ghi 38 token, không phải 41 — DS-00 tự
mâu thuẫn với prompt liền sau nó. Đếm token thật trong `tailwind.config.ts`: 38 khoá ánh xạ
`var(--…)`, khớp DS-01.

**Chốt theo mã: bỏ yêu cầu `react-three-fiber`, và sửa DS-00 khớp con số 38 của DS-01** thay
vì ngược lại. 31/41 token DS-00 liệt kê thật sự có mặt trong `globals.css`; 10 token còn thiếu
(`--bg-active`, `--border-hairline`, `--accent-border`, `--wall-centerline`, `--data-door`,
`--data-window`, `--data-furniture`, `--data-dimension`, `--data-axis`, `--data-room`) chỉ nên
bổ sung khi có nơi dùng thật (Q4) — thêm đủ 41 ngay bây giờ tạo ra màu chết mà lint không bắt
được.

## Mục DS-BIND, DS-01, 0.2 — `src/theme/tokens.ts`

**v2.3 nói:** cả ba mục xoay quanh file `src/theme/tokens.ts`; mục 0.2 còn đoán file đó "hoặc
đang là bản tạm do agent tự bịa ra, hoặc đang thiếu".

**Mã thật:** file đó **chưa bao giờ tồn tại**. Tầng giao diện được dựng theo đường khác mà vẫn
giữ được bất biến A1 (`local/no-raw-color`, 0 vi phạm). Nguồn màu thật là ba file, theo đúng
thứ tự: `src/styles/globals.css` (khai biến CSS) → `tailwind.config.ts` (ánh xạ sang tên ngữ
nghĩa như `bg-app`, `state-verified`) → `src/lib/coloring/scales.ts` (`COLOR_TOKEN_NAMES` cho
canvas).

**Chốt theo mã: xoá mọi tham chiếu đến `src/theme/tokens.ts`** khỏi cả ba mục, thay bằng ba
file thật ở trên. Không cần dựng file này để "khớp tài liệu" — nó không lấp chỗ trống nào, ba
file kia đã làm hết việc.

## Mục 3.0 — bộ số mẫu

**v2.3 nói:** "21 đối tượng — 9 cửa đi, 7 cửa sổ, 5 nội thất", tức ngụ ý 21 = 9 + 7 + 5.

**Mã thật (đo từ `createSampleBuilding()`):** 9 cửa + 7 cửa sổ = **16 ô mở** (`Opening`), và
21 là số lượng **đồ đạc** (`Furniture`) — một nhóm hoàn toàn khác, không cộng chung với ô mở.
Không có phép cộng nào trong fixture ra đúng "21 = 9+7+5"; 5 không ứng với hằng số nào trong
`sampleBuilding.ts`.

**Chốt theo mã: 16 ô mở (9 cửa + 7 cửa sổ) và 21 đồ đạc là hai nhóm tách biệt.** Sửa câu 3.0
thành "16 ô mở (9 cửa đi, 7 cửa sổ) và 21 đồ đạc" thay vì gộp thành một tổng 21.

## CL-08

**v2.3 nói:** `feedback/SaveIndicator` nằm trong danh sách 10 component còn thiếu của thư viện
CL-08.

**Mã thật:** đã có — 120 dòng, đủ story và test, là component **duy nhất** trong 10 cái của
CL-08 thật sự tồn tại. Chín cái còn lại thật sự thiếu, trong đó `overlay/Popover` là cái duy
nhất có nơi gọi đang chờ (`CommentThread.tsx` tự dựng bóng thay thế và ghi rõ lý do trong mã).

**Chốt theo mã (SaveIndicator đã xong) và theo Q3 cho phần còn lại: dựng `overlay/Popover`,
ghi nợ sáu component `viewer/*` (chỉ có một nơi dùng — `ViewerShell` — nên nâng lên thư viện
chung lúc này là tái cấu trúc không có lý do), bỏ `ui/Stepper` và `viewer/GizmoHud` khỏi danh
sách.**

## Mục 8.3 — "52 thành phần"

**v2.3 nói:** thư viện có 52 thành phần, và con số này đến từ việc cộng dồn tên liệt kê trong
CL-01 → CL-08.

**Mã thật:** cộng thật danh sách tên trong CL-01 → CL-08 chỉ ra **50**, không phải 52 — mục 8.3
tự mâu thuẫn với chính danh sách nó dẫn ra. `src/components` có 52 component thật, nhưng chín
cái trong số đó **không có tên trong tài liệu** (`canvas/ContextMenu`, `canvas/GridLayer`,
`canvas/SelectionHalo`, `feedback/NotificationHost`, `feedback/ScreenErrorBoundary`,
`shell/GlobalShortcutHelp`, `shell/ShortcutHelp`, `ui/TableActionBar`, `ui/ThicknessField`) —
cộng hai file nội bộ của `Combobox` mới ra đủ 52.

**Chốt: con số 52 đúng về mặt đếm mã, nhưng là sự trùng hợp, không phải bằng chứng tài liệu
khớp mã.** Sửa mục 8.3 để không ngụ ý "52 = tổng từ CL-01..CL-08"; nếu muốn giữ con số 52 thì
phải bổ sung tên chín component trên vào danh sách.

## S-36 — ba tông tô cú pháp

**v2.3 nói:** cây JSON của S-36 tô ba tông theo token: khoá dùng `--text-primary`, chuỗi dùng
`--accent`, số dùng `--data-dimension`.

**Mã thật (đo tương phản trên nền `--bg-sunken` #F1EEE8, ngưỡng WCAG AA 4,5:1 cho chữ 13px,
xem `SpatialJsonViewer/types.ts:14-31`):** hai trong ba token trượt ngưỡng. `--accent`
(#567A96) đo **3,93:1** — và chính DS-00 đã cấm dùng `--accent` cho chữ 13px, nên đặc tả S-36
tự mâu thuẫn với DS-00. `--data-dimension` (#A99B76) đo **2,37:1**, và nó vốn là màu TÔ lớp dữ
liệu trên canvas chứ không phải màu chữ — dùng nó cho text là sai loại token, không chỉ sai
tương phản.

**Chốt theo mã: ba tông thật là `--text-primary` · `--accent-active` (5,99:1, đạt) ·
`--text-secondary` (4,80:1, đạt).** Vẫn đúng ba tông, vẫn đúng tinh thần "không chủ đề bảy
màu" của DS-00, nhưng đọc được. Đây là trường hợp luật thắng prompt (`LUAT_MAN_HINH.md:10`):
sửa đặc tả S-36 để đổi hai token, không sửa ngưỡng tương phản.
