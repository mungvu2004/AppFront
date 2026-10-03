# Kế hoạch test tích hợp Playwright — 49 màn sản phẩm + bề mặt Pascal

Đây là **kế hoạch**, không phải spec test. Không một dòng `*.spec.ts` nào được viết ở
lượt này. Chặng thi công chỉ chạy **sau** khi kế hoạch được người duyệt.

Đo ngày **2026-09-30**, nhánh `e2e/prep` (base từ `mungvu2004/tich-hop-pascal`).
Bản đồ điều phối của lượt đo này: `dag.md`. Bảng hở: `coverage-map.md`.
Câu phải hỏi người dùng: `questions.md`.

---

## 0. Ba câu mỗi ca kiểm phải trả lời được

1. **kiểm cái gì**
2. **chứng minh được bất biến nào**
3. **nếu nó đỏ thì người dùng mất gì**

Ca nào không trả lời được câu thứ ba thì **không có trong kế hoạch này**. Bỏ một bề mặt
thì có một dòng nói vì sao bỏ — đó là một quyết định, không phải một chỗ thiếu.

### 0.1 Đếm hai con số, đừng đếm một

| Con số | Nghĩa |
|---|---|
| **Đơn vị bảo trì** | bao nhiêu khuôn mã một người phải đọc và sửa |
| **Lời gọi `test()`** | bao nhiêu kết quả độc lập CI báo về |

Một **lưới sinh từ dữ liệu** (một bảng + một vòng `for` sinh ra N lời gọi `test()`) cho
**1** đơn vị bảo trì và **N** kết quả. Kế hoạch này dùng hình dạng ấy ở ba chỗ, và mỗi lần
nó làm tan một tranh chấp "một ca hay N ca" mà không mất bằng chứng nào.

**Chú ý:** một lưới **không** phải một `test()` chứa vòng lặp bên trong. Cái sau chết ở
route đầu tiên hỏng và không đo những route còn lại — `expect.soft` tiếp tục qua một
`expect` hỏng, **không** tiếp tục qua `goto`/`click` quá hạn.

Tổng của kế hoạch này: **~65 đơn vị bảo trì · ~117 lời gọi `test()`**. Cách tính và chỗ con
số còn mềm: xem `questions.md`, phần QUYẾT ĐỊNH.

### 0.2 Ca ghi nhận khiếm khuyết đi bằng `test.fixme`

Sáu ca trong kế hoạch này **đỏ ngay từ lúc sinh ra** vì chúng khẳng định một bất biến mà
sản phẩm hiện vi phạm. Chúng vào bộ dưới dạng **`test.fixme` kèm lý do và điều kiện mở
lại**, cả hai viết trong chính bài.

Mục 7.4 cấm `test.skip` *không* có hai thứ đó — có thì được, và cấm ấy tồn tại chính vì
hình dạng này. Vì sao hơn một dòng trong mục PHÁT HIỆN: tài liệu không biết khi nào nó hết
đúng; một bài `fixme` thì biết — **nó xanh lên**.

---

## 1. Bước A — bảng đo, và không có kết luận nào không có số đứng sau

Mục **E.10** (`scripts/verify.mjs:14`) cấm báo "đạt" cho bước chưa chạy. Mọi mục chưa đo
trong tài liệu này mang đúng chữ **"chưa đo"**; mọi bước chưa chạy mang đúng chữ
**"chưa chạy"**.

### 1.1 Cổng nền — chạy trước khi đo bất cứ màn nào

| Lệnh | Kết quả | Thời gian |
|---|---|---|
| `pnpm verify` | **7/7 đạt**, exit 0 | ~9 ph |
| — typecheck | đạt | |
| — lint (`--max-warnings 0`) | đạt | |
| — import vòng | đạt, "Import vòng: không có" | |
| — test + độ phủ | đạt — 84,42 % stmts · 86,43 % branch · 80,11 % funcs | |
| — build | đạt — 4 906 + 2 866 module, 33,9 s + 19,6 s | |
| — kích thước gói | đạt, 7/7 hạng mục | |
| — độ dài file | đạt | |
| `pnpm e2e` | **18 passed · 0 failed · 0 skipped** | 1,1 ph, 6 worker |

Cổng nền **xanh sẵn**, nên bất cứ màu đỏ nào ở chặng sau là của chặng sau.

**Chính xác về việc phép đo nào phủ cây nào** (mục E.10 — không làm tròn):

| Phép đo | Cây nó phủ | Kết quả |
|---|---|---|
| `pnpm verify` | cây có phần **chức năng** của P0 (`E2E_PORT` ở `run-playwright.mjs` + `playwright.config.ts`) | **7/7 đạt**, exit 0 |
| `pnpm e2e` | **đúng nội dung cuối** của `scripts/run-playwright.mjs`, sau khi thêm khối docblock | **18/18 xanh**, exit 0 |
| `pnpm verify` chạy lại trên **commit cuối** | — | **CHƯA CHẠY XONG.** Qua bốn bước (typecheck · lint · import vòng · test+độ phủ) rồi bị hệ thống dừng ở bước build vì máy cạn bộ nhớ. Không có mã thoát ⇒ **không có phán quyết** cho ba bước cuối (build · kích thước gói · độ dài file) |

Khoảng cách giữa hàng một và commit cuối là: một khối **chú thích** trong một tệp `.mjs`, cộng
bốn tệp markdown trong `docs/notes/e2e/`. Không cổng nào trong bảy cổng đọc `.md`
(`check-file-length.mjs` chỉ đọc `.tsx`; `check-bundle-size.mjs` chỉ đọc `dist/assets`;
`eslint . --ext ts,tsx` không đọc `.mjs`), và `node --check` trên tệp `.mjs` ấy đã qua.
Nhưng **suy luận ấy không phải một phép đo**, nên hàng thứ ba vẫn ghi "chưa chạy xong".

**Một cảnh báo không thuộc e2e nhưng phải ghi:** hạng mục "chi phí thêm cho một màn"
của cổng kích thước gói đang ở **279,8 / 280 KiB — còn dư 0,2 KiB**. Ai thêm một `import`
vào đường tải màn đầu tiên sẽ làm nó đỏ, và triệu chứng sẽ trông như "màn mới làm hỏng
build".

### 1.2 Kiểm kê màn — đếm bằng MÀN, và ba con số của tài liệu cũ đều sai

| Tầng | Số đã đo | Tài liệu cũ nói |
|---|---|---|
| Route thật trong `src/routes/router.tsx` | **43** | 47 |
| — màn sản phẩm có route | **35** | 35 ✓ |
| — màn demo chỉ bản dev (`buildDevOnlyRoutes`) | 7 | 7 ✓ |
| — `StateGallery` (`/design-system/states`), cũng chỉ bản dev | 1 | 1 ✓ |
| Thư mục dưới `src/screens/**` | **49** | 49 ✓ |
| Màn KHÔNG có route | **14** | 14 ✓ |
| Bề mặt editor Pascal dựng ra được | **0** | ~16 |
| Bài kiểm đơn vị của 49 màn | **1 526** | — |
| Bài kiểm đơn vị của `PascalViewer` | **33** | 41 |

Ba chỗ tài liệu cũ sai, cả ba đã xác minh:

1. **Router có 43 route, không 47.** Đếm trực tiếp mảng `children` của
   `createBrowserRouter`.
2. **Ba route `Placeholder` mà `CLAUDE.md` nói tới không còn tồn tại.**
   `/layers/objects`, `/layers/dimensions`, `/floors` — `src/routes/paths.ts` ghi rõ năm
   khoá ấy đã bị gỡ, và không có `Placeholder` nào trong `router.tsx`.
3. **Tài liệu đặc tả đánh mã S-01 → S-47.** `src/screens` có 49 thư mục, nên đặc tả đếm
   ít hơn mã thật hai màn. **Đừng lấy 47 làm số chuẩn.**

### 1.3 Cửa vào: KHÔNG cần đăng nhập cho 35 màn

`src/api/__mocks__/client.ts:271` — `MOCK_FALLBACK_ROLES = ['engineer']`, và
`makeRefreshPayload()` trả vai ấy khi `lastSignedInEmail === null`. `lastSignedInEmail` là
biến cấp module nên mất sau mỗi lượt tải trang.

Đo: **35/35 màn** mở được bằng `page.goto` thẳng, qua được `SessionBootstrap`, và vào với
vai **`engineer`** (`layer.edit` bật, `canEdit === true`).

⇒ Fixture đăng nhập chỉ cần cho **một** việc: vai `viewer`, tức ca `forbidden` của A11.
Khuôn có sẵn ở `e2e/viewer3d.spec.ts:185-205` — **chép, đừng phát minh lại**.

Một bẫy mốc neo đã đo: `getByLabel('Mật khẩu')` **không** `exact` sẽ khớp cả nút
`aria-label="Hiện mật khẩu"` (so không phân biệt hoa thường). Phải `{ exact: true }`,
đúng như `viewer3d.spec.ts:200`. Và chữ "Đăng nhập" xuất hiện ở **bốn** chỗ (`h1`,
`role="tab"`, `tabpanel`, nút gửi) ⇒ không dùng `getByText('Đăng nhập')`.

`safeDestination` (`AuthScreen.container.tsx:105-111`) chỉ chặn đích không bắt đầu bằng
`/` và đích bắt đầu bằng `//`; `location.state.from` **thắng** `?next=`.

### 1.4 Bốn bẫy của đặc tả gốc — hai cái SAI

| Bẫy đặc tả nêu | Kết quả đo |
|---|---|
| "`EditorTour` mở ở mọi lượt e2e, lớp phủ che hết" | **Đúng một nửa — xem 1.4.1.** Lúc TẢI TRANG: 0/35 màn có lớp phủ tour. Nhưng trên `/3d` nó hiện **sau cú bấm đầu tiên** (`ViewerShell.container.tsx:149`), không mang `role="dialog"`, và tấm tối `z-40` chặn mọi cú bấm sau |
| "Bảy màn QC đọc vòng tròn" | **ĐÚNG nhưng là năm, không bảy.** Treo skeleton: `walls` 61 · `grids` 24 · `floors` 17 · `dimensions` 16 · `objects` 16. `rooms` và `thickness` có nội dung thật (0 skeleton) |
| "Lớp `role=status` 'Đang dựng mô hình N tầng' nuốt cú bấm" | **ĐÚNG**, và nó nói "Mô hình đã dựng xong." khi xong — tức nó là mốc chờ dùng được, không chỉ là vật cản |
| "Cờ `scene.pascal-viewer` mặc định tắt" | **ĐÚNG** (`flags.ts:157-165`). Cờ tắt ra `role="status"` "màn xem 3D mới chưa bật cho tài khoản này.", thân 141 ký tự, không có `pascal-canvas` |

### 1.4.1 Một phép đo "lúc tải trang" không nói được gì về "trong luồng"

Bộ dò đếm `[role="dialog"]`/`[role="alertdialog"]` **ngay sau khi tải trang** và ra 0/35.
Con số ấy đúng, nhưng nó trả lời một câu hẹp hơn câu cần hỏi. Một worker bấm thật trên
`/projects/:projectId/3d` thấy `EditorTour` hiện **sau cú bấm đầu tiên**, và nó
**không mang `role="dialog"`** nên bộ dò không có cách nào thấy.

⇒ **Fixture "bỏ qua tour" là CẦN**, cho vỏ 3D và cho mọi màn mà V2 xác nhận có
`EditorTour`. Nó đóng bằng nút **"bỏ qua"** của sản phẩm, **không** bằng cờ — tắt bằng cờ
là đi kiểm một sản phẩm khác.

⇒ **Mốc neo của tour không phải `getByRole('dialog')`.** Ai viết ca cho màn có tour phải
lấy mốc neo thật, không suy ra từ role.

Đây là bài học phương pháp của cả lượt, và nó đáng ghi lại: bộ dò rẻ, chính xác, và đúng ở
đúng chỗ nó đo — **nhưng nó không thay được một người bấm thật**. Hai lớp khảo sát tồn tại
chính vì chỗ này.

### 1.5 Ba bất biến đã chứng minh bằng MÁY cho cả 35 màn

| Mã | Đo | Hệ quả cho kế hoạch |
|---|---|---|
| **A7** (không có nút lưu) | **0/35** màn có nút mang chữ "lưu" | **Một** ca quét-toàn-bộ thay cho 35 ca đếm-bằng-0 |
| **A11** (không màn trắng) | **35/35** màn vẽ ra nội dung; không màn nào trắng hay nổ | Chặng 1 vẫn cần lưới an toàn, nhưng nó đang **xanh**, không phải đang vá lỗ |
| **A15** (dấu thập phân là phẩy) | `0,00 m` · `3,20 m` · `6,40 m` · `9,60 m` · `112,6%` trên vỏ 3D — **đều dấu phẩy** | Ca A15 rẻ nhất nằm ở vỏ 3D |

**Cảnh báo A15 cho người viết ca:** `"5.000 m²"`, `"20.000 m²"`, `"1.842 m²"` ở màn
`billing` là **dấu phân nhóm nghìn tiếng Việt**, không phải dấu thập phân. Một ca bắt mọi
dấu chấm sẽ đỏ vì lý do sai. Ca A15 phải bắt dấu ở **vị trí thập phân**.

### 1.6 Canvas — chỗ nào cảnh dựng thật, chỗ nào chưa

| Màn | `<canvas>` | Nghĩa |
|---|---|---|
| `projectViewer` | **960 × 382** (vai engineer) · **960 × 491** (vai viewer) | cảnh dựng THẬT |
| `projectViewerPascal`, cờ bật | **1406 × 190** trong `[data-testid="pascal-canvas"]` | cảnh dựng THẬT |
| `login` | 550 × 398 | tầng trình diễn (`lib/three/present`) |
| `projectExploded` · `projectMeasure` · `mobileViewer` | **300 × 150** | kích thước mặc định của một `<canvas>` chưa ai vẽ vào ⇒ **cảnh CHƯA dựng** |

`300 × 150` là **phát hiện**, không phải mốc neo. Ba màn ấy không kiểm được "cảnh có hình".

### 1.7 Độ phủ đơn vị theo màn — để e2e không đi kiểm lại

**1 526** bài đơn vị trên 49 màn. e2e đắt hơn đơn vị khoảng một bậc, nên nó chỉ dùng cho
thứ **chỉ trình duyệt thật** chứng minh được: điều hướng, phiên, bàn phím thật, canvas và
WebGL, nhiều lớp phủ chồng nhau, tự lưu theo thời gian thật.

| Phủ dày nhất | | Phủ mỏng nhất | |
|---|---|---|---|
| `AccountSettings` | 151 | `AccessDenied` | 7 |
| `MobileViewer` | 86 | `NotFound` | 7 |
| `CadBranchConfirm` | 67 | `FurnitureLibraryPanel` | 7 |
| `OverlayComparison` | 65 | `ProjectDashboard` | 10 |
| `Viewer3D` | 65 | `CollaborationLayer` | 10 |
| `WallLayerReview` | 61 | `HistoryPanel` | 10 |

33 bài đơn vị của `PascalViewer` chạy trên jsdom **không có WebGL**, nên **không bài nào
từng thấy một khung hình thật**. "Canvas có hình" vì thế là việc **chỉ e2e làm được** —
và mục 1.6 đã đo nó.

### 1.8 Công cụ đo: `scripts/probe-survey.mjs`

Không phải bài kiểm, không nằm trong `e2e/`, `pnpm e2e` không chạy nó. Nó mở từng màn bằng
một `BrowserContext` riêng, chờ `networkidle` cộng 1,5 s, rồi ghi ra chữ nhìn thấy được,
mọi nhãn và `aria-label`, `role="status"`/`dialog`/`tab`, kích thước mọi `<canvas>`, mọi
`data-testid`, số skeleton, nút mang chữ "lưu", lỗi console, URL cuối.

**35 màn trong ~2 phút.** Đầu ra: `probe-35-routes.json` (lượt 1) và
`probe-pascal-viewer.json` (lượt 2: cờ Pascal bật, vai `viewer` ở hai chỗ).

Nó tồn tại vì khảo sát bằng người phải **chép lại** nhãn, và một nhãn chép sai là một
`getByRole` không bao giờ khớp — cả chặng viết spec đổ theo nó. Bộ dò không chép, nó đọc.

---

## 2. Bảy bất biến, và cách mỗi cái vào được tầng e2e

Thứ tự tài liệu khi xung đột: `LUAT_MAN_HINH.md` → `RULE.md` → `CLAUDE.md` → prompt màn.

| Mã | Điều phải chứng minh | Cách kiểm bằng Playwright |
|---|---|---|
| **A6** | Nhãn tiếng Việt, **viết thường kiểu câu**. Hoa được: mã trục, mã lỗi, tên phím | Quét chữ nhìn thấy được, đối chiếu `src/i18n/vi.json` qua `lib/testing/expectVietnamese`. **Ranh giới Pascal: mục 4** |
| **A7** | **Không có nút lưu.** Tự lưu **800 ms** sau thao tác cuối, và **nói ra** cho trình đọc màn hình | 0/35 đã đo bằng máy. Còn phải kiểm: vùng `role="status"` đổi chữ. **`Ctrl+S` KHÔNG chung cho cả vỏ — xem 2.1** |
| **A8** | Mọi thay đổi hoàn tác được, **kèm toast hoàn tác** | sửa → thấy toast → bấm hoàn tác → giá trị về cũ; `Ctrl+Z` cho cùng kết quả (`UNDO_SHORTCUT`) |
| **A9** | Việc A8 không hoàn tác được thì **hỏi trước bằng hộp thoại** | thấy `role="dialog"`; huỷ ⇒ không gì đổi; xác nhận ⇒ mới đổi |
| **A11** | **Bảy trạng thái.** Màn trắng là thất bại duy nhất A11 tồn tại để chặn | e2e kiểm được `success` · `empty` · `forbidden` (đăng nhập `viewer@example.com`) · `error` (`page.route` chặn/500). `loading`/`partial`/`collapsed` phần lớn thuộc tầng đơn vị |
| **A12** | Bàn phím là đường hạng nhất. **Esc đóng lớp trên cùng**, `?` mở bảng phím tắt | `Tab` đi hết luồng chính không cần chuột; `Escape` đóng **đúng một** lớp mỗi lượt |
| **A15** | Định dạng số ở viewmodel; **dấu thập phân là dấu phẩy** | khẳng định trên chuỗi hiện ra. Xem cảnh báo dấu-nghìn ở 1.5 |

### 2.1 `Ctrl+S` xả được rất ít màn, và lý do nằm ở một chỗ ghép cứng

`SAVE_SHORTCUT` của `src/routes/router.tsx` gọi `flushAutosaves()`, và hàm ấy lặp qua
**`mountedAutosaves`** (`hooks/useAutosave.ts:27,40`). Engine chỉ vào tập ấy ở **một** chỗ:
`mountedAutosaves.add(autosave)` tại `useAutosave.ts:112`, tức **chỉ khi màn gọi hook
`useAutosave`**. Dựng engine thẳng bằng `createAutosave<T>({…})` thì engine chạy đúng —
800 ms, lưu thật — nhưng **không ai đăng ký nó**, nên `Ctrl+S` không thấy.

Và `useAutosave` **khoá cứng vào slice `spatial`** của store. `useProjectSettings.ts:15-19`
nói thẳng lý do nó không dùng hook ấy:

> *"Cũng không dùng `useAutosave` hay `ConnectedSaveIndicator` — cả hai khoá cứng vào slice
> `spatial` của store, thứ màn này không có."*

| | Màn | `Ctrl+S` xả được? |
|---|---|---|
| gọi `useAutosave(…)` | `ScaleCalibration:630` · `DimensionOcrReview:576` · `PropertyInspector:1119` | **có** |
| dựng `createAutosave<T>({…})` trần | `RoomLabelReview:602` · `ThicknessStandardization:534` · `ProjectSettings` · `RuleSettings` · `AccountSettings` | **không** |
| `useSaveIndicator`, `persistWallLayer: false` | `WallLayerReview` | không (không có gì để xả) |

`ConnectedSaveIndicator` — biến thể **có** gọi `useAutosave` — **không màn nào render**.
Ba màn cài đặt render bản thuần trình bày `SaveIndicator` (`ProjectSettings.tsx:87,153`,
`RuleSettings.tsx:256`, `AccountSettings.tsx:113`), thứ chỉ nhận `saveState`/`label` làm props.

⇒ Hai điều cho kế hoạch:

1. **Không viết một ca "Ctrl+S xả sớm" dùng chung.** Ở tám màn nó sẽ **xanh vì không có gì
   xảy ra** — tệ hơn một ca đỏ. Mỗi mục phải nói rõ màn của nó nằm ở hàng nào của bảng trên.
2. **Năm màn tự lưu ĐÚNG mà `Ctrl+S` không với tới** là một phát hiện, không phải một lỗ
   kiểm thử. Với ba màn cài đặt, đó là hệ quả **có lý do đã ghi** của chỗ ghép cứng; với
   `rooms` và `thickness` thì **không có lý do nào được ghi** — hai màn ấy *có* `spatial`
   nên dùng được `useAutosave`, mà lại không dùng. Xem `questions.md` **Q13**.

**Sửa một lần đã công bố:** bảng ở lượt trước chia theo `useAutosave` ↔ `useSaveIndicator`.
Cách chia ấy sai — `useSaveIndicator` không liên quan tới việc đăng ký. Trục đúng là **có
gọi hook `useAutosave` hay không**. Lượt đầu tôi grep `createAutosave(` nên hụt
`createAutosave<NormalizedSpatial>({` của `rooms`/`thickness`; worker V7 dẫn đúng hai dòng
ấy và tôi đã bỏ qua.

**A12 là bất biến quan trọng nhất của 14 màn không route**, vì `SCOPE_PRIORITY`
(`lib/input/shortcutRegistry.ts:59`) đặt `dialog`/`sidePanel`/`canvas` trước `global`:
một lớp phủ quên đăng ký phạm vi sẽ để `Escape` rơi xuống `closeTopLayer` toàn cục và
đóng nhầm thứ khác. Mỗi mục của nhóm đó vì thế phải ghi **phạm vi đã grep ra**, không
phải phạm vi đoán.

---

## 3. 14 màn không route — vì sao chúng khác hẳn

**Không màn nào trong số này mở được bằng `page.goto`.** Chúng là hộp thoại, panel, lớp
phủ, vỏ — gắn bên trong một màn chủ. Nên mỗi mục của chúng có hai nửa, và thiếu nửa sau
là thiếu đúng bất biến A12 mà nhóm này tồn tại để kiểm:

1. **Đường mở** — màn chủ nào, thao tác nào.
2. **`Escape` đóng CÁI GÌ** — đóng đúng nó, hay rơi xuống lớp khác.

| Màn | Màn chủ (nơi gọi thật, đã grep) | Việc |
|---|---|---|
| `export/ShareDialog` | `ExportPanel.container.tsx` | V3 |
| `pipeline/PipelineFailure` | `ProcessingScreen.container.tsx` + `useProcessingScreen.ts` | V4 |
| `project/CreateProjectModal` | `ProjectDashboard.container.tsx` · `WelcomeScreen/*` | V3 |
| `rules/ViolationDetail` | `RuleReport.container.tsx` | V12 |
| `system/CollaborationLayer` | `Viewer3D/Viewer3DOverlays.tsx` | V2 |
| `system/ConnectionStates` | *phải xác minh — có thể không có nơi gọi* | V2 |
| `system/EditorTour` | `ExportPanel.container.tsx` · `ExportPanelFooter.tsx` · `WallLayerReview.container.tsx` · `useNotificationCenter.ts` | V2 |
| `system/StateGallery` | `src/App.tsx` **và** route dev `/design-system/states` | V2 |
| `viewer/FurnitureLibraryPanel` | `Viewer3D/Viewer3DPanels.tsx` | V8 |
| `viewer/HistoryPanel` | `Viewer3D/Viewer3DPanels.tsx` | V8 |
| `viewer/PropertyInspector` | `Viewer3D/Viewer3DPanels.tsx` | V8 |
| `viewer/RoomAreaPanel` | `Viewer3D/Viewer3DPanels.tsx` | V8 |
| `viewer/ViewerShell` | `VersionHistory/*` · `ViolationDetail/useViolationDetail.ts` | V8 |
| `viewer/WallGeometryEditor` | `Viewer3D/Viewer3DOverlays.tsx` | V8 |

**`StateGallery` có hai tệp cùng tên và đó là bẫy đã ghi nhận:**
`src/screens/system/StateGallery/` (thư mục, xuất `StateGalleryRoute`, route dev) và
`src/screens/system/StateGallery.tsx` (tệp anh em, bảng demo QA cũ mà `src/App.tsx` dùng).
`router.tsx` nhập có `/index` chính vì thế.

---

## 4. Pascal — ranh giới, và một phát hiện đổi cả nhóm V11

### 4.1 Cờ bật thì canvas có thật, nhưng trình soạn thảo KHÔNG render

Đo bằng trình duyệt thật, cờ bật, chờ 8 s trên `/projects/project-1/3d/pascal`:

| Đo | Kết quả |
|---|---|
| `[data-testid="pascal-canvas"]` | **CÓ** |
| `<canvas>` bên trong | **1406 × 190**, `width`/`height` > 0 |
| shadow DOM · iframe | **0 · 0** — Playwright **xuyên được** |
| `button` · `[role=tab]` · `[role=dialog]` nhìn thấy được | **0 · 0 · 0** |
| `[role]` có trên trang | chỉ `status` và `region` |
| Toàn bộ thân trang | **52 ký tự** |

`src/components/pascal/PascalFrame.tsx:9` chỉ nhập `{ Viewer } from '@pascal-app/viewer'`.
**Không nơi nào trong `src` nhập `@pascal-app/editor`.** Grep 251 tệp `.js` trong
`public/assets/pascal/` cho thấy chuỗi chữ của các bề mặt editor gần như vắng mặt — cây
bị tree-shake.

⇒ **Kết luận, và nó thay 16 mục bằng một mục:**

> ~16 bề mặt editor của fork **chưa có nơi gọi trong AppFront**, nên chưa kiểm được bằng
> e2e. Lý do không phải hạ tầng test — mà là sản phẩm chưa cắm chúng vào.

Kế hoạch vì thế có **một** mục cho cả nhóm, cộng **một** ca hàng rào: khẳng định bên trong
`[data-testid="pascal-canvas"]` có đúng một `<canvas>` và **không** có `button`/`role=tab`
nào. Bài ấy đỏ đúng lúc ai đó gắn `Editor` vào — và đó chính là lúc cần biết.
Một ca hàng rào đáng hơn 16 ca `test.skip`.

### 4.2 Ranh giới A6 — đừng biến nợ thành 16 ca đỏ

Nhãn **do AppFront vẽ** thì A6 áp dụng. Nhãn **trong fork** là nợ **đã ghi nhận**
(`docs/pascal/00-quyet-dinh.md:202`, `unsupported-gpu-fallback.tsx:5-9`).
**Ghi lại một lần, đừng đếm lại mười sáu lần.**

### 4.3 Bốn con số Pascal lệch bộ mẫu chuẩn A14

| | Pascal in ra | A14 (`sampleBuilding.ts:5`) |
|---|---|---|
| tầng | 4 | 4 ✓ |
| tường | **16** | **48** ✗ |
| ô mở | **0** | **16** ✗ |
| phòng | 14 | 14 ✓ |

Hai khớp, hai không. Đó là **phát hiện**, không phải mốc neo — xem `questions.md`.

Pascal tốn **~1,6× CPU luồng chính** (`flags.ts:163`). Hạn chờ của nó không giống màn
thường, và **một lượt chờ không phải phép đo nhịp khung**.

---

## 5. Quy ước thi công — chốt sẵn, để chặng sau không phải quyết lại

| Việc | Chốt |
|---|---|
| Chỗ đặt tệp | `e2e/<nhóm>/<man-hinh>.spec.ts`, ví dụ `e2e/qc/wall-layer-review.spec.ts` |
| Fixture dùng chung | `e2e/fixtures/` — **sáu** tệp: `session.ts` (đăng nhập theo vai) · `clock.ts` (ghim giờ) · `routes.ts` (dựng URL từ `ROUTE_PATTERNS`) · `flags.ts` (bật cờ tính năng) · `tour.ts` (bỏ qua `EditorTour` bằng nút của sản phẩm — xem 1.4.1) · **`seedSpatial.ts`** (bơm `store.spatial`; docblock phải nói thẳng nó chạm nội bộ dev — xem 6.1) |
| Nguyên liệu fixture | **chép, đừng phát minh**: đăng nhập `e2e/viewer3d.spec.ts:185-205` · bật cờ `e2e/pascal-viewer.spec.ts:121-131` · ghim giờ `e2e/app.visual.spec.ts` |
| Tên bài | tiếng Việt, một câu nói ra **điều được chứng minh**, không phải tên hàm |
| Ảnh chuẩn | chỉ cho màn có giá trị hình ảnh thật. Bắt buộc ghim `clock.setFixedTime` + `emulateMedia({ reducedMotion: 'reduce' })` + `setViewportSize` cố định |
| Chờ | **cấm `waitForTimeout`** làm phương tiện đồng bộ — chờ bằng khẳng định. Ngoại lệ duy nhất: chờ hết một quãng chuyển động đã biết (120/180/260/340/700 ms), và phải ghi chú tại sao |
| Thời lượng | năm con số 120 · 180 · 260 · 340 (`MOTION_DURATIONS_MS`) + 700 (`AMBIENT_LOOP_MS`). **Tự lưu là 800 ms** — hằng số khác, thuộc `useAutosave` |
| Giả lập lỗi | `page.route` chặn **đúng một** endpoint; endpoint lấy từ `src/api/endpoints.ts`, không viết tay |
| Song song | `fullyParallel: true` ⇒ bài không được dùng chung trạng thái ngoài trình duyệt |
| Cổng riêng | `E2E_PORT` (đã có, xem `dag.md` mục 3). Worker nào chạy e2e cũng phải đặt nó |
| **Lặp trên một màn** | `E2E_SKIP_PASCAL=1 E2E_PORT=<cổng> pnpm e2e <đường tệp>`. Đo 01-10-2026: một lượt một-màn mất **100 s**, trong đó dựng vách ngăn Pascal **56,9 s** và bài test **6,3 s**. Bỏ lượt dựng ⇒ **17 s**. Chốt an toàn: thiếu `pascal-mount.js` thì runner **vẫn dựng** và nói ra vì sao — đã kiểm bằng cách dời tệp ra ngoài |
| Khi nào KHÔNG đặt `E2E_SKIP_PASCAL` | chạy cả bộ · bài của màn Pascal · trong CI · sau khi sửa gì trong `vendor/pascal` |
| **Tắt `pnpm dev` trước khi chạy `pnpm e2e`** | **Đo được:** một dev server còn chạy trên cùng worktree làm bộ e2e chập chờn — hai lượt liền, mỗi lượt một bài khác đỏ; tắt nó thì 18/18 xanh. Máy còn 8,8 GB rảnh lúc ấy, nên **không** phải thiếu RAM: hai bản Vite giành cùng tệp. Xem `dag.md` mục 3, phép đo 5 |
| Hạn chờ trong fixture | `session.ts` chép khuôn từ `viewer3d.spec.ts:185-205` **nhưng đừng chép hạn 5 s** của dòng 203 — nó là chỗ mỏng đã lộ ra khi máy bị giành tệp. Dùng hạn của `expect` mặc định hoặc một hằng có tên |
| Ngân sách | mỗi bài ≤ 30 s ở máy (Pascal ≤ 60 s vì 1,6× CPU); cả bộ ≤ 15 ph với `workers: 1` của CI. Vượt thì **tách bài, đừng nâng timeout** |

### 5.1 Quy tắc chọn mốc neo

`getByRole` (+ `name`) → `getByLabel` → `getByText` chính xác → `data-testid`.

`data-testid` là **phương án cuối**; dùng thì nói rõ vì sao ba cách trên không được.
Ngoại lệ đã có và được giữ: `[data-testid="pascal-canvas"]` — một `<canvas>` không có role
nào để bám.

**Không bám class Tailwind, không bám thứ tự DOM, không `nth-child`.**

---

## 6. Chặng và cổng

Mỗi chặng ghi: việc · cổng · lệnh nghiệm thu · việc **không** làm trong chặng này.

### Chặng 0 — móng

- **Việc:** sáu fixture (`session` · `clock` · `routes` · `flags` · `tour` · `seedSpatial`),
  nguyên liệu chép từ ba spec đã có (xem 5).
- **Cổng:** một bài mẫu dùng đủ sáu fixture chạy xanh **hai lượt liên tiếp**, và
  `E2E_PORT=5181 pnpm e2e` chạy xanh **cùng lúc** với `E2E_PORT=5182 pnpm e2e`.
- **Lệnh:** `E2E_PORT=5181 pnpm e2e e2e/fixtures` (hai lượt) · hai lượt song song.
- **Không làm:** không viết bài cho màn nào.
- **Trạng thái:** **chưa chạy.**

### Chặng 0b — chữa hai hạn 5 s trước khi Chặng 1 thêm 48 bài

**Việc chen vào giữa Chặng 0 và Chặng 1, vì nó rẻ và nó chặn một thứ sẽ đắt.**

Đo sau khi Chặng 0 thêm 11 bài: bộ 29 lời gọi `test()` **đỏ một bài** —
`viewer3d.spec.ts:546`, qua hạn `expect.poll` 5 s ở `:452` (nhãn thu phóng nhận `100` khi
mốc trước cũng là `100`). Cùng tệp ấy chạy **riêng** thì xanh 7/7, hai lượt liền. Nên biến
quyết định là **số bài chạy song song**, không phải dev server — bảng đầy đủ bảy lượt đo ở
`dag.md` mục 3, phép đo 6.

Chặng 1 thêm **48** lời gọi `test()` nữa. Cùng hạn 5 s, cùng `fullyParallel: true`, cùng sáu
worker — flake sẽ nổ thường xuyên hơn, và nổ ở một bài **không ai vừa sửa**.

- **Việc:** chữa hai hạn 5 s của `e2e/viewer3d.spec.ts` — `:203` (`toBeVisible` sau đăng
  nhập, route tải muộn) và `:452` (`expect.poll` nhãn thu phóng).
- **Cách:** chờ một khẳng định có thật thay vì chờ một con số đổi trong một cửa sổ thời
  gian; hoặc một hằng có tên đủ rộng cho tải thật. **Không** nâng hạn mặc định của cả bộ —
  mục 7.4 cấm nâng timeout, và nâng toàn cục che mọi flake khác.
- **Cổng:** cả bộ chạy xanh **ba lượt liên tiếp**, không phải một.
- **Không làm:** không đụng bài nào khác của `viewer3d.spec.ts`; không thêm ảnh chuẩn.
- **Trạng thái:** **đạt** (2026-10-02). Cả bộ ba lượt liền: 29 passed + 3 skipped mỗi lượt
  (1,2 ph · 46 s · 44 s). Lượt nền trước khi sửa: 29 → 28 + **1 failed** ở `:452`.
  - **Chẩn đoán `:452` khác kế hoạch:** không phải hạn 5 s quá ngắn. `stepRotate` để màn ở
    "Trên xuống", và ở góc ấy thu phóng **không làm gì** — bài từng xanh chỉ nhờ đọc `before`
    lúc camera còn bay 340 ms. Sửa: thu phóng trước khi quay.
  - **PHÁT HIỆN SẢN PHẨM, đo bằng trình duyệt thật:** cuộn chuột và nút "Phóng to" đứng ở 100%
    ở ba góc Trục đo / Trên xuống / Mặt cắt; Phối cảnh thì 112,6 → 197,6 → 390,6%.
    `onViewportWheel` (`useViewerShell.ts`) chỉ chạy khi bộ điều khiển có `dolly`, còn
    `FlatCameraMode` chỉ có `zoom`. Ghi bằng ba bài `test.fixme` — đã bật tạm thành `test`
    để xác nhận: đỏ đúng chỗ thu phóng, góc Phối cảnh làm đối chứng thì xanh.
  - `:203` và `:357` (cùng khuôn, kế hoạch chỉ nêu một): thay `toBeVisible()` 5 s bằng
    `waitForViewerReady` — chờ câu `sr-only` "Mô hình 3D đã dựng xong." của `Viewer3D.tsx`
    (hoặc câu của nhánh `forbidden` cho vai Người xem), trong ngân sách 20 s sẵn có. KHÔNG
    dùng "Mô hình đã dựng xong." của thanh trạng thái: câu ấy của vỏ không biết cảnh đã dựng.
  - Còn mở: `session.ts:59` vẫn dùng hạn mặc định 5 s — chưa thấy nó đỏ, chưa sửa.

### Chặng 1 — lưới an toàn chống màn trắng

- **Việc:** **hai lưới sinh từ dữ liệu** (xem 0.1), không 48 mục viết tay.
  - **Lưới 1 — 35 màn có route.** Một bảng `[khoá route, chuỗi mong đợi]` + một vòng `for`
    sinh 35 lời gọi `test()`: mở đúng đường · có nội dung · `console` không có lỗi chưa bắt
    (**xem cảnh báo favicon ngay dưới**).
  - **Lưới 2 — 13 màn không route**, mỗi màn một bài mở-rồi-`Escape`.
  ⇒ **2 đơn vị bảo trì · 48 lời gọi `test()`.** 13 màn không route (trừ `ConnectionStates` nếu xác minh là không
  có nơi gọi), mỗi màn một bài mở-rồi-`Escape`.
- **Cổng:** 48 lời gọi `test()` xanh; tổng thời gian ≤ 5 ph tại máy (chạy song song được,
  vì chúng là 48 bài rời chứ không phải một vòng lặp).
- **Lệnh:** `pnpm e2e e2e/smoke-grid`.
- **Không làm:** không luồng sâu, không ảnh chuẩn, không kiểm A7/A8/A9.
- **Ghi chú:** bộ dò đã đo **35/35 màn không trắng**, nên chặng này là **lưới an toàn cho
  tương lai**, không phải chặng đi vá lỗ. Nói thẳng điều đó để không ai tưởng nó phát hiện
  được gì ngay.

> **CẢNH BÁO — thứ sẽ làm đỏ cả 35 bài của chặng này nếu không biết trước.**
> `index.html` **không có** thẻ `<link rel="icon">` nào (đã đếm: 0). Nên **mọi** lượt tải
> trang đều xin `/favicon.ico` và nhận **404**, và bất cứ khẳng định "console không có lỗi"
> viết thẳng đều đỏ ở **cả 35 màn** vì một lý do không liên quan gì tới màn.
>
> Ba worker độc lập đều gặp dòng 404 ấy và mỗi người đoán một nguồn khác nhau; truy ra bằng
> CDP Network mới thấy nó là `favicon.ico` (bộ nghe `response` của Playwright **không** thấy
> nó). Đó là một buổi chiều mất đi nếu không ghi lại.
>
> Nên bài của chặng này phải **lọc** lượt xin `/favicon.ico` trước khi khẳng định, và fixture
> dùng chung nên đặt bộ lọc ấy **một chỗ** để 35 bài không mỗi bài viết một kiểu. Cách rẻ hơn
> và chữa gốc: thêm một thẻ `<link rel="icon">` vào `index.html` — nhưng đó là sửa sản phẩm,
> nên nó là một dòng trong `questions.md`, không phải việc kế hoạch tự làm.
- **Trạng thái:** **đạt** (2026-10-03). Cả bộ ba lượt liền: **69 passed + 3 skipped** mỗi lượt (1,6 · 1,5 · 1,4 ph).
  - `e2e/smoke-grid.spec.ts`: 35 bài lưới 1 + 1 bài hộp thoại tạo dự án. `--repeat-each=3`
    cho lưới 1: **105/105**. Mốc neo riêng từng màn (đã đo: "≥1 nút" đỏ 7 màn vốn khoẻ).
    Bảng là `Record<ProductRouteKey, Row>` — đã thử bỏ một dòng: `tsc` đỏ.
  - Lưới 2 trên màn 3D nằm trong `viewer3d.spec.ts` (dùng lại `openViewer`): bốn lớp
    (diện tích phòng · lịch sử · thư viện đồ đạc · ai đang xem) + Escape bỏ chọn ở bài Q2.
    Tổng lưới 2: **6**, không 13 — bỏ/hoãn có lý do: EditorTour (cơ chế hiện còn là giả
    thuyết), ShareDialog/ViolationDetail (cần bơm), WallGeometryEditor (toạ độ chưa đo),
    PipelineFailure/ConnectionStates/StateGallery (không đường mở).
  - Lỗi console được phép, mỗi cái **bắt buộc phải thấy** (nên chúng cũng là ca tự kiểm của
    bộ thu): SSE `/api/streams/notifications` ở `notifications`, và
    `/api/projects/project-1/measurements` ở `projectMeasure` — lỗi thứ hai do lưới bắt
    được, bộ dò lúc tải trang trước đó bỏ sót. Favicon lọc theo đường lượt xin, không theo chữ.
  - Lượt đầu của cổng (2026-10-02) bị dừng vì máy cạn RAM; đo lại: một lượt cả bộ ăn ~9 GB RAM.

### Chặng 2..n — luồng sâu theo V1 → V12

Thứ tự theo giá trị nghiệp vụ, và nhóm nào bị chặn thì xếp sau kèm **điều kiện mở cổng**:

| Thứ tự | Nhóm | Điều kiện mở cổng |
|---|---|---|
| 1 | **V1** cổng vào & phiên | không — làm được ngay, và nó là nguồn của `session.ts` |
| 2 | **V8** vỏ 3D & panel | không — cảnh dựng thật (960 × 382), vai `viewer` đo được |
| 3 | **V9** 3D khác | một phần: `projectMeasure` có `error` dựng sẵn; hai màn canvas 300 × 150 thì **chờ** |
| 4 | **V12** luật · xuất · quản trị | không — `adminUsers` có `forbidden` dựng sẵn đầy đủ nhất repo |
| 5 | **V4** nhận bản vẽ | cần chốt tệp mẫu để `setInputFiles` (xem `questions.md`) |
| 6 | **V5** dây chuyền | không |
| 7 | **V3** dự án | không |
| 8 | **V2** lớp tự mở | cần xác minh `ConnectionStates` có nơi gọi hay không |
| 9 | **V7** QC-b | **đã mở** — Q1 = A′ chốt dùng `seedSpatial`. Mỗi màn kèm một **ca mồi** không bơm (6.1) |
| 10 | **V6** QC-a | **đã mở**, cùng Q1 = A′. Thêm ràng buộc: `:floorId` phải là **mã `Level` của đồ thị** (`L-000001LVL0`, `L-AXISFLOOR1`), không phải chuỗi `L1` |
| 11 | **V10** Pascal vỏ | không — mở rộng `e2e/pascal-viewer.spec.ts` đã có |
| 12 | **V11** Pascal editor | **không mở được** — sản phẩm chưa cắm `Editor` vào. Chỉ một ca hàng rào |

- **Trạng thái:** **đã thi công** (2026-10-03, 10 worker đợt 1 + 2 worker đợt 2, nhánh `e2e/integrate`).
  Trạng thái từng nhóm, số đo thật và chỗ kế hoạch sai so với mã: `docs/notes/e2e/fragments/W01…W12.md`.
  Lỗi: `docs/notes/e2e/bugs.md` (129 mục).

  **Cổng tổng trên nhánh gộp `e2e/integrate` — đạt (2026-10-03):**
  - `pnpm verify` **7/7 đạt**: vitest 362 tệp · 7 481 / 7 481 passed; độ phủ 85,66 % stmts (nền đầu lượt 84,42 %);
    kích thước gói đạt sau khi lớp hướng dẫn của màn 3D chuyển sang nạp động (276,9 / 280 KiB; nhánh gốc 279,9).
  - `pnpm e2e --workers=3` **hai lượt liền: 298 passed · 0 failed · 20 skipped** (4,4 ph mỗi lượt).
    20 skipped = đúng 20 `test.fixme` trong `e2e/` — bài tái hiện của lỗi `mở` / `chờ quyết`.
  - Với 6 trình duyệt (mặc định) bộ 318 bài đẩy Chrome lên ~14,8 GB và lượt bị dừng vì cạn RAM ⇒ trên
    máy này chạy cả bộ với `--workers=3`.

  | Worker | Nhóm | Thư mục bài |
  |---|---|---|
  | W01 | V1 | `e2e/v1`, `e2e/auth` |
  | W02 | V2 + V3 | `e2e/v2v3` |
  | W03 | V4 + V5 | `e2e/v4v5` |
  | W04, W11 | V6 (+ V7 đợt 2) | `e2e/v6` |
  | W05, W11 | V7 | `e2e/v7` |
  | W06 | V8 | `e2e/v8`, `e2e/viewer3d.spec.ts` |
  | W07, W12 | V9 | `e2e/v9` |
  | W08 | V10 + V11 | `e2e/pascal-viewer.spec.ts` |
  | W09 | V12a | `e2e/v12a` |
  | W10 | V12b + chéo | `e2e/v12b`, `e2e/cross`, ca demo trong `pnpm size` |

### 6.1 Ca mồi — cái nạng phải tự nhắc mình được gỡ

Q1 chốt **A′**: dùng cửa bơm kho, **và** mỗi màn QC kèm **một ca mồi KHÔNG bơm**, khẳng
định đúng chuỗi người dùng thấy hôm nay (`empty` hoặc skeleton).

Ngày sản phẩm có đường nạp thật, **ca mồi đỏ** — và tên bài nói người đọc hãy xoá
`seedSpatial`. Đó là điều mà cả "dùng cửa" lẫn "không dùng cửa" đều **không** làm được:
phương án thứ nhất để cái nạng lặng lẽ thành vĩnh viễn; phương án thứ hai để cả tầng QC
không phủ và không ai biết khi nào nó được chữa.

Bảy ca mồi, một cho mỗi màn: `walls` · `objects` · `dimensions` · `grids` · `rooms` ·
`floors` · `thickness`.

Ba ràng buộc của mọi ca **có** bơm:

1. **Tên bài phải nói ra rằng nó bơm.** Một bài xanh đọc như "màn duyệt tường chạy được"
   trong khi đường thật của người dùng vẫn rỗng là một bài nói dối bằng cái tên của nó.
2. **Bơm SAU khi đã tới màn** (`goto` → bơm → khẳng định). Không cần điều hướng trong ứng
   dụng, nên mục "chưa đo" *"kho có sống sót qua điều hướng nội bộ không"* **không chặn**
   chặng này.
3. ~~**Không `Ctrl+Z` trong một ca bơm.**~~ **Hết hiệu lực từ B-V7-04 (2026-10-03):**
   `setSpatial` nay xoá lịch sử `zundo` sau mỗi lượt nạp, nên lượt bơm không còn là một bước
   hoàn tác. Ghi lại để người đọc bài cũ hiểu vì sao có những ca né `Ctrl+Z`.

### Chặng cuối — CI

Cổng `visual` của CI **đã** so ảnh thật (`pnpm e2e`, không phải `pnpm e2e:visual`), nhưng
ảnh chuẩn hiện chỉ có bản `*-chromium-win32.png` còn CI chạy `ubuntu-latest`.

Thứ tự bắt buộc: **chạy → lượt đầu ĐỎ → lấy artifact → commit ảnh linux một lần.**

`pnpm e2e:visual` giờ chỉ là lệnh cập nhật ảnh **tại máy**. **Cấm dùng nó như cách "sửa"
bài đỏ** — ảnh lệch là phát hiện cho tới khi có người xem ảnh và nói rằng thay đổi ấy là
chủ ý.

- **Trạng thái:** **chưa chạy.**

### Một ca chặn hồi quy ngoài phạm vi 12 nhóm

Bảy màn demo chỉ bản dev **không** nằm trong phạm vi kiểm, nhưng bản dựng production
không được mang chúng. Một ca: `grep` chuỗi đánh dấu của chúng trong `dist/` phải **rỗng**.
`router.tsx` đã ghi rằng điều này từng được đo bằng đúng cách ấy — ca này khoá lại phép đo.

---

## 7. Luật cấm — áp dụng cho cả chặng viết test

1. **Cấm báo "đạt" cho bước chưa chạy** (E.10). Bước chưa tới thì ghi "chưa chạy".
2. **Cấm sửa mã sản phẩm để bài xanh.** Bài đỏ vì sản phẩm sai thì ghi thành phát hiện.
   Ngoại lệ: một chỗ thật sự thiếu mốc neo khả dụng — đó là sửa khả năng tiếp cận, và
   phải nói ra là mình đang sửa cái đó.
3. **Cấm tắt tính năng bằng cờ để đi qua nó.** (Bật `scene.pascal-viewer` thì khác: cờ
   mặc định tắt, bật nó là **vào** tính năng, không phải **tránh** nó.)
4. **Cấm hạ ngưỡng độ phủ, cấm nâng timeout, cấm `test.skip` không ghi lý do + điều kiện
   mở lại.**
5. **Cấm `pnpm e2e:visual` như một cách "sửa" bài đỏ.**
6. **Cấm biến nợ A6 của Pascal thành 16 ca đỏ.**


---

# 8. Mục kế hoạch theo từng bề mặt


<!-- ===== V1 ===== -->

## Nhóm V1

Nguồn: `HOP-DONG.md`, `HOP-DONG-BO-SUNG.md`, `ghi-chu-V1.md` (nguồn sự thật), `probe-35-routes.json`, `don-vi-theo-man.md`.
Tôi **không đo lại** gì; chỗ nào ghi chú V1 ghi "chưa đo" thì mục này cũng ghi "chưa đo". Chỗ tôi tự kiểm nguồn: `safeDestination` (`AuthScreen.container.tsx:105-111`, đúng như ghi chú) và `data-auth-state` (`AuthScreen.tsx:301`, đúng).
Chữ nhãn: chép từ ghi chú V1 (đã kèm `file:dòng`). Không có thì "NOT FOUND".
Không có mã test trong tệp này. Mã ca dạng `V1-<BỀ MẶT>-<số>` để lớp sau tham chiếu.

**Điều kiện chung của cả nhóm:**
- Mọi URL dựng từ `ROUTE_PATTERNS`/`ROUTES` (`src/routes/paths.ts`), không viết chuỗi tay.
- Không `waitForTimeout` làm phương tiện đồng bộ (HOP-DONG §8).
- Quét console toàn cục **phải lọc `favicon.ico`** (404 lần đầu của tiến trình trình duyệt, không thuộc màn nào — ghi chú V1 mục B3).
- **Phiên (tiền đề):** `login` là màn công khai (`PUBLIC_ROUTE_PATTERNS`, `paths.ts:194`). Ở mã, 34 màn còn lại đi qua `SessionGate` và cần phiên; **nhưng trên mock, `SessionBootstrap` cấp vai `engineer` cho mọi lượt tải** (HOP-DONG §1.2) nên trong e2e hôm nay *không màn nào bị chặn*. Vì vậy câu "login không cần phiên, 34 màn kia cần" đúng ở tầng mã, **không đo được ở tầng trình duyệt**: ca "chưa đăng nhập bị đá về `/login?next=…`" chưa dựng được (ghi chú V1 mục A3: "chưa đo") — xem CÂU HỎI/CẦN TỪ.

---

## 1. login — Đăng nhập · `ROUTE_PATTERNS.login` = `/login`

1. **Kiểu:** có route, công khai.
2. **Đường tới:** `ROUTE_PATTERNS.login`; đích sau đăng nhập theo `?next=` (ghi chú V1 A2).
3. **Tiền đề:** **không cần phiên** (khác 34 màn kia). Không cờ. Không lớp cần đóng (đo: dialogs 0, status 0). Vai do địa chỉ gõ vào: `viewer@example.com` → chỉ-xem, địa chỉ khác → `engineer` (`e2e/viewer3d.spec.ts:163-166`). Mật khẩu ≥ 8 ký tự — ngưỡng số **chưa đo** (dùng `matkhau-du-dai`).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì **không ai vào được sản phẩm** (mọi màn khác đều là hạ nguồn), và nếu `?next=` sai thì người dùng bị chuyển tới **trang do kẻ khác chọn** (chuyển hướng mở — lỗ hổng bảo mật). Là cổng vào duy nhất của cả dây chuyền và nguồn duy nhất của vai `viewer`, tức mọi ca `forbidden` của 34 màn kia.
5. **Đã kiểm ở tầng đơn vị:** `AuthScreen.test.tsx` (52 bài theo `don-vi-theo-man.md`; 779 dòng): bảy trạng thái đủ, không trắng; tiếng Việt + không màu thô + a11y; Enter gửi từ mọi ô; Tab+Enter; bật/tắt hiện mật khẩu; SSO/quên mật khẩu gọi callback; kiểm ô khi rời ô; chặn gửi hai lần; sai mật khẩu giữ chữ; khoá đếm ngược; `forbidden` khi tài khoản vô hiệu; flash thành công; đổi tab giữ email; cổng HTTP cấp vai chỉ-xem. **e2e không lặp.** Khoảng trống thật: `safeDestination` **không có ca đơn vị nào** (ghi chú V1) — nó là hàm thuần nên ca đơn vị rẻ hơn (đề xuất cho chủ tầng đơn vị, ngoài phạm vi kế hoạch e2e). Đã có e2e: `viewer3d.spec.ts:185-205` (`signInThenOpenViewer`) — chép, không phát minh.
6. **Ca luồng chính:**
   - **V1-LOGIN-01 (đăng nhập engineer qua `?next=`):** `goto(login + '?next=' + encodeURIComponent(<đường thứ hai>))` → điền `Thư điện tử`, `Mật khẩu` → bấm `Đăng nhập` → khẳng định URL cuối là đường thứ hai, và **không** `goto` lần hai (phiên là biến mô-đun; `goto` lần hai làm mất phiên, `viewer3d.spec.ts:187-190`). Chọn hai đường để chứng minh nối dây với router: `ROUTES.mobileViewer('project-1')` (chấp nhận, đo được) và một đường có query+hash `/tai-khoan?x=1#h` (giữ nguyên cả query và hash).
   - **V1-LOGIN-02 (đích không an toàn — ca bảo mật):** cho `?next=` lần lượt là `//evil.example`, `https://evil.example`, `evil` (không `/` đầu), rỗng → sau đăng nhập URL cuối **luôn** là `/` (`ROUTES.dashboard`), origin vẫn là origin của app (`new URL(page.url()).origin`). Đo rồi: cả bốn về `/`. Đây là ca bảo mật thật, mỗi biến thể một lượt đăng nhập (phiên mất sau `goto`). Kèm biến thể `/` + `\` + `evil.example` (dựng bằng `String.fromCharCode(92)`): đo rồi hạ cánh `/` cùng origin — nhưng **cơ chế chưa điều tra** (luật nguồn không chặn `\`), nên ca chỉ khẳng định *kết quả* (cùng origin), **không** khẳng định nguyên nhân.
   - **V1-LOGIN-03 (ưu tiên đích):** `location.state.from` thắng `?next=` (`AuthScreen.container.tsx:238-248`). Ca này đi qua màn khác (`accessDenied`/`notFound` đặt `state.from`) nên gộp vào V1-ACCESSDENIED-03 và V1-NOTFOUND-04, **không lặp ở đây**.
7. **Ca bảy trạng thái:** `empty` (lúc mở, `data-auth-state="empty"`) và `partial` (gõ email, chưa mật khẩu) — **e2e**, đo được. `success` — e2e gián tiếp (URL đổi). `error` (sai mật khẩu / khoá đếm ngược): mock có sinh lỗi hay không **chưa đo** ⇒ ca **chưa đo, không lập**; đơn vị đã phủ bằng cổng giả. `forbidden` (tài khoản vô hiệu), `loading` (đang gửi), `collapsed`: thuộc tầng đơn vị.
8. **Ca bàn phím (A12):** Tab đi hết luồng `Thư điện tử → Mật khẩu → (Hiện mật khẩu) → Ghi nhớ máy này → Đăng nhập` bằng bàn phím thật, rồi Enter gửi (đơn vị đã phủ Enter/Tab trên jsdom; e2e chỉ thêm *thứ tự Tab thật*). Escape: không lớp nào để đóng; đo: Escape không đổi URL (`/login`) và không đổi `data-auth-state` (`empty`) → ca khẳng định "Escape vô hại". Tiêu điểm tự vào ô đầu (đo: `INPUT`). Thứ tự Tab thực tế giữa các nút (SSO, quên mật khẩu): **chưa đo**, nên ca chỉ khẳng định các phần tử *đến được bằng Tab*, không khẳng định thứ tự đầy đủ.
9. **Ca tự lưu (A7):** không áp dụng — màn không sửa dữ liệu; không nút lưu (probe: `saveButtons: []`).
10. **Ca hoàn tác (A8/A9):** không áp dụng — đăng nhập không phải thay đổi dữ liệu người dùng.
11. **Ca định dạng (A6/A15):** A15 không áp dụng (không số). **A6:** nhãn login viết hoa đầu câu ("Đăng nhập", "Thư điện tử", "Mật khẩu", "Ghi nhớ máy này", "Hiện mật khẩu", "Đăng nhập bằng SSO công ty"), trong khi ba màn hệ thống còn lại viết thường hoàn toàn ("bạn chưa có quyền truy cập") — xem CÂU HỎI Q1. **Chưa lập ca A6 cho login** cho tới khi Q1 có đáp án.
12. **Mốc neo** (chữ + nguồn từ ghi chú V1):
    - `getByLabel('Thư điện tử')` — `AuthScreen.tsx:152`
    - `getByLabel('Mật khẩu', { exact: true })` — `AuthScreen.tsx:165` (**bắt buộc `exact`**: không thì khớp cả nút "Hiện mật khẩu")
    - `getByRole('button', { name: 'Đăng nhập', exact: true })` — `AuthScreen.tsx:208` (tab là `role="tab"` nên không va; chữ "Đăng nhập" xuất hiện 4 nơi ⇒ **cấm** `getByText('Đăng nhập')`)
    - `getByRole('tab', { name: 'Đăng ký' })` — `AuthScreen.tsx:350`; `getByRole('button', { name: 'Hiện mật khẩu' })` — `:181`
    - **Ngoại lệ `data-testid`/data-attribute:** `main[data-auth-state]` — `AuthScreen.tsx:301`. Lý do ba cách trên không được: trạng thái chỉ nằm ở thuộc tính này, **không đọc thành lời, không role, không nhãn** (ghi chú V1 A1). Đây là *đề xuất tiếp cận* — chỗ trạng thái không có mốc neo khả dụng — và tôi nói thẳng: nếu người duyệt muốn tránh phụ thuộc thuộc tính data, cách thay là bỏ khẳng định `partial` và chỉ kiểm URL.
13. **KHÔNG kiểm được:** (a) `error`/khoá đếm ngược — mock có sinh lỗi hay không **chưa đo**; đơn vị chứng minh. (b) Ca "chưa đăng nhập bị đá về login" — mock luôn cấp phiên (HOP-DONG §1.2); cách dựng **chưa đo**; CẦN TỪ V-shell. (c) `/login/invitation/*`, `/login/reset-password/*`: công khai nhưng **không có route** ⇒ ra NotFound (đo). Ca e2e chỉ chứng minh "không bị đá về `/login?next=…` và ra NotFound" — không có luồng lời mời để kiểm; ghi thành phát hiện (PHÁT HIỆN 5). (d) Thứ tự Tab đầy đủ, ngưỡng độ dài mật khẩu: chưa đo.

---

## 2. onboarding — Chào mừng · `ROUTE_PATTERNS.onboarding` = `/onboarding`

1. **Kiểu:** có route.
2. **Đường tới:** `ROUTE_PATTERNS.onboarding`.
3. **Tiền đề:** phiên mặc định (engineer). Vai `viewer` đổi hẳn màn (`forbidden`, chỉ còn thẻ 3 — `useWelcomeScreen.ts:96,274`) nhưng **ca viewer chưa đo** trên trình duyệt thật. Không cờ, không lớp. `localStorage` khoá `appfront:onboarding-welcome-seen:<userId>` (`useWelcomeScreen.ts:159`) — mỗi ca dùng context mới để khỏi nhiễm cờ.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì **người dùng mới không biết bắt đầu từ đâu** và có thể bị kẹt ở màn chào (không "Bỏ qua" được, hoặc "Bỏ qua" không sang được `/`). Chú ý mức: thấp hơn login (không chặn ai vào app), nhưng là màn *đầu tiên* người dùng mới thấy.
5. **Đã kiểm ở tầng đơn vị:** `WelcomeScreen.test.tsx` (22 bài; 599 dòng): bảy trạng thái, mỗi trạng thái vẽ thứ riêng; skeleton không có tiêu đề/nút; `error` nói lý do + thử lại; viewer chỉ một thẻ; 3 nút thẻ + 2 liên kết chìm + "Bỏ qua"; tiếng Việt/a11y/màu; logic từng bước theo dữ liệu (không dự án / chưa có tường / chưa duyệt hết / duyệt hết); dự án cập nhật gần nhất; cờ đã-xem ghi khi đi hết ba bước hoặc khi "Bỏ qua", không ghi khi chưa xong, không ném khi ẩn danh; nút thẻ 1 mở modal thật. **e2e không lặp bất cứ ca nào ở trên.**
6. **Ca luồng chính:**
   - **V1-ONBOARDING-01 (Bỏ qua):** `goto(ROUTE_PATTERNS.onboarding)` → thấy `h1` (chữ chứa "bắt đầu trong ba bước") → bấm `Bỏ qua` → URL là `/` (`ROUTES.dashboard`) — đo được. Khẳng định thêm: khoá `localStorage` `appfront:onboarding-welcome-seen:*` **đã được ghi** sau lượt bấm (đơn vị đã khẳng định *logic ghi*; chỉ e2e khẳng định *`localStorage` thật của trình duyệt* + điều hướng router thật).
   - **V1-ONBOARDING-02 (không màn trắng):** vào `/onboarding` → có `h1` và ba `h2` thẻ (đo: 553 ký tự, h1 + 3 h2, không canvas, không skeleton sau khi tải) — chứng minh không trắng ở sản phẩm thật.
   - Không lập ca "vào lại `/onboarding` sau khi Bỏ qua thì có bị đẩy đi không": **chưa đo**.
7. **Ca bảy trạng thái:** `success` (mặc định, đo). `forbidden` (viewer): **chưa đo** ⇒ không lập ca; đơn vị phủ. `loading` (skeleton `role="status" aria-busy="true"`, `WelcomeScreen.tsx:243`) chỉ thoáng — thuộc tầng đơn vị. `empty`/`partial` (theo dữ liệu dự án — mock trả 1 dự án): không dựng biến thể khác được — đơn vị. `error`: dựng được bằng `page.route` chặn endpoint danh sách dự án (lấy từ `src/api/endpoints.ts`, không viết tay) — **chưa đo** kết quả trên trình duyệt ⇒ đề xuất đo ở chặng 0, chưa lập ca. `collapsed`: đơn vị.
8. **Ca bàn phím (A12):** Tab đi hết các điều khiển của luồng chính (ba nút thẻ, hai liên kết chìm, "Bỏ qua") bằng bàn phím thật; "Xem hướng dẫn 2 phút" mang `aria-disabled="true"` — khẳng định nó *không kích hoạt* điều hướng khi Enter. Escape: màn phẳng, không lớp; đo Escape không đổi URL → khẳng định "vô hại". Escape *trong hộp thoại tạo dự án* (bấm thẻ 1): thuộc `CreateProjectModal` — CẦN TỪ V-CreateProjectModal, **không lập ở đây**.
9. **Ca tự lưu (A7):** không áp dụng — không nút lưu, không dữ liệu dự án; cờ `localStorage` không phải tự lưu 800 ms.
10. **Ca hoàn tác (A8/A9):** không áp dụng — "Bỏ qua" chỉ ghi cờ đã-xem cục bộ, không thay đổi dữ liệu dự án; không có hộp thoại xác nhận (đơn vị: không có).
11. **Ca định dạng (A6/A15):** A15 không áp dụng (không số thập phân trong màn; chữ "ba bước" là chữ). **A6:** "Tạo dự án", "Xem dự án mẫu", "Bỏ qua", h1 "Chào Người dùng thử, …" viết hoa đầu câu — cùng câu hỏi Q1 như login; **chưa lập ca**. Bằng chứng còn thiếu để chạy ca sau này: h1 đo lúc chưa đăng nhập nên tên "Người dùng thử" là tên mặc định của mock, **không** phụ thuộc email — ca khẳng định chữ h1 phải dùng `/bắt đầu trong ba bước/` chứ không khẳng định tên.
12. **Mốc neo:**
    - `getByRole('heading', { level: 1 })` — `WelcomeScreen.tsx:286`
    - `getByRole('heading', { name: 'Tạo dự án', level: 2 })` — `WelcomeScreen.tsx:217` (chữ `vi.json` dòng 478)
    - `getByRole('button', { name: 'Tạo dự án' })` — thẻ 1, `:221` (textContent đo = "Tạo dự ánTạo dự án"; `name` truy cập vẫn khớp; nên dùng `exact: true`)
    - Nút/liên kết: `'Tải bản vẽ'`, `'Duyệt kết quả'`, `'Xem dự án mẫu'`, `'Xem hướng dẫn 2 phút'` (`aria-disabled="true"`), `'Bỏ qua'` — `WelcomeScreen.tsx:319-336`, chữ ở `useWelcomeScreen.ts:134-137`.
    - Skeleton `role="status" aria-busy="true"` — `WelcomeScreen.tsx:243`.
    - Không `data-testid` (probe: rỗng). Không cần.
    - **Lưu ý:** nút "Tạo dự án" và h2 "Tạo dự án" cùng chữ ⇒ luôn phân biệt bằng `role`.
13. **KHÔNG kiểm được:** (a) ca `viewer` — chưa đo. (b) `error` bằng `page.route` — chưa đo. (c) "vào lại sau Bỏ qua" — chưa đo. (d) Esc trong modal — thuộc V-CreateProjectModal. (e) Nội dung 6 button chính xác *sau khi* có nhiều dự án — đơn vị. Người chứng minh: đơn vị (a,b,e), V-CreateProjectModal (d), đo ở chặng 0 (c).

---

## 3. accessDenied — Không có quyền · `ROUTE_PATTERNS.accessDenied` = `/khong-co-quyen`

1. **Kiểu:** có route.
2. **Đường tới:** `ROUTE_PATTERNS.accessDenied`, **chỉ bằng URL trực tiếp**. `grep ROUTES.accessDenied` ngoài test = 0 kết quả (ghi chú V1 B3): không nơi nào trong `src/` điều hướng tới màn này. Không có luồng tự nhiên "bị chặn rồi bị chuyển sang đây".
3. **Tiền đề:** phiên mặc định; không cờ; không lớp. Kịch bản mặc định *không* hiện các khối phụ (yêu cầu quyền, mật khẩu liên kết `Mật khẩu liên kết` `:196`, `Lý do bạn cần truy cập (không bắt buộc)` `:178`) — chỉ có hai nút.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người bị từ chối **không có lối ra**: không đăng nhập lại được bằng tài khoản khác, không quay về danh sách dự án; và nếu `state.from` sai thì sau đăng nhập họ **không quay lại đúng nơi** đã bị chặn. **Ghi chú trung thực:** vì không ai điều hướng tới màn này (PHÁT HIỆN 2), giá trị của ca e2e bị giới hạn ở "màn tồn tại và hai lối ra hoạt động"; *không* chứng minh được "bị 403 thì tới đây". Giữ mục vì hai lối ra là dây router thật mà đơn vị không chạm (Q3).
5. **Đã kiểm ở tầng đơn vị:** `AccessDenied.test.tsx` (7 bài — **mỏng**; 251 dòng): bảy trạng thái; a11y/tiếng Việt/màu; ba mã 403 (revoked/expired/password) → ba câu khác nhau, mã lạ → unknown; chặn gửi yêu cầu lần hai trong 1 phút (throttle); cổng tắt thì nút xin quyền/textarea rời DOM; không lộ tên dự án khi `canNameProject` tắt; `currentEmail` null không lộ "undefined". Vì bài đơn vị ≤ 10, đây là chỗ e2e đáng đi sâu — nhưng chỉ ở phần *điều hướng router thật*, không ở logic 403 (đơn vị đã phủ).
6. **Ca luồng chính:**
   - **V1-ACCESSDENIED-01 (mở URL):** `goto` → thấy `h2` "bạn chưa có quyền truy cập" (**không có h1**), hai nút, chú thích "mã lỗi: FORBIDDEN"; không màn trắng.
   - **V1-ACCESSDENIED-02 (về danh sách):** bấm `về danh sách dự án` → URL `/`.
   - **V1-ACCESSDENIED-03 (đăng nhập tài khoản khác, quay lại đúng chỗ):** bấm `đăng nhập bằng tài khoản khác` → URL `/login` (mang `state.from` = `/khong-co-quyen`, `useAccessDenied.ts` ~425-445) → điền form → URL cuối `/khong-co-quyen`. Đây là ca chứng minh `state.from` → `safeDestination` nối dây thật, **thắng `?next=`** (A2). Số dòng `~425-445` trong ghi chú là *xấp xỉ* — lớp sau phải xác minh dòng chính xác khi viết mã.
7. **Ca bảy trạng thái:** `success` (mặc định) — e2e. Ba mã 403 → ba câu khác nhau, `empty`/`partial`/`error`/`forbidden`/`loading`/`collapsed` — **đơn vị** (kịch bản nằm trong `accessDeniedScenarios.ts` của màn, không có endpoint nào để `page.route` chặn: "bộ mẫu trong màn"). Không lập ca e2e cho các nhánh này.
8. **Ca bàn phím (A12):** Tab đến được hai nút bằng bàn phím thật; Enter kích hoạt. Escape: màn không đăng ký Escape (`grep useShortcut|Escape` trong thư mục = 0), **không có lớp để đóng**; đo bằng phím Esc: **chưa đo** ⇒ ca khẳng định "Escape không đổi URL và không nổ" là **ca cần đo trước khi lập**; ghi "chưa đo", không suy từ mã.
9. **Ca tự lưu (A7):** không áp dụng — màn thuần thông tin.
10. **Ca hoàn tác (A8/A9):** không áp dụng — không thay đổi dữ liệu. (Nút "gửi yêu cầu quyền" có throttle nhưng không hiện ở kịch bản mặc định — đơn vị.)
11. **Ca định dạng (A6/A15):** A15 không áp dụng. **A6:** nhãn viết thường hoàn toàn ("bạn chưa có quyền truy cập", "đăng nhập bằng tài khoản khác", "về danh sách dự án", "mã lỗi: FORBIDDEN" — mã lỗi hoa là ngoại lệ hợp lệ). Quét chữ nhìn thấy được đối chiếu `vi.json` — thuộc **một** ca quét toàn cục, không phải ca riêng của màn này.
12. **Mốc neo:**
    - `getByRole('heading', { name: 'bạn chưa có quyền truy cập' })` — `AccessDenied.tsx:123` (chữ `useAccessDenied.ts:99`)
    - `getByRole('button', { name: 'đăng nhập bằng tài khoản khác', exact: true })` — `AccessDenied.tsx:137` (chữ `:109`); **`exact: true` bắt buộc** (Playwright so tên không phân biệt hoa thường, mà "Đăng nhập" của login gần giống)
    - `getByRole('button', { name: 'về danh sách dự án' })` — `AccessDenied.tsx:204` (`:110`)
    - `getByText('mã lỗi: FORBIDDEN')` — chú thích, không role (`~:213`, số dòng xấp xỉ theo ghi chú V1)
    - Không `data-testid`. **Không** dùng `role="status"` — ghi chú V1 đã đo: màn không có `[role=status]`; chỉ có vùng `region aria-live="polite" aria-label="Thông báo"` toàn cục.
13. **KHÔNG kiểm được:** (a) luồng "bị 403 rồi tới đây" — không tồn tại (0 nơi gọi). (b) ba câu theo mã 403, throttle, ẩn tên dự án — đơn vị chứng minh. (c) Esc — chưa đo. (d) Nhánh mật khẩu liên kết / xin quyền / chủ dự án — không hiện ở route mặc định. Người chứng minh: đơn vị (b,d), chặng 0 (c).

---

## 4. notFound — Không tìm thấy · `ROUTE_PATTERNS.notFound` = `*`

1. **Kiểu:** có route (bắt-hết).
2. **Đường tới:** mọi đường không khớp. Đo với `/duong-khong-ton-tai-xyz`; cũng ra NotFound: `/login/invitation/abc` (URL giữ nguyên). Dùng hằng riêng cho đường lạ (đây là *ngoại lệ hợp lệ* của "không viết chuỗi tay": đường lạ không tồn tại trong `ROUTES`), khai báo một lần và đặt tên `UNKNOWN_PATH`.
3. **Tiền đề:** phiên mặc định; không cờ; không lớp. Ca "chưa đăng nhập" (nút chính đổi thành "Đăng nhập" kèm `state.from`) — mock luôn cấp phiên ⇒ **không dựng được, chưa đo**.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người gõ nhầm/nhấn liên kết cũ **gặp màn trắng hoặc URL bị đổi thay vì được dẫn lối**, và mất đường về danh sách dự án. Là màn *đỡ* cho mọi lỗi đường dẫn của 34 màn khác.
5. **Đã kiểm ở tầng đơn vị:** `NotFound.test.tsx` (7 bài — **mỏng**; 211 dòng): bảy trạng thái; a11y/tiếng Việt/màu; chưa đăng nhập ⇒ nút chính "Đăng nhập" điều hướng `/login` + `state.from`; `error` vẫn đủ hai nút; khối gợi ý tối đa `RECENT_PROJECT_LIMIT`, ẩn hẳn khi rỗng; mã lỗi chọn-được, "404" chỉ một lần. e2e không lặp; chỉ chứng minh thứ cần router thật (dưới).
6. **Ca luồng chính:**
   - **V1-NOTFOUND-01 (route `*` bắt đường lạ):** với `UNKNOWN_PATH`, và một đường lạ **sâu có query + hash** (`/a/b/c?x=1#h`): thấy `h2` "không tìm thấy trang này"; **URL giữ nguyên** (không bị đổi/redirect); chú thích "mã lỗi: 404 · <đường>".
   - **V1-NOTFOUND-02 (về danh sách):** bấm `về danh sách dự án` → URL `/` (đo được).
   - **V1-NOTFOUND-03 (hàng dự án gần đây):** liên kết `href="/projects/project-1/floors"` ("Chung cư Hoàng Anh", đo 1 hàng) → bấm → URL đó. Số hàng phụ thuộc mock; khẳng định `≥ 1` và `≤ RECENT_PROJECT_LIMIT`, **không** khẳng định đúng 1 (đo 1, nhưng đơn vị mới là nơi khẳng định hằng giới hạn).
   - **V1-NOTFOUND-04 (`quay lại` theo lịch sử thật):** `goto` một màn có thật → điều hướng client tới đường lạ → bấm `quay lại` → URL về màn trước. `navigate(-1)` (`useNotFound.ts:~279`): **chưa đo**; đây là ca *chỉ trình duyệt thật* có lịch sử làm được. Lớp sau phải **đo trước** khi khẳng định; nếu mở thẳng đường lạ (không lịch sử), hành vi `quay lại` **chưa đo** ⇒ ca chỉ dùng kịch bản có lịch sử.
7. **Ca bảy trạng thái:** `success` (hàng gợi ý có) — e2e. `empty` (khối gợi ý ẩn hẳn khi rỗng), `error`, chưa-đăng-nhập, còn lại — đơn vị. Không lập ca e2e cho chúng.
8. **Ca bàn phím (A12):** Tab đến được hai nút và liên kết hàng dự án; Enter kích hoạt. Escape: không đăng ký (grep = 0), không lớp; đo Esc: **chưa đo** ⇒ như accessDenied, ghi chưa đo, không suy từ mã.
9. **Ca tự lưu (A7):** không áp dụng.
10. **Ca hoàn tác (A8/A9):** không áp dụng — điều hướng thuần.
11. **Ca định dạng (A6/A15):** A15 không áp dụng — ngày "03/08/2026 15:30" là ngày giờ, không phải số thập phân. **A6:** viết thường ("không tìm thấy trang này", "về danh sách dự án", "quay lại"); "mã lỗi: 404" — mã lỗi là ngoại lệ. Nhắm vào một ca quét toàn cục, không riêng.
12. **Mốc neo:**
    - `getByRole('heading', { name: 'không tìm thấy trang này' })` — `NotFound.tsx:107` (chữ `useNotFound.ts:98`)
    - `getByRole('button', { name: 'về danh sách dự án' })` — `NotFound.tsx:111` (`useNotFound.ts:91`)
    - `getByRole('button', { name: 'quay lại' })` — `NotFound.tsx:114` (`useNotFound.ts:89`)
    - `getByRole('link', { name: /Chung cư Hoàng Anh/ })` — `NotFound.tsx:126-141` (hàng là `<Link>`)
    - `getByText('mã lỗi: 404 · /…')` — `NotFound.tsx:143`
    - Không `data-testid`.
13. **KHÔNG kiểm được:** (a) chưa đăng nhập ⇒ nút "Đăng nhập" — mock luôn cấp phiên; CẦN TỪ V-shell. (b) `quay lại` khi không lịch sử — chưa đo. (c) Esc — chưa đo. (d) `empty` của khối gợi ý — mock luôn trả ≥ 1 dự án. Người chứng minh: đơn vị (a,d), chặng 0 (b,c).

---

## 5. mobileViewer — Xem 3D trên điện thoại · `ROUTE_PATTERNS.mobileViewer` = `/m/du-an/:projectId`

1. **Kiểu:** có route.
2. **Đường tới:** `ROUTES.mobileViewer('project-1')` = `/m/du-an/project-1`; viewport **390×844** (khung điện thoại; đo ở kích thước này).
3. **Tiền đề:** phiên mặc định; viewer đủ (đo: `viewer@example.com` qua `?next=` → cùng màn `empty`, không `forbidden`). Không cờ, không lớp. Nhánh `forbidden` của hook (`useMobileViewer.ts:661`, `isForbidden`): điều kiện **chưa đọc ra** — chưa đo.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng mở đường liên kết chia sẻ **trên điện thoại** hoặc thấy màn trắng/canvas lỗi, hoặc — như đo hôm nay — thấy "chưa có mô hình để xem" *dù dự án có mô hình*. Tức bản điện thoại **hôm nay chưa xem được gì** (PHÁT HIỆN 1). Ca e2e giữ giá trị vì nó là phép đo *end-to-end* mà đơn vị (tiêm `spatial` trực tiếp) không thấy.
5. **Đã kiểm ở tầng đơn vị:** `MobileViewer.test.tsx`, `.container.test.tsx`, `useMobileViewer.test.tsx`, `mobileViewerGateway.test.ts`, `mobileViewerGestures.test.ts`, `mobileViewerScene.test.ts` — **86 bài / 6 tệp (dày thứ nhì toàn repo)**: bảy trạng thái; a11y/tiếng Việt/màu; không ô nhập; vùng bấm ≥ 44px; thu gọn 320: ba công cụ; **Esc: tấm thông tin đóng trước, không có thì đóng công cụ** (`MobileViewer.test.tsx:248-…`); cảnh nhận `levels` đủ tầng, tường/phòng thật, tam giác `block` ≠ 0, `tokenOfPartKind`, mức gọn; ranh giới lỗi; cử chỉ. **Tất cả chạy jsdom, không WebGL, và tiêm `spatial` trực tiếp** — nên ca `success` xanh ở đơn vị trong khi sản phẩm thật luôn rỗng (`MobileViewer.container.test.tsx:169-243`). e2e **không lặp** bất cứ ca nào ở đây; phần duy nhất e2e thêm: trạng thái thật ở route thật.
6. **Ca luồng chính:**
   - **V1-MOBILE-01 (mở không trắng, empty end-to-end):** viewport 390×844 → `goto(ROUTES.mobileViewer('project-1'))` → `getByRole('region',{name:'xem mô hình 3D trên điện thoại'})` thấy; `h1` = tên dự án thật ("Chung cư Hoàng Anh") từ mock API; thân chứa "chưa có mô hình để xem" và "dự án này chưa có bản dựng 3D nào để mở trên điện thoại." Khẳng định **không màn trắng** và **tên dự án đến từ mock thật**. **Không** khẳng định kích thước canvas (300×150) — đó là phát hiện, không phải hợp đồng (Q2).
   - **V1-MOBILE-02 (Esc không hỏng):** với bàn phím thật, Escape khi chưa mở lớp nào không đổi URL và không nổ (đo). **Không** lập ca "Esc đóng tấm thông tin" — không dựng được tấm (không có gì để chạm).
   - **V1-MOBILE-03 (viewer):** như 01 nhưng đăng nhập `viewer@example.com` qua `?next=` → cùng `empty`. Chứng minh vai chỉ-xem không đổi kết quả (đo).
7. **Ca bảy trạng thái:** **`empty` — e2e, đo được** (mô tả trên). **`success` — CHƯA KIỂM ĐƯỢC.** Lý do đã đo: `state='empty'` khi `data.storeys.length === 0` (`useMobileViewer.ts:669`); `data` đọc từ `useStore(state => state.spatial)` (`:249-250`, `:267`); `MobileViewerRoute` chỉ truyền `projectId` và `roles` (`MobileViewer.container.tsx:129-141`) và **không màn nào nạp `spatial` cho route này**. Mở thẳng: `empty`, canvas 300×150. Vào màn rooms rồi đổi sang `/m/du-an/project-1` bằng `pushState`+`popstate`: **vẫn `empty`** (màn rooms treo skeleton nên cũng không nạp store — HOP-DONG §1.3). Đo mạng: **không có request nào lấy hình học** (chỉ tài liệu, `vi.json`, hai `HEAD /`). **Người chứng minh phần `success`: tầng đơn vị — 86 bài, tiêm `spatial` trực tiếp.** Kế hoạch e2e không lập ca `success` cho tới khi route có nguồn hình học. `forbidden` — chưa đo. `loading` (chunk lazy `role="status"` "đang tải mô hình") — thoáng, đơn vị. `error`, `partial`, `collapsed` — đơn vị.
8. **Ca bàn phím (A12):** Escape đăng ký **đúng nó, không rơi xuống toàn cục**: `useShortcut` id `mobileViewer.closeTopLayer`, `combo:'Escape'`, `scope:'dialog'` (`MobileViewer.tsx:181-186`, `preventDefault:false`); `SCOPE_PRIORITY = dialog, sidePanel, canvas, global` (`shortcutRegistry.ts:59-64`) ⇒ đứng trước `global`. Hành vi mã: tấm thông tin mở ⇒ đóng tấm; không thì `onSelectTool(null)`. Ở e2e chỉ chứng minh được nhánh "không có gì để đóng" (V1-MOBILE-02). Nhánh "đóng tấm thông tin" **chưa đo** (không dựng được) — đơn vị chứng minh. Tab: thanh dưới `group 'công cụ xem mô hình'` có 4 nút — Tab đến được cả bốn: **chưa đo**.
9. **Ca tự lưu (A7):** không áp dụng — xem, không sửa.
10. **Ca hoàn tác (A8/A9):** không áp dụng — không thay đổi dữ liệu.
11. **Ca định dạng (A6/A15):** A6 — nhãn viết thường ("xem mô hình 3D trên điện thoại", "chia sẻ dự án", "công cụ xem mô hình", "tầng", "chế độ xem", "đo", "thông tin"): thuộc ca quét toàn cục. **A15: chưa phủ** — ở `empty` không có số thập phân; số đo thật chỉ xuất hiện ở `success`, mà `success` không kiểm được. Ghi rõ thành ô `chưa phủ` trong bảng.
12. **Mốc neo:**
    - `getByRole('region', { name: 'xem mô hình 3D trên điện thoại' })` — `MobileViewer.tsx:202-204`
    - `getByRole('heading', { level: 1 })` — `MobileViewer.tsx:215`
    - `getByRole('button', { name: 'chia sẻ dự án' })` — `MobileViewer.tsx:220`
    - `getByRole('group', { name: 'công cụ xem mô hình' })` — `MobileViewerBottomBar.tsx:193`; bốn nút `'tầng'`, `'chế độ xem'`, `'đo'`, `'thông tin'` — `MobileViewerBottomBar.tsx:43-48` (aria-label `:199`)
    - Tấm thông tin `getByRole('dialog', { name: 'thông tin đối tượng đang chọn' })` — `MobileViewerInfoSheet.tsx:202-208` (chỉ khi có đối tượng chọn — **không dựng được**); `'đóng tấm thông tin'` `:238`; `'mở rộng tấm thông tin'`/`'thu gọn tấm thông tin'` `:228`
    - **Canvas: NOT FOUND mốc neo khả dụng.** `aria-hidden="true"` (`MobileViewer.tsx:208`), không `data-testid`. Nếu ca sau này cần đo canvas, buộc dùng `locator('canvas')` trong region. **Đề xuất sửa khả năng tiếp cận** (ngoại lệ được phép nêu): một mốc neo cho canvas — nhưng canvas cố ý `aria-hidden` (trang trí đối với trình đọc màn hình), nên đề xuất đúng là `data-testid`, *không* bỏ `aria-hidden`; đó là quyết định của người duyệt, tôi chỉ nêu.
13. **KHÔNG kiểm được:** (a) `success`: canvas > 300×150, mô hình, chọn/đo/tầng, tấm thông tin, số đo (A15) — lý do đo ở trường 7; người chứng minh: đơn vị (86 bài). (b) Cử chỉ cảm ứng — chưa đo khả năng giả cảm ứng. (c) `forbidden` — chưa đo. (d) Ca "store có dữ liệu thì canvas dựng" trên trình duyệt thật — chưa đo (xem Q2, cửa `import('/src/store/index.ts')` của điều phối chưa thử với màn này). (e) Nhịp khung — Pascal/WebGL không phải phạm vi màn này.

---


<!-- ===== V2 ===== -->

## Nhóm V2

Viết 2026-09-30. Nguồn: `HOP-DONG.md`, `HOP-DONG-BO-SUNG.md`, `ghi-chu-V2.md`, `probe-35-routes.json`, `don-vi-theo-man.md`, `questions.md` (Q3, Q10b), `plan-phan-dau.md` §1.4.1. **Không có dòng mã test nào ở đây.** Không sửa repo.

Phương pháp: ghi chú lớp 1 là nguồn sự thật; tôi đo lại **ba chỗ** nó chưa chốt hoặc có thể mâu thuẫn với `plan-phan-dau.md` (mục "Đo thêm" bên dưới). Chỗ ghi chú ghi "chưa đo" thì mục của tôi cũng "chưa đo".

## Đo thêm của lớp 2 (ba chỗ, còn lại dùng nguyên ghi chú lớp 1)

| # | Nghi vấn | Đo (Chrome riêng, ngữ cảnh mới, `127.0.0.1:5199`) |
|---|---|---|
| 1 | `plan-phan-dau.md` §1.4.1 nói tour hiện **"sau cú bấm đầu tiên"** ở `/3d`. Ghi chú V2 nói hiện **sau resize** | Trên `/projects/project-1/3d` và `/projects/project-1/floors/L1/layers/walls`, sau 4 s: 0 thẻ. **Bấm chuột (700,500), phím `Shift`, lăn chuột, chờ thêm 11 s ⇒ vẫn 0 thẻ** (5 lượt). **Đổi cỡ cửa sổ 1 px ⇒ thẻ hiện** (đã đo ở lớp 1, walls và viewer). ⇒ Điều kiện kích **đã đo** là `resize`; "bấm" **không tái hiện được** ở đây. `scroll` thật: **chưa đo**. Nên ghi "sự kiện cửa sổ", không ghi "cú bấm" |
| 2 | `Đánh dấu tất cả đã đọc` có toast/hoàn tác không (A8) | `/thong-bao`: bấm nút ⇒ số `3` biến mất, nút thành `disabled`, **0 `role="alert"`, 0 nút hoàn tác, 0 toast**; vùng `role="status"` đổi từ `có 3 thông báo chưa đọc` thành `không có thông báo nào` **trong khi danh sách vẫn hiện 6 dòng** |
| 3 | Tên vai của bộ lọc "Chưa đọc" | `getByRole('button', { name: 'Chưa đọc', exact: true }).click()` **hết hạn 30 s** ⇒ phần tử này **không phải `button`**. Vai thật: **chưa đo**. Đừng viết mốc neo `button` cho bộ lọc |

---

## MỤC 1 — CollaborationLayer · không route · mở từ `Viewer3DOverlays`

**Ba câu.** Kiểm: nút `Ai đang xem` bấm được (không bị ViewCube chặn), danh sách người mở/đóng, `Escape` đóng đúng danh sách. Chứng minh: A12 (Esc đóng đúng một lớp) và A11 (không màn trắng ở nhánh `success`). Đỏ thì người dùng mất: **không xoay được góc nhìn 3D** nếu nút chiếm ô ViewCube (lỗi này đã từng xảy ra, `Viewer3DOverlays.tsx:76-96`), hoặc mất đường xem ai đang cùng làm. Trả lời được câu 3 ⇒ **giữ**, nhưng mục nhỏ: cả bốn năng lực đều tắt (`collaborationGateway.ts:84-89`), nên không có luồng thật nào để kiểm ngoài nút, danh sách, và hit-test.

1. **Kiểu** — không route (lớp phủ). `ROUTE_PATTERNS` không có khoá riêng.
2. **Đường tới** — `goto('/projects/project-1/3d')` (dựng từ `ROUTE_PATTERNS.projectViewer`). `CollaborationLayerContainer` được `lazy`-nạp và **luôn dựng** (`Viewer3DOverlays.tsx:64-66`, `:117`). Không cần thao tác mở.
3. **Tiền đề** — vai mặc định `engineer` (HOP-DONG 1.2); không cờ. Lớp nào phải đóng trước: **`EditorTour` có thể đang phủ vỏ 3D** (xem MỤC 2) — nếu thẻ hiện, `Escape` đầu tiên bỏ tour, không đóng danh sách. Vai `viewer`: **chưa đo**.
4. **Giá trị nghiệp vụ** — xem "Ba câu". Đỏ ở hit-test = ViewCube không bấm được.
5. **Đã kiểm ở tầng đơn vị** — `CollaborationLayer.test.tsx` + `conflictChain.test.tsx`, **10 bài**: bảy trạng thái; tiếp cận + tiếng Việt + không màu thô; `comments === false` ⇒ ghim rời DOM; `presence === false` ⇒ không con trỏ; panel xung đột hiện cả hai giá trị và cả hai tác giả; `canWrite === false`; `isCollapsed`. **Không bài nào** có `Escape` (grep `Escape` ở `CollaborationLayer.test.tsx` ra rỗng) và **không bài nào** đo hit-test/z-index — jsdom không có bố cục. e2e **không lặp** nhánh cờ tắt, panel xung đột.
6. **Ca luồng chính** — (a) `goto` vỏ 3D ⇒ chờ `getByRole('button', { name: 'Ai đang xem' })` hiện, `aria-expanded="false"`. (b) Hit-test: toạ độ tâm nút phải trúng **chính nút**, toạ độ tâm ViewCube phải trúng điều khiển của ViewCube, không phải nút (đo: nút `top 284 px`, `36×36`; tâm nút trúng nút; tâm ViewCube trúng nút `Góc nhìn sẵn`). (c) Bấm nút ⇒ `aria-expanded="true"` và `getByLabel('Những người đang xem')` hiện, nội dung chứa `Người dùng thử (bạn)`. (d) `Escape` ⇒ `aria-expanded="false"`, danh sách biến mất, **URL không đổi**, panel `Thuộc tính` còn.
7. **Ca bảy trạng thái** — `success`: e2e (a)-(d). `empty`/`error`/`partial`/`loading`/`collapsed`: **thuộc tầng đơn vị** (10 bài). `forbidden`: **chưa đo** (vai `viewer` chưa thử). Cả bốn năng lực tắt nên "không có dữ liệu để ra `error`" — không dựng được bằng `page.route` vì cổng **không gọi mạng** (`collaborationGateway.ts` docblock: "không `fetch`, không `EventSource`").
8. **Ca bàn phím (A12)** — phạm vi **đã grep ra**: `collaborationLayer.roster.close`, `combo: 'Escape'`, **`scope: 'sidePanel'`**, `enabled: isRosterOpen` (`CollaborationLayer.tsx:252-261`). Cùng lớp: `ConflictPanel.tsx:175-176` `sidePanel`; `CommentThread.tsx:343-344` `canvas` (cả hai **không tới được** trên màn — cờ tắt). Trình tự: mở danh sách ⇒ **một** `Escape` đóng đúng nó (đo). `Tab` đi hết: nút là `button` thường; **chưa đo** thứ tự Tab trên vỏ 3D. Không rơi xuống `global.closeTopLayer` vì `sidePanel` đứng trước `global` (`shortcutRegistry.ts:59`). Khi có thể tour cùng hiện: thứ tự theo phạm vi rồi LIFO (Q3) — `sidePanel` trước `canvas`, nên danh sách đóng **trước** tour (`canvas`); **chưa đo** cặp này.
9. **Ca tự lưu (A7)** — **không áp dụng**: không dữ liệu nào được ghi (cờ `comments`/`locks` tắt; `COLLABORATION_CAPABILITIES` toàn `false`).
10. **Ca hoàn tác (A8/A9)** — **không áp dụng** trên màn hôm nay: không có thay đổi dữ liệu nào tới được. Panel xung đột (chọn bên) sẽ cần A9 nhưng **không có đường mở** trên màn (chưa đo có đường nào không).
11. **Ca định dạng (A6/A15)** — A6: chuỗi trên màn viết thường kiểu câu: `Ai đang xem`, `Những người đang xem` (nhãn, hoa ở chữ đầu — **đúng nguyên văn mã**), `đang làm việc riêng`, `chỉ mình bạn đang xem`, `chưa chọn tầng · chưa chọn gì`. Đơn vị đã phủ A6 (R-72). A15: **không áp dụng** (không số thập phân trên lớp này).
12. **Mốc neo** — `getByRole('button', { name: 'Ai đang xem' })` — `CollaborationLayer.tsx:330` (`ROSTER_TOGGLE_LABEL`, `:83`). `getByLabel('Những người đang xem')` — `:192` (`:84`). `getByRole('status')` — `:351`; nhiều `role=status` có thể cùng tồn tại trên vỏ 3D ⇒ **lọc bằng `hasText: 'đang làm việc riêng'`**, đừng `getByRole('status')` trần. Khối định hướng: nhãn `Khối định hướng` (đo; `file:dòng` **NOT FOUND** — chưa grep), nút `Góc nhìn sẵn` (đo; `file:dòng` **NOT FOUND**). Ghim/khoá: `Ghim bình luận trên bản vẽ` (`CommentThread.tsx:51`), `Đối tượng đang bị người khác giữ` (`LockStrip.tsx:19`) — **không hiện trên màn** (cờ tắt).
13. **KHÔNG kiểm được** — con trỏ người khác, ghim bình luận, khoá đối tượng, panel xung đột **trên màn** (cờ tắt vì `src/api/endpoints.ts` không có nhóm cấp dữ liệu; `LOGIC-REQUESTS.md`); chứng minh: đơn vị (panel xung đột, 10 bài). `e2e/viewer3d.spec.ts:479` (bài từng đỏ vì đè ViewCube): **chưa chạy lại**, nên không khẳng định nó xanh.

---

## MỤC 2 — EditorTour · không route · lớp phủ của ba màn chủ

**Ba câu.** Kiểm: tour hiện đúng lúc, đi hết bước, `bỏ qua` và `Escape` đều ghi khoá "đã xem", không hiện lại sau tải lại, không chặn thao tác. Chứng minh: A12 (Esc đóng đúng một lớp, qua registry thật), A6. Đỏ thì người dùng mất: **một thẻ dạy việc chắn hoặc nuốt cú bấm đầu tiên của họ** (nền tối `pointer-events-auto`, bấm nền = bỏ qua, `EditorTour.tsx:250`) — hoặc không bao giờ thấy hướng dẫn lần đầu. Trả lời được ⇒ **giữ**, và đây là mục **nặng nhất** của nhóm vì nó ảnh hưởng **mọi ca trên ba màn chủ**.

1. **Kiểu** — không route; lớp phủ `fixed inset-0 z-40` (`EditorTour.tsx:~236`) mount ở **ba** màn: `ExportPanel.container.tsx:192` (`hostId="export-panel"`), `WallLayerReview.container.tsx:232` (`"wall-layer-review"`), `ViewerShell.container.tsx:149` (`"viewer-shell"`). **Ba nơi gọi, không phải bốn**: `useNotificationCenter.ts` chỉ nhắc tên trong chú thích (`:209`, `:284`); `ExportPanelFooter.tsx:65-68` chỉ mang móc `data-tour-anchor="exportResult"`.
2. **Đường tới** — không có nút "mở". Nó **mount sẵn và chạy** ở ba màn (phase khởi đầu `running` khi khoá đã xem chưa là `'true'`, `useEditorTour.ts:458`), nhưng **chỉ hiện sau một sự kiện `resize`** (đã đo, xem "Đo thêm" 1). Kích: `page.setViewportSize` đổi 1 px. **Giả thuyết nguyên nhân**: lượt render đầu chạy trước khi màn chủ đăng ký phím/dựng neo, và hook chỉ render lại khi có `resize`/`scroll` (`subscribeViewport`, `useEditorTour.ts:423`; luật sống sót `:483`). **Chưa xác minh bằng thiết bị đo.** `scroll` thật: chưa đo.
3. **Tiền đề** — vai không đòi (`viewer` ⇒ `forbidden`, còn ba bước xem: `VIEWER_STEP_IDS`; **chưa đo trên trình duyệt**). Khoá: mới, tức ngữ cảnh mới (localStorage trống). Phải đo **ba host riêng**: khoá tách theo host.
4. **Giá trị nghiệp vụ** — xem "Ba câu". Mục này đồng thời **bảo vệ các nhóm khác**: nếu tour hiện giữa chừng một ca của nhóm khác, cú bấm đầu của họ trúng nền tối và **bỏ qua tour thay vì làm việc họ định làm**. Đo được gì từ đó: ghi khoá `appfront:system-editor-tour-seen:user-mock:<hostId>` = `'true'`.
5. **Đã kiểm ở tầng đơn vị** — `EditorTour.test.tsx`, **16 bài**: bảy trạng thái; tiếp cận + tiếng Việt; đổi phím tắt trong registry ⇒ thẻ đổi; bấm phím thật của bước ⇒ tự chuyển bước; mất neo ⇒ bộ đếm rút; không trùng S-06; bỏ qua (Esc + bấm nền + chip quay lại); **không `role="dialog"`/`aria-modal`/bẫy tiêu điểm**; vai `viewer` còn ba bước; **cờ tách theo host**; giảm chuyển động. **Điều đơn vị KHÔNG thấy được** (vì tiêm `resolveAnchor`/`registry` giả): thứ tự thật "tour render trước, màn chủ đăng ký sau" — đúng chỗ nó hiện muộn — cùng khoá `localStorage` thật và `Escape` qua `appShortcutRegistry` thật. e2e **không lặp**: nội dung bảy trạng thái, tách host, không-dialog.
6. **Ca luồng chính** (trên walls, là host đầy đủ nhất — đo ra 4/6 bước):
   (a) `goto(walls)`; kích bằng `setViewportSize`; chờ `getByRole('region', { name: 'chọn công cụ ở ray bên trái' })`; vùng sống đọc `bước 1 trên 4: chọn công cụ ở ray bên trái`.
   (b) Bấm `getByRole('button', { name: /tiếp theo/ })` đi qua `đi dọc từng đoạn tường` → `đặt lại độ dày cho đoạn đang chọn` → `lùi lại khi lỡ tay` (đo đủ chuỗi 4 bước). (c) Bước cuối ra thẻ tổng kết tiêu đề `bấy nhiêu phím là đủ dùng`, nút `bắt đầu làm việc`; bấm ⇒ thẻ biến mất. (d) `localStorage` có `appfront:system-editor-tour-seen:user-mock:wall-layer-review` = `'true'`; **tải lại + kích lại ⇒ không còn thẻ** (đo).
   (e) Viewer: kích ⇒ `đổi sang khung nhìn khối`, `bước 1 trên 1`.
7. **Ca bảy trạng thái** — e2e thấy: `partial` (đang chạy, 4/6 hoặc 1/1) và `success` (thẻ tổng kết); `empty` khi đã xem (không thẻ, đo sau tải lại). `forbidden`: **chưa đo**. `loading` (thẻ mời `chưa có gì trên khung vẽ`, `hasModel === false`): **chưa thấy trên màn**; `error` (mất neo ⇒ `droppedCount > 0`): e2e **thấy gián tiếp** (walls chỉ 4/6 bước vì list chưa có) nhưng **không khẳng định trạng thái nào**; `collapsed` (`max-width: 1279px`): **chưa đo**; ba cái này thuộc tầng đơn vị. **ExportPanel: tour không hiện dù đã kích** (nguyên nhân **chưa đo**) ⇒ không có ca e2e cho host này cho tới khi đo.
8. **Ca bàn phím (A12)** — phạm vi **đã grep ra**: `editorTour.skip`, `combo: 'Escape'`, **`scope: 'canvas'`**, `preventDefault: false`, `enabled: isTourVisible` (`useEditorTour.ts:575-586`; id ở `TOUR_SKIP_SHORTCUT_ID`). Phím "tiếp" của bước đang mở lấy **phạm vi của chính phím màn chủ** và trả phím lại cho màn chủ (`editorTour.advance`). **Đo:** tour hiện ⇒ `Escape` ⇒ 0 thẻ, chip `xem hướng dẫn` xuất hiện (1), khoá `'true'`. Khi tour **chưa hiện** thì binding **không đăng ký** (`enabled: isTourVisible` false) nên `Escape` rơi xuống lớp khác — điều này quan trọng với mọi ca Esc của nhóm khác (xem MỤC 4). **Chưa đo:** `Escape` khi tour **và** bảng phím (`?`, phạm vi `dialog`) cùng mở — theo phạm vi, `dialog` đóng trước.
9. **Ca tự lưu (A7)** — **không áp dụng**: không dữ liệu của người dùng; chỉ một khoá `localStorage` ghi ngay khi bỏ qua/xong (không có bộ đếm 800 ms) — đây là **khoá UI, không phải dữ liệu dự án**.
10. **Ca hoàn tác (A8/A9)** — **không áp dụng**: không đổi dữ liệu. Đường quay lại là chip `xem hướng dẫn` (`EditorTour.tsx:384`; đo: hiện 1 sau `bỏ qua`). **Chưa đo**: bấm chip có mở lại tour từ bước đầu không (mã: `onReopen` đặt `phase='running'`, `activeStepId=null`).
11. **Ca định dạng (A6/A15)** — A6: nhãn `bỏ qua`, `tiếp theo`, `bắt đầu làm việc`, `xem hướng dẫn`, `chọn công cụ ở ray bên trái`… viết thường kiểu câu; đơn vị đã phủ (R-72). A15: **không áp dụng** (bộ đếm `bước 1 trên 4` là số nguyên).
12. **Mốc neo** — thẻ: `getByRole('region', { name: '<tiêu đề bước>' })` — `<section aria-labelledby>` (`EditorTour.tsx:~270-271`), **`getByRole('dialog')` SAI** (`:15-17`). Vùng sống `p.sr-only` `aria-live="polite"` (`:238`). Nút: `getByRole('button', { name: /bỏ qua/ })` (`:293`, `:339`), `{ name: /tiếp theo/ }` (`:343`) — regex vì `textContent` lặp đôi (`"bỏ quabỏ qua"`); **tên truy cập thật chưa đo**, nhưng `click()` bằng regex chạy được (đo). Nhóm chấm `getByRole('group', { name: 'tiến độ hướng dẫn' })` (`:353-354`), chấm `tới bước N: <tiêu đề>` (`:364`). Chip `xem hướng dẫn` (`:384`). Khoá: `` `appfront:system-editor-tour-seen:${userId}:${hostId}` `` (`useEditorTour.ts:300`, `:329-331`), `userId` đo được `user-mock`. Thẻ mời: `chưa có gì trên khung vẽ` + `mở bộ mẫu` — **không thấy trên màn**.
13. **KHÔNG kiểm được** — host `export-panel` (không hiện; nguyên nhân chưa đo); bước 5-6 của walls (neo ở màn khác; luật sống sót bỏ lặng lẽ); thẻ mời, `collapsed`, `forbidden`, `error` trên trình duyệt (chưa đo; đơn vị phủ). **Điều e2e KHÔNG được phép làm:** đặt sẵn khoá `'true'` bằng `addInitScript` để né tour — hợp đồng mục 3 cấm; tour đóng bằng nút `bỏ qua`. Ai chứng minh: đơn vị cho bảy trạng thái; e2e chỉ chứng minh luồng thật.

**Fixture "bỏ qua tour" cho nhóm khác** (plan §1.4.1 gọi là CẦN): vì tour hiện **không xác định theo thời gian** (chỉ sau `resize`/render lại), một fixture kiểu "chờ thẻ rồi bấm `bỏ qua`" sẽ **treo hoặc hết hạn** ở ca không hề có sự kiện. Hình dạng an toàn: fixture **không chờ**, mà sau mỗi lần `setViewportSize`/điều hướng nó **kiểm có thẻ chưa** (một lần `count()`), có thì bấm `bỏ qua`. Đây là **chi tiết thi công**, cho người viết chặng 0 — tôi chỉ nêu hành vi đã đo.

---

## MỤC 3 — NotificationCenter · có route `/thong-bao`

**Ba câu.** Kiểm: panel mở ra đúng nội dung, `Đánh dấu tất cả đã đọc` đổi số chưa đọc, `Escape` đưa người dùng về đúng chỗ họ đến. Chứng minh: A12; A11 (`success`); A8 (đo: **chưa phủ**). Đỏ thì người dùng mất: **`Escape` đưa họ ra khỏi ứng dụng** khi vào thẳng `/thong-bao` (đo), hoặc không đọc được thông báo. Giữ.

1. **Kiểu** — có route `ROUTE_PATTERNS.notifications` = `/thong-bao` (`paths.ts:84`, `router.tsx:32`). Quả chuông (`NotificationBell`, nhãn `Thông báo`) **không có nơi gọi nào ngoài thư mục của nó** (grep của lớp 1) — chỉ có route.
2. **Đường tới** — `goto('/thong-bao')` (không cần đăng nhập) **và** đường "đến từ màn khác" (đo: `/projects/project-1/3d` → `/thong-bao`).
3. **Tiền đề** — vai không đòi; không cờ; không lớp nào phải đóng trước (đo: `dialogs` = 1 — chính panel; không tour). Lưu ý: dùng `page.evaluate(history.pushState…)` trong phép đo chỉ là cách mô phỏng "đến từ màn khác"; ca thật nên **bấm một liên kết** nếu có (**chưa tìm liên kết nào tới `/thong-bao`** — bell không có nơi gọi).
4. **Giá trị nghiệp vụ** — xem "Ba câu".
5. **Đã kiểm ở tầng đơn vị** — `NotificationCenter.test.tsx`, **19 bài**: bảy trạng thái; tiếp cận + tiếng Việt; 5 thông báo liên tiếp khi cuộn không nhảy; mở rồi đóng số chưa đọc không đổi; bấm thông báo AI ⇒ mở đúng màn duyệt; cổng dữ liệu; nút `chấp nhận` của lời mời; không âm thanh/nhấp nháy; chưa đọc là chấm. **Không bài nào có `Escape`** (grep rỗng). e2e **không lặp** nhánh dữ liệu.
6. **Ca luồng chính** — (a) `goto('/thong-bao')` ⇒ `getByRole('dialog')` hiện; tiêu đề `getByRole('heading', { name: 'Thông báo' })`; số `3`; vùng status `có 3 thông báo chưa đọc`. (b) Bấm `getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })` ⇒ số biến mất, nút `disabled`, status thành `không có thông báo nào` (đo). (c) **Bấm một thông báo ⇒ điều hướng đúng màn** — đơn vị có `[BÀI NGHIỆM THU]`; **chưa đo** ở trình duyệt, điểm đáng thêm cho e2e (điều hướng thật là thứ jsdom không chứng minh).
7. **Ca bảy trạng thái** — `success`: e2e (a)(b). `error`: mock **404** `/api/streams/notifications` (đo, 2 lần) — luồng SSE; màn **vẫn dựng** (không màn trắng) ⇒ đây đã là bằng chứng e2e nhẹ cho A11 ở nhánh dữ liệu thiếu. Dựng `error` thật bằng `page.route` chặn endpoint danh sách: **chưa đo** (không biết tên endpoint trong `endpoints.ts`). `empty`: sau (b) status ghi `không có thông báo nào` nhưng **danh sách vẫn 6 dòng** — xem PHÁT HIỆN. `forbidden`, `partial`, `loading`, `collapsed`: thuộc tầng đơn vị.
8. **Ca bàn phím (A12)** — phạm vi **đã grep ra**: `drawer.close`, `combo: 'Escape'`, **`scope: 'dialog'`** (`Drawer.tsx:89-90`) **và** `createFocusTrap(container, { onEscape: onClose })` (`Drawer.tsx:78`) khi tiêu điểm nằm trong drawer. `onClose` của route = `navigate(-1)` (`NotificationCenter.container.tsx:171-176`). **Đo hai đường vào:** (1) vào thẳng rồi `Escape` ⇒ URL **`about:blank`**, thân 0 ký tự (rời app). (2) đến từ `/projects/project-1/3d` rồi `Escape` ⇒ **về `/projects/project-1/3d`**, panel biến mất. Tiêu điểm lúc mở: nút `Mở cài đặt thông báo` (đo). Một `Escape` = một lớp (`dialog` đóng trước `global`).
9. **Ca tự lưu (A7)** — **không áp dụng**: hành động tức thì, không ô nhập nào để gõ.
10. **Ca hoàn tác (A8/A9)** — **đo: `Đánh dấu tất cả đã đọc` không có toast, không `role="alert"`, không nút hoàn tác**. Hook dùng `useMutation` (`useNotificationCenter.ts:574-580`), không thấy `toast`/`undo` (grep rỗng). **A8 chưa phủ** — và đây là **phát hiện sản phẩm hoặc quyết định phạm vi** (xem CÂU HỎI). A9: hành động không hoàn tác được và không hỏi trước ⇒ cùng câu hỏi.
11. **Ca định dạng (A6/A15)** — A6: nhãn trong mã `Đánh dấu tất cả đã đọc` (`NotificationCenter.tsx:55`), `Mở cài đặt thông báo` (`:57`), `Lọc thông báo` (`:58`), `Thông báo` (`:61`) — **viết hoa chữ đầu của cả câu, không phải "viết thường kiểu câu"**; còn nội dung thông báo viết thường (`hệ thống AI đã xử lý xong bản vẽ tầng trệt`). Ca A6 phải **đối chiếu quy tắc thật của `LUAT_MAN_HINH.md`** (chữ hoa đầu câu có được không) trước khi khẳng định — **chưa đối chiếu**. A15: **không áp dụng** (số chưa đọc nguyên; ngày `08/09/2026`).
12. **Mốc neo** — `getByRole('dialog')` (`Drawer.tsx:141`/`:199`: `role="dialog" aria-modal="true"`) **không có tên** (đo `name: null`) ⇒ **không dùng `{ name }`**; đây là chỗ thiếu mốc neo khả dụng: **ĐỀ XUẤT sửa khả năng tiếp cận** — thêm `aria-label`/`aria-labelledby` cho panel (tôi đang đề xuất sửa cái đó, không phải sửa để bài xanh). `getByRole('heading', { name: 'Thông báo' })` (`NotificationCenter.tsx:~300`). `getByRole('button', { name: 'Đánh dấu tất cả đã đọc' })` (`:55`). `getByRole('button', { name: 'Mở cài đặt thông báo' })` (`:57`, `:315`). `getByLabel('Lọc thông báo')` (`:58`, `:323`); **phần tử con `Chưa đọc` không phải `button`** (đo) — vai **chưa đo**. `getByRole('status')` (`:333`). Từng hàng: nút `Đánh dấu đã đọc`, `xem kết quả`, `xem lỗi`, `chấp nhận`, `xem bình luận` (đo; `file:dòng` **NOT FOUND**).
13. **KHÔNG kiểm được** — luồng SSE thời gian thực (404 ở mock ⇒ không có tin đến); nhận 5 thông báo khi đang cuộn (đơn vị phủ); cài đặt thông báo (`onOpenSettings`, **chưa đo** đích); quả chuông (không nơi gọi). Ai chứng minh: đơn vị.

---

## MỤC 4 — StateGallery · **BỎ**

Route dev `/design-system/states` (`paths.ts:76`, chỉ bản dev — `router.tsx:116-123`). **Bỏ vì câu 3 không trả lời được:** đỏ ở đây **không ai mất gì** — công cụ dev, vắng mặt trong bản dựng sản phẩm; bảng "đã có 7/7" của nó đo bằng bảng kê tĩnh, không phải hành vi người dùng. 13 bài đơn vị (có `Esc đóng lớp trên cùng (A12)` ở `StateGallery.test.tsx:353`) đã phủ A11/A12/A6.
**Giữ lại cho người đọc sau (không phải mục):** hai tệp cùng tên — bề mặt có route là **thư mục** `StateGallery/` (`router.tsx:117` nhập `/index`); tệp anh em `StateGallery.tsx` là bảng demo QA cũ dùng ở `/demo` (`App.tsx:10`, `:53`) — **ngoài phạm vi**, nhãn Anh/Việt lẫn là nợ của nó, **đừng đo A6 trên `/demo`**. Nếu người duyệt muốn một ca tương thích: "route dev mở được, `duyệt bảy trạng thái` hiện" — một dòng, `getByRole('heading', { name: 'duyệt bảy trạng thái' })` (đo; `file:dòng` **NOT FOUND**). Đo: `Escape` khi không mở bảng kết quả không đổi gì, không rời trang; phạm vi `sidePanel` (`StateGalleryToolbar.tsx:159-163`).

## MỤC 5 — ConnectionStates · **BỎ — KHÔNG CÓ NƠI GỌI**

Đã xác minh (ghi chú lớp 1; khớp `questions.md` Q10b): ngoài thư mục của nó, `grep "ConnectionStates" src` ra 5 dòng, **không dòng nào dựng màn** (`queueStore.ts:8` là chú thích; `StateGallery.test.tsx:31,175`; `stateGalleryManifest.ts:198,559-560`); `useConnectionStates`/`createConnectionStatesGateway` **0** nơi gọi. Không có đường mở ⇒ **không có mục 13 trường.** 35 bài đơn vị (`decideConnectionCase`, ba tầng hiển thị, bảy trạng thái, câu chữ, `isQueueFull`, hook, tấm trượt chi tiết) là toàn bộ bằng chứng. Quyết định gắn hay không: **Q10b** (đã có, không lặp lại ở đây).

---


<!-- ===== V3 ===== -->

## Nhóm V3

Nguồn: `HOP-DONG.md` → `HOP-DONG-BO-SUNG.md` → `ghi-chu-V3.md` (sự thật lớp 1), `probe-35-routes.json`, `don-vi-theo-man.md`,
`e2e/smoke.spec.ts` (đọc đủ 9 dòng), và `muc-V1.md`/`questions.md` để không lặp câu hỏi đã có.
Không sửa repo, không viết test, không chạy `pnpm e2e`.

Quy ước: **"V3"** = chép từ `ghi-chu-V3.md`; **"đo lớp 2"** = tôi tự mở trình duyệt xác minh một điểm còn ngờ (ghi rõ từng chỗ);
**"đọc mã"** = suy từ nguồn, chưa thấy chạy; **"chưa đo"** = đúng nghĩa, mục này không suy ra. Bảng coverage-map: `e2e` = mục có ca e2e
(đề xuất), **không** có nghĩa "đã xanh".

Mã ca: `V3-<BỀ MẶT>-<số>`. Mọi URL dựng từ `ROUTES`/`ROUTE_PATTERNS` (`src/routes/paths.ts`), không viết chuỗi tay. Cấm `waitForTimeout`
làm phương tiện đồng bộ (HOP-DONG §8). Quét console phải lọc `favicon.ico` (V3 đầu ghi chú; 404 lần đầu của trình duyệt).

**Điều kiện chung của nhóm:** phiên mặc định trên mock là `engineer`, không cần đăng nhập (HOP-DONG 1.2); `admin` / `viewer` = đăng nhập
qua `?next=` bằng đúng khuôn `signInThenOpenViewer` (`e2e/viewer3d.spec.ts:185-207`) — **chép, không phát minh**. Không màn nào của nhóm có tour tự mở
(V3: `dialogs=0` ở dashboard/settings; `ExportPanel` có `EditorTour` mount — HOP-DONG 3, thuộc V12).

---

## 0. BA ĐIỀU ĐỨNG TRÊN MỌI THỨ KHÁC (chép từ V3, thêm kết quả đo lớp 2)

1. **Danh sách dashboard là 3 dự án viết cứng, không đọc API.** `SAMPLE_PROJECTS` — `dashboard/ProjectDashboard/projectsGateway.ts:57`;
   `fetchProjectList()` = `Promise.resolve(SAMPLE_PROJECTS)` — `:100-101` (đo lớp 2: đọc lại đúng các dòng này). Hệ quả (đo V3): tạo dự án
   xong có toast + "Hoàn tác" + hộp thoại đóng, nhưng lưới vẫn **"3 dự án"** trước và sau `reload`; xoá ở dashboard chỉ là `setQueryData` cục bộ
   (`useProjectDashboard.ts:335-337`, `confirmDelete` `:399-404` — đo lớp 2 đọc lại), `reload` thì thẻ trở lại; đổi tên/nhân bản cũng chỉ cục bộ. Mã dự án của
   dashboard (`p-sunrise-block-b`, `p-hq-renovation`, `p-bac-ninh-factory`) khác mã mock API (`project-1`). Chính `ProjectDashboard.container.tsx:24-32`
   tự khai điều này trong docblock ("a freshly created project will not visually appear until that gateway talks to something real").
2. **`ShareDialog` không mở được từ luồng sản phẩm trên mock.** Nút "chia sẻ" chỉ có khi `ExportPanel` không `empty`
   (`useExportPanel.ts:612`: `graph === null || floors.length === 0`). **Đo lớp 2: V3 nói nạp `store.spatial` là đủ — KHÔNG đủ.** Tôi tiêm
   `setSpatial(normalizeSpatial(createSampleBuilding()), null)`: `/projects/project-1/export` vẫn "chưa có gì được duyệt để xuất | chưa chọn tầng nào để xuất." với 0 nút.
   Phải tiêm **thêm `setFloors(<các Level của đồ thị>)`** (`src/store/projectSlice.ts:16,23,34`): khi đó có đúng 1 nút `chia sẻ` (`ExportPanel.tsx:238`) và hộp thoại mở.
   ⇒ ghi chú V3 **thiếu nửa công thức** của cửa; điều này quan trọng cho mọi thứ dựa vào cửa (Q1 của `questions.md`).
3. **Khi mở, `ShareDialog` vào `error`, và `page.route` KHÔNG cứu được.** V3 ghi "chưa đo `page.route`". **Đo lớp 2:** đặt `page.route(/share-links/)` (GET trả một liên kết `active`,
   DELETE/PATCH/POST trả `revoked`) rồi mở hộp thoại: `role="alert"` "thao tác chia sẻ đã bị huỷ", và bộ lắng nghe `page.on('request')` lọc `share-links` thấy **0 lượt** —
   không có yêu cầu nào rời khỏi trang để bị chặn. Nguyên nhân **chưa xác minh** (đọc mã: `createAppHttpClient()` chạy trên `fetchImpl` giả của mock, `src/api/__mocks__/client.ts:328`
   nói "khi sau lưng không có máy chủ nào"; nhưng tôi chưa đọc tới cùng). Kết luận đo được: **trên mock, các nhánh dữ liệu của ShareDialog không dựng được bằng `page.route`** — khác với giả định của V3 mục 4.

---

## 1. dashboard — Dự án của tôi · `ROUTE_PATTERNS.dashboard` (`/`)

1. **Kiểu:** có route (`ProjectDashboardRoute`, `router.tsx`).
2. **Đường tới:** `goto(ROUTES.dashboard)`; sau đăng nhập không `?next=` cũng về đây (V3).
3. **Tiền đề:** vai `engineer` mặc định; `viewer` cho ca `forbidden`. Không cờ, không tour, không hộp thoại tự mở (V3 đo `dialogs=0`). Viewport 1440 cho `success`; 700 px cho `collapsed` (V3 đo).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không mở được dự án của mình** (bấm "Mở" không tới màn dự án), hoặc **xoá nhầm không bị hỏi**, hoặc **viewer tạo/xoá được dự án**. Ca "tạo dự án rồi thấy trong danh sách" **không lập** — không kiểm được vì sản phẩm chưa nối (mục 0.1), không phải vì hạ tầng test.
5. **Đã kiểm ở tầng đơn vị:** `ProjectDashboard.test.tsx` **10 bài** (đo lớp 2: đọc 10 `it(` — mỏng): bảy trạng thái đủ; skeleton khi loading; rỗng có nút tạo; tìm không khớp có "xoá bộ lọc"; lỗi có "thử lại"; viewer mất "Dự án mới" giữ lưới; không tô "đã xác minh" nếu chưa được giải quyết (A5); Enter mở dự án; `ProjectDashboardRoute` mở modal từ nút của nó; một ngăn xếp toast dùng chung giữa dashboard và hộp thoại. **Đo lớp 2: file này KHÔNG dùng `expectVietnamese` (0 chỗ) và KHÔNG dùng `expectAccessible` (0 chỗ)**; **không có bài nào cho xoá, đổi tên, nhân bản, phím `N`, Esc, thu gọn 700 px** ⇒ các thứ ấy chỉ e2e chạm được. **`e2e/smoke.spec.ts` (9 dòng) phủ đúng một việc:** `goto('/')` → `heading 'Dự án của tôi'` hiển thị + `list 'Danh sách dự án'` hiển thị — **chống màn trắng (A11)**, và nó **không** khẳng định số thẻ, nội dung thẻ, phím, Esc, vai. **`e2e/app.visual.spec.ts`** phủ ảnh `dashboard-1440.png` toàn trang (1440×900, `clock.setFixedTime(2026-06-15T12:00Z)`, `reducedMotion:'reduce'`, chờ 500 ms, `success`, vai engineer — V3) ⇒ **không đề xuất ảnh thứ hai cho cùng thứ đó**; ảnh chuẩn `linux` chưa có (Q12).
6. **Ca luồng chính (chỉ phần smoke KHÔNG phủ):**
   - **V3-DASH-1 — "Mở" đưa người dùng tới màn dự án thật**: bấm `getByRole('button',{name:'Mở Nhà máy Bắc Ninh'})` (V3 đo đích `/projects/p-bac-ninh-factory/3d`); tương tự ba thẻ với ba đích khác nhau (V3 đo: `/projects/p-sunrise-block-b/pipeline`, `/projects/p-hq-renovation/floors/floor-01/layers/walls`, `/projects/p-bac-ninh-factory/3d`). Khẳng định **URL** (điều hướng router thật), không khẳng định nội dung màn đích (mã dự án của dashboard không có trong mock API — màn đích vẽ ca rỗng; V3 đo h "Chưa có bước nào để theo dõi", "Đoạn tường", "THUỘC TÍNH"/"Chưa chọn đối tượng"). Đỏ = bấm "Mở" mà không đi đâu.
   - **V3-DASH-2 — phím `N` mở hộp thoại tạo, chỉ khi có quyền**: engineer bấm `n` ⇒ `getByRole('dialog')` "tạo dự án mới" hiện; viewer bấm `n` ⇒ không dialog (V3 đo: viewer `n` không mở gì). Phím đăng ký `scope:'global'` (`useProjectDashboard.ts:345-348`), bị bộ đăng ký bỏ khi tiêu điểm ở ô nhập.
   - **V3-DASH-3 — xoá có hỏi (A9)**: menu thẻ → `menuitem 'Xoá'` → `dialog` "Xoá dự án?" với nút `Để nguyên`/`Xoá dự án`; `Để nguyên` ⇒ thẻ còn; `Xoá dự án` ⇒ thẻ biến mất (cục bộ). Khẳng định **hộp thoại xuất hiện trước khi xoá** và **huỷ không đổi gì** — không khẳng định độ bền của xoá (mục 0.1: `reload` thẻ trở lại).
   - **V3-DASH-4 — lọc/tìm/thu gọn** (chỉ những thứ smoke không phủ và đơn vị không có): tìm "zzzz" ⇒ `partial` + "Không tìm thấy dự án phù hợp" + nút "Xoá bộ lọc" (đơn vị có bài `partial`; e2e chỉ thêm *gõ thật vào ô tìm*); viewport 700 px ⇒ `collapsed` với thanh "Lọc theo trạng thái" (đơn vị **không** có bài `collapsed` riêng — `useProjectDashboard.ts:327-328` ưu tiên `collapsed` trên `forbidden`).
7. **Ca bảy trạng thái** (`useProjectDashboard.ts:327-334`, ưu tiên từ trên): `success` (1440, đo) — e2e; `collapsed` (700 px, đo) — e2e; `partial` (tìm "zzzz", đo) — e2e; `forbidden` (viewer, đo: không nút "Dự án mới", dòng "Vai người xem: chỉ có thể mở dự án, không tạo hoặc xoá được.") — e2e. `loading`/`error`/`empty`: **thuộc tầng đơn vị** — lưới là bộ mẫu, không có lượt mạng để chặn (V3); nếu sau này `fetchList` nối API thì `error`/`empty` thành ca `page.route`.
8. **Ca bàn phím (A12):** (a) menu thẻ mở → `Escape` đóng đúng menu (V3 đo `menu` 1→0); (b) hộp thoại xoá mở → `Escape` đóng đúng hộp thoại, thẻ còn (V3 đo `cardStill=1`); (c) ô đổi tên tại chỗ: `Escape` = `cancelRename` (`ProjectDashboard.tsx:106`, `ProjectCardTile.tsx:127`) — **chưa đo bằng trình duyệt**, không lập ca; (d) **thứ tự Tab thật** (V3 đo): "Tìm dự án" → "Thông báo" → "Dự án mới" → "Cập nhật gần đây" → "Lưới" → "Bảng" → "Tất cả" → "Đang xử lý"… — ca khẳng định các phần tử *đến được bằng Tab* theo thứ tự này (phần còn lại của thứ tự sau "Đang xử lý": **chưa đo**). Phạm vi: menu dùng `ContextMenu.onClose`; hộp thoại xoá là `Modal` (`scope:'dialog'`, `Modal.tsx:77`). Chỉ **một** lớp mở mỗi lúc (V3 mục 5) — không có ca "hai lớp cùng mở" ở dashboard.
9. **Ca tự lưu (A7):** không áp dụng — không dữ liệu tự lưu; nút chứa chữ "lưu": 0 (probe `saveButtons: []`; thuộc ca quét-toàn-bộ HOP-DONG mục 2, không lặp).
10. **Ca hoàn tác (A8/A9):** **A9** = V3-DASH-3 (xoá không hoàn tác được ⇒ hỏi trước — đo). **A8**: đổi tên và nhân bản **có** `onUndo` (`useProjectDashboard.ts:383,395`, đọc mã), xoá **không** toast và **không** undo (`confirmDelete` `:399-404`) — đúng A9. Ca e2e "đổi tên → toast → Hoàn tác trả tên cũ": **chưa đo** trên trình duyệt (V3 không đo toast của rename/duplicate) và **không có bài đơn vị nào** (0 chỗ nhắc "hoàn tác" trong `ProjectDashboard.test.tsx`) ⇒ **ô A8 = `chưa phủ`**; đề xuất đo ở chặng 0 trước khi lập ca (vì đây là đường A8 duy nhất của dashboard, và nó dùng dữ liệu cục bộ).
11. **Ca định dạng (A6/A15):** **A15** — thẻ hiện "8.420,00 m²", "1.860,00 m²", "5.200,00 m²" (V3 đo probe): dấu chấm là **nhóm nghìn**, dấu phẩy là thập phân ⇒ ca bắt `/,\d{2} m²/u`, không bắt mọi dấu chấm (HOP-DONG mục 2). **A6**: **`role="status"` sr-only in chữ trạng thái TIẾNG ANH** ("success", "forbidden", "partial", "collapsed" — đo V3) từ `ProjectDashboard.tsx:~341-343` (V3 ghi `:343`; đo lớp 2: đọc lại — `<span className="sr-only" role="status">{state}</span>`, `state` là khoá `SevenState` thô). Đơn vị **không bắt được** vì file test không dùng `expectVietnamese` (đo lớp 2). ⇒ **PHÁT HIỆN F1**; ca A6 quét e2e xuyên màn sẽ bắt nó, không lập ca riêng ở đây.
12. **Mốc neo** (V3, có `file:dòng`): `getByRole('heading',{name:'Dự án của tôi'})` — `ProjectDashboard.tsx:190`; `getByRole('list',{name:'Danh sách dự án'})` — `:141` (cả hai là mốc của `smoke.spec.ts`); `getByRole('searchbox',{name:'Tìm dự án'})` — `:167`; `getByRole('button',{name:'Thông báo'})` — `:175`; `getByRole('button',{name:'Dự án mới'})` — `:181` (`textContent` đo "Dự án mớiN"; tên truy cập vẫn khớp); `getByRole('radiogroup',{name:'Kiểu xem'})` — `:203` với "Lưới"/"Bảng"; thẻ `getByRole('listitem',{name:'Nhà máy Bắc Ninh'})` — `ProjectCardTile.tsx:74-76`; `getByRole('button',{name:'Mở Nhà máy Bắc Ninh'})` — `:158`; `getByRole('button',{name:'Tuỳ chọn cho Nhà máy Bắc Ninh'})` — `:105`; `getByRole('menuitem',{name:'Mở'|'Nhân bản'|'Đổi tên'|'Xoá'})` (đo; `file:dòng` **NOT FOUND** trong ghi chú V3); hộp thoại xoá `getByRole('dialog')` tên qua `aria-labelledby="project-delete-title"` = "Xoá dự án?" — `ProjectDashboard.tsx:~312` (V3 ghi `~`, tôi không tự xác minh dòng), nút `Để nguyên`, `Xoá dự án` (`:338` "Xoá dự án" đo lớp 2 thấy chữ ở dòng 338). **Cạm bẫy:** `getByRole('status')` có phần tử sr-only chữ tiếng Anh — **đừng** khẳng định nội dung của nó (F1); dùng `getByRole('heading')`/`list`.
13. **KHÔNG kiểm được:** (a) **tạo → xuất hiện trong danh sách**, **xoá bền qua `reload`**, **đổi tên/nhân bản bền** — gốc là mục 0.1, ai chứng minh: không ai (đơn vị kiểm hành vi cục bộ nên xanh — V3 phát hiện 1); (b) `loading`/`error`/`empty` — không có lượt mạng (V3); (c) `aria-disabled` của mục "Xoá" với vai viewer: V3 đo viewer thấy đủ `["Mở","Nhân bản","Đổi tên","Xoá"]` dù `canDelete = role !== 'viewer'` (`useProjectDashboard.ts:341`) — **chưa đo `aria-disabled`**, không kết luận vi phạm; (d) ô đổi tên tại chỗ bằng `Escape`: chưa đo; (e) độ tin cậy của mã đích "Mở" — mã dự án dashboard không có trong mock API ⇒ màn đích chỉ kiểm bằng URL.

---

## 2. CreateProjectModal — tạo dự án · KHÔNG route · **MỘT bề mặt, HAI đường mở**

**Kết luận hai đường mở (trả lời câu riêng của nhóm):** cả hai gọi `<CreateProjectModalContainer isOpen onDismiss onToast role />` với **cùng bộ props** —
`dashboard/ProjectDashboard/ProjectDashboard.container.tsx:73-78` (`onDismiss={() => setCreateOpen(false)}`, `onToast={addToast}`, `role`) và
`onboarding/WelcomeScreen/WelcomeScreen.container.tsx:91-96` (`onDismiss={closeCreate}`, `onToast={addToast}`, `role`) — **tôi đọc lại cả hai khối (đo lớp 2)**.
Không ai truyền `onCreated`/`forceCompact`. Vậy **một mục**, phủ cả hai đường; khác biệt chỉ ở nơi mở (bảng ở trường 2). Ca chung viết một lần tham số hoá theo "màn chủ"; **không** viết hai mục.

1. **Kiểu:** không route — hộp thoại `role="dialog" aria-modal="true"` (`Modal.tsx:121-123`), 3 bước.
2. **Đường tới:**

| | dashboard | onboarding |
|---|---|---|
| Đường | `goto(ROUTES.dashboard)` → `getByRole('button',{name:'Dự án mới'})` (`ProjectDashboard.tsx:181`) hoặc EmptyState "Tạo dự án mới" (`:~250`) | `goto(ROUTE_PATTERNS.onboarding)` → nút "Tạo dự án" của thẻ 1 (`WelcomeScreen.tsx:221`; có hai phần tử tên "Tạo dự án": `h2` và `button` ⇒ dùng `getByRole('button',…)`) |
| Phím | **`N`** (`useProjectDashboard.ts:345-348`, `scope:'global'`) | **không có** (V3 đo `n` không mở gì) |
| Toast host | `Toast.Provider` của dashboard | `Toast.Provider` **riêng** của Welcome (`WelcomeScreen.container.tsx:110`) — hai provider khác nhau |
| Sau khi đóng | ở `/` | ở `/onboarding` |

3. **Tiền đề:** vai `engineer`/`admin` tạo được; `viewer` → nhánh `forbidden` (`CreateProjectModal.tsx:210-240`: "không có quyền tạo dự án" + nút "đóng"). Trên dashboard viewer không thấy nút mở ⇒ nhánh này **không tới được từ giao diện dashboard**; ca viewer mở từ onboarding: **chưa đo**. Không cờ, không tour.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng mới **không tạo được dự án đầu tiên** (thứ tự việc đầu tiên của luồng onboarding), hoặc **mất dữ liệu đã gõ** khi bấm Esc nhầm, hoặc **toast xác nhận không hiện** nên không biết đã tạo hay chưa. (Ca "thấy nó trong danh sách" không lập — mục 0.1.)
5. **Đã kiểm ở tầng đơn vị:** `CreateProjectModal.test.tsx` **12 bài** (`expectVietnamese` 2 chỗ, `expectAccessible` 2 chỗ, 6 chỗ `SEVEN_STATES`): bảy trạng thái; tiếng Việt/a11y; khoá form + xoay nút khi đang tạo; bỏ wizard cho vai không tạo được; va chạm cao độ có "xem tầng"; cảnh báo bỏ thay đổi *trong* hộp thoại (không hộp thoại lồng); bắt đầu với 4 tầng; chồng tầng hầm + 3 tầng từ 0,0; "áp cho mọi tầng"; tạo xong có hoàn tác (A8); "chỉ đóng ở lần huỷ thứ hai". **Không có bài nào nhắc `Escape`** (đo lớp 2: 0 chỗ) ⇒ Esc thật chỉ e2e chạm được. **e2e không lặp** logic tầng/va chạm.
6. **Ca luồng chính** (tham số hoá theo màn chủ ∈ {dashboard, onboarding}):
   - **V3-CP-1 — tạo dự án hoàn chỉnh, thấy toast ở host của màn chủ**: mở → điền `tên dự án` → `tiếp tục` → (bước 2) điền `chiều cao áp cho mọi tầng` = `3,2` rồi `áp cho mọi tầng` → `tiếp tục` → (bước 3) khẳng định danh sách cao độ → `tạo dự án` ⇒ hộp thoại đóng, toast `Đã tạo dự án "…".` + nút `Hoàn tác` (V3 đo ở dashboard; **ở onboarding: chưa đo bước tạo hoàn chỉnh**). Khẳng định thêm: **không điều hướng** (URL giữ `/` hoặc `/onboarding`). Đỏ = tạo xong mà không có xác nhận.
   - **V3-CP-2 — Esc đóng đúng MỘT bước** (bảng ở trường 8).
   - **V3-CP-3 — tiêu điểm đầu vào nút `Đóng hộp thoại`, không vào ô "tên dự án"** (V3 đo `BUTTON:Đóng hộp thoại`) — khẳng định *hiện trạng*; đỏ/xanh do người duyệt quyết ý muốn (xem F3).
   - **V3-CP-4 — bước 2 khoá "tiếp tục" tới khi mọi tầng có chiều cao** (`disabled`, state `partial`): điều này đơn vị đã có ("va chạm/chồng tầng/áp cho mọi tầng"), nhưng nút `disabled` **thật** ở trình duyệt thì e2e mới thấy — một ca ngắn, vì người dùng kẹt ở bước 2 mà không biết vì sao nếu nút xám không lý do (đỏ = mất luồng tạo).
7. **Ca bảy trạng thái** (`useCreateProjectModal.ts:494-500`): `success` (V3-CP-1), `partial` (tên trống ⇒ `tiếp tục` disabled — e2e), `empty` (xoá hết tầng ở bước 2 — e2e, V3 nói "dễ"). `forbidden` (viewer): **chưa đo** ⇒ không lập. `loading` (đang gửi): mock trả ngay ⇒ gần như không bắt được ⇒ đơn vị. **`error`**: **V3 nói mock client KHÔNG đi qua mạng nên `page.route` không bắt được và cách dựng `error` trên mock "chưa đo"** — tôi cũng không đo ⇒ **chưa đo, không lập ca** (nhất quán với mục 0.3: hạ tầng `fetchImpl` giả). `collapsed`: đơn vị.
8. **Ca bàn phím (A12):** **`Escape` đóng ĐÚNG NÓ và đúng MỘT bước mỗi lượt** — phạm vi `scope:'dialog'` (`Modal.tsx:77-78`, id `modal.close`) cộng bẫy tiêu điểm (`:64`), cả hai gọi `requestClose`; `requestClose` — `useCreateProjectModal.ts:~621-628`: `if (isSelectOpen) return;` (`:625` như V3, đo lớp 2 đọc lại) rồi `if (!isDirty) onDismiss()`; form bẩn thì hiện cảnh báo (`isConfirmingDiscard`). Đo V3: form sạch → 1 Esc đóng (`dialogs` 1→0); **form bẩn (đã gõ tên): Esc lần 1 KHÔNG đóng — hiện "đóng và bỏ các thay đổi chưa lưu?" (`dialogs` vẫn 1, cảnh báo 1); Esc lần 2 đóng (0)** ⇒ hai đường đăng ký không cộng dồn: 1 phím = 1 `requestClose`. Từ onboarding: cùng hành vi (đo esc1=1, esc2=0). Thứ tự Tab trong hộp thoại: **bẫy tiêu điểm chưa đo cho modal này** (đo cho ShareDialog, V3) ⇒ không lập ca "Tab không rò". Chưa đo: Esc khi đang `isSubmitting`; Esc khi `Select` "loại công trình" đang mở (mã: dropdown tự lo, `:625`, chưa đo trình duyệt).
9. **Ca tự lưu (A7):** không áp dụng — biểu mẫu tạo có nút tường minh "tạo dự án"; không tự lưu, không nút lưu.
10. **Ca hoàn tác (A8/A9):** **A8**: toast `Đã tạo dự án "…".` + `Hoàn tác` đo được (V3); **kết quả bấm "Hoàn tác": chưa đo** (`gateway.remove` gọi mock) — đơn vị có bài "tạo xong có hoàn tác"; e2e chỉ khẳng định **toast + nút có mặt ở đúng host** ⇒ V3-CP-1. **A9-thay**: đóng khi đã gõ ⇒ hỏi "đóng và bỏ các thay đổi chưa lưu?" (không phải hộp thoại lồng — đơn vị đã có; e2e = Esc lần 1 ở trường 8).
11. **Ca định dạng (A6/A15):** **A15** — bước 3 hiện `0,0 m`, `3,2 m`, `6,4 m`, `9,6 m` (V3 đo), dấu phẩy ✔; ô nhập bằng dấu phẩy `3,2` ⇒ ca bắt `/\d,\d m/u`. **A6:** nhãn của hộp thoại viết thường (`tạo dự án mới`, `tên dự án`, `mã dự án`, `địa chỉ`, `loại công trình`, `ghi chú`, `huỷ`, `tiếp tục`, `quay lại`, `tạo dự án`) — kiểu câu; đơn vị có `expectVietnamese`.
12. **Mốc neo** (V3, có `file:dòng`): `getByRole('dialog')` — tên qua `aria-labelledby="create-project-modal-title"` = "tạo dự án mới" (`CreateProjectModal.tsx:217-219,244-246`; **là `<span>` không phải heading ⇒ đừng `getByRole('heading')`**); `getByRole('status')` "bước 1 / 3" (`:260`, sr-only; thêm status thứ hai "một phần"/"thành công" `:298` ⇒ **2 status trong hộp thoại: lọc bằng `hasText`**); `getByLabel('tên dự án')` — `:101`; `getByLabel('mã dự án')` — `:110` (tự sinh từ tên: đo "DA-DU-AN-THU-E2E"); `getByLabel('địa chỉ')` — `:119`; `getByLabel('ghi chú')` — `:144`; "loại công trình" là `Select.Label` `:~130` (không `getByLabel` chuẩn — **chưa đo**); bước 2: `getByLabel('có tầng hầm')` — `StepFloors.tsx:38`, `getByLabel('tên tầng Tầng 1')` — `:91`, `getByLabel('chiều cao thông thuỷ tầng Tầng 1')` — `:102`, `getByRole('button',{name:'xoá Tầng 1'})` — `:110`, `getByRole('button',{name:'thêm tầng'})` (`file:dòng` **NOT FOUND**), `getByLabel('chiều cao áp cho mọi tầng')` — `:131` + `getByRole('button',{name:'áp cho mọi tầng'})`; nút chân: `'quay lại'` `:278`, `'huỷ'` `:284`, `'tiếp tục'` `:288`, `'tạo dự án'` `:292`; cảnh báo: `getByText('đóng và bỏ các thay đổi chưa lưu?')` + `'đóng, bỏ thay đổi'`. Nút mở: bảng ở trường 2.
13. **KHÔNG kiểm được:** (a) dự án mới **không hiện** trong danh sách (mục 0.1; V3 đo trước/sau `reload`); (b) kết quả "Hoàn tác" của toast; (c) `error` (chưa đo cách dựng trên mock); (d) `forbidden` từ onboarding (chưa đo); (e) `loading`; (f) Tab-không-rò (chưa đo cho modal); (g) bước tạo hoàn chỉnh **ở onboarding** (chưa đo). Ai chứng minh: (b),(e) đơn vị; còn lại chưa ai.

---

## 3. projectSettings — Cài đặt dự án · `ROUTE_PATTERNS.projectSettings`

**Bề mặt này là chỗ DUY NHẤT của nhóm mà A7/A8/A9 đều kiểm được bằng e2e thật** (V3 đo tận thời gian): đây là mục đáng đầu tư nhất của V3.

1. **Kiểu:** có route.
2. **Đường tới:** `goto(ROUTES.project.settings('project-1'))` = `/projects/project-1/settings`.
3. **Tiền đề:** `engineer` (mặc định) sửa; `viewer` đọc-chỉ (đăng nhập); `admin@example.com` thấy tab thứ tư "vùng nguy hiểm" (`canDelete = canEdit && roles.includes('admin')`, `useProjectSettings.ts:526`; tab thêm ở `:821-822`). Không cờ, không tour, không hộp thoại tự mở.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **sửa cài đặt mà mất thay đổi** (tự lưu hỏng, không chỉ báo), **không hoàn tác được nhầm lẫn**, hoặc **xoá dự án/mọi tầng mà không phải xác nhận tên** (mất dữ liệu không lấy lại được).
5. **Đã kiểm ở tầng đơn vị:** `ProjectSettings.test.tsx` **24 bài** / 722 dòng (đo lớp 2: `expectVietnamese` 2, `expectAccessible` 2, `SEVEN_STATES` 7 chỗ, `Escape` 1 chỗ): bảy trạng thái đủ, không trắng; tiếng Việt; a11y; skeleton khi tải; viewer đọc-chỉ; `Select` khi thu gọn; lỗi đọc có "Thử lại"; nút xoá khoá tới khi gõ đúng tên; đúng hai việc nguy hiểm mỗi việc một câu hậu quả; không màu thô; đọc qua cổng dữ liệu; **không nút lưu (A7)**; **Esc đóng hộp thoại nguy hiểm (A12)**; liệt kê đủ nhóm khi thu gọn; ẩn hai việc nguy hiểm khi không xoá được; `toSaveState`; **nối dây: gửi sau 800 ms không ai bấm (D-07, A7, dùng đồng hồ giả)**; **mỗi lượt lưu kèm vé hoàn tác và hoàn tác trả ô về (A8)**; lưu hỏng mạng thử lại theo lịch; **409 dừng, không ghi đè**; vai viewer không có tab nguy hiểm; mở khoá nút xoá khi gõ đúng tên (A9); cổng dữ liệu xoá dở trả ok. ⇒ **e2e chỉ dùng đồng hồ thật + trình duyệt thật cho:** 800 ms thật + vùng status đổi chữ + toast thật + hoàn tác thật; mũi tên giữa tab (bàn phím thật); Esc thật; điều hướng sau xoá dự án; phiên/vai thật. **Không lặp:** 409, thử lại theo lịch, logic khoá nút.
6. **Ca luồng chính:**
   - **V3-SET-1 — A7 tự lưu bằng thời gian thật** (đo V3): focus `getByLabel('địa chỉ')`, gõ thêm ⇒ vùng `role="status"` (**dùng `.first()` hoặc `.filter({hasText})`**, xem trường 12) đọc `Có thay đổi chờ đồng bộ`; **~851 ms sau** (V3 đo) đọc `Đã lưu lúc HH:MM` + toast `Đã lưu cài đặt dự án.` kèm `Hoàn tác` (toast nằm trong `role="region"` tên `Thông báo`). Khẳng định bằng **assertion có timeout**, **không** `waitForTimeout(800)`: thứ tự status `Chưa có thay đổi` → `Có thay đổi chờ đồng bộ` → `/Đã lưu lúc \d{2}:\d{2}/`. Khẳng định "không có nút chứa chữ lưu" (V3 đo 0). *Ngưỡng 800 ms là hằng của `useAutosave` (HOP-DONG §8); e2e không khẳng định con số này, chỉ khẳng định thứ tự.*
   - **V3-SET-2 — A8 hoàn tác thật**: từ V3-SET-1, bấm `Hoàn tác` trong toast ⇒ `getByLabel('địa chỉ')` = "12 Nguyễn Huệ, Quận 1" (V3 đo trả về giá trị cũ). `Ctrl+Z` toàn cục (`UNDO_SHORTCUT`, `router.tsx`) cho cùng kết quả: **chưa đo ở màn này** — không lập ca; dựa vào V7 (`Ctrl+Z` không hoàn tác khi tiêu điểm còn trong ô nhập — đo ở rooms; **áp dụng cho ô "địa chỉ"? chưa đo**).
   - **V3-SET-3 — tab bằng mũi tên**: focus tab `chung`, `ArrowRight` → `đơn vị đo` chọn+focus; `ArrowLeft` → `chung`; `End` → `thành viên`; `Home` → `chung` (V3 đo cả bốn). Đỏ = người dùng bàn phím không đổi được nhóm cài đặt.
   - **V3-SET-4 — vai**: `admin@example.com` thấy 4 tab (thêm `vùng nguy hiểm`), `engineer` và `viewer` 3 tab (V3 đo); viewer: 0 ô nhập bật, dòng "Vai hiện tại chỉ xem được cài đặt, không sửa và không xoá.", `trạng thái: không có quyền`.
   - **V3-SET-5 — A9 xoá dự án phải gõ đúng tên** (tab `vùng nguy hiểm`, admin): `getByRole('button',{name:'Xoá dự án',exact:true})` ⇒ `dialog` "Xoá dự án này?", nút xác nhận `disabled` lúc mới mở (V3 đo `confirmDisabled=true`), gõ đúng tên "Chung cư Hoàng Anh" ⇒ enabled; xác nhận ⇒ điều hướng `/` (V3 đo). **Không khẳng định toast "Đã xoá dự án."** — V3 không thấy nó ở 1,5 s (F4, chưa xác minh chắc). `Huỷ`/`Để nguyên` (`ProjectSettings.tsx:176`) ⇒ không đổi gì.
7. **Ca bảy trạng thái** (`useProjectSettings.ts:~122-140`): `success` ✔, `forbidden` ✔ (viewer, dữ liệu vẫn hiện), `partial` ✔ (thấy `Có thay đổi chờ đồng bộ`, V3-SET-1) — **e2e**. `error` (lỗi ĐỌC): V3 nói "mock đi trong trình duyệt nên chưa đo cách dựng" ⇒ **chưa đo**, không lập ca. `collapsed` (viewport hẹp ⇒ tab thành `Select` "nhóm cài đặt"): **chưa đo** ⇒ không lập ca; đơn vị có ("`Select` khi thu gọn", "liệt kê đủ nhóm khi thu gọn"). `empty` (`floorCount === 0`)/`loading`: **thuộc tầng đơn vị**.
8. **Ca bàn phím (A12):** V3-SET-3 (mũi tên); **Esc đóng hộp thoại nguy hiểm — đúng nó** (V3 đo `dialogs` 1→0, URL giữ `/projects/project-1/settings`, đóng cả "Xoá dự án" lẫn "Xoá mọi tầng"); Esc khi không lớp nào: không đổi URL (V3 đo). Phạm vi: `Modal.Root` `scope:'dialog'` (`Modal.tsx:77`). **Không có màn con** nên không có ca "hai lớp cùng mở". Cạm bẫy: sau khi đổi tab **đo được tới 3 `tabpanel` cùng lúc** (bảng chuyển động giữ panel cũ ra) ⇒ `getByRole('tabpanel',{name:'thành viên'})` hoặc chờ, đừng `getByRole('tabpanel')` trần. Cơ chế roving-tabindex nằm ở `src/components/ui/Tabs` (V3: "chưa đọc") — **CẦN TỪ V-shell/Tabs**.
9. **Ca tự lưu (A7):** = V3-SET-1 (đo, chuỗi trạng thái ba bước); nói ra cho trình đọc màn hình bằng vùng status (V3 đo `Đã lưu lúc …`). **Hai `role="status"` trùng chữ** ("Chưa có thay đổi" ×2 — `SaveIndicator` vẽ ở header `ProjectSettings.tsx:87` và footer `:153`) ⇒ `getByRole('status')` trần vi phạm strict mode (V3 phát hiện). Dòng `trạng thái: thành công` (`:154`) là `<span>` không role.
10. **Ca hoàn tác (A8/A9):** V3-SET-2 (A8), V3-SET-5 (A9 — hộp thoại + khoá nút tới khi gõ tên). "Xoá mọi tầng" xác nhận: **chưa đo** (cần dữ liệu tầng để xoá) — chỉ khẳng định hộp thoại + Esc, không khẳng định kết quả.
11. **Ca định dạng (A6/A15):** nhãn viết thường kiểu câu (`cài đặt dự án`, `chung`, `đơn vị đo`, `thành viên`, `vùng nguy hiểm`, `tên dự án`, `địa chỉ`…) — đúng A6; đơn vị có `expectVietnamese`. **A15: `chưa phủ`** — tab `đơn vị đo` có ô số (`dung sai bắt điểm`, `ngưỡng tin cậy`, `tỉ lệ bản vẽ`, `UnitsTab.tsx:59,71,82`) nhưng V3 **chưa đo** định dạng thập phân của chúng.
12. **Mốc neo** (V3, có `file:dòng`): `getByRole('heading',{level:1,name:'cài đặt dự án'})` — `ProjectSettings.tsx:82`; `getByRole('tablist',{name:'nhóm cài đặt'})` — `:126`; tab: `chung`, `đơn vị đo`, `thành viên` — `useProjectSettings.ts:391-394`, admin thêm `vùng nguy hiểm` — `:394` (`getByRole('tab',{name:'chung'})`); ô: `getByLabel('tên dự án')` `GeneralTab.tsx:40`, `'mã dự án'` `:48`, `'địa chỉ'` `:57`, `'loại công trình'` `:65`, `'ghi chú'` `:82`; tab đơn vị: `'đơn vị chiều dài'` `UnitsTab.tsx:46`, `'dung sai bắt điểm'` `:59`, `'ngưỡng tin cậy'` `:71`, `'tỉ lệ bản vẽ'` `:82`; tab thành viên: chữ "3 thành viên · chỉ để xem trong bản này." + "Admin quản trị / Engineer kỹ sư / Viewer người xem" (đo; `file:dòng` **NOT FOUND**); tab nguy hiểm: `getByRole('button',{name:'Xoá mọi tầng',exact:true})` `DangerZoneTab.tsx:~38`, `getByRole('button',{name:'Xoá dự án',exact:true})` `:~90` (V3 ghi `~`); hộp thoại: `getByRole('dialog')` tên qua `aria-labelledby` = "Xoá dự án này?" / "Xoá mọi tầng của dự án?" (`useProjectSettings.ts:404-405`); `getByLabel('gõ lại tên dự án để xác nhận')` — `ProjectSettings.tsx:166`; `'Để nguyên'` — `:176`; xác nhận `'Xoá dự án'` / `'Xoá mọi tầng'` (`useProjectSettings.ts:417-418`); toast: `getByRole('region',{name:'Thông báo'})` (`Toast.tsx:233`, `NotificationHost.tsx:50`) + `getByRole('button',{name:'Hoàn tác'})`; `SaveIndicator`: `role="status"` `aria-live="polite"` (`components/feedback/SaveIndicator.tsx:55-56`). Chữ giờ phụ thuộc đồng hồ ⇒ `/Đã lưu lúc \d{2}:\d{2}/`, hoặc ghim `page.clock`.
13. **KHÔNG kiểm được:** (a) `error` (dựng trên mock: chưa đo); (b) `collapsed` (chưa đo); (c) "Xoá mọi tầng" xác nhận + kết quả (cần dữ liệu tầng); (d) **toast "Đã xoá dự án."** sau khi xoá — `onProjectDeleted` điều hướng đi (`ProjectSettings.container.tsx:52`, `useProjectSettings.ts:748-749`), provider bị gỡ; V3 không thấy ở 1,5 s, **chưa xác minh chắc** (F4); (e) 409/thử lại theo lịch — đơn vị; (f) `Ctrl+Z` toàn cục ở màn này — chưa đo; (g) A15 của tab đơn vị đo — chưa đo. Ai chứng minh: (e) đơn vị; còn lại chưa ai.

---

## 4. ShareDialog — chia sẻ bản vẽ · KHÔNG route · mở từ `ExportPanel`

1. **Kiểu:** không route — hộp thoại (`Modal.Root width={720}`).
2. **Đường tới:** `goto(ROUTES.project.export('project-1'))` → `getByRole('button',{name:'chia sẻ',exact:true})` (`ExportPanel.tsx:238`, `onClick={onShare}` → `setShareOpen(true)`, `ExportPanel.container.tsx:122,149-155`). **Nút chỉ có khi `ExportPanel` không `empty`.** Trên mock **luôn `empty`** ("chưa có gì được duyệt để xuất | chưa chọn tầng nào để xuất.") ⇒ **không có đường mở từ luồng sản phẩm**. Chỉ mở được bằng cửa dev-only: `import('/src/store/index.ts')` rồi **`setSpatial(normalizeSpatial(createSampleBuilding()), null)` + `setFloors(<Level của đồ thị>)`** (đo lớp 2; V3 chỉ ghi nửa đầu).
3. **Tiền đề:** dùng cửa nạp-kho (Q1 của `questions.md` — quyết chưa xong); vai `engineer`/`admin` tạo được liên kết (`can('create','share')`, `shareDialogGateway.ts:~100`). Tour: `ExportPanel` có `EditorTour` mount (HOP-DONG 3) — **chưa đo** nó có hiện khi mở panel không; đóng bằng nút `bỏ qua` nếu thấy.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không chia sẻ được bản vẽ cho người ngoài**, hoặc **thu hồi liên kết mà không biết**, hoặc **tạo liên kết lộ mật khẩu**. *Hôm nay không câu nào trong ba câu ấy kiểm được bằng e2e* (mục 0.2, 0.3) — nên mục này ghi trung thực "chưa phủ" chứ không viết ca giả vờ.
5. **Đã kiểm ở tầng đơn vị:** `ShareDialog.test.tsx` **14 bài** / 487 dòng (`expectVietnamese` 4, `expectAccessible` 6, `SEVEN_STATES` 6): bảy trạng thái đủ (A11); `expectAccessible`/`expectVietnamese` trên cây thật ở cả bảy; không màu thô; **màn không tự ghép URL, không tự sinh mã nhúng**; mã nhúng và khung xem trước cùng phản ánh MỘT `EmbedParams`; không hiện mật khẩu dạng rõ sau khi lưu; **đổi quyền → toast + `onUndo` (A8, `ShareDialog.test.tsx:384`)**; không nút lưu, không nút huỷ (A7) và `success` nói ra mốc tự lưu; **Esc gọi `actions.dismiss` (A12)**; `isOpen=false` không dựng gì. **Đo lớp 2: file test dựng `revoke` giả (`:113-118`) nhưng KHÔNG có bài nào bấm "thu hồi"** (grep `thu hồi`/`revoke` chỉ thấy dòng dựng cổng giả) ⇒ hành vi thu hồi không có bài nào.
6. **Ca luồng chính:** **V3-SHARE-1 — nút "chia sẻ" mở đúng hộp thoại, đóng bằng Esc, Tab không rò** (V3 đo sau khi nạp store): tiêu điểm đầu ở `Đóng hộp thoại`; `Escape` ⇒ `dialogs` 1→0, URL `/projects/project-1/export` giữ, ExportPanel không đổi; mở lại rồi Tab 30 lần: tiêu điểm **không rời hộp thoại** (V3 đo `tabInside=true`). **Điều kiện lập ca: Q1 (cửa) = A hoặc ngoại lệ hẹp; nếu Q1 = B thì ca này không lập** và ShareDialog chỉ còn ô `chưa phủ` (nhất quán `questions.md` Q10). Ca "tạo liên kết / đổi quyền / thu hồi / nhúng": **không lập** — trên mock không dựng được dữ liệu (mục 0.3; `page.route` đo lớp 2 thấy 0 yêu cầu).
7. **Ca bảy trạng thái** (`useShareDialog.ts:506-521`): `error` — **đo được thật** (mock: `role="alert"` "thao tác chia sẻ đã bị huỷ"; bấm "tạo liên kết" → "liên kết không còn tồn tại; có thể đã được thu hồi" — V3); nhưng đó là *hiện trạng của mock*, không phải lỗi mạng dựng có chủ đích. `empty`/`partial`/`success`/`loading`: **không dựng được** (0.3) — V3 "chưa đo `page.route`", **nay đã đo: không cứu được**. `forbidden` (viewer): **chưa đo** (cần cửa + đăng nhập viewer + `ExportPanel` có thể tự rơi `forbidden`). `collapsed`: đơn vị. Tất cả bảy: **đơn vị** (A11 đủ).
8. **Ca bàn phím (A12):** V3-SHARE-1; phạm vi `dialog` (`Modal.tsx:77`, `actions.dismiss`). Hộp thoại là lớp duy nhất mở (ExportPanel bên dưới không nhận Esc).
9. **Ca tự lưu (A7):** không áp dụng ở bề mặt e2e — "không nút lưu, không nút huỷ; `success` nói ra mốc tự lưu" đã ở đơn vị; e2e không có `success`.
10. **Ca hoàn tác (A8/A9):** **A8** — đổi quyền có toast + `onUndo` (`useShareDialog.ts:535-554`, đọc mã; đơn vị `:384`). **A9 — PHÁT HIỆN F2 (đọc mã, chưa thấy chạy vì hộp thoại không tới được dữ liệu):** `thu hồi` (`ShareDialogLink.tsx:85-89`) gọi `revokeMutation.mutate` **thẳng**, không hộp thoại xác nhận (`useShareDialog.ts:599`), và toast `đã thu hồi liên kết` (`:437`) **không có `onUndo`** (chỉ luồng đổi quyền có, `:535-554`). Thu hồi liên kết là việc người dùng không tự quay lại được (liên kết đã bị thu hồi) ⇒ theo A9 lẽ ra phải hỏi trước. Không sửa; ghi phát hiện. Ô `A9` = `chưa phủ`.
11. **Ca định dạng (A6/A15):** A6 — đơn vị (`expectVietnamese`); nhãn thường (`chia sẻ bản vẽ`, `thành viên`, `liên kết chia sẻ`, `quyền truy cập`, `hạn dùng`, `tạo liên kết`, `nhúng vào trang khác`, `xong`). A15 không áp dụng — không số thập phân (chiều rộng/cao khung nhúng là px nguyên).
12. **Mốc neo** (V3, có `file:dòng`): `getByRole('dialog')` tên qua `aria-labelledby` = "chia sẻ bản vẽ" (`ShareDialog.tsx:37`); ba `region`: `'thành viên'` `ShareDialogPeople.tsx:28,39`, `'liên kết chia sẻ'` `ShareDialogLink.tsx:117`, `'nhúng vào trang khác'` `ShareDialogEmbed.tsx:112`; ô: `getByLabel('quyền truy cập')` `:126`, `'hạn dùng'` `:136`, `'yêu cầu mật khẩu'` `:146`, `'mật khẩu'` `:154`, `'kèm góc nhìn hiện tại'` `:166` (cùng `ShareDialogLink.tsx`); nút: `getByRole('button',{name:'tạo liên kết'})` `:174-181`, `'sao chép liên kết'`/`'đã sao chép liên kết'` (aria-label, `:79` — **đo lớp 2: đọc lại đúng `aria-label={isCopied ? 'đã sao chép liên kết' : 'sao chép liên kết'}` ở `:79`**), `'thu hồi'` — **chữ nút chép được từ nguồn: `ShareDialogLink.tsx:87`** (V3 ghi "chưa chép"; đo lớp 2 điền), nhúng `'sao chép mã nhúng'` `ShareDialogEmbed.tsx:122`, nhóm `'kích thước khung nhúng'` `:137`, `'chiều rộng (px)'` `:147`, `'chiều cao (px)'` `:155`, `'thanh công cụ'` `:165`, `'tầng'` `:175`, `'chế độ tô màu'` `:185`; đóng: `getByRole('button',{name:'xong'})` `ShareDialogFooter.tsx:19`, `Đóng hộp thoại` (của `Modal`); lỗi: `role="alert"` `ShareDialogLink.tsx:51`. Nút mở `chia sẻ` — `ExportPanel.tsx:238`. **Cạm bẫy:** hộp thoại có `role="alert"` khi mở trên mock — đừng coi "có alert" là dấu hiệu thất bại của ca mở.
13. **KHÔNG kiểm được:** (a) **đường mở từ luồng sản phẩm** — `ExportPanel` luôn `empty` trên mock; (b) mọi nhánh dữ liệu (`empty`/`partial`/`success`/`loading`, tạo/đổi quyền/thu hồi/nhúng) — `page.route` không bắt được yêu cầu nào (0.3); (c) vai viewer — chưa đo; (d) sao chép ra clipboard thật — cần quyền `clipboard-read`, chưa đo; (e) A9 của "thu hồi" — không có gì để bấm. Ai chứng minh: đơn vị (bảy trạng thái, A8 đổi quyền, A12 Esc). Điều kiện mở: một đường nạp dữ liệu thật cho `ExportPanel` **và** `ShareLinkGateway` chạy trên `fetch` mà `page.route` chạm được.

---


<!-- ===== V4 ===== -->

## Nhóm V4

Lớp viết mục, 2026-09-30. Nguồn sự thật: `ghi-chu-V4.md` (gọi tắt **[V4]**), `HOP-DONG.md`,
`HOP-DONG-BO-SUNG.md`, `probe-35-routes.json`, `don-vi-theo-man.md`. Không viết test, không sửa repo.
Số dòng mang **[V4]** là số tôi lấy từ ghi chú lớp 1 mà **chưa mở lại**; **[✓]** là số tôi tự đọc lượt này.
Mục nào ghi "chưa đo" thì đó là nguyên văn từ [V4]; tôi không suy ra.

Số bài đơn vị của nhóm (`don-vi-theo-man.md`): `FloorUploadScreen` **42** · `InputQualityGate` **19** ·
`ProcessingScreen` **30** · `PipelineFailure` **55** = 146. Theo quy tắc mục 5 bổ sung: ba màn ≥ ~30 phủ dày ⇒ e2e chỉ đề xuất
thứ trình duyệt thật chứng minh; `InputQualityGate` (19) là màn mỏng nhất nhóm nên đi sâu hơn một chút (nhưng vẫn phải trả lời trường 4).

## 0. Hình dạng cả nhóm — quyết định bởi hai phép đo của [V4]

**(a) `PipelineFailure` KHÔNG tới được; `ProcessingScreen` chỉ ra `0/0`.** Đo [V4 mục 0.1, 0.2, 4.6]: sau khi tải đủ 4 tầng và bấm
"Bắt đầu xử lý" trình duyệt tới `/projects/project-1/pipeline` và thấy "Chưa có bước nào để theo dõi … Đã xong 0/0 tầng".
Hai rào độc lập (đều [V4], mã):
- `ProcessingScreenRoute` không truyền `floorUploads` (`ProcessingScreen.container.tsx:170-176` [✓ đã đọc: chỉ truyền `onNavigate`, `projectId`, `roles`]) ⇒ danh sách lượt xử lý luôn rỗng ⇒ luôn `empty`. Bản ghi chỉ sinh từ prop ấy.
- Nhánh `failed`: mock chỉ trả `running`/`completed` (`__mocks__/client.ts:1009-1030`), và cổng thật `createPipelineFailureGateway` khai `stepFailureDetail:false, retryStep:false, skipFloor:false` (`pipelineFailureGateway.ts:362-369`).
⇒ Theo phần riêng của nhóm: **mục `PipelineFailure` ghi điều kiện mở cổng ở trường 13, không viết ca luồng chính giả vờ**; mục `ProcessingScreen` là mục **mỏng** (một ca đích đến, không có ca có tiến trình).
Điều đó cũng có nghĩa: **không ca nào trong nhóm chứng minh "bản vẽ đi từ tải lên qua kiểm tra chất lượng tới xử lý"** — chuỗi này đứt dữ liệu ở mắt xích cuối (upload navigate bằng đường trần, `useFloorUploadScreen.ts:812` [V4]; đọc [✓] `options.onNavigate?.(ROUTES.project.pipeline(projectId))`, không mang `uploadId`).

**(b) Không có tệp mẫu nào trong repo — và không cần.** [V4 mục 2] tìm `e2e/`, `public/`, `src/**/__fixtures__`: 0 tệp bản vẽ `.png/.jpg/.pdf/.dwg` (chỉ `coverage/*.png` là đầu ra). `validateUploadFile` (`src/lib/upload/validate.ts:243-294` [V4]) chỉ xét **đuôi + kích thước**; riêng PDF bị đọc byte (`%PDF-` trong 1 KB đầu, rồi đếm `/Type /Page`, `validate.ts:170-180`).
**Tệp mẫu đến từ đâu (tiền đề của `projectUpload`, trường 3): sinh tại chỗ bằng `Buffer` trong spec** — PNG/JPG: `Buffer.from('x')`; PDF n trang: `'%PDF-1.4\n'` + n lần `"i 0 obj\n<< /Type /Page >>\nendobj\n"` + `'trailer\n%%EOF'`. Đã chạy thật [V4]: PDF 3 trang 121 B → màn hiện "3 trang", combobox "Chọn trang", câu "hãy chọn trang bản vẽ để bắt đầu tải". Đây là câu hỏi Q1 (A/B) chờ người chốt; cho tới đó, mọi mục dưới đây theo phương án A.

**Ba lưu ý dùng chung**
1. Mock mặc định: dự án `project-1` có 4 tầng (Tầng hầm · Tầng 1 · Tầng 2 · Tầng 3), **Tầng 1 đã có "Drawing L1-drawing-1"** [V4 1]. Vì thế `empty` thật của upload không dựng được từ mock mặc định.
2. Vai: không đăng nhập ⇒ `engineer` (HOP-DONG 1.2). Vai `viewer` = ca `forbidden`; dùng khuôn `e2e/viewer3d.spec.ts:185-205`, và **`?next=` dùng được cho mọi đường bắt đầu bằng đúng một `/`** (ghi chú V1). Không `goto` lần hai sau khi đăng nhập (phiên là biến mô-đun).
3. Mọi URL dựng từ `ROUTES`/`ROUTE_PATTERNS` (`ROUTES.project.upload/quality/pipeline`), không viết tay. Bảng mã: `project-1`; các tầng của màn chất lượng gồm `L-1` (Tầng hầm) — xem PHÁT HIỆN P6 về tuyên bố "màn duy nhất dùng `L-1`".

---

## 1. projectUpload — Tải lên bản vẽ · `ROUTE_PATTERNS.projectUpload`

**1. Kiểu:** có route (`router.tsx:317` [V4]).

**2. Đường tới:** `ROUTES.project.upload('project-1')` → `/projects/project-1/upload` (`paths.ts:105` [V4]).

**3. Tiền đề:**
- Vai: `engineer` mặc định; `viewer` cho ca forbidden.
- **Tệp mẫu: sinh tại chỗ bằng `Buffer`** (mục 0b, phương án A của Q1). Tên tệp quyết định ghép tầng — ghép dựa trên **tên** [V4]: `tang-2.png`, `tang-3.png`, `tang-ham.png` ghép đúng; `ban-ve.png` không ghép (vào khay chưa gán).
- Chờ ô chọn tệp: `getByTestId('floor-upload-file-input')` phải `attached`, **không phải `visible`** (lớp `sr-only`) — `setInputFiles` chạm được (đo [V4]).
- Không tour, không lớp chắn (`dialogs: []`). Không cờ.

**4. Giá trị nghiệp vụ:** đây là bước đầu tiên người dùng mới làm. Đỏ ở đây ⇒ (a) tệp thật được chọn nhưng không ghép đúng tầng hoặc bị nuốt; (b) nút "Bắt đầu xử lý" không đưa người dùng đi tiếp, hoặc đưa đi khi chưa đủ bản vẽ; (c) xoá nhầm một bản vẽ mà không lấy lại được. Nhưng lưu ý bằng chứng của (a): `setInputFiles` phủ **cùng hàm `acceptFiles`** (`useFloorUploadScreen.ts:617` [V4]) như kéo-thả, nên e2e không cần ca kéo-thả riêng.

**5. Đã kiểm ở tầng đơn vị** (42 bài, 2 tệp; theo [V4 1.5]): bảy trạng thái vẽ được; lỗi một tệp ở lại trong thẻ; view chỉ-đọc không vùng thả; a11y; tiếng Việt; A1; **không chép trần dung lượng**; cuộn tới tầng bị chặn đúng một lần; vùng thả đổi màu **không đổi kích thước** khi kéo; `onDragEnter/Leave`; tần suất cập nhật tiến trình ≤ N/giây; bộ đếm "3 / 4" chạy số. Hook: ghép tầng theo tên tệp; tệp không đoán được → khay chưa gán; từ chối giữ lỗi ở thẻ; tải hỏng → thử lại; huỷ; mất mạng → hàng đợi ngoại tuyến; gán lại; **xoá không hộp thoại + vé hoàn tác 8 s (A8)**; nút chính nêu tên tầng thiếu; đủ 4 tầng → điều hướng bằng `ROUTES`; vai viewer tắt mọi sửa; PDF nhiều trang; 422 `CAD_NOT_SUPPORTED`. ⇒ e2e KHÔNG lặp: ghép tên, xác thực đuôi/kích thước, tiến trình phần trăm, PDF page-picker, drag-drop.

**6. Ca luồng chính** (chỉ thứ trình duyệt thật chứng minh; các bước 1-3 đã chạy thật [V4 1.6]):
- **U-1 (tải → ghép → đi tiếp):** `goto` → `setInputFiles([tang-2.png, tang-3.png, tang-ham.png])` → sau ≤ 2,5 s mỗi tầng hiện "`<tên> · 1 B`", "đã gắn kèm", "Ghép tự động từ tên tệp — kiểm tra lại"; chân trang `role="status"` **"4 / 4 tầng đã có bản vẽ"** (từ "1 / 4") → bấm `Bắt đầu xử lý` → URL `ROUTES.project.pipeline('project-1')`. Hai điều trình duyệt thật chứng minh mà đơn vị không: `File` thật đi qua `validateUploadFile`, và điều hướng router thật.
- **U-2 (chặn):** chưa tải gì → bấm `Bắt đầu xử lý` → `role="alert"` **"Không thể bắt đầu xử lý"** + ba dòng "Tầng hầm chưa có bản vẽ." / "Tầng 2 chưa có bản vẽ." / "Tầng 3 chưa có bản vẽ." (Tầng 1 không bị nêu); **URL không đổi**; nút KHÔNG khoá (đúng thiết kế). Đã đo [V4].
- **U-3 (A8):** tải `ban-ve.png` (vào khay chưa gán) → bấm `Xoá bản vẽ ban-ve.png` → toast `role="status"` **"Đã xoá bản vẽ ban-ve.png"** + nút **"Hoàn tác"**, không hộp thoại (đã đo, `useFloorUploadScreen.ts:688-707` [V4]). **Bấm "Hoàn tác" và `Ctrl+Z`: chưa đo** ⇒ hai bước ấy chỉ vào bộ sau khi đo một lần.
- **U-4 (forbidden):** đăng nhập `viewer@example.com` với `?next=` tới `/upload` → dòng "Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.", không vùng thả, **0** `input[type=file]` (đã đo [V4]). Nút "Bắt đầu xử lý" vẫn vẽ ra ở vai viewer; bấm nó làm gì: **chưa đo** (đọc mã: `submit` thoát sớm khi `!canEdit`, `useFloorUploadScreen.ts:785` [V4]).
- **Không đề xuất:** ca kéo-thả (mục 13), ca `.dwg`, ca tiến trình nhiều mảnh.

**7. Ca bảy trạng thái:**
- `success`: e2e (U-1, "4 / 4").
- `forbidden`: e2e (U-4, đã đo).
- `empty`: **thuộc tầng đơn vị** — không dựng được từ mock mặc định (Tầng 1 đã có bản vẽ).
- `error`: dựng được bằng `page.route` chặn endpoint đọc dự án (lấy từ `src/api/endpoints.ts`, không viết tay) → `InlineAlert` "Không tải được danh sách tầng" (`FloorUploadScreen.tsx:67` [V4]). **Chưa đo trong trình duyệt** — **mock đi trong trình duyệt nên `page.route` có bắt được không: chưa đo** (ghi chú V3 cùng đợt đã thấy mock trả lời không qua mạng). Không viết ca cho tới khi đo.
- `loading`, `partial`, `collapsed`: tầng đơn vị.

**8. Ca bàn phím (A12):** Tab đi hết luồng: **chưa đo**. Esc: menu thẻ bắt `Escape` cục bộ bằng `onKeyDown` + `stopPropagation` (`FloorUploadCard.tsx:88-95` [V4]), **không** qua `shortcutRegistry` (grep `useShortcut` trong `FloorUploadScreen/`: **NOT FOUND**, 0 kết quả [V4]). Đo [V4]: mở menu "Tùy chọn của tầng Tầng 1" → Esc → vẫn ở `/upload`; **menu có đóng hay không: [V4] không ghi** ⇒ tôi ghi "chưa đo". Menu là `<div>`+`<button>` trần, 0 phần tử `role=menu/listbox/dialog` (đo).

**9. Ca tự lưu (A7):** **không áp dụng** — màn không sửa dữ liệu dự án; 0 nút lưu (probe `saveButtons: []`), phủ bằng ca quét-toàn-bộ (HOP-DONG mục 2). Vùng `role="status"` "N / 4 tầng đã có bản vẽ" đổi chữ khi tải xong (đo 1→4) — nằm trong U-1.

**10. Ca hoàn tác (A8/A9):** A8: U-3 (đã đo phần toast; hoàn tác chưa đo). A9: **không áp dụng** — xoá bản vẽ hoàn tác được, không có việc nào cần hộp thoại.

**11. Ca định dạng (A6/A15):** số dùng dấu phẩy: "cao độ -3,00 m", "100,0 MB" (đo [V4 1.11]) ✔. Một ca quét chữ. Ghi nhận, **chưa kết luận**: "cao độ 0 mm" (Tầng 1) cạnh "-3,00 m" (Tầng hầm) — đơn vị m/mm lẫn trong cùng danh sách. Nhãn "Tùy chọn của tầng …", "Kéo thả bản vẽ vào đây, hoặc chọn tệp" có chữ hoa đầu câu ⇒ chờ Q2 của nhóm QC (chữ hoa đầu câu có phải vi phạm A6) — chưa phải câu của nhóm này.

**12. Mốc neo** (nguyên văn, theo [V4 1.12]; file:dòng [V4] chưa kiểm lại):
- Ô chọn tệp: `getByTestId('floor-upload-file-input')` — `FloorUploadDropZone.tsx:33,68-90`. **Vì sao testid:** `getByLabel('Chọn tệp')` khớp cả `<input>` lẫn `<button>` cùng nhãn (probe: `buttons:["Chọn tệp…"]`, `labels:["Chọn tệp"]`) ⇒ mơ hồ; input là `sr-only` nên không `getByRole` được. Đây là ngoại lệ testid có lý do.
- Nút mở hộp chọn tệp `getByRole('button',{name:'Chọn tệp'})` — `FloorUploadDropZone.tsx:91-98`; **không dùng cùng `setInputFiles`** (nút gọi `input.click()` mở hộp thoại của hệ điều hành).
- Vùng thả `getByTestId('floor-upload-dropzone')` — `FloorUploadDropZone.tsx:30` (`<div>` không role ⇒ testid là cách duy nhất); tiêu đề "Kéo thả bản vẽ vào đây, hoặc chọn tệp" — `useFloorUploadScreen.ts:97`
- Dòng định dạng "Định dạng hỗ trợ: .png, .jpg, .pdf. Kích thước tối đa: 100,0 MB." — `useFloorUploadScreen.ts:1019-1021`
- Mẩu vụn `getByRole('navigation',{name:'Tải lên bản vẽ'})` — `FloorUploadScreen.tsx:64,189`
- Bộ đếm `getByRole('status')` chứa "1 / 4 tầng đã có bản vẽ" — `useFloorUploadScreen.ts:953-955`; `FloorUploadFooter.tsx:108` (còn `data-testid="floor-upload-counter-number"`)
- Nút chính `getByRole('button',{name:'Bắt đầu xử lý'})` — `useFloorUploadScreen.ts:111`
- Khối chặn `getByRole('alert')` "Không thể bắt đầu xử lý" + "`<Tầng>` chưa có bản vẽ." — `FloorUploadFooter.tsx:77`; `useFloorUploadScreen.ts:730`
- Menu thẻ `getByRole('button',{name:'Tùy chọn của tầng Tầng 1'})` — `FloorUploadCard.tsx:42,98`
- Gán lại combobox "Gán cho tầng khác" — `FloorUploadCard.tsx:39`; `FloorUploadTray.tsx:20`
- Chọn trang PDF combobox "Chọn trang"; câu "hãy chọn trang bản vẽ để bắt đầu tải" (dòng: **[V4] không ghi**, nói "nhãn tại thẻ")
- Xoá `getByRole('button',{name:'Xoá bản vẽ ban-ve.png'})` (mẫu `Xoá bản vẽ ${tên}`) — `useFloorUploadScreen.ts:935`
- Toast "Đã xoá bản vẽ ban-ve.png" + nút "Hoàn tác" — `useFloorUploadScreen.ts:703`
- Cảnh báo tệp "Không đọc được nội dung tệp .pdf." + nút "Đóng" (đo, dòng không ghi)

**13. KHÔNG kiểm được:**
- Dữ liệu tải lên đi tiếp sang pipeline — **đo: `0/0`**. Tải xong chỉ ở state cục bộ, tải lại trang là mất (đo [V4]); `drawings.*` của mock không ghi ngược vào `project.floors`. Ai chứng minh: không ai (cần sửa mã/mock); phần điều hướng thuộc đơn vị.
- Kéo-thả từ hệ điều hành: Playwright không mô phỏng được. Đường `dispatchEvent('drop', {dataTransfer})` **chưa đo**; khuyến nghị bỏ vì `acceptFiles` được `setInputFiles` phủ và đơn vị phủ kéo-thả.
- Tiến độ theo thời gian thật: tệp 1 B xong gần như tức thì; nhiều mảnh **chưa đo**; đơn vị đã có `PROGRESS_EMITS_PER_SECOND`.
- `.dwg`: validate cho qua; `input accept=".png,.jpg,.pdf"` nhưng `setInputFiles` **bỏ qua `accept`** (đo: `a.dwg` vào khay không lỗi). Server thật trả 422 `CAD_NOT_SUPPORTED` — mock không ⇒ đơn vị phủ.
- Ca `empty`/`error` (xem trường 7).
- Số bài đơn vị phủ phần còn lại: 42.

---

## 2. projectQuality — Kiểm tra chất lượng đầu vào · `ROUTE_PATTERNS.projectQuality`

**1. Kiểu:** có route (`router.tsx:318` [V4]). Mã nguồn thực tế: `src/screens/upload/InputQualityGate/` [✓].

**2. Đường tới:** `ROUTES.project.quality` (`paths.ts:98` [V4]) → `/projects/project-1/quality`. Nơi vào tự nhiên: (chưa có nút từ màn upload — **[V4] không ghi**; bước tiếp theo của upload là `/pipeline`, không phải `/quality`).

**3. Tiền đề:** vai `engineer` mặc định. Mock: `client.quality.assess` → `makeMeasuredFloors()` (`client.ts:177-224` [V4]); tầng đầu (mồi) là Tầng hầm (`L-1`, `isMeasured:false`). **Mặc định vào trạng thái `partial`** ("Mới có 2/4 tầng đo xong…" — Tầng hầm và Tầng 3 "chưa đo"). Không tour, không lớp chắn.

**4. Giá trị nghiệp vụ:** người dùng xem chất lượng ảnh trước khi tốn công xử lý; nắn ảnh nghiêng hoặc chọn bốn góc khung bản vẽ. Đỏ ở đây ⇒ (a) Esc không thoát được chế độ chọn bốn góc — người dùng kẹt trong một chế độ; (b) nắn xong không có cách lấy lại (A8); (c) "Tiếp tục xử lý" đi tiếp mà không nói cảnh báo. **Đây là màn mỏng nhất nhóm (19 bài đơn vị)** nên là chỗ e2e đáng đi sâu hơn, vẫn giữ mỗi ca gắn với một câu (c) bên trên.

**5. Đã kiểm ở tầng đơn vị** (19 bài; [V4 3.5]): bảy trạng thái; "mỗi phát hiện có câu giải thích"; không quyền → hai nút biến mất; **A5** (máy chấm không mang màu "đã xác minh"); kịch bản bám cổng mock (4 tầng, 3 phát hiện khớp số); a11y; tiếng Việt; A1; **cổng xác nhận mức Kém (`InputQualityGate.test.tsx:410`)**; liên kết hai chiều báo cáo↔ảnh (hover); **ArrowLeft/Right đổi tầng**; **toast hoàn tác sau nắn thẳng (`:610`)**. Không có `useInputQualityGate.test.ts` — hook chỉ được phủ gián tiếp qua view test. ⇒ e2e KHÔNG lặp: bảy trạng thái, A5, đổi tầng bằng mũi tên. e2e thêm: **Esc thật trong chế độ bốn góc** ([V4]: chưa test đơn vị có Esc thật), điều hướng thật, toast hoàn tác trong router thật.

**6. Ca luồng chính** (bước 1-4 đã chạy thật [V4 3.6]):
- **Q-1 (nắn thẳng + A8):** `goto` → `getByRole('row',{name:/Tầng 1/}).click()` → ảnh đổi sang Tầng 1; hiện ba nút vùng ("Vùng ảnh có vấn đề: độ phân giải thấp" / "…ảnh bị nghiêng" / "…không tìm thấy khung bản vẽ"), "Tự động nắn", "Chọn góc thủ công", hộp kiểm xác nhận (chưa tích); `role="status"` "Đang xem bản vẽ tầng Tầng 1" → bấm `Tự động nắn` → `role="status"` **"Đã nắn thẳng bản vẽ"** + nút **"Hoàn tác"**; "3 phát hiện còn lại" → "**2** phát hiện còn lại"; hàng Tầng 1 "2 phát hiện cần chú ý"; nút vùng "ảnh bị nghiêng" biến mất. **Bấm "Hoàn tác": chưa đo.**
- **Q-2 (A12, đã đo):** bấm `Chọn góc thủ công` → hiện 4 nút "Góc trên bên trái" … "Góc dưới bên trái" + "Gửi bốn góc đã chọn" → `Escape` → 4 nút góc biến mất, nút `Chọn góc thủ công` trở lại, **URL không đổi**. Phạm vi: `useShortcut({combo:'Escape',scope:'canvas'},{enabled:isPickingCorners})` (`useInputQualityGate.ts:970-979` [V4]). Vì chỉ đăng ký khi chế độ mở, **Esc thứ hai (chế độ đã đóng) thuộc `closeTopLayer` toàn cục — chưa đo**.
- **Q-3 (điều hướng):** `Tiếp tục xử lý` → `ROUTES.project.pipeline('project-1')` (đã đo); `Tải bản vẽ khác` → `/upload`: **chưa đo**. Ca "Tiếp tục xử lý khi chưa tích ô xác nhận" — xem Q2 và PHÁT HIỆN P1: **không** viết khẳng định về nó cho tới khi người chốt.
- **Q-4 (forbidden):** đăng nhập `viewer@example.com` → **ẩn hẳn** "Tải bản vẽ khác" và "Tiếp tục xử lý" (`areActionsHidden`, `InputQualityGateFooter.tsx:19-21` [V4]; đọc [✓] chú thích: nút "mất khỏi cây DOM, không phải `disabled`"), còn 4 nút zoom, báo cáo vẫn đọc được (đo).
- Ca gửi bốn góc → toast "Đã gửi bốn góc khung bản vẽ" (`COPY.cornersToast`): **chưa đo**.

**7. Ca bảy trạng thái** (điều kiện `useInputQualityGate.ts:745-770` [V4]: loading → error → forbidden → collapsed → empty → partial → ready):
- `partial`: **e2e, đây là trạng thái mặc định** (đo: "Mới có 2/4 tầng đo xong…").
- `forbidden`: e2e (Q-4, đã đo).
- `success` (`ready`) và `empty`: **không dựng được từ mock mặc định** — thuộc tầng đơn vị.
- `error`: `page.route` chặn `quality.assess` — **chưa đo** (mock có đi qua mạng không: chưa đo).
- `loading`, `collapsed`: tầng đơn vị.

**8. Ca bàn phím (A12):** Q-2 (đã đo). `ArrowLeft`/`ArrowRight` đổi tầng (`scope:'canvas'`, `useInputQualityGate.ts:951-964` [V4]): đơn vị đã phủ; trong trình duyệt **chưa đo**. Enter trên hàng chọn tầng (`InputQualityGateReportPanel.tsx:236-240`, `tabIndex=0`): đọc mã, **chưa đo**. Tab đi hết luồng: **chưa đo**.

**9. Ca tự lưu (A7):** **không áp dụng** — màn không sửa dữ liệu dự án (probe `saveButtons: []`).

**10. Ca hoàn tác (A8/A9):** A8: Q-1 (toast đã đo; hoàn tác chưa đo). A9: **không áp dụng** — "Tiếp tục xử lý" không phải hành động mất mát; cổng xác nhận mức Kém là **ô kiểm inline**, không hộp thoại (đặc tả cấm tuyệt đối — `InputQualityGateFooter.tsx:4-9` [✓]).

**11. Ca định dạng (A6/A15):** A15: số "100%"; probe `dotDecimals: []` ✔ (đo lúc mở trang). A6: nhãn thường kiểu câu (đo). Một ca quét chữ dùng chung.

**12. Mốc neo** (theo [V4 3.12]; dòng [V4] chưa kiểm lại):
- Mẩu vụn `getByRole('navigation',{name:'Kiểm tra chất lượng đầu vào'})` — `InputQualityGate.tsx:54,133`
- Khung ảnh `getByRole('region',{name:'Khung xem bản vẽ'})` — `InputQualityGateImagePanel.tsx:61,116`; ảnh `img alt` = "Bản vẽ tầng Tầng hầm, đang xem để kiểm tra chất lượng đầu vào" (tầng đầu là Tầng hầm; chưa đo lại)
- Báo cáo `getByRole('region',{name:'Báo cáo chất lượng'})` — `InputQualityGateReportPanel.tsx:280`
- Hàng tầng `getByRole('row',{name:/Tầng 1/})` (hàng bảng `tabIndex=0`, `onClick`, Enter) — `InputQualityGateReportPanel.tsx:230-241`
- Zoom `getByRole('group',{name:'Điều khiển zoom'})`; `'Thu nhỏ'`, `'Phóng to'`, `'Vừa khung nhìn'`, `'Zoom hiện tại 100%. Bấm để về 100%'` — `src/components/canvas/ZoomCluster.tsx:74,81,97,108,122`
- Nắn `getByRole('button',{name:'Tự động nắn'})` (chỉ hiện với phát hiện "ảnh bị nghiêng") — `useInputQualityGate.ts` `COPY.straightenAction` (dòng ~150, **[V4] ghi "~"**)
- Chọn góc `'Chọn góc thủ công'`; sau đó `'Gửi bốn góc đã chọn'`; nhóm `role="group"` "Bốn góc bản vẽ, kéo để chỉnh khung"; nút "Góc trên bên trái/phải", "Góc dưới bên phải/trái" — `useInputQualityGate.ts` `COPY`; `InputQualityGateImageOverlays.tsx:33-35`
- Vùng vấn đề nút "Vùng ảnh có vấn đề: …" trong `role="group"` "Vùng có vấn đề trên bản vẽ" — `InputQualityGateImageOverlays.tsx:32,146-156`
- Ô xác nhận `getByRole('checkbox',{name:'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này'})` — `useInputQualityGate.ts` `COPY.acknowledgement`
- Lời chặn "Đánh dấu ô xác nhận bên trên rồi thử lại." (`#input-quality-gate-continue-note`) / "Vẫn còn phát hiện cần xử lý trước khi qua bước tiếp theo." — `InputQualityGateFooter.tsx:26-28`
- Chân trang `<footer aria-label="Hành động tiếp theo">` (`getByRole('contentinfo')`); nút `'Tải bản vẽ khác'`, `'Tiếp tục xử lý'` — `InputQualityGateFooter.tsx:38`; `useInputQualityGate.ts:141-142`
- Toast `role="status"` "Đã nắn thẳng bản vẽ" + `'Hoàn tác'`; trạng thái `role="status"`: "Mới có 2/4 tầng đo xong. …", "N phát hiện còn lại", "Đang xem bản vẽ tầng Tầng 1".

**13. KHÔNG kiểm được:**
- Kéo góc bằng chuột trên ảnh: chưa đo; đơn vị phủ clamp `clampRatio`. Ai chứng minh: đơn vị.
- `success`/`empty` từ mock mặc định (mục 7). Ai chứng minh: đơn vị (19 bài).
- **Ảnh nguồn `QUALITY_IMAGE_ROOT/*.png` có tải được thật không: chưa đo** (`img alt` có; chưa kiểm `naturalWidth`). Đáng đo trước khi viết ca — nếu ảnh gãy thì đó là phát hiện, và là điều **chỉ e2e thấy**.
- Ca `error` (chưa đo cách dựng).

---

## 3. ProcessingScreen — Xử lý · `ROUTE_PATTERNS.projectPipeline`

**Mục mỏng theo phần (a) mục 0.** Không có ca có tiến trình.

**1. Kiểu:** có route (`router.tsx:319` [V4]).

**2. Đường tới:** `ROUTES.project.pipeline('project-1')` → `/projects/project-1/pipeline` (`paths.ts:96` [V4]). Nơi vào tự nhiên: "Bắt đầu xử lý" (upload) hoặc "Tiếp tục xử lý" (quality).

**3. Tiền đề:** vai `engineer` mặc định. **Danh sách lượt xử lý đến từ prop `floorUploads` mà route không truyền** (`ProcessingScreen.container.tsx:170-176` [✓]) ⇒ luôn rỗng. Không tour, không lớp chắn (thiết kế cấm `role=dialog`, test `:336` [V4]).

**4. Giá trị nghiệp vụ:** đích đến của cả chuỗi nhận bản vẽ. Đỏ ở đây ⇒ người dùng bấm "Bắt đầu xử lý"/"Tiếp tục xử lý" và rơi vào màn nổ hoặc trắng. **Nhưng** "không trắng, không nổ" đã được ca quét chặng 1 chứng minh cho 35/35 màn (HOP-DONG/kế hoạch). Phần còn lại của giá trị màn này (theo dõi tiến độ) **không có dữ liệu để kiểm**. Vì vậy mục này chỉ giữ **một ca đích đến** gắn vào chuỗi liên màn của upload/quality; không thêm ca độc lập.

**5. Đã kiểm ở tầng đơn vị** (30 bài, 2 tệp; [V4 4.5]): bảy trạng thái; "trạng thái một phần nói rõ xử lý VẪN tiếp tục"; a11y; tiếng Việt; A1; **sáu tên bước** khớp `vi.json` khoá `pipeline`; **huỷ inline, không dialog**, quyền huỷ; giảm chuyển động; container R-73; **gắn `PipelineFailureContainer` thay khi một bước hỏng (`:455-483`)**; **nút chạy nền → thông báo hiện (`:541`)**. Hook: SSE chết → quay vòng, tiến độ không lùi; tab ẩn → ngừng nghe; một tầng lỗi không dừng tầng khác; rời màn quay lại giữ tiến độ; chạy nền rồi rời màn; lượt hỏng khi chạy nền; không lượt nào → `empty`, chạy nền không hứa gì (`:693`, `:716`). ⇒ **Mọi thứ có thời gian (SSE, tiến độ, nền) đã phủ bằng đồng hồ giả**; e2e không thêm gì cho tới khi mở được cổng dữ liệu.

**6. Ca luồng chính:**
- **P-1 (đích đến, thuộc chuỗi liên màn):** sau U-1 (upload) hoặc Q-3 (quality), URL = `ROUTES.project.pipeline('project-1')` và màn hiện `getByRole('navigation',{name:'Xử lý'})` + nút `Để chạy nền và thông báo cho tôi`. **Không khẳng định "Chưa có bước nào để theo dõi" / "Đã xong 0/0 tầng"**: đó là hiện trạng do đứt dữ liệu (P2), khẳng định nó sẽ đỏ đúng lúc sản phẩm được sửa và ghim khiếm khuyết thành hành vi mong muốn. Xem Q3.
- **P-2 (forbidden, tuỳ chọn):** đăng nhập viewer → thân là hai cột "Xem trước | Nhật ký | Chưa có tầng nào để xem trước | Panel sẽ hiện bản vẽ ngay khi có tầng bắt đầu xử lý."; **không** phải câu "Chưa có bước nào để theo dõi" (đo [V4 mục 4]: `forbidden` đứng TRƯỚC `empty`, `useProcessingScreen.ts:726-732`); nút chạy nền vẫn hiện. Ca này bảo vệ thứ tự ưu tiên trạng thái nhưng đơn vị cũng phủ bảy trạng thái ⇒ chỉ giữ nếu người duyệt muốn có ca `forbidden` ở trình duyệt.

**7. Ca bảy trạng thái:** `empty` (mặc định, đo) và `forbidden` (viewer, đo) là hai trạng thái với tới được. `error` cần `floorUploads` không rỗng ⇒ **không dựng được**. Còn lại thuộc tầng đơn vị.

**8. Ca bàn phím (A12):** không phím tắt đăng ký (grep `useShortcut` trong `ProcessingScreen/`: **NOT FOUND**, 0 [V4]). Nhóm xác nhận huỷ inline bắt `Escape` cục bộ (`ProcessingScreen.tsx:100-106` [V4]) — **không dựng được ở `empty`** (nút "Huỷ xử lý" KHÔNG hiện: đo chỉ có 1 nút). Esc ở `empty` rơi xuống `closeTopLayer`: **chưa đo**. Tab: **chưa đo**.

**9. Ca tự lưu (A7):** **không áp dụng** — màn theo dõi, không sửa dữ liệu dự án.

**10. Ca hoàn tác (A8/A9):** A8: **không áp dụng** (không sửa dữ liệu). A9: huỷ xử lý = xác nhận **inline** ("Huỷ lượt xử lý này?" → "Xác nhận huỷ" / "Giữ nguyên"), không hộp thoại (cấm bởi thiết kế); **không dựng được ở e2e**; đơn vị phủ. Xem P3 (có mâu thuẫn chữ A9 hay không).

**11. Ca định dạng (A6/A15):** nhãn thường (đo trên `empty`). A15: không có số thập phân trong `empty`; **định dạng phần trăm/thời gian của nhánh có tiến độ: chưa đo** vì không dựng được ⇒ `chưa phủ`.

**12. Mốc neo** (theo [V4 4.12]):
- Mẩu vụn `getByRole('navigation',{name:'Xử lý'})` — `ProcessingScreen.tsx:60,217`
- Chạy nền `getByRole('button',{name:'Để chạy nền và thông báo cho tôi'})` — luôn có — `ProcessingScreen.tsx:62`
- Trạng thái rỗng "Chưa có bước nào để theo dõi"; "Khi bản vẽ được đưa vào hàng đợi, các bước xử lý sẽ hiện ở đây." — `ProcessingScreen.tsx:78-79`
- Tóm tắt "Đã xong 0/0 tầng" — `overallSummaryLine` (`useProcessingScreen.ts`, dòng **[V4] không ghi**)
- Huỷ "Huỷ xử lý" → nhóm "Xác nhận huỷ xử lý" ("Huỷ lượt xử lý này?", "Xác nhận huỷ", "Giữ nguyên") — `ProcessingScreen.tsx:63-67`
- Tab: tablist "Xem trước hoặc nhật ký" — "Xem trước" · "Nhật ký" — `ProcessingScreen.tsx:72-74`
- Danh sách tầng `getByRole('list',{name:'Số đối tượng đã nhận theo tầng'})` — `ProcessingScreen.tsx:76`
- Lỗi đọc "Thử lại" · "Liên hệ hỗ trợ" — `ProcessingScreen.tsx:69-70`
- Hàng chờ "Đang chờ hàng đợi — vị trí N" — `useProcessingScreen.ts:180`
- Sáu tên bước `getPipelineStages()` từ `vi.json` khoá `pipeline` — `useProcessingScreen.ts:197-198`

**13. KHÔNG kiểm được:** mọi nhánh có tiến trình (`partial`/`success`/`error`, sáu bước, SSE, huỷ, nhật ký, chạy nền, hàng chờ, xem trước). Lý do đã đo: `0/0` (mục 0a). **Điều kiện mở cổng:** route truyền `floorUploads` thật (hoặc một endpoint liệt kê lượt xử lý) **và** mock trả bước `failed` cho nhánh hỏng — cả hai là sửa mã sản phẩm, ngoài việc của lượt này. Ai chứng minh phần còn lại: đơn vị (30 bài, đồng hồ giả).

---

## 4. PipelineFailure — S-11 "Xử lý thất bại" · màn chủ `ProcessingScreen`

**Không viết ca luồng chính.** Mục này tồn tại để ghi điều kiện mở cổng và số bài đơn vị chịu trách nhiệm.

**1. Kiểu:** **không route** — không có `PipelineFailureRoute`, không nhập `react-router-dom` (`PipelineFailure.container.tsx:16-27` [V4]). Khác lớp phủ: `WiredProcessingScreen` trả `<PipelineFailureContainer>` **thay** `<ProcessingScreen>` (`ProcessingScreen.container.tsx:128-142` [V4]).

**2. Đường tới:** `ProcessingScreenRoute` → `useProcessingScreen` tìm bản ghi ĐẦU TIÊN có `stage.status === 'failed'` (`useProcessingScreen.ts:1088-1094` [V4]) → `failedPipelineStep` khác `undefined` → container thay. **Chưa có URL hoặc thao tác nào dẫn tới trong ứng dụng đang chạy** (mục 0a). Ánh xạ `Progress.status==='failed'` ở `processingGateway.ts:433,557` [V4].

**3. Tiền đề:** **không thể thoả trong ứng dụng đang chạy** (mục 0a). Không có: bản ghi `failed` (mock chỉ `running`/`completed`), route truyền `floorUploads`, cổng thật khai `retryStep:false`.

**4. Giá trị nghiệp vụ:** khi xử lý hỏng người dùng cần biết vì sao và làm gì tiếp mà không mất kết quả đã có. Đỏ ở đây ⇒ người dùng thấy màn lỗi nhưng không thử lại/bỏ qua được, hoặc mất tiến độ. **Nhưng không có cách nào dựng bề mặt này để mà đỏ** — trường 4 có câu trả lời về giá trị, không có câu trả lời về khả năng kiểm; mục vì thế chỉ ghi điều kiện mở cổng (trường 13), theo chỉ định của điều phối viên.

**5. Đã kiểm ở tầng đơn vị** (55 bài, 2 tệp; [V4 5.5] — **rất dày, e2e nhường hoàn toàn**): bảy trạng thái; thu gọn; forbidden không khoá mờ; a11y ở **cả bảy**; tiếng Việt; A1; **chạy lại đúng một bước** (bước 2 chạy 1 lần, bước 1 chạy 0); dải đổi tại chỗ sang toast; **không xoá tiến độ đã có**; ba câu lỗi đúng thứ tự, mã chép được; giọng điệu không lấy người dùng làm chủ ngữ; **hành động mất mát nói cái mất trước khi bấm (A9)**; "Bỏ qua tầng đó" gọi cổng đúng một lần; không dialog / không nền đỏ (`PipelineFailure.test.tsx:525-537`); **Esc: không có lớp nào để đóng, và khối gấp mở/đóng bằng một nút thật (`:560`)**; container R-73 và ba lối ra.

**6. Ca luồng chính:** **không có** (không dựng được).

**7. Ca bảy trạng thái** (`usePipelineFailure.ts:596-613` [V4]: loading → error → forbidden → success → empty → collapsed → partial): **tất cả thuộc tầng đơn vị**. e2e không kiểm được ca nào.

**8. Ca bàn phím (A12):** không đăng ký phím (grep `Escape|onKeyDown|useShortcut` trong `PipelineFailure/` ngoài test/stories: **NOT FOUND** [V4]). Nút gấp "Mở lại"/"Thu gọn" có `aria-expanded`/`aria-controls` (`PipelineFailure.tsx:72-79` [V4]). Esc rơi xuống `closeTopLayer` toàn cục: **chưa đo** (không dựng được).

**9. Ca tự lưu (A7):** **không áp dụng.**

**10. Ca hoàn tác (A8/A9):** "Bỏ qua tầng đó" là hành động mất mát; cảnh báo nằm cạnh nút (`pipelineFailureText.ts:69` [V4]), **không hộp thoại** (test `:525`) — xem P3. Đơn vị phủ A9-dạng-inline. A8 (chạy lại/bỏ qua có hoàn tác được không): [V4] không nói và đơn vị (theo danh sách [V4]) không nêu ⇒ `chưa phủ`.

**11. Ca định dạng (A6/A15):** đơn vị phủ tiếng Việt và giọng điệu. A15: **chưa đo**.

**12. Mốc neo** (chỉ từ mã — **chưa vẽ ra thật**, theo [V4 5.12]; **không có `data-testid` nào** — grep NOT FOUND):
- Mẩu vụn nav "Xử lý" — `PipelineFailure.tsx:52-53,66`
- Nút gấp `aria-controls="pipeline-failure-body"`, chữ "Mở lại" / (nhãn thu gọn do hook chọn — **chữ chưa xác định**) — `PipelineFailure.tsx:56,68-77`; `pipelineFailureText.ts:52`
- List "Tiến độ theo tầng" — `PipelineFailureProgress.tsx:39`
- h2 + list "Kết quả đã có" — `PipelineFailureProgress.tsx:40,78,87`
- group "Hướng đi tiếp" — `PipelineFailureAlert.tsx:54,70`
- "Thử lại bước này" (`aria-label` = `${nhãn} — ${tên bước}`) — `pipelineFailureText.ts:44`; `PipelineFailureAlert.tsx:84`
- "Tải lên bản vẽ rõ hơn" · "Bỏ qua tầng đó" · "Xem kết quả" — `pipelineFailureText.ts:54,59,60`
- Nút "Chi tiết kỹ thuật"; list "Nhật ký kỹ thuật" (`tabIndex=0`) — `pipelineFailureText.ts:50`; `PipelineFailureDetails.tsx:50,92`
- "Sao chép" (thấy được); `aria-label` "Sao chép mã lỗi" / "Sao chép nhật ký kỹ thuật" / "Sao chép toàn bộ nhật ký" — `pipelineFailureText.ts:45-49`
- "Báo lỗi cho hỗ trợ" — `pipelineFailureText.ts:53`
- Hai `role="status"` (dải & toast) — `PipelineFailureBand.tsx:86,99`

**13. KHÔNG kiểm được: TẤT CẢ.**
- **Điều kiện mở cổng (một trong hai):**
  1. Route `ProcessingScreenRoute` truyền `floorUploads` thật (hoặc có endpoint liệt kê lượt xử lý) **và** mock trả bước `status:'failed'`; cổng thật bật `retryStep`/`stepFailureDetail`/`skipFloor` (`pipelineFailureGateway.ts:362-369`). Sửa mã sản phẩm — ngoài việc của lượt này.
  2. Mượn `/design-system/states` (route dev): **CẦN TỪ việc StateGallery** — story `pipeline/PipelineFailure` (`stateGalleryManifest.ts:269-283` [V4], "chưa xác minh") có thật sự vẽ ra, Esc trong đó đóng gì. Nếu có thì là cửa duy nhất nhưng là bản dev, ngoài sản phẩm; nó chứng minh "story dựng được", không chứng minh "app đưa người dùng tới màn lỗi".
- **Ai chứng minh phần còn lại:** tầng đơn vị — `PipelineFailure.test.tsx` 693 dòng + `usePipelineFailure.test.ts` 732 dòng (55 bài).
- Lý do đã đo: `0/0` ở màn chủ (mục 0a).

---


<!-- ===== V5 ===== -->

## Nhóm V5

Viết 2026-09-30. Nguồn: `HOP-DONG.md`, `HOP-DONG-BO-SUNG.md`, `ghi-chu-V5.md` (nguồn sự thật), `don-vi-theo-man.md` (PipelineGraph 21 · ScaleCalibration 31 · CadBranchConfirm 67 bài), `questions.md` (Q1, Q3). **Không có dòng mã test nào ở đây.** Không sửa repo.

Quy ước: mọi nhãn/`file:dòng` dưới đây chép từ `ghi-chu-V5.md`; chỗ tôi tự đọc mã thì ghi "đọc mã (lớp 2)". Chỗ ghi chú ghi "chưa đo" thì tôi cũng ghi "chưa đo".

## Lớp 2 đo/đọc thêm (hai chỗ)

| # | Nghi vấn | Kết quả |
|---|---|---|
| 1 | Vì sao `Áp dụng tỷ lệ` không cho `success` ở route thật (ghi chú 2.10 ghi "chưa xác định nguyên nhân") | **Đọc mã (lớp 2), chưa đo bằng tiêm store:** `onApply` (`useScaleCalibration.ts:950`) lấy `useStore.getState().spatial?.byId[floorId]`; nếu không có thực thể tầng thì **`return` im lặng**, không `commit`, không `setHasApplied(true)` (`:976`). Kho `spatial` rỗng khi vào thẳng route (Q1) ⇒ nút **không làm gì**. Khớp quan sát ghi chú: tiêu đề vẫn `Chưa đủ dữ liệu để chốt tỷ lệ`, không hoàn tác. "Tỷ lệ hiện tại 4,991" đổi **trước** khi bấm vì lấy từ tỷ lệ đề xuất, không từ kho |
| 2 | Hai tiêu đề trùng chữ ở `projectCadConfirm` (ghi chú 3.3 phụ 2) ảnh hưởng mốc neo | `h1` và `h2` cùng chữ `Phát hiện tệp CAD` ⇒ `getByRole('heading', { name: 'Phát hiện tệp CAD' })` **trùng hai phần tử** (Playwright báo strict-mode). Phải thêm `level`. Nguồn tiêu đề: `CadBranchConfirm.tsx:274-279,288` (theo ghi chú), tôi **chưa** đọc để gán dòng cho từng cấp |

---

## MỤC 1 — projectPipelineGraph · có route · `ROUTE_PATTERNS.projectPipelineGraph`

**Ba câu.** Kiểm: cổng vai — người dùng `engineer`/`viewer` thấy câu "chỉ mở cho vai quản trị", `admin` thấy trạng thái `empty`. Chứng minh: A11 (không màn trắng, `forbidden` theo **phiên thật**). Đỏ thì người dùng mất: **vai sai thấy chế độ chi tiết kỹ thuật dành cho quản trị** (rò quyền), hoặc admin không thấy giải thích vì sao sơ đồ rỗng. Trả lời được câu 3 ở mức **nhỏ** ⇒ giữ **mục ngắn, hai ca**. Màn này **không phải màn kiểm được luồng dữ liệu** (mục PHÁT HIỆN 1) — đừng kỳ vọng hơn.

1. **Kiểu** — có route (`paths.ts:97`, `router.tsx:320`).
2. **Đường tới** — `/projects/project-1/pipeline/graph`, dựng từ `ROUTE_PATTERNS.projectPipelineGraph`. Không có `:floorId`. **Chưa tìm liên kết nào dẫn tới màn này** (ghi chú §5: chưa đo) — chỉ `goto`.
3. **Tiền đề** — ca `forbidden`: vai `engineer` mặc định **hoặc** `viewer` (cùng câu, đo). Ca `empty`: **đăng nhập `admin@example.com`** (qua `?next=`, khuôn `e2e/viewer3d.spec.ts:185-205`). Không cờ. Không lớp nào phải đóng (đo `dialogs: []`).
4. **Giá trị nghiệp vụ** — xem "Ba câu". Đã hạ: nội dung là chữ tĩnh 525 ký tự (`pipelineGraphText.ts`), không dữ liệu dự án; chỉ cổng vai là thứ **chỉ phiên thật** chứng minh.
5. **Đã kiểm ở tầng đơn vị** — `PipelineGraph.test.tsx` (không có `usePipelineGraph.test.ts`), **21 bài**: bảy trạng thái; forbidden giấu khối gấp và nút đổi nhánh; thu gọn xếp dọc; a11y; tiếng Việt; A1; không tên thư viện kỹ thuật ở Tổng quan; công thức độ dày hiện nguyên văn; nhánh đang dùng có badge; **Kỹ sư không thấy chi tiết / Quản trị thấy và mở khối gấp**; cảnh báo chạy lại nêu đúng N tường đã duyệt; giữ phần đã duyệt; xác nhận chạy lại làm mờ nút sau; dưới 1024 px tự xếp dọc. e2e **không lặp** bất kỳ ca nào ở đây. Chỉ e2e: vai theo **phiên đăng nhập thật**; thu gọn theo viewport thật (**chưa đo**).
6. **Ca luồng chính** — không có luồng. (a) `goto` ⇒ `getByRole('heading', { level: 1, name: 'Sơ đồ xử lý' })` hiện; nhóm sơ đồ có năm nhãn khối (chữ ở trường 12). (b) Đăng nhập admin ⇒ `h3` `Chưa có lượt xử lý nào để kể lại`. Không bước bấm nào đổi gì.
7. **Ca bảy trạng thái** — e2e: `forbidden` (engineer **và** viewer, đo, cùng câu) và `empty` (admin, đo). `success`/`partial`/`error`/`collapsed`: **không dựng được** (`run` không được route truyền — `PipelineGraph.container.tsx:130`; năm cổng đọc `unsupported`, `pipelineGraphGateway.ts:292-299`) ⇒ **thuộc tầng đơn vị**. `loading`: thoáng qua, **không bắt ổn định** (ghi chú 1.7).
8. **Ca bàn phím (A12)** — **phạm vi phím tắt: NOT FOUND** (grep `useShortcut`/`Escape`/`onKeyDown` trong `PipelineGraph/` không kể test ra rỗng, ghi chú bảng §1). Không lớp nào mở/đóng được ⇒ `Escape` không có gì để đóng. Đo `buttons: []` ở cả ba vai ⇒ **không có phần tử tiêu điểm** để Tab đi. Tab: **chưa đo**. ⇒ ca này **không áp dụng**.
9. **Ca tự lưu (A7)** — **không áp dụng**: không nhập dữ liệu nào.
10. **Ca hoàn tác (A8/A9)** — khối xác nhận đổi nhánh/chạy lại **có ở mã** (`isRerunConfirming`, `isSwitchConfirming`) nhưng **không dựng được** ở route thật ⇒ A9 thuộc **tầng đơn vị** (bài "cảnh báo chạy lại nêu đúng N tường"); A8: ghi chú không nói bài đơn vị nào phủ hoàn tác ⇒ **chưa phủ** (tôi không đọc test để khẳng định).
11. **Ca định dạng (A6/A15)** — A6: nhãn thường, không tên thư viện kỹ thuật (đơn vị phủ). Chữ thật đã đo: khối `Tệp đầu vào`, `Nhánh tệp CAD`, `Nhánh ảnh quét`, `Dữ liệu không gian đa tầng`, `Dựng mô hình 3D`. A15: **không áp dụng** (không số thập phân ở trạng thái dựng được).
12. **Mốc neo** — `getByRole('heading', { level: 1, name: 'Sơ đồ xử lý' })` — `PipelineGraph.tsx:66`, `pipelineGraphText.ts:141`. Mẩu vụn `getByRole('navigation', { name: 'Sơ đồ xử lý' })` — `PipelineGraph.tsx:49,61`. **Cùng tên `Sơ đồ xử lý` cho h1, nav và nhóm** ⇒ phải có `role` **và** `level`. Sơ đồ `getByRole('group', { name: 'Sơ đồ xử lý' })` (rộng) / `getByRole('list', { name: 'Sơ đồ xử lý' })` (thu gọn, `<ol>`) — `PipelineGraphOverview.tsx:303,312-314`. Khối: **không phải nút**, bám bằng `getByText` (chữ thật: `bản vẽ kiến trúc của hồ sơ` · `đường hình học đọc thẳng từ tệp` · `sáu bước nhận dạng chạy trên ảnh` · `hai nhánh hợp lại ở một tệp duy nhất` · `mặt bằng và khối nhà dựng từ tệp đó`; `pipelineGraphText.ts`, `:97` cho `Tệp đầu vào`). Câu `forbidden`: `Chế độ chi tiết kỹ thuật chỉ mở cho vai quản trị, nên phần đó và nút đổi nhánh không hiện ở đây.` (`pipelineGraphText.ts:209-210`). `empty`: `Chưa có lượt xử lý nào để kể lại` (`:206-207`, `PipelineGraph.tsx:153-157`). Không `data-testid`.
13. **KHÔNG kiểm được** — mọi nhánh có dữ liệu (sáu bước, trạng thái nút, so sánh CAD/AI, chế độ chi tiết, đổi nhánh, chạy lại). Lý do đã đo: `branchReport`/`comparison`/`nodeDetail`/`switchBranch`/`rerunFromNode` đều `supported:false`; `run` không được truyền. Ai chứng minh: tầng đơn vị (dày).

---

## MỤC 2 — projectScale · có route · `ROUTE_PATTERNS.projectScale`

**Ba câu.** Kiểm: kéo một đoạn tham chiếu trên canvas DOM thật, nhập chiều dài thật, thấy tỷ lệ **dùng dấu phẩy**; `Escape` huỷ đoạn đang kéo; vai `viewer` không sửa được. Chứng minh: **A15** (số thập phân thật), **A12** (Esc qua registry thật), **A11** (error/empty/partial/forbidden). Đỏ thì người dùng mất: **tỷ lệ bản vẽ sai hoặc không áp được**, nên mọi kích thước mô hình sai theo — đây là màn quyết định độ chính xác của toàn mô hình. Giữ; **mục nặng nhất** của nhóm.

1. **Kiểu** — có route (`router.tsx:321`).
2. **Đường tới** — `/projects/project-1/floors/L2/scale`, dựng từ `ROUTE_PATTERNS.projectScale` với `:floorId` = **`L2`**. **Không dùng `L1`** (hợp đồng dùng `L1`): `L1` mở thẳng ra `error` vì mock chất lượng `L1` có `frame:{isFound:false}` + `FRAME_NOT_FOUND` (`src/api/__mocks__/client.ts:186-191`; `scaleCalibrationGateway.ts:235`; `useScaleCalibration.ts:1257`). `L2`, `L3`, `L-1` vào thẳng trạng thái làm việc (đo). `L1` **dùng làm ca `error`**.
3. **Tiền đề** — vai `engineer` mặc định đủ; ca `forbidden`: đăng nhập `viewer@example.com` (sửa cần `can('edit','layer')`, `useScaleCalibration.ts:1246`). **Cửa sổ cố định 1440×900** (số đo phụ thuộc khung 1072×1072 tại (12, 94)). Không cờ; không lớp nào phải đóng (không tour ở màn này — tour chỉ mount ở walls/viewer/export; không hộp thoại, thiết kế cấm `role=dialog`, `ScaleCalibration.tsx:52`).
4. **Giá trị nghiệp vụ** — xem "Ba câu".
5. **Đã kiểm ở tầng đơn vị** — `ScaleCalibration.test.tsx` (771 dòng) + `useScaleCalibration.test.ts` (753), **31 bài**: bảy trạng thái (cả bảy tới được); forbidden ẩn nút áp; error nói hậu quả + mã máy đọc + lối về; `StatusBar` 32 px; khung hẹp; a11y; tiếng Việt; A1; **phép tính hiện đủ ba vế**; **kịch bản "kéo 400 px → nhập 4800 → 12 mm/px → tự lưu → hoàn tác"** (`useScaleCalibration.test.ts:411`); **cảnh báo tường ba mét (250 mm/px)**; lệch >15% so AI; ba dòng kiểm chứng; **Esc huỷ, R đo lại, nhích 1/10 px, Shift khoá trục**; sáu dòng nhắc phím; áp ghi vào store + tự lưu + hoàn tác; cổng thật không hứa lưu. e2e **không lặp** phép tính, cảnh báo, nhích. Chỉ e2e: **con trỏ thật trên DOM** (đo), **chuỗi thập phân thật**, `Escape` thật qua `shortcutRegistry`, `forbidden` bằng phiên.
6. **Ca luồng chính** (đã chạy thật, `L2`, 1440×900): (1) `goto` ⇒ `getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu' })`. (2) `mouse.move` (20 %, 50 % khung) → `down` → `move` (50 %, 50 %, `steps: 8`) → `up` ⇒ kết quả `÷ 961,794 px`. (3) `getByLabel('Chiều dài thật').fill('4800')` ⇒ `4.800 mm ÷ 961,794 px = 4,991 mm/px`; thanh trạng thái `1:40·4,991 mm/px`; `Tỷ lệ hiện tại: 4,991 mm/px`; `1 pixel = 5 mm · bản vẽ ở tỷ lệ khoảng 1:40`. (4) `Áp dụng tỷ lệ` — **không quan sát được kết quả** (trường 10, 13).
7. **Ca bảy trạng thái** — e2e kiểm được: `error` (`L1`: `Nắn ảnh thất bại nên bản vẽ có thể méo`, có ảnh, câu hậu quả `Tỷ lệ đo trên một bản vẽ méo sẽ sai theo.`; **và** `ZZZ`: `Hệ thống đã ghi nhận và sẽ kiểm tra… Mã lỗi: UNKNOWN`, **không ảnh** — hai `error` khác nguồn, cùng tiêu đề); `empty` (`L2`/`L3`/`L-1`: `Chưa có chuỗi kích thước nào để đối chiếu`); `partial` (sau khi kéo: `Chưa đủ dữ liệu để chốt tỷ lệ`); `forbidden` (viewer: `Bạn không có quyền hiệu chỉnh tỷ lệ`). `success`: **không thấy** (trường 10). `loading`, `collapsed`: tầng đơn vị / **chưa đo** (nút `Thu gọn bảng` có, chưa bấm).
8. **Ca bàn phím (A12)** — phạm vi **đã grep ra** (ghi chú): `scaleCalibration.cancelDrag`, `combo: 'Escape'`, **`scope: 'canvas'`** (`useScaleCalibration.ts:993-999`). Cùng phạm vi `canvas`: `R` đo lại, `Enter` xác nhận, `ArrowUp/Down/Left/Right`, `Shift+Arrow*` (`:1000-1090`). **Đo (L2):** kéo giữ chuột ⇒ `961,794 px` ⇒ `Escape` ⇒ vế đó về `—`, đoạn huỷ, URL không đổi. **Chưa đo:** `Escape` lúc không kéo; `R`, `Enter`, mũi tên; Tab. Trong màn không có tour nên không cạnh tranh `canvas` (Escape của tour cũng `canvas` — `useEditorTour.ts:575-586` — nhưng tour **không mount** ở màn này).
9. **Ca tự lưu (A7)** — **không có nút lưu** (`saveButtons: []`). Thanh trạng thái nói nguyên văn `tỉ lệ chỉ áp trong phiên này, chưa lưu lên máy chủ`; `persistScale` = false ở cổng thật (`useScaleCalibration.ts:613-617,1507-1518`). ⇒ **tự lưu 800 ms KHÔNG xảy ra ở route thật**: ca "chờ 800 ms, vùng status đổi" **không viết được**. A7 ở màn này: **chưa phủ** (xem PHÁT HIỆN 2).
10. **Ca hoàn tác (A8/A9)** — **không quan sát được**: sau `Áp dụng tỷ lệ` (chờ 1,2 s) tiêu đề vẫn `partial`, không có `Đã áp tỷ lệ cho bản vẽ` (`ScaleCalibration.tsx:73`), không nút/toast `Hoàn tác` (**NOT FOUND**), `Ctrl+Z` không đổi gì. **Nguyên nhân (đọc mã, lớp 2):** `onApply` thoát im lặng khi kho `spatial` không có tầng (mục "Lớp 2 đo thêm" 1). Đơn vị phủ hoàn tác trên kho gắn sẵn (`useScaleCalibration.test.ts:411`). A8 ⇒ **tầng đơn vị**; e2e chứng minh được một điều đơn vị không thấy: **nút không làm gì ở route thật** (PHÁT HIỆN 1). A9: **không áp dụng** (áp tỷ lệ thiết kế là hoàn tác được, không cần hộp thoại).
11. **Ca định dạng (A6/A15)** — A15, **chuỗi cụ thể đã đo** (1440×900, kéo 20 %→50 %, nhập 4800): `961,794 px` · `4,991 mm/px` · thanh trạng thái `X: 1600,00│Y: 1200,00` · `2,50 m²` (ngưỡng phòng: "khoảng hợp lý từ 2,50 m² trở lên"). **Chuỗi cùng màn dùng dấu CHẤM phân nhóm nghìn:** `4.800 mm` — **không phải vi phạm A15** (HOP-DONG §2). Ca A15 phải bắt `\d+,\d+ (px|mm/px)` và **loại** `\d\.\d{3}\b`; khẳng định **đúng** `961,794 px` chỉ khi khung cố định (số phụ thuộc hình học viewport — dùng regex ở mọi nơi khác). `0,921` xuất hiện thoáng khi gõ: **chưa xác định nhãn — chưa đo**, đừng khẳng định. A6: nhãn thường; **ngoại lệ tên phím**: dòng nhắc viết `ESCAPE`, `ENTER`, `ARROWLEFT` (HOA) còn ô phím viết `Esc`, `Shift`, `R`, `Enter` — hai kiểu trong cùng màn (PHÁT HIỆN 6).
12. **Mốc neo** — vùng `getByRole('region', { name: 'Màn hiệu chỉnh tỷ lệ' })` — `ScaleCalibration.tsx:66,183-185`. Canvas kéo `getByRole('group', { name: 'Bản vẽ đã nắn, kéo để vẽ đường tham chiếu' })` — `ScaleCalibrationCanvas.tsx:70,320-327` (**`<div role="group">`, không phải `<canvas>`**, `canvases: []`). Tay nắm: nút `Đầu đoạn tham chiếu, dùng phím mũi tên để nhích` / `Cuối đoạn tham chiếu, dùng phím mũi tên để nhích` (`ScaleCalibrationCanvas.tsx:111`; hiện sau khi kéo). `getByLabel('Chiều dài thật')` — `ScaleCalibrationMethodReference.tsx:39`. `getByRole('button', { name: 'Đo lại' })` — `:42`. `getByRole('button', { name: 'Áp dụng tỷ lệ' })` (đo; test `ScaleCalibration.test.tsx:111`). Bảng `getByRole('region', { name: 'Bảng hiệu chỉnh tỷ lệ' })` (hẹp: `Tấm trượt hiệu chỉnh tỷ lệ`) — `ScaleCalibrationPanel.tsx:42-46,88`; nút `Thu gọn bảng`. Phép tính `aria-label="Phép tính ra tỷ lệ"` — `:53-54`. Vùng thông báo `aria-label="Trạng thái của màn hiệu chỉnh tỷ lệ"` — `ScaleCalibration.tsx:68,190`; **có 2 `role="status"`** (banner + thanh trạng thái) ⇒ lọc theo `hasText`. Tiêu đề trạng thái: error `ScaleCalibration.tsx:72,76-77` (nút `Quay lại bước tiền xử lý`, `Tải lại ảnh`); `empty`/`partial`/`success`/`forbidden` `:70-74`. Không `data-testid`.
13. **KHÔNG kiểm được** — đường `Từ chuỗi kích thước` (mock không có chuỗi nào ⇒ không có hàng `role=option`, `ScaleCalibrationMethodDimension.tsx:84-104`): tầng đơn vị. `Áp dụng` → `success` → hoàn tác: tầng đơn vị; ở route thật không xảy ra. Tự lưu 800 ms: không lưu. Thu gọn/khung hẹp, Tab, phím `R`/`Enter`/mũi tên: **chưa đo**. Nhích bằng phím: đơn vị đã có.

---

## MỤC 3 — projectCadConfirm · có route · hộp thoại TỰ MỞ · `ROUTE_PATTERNS.projectCadConfirm`

**Ba câu.** Kiểm: hộp thoại tự mở; `Escape`/`Huỷ`/`Đóng hộp thoại` cùng đóng mà **không chốt nhánh**, màn nền dùng được; "Vẫn dùng AI" đi `/pipeline`. Chứng minh: **A12** (Esc đóng đúng hộp thoại trên trình duyệt thật, tiêu điểm thật), **A11** (empty, forbidden). Đỏ thì người dùng mất: **bị kẹt sau một hộp thoại tự mở không thoát được**, hoặc chọn nhánh nhưng không có gì xảy ra. Giữ. **Một trong đúng hai màn có lớp tự mở** (cùng `notifications`).

1. **Kiểu** — có route (`router.tsx:323`) **và** một bề mặt hộp thoại `Modal` tự mở.
2. **Đường tới** — `/projects/project-1/floors/L1/cad-confirm`, dựng từ `ROUTE_PATTERNS.projectCadConfirm`. **Mã tầng nào cũng ra cùng hộp thoại**: đo `L1`, `L2`, `L-1`, `ZZZ` đều mở (`L3`: chưa đo).
3. **Tiền đề** — vai không đòi (viewer mở được, đổi câu — trường 7). Không cờ. **Hộp thoại tự mở PHẢI đóng trước khi chạm màn nền** (`role="dialog"` + `aria-modal="true"`, `useState(true)` ở `useCadBranchConfirm.ts:424`; không điều kiện — đo). Mọi ca sau ca đầu đều phải đóng nó bằng thao tác thật của người dùng (`Escape`, `Huỷ` hoặc `Đóng hộp thoại`), **không** bằng cờ.
4. **Giá trị nghiệp vụ** — xem "Ba câu".
5. **Đã kiểm ở tầng đơn vị** — `CadBranchConfirm.test.tsx` (609) + `useCadBranchConfirm.test.ts` (970), **67 bài**: bảy trạng thái; forbidden ẩn `Nhập hình học`; error khoá nhánh CAD, vẫn mở AI; thu gọn; hai giai đoạn; **nhánh AI luôn còn đường về**; ánh xạ lớp; tóm tắt A15; ghi nhớ lựa chọn theo dự án; đơn vị/gốc toạ độ; nhập xong ⇒ `success`; chú giải độ dày tường; hình học xem trước; **`[NGHIEM-5]`: tiêu điểm vào hộp thoại, Tab vòng trong, Esc đóng không chốt nhánh, đóng thì tiêu điểm về nút đã mở** (`useCadBranchConfirm.test.ts:352`: "nút Huỷ đóng hộp thoại mà không chốt nhánh nào"). Bốn ca `[NGHIEM-5]` chạy trên **jsdom** ⇒ e2e chỉ xác nhận bằng **trình duyệt thật**: `Escape` thật, tiêu điểm thật, điều hướng `/pipeline` qua router. **Không lặp** ánh xạ lớp, A15 tóm tắt, ghi nhớ.
6. **Ca luồng chính** (đã chạy): (1) `goto` ⇒ `getByRole('dialog', { name: 'Phát hiện tệp CAD' })` (`aria-labelledby`, `Modal.tsx:121-123`). (2) Tiêu điểm đầu ở nút `Đóng hộp thoại` (đo). (3a) `Escape` ⇒ 0 dialog, `Dùng đường từ CAD`/`Vẫn dùng AI` còn trên trang. (3b) `Vẫn dùng AI` ⇒ URL `/projects/project-1/pipeline` (đo; `0/0`). (3c) `Dùng đường từ CAD` ⇒ panel `Ánh xạ lớp từ tệp CAD`, `Không có dữ liệu` ×2, `Đã ánh xạ 0/0 lớp · 0 đối tượng sẽ được nhập`, nút `Nhập hình học` **disabled**.
7. **Ca bảy trạng thái** — e2e: `empty` (mặc định: `Tệp CAD không có lớp được đặt tên`), `forbidden` (viewer: `Không có quyền xử lý CAD`; `Dùng đường từ CAD` **disabled**; `Vẫn dùng AI` **vẫn bấm được**). `error`/`success`/`partial`/`collapsed`: **không dựng được** (0 lớp CAD ở cổng thật; không endpoint nhập) ⇒ tầng đơn vị. Lưu ý: `error` không dựng được bằng `page.route` vì **không có nguồn nào gọi mạng** cho lớp CAD (**chưa thử** chặn endpoint danh sách tầng).
8. **Ca bàn phím (A12)** — phạm vi **đã grep ra**: hộp thoại dùng `Modal.Root` tự đăng ký `Escape` ở phạm vi **`dialog`** (`Modal.tsx`; ghi chú mã `useCadBranchConfirm.ts:28-32`); hook màn đăng ký `Escape` phạm vi **`sidePanel`** chỉ khi khối `Tuỳ chọn nhập` mở (`:769-781`) — **không dựng được** ở mock. **Đo:** `Escape` ⇒ hộp thoại biến mất, màn nền **còn nguyên và dùng được**, URL không đổi, tiêu điểm về heading `Phát hiện tệp CAD`. `Escape` lần hai: không đổi gì. `Huỷ` và `Đóng hộp thoại` cho **cùng kết quả** với `Escape`. Một `Escape` = một lớp. Bấm `Dùng đường từ CAD` rồi `Escape`: không đổi (0 dialog, URL cũ). **Chưa đo:** Tab (đơn vị phủ `[NGHIEM-5]`). Mã tự thừa nhận tiêu điểm đầu **không phải nút chính** (`CadBranchConfirmDialog.tsx`, đầu tệp: "Nút chính KHÔNG tự nhận tiêu điểm") — khớp đo.
9. **Ca tự lưu (A7)** — **không áp dụng**: không nút lưu; `Ghi nhớ lựa chọn cho dự án này` — cổng thật `supports.rememberChoice:false` ⇒ không lưu (`useCadBranchConfirm.test.ts:635`), chữ "chỉ trong phiên" nằm trên hộp thoại. Tích ô rồi chọn: **chưa đo** hiệu ứng.
10. **Ca hoàn tác (A8/A9)** — **KHÔNG phải A9.** Đo: bấm cả bốn (`Huỷ`, `Vẫn dùng AI`, `Dùng đường từ CAD`, `Đóng hộp thoại`) **không phát sinh yêu cầu HTTP ghi nào** (`page.on('request')` lọc khác GET/HEAD: 0 dòng). `setProcessingBranch` là `unsupported` (`useCadBranchConfirm.ts:692-694`, "không giả vờ đã ghi được gì"); "Vẫn dùng AI" chỉ **điều hướng**. **Cách quan sát "huỷ ⇒ không gì đổi":** (1) URL không đổi; (2) **0 yêu cầu ghi**; (3) `role=dialog` = 0 **và** hai nút chọn nhánh vẫn nằm trên trang (chưa chốt nhánh). Hộp thoại xác nhận thứ hai: mã **cấm lồng** (`CadBranchConfirmDialog.tsx`, đầu tệp). A8: không toast hoàn tác, **không áp dụng** (không đổi dữ liệu).
11. **Ca định dạng (A6/A15)** — A6: `aria-label="tiêu chí so sánh"` (viết thường, đúng); hàng `độ chính xác` · `công việc kiểm tra` · `thời gian`. Nội dung `empty`: `Tệp CAD không có lớp được đặt tên` (hoa chữ đầu, là tiêu đề) và `tệp CAD không có lớp nào được đặt tên. hệ thống sẽ ánh xạ theo loại hình học thay cho tên lớp.` (**câu sau bắt đầu chữ thường** — đo). A15: **không áp dụng** (`Đã ánh xạ 0/0 lớp · 0 đối tượng` là số nguyên).
12. **Mốc neo** — `getByRole('dialog', { name: 'Phát hiện tệp CAD' })` — `Modal.tsx:121-123`, `cadBranchConfirmText.ts:58`. `getByRole('button', { name: 'Đóng hộp thoại' })` — `Modal.tsx:167`. `getByRole('button', { name: 'Huỷ', exact: true })` — `cadBranchConfirmText.ts` (`DISMISS_BUTTON_LABEL`; số dòng **NOT FOUND**). `getByRole('button', { name: 'Vẫn dùng AI' })` — `CadBranchConfirmDialog.tsx:82`. `getByRole('button', { name: 'Dùng đường từ CAD' })` — `CadBranchConfirmDialog.tsx:85-91`. `getByRole('checkbox', { name: 'Ghi nhớ lựa chọn cho dự án này' })` — `CadBranchConfirmDialog.tsx:70-75`. Màn nền `getByRole('region', { name: 'Màn phát hiện tệp CAD' })` — `CadBranchConfirm.tsx:274-279,288`. Giai đoạn 2: tiêu đề `Ánh xạ lớp từ tệp CAD` — `cadBranchConfirmText.ts:159`; `Tuỳ chọn nhập` `:188`; `Nhập hình học` `:226`; nút `Thu gọn bảng lớp`. Khối bàn giao AI: `Chuyển sang nhánh nhận dạng ảnh`. **`getByRole('heading', { name: 'Phát hiện tệp CAD' })` khớp hai phần tử (h1 + h2)** — phải chỉ `level`. Không `data-testid`.
13. **KHÔNG kiểm được** — giai đoạn 2 với dữ liệu (chín lớp, bốn lớp gán, 312 thực thể, canvas xem trước, đơn vị, gốc toạ độ, `Nhập hình học`): 0 lớp ở cổng thật (đo). Ai chứng minh: tầng đơn vị (`useCadBranchConfirm.test.ts:254`, bộ mẫu 9 lớp). Tiêu điểm đầu ở `Đóng hộp thoại` thay vì nút chính: **không phải việc e2e sửa**, ghi nhận (Q-V5-2).

---


<!-- ===== V6 ===== -->

## Nhóm V6

Lớp viết mục, 2026-09-30. Nguồn sự thật: `ghi-chu-V6.md` (worker khảo sát, gọi tắt **[V6]**),
`HOP-DONG.md`, `HOP-DONG-BO-SUNG.md`, `probe-35-routes.json`, `don-vi-theo-man.md`.
Không viết test, không sửa repo. Số dòng đánh dấu **[V6]** là số tôi lấy từ ghi chú lớp 1
mà **chưa mở lại**; số dòng đánh dấu **[✓]** là số tôi tự mở và đọc lượt này.

## 0. Hình dạng cả bốn mục — quyết định bởi câu hỏi về "cửa bơm dữ liệu"

[V6] mục 0 kết luận **(a) CÓ CỬA**, kèm hai điều kiện. Vì vậy cả bốn mục ở dưới là mục đầy đủ,
và **trường 3 (tiền đề) của mỗi mục đều ghi đúng cửa ấy**. Nhưng cửa này không phải cửa sản phẩm,
nên đọc bốn mục với ba lưu ý dưới đây; nếu quên chúng thì cả bốn mục đọc như chứng minh nhiều
hơn nó chứng minh.

**Cửa:** `await import('/src/store/index.ts')` trong trang → `useStore.getState().setSpatial(<NormalizedSpatial>, null)`.
Số đo [V6]: skeleton trước → sau khi tiêm: tường 61 → 0, đối tượng 16 → 0, kích thước 16 → 0, trục 24 → 0.

**Lưu ý 1 — đây là "bài tích hợp bằng cách nạp kho", KHÔNG phải "màn tải dữ liệu từ máy chủ".**
Cổng đọc của cả bốn màn là `read: () => useStore.getState().spatial` [V6 mục 0 chặng 2,
`wallLayerReviewGateway.ts:326-328`, `:357`]: nó đọc lại chính cái kho, nên kho rỗng thì `null`
mãi, `loading` mãi. API giả **không có** đường đọc lớp không gian
(`src/api/__mocks__/client.ts:1210-1219` chỉ ghi/echo) nên `page.route` **không thay được cửa**.
Do đó **không ca nào trong bốn mục chứng minh "màn lấy được dữ liệu từ máy chủ"** — việc ấy chưa
từng chạy được ở bốn màn này và e2e không chứng minh được cho tới khi có đường đọc thật.

**Lưu ý 2 — cửa chỉ tồn tại ở máy chủ dev.** `scripts/run-playwright.mjs` chạy `vite` dev nên e2e
hiện có đi qua được [V6]. Bản dựng production không có đường `import('/src/…')`. Nếu về sau e2e
chạy trên bản dựng, cả bốn mục đóng lại cùng lúc (xem trường 13).

**Lưu ý 3 — thứ tự thao tác bắt buộc:** `page.goto(url)` **trước**, tiêm **sau**. `goto` tải lại
trang nên store về `null` [V6]. Không cần điều hướng nội bộ sau khi tiêm nên mục "store có sống sót
khi điều hướng nội bộ" ([V6] chưa đo #4) **không chặn** kế hoạch này; nó chỉ chặn ca "đổi tầng"
nếu sau này có (trường 13 của tường).

**Bẫy tầng (F2 [V6]):** tường và trục lấy `levelId` từ URL (`WallLayerReview.container.tsx:260` [V6]);
URL `L1` + bộ mẫu ⇒ "rỗng GIẢ" ("Chưa có đoạn tường nào"). URL phải dựng bằng
`ROUTES.project.walls(projectId, floorId)` (không viết tay) với `floorId` = mã Level của đồ thị tiêm.
Bảng mã của `HOP-DONG.md` mục 9 (`L1`) **chỉ đúng cho đối tượng và kích thước** (không lọc theo tầng).

**Bộ mẫu tiêm — mỗi màn một bộ RIÊNG** (F5 [V6]: bộ chung `createSampleBuilding()` làm kích thước
in cảnh báo React "hai con có cùng key" và nút duyệt không đổi `reviewed`):

| Màn | Nguồn `NormalizedSpatial` | file:dòng [V6] | `floorId` cho URL |
|---|---|---|---|
| tường | `WALL_LAYER_FIXTURE_NORMALIZED` | `WallLayerReview/wallLayerReviewFixture.ts:218` | `L-000001LVL0` |
| đối tượng | `OBJECT_LAYER_SAMPLE_GRAPH` | `ObjectLayerReview/objectLayerReviewGateway.ts:579` | `L1` dùng được |
| kích thước | `DIMENSION_OCR_SAMPLE_GRAPH` | `DimensionOcrReview/dimensionOcrReviewGateway.ts:301` | `L1` dùng được |
| trục | `createAxisGridSampleGraph()` (hàm, phải gọi) | `AxisGridManager/axisGridManagerGateway.ts:1202` | `L-AXISFLOOR1` |

**Không ca nào dưới đây viết ca "skeleton mãi".** Trạng thái skeleton-không-tiêm là một khiếm khuyết
đã đo (vòng tròn kho↔cổng), không phải hành vi mong muốn; khẳng định "vẫn skeleton" sẽ đỏ đúng lúc
sản phẩm được sửa. Việc "không trắng" của 35 màn thuộc ca quét chặng 1, không thuộc mục này.

**Số bài đơn vị của bốn màn** (`don-vi-theo-man.md`): tường **61**, đối tượng **42**, kích thước
**35**, trục **27** = 165. Theo quy tắc mục 5 của bổ sung: tường (≥ ~40) và đối tượng (≥ ~40) —
trường 5 nêu cụ thể, trường 6 chỉ đề xuất thứ trình duyệt thật chứng minh; kích thước và trục
(27–35) cũng phủ dày nên mục nào cũng viết theo hướng "e2e hẹp".

---

## 1. projectWalls — Duyệt lớp tường · `ROUTE_PATTERNS.projectWalls`

**1. Kiểu:** có route (`router.tsx:324` [V6]).

**2. Đường tới:** `ROUTES.project.walls('project-1', 'L-000001LVL0')` → `/projects/project-1/floors/L-000001LVL0/layers/walls`; sau đó tiêm `WALL_LAYER_FIXTURE_NORMALIZED`.

**3. Tiền đề:**
- Vai: `engineer` mặc định, không cần đăng nhập (HOP-DONG 1.2). Vai `viewer`: **chưa đo** trong trình duyệt [V6 #1].
- Cửa nạp-kho (mục 0), tiêm sau `goto`. Chờ: `getByLabel(/tường đã duyệt/)` khác "0/0" (đo [V6]: sau tiêm "12/48 tường đã duyệt").
- Lớp phải đóng: không có (đo `dialogs: []`, [V6]). `EditorTour` không tự mở (HOP-DONG 1.1). Có host toast `Thông báo`.
- Không bật cờ nào.

**4. Giá trị nghiệp vụ:** người duyệt bản vẽ dùng phím để xoá/hoàn tác tường sai. Đỏ ở đây ⇒ (a) phím `Backspace`/`Ctrl+Z` không tới được sổ phím toàn ứng dụng trong trình duyệt thật, người duyệt xoá nhầm mà không lấy lại được; (b) màn nói "đã lưu" trong khi chưa hề rời khỏi máy (A7). Cả hai đều mất công duyệt.

**5. Đã kiểm ở tầng đơn vị** (61 bài, 2 tệp; số dòng [V6]): bảy trạng thái đủ 7/7 (`WallLayerReview.test.tsx:169-200`); chú giải và ba băng độ dày khác token; duyệt 5 tường rồi hoàn tác 5 lần 12→17→12 (`useWallLayerReview.test.ts:346`); `J`/`K` (`:421`); đổi độ dày qua tầng lệnh (`:456`); **xoá không hộp thoại + vé hoàn tác 8000 ms** (`:506-526`); vai người xem vô hiệu mọi hàm sửa (`:554-583`); ảnh nền hỏng ≠ lớp tường hỏng (`:634`); vẽ tường hai điểm thêm một tường (`:865`); điều hướng tầng; A5. ⇒ e2e KHÔNG lặp logic đếm, độ dày, vé hoàn tác, vai.

**6. Ca luồng chính** (chỉ thứ trình duyệt thật chứng minh):
- **W-1 (A12/A8, đã đo [V6]):** sau tiêm, chọn một hàng `role="option"` trong `listbox` → bấm `Backspace` → còn **47** hàng, có toast; bấm `Ctrl+Z` → về **48** hàng. Đây là ca DUY NHẤT trong nhóm đã đo trọn vẹn trên trình duyệt. Khẳng định số hàng, không khẳng định chữ toast (xem W-3).
- **W-2 (A7, nói thật):** sau xoá, chờ > 800 ms rồi > 1,3 s: vùng `role="status"` tên `Thanh trạng thái` **không** chứa chữ khớp `/Đã lưu/`. Chữ hiện có [V6 F3]: **"Có thay đổi chưa lưu"** — nguồn nay đã tìm ra (xem PHÁT HIỆN P4): `src/i18n/vi.json:68` [✓] `autosave.dirty`, đi qua `useSaveIndicator` (`hooks/useSaveIndicator.ts:55` [✓]). Ca này khẳng định điều màn **không được nói dối**, không khẳng định "tự lưu thành công" (không thể: `persistWallLayer` **NOT FOUND**, `wallLayerReviewGateway.ts:39` [✓]). Xem Câu hỏi Q3.
- **W-3 (A6, dự kiến ĐỎ từ đầu):** toast sau xoá không chứa mã máy dạng `/W-\d{6}WALL/`. Đo [V6 F4]: toast là **"Đã xoá tường W-000001WALL."** trong khi danh sách gọi nó `#W-001`. Nguồn: `wallLayerReviewGateway.ts:686-688` [✓ đã thấy chuỗi `Đã xoá tường ${wallId}.`]. Ca này là **phát hiện**, không phải bài xanh; **không** sửa mã để nó xanh. Nếu người duyệt muốn ca đỏ nằm trong bộ, nó phải là `test.fixme` kèm lý do + điều kiện mở lại ("toast dùng nhãn hiển thị `#W-001` thay mã máy") — quyết định của người duyệt, không phải của tôi.
- **W-4 (A12, sau khi đo):** phím `J`/`K`/`V`/`W`/`M`/`1`/`2`/`3` qua sổ phím thật (đăng ký `scope:'canvas'`, `useWallLayerReview.ts:1247-1356` [V6]). Chưa đo trên trình duyệt ngoài `Backspace`/`Ctrl+Z`/`Esc` → **chưa đo**; chỉ đưa vào bộ sau khi đo một lần.

**7. Ca bảy trạng thái:**
- `success`: e2e (W-1 tiền đề: 12/48).
- `empty`: **thuộc tầng đơn vị.** Trạng thái "Chưa có đoạn tường nào" đo được trong trình duyệt, nhưng chỉ do URL `L1` lệch mã tầng (rỗng GIẢ) — dùng nó làm ca `empty` là chứng minh một bẫy chứ không chứng minh trạng thái rỗng thật.
- `loading`: chỉ thấy ở dạng skeleton-mãi (khiếm khuyết); không viết ca. Đơn vị đã phủ.
- `error`: **không kiểm được** — không có đường mạng để chặn (mục 0).
- `forbidden`: **chưa đo** (viewer trong trình duyệt); đơn vị đã phủ (`:554-583`).
- `partial`, `collapsed`: thuộc tầng đơn vị.

**8. Ca bàn phím (A12):** W-1 chứng minh `Backspace`/`Ctrl+Z` qua sổ phím. **Esc:** màn **không** đăng ký `Escape` riêng (`useWallLayerReview.ts`, grep [V6]); phạm vi đã đăng ký là `canvas` [V6 mục 1]; Esc rơi xuống `closeTopLayer` toàn cục — nó đóng gì khi có lớp khác mở: **chưa đo**. Tab đi hết luồng chính: **chưa đo**.

**9. Ca tự lưu (A7):** W-2. Không có nút lưu: đã chứng minh bằng máy 0/35 (HOP-DONG mục 2) — ca quét-toàn-bộ thay cho ca riêng ở đây. Nửa "tự lưu 800 ms và nói ra": **không thực hiện được ở màn này** — `persistWallLayer` không có endpoint; tự lưu ném lỗi (`useWallLayerReview.ts:~693-700` [✓ đọc `throw new Error(result.missing)`]). Bài chờ chữ "Đã lưu" sẽ đỏ vĩnh viễn. Trạng thái `Lưu thất bại sau nhiều lần thử…` sau chuỗi thử lại (5/15/45 s): **chưa đo**.

**10. Ca hoàn tác (A8/A9):** A8: W-1. A9: **không áp dụng** — xoá tường hoàn tác được (toast + vé 8000 ms), không có hộp thoại (đơn vị `:506-526` [V6]). Toast có tự mất sau 8000 ms không: **chưa đo** [V6 #5].

**11. Ca định dạng (A6/A15):** W-3 (A6, mã máy lọt lên toast). Cây lớp/danh sách: `Ẩn lớp Tường` có chữ hoa giữa câu [V6 F7] — thuộc Q2. A15: mọi chữ số hiện ra trên màn sau tiêm chưa được đo về dấu thập phân; probe `dotDecimals` không dùng được vì probe chạy lúc chưa tiêm → **chưa đo**. Đề xuất một ca quét chữ sau tiêm bắt `\d\.\d{1,2}(?!\d)` (dấu chấm ở vị trí thập phân; nhóm nghìn `\d\.\d{3}` thì bỏ qua).

**12. Mốc neo** (chữ nguyên văn, file:dòng theo [V6], chưa kiểm lại từng dòng trừ nơi ghi [✓]):
- Vùng màn `getByRole('region',{name:'Duyệt lớp tường'})` — `WallLayerReview.tsx:76,109`
- Ray công cụ `getByRole('toolbar',{name:'Công cụ lớp tường'})` — `WallLayerToolRail.tsx:77,121-124`; nút `'chọn (phím V)'`, `'vẽ tường (phím W)'`, `'tách đoạn'`, `'nối đoạn — Chọn hai đoạn tường để gộp'`, `'đo (phím M)'`, `'Thu gọn hai panel'` — `:69-75,108,144,171`
- Danh sách `getByRole('listbox',{name:'Danh sách đoạn tường'})`, hàng `role="option"` tên `"#W-001 — …"` — `WallLayerList.tsx:58,271-274,131,157`
- Cây lớp `getByRole('tree',{name:'Cây lớp'})`, nút `'Ẩn lớp Tường'` — `WallLayerLeftPanel.tsx:88,313,92,173`
- Nav tầng `getByRole('navigation',{name:'Tầng của bản vẽ'})` — `WallLayerLeftPanel.tsx:89,212`
- Thanh trạng thái `getByRole('status',{name:'Thanh trạng thái'})` — `WallLayerStatusBar.tsx:27,32-34`; chữ trong đó lấy từ `saveLabel` (`WallLayerStatusBar.tsx:41` [✓]; `useWallLayerReview.ts:1657` [✓])
- Bộ đếm `getByLabel(/tường đã duyệt/)` (chữ đổi theo số; dùng regex) — `WallLayerLeftPanel.tsx:276`
- Độ dày `getByRole('group',{name:'Độ dày tường'})` — `WallLayerInspector.tsx:48,60`
- Canvas: nhãn là biến `canvasLabel` (`WallLayerCanvas.tsx:282`) — **không có hằng chữ; đừng bám canvas**. Bám `region` + `listbox`.
- Toast: nút hoàn tác của toast — tên nút **chưa đo** (ở dashboard/settings toast dùng nút `Hoàn tác`; chưa xác nhận cho màn này). Vùng chứa `getByRole('region',{name:'Thông báo'})`.

**13. KHÔNG kiểm được:**
- Tải dữ liệu từ máy chủ (không có đường đọc; ai chứng minh: không ai cho tới khi có cửa chính thức; điều kiện mở cổng (i)(ii)(iii) ở [V6 mục 0]).
- Ca `error` (không đường mạng); ca `forbidden` (chưa đo; đơn vị `:554-583` phủ).
- "Tự lưu 800 ms thành công" (không có endpoint).
- Nếu e2e chạy trên bản dựng production: cả mục đóng.
- Số bài đơn vị phủ phần còn lại: 61.

---

## 2. projectObjects — Lớp đối tượng · `ROUTE_PATTERNS.projectObjects`

**1. Kiểu:** có route (`router.tsx:325` [V6]).

**2. Đường tới:** `ROUTES.project.objects('project-1', 'L1')`; tiêm `OBJECT_LAYER_SAMPLE_GRAPH`. (`L1` vẫn ra dữ liệu — màn không lọc theo tầng [V6].)

**3. Tiền đề:** vai `engineer` mặc định; viewer **chưa đo**. Cửa nạp-kho (mục 0), tiêm sau `goto`. Chờ `getByLabel`/chữ "9/21 đối tượng đã duyệt" [V6: sau tiêm 9/21; cửa đi 9 · cửa sổ 7 · nội thất 5]. Không có lớp chắn (`dialogs: []`). Không cờ.

**4. Giá trị nghiệp vụ:** người duyệt chọn nhóm cửa đi/cửa sổ/nội thất bằng phím `D`/`W`/`F`. Đỏ ⇒ phím bị nuốt hoặc kích hoạt sai khi đang gõ trong ô thanh tra ("chiều rộng"), nên người duyệt đổi nhóm ngoài ý muốn. **Lưu ý thẳng:** cơ chế sổ phím này ĐÃ được ca W-1 của tường chứng minh trong trình duyệt; mục này chỉ thêm giá trị nếu đo ra được hành vi riêng của màn (Esc, phím-trong-ô-nhập). Nếu hai điều đó đo ra trùng hệt tường, **mục này rút xuống một ca** — không mở rộng cho đủ số.

**5. Đã kiểm ở tầng đơn vị** (42 bài, 3 tệp; số dòng [V6]): bảy trạng thái (`ObjectLayerReview.test.tsx:139`); tổng 21 = 9+7+5 ở mọi nơi (`:163`, `useObjectLayerReview.test.ts:300`); "thêm thủ công" ở rỗng (`:254`); màu dữ liệu ba lớp (`useObjectLayerReview.test.ts:354`); gộp lệnh 400 ms — kéo cửa 20 lần = 1 bước (`:399`); đổi loại / chiều mở / duyệt A5 (`:453-570`); gắn tường (`:588-680`); **phím `D/W/F/1/2/Esc` qua sổ phím thật** (`:687-770`, jsdom); vai Người xem (`:772`); xoá kèm toast hoàn tác (`:854`); Esc (`useObjectLayerReview.test.ts:717`). ⇒ e2e KHÔNG lặp: đếm, gộp lệnh, gắn tường, vai.

**6. Ca luồng chính:**
- **O-1 (A12, CẦN ĐO TRƯỚC KHI VIẾT):** sau tiêm, bấm `d` → nhóm cửa đi được chọn (nút `chọn nhóm cửa đi (phím D)`); bấm `Escape` → bỏ vùng chọn/đóng thanh tra (`objectLayerReview.closeTopLayer`, `scope:'canvas'`, `useObjectLayerReview.ts:1199-1203` [V6]). Kết quả quan sát được trong trình duyệt: **chưa đo** [V6 #2]. Không viết khẳng định cho tới khi đo.
- **O-2 (A12, CẦN ĐO):** gõ chữ `d` **vào ô** "chiều rộng" của thanh tra ⇒ nhóm KHÔNG đổi (sổ phím bỏ qua đích nhập chữ — `isTextEntryTarget`, `shortcutRegistry.ts`, được nêu ở chú thích `useProjectDashboard.ts` [đã thấy khi đo V3]). Trên màn này: **chưa đo**.
- Không đề xuất ca xoá/hoàn tác riêng — đã có đơn vị `:854` và W-1 chứng minh cơ chế.

**7. Ca bảy trạng thái:** `success` e2e (điều kiện tiền đề). `empty`: không dựng được sạch (URL không lọc tầng nên không có bẫy lệch tầng; tiêm đồ thị rỗng cần một `NormalizedSpatial` rỗng — **chưa đo**) → thuộc tầng đơn vị (`:254`). `loading`: skeleton-mãi, không viết ca. `error`: không kiểm được. `forbidden`: chưa đo; đơn vị `:772`. `partial`, `collapsed`: đơn vị.

**8. Ca bàn phím (A12):** O-1, O-2 (đều chưa đo). Phạm vi đã đăng ký: `Escape` tên `objectLayerReview.closeTopLayer`, `scope:'canvas'` (`:1199-1203` [V6]); phím `D`/`W`/`F`, `1/2/3`, `Mod+Z` (`:1121-1203`). Lớp trên cùng: thanh tra phải. Tab đi hết luồng: **chưa đo**.

**9. Ca tự lưu (A7):** `persistObjectLayer: false` (`objectLayerReviewGateway.ts:1762` [V6]) ⇒ cùng số phận tường. **Hành vi thanh trạng thái sau thao tác ghi ở đối tượng: chưa đo** [V6 #3]. Không viết ca cho tới khi đo; **không suy ra từ tường**.

**10. Ca hoàn tác (A8/A9):** A8: đơn vị (`:854`), cơ chế phím thật do W-1 chứng minh. A9: **không áp dụng** (xoá hoàn tác được bằng toast).

**11. Ca định dạng (A6/A15):** A6 — một ca quét chữ sau tiêm (nhãn objects viết thường: `lớp đối tượng`, `cây lớp` [V6 F7]). A15 — chiều rộng/chiều cao/cao độ bệ cửa trong thanh tra: định dạng số **chưa đo**; quét `\d\.\d{1,2}(?!\d)`.

**12. Mốc neo** (theo [V6]; nơi có [✓] tôi tự đọc):
- Vùng màn `getByRole('region',{name:'lớp đối tượng'})` — `ObjectLayerReview.tsx:62,187-189`
- Canvas `getByRole('group',{name:'mặt bằng lớp đối tượng'})` — `ObjectLayerReview.tsx:63,234`, `ObjectLayerCanvas.tsx:271-274`
- Nhóm công cụ: nhãn **`chọn nhóm ${nhãn} (phím ${kbd})`** với nhãn `cửa đi`/`cửa sổ`/`nội thất` — `ObjectLayerToolRail.tsx:130` [✓], nhãn ở `objectLayerTypes.ts:47-51` [✓]. Chữ đo [V6]: `'chọn nhóm cửa đi (phím D)'`, `'chọn nhóm cửa sổ (phím W)'`, `'chọn nhóm nội thất (phím F)'`. (Ghi chú V6 ghi "dòng: chưa đo" — nay đã có: xem PHÁT HIỆN P4.) Nút đổi loại con: `đổi thành ${loại con} (phím ${slot})` — `ObjectLayerToolRail.tsx:161` [✓].
- Cây lớp `getByRole('tree',{name:'cây lớp'})`, `'Ẩn lớp cửa đi'` — `ObjectLayerLeftPanel.tsx:56,203,116`
- Lọc `getByRole('group',{name:'lọc theo loại'})` — `ObjectLayerLeftPanel.tsx:59,238`
- Danh sách `getByRole('group',{name:'danh sách đối tượng'})`, hàng `role="option"` tên `"#D-004 — …"` — `ObjectLayerList.tsx:46,248,91,108`
- Thanh tra: `'loại đối tượng'`, `'chiều rộng'`, `'chiều cao'`, `'cao độ bệ cửa'`, `'tường chứa nó'`, `'vị trí trên tường'`, `'hướng mở'`, `'độ tin cậy'`; nút `'Gắn vào tường gần nhất'`, `'Duyệt đối tượng này'` — `ObjectLayerInspector.tsx:170-180`
- Thanh trạng thái `getByRole('status',{name:'Thanh trạng thái'})`; nút `'Hoàn tác'`, `'Thu gọn hai panel'` — `ObjectLayerStatusBar.tsx:33-35,61-63`

**13. KHÔNG kiểm được:** tải từ máy chủ (mục 0); ca `error`; ca `empty` sạch (chưa đo cách dựng); hành vi tự lưu sau thao tác ghi (chưa đo); `forbidden` trong trình duyệt (chưa đo; đơn vị `:772` phủ). Nếu ca O-1/O-2 đo ra trùng hệt tường thì phần còn lại do 42 bài đơn vị chứng minh và mục này thu về một ca.

---

## 3. projectDimensions — Đọc kích thước OCR · `ROUTE_PATTERNS.projectDimensions`

**1. Kiểu:** có route (`router.tsx:326` [V6]).

**2. Đường tới:** `ROUTES.project.dimensions('project-1', 'L1')`; tiêm `DIMENSION_OCR_SAMPLE_GRAPH`. **Không** dùng `createSampleBuilding()` (F5).

**3. Tiền đề:** vai `engineer` mặc định (phím `R` chỉ bật khi `canEdit`, `useDimensionOcrReview.ts:947` [V6]); viewer chưa đo. Cửa nạp-kho (mục 0), tiêm sau `goto`. Chờ: 0 skeleton và có chuỗi kích thước (đo [V6]: `900 mm` … `9.225 mm`, 9 `option` sau lọc "dưới ngưỡng"). Không lớp chắn.

**4. Giá trị nghiệp vụ:** đây là màn người duyệt kiểm hàng chục con số đọc từ bản vẽ; "chế độ duyệt bàn phím" là đường nhanh nhất để đi qua danh sách. Đỏ ⇒ phím `R` không bật chế độ, người duyệt phải đi bằng chuột 34 dòng — mất đúng thứ A12 hứa ("bàn phím là đường đi hạng nhất").

**5. Đã kiểm ở tầng đơn vị** (35 bài, 3 tệp; số dòng [V6]): bảy trạng thái (`DimensionOcrReview.test.tsx:321`, `useDimensionOcrReview.test.ts:214`); **năm giá trị sửa bằng Tab/ArrowUp/Enter, chuột = 0** (`:401`); **chế độ bàn phím: gõ số + Enter = hai lần gõ** (`:458`, `useDimensionOcrReview.test.ts:535`); độ lệch 1,5% không tô, 2,5% tô (`:518`, `:295`); bộ đếm 18/34→34/34 (`:588`); duyệt + hoàn tác trả cả cờ duyệt (`:480`); A5; ba bộ lọc; giá trị vô lý "phòng dài 30 m" (`:653`); vai người xem (`:699`); ảnh cắt gốc (`:805`). ⇒ e2e KHÔNG lặp luồng gõ; chỉ dùng trình duyệt cho phím `R` và `Esc` qua sổ phím toàn ứng dụng.

**6. Ca luồng chính:**
- **D-1 (A12, một nửa đã đo [V6]):** sau tiêm → bấm `r` → hiện khối "Chế độ duyệt bàn phím — đường nhanh nhất để đi qua danh sách kích thước" với các dòng `Enter`/`Tab`/`Esc`/`R` và nút `Tắt chế độ duyệt bàn phím` (đo [V6]: `R` mở khối; sau đó `Esc` không tạo hộp thoại). Đây là ca có số đo đứng sau.
- **D-2 (A12, CẦN ĐO):** `Escape` khi **có hàng đang chọn** bỏ bản nháp đang gõ trước, rồi mới bỏ chọn (`enabled: selectedDimensionId !== null`, `useDimensionOcrReview.ts:918-935` [V6]); `Escape` khi **không hàng nào chọn** rơi xuống `global` (chú thích `:~915-917`). Tác dụng cụ thể lên chế độ bàn phím: **chưa đo**. Không viết khẳng định cho tới khi đo.
- Không đề xuất ca nút "Duyệt kích thước" (34 nút, `getByRole('button',{name:/^Duyệt kích thước /})`): với bộ mẫu chung nó không đổi `reviewed` (F5); với `DIMENSION_OCR_SAMPLE_GRAPH` trên trình duyệt: **chưa đo** [V6 #6].

**7. Ca bảy trạng thái:** `success` e2e (tiền đề). `loading`: skeleton-mãi, không viết ca; **không phải màn trắng** (F8 [V6]: thân 47 ký tự, đúng năm nút zoom + chế độ bàn phím, đang ở `loading`). `empty`, `partial`, `collapsed`: đơn vị. `error`: không kiểm được (không đường mạng). `forbidden`: chưa đo; đơn vị `:699`.

**8. Ca bàn phím (A12):** D-1, D-2. Phạm vi: `dimensionOcrReview.keyboardMode` (phím `R`, `scope:'canvas'`, chỉ khi `canEdit`, `:937-947` [V6]) và `dimensionOcrReview.closeTopLayer` (`scope:'canvas'`). Tab/ArrowUp/Enter sửa giá trị: đơn vị đã phủ (`:401`) — không lặp. Tab trong trình duyệt thật: **chưa đo**.

**9. Ca tự lưu (A7):** `persistDimensionLayer: false` (`dimensionOcrReviewGateway.ts:1042` [V6]). Thanh trạng thái sau sửa/duyệt: **chưa đo** [V6 #3]. F6 [V6]: sau `Ctrl+Z` vùng `role="status"` "0/34 kích thước đã duyệt" biến mất khỏi danh sách `[role=status]` — đo trên bộ mẫu CHUNG nên chưa rõ có phải hệ quả F5 hay không: **chưa đo với bộ mẫu riêng**.

**10. Ca hoàn tác (A8/A9):** A8: đơn vị (`:480`), cơ chế phím do W-1 chứng minh; không ca riêng. A9: **không áp dụng** (duyệt/sửa hoàn tác được).

**11. Ca định dạng (A6/A15):** A6 — quét chữ sau tiêm; nhãn màn này có chữ hoa đầu câu (`Bản vẽ lớp kích thước OCR`, `Kích thước đọc được` [V6]) → thuộc Q2. A15 — chuỗi hiện ra `900 mm … 9.225 mm` dùng dấu chấm làm **nhóm nghìn** (đo [V6]), không phải dấu thập phân ⇒ không vi phạm; ca A15 phải bắt dấu ở vị trí thập phân (BỔ SUNG mục 3), ví dụ độ lệch phần trăm `1,5%`. Định dạng độ lệch trên trình duyệt: **chưa đo**.

**12. Mốc neo** (theo [V6]; cột "chữ" là chữ nguyên văn từ `dimensionOcrText.ts`):
- Nút bật chế độ bàn phím `getByRole('button',{name:'Bật chế độ duyệt bàn phím'})` — chữ `dimensionOcrText.ts:53` (`keyboardModeToggleLabel`); vẽ `DimensionOcrKeyboardMode.tsx:112`
- Gợi ý phím `'Hoặc bấm R để bật'` — `dimensionOcrText.ts:59`; `DimensionOcrKeyboardMode.tsx:115`
- Nút tắt `'Tắt chế độ duyệt bàn phím'` (đo [V6]; dòng nguồn **chưa ghi**)
- Vùng màn `getByRole('region',{name:'đọc kích thước OCR'})` — `dimensionOcrText.ts:205`; `DimensionOcrReview.tsx:74,200-225`
- Canvas `getByRole('group',{name:'Bản vẽ lớp kích thước OCR'})` — `dimensionOcrText.ts:109`; `DimensionOcrCanvas.tsx:190-192`
- Bảng duyệt `getByLabel('Kích thước đọc được')` — `dimensionOcrText.ts:211`; `DimensionOcrReview.tsx:256`
- Danh sách `getByRole('group',{name:'Danh sách kích thước đọc được'})`, hàng `role="option"` — `dimensionOcrText.ts:112`; `DimensionOcrList.tsx:124-126,156`
- Lọc `'Lọc theo trạng thái duyệt'` — `dimensionOcrText.ts:215`; `DimensionOcrList.tsx:149`
- Ô giá trị `getByLabel(/^Giá trị kích thước /)` (tiền tố + mã, vd `Giá trị kích thước M-018`) — `dimensionOcrText.ts:224`; `DimensionOcrRow.tsx:236`
- Nút duyệt `getByRole('button',{name:/^Duyệt kích thước /})` — `dimensionOcrText.ts:225`; `DimensionOcrRow.tsx:327`
- Zoom `'Điều khiển zoom'`, `'Thu nhỏ'`, `'Phóng to'`, `'Vừa khung nhìn'`, `'Zoom hiện tại 100%. Bấm để về 100%'` — `components/canvas/ZoomCluster.tsx:74,81,97,108,122`

**13. KHÔNG kiểm được:** tải từ máy chủ; ca `error`; nút "Duyệt kích thước" trên bộ mẫu riêng (chưa đo); tự lưu (chưa đo, cổng khai `persist…: false`); `forbidden` trong trình duyệt (chưa đo). Phần còn lại do 35 bài đơn vị chứng minh.

---

## 4. projectGrids — Quản lý trục và gốc toạ độ · `ROUTE_PATTERNS.projectGrids`

**1. Kiểu:** có route (`router.tsx:327` [V6]).

**2. Đường tới:** `ROUTES.project.grids('project-1', 'L-AXISFLOOR1')`; tiêm `createAxisGridSampleGraph()` (gọi hàm). **Bẫy tầng**: `L1` ⇒ "chưa có trục nào · Suy ra từ tường bao" (rỗng GIẢ).

**3. Tiền đề:** vai `engineer` mặc định (canvas chỉ xem cho viewer, kèm lời giải thích [V6]); viewer chưa đo. Cửa nạp-kho (mục 0), tiêm sau `goto`, **và** đúng `L-AXISFLOOR1`. Chờ `getByRole('option',{name:/^Trục A/})`. Màn trục dùng `useQuery(readAxisLayer)` (`useAxisGridManager.ts:~414-430` [V6]) nhưng truy vấn ấy cũng chỉ đọc lại kho ⇒ vẫn cần tiêm. Không lớp chắn.

**4. Giá trị nghiệp vụ:** trục là khung tham chiếu của cả bản vẽ; màn chặn hai trục cách nhau dưới 100 mm và nói vì sao. Đỏ ⇒ người dùng không thấy trục/gốc toạ độ của bản vẽ hoặc số đo lệch; nhưng phần lớn logic đã có đơn vị. **Thẳng thắn:** ngoài "mở được sau nạp kho", tôi không có một hành vi trình-duyệt-mới-chứng-minh-được **đã đo** cho màn này. Mục này giữ đúng để ghi lại vì sao nó mỏng, và **thu về một ca** (G-1) cộng một ca CẦN ĐO (G-2). Nếu người duyệt thấy G-1 không đáng, mục **bỏ** và bảng coverage-map giữ nguyên ô.

**5. Đã kiểm ở tầng đơn vị** (27 bài, 2 tệp; số dòng [V6]): bảy trạng thái (`AxisGridManager.test.tsx:117`, `useAxisGridManager.test.ts:415`); câu chặn 100 mm nêu đích danh hai trục (`:158`, `useAxisGridManager.test.ts:324`); độ lệch gốc bằng chữ hai đơn vị, **không dấu chấm thập phân** (`:185`, `useAxisGridManager.test.ts:555`); bảng ba tầng (`:210`); căn tự động + một `Ctrl+Z` = một bước + toast hoàn tác (`useAxisGridManager.test.ts:228-320`); hai khả năng `persist…` chưa có đường trả `supported:false` (`:485-530`); bóng ma tầng (`:592`). ⇒ e2e KHÔNG lặp: chặn 100 mm, độ lệch gốc, căn tự động, hoàn tác.

**6. Ca luồng chính:**
- **G-1 (nạp kho, đã đo phần quan sát [V6]):** sau tiêm ở `L-AXISFLOOR1`: có trục **A/B/C/D** và **1/2/3/4**, khoảng cách `4.000 mm`, `5.000 mm`, **8** `option`; nút `Ẩn trục A`, `Xoá trục A`. Chỉ khẳng định chuỗi và số hàng đã đo — và chỉ như **điều kiện đủ để dựng ca sau** (đây là chứng minh cửa nạp-kho ở màn này hoạt động, không phải hành vi sản phẩm).
- **G-2 (CẦN ĐO, thứ trình duyệt-thật mới chứng minh):** thêm trục / kéo trục bằng con trỏ thật trên SVG canvas. **Chưa đo** [V6 #7]. Không viết ca; chỉ ghi vào bảng đo chặng 0.

**7. Ca bảy trạng thái:** `success` e2e (G-1). `empty`: đo được ở `L1` ("chưa có trục nào · Suy ra từ tường bao") nhưng do lệch tầng — ghi như F2, không dùng làm ca. `loading`: skeleton-mãi (24 khối), không viết ca. `error`: có chữ `Thử lại` (`AxisGridManager.tsx:99`) nhưng không có đường mạng để gây ra — không kiểm được. `forbidden`, `collapsed`, `partial`: đơn vị/chưa đo (viewer chưa đo).

**8. Ca bàn phím (A12):** màn **không** đăng ký `Escape` (chỉ `Mod+Z`, `useAxisGridManager.ts:955-959` [V6]); Esc rơi xuống toàn cục — nó đóng gì: **chưa đo**. Tab/mũi tên đi hàng trục: **chưa đo**. Vì màn không có lớp nào để đóng, câu "Esc đóng đúng một lớp" không có đối tượng ở đây; phần "bàn phím hạng nhất" (đi hàng trục, thêm trục không cần chuột) **chưa phủ**.

**9. Ca tự lưu (A7):** `persistAxisLayer`/`persistOrigin` khai `false` (`axisGridManagerGateway.ts:1104-1105` [V6]); màn có nói ra sự thật "chưa lưu được" (`useAxisGridManager.ts:46` [✓ chú thích]) và đơn vị phủ `supported:false` (`:485-530`). Hành vi thanh trạng thái trên trình duyệt sau thao tác: **chưa đo**.

**10. Ca hoàn tác (A8/A9):** A8: đơn vị (căn tự động + `Ctrl+Z` + toast; xoá trục có toast mô tả `removeToastDescription(axis.label)`, `useAxisGridManager.ts:763` [✓]). A9: **không áp dụng** — xoá trục hoàn tác được bằng toast, không có hộp thoại.

**11. Ca định dạng (A6/A15):** A15 — gốc toạ độ hiện `gốc toạ độ 0,0` (dấu phẩy, nhãn `img`, `AxisGridOriginMarker.tsx:43`) và `4.000 mm` (nhóm nghìn); đơn vị phủ "không dấu chấm thập phân" (`:185`) ⇒ `đơn vị`. A6: nhãn `Căn chỉnh tự động`, `Thêm trục ngang`, `Thêm trục dọc` có chữ hoa đầu câu — thuộc Q2.

**12. Mốc neo** (theo [V6]; nơi có [✓] tôi tự đọc):
- Vùng màn `getByRole('region',{name:'quản lý trục và gốc toạ độ'})` — `AxisGridManager.tsx:203-205`
- Khung xem `getByRole('group',{name:'Khung xem bản vẽ quản lý trục và gốc toạ độ'})` — `AxisGridCanvas.tsx:70,229-231`; `AxisGridManager.tsx:95`
- Hàng trục `getByRole('option',{name:'Trục A, cách trục kế là 4.000 mm'})`; `'Ẩn trục A'`, `'Xoá trục A'` — `AxisGridLeftPanel.tsx:102-128`
- **`'Thêm trục ngang'`, `'Thêm trục dọc'`** — hằng **có**: `useAxisGridManager.ts:155` [✓ `addAxisHorizontal: 'Thêm trục ngang'`] và `axisGridManagerScenarios.ts:140-141` [✓]. (Ghi chú V6 ghi "NOT FOUND" — sai; xem P4.)
- Bóng ma `'Hiện bóng ma tầng dưới'` — hằng `GHOST_TOGGLE_LABEL` ở `AxisGridLeftPanel.tsx:61` [✓]; **loại phần tử (switch/checkbox) chưa đo** ⇒ dùng `getByLabel('Hiện bóng ma tầng dưới')` cho tới khi đo
- Gốc toạ độ `getByRole('img',{name:'gốc toạ độ 0,0'})`; `'Chọn giao trục neo'`; `'lệch X (pixel)'`, `'lệch Y (pixel)'`, `'lệch X (mm)'`, `'lệch Y (mm)'` — `AxisGridOriginMarker.tsx:43,53-54`; `AxisGridOriginPanel.tsx:41-47`
- Căn chỉnh `getByRole('button',{name:'Căn chỉnh tự động'})` — `AxisGridFloorAlignList.tsx:51`
- Suy ra trục `'Suy ra từ tường bao'` — `AxisGridManager.tsx:97`; `'Thử lại'` — `:99`
- Cảnh báo 100 mm: `InlineAlert role="status"` — `AxisGridManager.tsx:216`

**13. KHÔNG kiểm được:** tải từ máy chủ (mục 0); `error`; kéo trục/thêm trục bằng chuột thật (chưa đo); Esc trong ngữ cảnh màn này (chưa đo, có thể không có gì để đóng); viewer (chưa đo); tự lưu trên trình duyệt (chưa đo). Phần còn lại: 27 bài đơn vị.

---


<!-- ===== V7 ===== -->

## Nhóm V7

Nguồn: `HOP-DONG.md`, `HOP-DONG-BO-SUNG.md`, `ghi-chu-V7.md` (nguồn sự thật), `probe-35-routes.json`, `don-vi-theo-man.md`. Tôi đọc thêm `muc-V6.md` và `questions.md` (Q1) để dùng cùng quy ước với nhóm QC-a, và đọc `RoomLabelActionDialogs.tsx`/`RoomLabelInspector.tsx` (xem PHÁT HIỆN/ghi chú thiếu — ghi chú V7 bỏ sót A9 của phòng).
Không đo lại gì. "chưa đo" trong ghi chú V7 giữ nguyên "chưa đo" ở đây. Nhãn chép từ ghi chú V7 kèm `file:dòng`; không có thì "NOT FOUND".
Mã ca dạng `V7-<BỀ MẶT>-<số>`. Không mã test trong tệp này.

## 0. Hình dạng chung — quyết định bởi "cửa nạp-kho"

Cả ba màn đọc đồ thị từ `useStore.getState().spatial` (`roomLabelReviewGateway.ts:436`, `thicknessStandardizationGateway.ts:214`, `floorManagerGateway.ts:1241-1273`) và **không nơi nào nạp nó từ dữ liệu mạng** (ghi chú V7 câu 1). Mở thẳng route:
- `rooms`, `thickness`: **rỗng thật** (`empty`, 0 skeleton; thân 446 / 549 ký tự).
- `floors`: **skeleton mãi** (17 skeleton, không hàng, không "0 tầng") — `isLoading = floorListQuery.isPending || graph === null` (`useFloorManager.ts:570`).

Mọi ca cần nội dung/sửa/A8 đi qua cửa `await import('/src/store/index.ts')` + `setSpatial` (V6, `questions.md` Q1 — **người dùng chưa quyết**). Quy ước như `muc-V6.md`: ca có dấu **†** = *đi qua cửa nạp-kho (chỉ bản dev, không chứng minh tải từ máy chủ)*; nếu Q1 = B thì mọi ca † bị gỡ, phần còn lại (không †) vẫn sống. Bài † phải mở đầu bằng dòng nói rõ nó tiêm dữ liệu. Tiêm **sau** `goto` (tải lại xoá kho), điều hướng trong app. `setSpatial` tự nó là một bước zundo (`pastStates` = 1 sau tiêm — đo) nên **`Ctrl+Z` thừa sau tiêm xoá luôn `spatial`** (đo ở thickness) — ca nào dùng `Ctrl+Z` phải đếm bước hoặc chỉ `Ctrl+Z` sau một lệnh thật.

**Mã tầng (V6 F2):** `rooms` cần `:floorId` = mã `Level` của đồ thị (`RoomLabelReview.container.tsx:189` đặt `levelId = floorId`) — bộ mẫu dùng `L-000001LVL0`; `thickness` đo với `L-000001TFL1` (`L1` khi có dữ liệu: **chưa đo**); `floors` không có `:floorId`. `L1` cho `rooms` sau tiêm = "0 phòng" (V6): dùng đúng mã.

**Vai/cờ/lớp chung:** mở không đăng nhập → vai `engineer` (HOP-DONG §1.2). `viewer` trên trình duyệt cho cả ba: **chưa đo**. Không tour/dialog tự mở (`dialogs: []`). Không cờ nào cần bật.

**A7 của cả nhóm (ghi một lần):** không cờ `persist…` nào `true` (`persistRoomLabels` false `roomLabelReviewGateway.ts:445`; `persistThicknessStandardization` false `thicknessStandardizationGateway.ts:221`; `persistFloorContents` false `floorManagerGateway.ts:1257`; `hideFloorFrom3d` false `:1258`). Hai màn `rooms`/`thickness` dựng `createAutosave` (`useRoomLabelReview.ts:602`, `useThicknessStandardization.ts:534`) và gọi `notifyChange()` nhưng không đi qua `useSaveIndicator`/`SaveIndicator` và **không nói gì về lưu** (đo: không chữ "lưu" ở thickness; ở rooms sau đổi tên). ⇒ **"A7 chưa có ở rooms và thickness"**: đó là phát hiện, **không viết ca**. `floors` nói thật bằng hai câu nợ `role="status"` (ghim hiện trạng, không phải bài đạt A7).

---

## 1. projectRooms — Duyệt tên phòng · `ROUTE_PATTERNS.projectRooms`

1. **Kiểu:** có route (`router.tsx:328`).
2. **Đường tới:** `/projects/project-1/floors/{levelId}/layers/rooms`, `{levelId}` = `L-000001LVL0` cho bộ mẫu. Dựng từ `ROUTE_PATTERNS.projectRooms`, không viết chuỗi tay.
3. **Tiền đề:** vai `engineer` mặc định; không cờ; không lớp. Ca có nội dung: cửa nạp-kho † (mục 0), nạp bộ mẫu riêng của màn (`ROOM_LABEL_FIXTURE_ROOMS`, `roomLabelFixture.ts:143`). Ca `empty`: không cần cửa.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người duyệt **đặt sai/đánh mất tên phòng** (đổi tên không hoàn tác được, gộp/tách phòng không hỏi) — tên phòng đi vào mô hình xuất ra. Riêng nhánh không cửa: đỏ ⇒ người dùng gặp màn trắng hoặc lời nói dối thay vì "chưa dò ra phòng nào".
5. **Đã kiểm ở tầng đơn vị** (30 bài / 2 tệp — trung bình): `RoomLabelReview.test.tsx` + `useRoomLabelReview.test.ts`: bảy trạng thái (`:209-243`, `:508`); **diện tích 248,60 / 18,40 hiện đúng** (`:245,266`, `useRoomLabelReview.test.ts:285`); tương phản chữ nhãn; **xem trước "Chuẩn hoá tên" không đổi tên nào** (`:408`, `:330`); **áp xong có vé hoàn tác và hoàn tác trả tên cũ** (`useRoomLabelReview.test.ts:369`); đổi tên không tính lại diện tích (`:302`); nhắc công năng M-14 (`:425`); vòng hở kèm kích thước, "sang lớp tường" (`:471-506`); vai Người xem (`:536`); sáu trường thanh tra (`:555`); chip "Chưa đặt tên" (`:584`). **Lỗ hổng thấy được từ tên bài:** không bài nào chạy luồng *mở hộp thoại gộp/tách → Huỷ/xác nhận* (chỉ có `mergeCandidatesOf` thuần `:257`, `:573`, `splitPointMm` `:575`). e2e không lặp bất cứ ca nào ở trên.
6. **Ca luồng chính:**
   - **V7-ROOMS-01 (không cửa, `empty` thật):** `goto` route → khẳng định `getByRole('region',{name:'duyệt tên phòng'})`, chữ "chưa dò ra phòng nào", nút `Kiểm tra lại vòng hở`; 0 skeleton; **không** màn trắng. Đo: 446 ký tự, 0 skeleton. Đây là ca rẻ, đúng đường người dùng.
   - **V7-ROOMS-02 † (nội dung):** tiêm → 14 `option` trong `getByRole('listbox',{name:'Danh sách phòng'})`; chữ `Tổng diện tích sàn 248,60 m² · 14 phòng`; ba phòng "chưa đặt tên". (Số 248,60: xem Q1 — khẳng định định dạng hay giá trị.)
   - **V7-ROOMS-03 † (A8, đo rồi):** chọn phòng (ví dụ `#R-001`) → `getByRole('textbox',{name:'Tên phòng'})` `fill('Phòng thử e2e')` + `Enter` → trong 600 ms thấy `role="status"` mang chữ *`Đổi tên phòng R-000001ROOM từ "phòng khách chung" thành "Phòng thử e2e", diện tích 17,00 m².`* kèm nút `Hoàn tác` → bấm nó → tên về `phòng khách chung`.
   - **V7-ROOMS-04 † (A12 `Ctrl+Z` ngoài ô nhập):** như 03 nhưng thay bước bấm bằng `blur()` ô nhập rồi `Ctrl+Z` → tên về cũ (đo: có hoàn tác sau `blur`). Xem Q2 cho cận cảnh "trong ô nhập".
   - **V7-ROOMS-05 † (A9 — ca mới, CẦN ĐO TRƯỚC KHI VIẾT):** chọn phòng → bấm `Gộp phòng` → `role="dialog"` hỏi *"Gộp hai phòng"* ("Phòng … và phòng được chọn sẽ thành một phòng. Ranh giữa hai phòng biến mất và một trong hai mã phòng không còn nữa.") → **`Huỷ`** ⇒ số `option` giữ nguyên (14) và không toast; → mở lại, chọn `Phòng sẽ gộp vào` → **`Gộp hai phòng`** ⇒ số `option` còn 13. Cách quan sát "không gì đổi" khi huỷ: **đếm `option` + không có `role="status"` toast + `pastStates` không tăng** (đọc qua cửa †). Tách phòng tương tự (`Tách phòng` → xác nhận sinh phòng mới ⇒ 15). **Chưa đo** trên trình duyệt: nút `Gộp hai phòng` `disabled` đến khi chọn phòng (`RoomLabelActionDialogs.tsx`), hành vi thực sau xác nhận (có toast/hoàn tác hay không), và `Tách phòng` cần `splitPointMm ≠ null` (đơn vị: `null` ở bộ mẫu `:575` ⇒ có thể **không mở được** ở bộ mẫu). Ghi "chưa đo", không khẳng định số 13/15.
7. **Ca bảy trạng thái:** `empty` — e2e không cửa (V7-ROOMS-01). `success` — e2e † (02). `error` (nút `Thử lại`, `RoomLabelReview.tsx:84`): dựng được bằng `page.route` chặn `apiClient.spatial.readFloor` (mock API, `roomLabelReviewGateway.ts:448`) — kết quả **chưa đo** ⇒ không lập ca. `forbidden` (viewer): **chưa đo**; đơn vị (`:536`). `loading` (thoáng), `partial`, `collapsed`: thuộc tầng đơn vị. Hai chip vòng hở ("Vòng tường hở", `Xem tại lớp tường`): đơn vị.
8. **Ca bàn phím (A12):** (a) `Ctrl+Z` ngoài ô nhập hoàn tác đúng (04, đo). (b) **Trong ô nhập, `Ctrl+Z` không hoàn tác** (đo) — hành vi ghi thành phát hiện F-R3; ca chỉ được lập theo đáp án Q2. (c) `Esc` trong hộp thoại gộp/tách: hộp thoại là `Modal.Root` (`RoomLabelActionDialogs.tsx`, chú thích đầu file nói Esc đóng qua `useShortcut` phạm vi `dialog`); hook **không** tự đăng ký phím (grep `useRoomLabelReview.ts`: không `useShortcut`/`Escape`/`Mod+Z`). Esc đóng đúng hộp thoại hay rơi xuống `closeTopLayer` toàn cục: **chưa đo**. (d) Tab đi hết luồng chọn → sửa tên: **chưa đo**.
9. **Ca tự lưu (A7):** **A7 chưa có ở màn này.** Bằng chứng: không cờ `persistRoomLabels` (false, `roomLabelReviewGateway.ts:445`); màn không nhập `useSaveIndicator`/`SaveIndicator`; sau đổi tên không có chữ nào chứa "lưu" (đo). Không lập ca. Nút `Ctrl+S` → `flushAutosaves` có chạm bộ tự lưu của rooms hay không: **chưa đo**. Không có nút lưu (probe `saveButtons: []`) — nửa đầu của A7 nằm trong ca quét toàn cục.
10. **Ca hoàn tác (A8/A9):** A8 — V7-ROOMS-03/04 (mốc neo cụ thể: `page.getByLabel('Thông báo').getByRole('button',{name:'Hoàn tác'})`; `Toast.tsx:130` nút, `:233`/`NotificationHost.tsx:50` vùng). Hai lần đổi tên liên tiếp cho toast thứ hai kèm chữ "Hoàn tác 2 thay đổi" (đo) — không lập ca (chi tiết đơn vị/toast chung). A9 — V7-ROOMS-05 (chưa đo). Chuẩn hoá tên: xem trước → `Áp dụng` có vé hoàn tác (đơn vị `:369`), e2e **chưa đo**.
11. **Ca định dạng (A6/A15):** A15 — chữ hiện `248,60 m²`, `18,40 m²`, `17,00 m²` dùng dấu phẩy (đo, ba số); quét `\d\.\d{2}\b` trên vùng `listbox` + tổng phải rỗng (nhớ: `4.000 mm` kiểu phân nhóm nghìn không thuộc màn này). A6 — nhãn viết thường ("duyệt tên phòng", "Danh sách phòng" hoa đầu, "Chưa đặt tên" hoa đầu, "Tên phòng" hoa đầu…): **hoa đầu câu ở nhiều nhãn ⇒ cùng câu hỏi Q2 của `muc-V6.md`** (chuẩn A6). Tên phòng dữ liệu ("PHÒNG NGỦ 1") là **dữ liệu**, không phải nhãn giao diện. **F-R1:** toast lộ mã máy `R-000001ROOM` trong khi danh sách gọi phòng đó `#R-001` (`roomFloorCommands.ts:230`) — ghi nhận, không đếm ca.
12. **Mốc neo** (chữ + nguồn từ ghi chú V7):
    - `getByRole('region',{name:'duyệt tên phòng'})` — `RoomLabelReview.tsx:77,237-239`
    - Khung xem: nhãn `'Khung xem bản vẽ duyệt tên phòng'` — `RoomLabelReview.tsx:80,251` (**loại role: chưa đo**, ghi chú V7 ghi dấu hỏi); canvas nhãn `'Mặt bằng duyệt tên phòng'` (`RoomLabelCanvas.tsx:153-163,190`) — hằng chưa mở ⇒ **NOT FOUND** nhãn cố định trong nguồn; chữ đo được từ trình duyệt.
    - `getByRole('listbox',{name:'Danh sách phòng'})` — `RoomLabelList.tsx:35,146`; hàng `role="option"` tên dạng `"#R-005 · PHÒNG NGỦ 1 · 18,40 m² · AI đề xuất, chưa duyệt"` — `:70,92`
    - `getByRole('textbox',{name:'Tên phòng'})` — `RoomLabelNameField.tsx:33` (**không** `getByLabel('Tên phòng')`: khớp 6 phần tử, đo)
    - Nút: `'Chuẩn hoá tên'` (`RoomLabelLeftPanel.tsx:50`), `'Kiểm tra lại vòng hở'`, `'Xem tại lớp tường'` (`:48-49,115`), `'Duyệt phòng này'`, `'Gộp phòng'`, `'Tách phòng'` (`RoomLabelInspector.tsx:83-88`), chip `'Chưa đặt tên'` (`RoomLabelLeftPanel.tsx:44`)
    - Hộp thoại: tiêu đề `'Gộp hai phòng'`, `'Tách phòng'`, chọn `'Phòng sẽ gộp vào'`, `'Huỷ'` — `RoomLabelActionDialogs.tsx:26,30` (chép thêm từ tôi đọc: `MERGE_TITLE`/`MERGE_SELECT_LABEL`/`CANCEL_LABEL`); xem trước chuẩn hoá `'Huỷ'`, `'Đóng'`, `'Áp dụng'` — `RoomLabelNormalizePreview.tsx:41-43`
    - Toast: `page.getByLabel('Thông báo').getByRole('button',{name:'Hoàn tác'})`
    - Không `data-testid` (probe `testids: []`); không cần.
13. **KHÔNG kiểm được:** (a) nội dung/sửa/hoàn tác mà **không** cửa nạp-kho — không có đường đọc thật (Q1 điều phối; điều kiện mở cổng: đường đọc `spatial.layer` thật hoặc route nhận `gateway`). (b) A7 — không có gì để chứng minh. (c) Ghi vào máy chủ — `persistRoomLabels` false. (d) `viewer`, `error`, Esc trong hộp thoại, Tab, `Áp dụng` chuẩn hoá — **chưa đo**. (e) Rooms với `createSampleBuilding()` — chưa đo (màn dùng bộ mẫu riêng, xem Q1). (f) Nguồn lỗi console 404 của rooms: URL **chưa đo** (không bắt được bằng `response`/`requestfailed`). Người chứng minh: đơn vị (nội dung logic, chuẩn hoá, vai); còn lại chờ Q1 hoặc đo ở chặng 0.

---

## 2. projectFloors — Quản lý tầng · `ROUTE_PATTERNS.projectFloors`

1. **Kiểu:** có route.
2. **Đường tới:** `/projects/project-1/floors` (không có `:floorId`), dựng từ `ROUTE_PATTERNS.projectFloors`.
3. **Tiền đề:** `engineer`; không cờ; không lớp. Nội dung hàng cần cửa † với `createFloorManagerSampleGraph()`.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không thấy/không quản lý được tầng** (thêm/sửa/xoá/sắp thứ tự) — tầng là khung của mọi màn khác; và nếu hai câu nợ mất đi, họ **tưởng tầng đã lưu trong khi nó mất khi tải lại**. Hôm nay: đỏ đã xảy ra theo nghĩa loading mãi (F-R2).
5. **Đã kiểm ở tầng đơn vị** (48 bài / 2 tệp — dày): `FloorManager.test.tsx` + `useFloorManager.test.ts`: bảy trạng thái (`FloorManager.test.tsx:210-263`); **đổi chiều cao kéo cao độ tầng trên = một bước lịch sử, một `Ctrl+Z`** (`useFloorManager.test.ts:218-282`, `FloorManager.test.tsx:282`); chặn trùng cao độ (`:283-398`); **xoá tầng ngay, không hộp thoại, vé hoàn tác 8 giây, hoàn tác trả nội dung** (`:398-459`, `FloorManager.test.tsx:388`); nhân bản có/không nội thất (`:459-530`); lát cắt tỷ lệ 3,0/3,9/3,6/3,6 (`:532-582`); **hai khoản nợ hiện ra** (`:620-650`); lỗi + `Thử lại`; rỗng. e2e không lặp.
6. **Ca luồng chính:**
   - **V7-FLOORS-01 (không cửa, A7 nói thật):** `goto` route → `getByRole('region',{name:'quản lý tầng'})` có mặt; **hai** `role="status"` mang đúng hai câu nợ (chữ ở mục 12) và tiêu đề nhóm *"những thay đổi chỉ sống trong phiên làm việc này"*. Đo: có mặt cả khi skeleton. **Không** khẳng định số skeleton/không-hàng (xem Q3).
   - **V7-FLOORS-02 † (nội dung + A15):** tiêm → bốn hàng tầng (Tầng hầm 3,0 m · Tầng trệt 3,9 m · Tầng 2 3,6 m · Tầng mái 3,6 m), tổng cao **14,1 m**; 0 skeleton (đo). Khẳng định hàng `Tầng trệt` qua tên truy cập *"Tầng trệt, cao độ 0,0 m, cao 3,9 m, 0% đã kiểm"* (`FloorTableRow.tsx:173`).
   - **V7-FLOORS-03 † (ghi thật, A8 — CẦN ĐO TRƯỚC KHI VIẾT):** thêm/xoá/nhân bản/đổi thứ tự đi qua `api.floors.*`/`api.spatial.patchFloor` của mock (`floorManagerGateway.ts:1248-1290`, `createFloor/deleteFloor/reorderFloors/patchFloor/duplicateFloor` đều `true`). **Chưa đo** trong trình duyệt, kể cả toast/`Hoàn tác`. Không lập ca cho tới khi đo.
7. **Ca bảy trạng thái:** `success` — e2e † (02). `loading`: hôm nay **không thoát** ở sản phẩm thật (đo: 17 skeleton mãi) — ca ghim đó là câu hỏi Q3. `empty`/`error`/`forbidden`(viewer chưa đo)/`partial`/`collapsed`: đơn vị (dày).
8. **Ca bàn phím (A12):** màn chỉ đăng ký `Mod+Z` phạm vi `canvas` (`useFloorManager.ts:1440-1441`); **không** đăng ký `Escape` ⇒ rơi xuống toàn cục — kết quả đo **chưa đo**. `Ctrl+Z` hoàn tác chiều cao: đơn vị; e2e trên trình duyệt thật **chưa đo**. Tab qua các ô sửa (`Tên tầng …`, `Cao độ tầng …`, `Chiều cao tầng …`): **chưa đo**. ⇒ ô A12 `chưa phủ`.
9. **Ca tự lưu (A7):** không có tự lưu; màn nói thật bằng hai câu nợ `role="status"` (V7-FLOORS-01) — **ghim hiện trạng, KHÔNG phải bài đạt A7** (không "800 ms", không "đã lưu"). Cờ `persistFloorContents`/`hideFloorFrom3d` = false. Ca này là chỗ duy nhất trong nhóm khẳng định được *không được nói sai* mà không cần cửa.
10. **Ca hoàn tác (A8/A9):** A8 — xoá tầng: đơn vị chứng minh (vé 8 s, `useFloorManager.test.ts:398-459`); e2e (V7-FLOORS-03) **chưa đo**. A9 — không hộp thoại (xoá ngay theo thiết kế A8/D-05) ⇒ không áp dụng.
11. **Ca định dạng (A6/A15):** A15 — `3,9 m`, `3,6 m`, `14,1 m` dấu phẩy sau tiêm (đo). Cảnh báo: `0,0 m` (cao độ) và `cao độ … mm` kiểu khác nhau có thể xuất hiện ở màn khác (V4 ghi "cao độ 0 mm" ở upload) — trong màn này chỉ ghi số đã đo. A6 — nhãn floors viết thường ("quản lý tầng", "thu gọn lát cắt", "những thay đổi chỉ sống trong phiên làm việc này") nhưng `Thêm tầng`, `Nhân bản tầng`, `Thang cao độ`, `Thử lại` hoa đầu: cùng Q2 của `muc-V6.md`.
12. **Mốc neo:**
    - `getByRole('region',{name:'quản lý tầng'})` — `FloorManager.tsx:63,88`
    - Hai câu nợ (`role="status"`, **không cần cửa**): *"nội dung tầng (tường, phòng, nội thất) mới chỉ đổi trong phiên làm việc này; hệ thống chưa có chỗ lưu nó nên nó mất sau khi tải lại trang."* — `floorManagerGateway.ts:210`; *"ẩn tầng khỏi mô hình 3d chỉ có hiệu lực trong phiên làm việc này; hệ thống chưa có chỗ lưu lựa chọn đó nên nó mất sau khi tải lại trang."* — `:212`. Tiêu đề nhóm `'những thay đổi chỉ sống trong phiên làm việc này'` — `FloorManager.tsx:68`; `InlineAlert … role="status"` — `:100,112`. (Chữ "3d" viết thường trong câu nợ thứ hai — ghi nhận, "3D" là ký hiệu; không kết luận.)
    - Lát cắt: nhãn `'Lát cắt các tầng theo đúng tỷ lệ chiều cao'`; nút `'thu gọn lát cắt'`; `'Thang cao độ'` — `FloorSectionCut.tsx:41,43,45`
    - `getByRole('button',{name:'Thêm tầng'})` — `FloorTable.tsx:68`; `'Nhân bản tầng'`, `'tự động tính cao độ'`, `'Thử lại'` — `:69-72`
    - Hàng: tên truy cập *"Tầng trệt, cao độ 0,0 m, cao 3,9 m, 0% đã kiểm"* — `FloorTableRow.tsx:173` (**loại role: chưa đo**)
    - Ô sửa/nút hàng: `'Đổi thứ tự tầng Tầng hầm'` `:207`, `'Tên tầng Tầng hầm'` `:226`, `'Cao độ tầng Tầng hầm'` `:252`, `'Chiều cao tầng Tầng hầm'` `:269`, `'Thao tác khác cho tầng Tầng hầm'` `:335`, `'tải lên'` `:54`, `'nhân bản'` `:56`
    - Không `data-testid`.
13. **KHÔNG kiểm được:** (a) nội dung hàng, A15, sửa/xoá/nhân bản mà không cửa — `graph === null` giữ loading (`useFloorManager.ts:570`; `loadedGraph` `:555-562`; `graph.read()` = kho rỗng `floorManagerGateway.ts:1241-1243`); "đường không vòng tròn" của floors chỉ có một nửa (danh sách tầng của mock API đã tải nhưng không dùng để vẽ hàng). (b) A7 — không tự lưu, không có gì để chứng minh ngoài ghim hiện trạng. (c) Ghi thật/A8 trên trình duyệt, Esc, Tab, viewer — **chưa đo**. Người chứng minh: đơn vị (48 bài) cho logic; e2e chờ Q1/điều kiện mở cổng.

---

## 3. projectThickness — Chuẩn hoá độ dày tường · `ROUTE_PATTERNS.projectThickness`

1. **Kiểu:** có route (`router.tsx:330`).
2. **Đường tới:** `/projects/project-1/floors/{floorId}/layers/thickness`, đo với `L-000001TFL1` (bộ mẫu có `L-000001TFL1/2/3`). `L1` khi có dữ liệu: **chưa đo**.
3. **Tiền đề:** `engineer`; không cờ; không lớp tự mở. Nội dung: cửa † nạp `THICKNESS_FIXTURE_GRAPH` (`thicknessStandardizationGateway.ts:259`). `empty`: không cần cửa.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì độ dày tường **bị chuẩn hoá sai hàng loạt** (một lệnh áp cho 30 tường) mà người duyệt không hoàn tác được/không kịp xem trước — độ dày quyết định khối lượng và mô hình. Riêng nhánh không cửa: đỏ ⇒ bốn thẻ đếm nói dối "0 tổng số đoạn tường" khi có tường.
5. **Đã kiểm ở tầng đơn vị** (35 bài / 2 tệp): `ThicknessStandardization.test.tsx` + `useThicknessStandardization.test.ts`: bảy trạng thái; **tích ba nhóm → xem trước → áp = MỘT bước hoàn tác, rồi `Hoàn tác` trả nguyên trạng** (`ThicknessStandardization.test.tsx:325`, `useThicknessStandardization.test.ts:431`); **kéo ngưỡng năm lần = không bước lịch sử, cả bằng bàn phím** (`:397-450`, `:359`); **cảnh báo áp dụng lại nêu đúng số tường đã duyệt, `Huỷ` = phím `Escape`** (`:464-536`, `:576-668`); gán nhóm ở ngưỡng mặc định (`:238-330`); vai Người xem (`:735`); không hàng nhóm nào tích sẵn (`:331`). e2e không lặp.
6. **Ca luồng chính:**
   - **V7-THICK-01 (không cửa, `empty` thật):** `goto` → `getByRole('region',{name:'chuẩn hoá độ dày tường'})`; bốn `role="status"` đọc `0 tổng số đoạn tường` · `0 đã ở đúng nhóm chuẩn` · `0 lệch quá dung sai` · `0 cột bê tông cốt thép` (đo); chữ "chưa có đoạn tường nào để chuẩn hoá". 0 skeleton.
   - **V7-THICK-02 † (nội dung + A15):** tiêm → `48 tổng số đoạn tường` · `3 đã ở đúng nhóm chuẩn` · `6 lệch quá dung sai` · `3 cột bê tông cốt thép`; bảng nhóm "195 mm → 30 tường"; chi tiết hàng `Độ tin cậy AI: 0,77` (dấu phẩy, đo).
   - **V7-THICK-03 † (A12 — Esc đóng đúng lớp xem trước, đã đo):** bấm `getByRole('button',{name:'Xem trước',exact:true})` (**`exact:true` bắt buộc** — "Thu gọn khung xem trước" chứa cụm này; đo: lỗi strict mode) → thấy `Huỷ`/`Áp dụng` → `Escape` → hai nút biến mất. Xác nhận *đúng một lớp*: sau Escape trang vẫn ở cùng URL và tóm tắt vẫn 48 đoạn.
   - **V7-THICK-04 † (kéo slider bằng phím thật — CẦN ĐO TRƯỚC KHI VIẾT):** ba `role="slider"` (`ngưỡng giữa 110 mm và 220 mm`, …). Đơn vị đã phủ bàn phím trên jsdom; e2e chỉ đáng đi nếu trình duyệt thật cho khác (focus/`aria-valuenow` cập nhật). **Chưa đo** ⇒ không lập.
   - **V7-THICK-05 (luồng Áp dụng — CẦN ĐIỀU TRA TRƯỚC KHI VIẾT):** đo: sau `check({force:true})` ô "Đồng ý chuẩn hoá 30 tường 195 mm về 220 mm", bấm `Xem trước` rồi `Áp dụng`, độ dày (19 giá trị) **không đổi** và **không toast**; `.click()` ô đồng ý **hết 5 s**. Chưa rõ vì ô không nhận hay `Áp dụng` bị khoá: **chưa đo**. Không lập ca; xem PHÁT HIỆN F-T2 nếu điều tra ra là lỗi sản phẩm.
7. **Ca bảy trạng thái:** `empty` — e2e không cửa (01). `success` — e2e † (02). `forbidden` (viewer): **chưa đo**; đơn vị `:735`. `error`, `loading`, `partial`, `collapsed`: đơn vị.
8. **Ca bàn phím (A12):** Esc đóng xem trước — **đo, e2e** (03). Cơ chế: `thicknessStandardization.closeTopLayer`, `scope:'canvas'` (`useThicknessStandardization.ts:828-846`), `enabled: hasTopLayer` — đóng bản xem trước trước, rồi mới bỏ cảnh báo áp dụng lại. **Khi không có lớp nào phím rơi xuống toàn cục — chưa đo.** Slider bằng phím thật: chưa đo. Tab: chưa đo.
9. **Ca tự lưu (A7):** **A7 chưa có ở màn này.** Bốn `role="status"` **không phải vùng tự lưu** — là bốn thẻ đếm `<p role="status">{value} {label}</p>` (`ThicknessSummary.tsx:54`, `SummaryStat` `:40`, `stats.map` `:74`, nhóm `role="group"` `'Tóm tắt chuẩn hoá độ dày tường'` `:31,72`); màn không nhập `useAutosave`/`useSaveIndicator`/`SaveIndicator`; `persistThicknessStandardization` false (`thicknessStandardizationGateway.ts:221`); đo: không chữ "lưu" nào (`luu: []`). Không lập ca. `createAutosave` gọi `notifyChange()` (`:555-594`) nhưng ném vì `supported:false` (`:~541-552`, chú thích "không hiện 'Đã lưu lúc…' cho một lượt chưa hề rời khỏi máy") — im lặng khác nói sai; ghi nhận. `Ctrl+S` chạm bộ tự lưu: **chưa đo**.
10. **Ca hoàn tác (A8/A9):** A8 — nút chân `Hoàn tác` (`ThicknessApplyBar.tsx:53-62`); đơn vị chứng minh áp = một bước; e2e **chưa đo được** (05). A9 — cảnh báo áp lại: nút `Loại tường đã duyệt ra rồi áp lại` và `Vẫn áp dụng cho tất cả`; **đơn vị** (`:464-536`); e2e không lặp. `Ctrl+Z` sau tiêm: bẫy — trả `spatial` về `null` (đo) nên **không** dùng `Ctrl+Z` làm bước hoàn tác trong ca nào chưa có lệnh.
11. **Ca định dạng (A6/A15):** A15 — `0,77` (đo); số nguyên `48/3/6/3` không thập phân; `195 mm`, `19 giá trị`. Quét `\d\.\d{1,2}(?!\d)` trong bảng chi tiết. A6 — nhãn ("biểu đồ phân bố độ dày tường theo mi-li-mét", "Phân bố độ dày đo được", "Dung sai", "Áp dụng lại bộ lọc"…) trộn thường/hoa đầu: cùng Q2 của `muc-V6.md`.
12. **Mốc neo:**
    - `getByRole('region',{name:'chuẩn hoá độ dày tường'})` — `ThicknessStandardization.tsx:102,281-283`
    - Bốn thẻ đếm: `getByRole('status')` (trả bốn phần tử; phân biệt bằng chữ, **không có nhãn riêng** — NOT FOUND nhãn từng vùng) — `ThicknessSummary.tsx:54`; nhãn gốc `'tổng số đoạn tường'` `thicknessTypes.ts:286`, `'đã ở đúng nhóm chuẩn'` `:287`, `'lệch quá dung sai'` `:288`, `'cột bê tông cốt thép'` `:289`
    - Nhóm: `getByRole('group',{name:'Tóm tắt chuẩn hoá độ dày tường'})` — `ThicknessSummary.tsx:31,72`
    - Biểu đồ: `'biểu đồ phân bố độ dày tường theo mi-li-mét'`; ba `role="slider"`: `'ngưỡng giữa 110 mm và 220 mm'`, `'ngưỡng giữa 220 mm và 330 mm'`, `'ngưỡng giữa 330 mm và cột bê tông cốt thép'` — `ThicknessHistogram.tsx:73,340-342`
    - Mục: `'Phân bố độ dày đo được'`, `'Bảng nhóm và bảng chi tiết từng đoạn'` — `ThicknessStandardization.tsx:105-106,301,318`
    - Ô đồng ý: `getByRole('checkbox',{name:'Đồng ý chuẩn hoá 30 tường 195 mm về 220 mm'})` — `ThicknessGroupTable.tsx:74` (nhãn theo hàm `acceptCheckboxLabel`; `.click()` hết 5 s — 05)
    - Chân: `'Dung sai'`, `'Áp dụng lại bộ lọc'`, `'Hoàn tác'`, `'Xem trước'` (**exact**), `'Huỷ'`, `'Áp dụng'`, `'Loại tường đã duyệt ra rồi áp lại'`, `'Vẫn áp dụng cho tất cả'` — `ThicknessApplyBar.tsx:53-62`
    - Xem trước: `'mặt bằng xem trước theo nhóm độ dày'`, `'chú giải độ dày tường'`, `'Thu gọn khung xem trước'` — `ThicknessPreviewCanvas.tsx:65-66`; `ThicknessStandardization.tsx:110`
    - Chi tiết: `'Chọn nhóm áp cho các đoạn đã chọn'`, `'Chọn dòng W-000032THIK'`, `'Độ dày chuẩn hoá của đoạn #W-032'`, `'Độ tin cậy AI: 0,77'` — `ThicknessSegmentTable.tsx:61,195`; đo. (Ghi nhận: `'Chọn dòng W-000032THIK'` lộ mã máy, cùng họ F-R1.)
    - Không `data-testid`.
13. **KHÔNG kiểm được:** (a) nội dung/Áp dụng/A8 không cửa — kho rỗng. (b) **Luồng Áp dụng hôm nay không chứng minh được** (05): ô đồng ý không nhận `.click()`, độ dày và toast không đổi — nguyên nhân chưa đo. (c) A7 — không có. (d) Ghi máy chủ — `persistThicknessStandardization` false. (e) `viewer`, slider bằng phím thật, Tab, Esc khi không có lớp, thickness với `L1` — **chưa đo**. Người chứng minh: đơn vị (35 bài) cho Áp dụng/Hoàn tác/cảnh báo áp lại.

---


<!-- ===== V8 ===== -->

## Nhóm V8

Nguồn: `HOP-DONG.md` → `HOP-DONG-BO-SUNG.md` → `ghi-chu-V8.md` (sự thật lớp 1), thêm `don-vi-theo-man.md`,
`probe-35-routes.json`, thân `e2e/viewer3d.spec.ts` (tôi đã đọc đủ 672 dòng). Không sửa repo, không viết test.

Quy ước: **"V8"** = chép từ `ghi-chu-V8.md`; **"đo lớp 2"** = tôi tự mở trình duyệt để xác minh một nhãn/số còn ngờ
(ghi rõ từng chỗ); **"chưa đo"** = đúng nghĩa, mục này không suy ra. `file:dòng` tính từ `src/screens/viewer/` trừ khi ghi khác.
Bảng coverage-map: `e2e` = mục này có ca e2e (đã có trong `viewer3d.spec.ts` hoặc đề xuất ở đây); không có nghĩa "đã xanh" — tôi không chạy e2e.

---

## 0. PHẦN DÙNG CHUNG (các mục dưới chỉ trỏ về đây)

### 0.1 Tiền đề chung cho mọi ca trên `projectViewer`

- URL dựng từ `ROUTE_PATTERNS.projectViewer` (`src/routes/paths.ts:107`) = `/projects/:projectId/3d`; spec hiện có dùng `P-01`
  (`viewer3d.spec.ts:113-116`). Vỏ đọc bộ mẫu chứ không đọc mã dự án.
- Vai `engineer` có sẵn, không cần đăng nhập (HOP-DONG 1.2). Vai `viewer`: đăng nhập qua `?next=` bằng đúng khuôn
  `signInThenOpenViewer` (`viewer3d.spec.ts:185-207`) — **chép, không phát minh**.
- **Chờ dựng xong bằng khẳng định**: `getByRole('status').filter({ hasText: 'Đang dựng mô hình' })` `toHaveCount(0)`
  (`viewer3d.spec.ts:285-290`); "xong" cũng là `getByText('Mô hình đã dựng xong.')` — nút `sr-only`
  (`Viewer3D.tsx:254`), dùng `state:'attached'`, không `visible` (V8 2.1a). Lớp "đang dựng" nuốt cú bấm (V8 mục 4.1, đo bằng rAF).
- **Tour (`EditorTour`) — fixture "bỏ qua tour" là CẦN** (BO-SUNG 7.7, V8 P1). Đóng bằng nút của người dùng:
  `getByRole('button', { name: 'bỏ qua', exact: true })` (`system/EditorTour/EditorTour.tsx:294,340,343`), **KHÔNG** bằng cờ/
  `localStorage`. Mốc neo của tour **không phải `role="dialog"`** (`EditorTour.tsx:15`); lớp phủ nhận diện bằng
  `div.pointer-events-auto.fixed.bg-bg-overlay` (spec hiện có, `viewer3d.spec.ts:310`). Chip mở lại: `xem hướng dẫn`
  (`EditorTour.tsx:384`). **Cơ chế hiện trễ** đã có ở docblock spec (`viewer3d.spec.ts:249-283`): một bước tour chỉ sống khi có
  phím THẬT *hoặc* neo THẬT (`system/EditorTour/useEditorTour.ts:480-483`); lúc màn vừa mở không có cái nào ⇒ `steps.length===0` ⇒
  không dựng lớp phủ; mở ô tìm/panel thì neo xuất hiện ⇒ bước sống lại ⇒ tour hiện **trên cái vừa mở**. Hệ quả cho mọi ca:
  **mở thứ cần mở TRƯỚC, đóng tour SAU, rồi mới thao tác** (đúng thứ tự `findOneRoom`, `viewer3d.spec.ts:~500-508`);
  bước đóng tour phải **chờ** (assertion), không `waitForTimeout`; phải gọi lại nhiều lần trong một ca.
  Đo lớp 2 xác nhận: click "Diện tích phòng" ngay sau khi tiêm dữ liệu → `TimeoutError` 8 s (tour chắn); bấm "bỏ qua" rồi bấm lại → panel mở.
- **Ai đóng cửa lớp**: HOP-DONG 1.1 ("0/35 màn có tour") đúng cho lúc tải, không đúng cho luồng (BO-SUNG 7.7). Bề mặt riêng của tour thuộc V2.

### 0.2 Bảng thứ tự `Escape` khi nhiều lớp cùng mở (trả lời câu 3 của nhóm)

**Xác định được từ mã và đo được** (V8 mục 1; không có ca "không xác định"). Luật: `SCOPE_PRIORITY = ['dialog','sidePanel','canvas','global']`
(`src/lib/input/shortcutRegistry.ts:59-64`); trong cùng phạm vi, đăng ký SAU thắng (`:470`); `useShortcut` với `enabled:false`
gỡ hẳn đăng ký và bật lại thì đăng ký lại ở cuối (`src/hooks/useShortcut.ts:106-108`).

| Chủ sở hữu | Phạm vi | Có mặt khi | Nguồn |
|---|---|---|---|
| `viewer3d.panels.close` (cột panel) | sidePanel | có một bảng phụ mở | `Viewer3D/Viewer3DPanels.tsx:186-197` |
| `collaborationLayer.roster.close` | sidePanel | danh sách "Ai đang xem" mở | `system/CollaborationLayer/CollaborationLayer.tsx:252-261` |
| `furnitureLibraryPanel.cancel` | sidePanel | đang kéo **hoặc** hộp xem trước nhóm mở | `FurnitureLibraryPanel/useFurnitureLibraryPanel.ts:246-261` |
| `wallGeometryEditor.escape` | canvas | suốt lúc chế độ sửa hình học bật | `WallGeometryEditor/useWallGeometryEditor.ts:605-611` |
| `viewer.selection.clear` | canvas | chỉ khi **có** đối tượng đang chọn | `ViewerShell/viewerShellShortcuts.ts:201-214` |
| tour `TOUR_SKIP_SHORTCUT_ID` | canvas | tour đang hiện | `system/EditorTour/useEditorTour.ts:575-590` |
| ô chữ của ô tìm (không qua sổ) | `onKeyDown` React | ô tìm mở | `Viewer3D/ObjectSearch.tsx:147-154` |
| `global.closeTopLayer` | global | luôn | `src/routes/router.tsx:287` |

**Ba bảng phụ (Diện tích phòng / Thư viện đồ đạc / Lịch sử thao tác) KHÔNG mở đồng thời** — `openPanelId` là giá trị đơn
(`Viewer3D.container.tsx:233`); mở bảng thứ hai thì bảng thứ nhất đóng (V8 đo: Diện tích → Lịch sử ⇒ chỉ `#viewer-3d-panel-history` còn;
tầng đơn vị VP-2). Nên "hai panel chồng" thật là **bảng phụ + lớp khác**. Tám hàng đo (V8; mỗi hàng một context sạch, `Escape` từng cái, 350 ms giữa):

| Dựng | Esc 1 | Esc 2 | Esc 3 |
|---|---|---|---|
| S1 chọn tường → mở Lịch sử → bật "Sửa hình học tường" | bảng phụ | thoát chế độ sửa | bỏ chọn |
| S2 chọn tường → bật sửa → **rồi** mở Diện tích phòng | bảng phụ | thoát chế độ sửa | bỏ chọn |
| S3 chỉ mở Thư viện đồ đạc | bảng phụ | (không đổi gì nhìn thấy; rơi xuống `closeDialog`) | — |
| S4 mở Diện tích phòng → `/` mở ô tìm | ô tìm | bảng phụ | — |
| S5 chọn **phòng** → mở Lịch sử | bảng phụ | bỏ chọn | — |
| S6 chọn phòng (qua ô tìm) khi tour đang hiện | bỏ chọn | tour bỏ qua | — |
| S7 mở Lịch sử → **rồi** mở "Ai đang xem" | danh sách người xem | bảng phụ | — |
| S8 mở "Ai đang xem" → **rồi** mở Lịch sử | bảng phụ | danh sách người xem | — |

S1 và S2 cho cùng kết quả dù thứ tự mở ngược nhau ⇒ giữa `sidePanel` và `canvas` **phạm vi thắng, thời điểm không quan trọng**;
S7/S8 (cùng phạm vi) ⇒ **LIFO theo thời điểm bật**. Không phải lỗi mã (`viewerShellShortcuts.ts:28-34` và `Viewer3DPanels.tsx:32-37` giải thích
cố ý). Có câu hỏi A/B về việc khẳng định thứ tự nào: **CÂU HỎI Q1**. Ca e2e chỉ nên đặt **một** bảng này, ở mục `projectViewer` (ca V-E1…);
sáu panel còn lại chỉ trỏ về đây ở trường 8 — đừng nhân bảng lên bảy lần.

### 0.3 Nhãn dùng lại của đo lớp 2
- Nút bật bảng phụ (đo lớp 2 cùng V8): `getByRole('button', { name: 'Diện tích phòng', exact: true })`, `'Thư viện đồ đạc'`, `'Lịch sử thao tác'`,
  `'Ai đang xem'` (`Viewer3DPanels.tsx:87-89,164`; `Viewer3DOverlays.tsx:96,117`). Landmark chính: `getByRole('main', { name: 'Khung nhìn mô hình' })`
  (spec dùng nó tại `viewer3d.spec.ts:203,534,624`; đo lớp 2 xác nhận `main[aria-label="Khung nhìn mô hình"]` có mặt) — **ghi chú V8 không liệt kê landmark này**.

---

## 1. projectViewer — Khung nhìn 3D (`Viewer3D`) · `ROUTE_PATTERNS.projectViewer`

1. **Kiểu:** có route (`router.tsx:331` → `RouteViewer3D` → `Viewer3DRoute`).
2. **Đường tới:** `page.goto(ROUTE_PATTERNS.projectViewer.replace(':projectId','P-01'))`. Vai viewer: `signInThenOpenViewer(page,['viewer'])`.
3. **Tiền đề:** vai `engineer` (mặc định, không đăng nhập) cho chọn được đối tượng; `viewer` chỉ cho ca `forbidden`. Cờ: không. Lớp phải đóng trước: lớp "đang dựng" (chờ), tour (bỏ qua bằng nút) — xem 0.1.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không xem/quay/chọn được mô hình 3D** — sản phẩm cốt lõi của công cụ; hoặc thấy màn trắng/lớp chắn không tương tác được. Ca nào không cứu được câu này thì bỏ.
5. **Đã kiểm ở tầng đơn vị:** `Viewer3D` 65 bài / 8 tệp (`don-vi-theo-man.md`). Cụ thể (V8 + đọc mã): `Viewer3D.test.tsx` bảy trạng thái (10 chỗ dùng `SEVEN_STATES`) + `expectVietnamese`; `Viewer3DPanels.test.tsx` VP-1…VP-4 (panel thuộc tính không dựng khi chưa chọn; ba bảng phụ bật/tắt; **mở bảng thứ hai thì bảng thứ nhất đóng**; chưa biết tầng thì không có nút thư viện; **Esc đóng bảng phụ và không nuốt Esc khi không bảng nào mở, VP-3**; nút sửa hình học chỉ khi chọn tường); `Viewer3DOverlays.test.tsx` VO-1/VO-2; `ObjectSearch.test.tsx`, `roomSearch.test.ts` (khớp không dấu); `viewer3dScene.test.ts` (ví dụ "R-07: khuôn camera vào một phòng có thật"); `useViewer3DSource.test.ts`, `useViewer3D.preview.test.tsx`. **e2e không lặp** VP-2/VP-3 — chỗ e2e thêm được duy nhất là *thứ tự giữa các phạm vi khác nhau* (0.2). **Và `e2e/viewer3d.spec.ts` (672 dòng, 7 bài) đã phủ** (đọc thân, không chỉ docblock): mở được + không trắng + thanh trạng thái khớp `/[1-9]\d* tầng · [1-9]\d* phòng · [\d.,]+ m²/u` + 4 `option` cao độ (`:530-544`); quay/thu phóng/chọn tầng có đo thời gian (`:546-554`, quay **đo nhưng không khẳng định**, `:97-106`); ViewCube `Trục đo` `aria-pressed` bằng `click()` không `force` (`:556-576`); **A12: Esc đóng đúng một lớp — combobox "Góc nhìn sẵn"** (`:578-596`); tìm phòng không dấu "phong ngu 4" → panel thanh tra chứa "Phòng ngủ 4"+"R-011" (`:598-602`, `findOneRoom`); **R1** bấm chuột chọn được đối tượng vai kỹ sư (`:621-644`); vai chỉ-xem không chọn được, hiện "Chỉ xem" (`:656-672`). ⇒ **ghi chú V8 chỉ nhắc `viewer3d.spec.ts:479` cho ViewCube, chưa đọc thân; thân thật ở `:556`** và cũng đã có bài Esc `:578` mà ghi chú V8 bỏ qua.
6. **Ca luồng chính (chỉ thứ CHƯA phủ):**
   - **V-E1 — thứ tự Esc nhiều lớp** (0.2, hàng S1/S4/S7/S8, không dựng cả tám): chọn tường bằng chuột (vai kỹ sư) → mở "Lịch sử thao tác" → bấm "Sửa hình học tường" → `Escape` ×3, sau **mỗi** lần khẳng định đúng lớp đã đóng (bảng phụ ẩn ⇒ `aria-pressed` của nút sửa còn `true` ⇒ nút đổi về "Sửa hình học tường" ⇒ `inspector` về "Chưa chọn đối tượng"). Thứ tự khẳng định theo **Q1 (A) — PHẠM VI, như đã đo**.
   - **V-T1 — tour chắn cú bấm thứ hai, đóng bằng "bỏ qua"**: mở panel Lịch sử (neo xuất hiện ⇒ tour hiện) → khẳng định lớp phủ `pointer-events-auto` hiện → `Escape`/"bỏ qua" đóng → lớp phủ biến mất → chip `xem hướng dẫn` có mặt. Thuộc bề mặt V2; ở đây chỉ ghi để nhóm 3D không đi vòng nó.
   - **V-A15 — số thập phân dấu phẩy trên vỏ thật** (BO-SUNG mục 3, đã đo): ray tầng `0,00 m · 3,20 m · 6,40 m · 9,60 m` và nhãn thu phóng `112,6%` — khẳng định bằng regex bắt dấu ở **vị trí thập phân** (`/\d,\d{2} m/u`; nhãn thu phóng `/Mức thu phóng \d+,\d%/u`), không bắt mọi dấu chấm.
7. **Ca bảy trạng thái:** `success` — có (mở + không trắng). `forbidden` — có, vai viewer (`:656-672`) + câu "Bạn đang xem ở vai Người xem nên không sửa được hình học trên mô hình 3D." (`Viewer3D.tsx:260-262`, sr-only; đo BO-SUNG 2.1 cũng thấy). `loading` — lớp `role="status"` "Đang dựng mô hình N tầng — P%" (`Viewer3D.tsx:64-77`) **không đưa vào bài đỏ/xanh**: cửa sổ ~0,3–1,1 s, flaky theo thời gian (V8 3.1). `empty`/`error`/`partial`/`collapsed`: **thuộc tầng đơn vị** (`Viewer3D.test.tsx`); `empty` ("Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường.", `Viewer3D.tsx:48`) và `error` ("Thử lại" `:172`, "Xem bản 2D" `:175`) — **chưa đo** bằng `page.route`; điều kiện đo: chặn endpoint lấy từ `src/api/endpoints.ts` (không viết tay), cần một lượt đo riêng.
8. **Ca bàn phím (A12):** ca V-E1 (bảng 0.2 với PHẠM VI đã grep ra, cột 4 ở bảng 0.2). Thêm: `/` mở ô tìm và ô chữ nhận focus ngay (V8 đo); Tab đi hết luồng chính không cần chuột — **chưa đo** (không có dữ kiện thứ tự Tab). `Escape` khi không còn lớp nào: rơi xuống `closeDialog`, không thay đổi nhìn thấy (V8 S3) — khẳng định "màn vẫn còn" như bài `:595`.
9. **Ca tự lưu (A7):** không áp dụng — màn xem, không có dữ liệu người dùng ghi. Chỉ còn ca quét "không có nút lưu" — đã là một ca quét-toàn-bộ (HOP-DONG mục 2), không lặp ở đây.
10. **Ca hoàn tác (A8/A9):** không áp dụng ở bề mặt này; hoàn tác thuộc panel (PropertyInspector, WallGeometryEditor, HistoryPanel).
11. **Ca định dạng (A6/A15):** A15 = V-A15 ở trên. A6: **nhãn `L-01FIXTURE0`…`L-04FIXTURE0` trên bốn nút ray tầng là mã máy, không phải chữ tiếng Việt** — đây là PHÁT HIỆN F1, không phải ca (đừng viết ca bắt nó xanh hay đỏ trước khi người duyệt quyết).
12. **Mốc neo** (V8 2.1a, đã `file:dòng`): `getByRole('main',{name:'Khung nhìn mô hình'})` (spec `:203`); `getByRole('region',{name:'Nội dung mô hình 3D'})` — `Viewer3D.tsx:203-205`; `getByRole('status').filter({hasText:'Đang dựng mô hình'})` — `Viewer3D.tsx:64-76`; `getByText('Mô hình đã dựng xong.')` — `:254`; canvas: `locator('canvas')` (`aria-hidden`, `:214`) — **không role, không testid; là `<canvas>` duy nhất** (HOP-DONG mục 7 cho phép); `getByRole('button',{name:'tìm phòng'})` — `Viewer3D/ObjectSearch.tsx:58,180-193`; `getByLabel('tìm phòng theo tên hoặc mã')` (combobox) — `:61,203-227`; `getByRole('listbox',{name:'kết quả tìm phòng'})` — `:64`; ViewCube `getByRole('group',{name:'Khối định hướng'})` + nút `Phối cảnh`/`Trục đo`/`Trên xuống`/`Mặt cắt` — `ViewerShell/ViewerOverlays.tsx:45,50,55`; `getByRole('combobox',{name:'Góc nhìn sẵn'})` — `ViewerTopBar.tsx:72`; `getByRole('option',{name:/cao độ/u})` — `ViewerStoreyRail.tsx:53-61,75`. **Cạm bẫy:** hai `role=status` khi xong (thanh hiện diện + `sr-only`) ⇒ `getByRole('status')` trần trúng 2, dùng `getByText`/`filter`; nhãn có số động (`Mức thu phóng 112,6%…`) ⇒ regex.
13. **KHÔNG kiểm được** (chép từ docblock `viewer3d.spec.ts:30-106`, thêm V8): (a) **camera có bay tới đúng phòng không** — không có gì trong DOM nói điểm ngắm; chứng minh ở `viewer3dScene.test.ts` ("R-07…"); (b) **"quay" chỉ được đo, không khẳng định** — không có gì trong DOM nói góc nhìn đã đổi; bằng chứng thật là ViewCube `aria-pressed`; (c) **cảnh 3D trông ra sao** — chỉ kiểm được canvas có kích thước >0 (960×382/960×415 — **đừng khẳng định số cỡ**, phụ thuộc viewport); (d) **mục nghiệm thu "người chưa từng dùng CAD"** — không thay được bằng máy, `usability-script.md` cấm agent tự chạy rồi báo số như người thật; (e) `store.spatial` vẫn `null` trên màn này (V8 P2): lý do 1 của docblock đã lấp cho vỏ nhưng **ba panel đọc kho không lấp** — xem các mục 3–4; (f) tour chập chờn theo thời điểm (V8 P1) ⇒ ca bấm-hai-lần phải có bước chờ; (g) tương tác chuột trên canvas thật (toạ độ quét lưới) — dùng lại kỹ thuật R1 của spec, không phát minh. Ai chứng minh: (a) đơn vị; (b),(c) chưa ai; (d) người thật.

---

## 2. ViewerShell — vỏ chung · KHÔNG route riêng (`ViewerShellContainer` dựng trong `projectViewer`)

1. **Kiểu:** không route riêng; hiện diện thật trong `projectViewer` (`Viewer3D/Viewer3D.container.tsx:370` dựng `ViewerShellContainer`). `ViewerShellRoute` không được `router.tsx` gắn (V8 P4). **Hợp đồng mục 3 sai ở hai nơi gọi**: `VersionHistory`/`ViolationDetail` chỉ `import type` `ViewerSceneFrame`, không dựng vỏ (V8 P4: `export/VersionHistory/types.ts:67`, `versionHistoryScene.ts:21`, `VersionVisualDiff.tsx:33`, `rules/ViolationDetail/useViolationDetail.ts:88`). Hai nơi khác dùng *view* `ViewerShell` (`ExplodedView.container.tsx:20-29`, `MeasurementTool.container.tsx:27`) thuộc việc khác — **chưa đo** ở đây.
2. **Đường tới:** mở `projectViewer` là có.
3. **Tiền đề:** như 0.1; vỏ vẽ ngay cả lúc "đang dựng".
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng mất **khung điều khiển quanh mô hình** (ray tầng, ViewCube, thanh trạng thái tổng số tầng/phòng/diện tích, panel thanh tra). Nếu chỉ có các ca đã nằm ở mục 1 thì mục này **không có thêm giá trị** — nó chỉ giữ hai ca dưới, vì hai ca ấy chứng minh thứ mà mục 1 không nói.
5. **Đã kiểm ở tầng đơn vị:** `ViewerShell.test.tsx` 29 bài (VS-1…VS-14, ~824 dòng; V8 2.2): bảy trạng thái (8 chỗ `SEVEN_STATES`) + `expectVietnamese`; vai viewer **gỡ** công cụ sửa khỏi ray chứ không làm mờ (VS-2); xếp tầng/độ tách; mặt phẳng cắt; **VS-5 bộ mẫu `4 tầng · 14 phòng · 248,60 m²`, đo lại từ chính đồ thị** (`ViewerShell.test.tsx:236`); chip hiệu năng; panel phải trượt (VS-8); minimap không đè ViewCube (VS-9); `frameStorey`; khe `inspectorSections`.
6. **Ca luồng chính:**
   - **VS-A15 — chuỗi thật trên thanh trạng thái**: `getByLabel('Thanh trạng thái')` chứa `4 tầng · 14 phòng · 248,60 m²`. **Đo lớp 2: chuỗi này hiện đúng trên màn thật** (`4 tầng · 14 phòng · 248,60 m²`, thanh trạng thái `aria-label="Thanh trạng thái"`, `ViewerStatusBar.tsx:27`). V8 ghi "chưa đo" — nay **đã đo**. Spec hiện có chỉ khẳng định dạng `[\d.,]+ m²` (`viewer3d.spec.ts:538-540`), không ghim con số ⇒ đây là chỗ nói được A15 rẻ nhất; **con số ghim phụ thuộc Q5**.
   - **VS-E — `Esc` bỏ chọn khi chỉ có vỏ**: chọn phòng qua ô tìm → `Escape` → panel `Thanh tra đối tượng` về "Chưa chọn đối tượng" (V8 S5, hàng "bỏ chọn"). Không lặp bảng 0.2 — chỉ ca đơn.
7. **Ca bảy trạng thái:** `forbidden` — e2e đã có (`viewer3d.spec.ts:664`: `Chỉ xem` + `Bạn đang xem ở vai Người xem nên không sửa được mô hình.`, `ViewerInspector.tsx:82-88`, V8 3.3). Còn lại (`empty` "Chưa chọn đối tượng"/`success`) e2e chạm được qua ca chọn; `loading`/`partial`/`error`/`collapsed`: **thuộc tầng đơn vị** (VS-1).
8. **Ca bàn phím (A12):** `viewer.selection.clear` chỉ đăng ký khi có chọn; không chọn ⇒ vỏ **không** đăng ký `Escape` để `global.closeTopLayer` sống (`viewerShellShortcuts.ts:28-34`). Phạm vi `canvas`; thứ tự với lớp khác: **bảng 0.2** (bỏ chọn ở S1/S5, đăng ký trước chế độ sửa hình học).
9. **Ca tự lưu (A7):** không áp dụng — vỏ không ghi dữ liệu.
10. **Ca hoàn tác (A8/A9):** không áp dụng — vỏ không ghi.
11. **Ca định dạng (A6/A15):** VS-A15. A6: **bốn nút ray tầng hiện `L-01FIXTURE0`… thay vì tên tầng** — PHÁT HIỆN F1; trong khi `aria-label` của cùng nút là "Tầng trệt, cao độ 0,00 m" (đo lớp 2: `role=option`, chữ nhìn thấy = mã). Chữ thấy được và `aria-label` khác nhau: `getByRole('option',{name:/cao độ/u})` khớp theo aria-label, nên **spec hiện có xanh trong khi chữ nhìn thấy sai** — ca kiểm bằng `getByRole` không bắt được lỗi này.
12. **Mốc neo** (V8 2.2a): `getByRole('region',{name:'Vỏ khung nhìn 3D'})` — `ViewerShell.tsx:116`; `getByRole('navigation',{name:'Đường dẫn màn hình'})` — `ViewerChrome.tsx:46`; `getByRole('toolbar',{name:'Công cụ khung nhìn'})` — `ViewerToolRail.tsx:49-52` (nút `quay quanh mô hình (R)`, `kéo màn (H)`, `đo (M)`, `mặt cắt (C)`, `chọn (V)`, `cô lập (Alt+H)`, `:59`); `getByRole('listbox',{name:'Tầng'})` — `ViewerStoreyRail.tsx:53-61,75`; `getByRole('group',{name:'Cụm thu phóng'})` + `Thu nhỏ`/`Phóng to`/`Vừa khung hình`/`Mức thu phóng …` — `ViewerChrome.tsx:134-146`; `getByRole('complementary',{name:'Thanh tra đối tượng'})` — `ViewerInspector.tsx:56`; ca rỗng `Chưa chọn đối tượng` — `ViewerInspector.tsx:100`, `useViewerShell.ts:181`; `getByLabel('Thanh trên khung nhìn')` (role chưa đo, `ViewerTopBar.tsx:49`); radiogroup `Chế độ xem` (`2D`/`3D`) — `:57`. **Cạm bẫy:** `aside` (`ViewerInspector.tsx:56`) và `section role=region` (`PropertyInspector.tsx:66`) cùng tên `Thanh tra đối tượng` ⇒ `getByLabel` trúng 2 khi có chọn; dùng `getByRole('complementary')` hoặc `getByRole('region')`.
13. **KHÔNG kiểm được:** (a) `VersionHistory`/`ViolationDetail` **không dựng vỏ** ⇒ không có đường mở khác `projectViewer` (V8 P4; tôi không tự grep lại — "V8"); (b) `ExplodedView`/`MeasurementTool` dùng view vỏ, có tour/`inspectorSections` hay không: **chưa đo** (CẦN TỪ V-Exploded/Measure); (c) minimap vs ViewCube: đã có VS-9 (đơn vị) và hình học e2e đo 1 lần (V8 4.3, không phải ca) — tôi **không chạy** `viewer3d.spec.ts` nên "xanh hay đỏ" là **chưa chạy**; thân bài ViewCube đã đọc (không đo hình học đè, chỉ `click()` không `force`); (d) vai viewer thấy panel thanh tra thế nào ở trạng thái đầy đủ: chỉ dải `Chỉ xem`, không có dữ liệu để hơn.

---

## 3. PropertyInspector — thanh tra thuộc tính · KHÔNG route (con của `projectViewer`)

1. **Kiểu:** không route.
2. **Đường tới:** **không có nút bật riêng** (chủ ý, `Viewer3DPanels.tsx:27-30`). Mở duy nhất bằng **chọn một đối tượng**: (a) phòng — `/` mở ô tìm → gõ `phong ngu 4` → `Enter` (đường ổn định nhất, không dính tour/canvas; V8 mục 5.8); (b) tường — chỉ bằng chuột trên canvas (vai kỹ sư). Panel chỉ dựng khi `selectedEntityId !== null` (`Viewer3DPanels.tsx:205`).
3. **Tiền đề:** vai `engineer`; đã đóng tour; đã chờ dựng xong.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng chọn một phòng/tường mà **không xem được thuộc tính** (độ dày, diện tích…). **Nhưng hôm nay panel này chưa bao giờ ra `success`** — kẹt "Đang tải thuộc tính…" (V8 P2, đo 8 s cho cả tường lẫn phòng). Ca e2e duy nhất đáng viết hôm nay chỉ chứng minh "panel có mặt và nói ra trạng thái, không trắng"; nó **không chứng minh panel dùng được** và tên ca phải nói thế.
5. **Đã kiểm ở tầng đơn vị:** 16 bài / 1 tệp, `PropertyInspector.test.tsx` 1268 dòng (V8 2.3): bảy trạng thái + a11y + tiếng Việt + màu thô (PI-1); số trường tường (N2); ba tường lệch độ dày → gạch ngang (N4); đổi tường↔phòng mười lần (N3); **đổi độ dày 220→330 hoàn tác bằng `Ctrl+Z` thật, kéo một mạch gộp MỘT bước (N1)**; chiều cao tường bị từ chối (N6); kích thước bao nội thất + FURNITURE-CLASH (N7); **bốn phím `? · Ctrl+F · Esc · Ctrl+S` qua sổ chung (N8)**; **tự lưu, chân panel "Đã lưu lúc …" (N9)**. ⇒ A7/A8/A15 của panel **đã ở đơn vị**, e2e không lặp và cũng chưa lặp được (không dữ liệu).
6. **Ca luồng chính:** **PI-1e — chọn một phòng bằng ô tìm → vùng `Thuộc tính đối tượng đã chọn` xuất hiện và mang một `role=status`** (không khẳng định "Đang tải…" mãi, cũng không khẳng định `success`). Đỏ = chọn xong mà không panel nào hiện ⇒ người dùng mất chỗ xem thuộc tính. **Ca khẳng định `success` (dòng thuộc tính, "Độ dày", "Diện tích"…): chưa có đường** — nhãn dòng nằm ở `usePropertyInspector.ts:~190-250` (`PROPERTY_INSPECTOR_TEXT`), **chưa đo trên màn**. Đường mở duy nhất: cửa nạp-kho (V6/V7, dev-only); **chưa đo** với đồ thị `VIEWER_FIXTURE_GRAPH` cho panel này (đo lớp 2 chỉ làm cho RoomAreaPanel, mục 4) — nên **không** đưa thành ca cho tới khi đo (Q2).
7. **Ca bảy trạng thái:** `loading` — đo được (V8), `role=status` `Đang tải thuộc tính…` (`PropertyInspector.tsx:67,136`; hằng `LOADING_LABEL` `:67`). `success`/`error`/`partial`/`forbidden`/`collapsed`: **thuộc tầng đơn vị** (PI-1); `empty` của **chính panel** ("Chưa chọn đối tượng nào để xem thuộc tính.", `usePropertyInspector.ts:247`) **không mở được không cần chọn** — câu "Chưa chọn đối tượng / Chọn một đối tượng…" thấy được là của **vỏ** (`ViewerInspector.tsx:100`), không phải của panel; `Viewer3DPanels.test.tsx` VP-1 đã khẳng định panel không dựng khi chưa chọn (V8 2.3). `forbidden`: vai viewer không chọn được gì (đo V8 3.3) nên **viewer không bao giờ thấy panel** — không có ca.
8. **Ca bàn phím (A12):** panel **không đăng ký `Escape`**; `Escape` đóng nó **gián tiếp** bằng `viewer.selection.clear` → `selectedEntityId=null` → panel tháo khỏi DOM (V8 S5: Esc1 đóng bảng phụ nếu có, Esc2 bỏ chọn ⇒ panel biến mất). Ca: chọn phòng (ô tìm) → khẳng định panel → `Escape` → panel biến mất. Thứ tự với lớp khác: **bảng 0.2** (S5/S6; chú ý S6: khi tour đang hiện, Esc1 bỏ chọn rồi Esc2 mới bỏ qua tour).
9. **Ca tự lưu (A7):** panel có chân "Đã lưu lúc …" (N9) — **chỉ hiện ở `success`, chưa bao giờ hiện ở dev** ⇒ e2e **chưa có đường**. Nút `Lưu làm khuôn mẫu` (`PropertyInspectorHeader.tsx:17,42`) chứa chữ "lưu" và cũng chỉ hiện ở `success` — không phải nút lưu văn bản; ghi để ca quét "không nút lưu" không bị bất ngờ.
10. **Ca hoàn tác (A8/A9):** **thuộc tầng đơn vị** (N1 `Ctrl+Z` thật). e2e: **chưa có đường** (không dữ liệu). Không có việc "không hoàn tác được" ⇒ A9 không áp dụng.
11. **Ca định dạng (A6/A15):** A6 — `expectVietnamese` ở đơn vị (PI-1). A15 của panel **không kiểm được** (V8 P2: cần dòng thuộc tính; số ấy chưa từng hiện) — `chưa phủ`.
12. **Mốc neo** (V8 2.3): vùng bọc `getByRole('region',{name:'Thuộc tính đối tượng đã chọn'})` — `Viewer3DPanels.tsx:101,206-209`; bên trong `getByRole('region',{name:'Thanh tra đối tượng'})` — `PropertyInspector.tsx:66,197`; `getByRole('status')` chữ `Đang tải thuộc tính…` — `:67,136`; `getByRole('button',{name:'Đóng'})` — `PropertyInspectorHeader.tsx:18,46`; `Lưu làm khuôn mẫu` — `:17,42`; chip `Mở lại thanh tra đối tượng` — `PropertyInspector.tsx:69`. **Cạm bẫy:** trùng tên `Thanh tra đối tượng` với `aside` của vỏ (mục 2, ghi chú 12) — dùng `getByRole('region')` ở đây. **NOT FOUND:** nhãn từng dòng thuộc tính (chưa hiện trên màn); nút bật riêng (không tồn tại — chủ ý).
13. **KHÔNG kiểm được:** mọi thứ sau `loading` — dòng thuộc tính, ghi độ dày, hoàn tác thật, tự lưu, A15 — vì `store.spatial === null` (`useRoomAreaPanel.ts:213` cùng gốc; V8 P2). Lý do đã đo; ai chứng minh: **tầng đơn vị** (PI-1, N1–N9). Điều kiện mở: quyết Q2. **Ghi nhận không ép:** "kẹt loading mãi" vừa là hiện trạng vừa là dấu hiệu sản phẩm chưa nối dữ liệu; ca e2e không được viết như thể `loading` là hành vi mong muốn.

---

## 4. RoomAreaPanel — bảng diện tích phòng · KHÔNG route

1. **Kiểu:** không route.
2. **Đường tới:** trên `projectViewer` bấm `getByRole('button',{name:'Diện tích phòng',exact:true})` (`Viewer3DPanels.tsx:87,164-178`; `aria-controls="viewer-3d-panel-rooms"`, `aria-expanded`). **Không cần chọn gì.** Hai nút điều hướng của panel (`onCheckWallGaps` → `ROUTES.project.walls`, `onOpenExport` → `ROUTES.project.export`, `Viewer3D.container.tsx:266-278`) ở `empty`/`success` — hôm nay không tới.
3. **Tiền đề:** đóng tour **sau** khi bấm nút (tour hiện trên cái vừa mở — 0.1). Vai: viewer đủ để mở.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng bấm "Diện tích phòng" mà **không thấy bảng diện tích** (thứ dùng để đối chiếu tổng sàn, so sánh phòng). Ca hôm nay chỉ chứng minh "bảng mở, nói ra đang tính, không trắng".
5. **Đã kiểm ở tầng đơn vị:** 12 bài / 1 tệp `RoomAreaPanel.test.tsx` (V8): G1–G4 (bảy trạng thái/a11y/tiếng Việt — có `expectVietnamese`, 9 chỗ `SEVEN_STATES`); **tổng mười bốn dòng bằng đúng A14 và phép cộng in đủ (N1)**; thanh xếp chồng ≤ 3 dải (N2); bấm một dòng gọi `onRoomActivate` một lần (N3); rỗng: nút "Kiểm tra khe hở tường" gọi `onCheckWallGaps` (N4); thu gọn còn 5 phòng (N5).
6. **Ca luồng chính:**
   - **RA-1 — mở và nói ra trạng thái** (chạy được hôm nay, không cần cửa): bấm nút → `#viewer-3d-panel-rooms` có mặt và chứa `[aria-busy="true"]` nhãn `Đang tính diện tích…` (`RoomAreaPanel.chrome.tsx:56,274`); `getByRole('region',{name:'Bảng diện tích phòng'})` có mặt (`:43`). V8 đo: **`innerText` rỗng — không có chữ nhìn thấy**, chỉ có `aria-label`; 15 s vẫn `aria-busy=1`. Đây **không** là "success" và ca không được đặt tên như vậy.
   - **RA-2 — `success` qua cửa nạp-kho (ĐO LỚP 2, chưa phải ca đã duyệt):** trong trang dev, `await import('/src/store/index.ts')` rồi `setSpatial(normalizeSpatial(VIEWER_FIXTURE_GRAPH), null)` (`ViewerShell/viewerShellFixture.ts:304`); **phải `normalizeSpatial`** — tiêm đồ thị chưa chuẩn hoá khiến nút bật panel biến mất (đo lớp 2: lần đầu, chưa chuẩn hoá ⇒ `click` hết hạn, không có nút). Sau khi tiêm chuẩn hoá và bỏ tour, panel hiện **`248,60 | m² | Tổng diện tích sàn toàn nhà — 14 phòng`**, tab `theo tầng`/`theo công năng`, sắp xếp `theo diện tích`, `Tầng trệt 5 phòng · 80,00 m²`, `Tầng 02 4 phòng · 70,00 m²`, `Tầng 03 3 phòng · 60,00 m²`, các hàng `đã xác minh | 32,40`… (0 phần tử `aria-busy`). **Đây là cửa dev-only chạm nội bộ (V6/V7 đã báo)** — đưa vào kế hoạch hay không là **Q2**; mục này không tự chọn.
7. **Ca bảy trạng thái:** `loading` — RA-1 (đo). `success` — RA-2 (đo lớp 2, chờ Q2). `empty`/`error`/`partial`/`forbidden`/`collapsed`: **thuộc tầng đơn vị** (G1–G4, N4, N5). Điều kiện `loading`: `spatialLoaded: spatial !== null` (`useRoomAreaPanel.ts:213,283`) → `useRoomAreaPanel.model.ts:571-572`.
8. **Ca bàn phím (A12):** panel **không có Escape riêng**; đóng qua `viewer3d.panels.close` (sidePanel, `Viewer3DPanels.tsx:186-197`). Đo V8 S3/S4: `Escape` đóng đúng bảng này; S4 (đang mở ô tìm bằng `/`): Esc1 đóng **ô tìm** trước, Esc2 mới đóng bảng. Thứ tự đầy đủ: **bảng 0.2**. `Escape` trong ô nhập của hàng: xử lý cục bộ (`RoomAreaPanel.rows.tsx:160`, không qua sổ).
9. **Ca tự lưu (A7):** không áp dụng — panel chỉ đọc.
10. **Ca hoàn tác (A8/A9):** không áp dụng — không ghi.
11. **Ca định dạng (A6/A15):** A15 — RA-2 cho chuỗi `248,60` và `80,00`/`32,40` (dấu phẩy thập phân); **cùng lúc ghim con số 248,60 ⇒ Q5**. `chưa phủ` ở e2e nếu Q2 = (B); còn `đơn vị` (N1) vẫn đứng. A6: đơn vị (G-series). Tên tab/nhãn `phòng ở`/`khu phụ trợ`/`lưu thông và khác` viết thường kiểu câu — đo lớp 2 thấy đúng.
12. **Mốc neo:** nút bật (trên); `getByRole('region',{name:'Bảng diện tích phòng'})` (`RoomAreaPanel.chrome.tsx:43`); trạng thái chờ **không có role** ⇒ `getByLabel('Đang tính diện tích…')` (`:56,274`); panel `#viewer-3d-panel-rooms` — chỉ dùng id ở đây vì HOP-DONG mục 7 xếp `data-testid`/id vào phương án cuối, và **vùng bảng có `region` + tên nên không cần id** (dùng `getByRole('region')`). Các mốc hàng/tổng ở `success`: **chưa đo** ngoài RA-2 (chữ thô đo lớp 2, nhãn `aria-label` từng hàng **chưa đo**). Nút điều hướng `Kiểm tra khe hở tường`: nhãn theo đơn vị N4, `file:dòng` **NOT FOUND** (chưa mở `RoomAreaPanel.rows.tsx`/`chrome`).
13. **KHÔNG kiểm được:** ở e2e hôm nay: mọi thứ sau `loading` (V8 P2) trừ khi Q2 = (A). Với (A) vẫn không kiểm được: hàng phòng bấm để bay camera (`onRoomActivate` — đơn vị N3), điều hướng thật của hai nút (cần `empty`/`success` cụ thể — đo riêng), `loading` → `success` chuyển tiếp theo thời gian thật. Ai chứng minh: đơn vị (N1–N5).

---

## 5. HistoryPanel — lịch sử thao tác · KHÔNG route

1. **Kiểu:** không route.
2. **Đường tới:** `getByRole('button',{name:'Lịch sử thao tác',exact:true})` (`Viewer3DPanels.tsx:89,164`), truyền `layout="panel"` (`:280`). Không cần chọn gì.
3. **Tiền đề:** tour đóng sau khi bấm (0.1). Vai viewer đủ (`HistoryPanel.container.tsx:186-187`).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không mở được lịch sử thao tác** hoặc thấy trạng thái rỗng sai (đây là nơi "mọi thay đổi đều quay lại được", A8). Hôm nay chỉ kiểm được ca rỗng.
5. **Đã kiểm ở tầng đơn vị:** `HistoryPanel.test.tsx` 10 bài (`expectVietnamese` + 10 chỗ `SEVEN_STATES`): G1–G4; **mục đã hoàn tác vẫn nhìn thấy (N1)**; diff before/after (N2); lô (N3); `canJump=false` (N4); mỗi mục dẫn tới đối tượng (N5); không lộ mã máy (N6); một phần hai lý do (N7). ⇒ **10 bài (mỏng)** — đây là chỗ e2e đáng đi sâu *nếu* có dữ liệu; hôm nay không có (xem 13).
6. **Ca luồng chính:** **HP-1 — mở bảng, ra ca rỗng thật**: bấm nút → `getByRole('region',{name:'Lịch sử chỉnh sửa'})` (`HistoryPanel.chrome.tsx:49`) chứa `Chưa có bước nào` (`:56`) và `Mọi thay đổi bạn làm trên mô hình sẽ hiện ở đây theo thứ tự thời gian, và bước nào cũng quay lại được.`; nhóm lọc `Lọc theo loại việc` (`:52`) với bốn nút `tất cả`/`chỉnh sửa`/`duyệt`/`AI`; combobox `Lọc theo người thực hiện` (`:53`) chữ `mọi người` (V8 2.5). Đỏ = người dùng mở lịch sử mà thấy trống trơn/lỗi thay vì lời giải thích.
7. **Ca bảy trạng thái:** `empty` — HP-1 (e2e, đo). `success`/`partial`/`error`/`forbidden`/`collapsed`/`loading`: **thuộc tầng đơn vị**; `success` (danh sách mục, mục hoàn tác, diff, lô): **chưa có đường** — muốn có lịch sử thì phải có một thao tác ghi thật chạy được, mà hôm nay PropertyInspector kẹt `loading` và WallGeometryEditor không có đỉnh (V8 2.5) ⇒ chưa có đường sinh lịch sử từ giao diện.
8. **Ca bàn phím (A12):** panel **không có Escape riêng**; đóng qua `viewer3d.panels.close` (sidePanel). Nó đăng ký **`mod+h`** (sidePanel) để **thu gọn trong panel**, không đóng bảng (`HistoryPanel/useHistoryPanel.ts:367-375`, `historyPanelTypes.ts:374`) — **`Ctrl+H` chưa đo** (V8). Thứ tự khi có lớp khác: **bảng 0.2** (S1, S5, S7, S8 đều có Lịch sử); S7/S8 cho thấy Lịch sử đóng **sau** danh sách người xem nếu mở trước. Focus không trả về nút bật khi bảng phụ đóng (V8: giữ nguyên nút cuối bấm) — **phát hiện tính chất, không phải lỗi được kết luận**.
9. **Ca tự lưu (A7):** không áp dụng — panel chỉ đọc.
10. **Ca hoàn tác (A8/A9):** A8 nằm ở đơn vị (N1). e2e hoàn tác qua lịch sử: **chưa có đường** (không có mục nào). A9: không áp dụng.
11. **Ca định dạng (A6/A15):** A6 — đơn vị (`expectVietnamese`); chữ rỗng nhìn thấy đều viết thường kiểu câu (`Chưa có bước nào`, `tất cả`, `mọi người`) — đo V8; chip `AI` là ngoại lệ chữ hoa (mã/viết tắt) — **ngoại lệ A6 áp dụng cho "mã trục, mã lỗi, tên phím" (CLAUDE.md), "AI" không thuộc ba loại ấy**; **để người duyệt quyết, không đếm là lỗi** (không nằm trong nợ Pascal). A15: `chưa phủ` — số chỉ hiện khi có mục.
12. **Mốc neo** (V8 2.5): nút bật; `getByRole('region',{name:'Lịch sử chỉnh sửa'})` — `HistoryPanel.chrome.tsx:49`; `getByRole('group',{name:'Lọc theo loại việc'})` — `:52`; `getByRole('button',{name:'tất cả'|'chỉnh sửa'|'duyệt'|'AI'})`; `getByRole('combobox')` `mọi người` (nhãn `Lọc theo người thực hiện`, `:53`); `Chưa có bước nào` — `:56`. Bảng bật là `#viewer-3d-panel-history` (đo V8) — không cần, dùng `region`.
13. **KHÔNG kiểm được:** danh sách mục, mục đã hoàn tác, diff, lô, nhảy tới đối tượng, hoàn tác từ lịch sử — **chưa có dữ liệu nên chưa kiểm được gì** (lý do đã đo, V8 2.5). Ai chứng minh: đơn vị N1–N7. `Ctrl+H`: **chưa đo**. Tôi **không** tự đo lại phần này.

---

## 6. FurnitureLibraryPanel — thư viện đồ đạc · KHÔNG route

1. **Kiểu:** không route.
2. **Đường tới:** `getByRole('button',{name:'Thư viện đồ đạc',exact:true})` (`Viewer3DPanels.tsx:88,164`). **Nút chỉ được dựng khi biết tầng** (`floorId !== null`, `:199-201`); có mặt ở bộ mẫu. Không cần chọn gì.
3. **Tiền đề:** tour đóng sau khi bấm. Đường ảnh xem trước ra mạng ngoài — xem 13 (cạm bẫy `example.com`).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không duyệt/tìm/lọc được thư viện đồ đạc** để bố trí nội thất. Đây là **panel duy nhất của nhóm có nội dung thật ở dev** (V8: 10 nhóm và lưới thẻ) — nên là nơi e2e chứng minh được nhiều nhất.
5. **Đã kiểm ở tầng đơn vị:** `FurnitureLibraryPanel.test.tsx` **7 bài (mỏng nhất nhóm)**: FLP-1 bảy trạng thái/a11y/tiếng Việt (`expectVietnamese`, 12 chỗ `SEVEN_STATES`); **FLP-2 xem trước hàng loạt: lớp sofa (4) ⇒ xem trước 4 mục, 0 thay đổi trước khi xác nhận, 1 bước hoàn tác sau (N4/N5)** + N5b xoá+thêm trong MỘT `runTransaction`; FLP-3 không quyền: nút tải lên biến mất, thẻ không kéo được, container gắn được bằng một thẻ (N6/N6b). ⇒ e2e không lặp A8/A9 ở đây.
6. **Ca luồng chính:**
   - **FL-1 — mở, thấy đủ 10 nhóm và lưới thẻ** (V8 2.6): `getByRole('group',{name:'Nhóm nội thất'})` (`FurnitureLibraryPanelFilters.tsx:39`) chứa `Tất cả, Bàn, Ghế, Giường, Sofa, Tủ kệ, Thiết bị vệ sinh, Bếp, Thiết bị kỹ thuật, Của tôi`; `getByRole('list',{name:'Lưới mô hình nội thất'})` (`FurnitureLibraryPanel.tsx:75`) có thẻ.
   - **FL-2 — tìm và lọc**: `getByLabel('Tìm mô hình nội thất')` (`FurnitureLibraryPanelFilters.tsx:37`) gõ một tên (vd `bàn ăn sáu chỗ`) ⇒ lưới thu hẹp; bấm nhóm `Sofa` ⇒ lưới chỉ còn sofa. **Số thẻ theo nhóm: chưa đo** (V8 không ghi) — khẳng định bằng "lưới thu hẹp và mọi thẻ còn lại khớp", không ghim số. Đỏ = người dùng gõ tìm mà lưới không đổi.
   - **FL-3 — khoá kéo-thả nói ra vì sao, và nó SAI với admin** — xem PHÁT HIỆN F2; ca chỉ nên viết nếu Q3 = (B).
7. **Ca bảy trạng thái:** `success` — FL-1. `forbidden` — câu khoá "Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được." (`FurnitureLibraryPanel.tsx:77`) hiện **ở mọi vai kể cả admin** (V8 P3, đo `admin@example.com`) ⇒ trạng thái `forbidden` ở e2e **không phân biệt được vai**: ca `forbidden` thuần đơn vị (FLP-3). `empty`/`error`/`partial`/`loading`/`collapsed`: đơn vị (FLP-1). Ảnh hỏng: thẻ `Chưa dựng được ảnh xem trước <tên>` (đo: 2 thẻ `kệ sách năm tầng`, `chậu rửa đặt bàn`) — đó là trạng thái `partial` **do mạng**, xem 13.
8. **Ca bàn phím (A12):** **hai chủ**: `viewer3d.panels.close` (đóng bảng) và `furnitureLibraryPanel.cancel` (huỷ kéo / đóng hộp xem trước nhóm; chỉ bật khi `isDragging || isPreviewOpen`, `useFurnitureLibraryPanel.ts:246-261`). Hộp xem trước mở SAU bảng ⇒ `cancel` đăng ký sau ⇒ **thắng** (LIFO, cùng cơ chế S7 — đọc mã). **Đo: chưa** — không mở được hộp xem trước vì kéo bị khoá (P3) ⇒ **"chưa đo"**, không suy ra. Ca e2e đo được hôm nay: S3 — chỉ mở thư viện, `Escape` ⇒ đóng bảng (V8).
9. **Ca tự lưu (A7):** không áp dụng — ghi (tải lên, thả mô hình) bị khoá ở giao diện (P3).
10. **Ca hoàn tác (A8/A9):** đơn vị (FLP-2: xem trước trước khi áp, 1 bước hoàn tác). e2e: **chưa có đường** — cần kéo-thả/thay tất cả, bị khoá (P3).
11. **Ca định dạng (A6/A15):** **A15 e2e rẻ và có thật**: dung lượng `402,3 KB` dùng dấu **phẩy thập phân** (V8); kích thước `1.800 × 900 × 750 mm` dấu **chấm là dấu nghìn**, không vi phạm — ca phải bắt dấu ở vị trí thập phân (`/\d,\d KB/u`), không bắt mọi dấu chấm. A6: nhãn thẻ chữ thường (`bàn ăn sáu chỗ`, `giường đôi 1m6`), tên nhóm `Bàn, Ghế…` viết hoa đầu — kiểu câu; A6 đầy đủ ở đơn vị.
12. **Mốc neo** (V8 2.6): `getByRole('region',{name:'Thư viện nội thất'})` — `FurnitureLibraryPanel.tsx:74`; `getByLabel('Tìm mô hình nội thất')` — `FurnitureLibraryPanelFilters.tsx:37`; `getByRole('group',{name:'Nhóm nội thất'})` — `:39`; `getByRole('list',{name:'Lưới mô hình nội thất'})` — `FurnitureLibraryPanel.tsx:75`; câu khoá — `:77`. Thẻ là `button` tên `<tên>\n<cỡ>\n<dung lượng>…` — **tên có xuống dòng: dùng regex/`hasText`**. **NOT FOUND:** nhãn `getByRole` cho từng nhóm (chỉ biết chữ); nút "tải lên" (bị gỡ khi không quyền).
13. **KHÔNG kiểm được:** kéo-thả thả mô hình vào cảnh, xem trước hàng loạt, thay tất cả, tải lên — **không tới được** vì `canDrag = options.canUploadModel` (`useFurnitureLibraryPanel.ts:302`), `canUploadModel = canManageLibrary && uploadModel !== undefined` (`FurnitureLibraryPanel.container.tsx:118`), và `Viewer3DPanels.tsx:269-273` **không truyền `onUploadModel`** ⇒ `onModelDropped` không bao giờ chạy từ giao diện (V8 P3, đã tự đọc lại các dòng). **Cạm bẫy mạng:** ảnh lấy từ `https://example.com/library/library-*.png` ⇒ `requestfailed` khi máy không ra mạng; ca phải `page.route('https://example.com/**')` fulfill hoặc chấp nhận thẻ không ảnh — **đừng để bài phụ thuộc mạng ngoài**. Ai chứng minh: đơn vị FLP-2/FLP-3.

---

## 7. WallGeometryEditor — sửa hình học tường · KHÔNG route (chế độ trên `projectViewer`)

1. **Kiểu:** không route — một **chế độ** với lớp phủ `absolute inset-0` (`Viewer3DOverlays.tsx:26-32`).
2. **Đường tới:** (1) chọn **một bức tường** bằng chuột trên canvas, vai kỹ sư (`isIdOfKind('wall',…)`, `Viewer3D.container.tsx:303`); (2) `getByRole('button',{name:'Sửa hình học tường'})` xuất hiện ở cột phải (`Viewer3DPanels.tsx:106,222-241`, `aria-pressed`); (3) bấm. Chọn **phòng** ⇒ nút **không được dựng** (V8 đo 0 nút). Thoát: nút đổi thành `Thoát chế độ sửa hình học` (`:107`), hoặc `Xong`, hoặc `Escape`.
3. **Tiền đề:** vai `engineer` (viewer không chọn được tường ⇒ không tới nút, đúng thiết kế, V8 3.3); tour đóng; dựng xong. **Chọn tường cần chuột**: V8 quét lưới 0,03×0,03 trong 15–85 % tìm toạ độ trúng tường; spec hiện có bấm `(x+w/2, y+h*0.62)` và được `(phòng|tường) [A-Z]-[A-Z0-9]+` (`viewer3d.spec.ts:636,641`) — **không rõ đó là tường hay phòng**, toạ độ ổn định cho tường: **chưa đo**. Đừng phát minh — dùng kỹ thuật R1.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không vào/ra được chế độ sửa hình học tường** hoặc `Escape` thoát nhầm lớp khiến mất chỗ đang sửa. **Hôm nay** chế độ chỉ mở được ca rỗng (không có đỉnh) — nên ca e2e giữ **hợp đồng vào/ra và Esc**, không giữ việc sửa.
5. **Đã kiểm ở tầng đơn vị:** `WallGeometryEditor.test.tsx` **13 bài** (880 dòng; V8): G1–G4 (`expectVietnamese`, 12 chỗ `SEVEN_STATES`); **kéo đỉnh qua 40 khung = MỘT bước lịch sử (N1)**; cửa giữ vị trí tương đối (N2); ba loại bắt điểm (N3); **`Esc` giữa lúc kéo trả đỉnh về toạ độ ban đầu (N4)**; sửa 3D ⇒ 2D khớp (N5); chip đối chiếu bản vẽ luôn null (N6); R-73/A11/**A12 Esc thoát chế độ khi không còn lớp bên trên**. Lớp Esc bên trong panel (kéo → nháp → thoát, `useWallGeometryEditor.ts:591-603`) **đã phủ ở đơn vị** ⇒ e2e chỉ thêm **quan hệ với lớp khác**. Cũng `Viewer3DOverlays.test.tsx` VO-1/VO-2 (chế độ tắt ⇒ lớp phủ KHÔNG trong DOM; chưa chọn tường ⇒ lớp phủ nói ra) và `Viewer3DPanels.test.tsx` VP-4 (nút chỉ khi chọn tường).
6. **Ca luồng chính:** **WG-1 — vào chế độ, thấy ca rỗng thật, thoát**: chọn tường → bấm `Sửa hình học tường` ⇒ `getByRole('region',{name:'Sửa hình học tường'})` (`WallGeometryEditor.tsx:200`, `wallGeometryEditorTypes.ts:499`) hiện với `Đang sửa: W-404FI`, `Xong`, bảng `Đỉnh | Toạ độ x | Toạ độ y`, `Chưa có đỉnh nào để sửa.` (`wallGeometryEditorTypes.ts:527`) và sáu công cụ; bấm `Xong` ⇒ vùng biến mất, nút trở lại `Sửa hình học tường`. **Ca WG-2 = thứ tự Esc với bảng phụ** — đã là V-E1 ở mục 1 (S1/S2); không lặp.
7. **Ca bảy trạng thái:** `empty` — WG-1 (đo V8: "Chưa có đỉnh nào để sửa", vì tường chọn từ **cảnh** (bộ mẫu vỏ) không có trong **kho**, cùng gốc P2). `forbidden` — viewer không tới được (đúng thiết kế); `success`/`partial`/`error`/`loading`/`collapsed`: **thuộc tầng đơn vị** (G1–G4).
8. **Ca bàn phím (A12):** `wallGeometryEditor.escape`, **canvas**, suốt lúc chế độ bật (`useWallGeometryEditor.ts:605-611`): kéo → huỷ kéo; nháp → xoá nháp; không có → thoát chế độ. **Đo (V8 S1/S2): nếu bảng phụ đang mở, Esc đầu đóng bảng, không đóng lớp phủ**; Esc2 thoát chế độ (focus vẫn ở nút "Thoát chế độ sửa hình học", không nhảy — V8); Esc3 bỏ chọn. Thứ tự đầy đủ: **bảng 0.2**. Ô nhập của bảng đỉnh xử lý `Escape` cục bộ (`WallGeometryVertexTable.tsx:50`, không qua sổ).
9. **Ca tự lưu (A7):** **chưa phủ** — chế độ sửa có ghi (`commit`), nhưng ở dev không có đỉnh nên không có gì để ghi; có hay không có chỉ báo lưu/tự lưu khi sửa hình học: **chưa đo** (ghi chú V8 không nói). Không suy ra.
10. **Ca hoàn tác (A8/A9):** đơn vị (N1: kéo đỉnh = MỘT bước). e2e: **chưa có đường** (không đỉnh). A9: không áp dụng (mọi sửa hoàn tác được — N1).
11. **Ca định dạng (A6/A15):** A6 — đơn vị. Chuỗi kích thước `getByLabel('Chuỗi kích thước của tường đang sửa')` (`wallGeometryEditorTypes.ts:518`) — số thập phân hiện ở đó: **chưa đo** ⇒ A15 `chưa phủ`. **Mã tường bị cắt**: lớp phủ nói `W-404FI`, panel thuộc tính nói `W-0404FIXTURE0` cho cùng bức tường (V8) — ghi để **không khẳng định hai chuỗi bằng nhau**.
12. **Mốc neo** (V8 2.7): vùng `getByRole('region',{name:'Sửa hình học tường'})` — `WallGeometryEditor.tsx:200`, `wallGeometryEditorTypes.ts:499`; **cùng chữ với nút bật ở cột phải ⇒ tách bằng ROLE** (button vs region), không `getByLabel`/`getByText`; `getByRole('button',{name:'Xong'})` — `wallGeometryEditorTypes.ts:503`; `getByRole('toolbar')` + `Di chuyển đỉnh`, `Thêm đỉnh`, `Xoá đỉnh`, `Tách tường`, `Nối tường`, `Đặt lại chiều cao` — `wallGeometryEditorTypes.ts:508-510`, `WallGeometryEditorToolbar.tsx:41`; bảng đỉnh `section` `Đỉnh`. Lớp phủ `pointer-events-none` ở gốc (`WallGeometryEditor.tsx:200`) ⇒ không chặn cú bấm khung nhìn.
13. **KHÔNG kiểm được:** kéo đỉnh, bắt điểm, cửa theo tường, hoàn tác một bước — **chưa có dữ liệu nên chưa kiểm được gì** (V8 2.7; gốc P2). Chọn tường bằng chuột: toạ độ ổn định **chưa đo**. Kéo chuột trên canvas thật không có chỉ báo trong DOM. Ai chứng minh: đơn vị N1–N6.

---


<!-- ===== V9 ===== -->

## Nhóm V9

Nguồn: `HOP-DONG.md` → `HOP-DONG-BO-SUNG.md` → `ghi-chu-V9.md` (sự thật lớp 1), thêm `don-vi-theo-man.md`, `probe-35-routes.json`,
`muc-V8.md` (để không lặp bảng Esc/tour), `questions.md` (để nối số Q). Không sửa repo, không viết test, không chạy cổng tổng.

Quy ước: **"V9"** = chép từ `ghi-chu-V9.md`; **"đo lớp 2"** = tôi tự mở Chrome (`channel:'chrome'`, 1440×900, dev server 5199) để xác minh
một điều còn ngờ — ghi từng chỗ; **"chưa đo"** = đúng nghĩa, mục này không suy ra. `file:dòng` tính từ `src/screens/viewer/` trừ khi ghi khác.
`e2e` trong bảng coverage nghĩa là *kế hoạch này có ca e2e*, không nghĩa "đã xanh" — tôi không chạy e2e.

---

## 0. PHẦN DÙNG CHUNG

### 0.1 Ba màn này KHÔNG có `EditorTour` — không đặt tour làm tiền đề (trả lời câu MỚI của điều phối)
Đo V9 (bấm canvas, chờ 1,5 s): 0 lớp phủ tour ở cả ba. **Đo lớp 2:** thêm `Escape` sau cú bấm (exploded, measure) và bấm giữa trang (overlay) — vẫn 0; và vào chế độ đo bằng phím `m` rồi bấm canvas (measure) — vẫn 0. Đổi kiểu đối chiếu (overlay) tôi **chưa** đo lớp phủ sau đó.
Nguyên nhân đọc mã: tour do `ViewerShellContainer` gắn (`ViewerShell/ViewerShell.container.tsx:149`); `exploded` và `measure` dùng *view* `ViewerShell`
không qua container (`ExplodedView/ExplodedView.container.tsx:20-29`, `MeasurementTool/MeasurementTool.container.tsx:27`), `overlay` không nhập vỏ.
⇒ **Fixture "bỏ qua tour" KHÔNG cần cho V9.** Nếu fixture dùng chung có sẵn thì gọi nó vô hại nhưng đừng làm nó thành tiền đề.
Chưa đo: *có* bước tour nào ẩn chờ neo ở hai màn này không (tôi chỉ đo "không hiện sau các thao tác trên"), nên câu đúng là "không hiện trong luồng đã đo", không phải "không bao giờ".

### 0.2 Cả ba màn là route mồ côi trong giao diện (đo lớp 2, grep)
`ROUTES.project.exploded / measure / overlay` được khai ở `src/routes/paths.ts:141,146,149-150` nhưng **không nơi nào trong `src/` gọi** (grep các dạng
`ROUTES.project.exploded|measure|overlay`, `/3d/exploded`, `/3d/measure`, `/overlay` ngoài `paths.ts` và test: 0 kết quả có nghĩa). Nghĩa: người dùng **không bấm được** tới ba
màn này từ sản phẩm; chỉ tới được bằng gõ URL. Ca "điều hướng từ màn khác tới đây" **không tồn tại** — nên mọi ca dưới dùng `page.goto`. Ghi thành PHÁT HIỆN P1.
(ghi chú lớp 1 ghi "NOT FOUND … chưa grep"; nay đã grep.)

### 0.3 Cửa bơm kho `store.spatial` — dùng có điều kiện Q1 của `questions.md`
Cách bơm (V6; V9 đo lớp 1 trên hai màn; tôi lặp lại trên `exploded` và `overlay`): sau `goto` + chờ `Mô hình đã dựng xong.` (`state:'attached'`),
`page.evaluate` `import('/src/store/index.ts')` + `import('/src/screens/viewer/ViewerShell/index.ts')` rồi `useStore.getState().setSpatial(VIEWER_FIXTURE_SPATIAL, null)`.
Bộ đệm canvas: `exploded` `300×150` → `960×362`, `measure` `300×150` → `960×460`, thanh trạng thái `0 tầng · 0 phòng · 0,00 m²` → `4 tầng · 14 phòng · 248,60 m²` (V9, đo).
**Mọi ca đánh dấu `[bơm]` chỉ hợp lệ nếu người dùng chọn Q1-A.** Nếu chọn Q1-B, các ca ấy bỏ; phần còn lại vẫn đứng vì chúng không cần bơm.
Bơm chỉ ở dev (`import('/src/…')`), và `goto` xoá kho. Chưa đo (mục "Cần đo trước" của questions.md): store sống sót khi điều hướng nội bộ — nhưng ở V9 **không cần**, vì không có điều hướng nội bộ (0.2).
Lưu ý `overlay` cần bơm **hai** thứ: `setFloors(VIEWER_FIXTURE_LEVELS)` (tệp `ViewerShell/viewerShellFixture.ts`, **không** xuất qua `index.ts`) *và* `setSpatial`; và kể cả vậy nó vẫn không có ảnh quét (mục 3).

### 0.4 "300×150" là bộ đệm, không phải kích thước hiển thị
V9 đo: `exploded` CSS 960×306, `measure` CSS 960×460, **bộ đệm** 300×150 (thuộc tính `width/height` chưa ai vẽ vào). Ca "cảnh đã dựng" đọc `canvas.width/height`, không `boundingBox`.

### 0.5 Vai
`engineer` mặc định (HOP-DONG 1.2). Vai `viewer`: `login?next=<đường>` + `viewer@example.com` + `matkhau-du-dai`, sau đó **không `goto` lần hai** (`e2e/viewer3d.spec.ts:185-205`). **Đo lớp 2:** đăng nhập viewer rồi `?next=` tới cả ba đường đều về đúng đường ấy (`location.pathname` khớp) — dùng được.

---

## 1. projectExploded — Tách tầng (`ExplodedView`) · `ROUTE_PATTERNS.projectExploded`

1. **Kiểu:** có route — `router.tsx:333` → `RouteExplodedView` → `ExplodedViewRoute` (lazy `router.tsx:43`).
2. **Đường tới:** `page.goto(ROUTES.project.exploded('project-1'))` (`paths.ts:141`); không có đường điều hướng khác (0.2). Vai viewer: `login?next=`.
3. **Tiền đề:** vai `engineer` cho `success`/`empty`; vai `viewer` cho `forbidden`. Không cờ, **không tour** (0.1). Cảnh chỉ dựng nếu bơm kho `[bơm]` (0.3). Lớp "đang dựng" `role=status` (`ExplodedView/ExplodedView.tsx:54`): cửa sổ chặn bấm **chưa đo** ở màn này.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không xem được các tầng tách rời nhau** để kiểm tra chồng lớp/thẳng hàng giữa các tầng — chức năng duy nhất của màn; hoặc thanh trượt/phím `E`/`Space` không đổi độ tách mà không báo gì. Riêng `empty` không được là màn trắng (A11).
5. **Đã kiểm ở tầng đơn vị:** `ExplodedView` 20 bài / 1 tệp (`don-vi-theo-man.md`; `ExplodedView.test.tsx` 403 dòng — V9): bảy trạng thái A11 (không ném, không trắng); a11y + tiếng Việt có dấu; thẻ nhãn tầng chỉ hiện khi tách đủ ngưỡng; **lệch trục 180 mm sinh `FloorIssue` (alignment/attention/amountMm 180)**; giảm chuyển động; không tô màu theo tầng (A4); **bấm thẻ tầng làm cả hai nửa hành động (`onStoreyActivate` + `onStoreyFrame`)**; chỉ báo thẳng hàng chạy trên lõi, lùi về trục. ⇒ e2e **không lặp** những thứ trên (đều từ props, không cần trình duyệt). Còn e2e đáng làm: điều hướng đúng route, **phím thật qua sổ đăng ký**, canvas thật.
6. **Ca luồng chính** (mỗi ca nói "đỏ thì mất gì" ở mục 4; ca không cứu được thì bỏ):
   - **X-1 mở & rỗng, không trắng** (không bơm): `goto` → chờ `Mô hình đã dựng xong.` → khẳng định câu `Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.` (`ExplodedView.tsx:46`), `đã tách 0%`, thanh trạng thái `0 tầng · 0 phòng · 0,00 m²` (V9 đo). **Rẻ nhất, không cần bơm.**
   - **X-2 `[bơm]` cảnh dựng thật:** sau bơm, chờ `4 tầng · 14 phòng · 248,60 m²`; khẳng định `canvas.width === 960` và `canvas.height > 150` (đọc thuộc tính; V9 đo `960×362`). Đây là thứ *chỉ trình duyệt thật chứng minh* (jsdom không có WebGL).
   - **X-3 `[bơm]` độ tách đổi thật:** bấm `radio` `tách hết` ⇒ `getByText(/^đã tách 100%$/)`; `gộp` ⇒ `0%` (V9 đo 100→0). Phím `E` từ `0%` ⇒ `100%` (V9 đo). `Space` ⇒ chạy chu kỳ rồi về `đã tách 0%` trong ≤ 2,5 s (V9 đo: giữa chu kỳ vẫn `100%` ở +150 ms). Dùng khẳng định có `expect.poll`/`toHaveText` với hạn chờ mặc định; **không** `waitForTimeout` (chu kỳ là chuyển động đã biết ⇒ ngoại lệ hợp lệ của HOP-DONG mục 8, nếu buộc phải chờ hết chu kỳ thì ghi chú).
7. **Ca bảy trạng thái:**
   - `empty` — **e2e**, X-1 (rẻ, thật).
   - `success` — **e2e** nhưng chỉ khi `[bơm]` (X-2/X-3).
   - `forbidden` — **e2e** (vai viewer, **đo lớp 2**): thấy `Bạn đang xem ở vai người xem nên không sửa được vị trí tầng.` (chữ thường "người xem", khác chữ hoa "Người xem" ở `Chỉ xem` của vỏ), `Chỉ xem` + `Bạn đang xem ở vai Người xem nên không sửa được mô hình.` (`role=alert`, `ViewerShell/ViewerInspector.tsx:82-88`). Lưu ý hai câu tiếng Việt **viết hoa "Người xem" khác nhau**: một câu chữ thường `vai người xem`, một câu chữ hoa `vai Người xem` — A6, xem PHÁT HIỆN P6.
   - `loading`, `partial` (tầng chưa dựng xong), `collapsed`, `error` (WebGL hỏng/dựng lỗi) — **thuộc tầng đơn vị** (bảy trạng thái test) — `error` cần `page.route`/mất WebGL: **chưa đo** trên trình duyệt.
8. **Ca bàn phím (A12):** phạm vi **đã đo** bằng `appShortcutRegistry.listShortcuts()` trong trang (V9): `canvas`: `1,2,3,4` `viewer.storey.N` · `0` fitAll · `O` · `Shift+H` · `Alt+H` · `F` · `E` `viewer.storey.separation` · `M` `viewer.tool.measure` · `/` `viewer.search.open` · `SPACE` `explodedView.separation.cycle`; `global`: `Mod+Z`,`Mod+Shift+Z`,`Mod+S`,`?`,`Escape`. **Không có `Escape` ở `canvas`** khi chưa chọn ⇒ `Esc` rơi xuống `global.closeTopLayer` (`router.tsx:287`) ⇒ **không đổi gì nhìn thấy** (V9 đo: `Escape` không đổi `đã tách 100%`). Ca **X-4** (`[bơm]`): `E` và `Space` qua sổ (X-3) + `Escape` khi không lớp nào ⇒ màn còn nguyên (khẳng định `đã tách` không đổi, cảnh còn). Bàn phím `Tab` đi hết luồng: **chưa đo** (không có dữ kiện thứ tự Tab). Không có `dialog`/`sidePanel`. Thứ tự Esc nhiều lớp: không áp dụng ở đây (không lớp nào để chồng) — bảng ở `muc-V8.md` 0.2.
9. **Ca tự lưu (A7):** không áp dụng — màn chỉ xem/đổi độ tách tạm thời, không ghi dữ liệu người dùng (`useExplodedView.ts` không gọi `commit`; **đọc lướt, chưa dò từng dòng** — nếu độ tách được lưu ở đâu đó thì ghi lại). Quét "không có nút lưu": ca toàn cục (HOP-DONG mục 2).
10. **Ca hoàn tác (A8/A9):** không áp dụng — không thao tác ghi.
11. **Ca định dạng (A6/A15):** **A15 e2e (không cần bơm):** `0,00 m²` ở thanh trạng thái, và (vai viewer, **đo lớp 2**) ray tầng `0,00 m`; sau bơm `248,60 m²`, `0,00 m · 3,20 m · 6,40 m · 9,60 m` (V9 đo) — bắt dấu ở vị trí thập phân `/\d,\d{2} m/u`. **A6:** nhãn 4 nút ray tầng `L-01FIXTURE0`… là mã bộ mẫu lọt ra chữ nhìn thấy (đã là Q8 của `questions.md`; xuất hiện cả ở màn này sau bơm — V9 đo text sau bơm chứa `L-01FIXTURE0 … L-04FIXTURE0`); **không viết ca bắt nó** trước khi Q8 được trả lời.
12. **Mốc neo** (V9 đo + `file:dòng`; các dòng lớp 1 tôi dò lại bằng grep):
    - `getByRole('region',{name:'Nội dung tách tầng'})` — `ExplodedView/ExplodedView.tsx:80` (tên **khác** `Nội dung mô hình 3D` của `/3d`)
    - câu rỗng `getByText('Tách tầng xuất hiện khi bản vẽ có từ hai tầng trở lên.')` — `ExplodedView.tsx:46` (**lớp 1 ghi "NOT FOUND"; đã tìm ra dòng**, hàm `EmptyMessage`)
    - trạng thái độ tách `getByText(/^đã tách \d+%$/)` (`LIVE_SEPARATION_PREFIX = 'đã tách '`, `ExplodedView/useExplodedView.ts:142`) — cạm bẫy: nhiều `role=status` cùng lúc (V9: `đã tách 0%`, `Mô hình đã dựng xong.`, một `region` không tên)
    - ba mức sẵn: `getByRole('radiogroup',{name:'Mức tách sẵn'})` — `ExplodedView/ExplodedViewRail.tsx:81` — với ba `getByRole('radio',{name:'gộp'|'tách vừa'|'tách hết'})` (`explodedViewTypes.ts:133-139`). **Sửa lớp 1:** V9 ghi "không phải button, chưa đo role"; **đo lớp 2: `BUTTON[role=radio]` trong `radiogroup`** — `getByRole('radio')` khớp
    - thanh trượt: `getByRole('slider',{name:'Độ tách các tầng'})` — `ExplodedViewRail.tsx:94,120` — là `<input type=range>` (đo lớp 2), đọc bằng `toHaveValue`/`aria-valuenow`; ban đầu có hai phần tử: một `slider` **không tên** (`=0`) và một tên `Độ tách các tầng` (V9 đo `sliders:["=0","Độ tách các tầng=0"]`) — dùng `{name}`
    - `getByRole('button',{name:'Chụp ảnh khung nhìn'})` — `ExplodedView.tsx:118`
    - thẻ tầng ẩn/hiện: `getByRole('button',{name:/^(Ẩn|Hiện) [Tt]ầng/u})` — mã thẻ `ExplodedViewFloorCards.tsx:158` viết `Ẩn tầng ${…}` (t thường) nhưng chữ nhìn thấy đo được là `Ẩn Tầng trệt` (T hoa; V9); hai chữ hoa/thường khác nhau — dùng regex `/i`, không đoán
    - vỏ dùng lại `muc-V8.md` mục 2 (`Vỏ khung nhìn 3D`, `Chế độ xem`, `Công cụ khung nhìn`, `Khối định hướng`, `Cụm thu phóng`, aside `Thanh tra đối tượng`)
13. **KHÔNG kiểm được:** (a) **cảnh trông ra sao** — chỉ `canvas.width/height` (không có gì trong DOM nói hình đúng); (b) **đường thẳng hàng 180 mm** — dữ liệu mẫu riêng chỉ có ở đơn vị (`SAMPLE_MISALIGNED_FLOORS`), bộ mẫu vỏ không mang độ lệch ⇒ ai chứng minh: đơn vị; (c) `error` do WebGL hỏng — **chưa đo**; (d) `partial` (tầng dựng dở) — thoáng qua, đơn vị; (e) `Chụp ảnh khung nhìn` — chỉ biết nút có mặt, **chưa đo** tác dụng; (f) khi **không bơm**, màn chỉ kiểm được vỏ + `empty` — đúng chữ ấy: cảnh không dựng vì `useExplodedView.ts:470-471,476,498` chỉ đọc kho (V9, mục 1 (b)); (g) 404 console lượt đầu: nguồn **chưa truy được** (V9), đừng khẳng định `exploded` sạch console.

---

## 2. projectMeasure — Công cụ đo (`MeasurementTool`) · `ROUTE_PATTERNS.projectMeasure`

1. **Kiểu:** có route — `router.tsx:334` → `RouteMeasurementTool` → `MeasurementToolRoute`.
2. **Đường tới:** `page.goto(ROUTES.project.measure('project-1'))` (`paths.ts:146`). Phím `M` *trên `/3d`* cũng bật công cụ đo nhưng **không sang route này** (`viewer.tool.measure` do vỏ đăng ký; V9). Route này không có nơi gọi (0.2).
3. **Tiền đề:** vai `engineer` (ghim được) hoặc `viewer` (đo được nhưng không ghim — đo lớp 2). Không tour (0.1). Danh sách phép đo **luôn ra `error`** do mock thiếu route (mục 6/7) — không phải tiền đề phải dựng, là *trạng thái mặc định*. Cảnh chỉ dựng khi `[bơm]`.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không đo được khoảng cách/diện tích trên mô hình**, hoặc bấm phím tắt/nhãn "phím M/Esc" mà không có tác dụng như nhãn hứa, hoặc lỗi tải danh sách phép đo không có lối thử lại (màn kẹt).
5. **Đã kiểm ở tầng đơn vị:** `MeasurementTool` 56 bài / 4 tệp — `MeasurementTool.test.tsx` 643 dòng, `useMeasurementTool.test.tsx` 522, `measurementToolGateway.test.ts`, `measurementToolScene.test.ts` (V9): bảy trạng thái; a11y + tiếng Việt; không dùng đỏ/vàng cho đường đo (A4); chip bắt điểm luôn gọi tên loại; giá trị đang đo không chạy số; **bốn hành động có đường chuột, từ props (A12)**; **bốn phím thật đăng ký ở `canvas` (M/Escape/Enter/Delete), gỡ khi unmount, Esc không nuốt Esc của lớp trên** (`MeasurementTool.test.tsx:465-518`); forbidden vẫn đo được nhưng không ghim; làm mờ hàng khác 0,3; ghim hỏng (422/mã lạ), xoá hỏng (404/403), hoàn tác xoá (500/409→201). ⇒ **"phím thật ở phạm vi canvas" đã phủ ở đơn vị — e2e KHÔNG lặp**; e2e chỉ thêm những gì đơn vị *không thể thấy*: nhãn quảng cáo phím mà **không phím nào đăng ký** (bảng dưới), và hiệu ứng thật lên ray công cụ của vỏ.
6. **Ca luồng chính:**
   - **M-1 `error` dựng sẵn — CA RẺ NHẤT CỦA CẢ KẾ HOẠCH, không cần `page.route`, không cần bơm, không cần tour:** `goto` → chờ `Mô hình đã dựng xong.` → khẳng định `getByText('Chưa tải được danh sách phép đo của dự án.')` (`MeasurementTool/useMeasurementTool.ts:191`) và `getByRole('button',{name:'Thử lại'})` (`MeasurementTool.tsx:229`); bấm `Thử lại` ⇒ số yêu cầu `GET /api/projects/project-1/measurements` tăng (đếm bằng `page.on('request')`, V9 đo 2→3) **và câu lỗi vẫn còn** (lượt thử lại lại 404). Nguyên nhân là mock thiếu route `measurements` (grep `src/api/__mocks__/client.ts`: 0 — V9; `measurementToolGateway.ts:609`). **Tên ca phải nói thật: "khi máy chủ không có phép đo" — không phải "khi mất mạng".**
   - **M-2 vào/ra chế độ đo trên ray vỏ:** phím `m` ⇒ `getByRole('button',{name:'đo (M)'})` `aria-pressed=true`, `quay quanh mô hình (R)` về `false` (V9 đo, lớp 2 lặp lại: `quay quanh mô hình:true` → `đo:true`); nút `bật tắt công cụ đo (phím M)` ⇒ về `quay quanh mô hình:true`. Chọn cặp (`m`, nút) vì **cả hai đều thật** (bảng F4).
   - **M-3 `[bơm]` bản nháp:** sau bơm, `m` ⇒ bấm một điểm trên canvas ⇒ nút `ghim phép đo (phím Enter)` xuất hiện; `Escape` ⇒ nút ấy biến mất **và ray vẫn `đo`** (**đo lớp 2**, lần đầu thấy nháp: `click → pin:true`; `Esc → pin:false, tool:"đo (M)"`). Tránh ghim thật (`Enter`): chưa đo POST mock ra sao ⇒ `chưa đo`, ca ghim/xoá/hoàn tác không viết.
7. **Ca bảy trạng thái:**
   - `error` — **e2e, không `page.route`** (M-1). Câu này *dựng sẵn* vì mock thiếu route; nếu ai vá mock thêm `measurements` thì M-1 đổi nghĩa — ghi vào PHÁT HIỆN P3.
   - `forbidden` — **e2e** (vai viewer, **đo lớp 2**): thấy `bạn chỉ có quyền xem dự án này, nên chưa ghim được phép đo. vẫn đo và đọc số bình thường.` (`role=alert`) và **ray chỉ còn 5 công cụ** — `đo (M)` bị **gỡ khỏi ray** (`useViewerShell.ts:153` `requiresEdit:true`) nhưng `M` vẫn vào chế độ đo (**đo lớp 2**: `M` ⇒ ray không nút nào `pressed`; nút overlay `bật tắt công cụ đo (phím M)` ⇒ về `quay quanh mô hình`). Không có `ghim` (`pin:false`). ⇒ ca chỉ nên khẳng định: alert có mặt + `đo (M)` không có trong ray + `M` không nổ. **Không** khẳng định "ray không có nút nào pressed khi đang đo" (đó là hệ quả, xem P5).
   - `empty` — `chưa có phép đo nào. nhấn M rồi chọn hai điểm trên mô hình.` và `0 phép đo` (V9 đo) hiện **cùng lúc với `error`**: hai trạng thái chồng nhau ở một màn — đo được, đơn vị chưa nói.
   - `success`/`partial`/`loading`/`collapsed` — đơn vị; `success` với danh sách cần `page.route` **chưa đo**.
8. **Ca bàn phím (A12) — MỎ MỐC NEO A12.** Tám nhãn tự khai phím (V9 F4; `file:dòng`; phạm vi lấy từ `appShortcutRegistry.listShortcuts()` **trong trang** — V9 đo, tôi kiểm lại `M`/Esc bằng bấm phím; không đoán):

    | Nhãn nguyên văn | `file:dòng` | Phím | Đăng ký thật? | Phạm vi | Bấm phím thật |
    |---|---|---|---|---|---|
    | `quay quanh mô hình (R)` | `ViewerShell/useViewerShell.ts:151` (nhãn ghép ở `ViewerToolRail.tsx:59`) | R | **KHÔNG** | — | không đổi `aria-pressed` (V9 + đo lớp 2) |
    | `kéo màn (H)` | `useViewerShell.ts:152` | H | **KHÔNG** | — | không đổi |
    | `đo (M)` | `useViewerShell.ts:153` (`MEASURE_COMBO`) | M | có `viewer.tool.measure` | `canvas` | ray → `đo` ✓ |
    | `mặt cắt (C)` | `useViewerShell.ts:154` | C | **KHÔNG** | — | không đổi |
    | `chọn (V)` | `useViewerShell.ts:155` | V | **KHÔNG** | — | không đổi |
    | `cô lập (Alt+H)` | `useViewerShell.ts:156` (`ISOLATE_COMBO`) | Alt+H | có `viewer.selection.isolate` | `canvas` | **chưa đo** (cần có đối tượng chọn) |
    | `thoát chế độ đo (phím Esc)` | `MeasurementTool.tsx:184` | Esc | có `measurementTool.draft.cancel` | `canvas` (luôn, không `enabled`, `useMeasurementTool.ts:846-856`) | **bỏ nháp, KHÔNG thoát công cụ** (M-3) |
    | `bật tắt công cụ đo (phím M)` | `MeasurementTool.tsx:191` | M | như `đo (M)` | `canvas` | ray đổi ✓ |
    | (không nhãn phím) `ghim phép đo (phím Enter)` | `MeasurementTool.tsx` (xem dòng dưới) | Enter | có `measurementTool.draft.pin` | `canvas` | chỉ hiện khi có nháp (M-3); **bấm Enter: chưa đo** |

    Nhãn thứ chín (`ghim phép đo (phím Enter)`) tôi thấy khi đo nháp; lớp 1 chỉ liệt kê tám. Dòng nguồn của nó: `MeasurementTool.tsx:176` (grep).
    Kết luận phạm vi: **không có `dialog`, không có `sidePanel`** ở màn này. Mọi phím màn đo đều ở `canvas`, `global.closeTopLayer` bị che bởi `measurementTool.draft.cancel` **suốt lúc màn mount** ⇒ ở màn này `Escape` **không bao giờ** tới `closeTopLayer` (khác `/3d` vỏ, nơi Esc chỉ đăng ký khi có chọn — `viewerShellShortcuts.ts:28-34`). Ca **M-4 (A12 dương, an toàn):** `m` ⇒ ray đổi; `Alt+H`: chưa đo nên **bỏ khỏi ca**. Ca **M-5 (A12 âm, nợ)** — bốn nhãn `R/H/C/V` không có phím: xem **Q-V9-1**; đề xuất gộp **một** ca, không bốn.
9. **Ca tự lưu (A7):** không áp dụng ở mức ca riêng — phép đo được ghim bằng hành động rõ ràng (`Enter`/nút), không tự lưu 800 ms; quét "không nút lưu" là ca toàn cục. Ghim thật: **chưa đo** (mục 6 M-3).
10. **Ca hoàn tác (A8/A9):** xoá phép đo có hoàn tác + xoá hỏng/hoàn tác hỏng đã ở **đơn vị** (`useMeasurementTool.test.tsx` 457-517). e2e: **chưa phủ** — cần danh sách phép đo tải được (`page.route` cho `ENDPOINTS.measurements.list`, lấy từ `src/api/endpoints.ts:116`, **không viết tay**) *và* cảnh dựng; cả hai `chưa đo`. Không hỏi người dùng ở đây (thiếu dữ kiện).
11. **Ca định dạng (A6/A15):** A15 — `0,00 m²` ở thanh trạng thái (V9 đo, không cần bơm), sau bơm `248,60 m²`; ray tầng `0,00 m…`. Đơn vị đo `m` (combobox) là kí hiệu, không phải số thập phân. A6: nhãn có phím trong ngoặc ("phím M") hợp A6 (mã phím hoa được); **các nhãn `thoát chế độ đo` không đúng nghĩa với việc nó làm** (P4) — không phải A6.
12. **Mốc neo** (V9 đo + dòng; ba dòng lớp 1 ghi NOT FOUND nay đã tìm):
    - `getByText('Chưa tải được danh sách phép đo của dự án.')` — `useMeasurementTool.ts:191`; `getByRole('button',{name:'Thử lại'})` — `MeasurementTool.tsx:229`; **cạm bẫy:** nếu ca chạy trên `/3d` đã có nút `Thử lại` khác, ở đây chỉ một
    - `getByRole('region',{name:'Lớp phủ công cụ đo'})`; `getByRole('radiogroup',{name:'Chọn chế độ đo'})` với bốn `radio`: `điểm đến điểm` · `vuông góc với bề mặt` · (`chiều cao`) · `diện tích mặt sàn` — nhãn `MEASURE_MODE_LABELS` ở `measurementToolTypes.ts:46-49` (**lớp 1 ghi "NOT FOUND"; đã tìm ra**; `chiều cao` ở dòng 48)
    - chip bắt điểm `getByText('chưa bắt vào đâu')` — `measurementToolGateway.ts:125` (`NO_SNAP_LABEL`; **lớp 1 ghi "NOT FOUND"; đã tìm ra**) — là `role=status`
    - `getByRole('region',{name:'Phép đo'})`/section `Phép đo`, `0 phép đo`, combobox đơn vị (chữ `m`), nút `Thu gọn mục Phép đo` — `MeasurementTool/MeasurementList.tsx:60,63` (`SECTION_TITLE`, `COLLAPSE_BUTTON_LABEL`)
    - tám(+1) nhãn phím: bảng mục 8
    - ray công cụ `getByRole('toolbar',{name:'Công cụ khung nhìn'})` — `ViewerToolRail.tsx:49-52`
    - **cạm bẫy:** hai nút tên `Phối cảnh` (ViewCube `ViewerOverlays.tsx:55` + mục combobox `Góc nhìn sẵn` `ViewerTopBar.tsx:72`) ⇒ `within(getByRole('group',{name:'Khối định hướng'}))`; `Esc` xuất hiện như chữ nút (`Esc`, `M` là `hint` của `KeyAction`, thân trang `… ⏎ Esc ⏎ M ⏎ chưa bắt vào đâu`)
13. **KHÔNG kiểm được:** (a) **ghim/xoá/hoàn tác** — không dựng được danh sách phép đo (mock 404) và cảnh cần bơm; **chưa đo** cả hai; ai chứng minh: đơn vị (đã có) ; (b) **giá trị đo có đúng không** (khoảng cách mm/diện tích) — cần ray-cast thật trong WebGL và đối chiếu số; DOM chỉ nói kết quả sau ghim; (c) **canvas 300×150 khi không bơm** ⇒ cảnh CHƯA dựng: nếu không chọn Q1-A thì màn chỉ kiểm được **vỏ + lớp phủ đo + `error`**, không kiểm được đo trên mô hình; (d) `Alt+H` (cô lập) — chưa đo; (e) Enter ghim — chưa đo; (f) lớp phủ đo có nhận con trỏ không — đơn vị nói `canvas … KHÔNG nhận con trỏ` (`useMeasurementTool.test.tsx:143`), trình duyệt: **chưa đo**.

---

## 3. projectOverlay — Đối chiếu bản vẽ (`OverlayComparison`) · `ROUTE_PATTERNS.projectOverlay`

1. **Kiểu:** có route — `router.tsx:322` → `RouteOverlayComparison`.
2. **Đường tới:** `page.goto(ROUTES.project.overlay('project-1','L1'))` (`paths.ts:149-150`). `L1` trong URL **không tác dụng** khi kho rỗng (V9). Không có đường điều hướng khác (0.2).
3. **Tiền đề:** vai `engineer` (điều khiển không tắt) hoặc `viewer` (điều khiển tắt kèm lý do). Không tour, không canvas (0.1). **Không cần bơm** cho các ca dưới (chúng đều chạy ở `empty`).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không đối chiếu được bản vẽ gốc với mô hình đã sinh** (kiểm độ khớp, thấy vùng lệch), hoặc thấy màn trắng/điều khiển chết khi dự án chưa có tầng. **Nhưng ở dev, mọi thứ có giá trị (ảnh, vùng lệch, số khớp) đều không dựng được** (mục 13) ⇒ mục này chỉ giữ những ca còn trả lời được câu 4 ở trạng thái `empty`.
5. **Đã kiểm ở tầng đơn vị:** `OverlayComparison` 65 bài / 6 tệp — dày nhất nhóm (`don-vi-theo-man.md`): bảy trạng thái (hook: loading→empty→error→partial→forbidden→collapsed, `useOverlayComparison.test.ts:487-620`); a11y + tiếng Việt; **xác nhận là hành động của người (A5)** (`OverlayComparison.test.tsx:176-215`, hook `:437-486`: `confirmMatch()` là đường duy nhất bật `isConfirmed`); ba lớp thị giác không bao giờ bốn (`:707`); gạch chéo chỉ ở vùng vượt dung sai; đường chia đôi (kéo, kẹp 0..1, mũi tên trái/phải, tay cầm focus được, bị khoá thì không báo); camera chung giữa hai khung; **ba con số khớp ở dung sai 20 mm (trung bình 8, lớn nhất 41, 3 vùng vượt)** và nới lên 50 mm ⇒ 0 vùng; đập viền; tắt kiểu "cạnh nhau" kèm caption; `canEdit===false` tắt mọi điều khiển và nói vì sao. ⇒ **e2e không lặp bất cứ thứ nào trong đó.**
6. **Ca luồng chính** (chỉ thứ còn trả lời được câu 4):
   - **O-1 mở & rỗng, không trắng:** `goto` → `getByRole('region',{name:'Màn đối chiếu bản vẽ'})` có mặt; `dự án này chưa có tầng nào để đối chiếu.`; ba số `—`; `chưa đo được vùng lệch nào.`; 0 canvas, 0 skeleton, 0 lỗi console, 0 lượt 404 (V9 đo; tôi lặp lại: `dialogs=0`, `overlay=0`). Rẻ nhất, thật.
   - **O-2 đổi kiểu đối chiếu là thao tác THẬT (đo lớp 2):** `getByRole('radio',{name:'trượt'})` bấm được ở `empty` (`aria-checked` chuyển `chồng lớp:false trượt:true`) và **xuất hiện thêm một `slider`** (số `slider` 1 → 2: đường chia đôi) — đo lớp 2: `divider: 2`. Ca này chứng minh điều mà đơn vị **không** chứng minh: DOM thật của toolbar + đường chia đôi cùng phản ứng trong trình duyệt. Giá trị (câu 4): đỏ thì người dùng đổi kiểu đối chiếu mà không có đường chia đôi để kéo. Khẳng định số `slider` (2) có phụ thuộc bộ mẫu ⇒ **dùng "tăng lên" chứ không cứng 2**. **CHÚ Ý — sửa lớp 1:** V9 ghi "nút `chồng lớp` không bấm được (đo: click lỗi)"; **sai**: `chồng lớp` là `radio`, không phải `button` — click lỗi vì tôi gọi `getByRole('button')`. Ở `empty` các điều khiển **không bị tắt** (đo lớp 2: `disabled=null` cho combobox/radio/slider/switch; chỉ `xác nhận mô hình khớp bản vẽ` là `disabled=true`).
7. **Ca bảy trạng thái:**
   - `empty` — **e2e** (O-1).
   - `forbidden` — **e2e** (vai viewer, **đo lớp 2**): `bạn không có quyền sửa, các điều khiển đang tắt.` xuất hiện **cùng với** `dự án này chưa có tầng nào để đối chiếu.` (`role=status`). Việc các điều khiển *thực sự* `disabled` khi viewer: **chưa đo** (tôi chỉ đo chữ, không đo `disabled`); đơn vị đã có (`OverlayComparisonToolbar.test.tsx:145`).
   - `success`/`partial`/`error`/`loading`/`collapsed` — **thuộc tầng đơn vị**. `error` ("sang màn hiệu chỉnh tỷ lệ", `OverlayComparison.tsx:78`) và `partial` cần ảnh quét từ `quality.assess`: **chưa dựng được ở dev** (mục 13).
8. **Ca bàn phím (A12):** phạm vi **đã đo** (V9): chỉ 5 phím `global` (`Mod+Z`, `Mod+Shift+Z`, `Mod+S`, `?`, `Escape`); **không có** phím `canvas`, `sidePanel`, `dialog` ⇒ `Escape` → `global.closeTopLayer` ⇒ không lớp nào để đóng, không đổi gì nhìn thấy. Không lớp nào chồng ở màn này ⇒ **không có ca xếp lớp Esc** (bảng ở `muc-V8.md` 0.2 không áp dụng). Ca **O-3:** `Tab` đưa focus vào `radiogroup kiểu đối chiếu` rồi mũi tên đổi radio — **chưa đo** (đo lớp 2 chỉ thấy sau 2 lần `Tab` focus vào `chồng lớp`, chưa thử mũi tên); đường chia đôi có mũi tên trái/phải ở đơn vị (`OverlayComparisonCanvas.test.tsx:324`). Gộp: một ca `Tab`→`ArrowRight` đổi kiểu, nếu Radix/`SegmentedControl` dùng roving tabindex thì mũi tên hoạt động — **đây là dự đoán, cần đo trước khi viết**.
9. **Ca tự lưu (A7):** không áp dụng — `xác nhận mô hình khớp bản vẽ` là hành động rõ ràng (A5), không tự lưu; quét "không nút lưu" là ca toàn cục.
10. **Ca hoàn tác (A8/A9):** **chưa phủ, chưa đo.** Xác nhận khớp là hành động ghi (`gateway.confirmFloorMatch`, `useOverlayComparison.ts:825`); nó có toast hoàn tác (A8) hay hộp thoại xác nhận (A9) không: đơn vị nói **không** đặt được `isConfirmed` ngoài `confirmMatch()` nhưng không nói gì về hoàn tác; ở dev nút `disabled` (empty) nên **không bấm được** ⇒ không đo được ở e2e. Không hỏi người dùng (thiếu dữ kiện).
11. **Ca định dạng (A6/A15):** A6 — toàn bộ nhãn viết thường kiểu câu (`chọn tầng`, `chồng lớp`, `khoá căn`, `xác nhận mô hình khớp bản vẽ`) và **không có chữ hoa đầu câu** — nhất quán với A6, đơn vị đã phủ `expectVietnamese`; e2e không lặp. A15: các số dung sai là số nguyên `mm`; `25%` là phần trăm nguyên (đo) ⇒ không có số thập phân để kiểm ở `empty`; ca A15 của màn này ở đơn vị (ba số `8/41/3`).
12. **Mốc neo** (đo lớp 2 xác nhận từng cái khớp `getByRole` — `count = 1`):
    - `getByRole('region',{name:'Màn đối chiếu bản vẽ'})` — `OverlayComparison/OverlayComparison.tsx:74,113`
    - `getByLabel('Khung đối chiếu bản vẽ gốc và mô hình')` (section) — `:75,114`
    - `getByRole('toolbar',{name:'thanh công cụ đối chiếu bản vẽ'})` — `OverlayComparisonToolbar.tsx:56,195,200`
    - `getByRole('radiogroup',{name:'kiểu đối chiếu'})` — `:59,133`; `getByRole('radio',{name:'chồng lớp'|'trượt'|'cạnh nhau'})` (tên là chữ nhìn thấy; dòng nhãn từng kiểu: **NOT FOUND (chưa dò)**)
    - `getByRole('slider',{name:'độ mờ ảnh nguồn'})` — `:60,164` (`25%`)
    - `getByRole('switch',{name:'khoá căn'})` — `:61`; **lớp 1 ghi "bộ dò thấy `button[switch]` không có tên … dùng `getByRole('switch')`"; đo lớp 2: `getByRole('switch',{name:'khoá căn'})` khớp 1 ⇒ có tên khả dụng, dùng `{name}`**
    - `getByRole('combobox',{name:'chọn tầng'})` — `:57` (chữ hiện `Chọn...`)
    - `getByRole('button',{name:'xác nhận mô hình khớp bản vẽ'})` — đo `count=1`, `disabled=true` ở `empty`
    - `getByRole('region',{name:'kết quả đối chiếu bản vẽ và mô hình'})` — `OverlayComparisonPanel.tsx:49,115`; danh sách `danh sách vùng lệch` — `:50`
    - `getByRole('region',{name:'Trạng thái của màn đối chiếu bản vẽ'})` — `OverlayComparison.tsx:76,158`; `role=status` — `:164`, `OverlayComparisonPanel.tsx:96` (**hai `role=status`** ⇒ `getByText`)
    - ba lớp: `getByRole('img',{name:'ảnh quét gốc'|'hình học sinh ra'|'vùng lệch'})` — `OverlayComparisonCanvasLayers.tsx:138`
    - **cạm bẫy:** hai `group` cùng tên `khung đối chiếu bản vẽ và mô hình` (`OverlayComparisonCanvas.tsx:83`) ⇒ `getAllByRole`
13. **KHÔNG kiểm được** (đo, không đoán): (a) **chồng bằng `<svg>` + `<img>` có điều kiện, không phải canvas** — V9 đo `svg=6`, `canvas=0`, `img=0`; `<img>` chỉ khi có ảnh quét (`OverlayComparisonCanvasLayers.tsx:191`); (b) **ảnh quét không dựng được ở dev**: bơm `setFloors(VIEWER_FIXTURE_LEVELS)`+`setSpatial` ⇒ combobox `Tầng trệt — không có ảnh bản vẽ gốc`, câu `tầng này nhập từ CAD nên không có ảnh bản vẽ gốc để đối chiếu.`, `img=0` (V9 đo; tôi không lặp) — nguồn ảnh là `client.quality.assess` (`overlayComparisonGateway.ts:338-345`), mock không cấp ảnh; (c) do đó **ba số khớp, danh sách vùng lệch, gạch chéo, đường chia đôi có nội dung, `xác nhận` (A5), `partial`, `error`** — "chưa có dữ liệu nên chưa kiểm được gì"; ai chứng minh: **đơn vị** (bảng mục 5); (d) hình học chồng khớp thật (ảnh vs vẽ) — không DOM nào nói; (e) khi có ảnh quét thật: `chưa đo`, cần `page.route` cho `quality.assess`, **CẦN TỪ điều phối**: có muốn dựng không.

---


<!-- ===== V10 ===== -->

## Nhóm V10

Lớp viết mục, 2026-09-30. Nguồn sự thật: `ghi-chu-V10.md` (gọi tắt **[V10]**), `HOP-DONG.md`,
`HOP-DONG-BO-SUNG.md` (mục 1: trình soạn thảo KHÔNG render, chỉ có tầng trình diễn), `probe-pascal-viewer.json`,
`don-vi-theo-man.md` (`PascalViewer` **33** bài, tất cả jsdom không WebGL). Không viết test, không sửa repo.
**[✓]** = tôi tự đọc lượt này; **[V10]** = từ ghi chú, chưa mở lại.

**Một bề mặt, hai mục.** Cờ `scene.pascal-viewer` tắt và cờ bật là hai trạng thái sản phẩm khác nhau
(một cái không có WebGL, một cái dựng cảnh 1406×190), không phải hai bước của một ca. Mã riêng:
- **V10-a** — cờ **tắt** (mặc định sản phẩm).
- **V10-b** — cờ **bật** (bật bằng `addInitScript` ghi `appfront-feature-flags`; bật là *vào* tính năng, không phải tránh nó).

**Tiền đề chung.** Route `/projects/:projectId/3d/pascal`; đo cả `project-1` lẫn `P-01` vào được, spec hiện có dùng `P-01` [V10]. Không cần đăng nhập
(HOP-DONG 1.2) — spec hiện có đăng nhập qua `?next=` nhưng không bắt buộc. Dữ liệu: **bộ mẫu trong màn** `VIEWER_FIXTURE_GRAPH`
(`ViewerShell/viewerShellFixture.ts:304`) qua `shouldUseViewerFixture` (mock + kho rỗng) — màn **không** đọc mock API và **không** đọc mã dự án.
Vách ngăn phải dựng trước (`pnpm pascal`): `scripts/run-playwright.mjs` chạy `pnpm exec vite` thẳng, không qua script `dev`; thiếu `public/assets/pascal/pascal-mount.js`
thì màn rơi `PASCAL-01` (docblock `pascal-viewer.spec.ts`). Dev server dùng chung 5199 đã chạy `pnpm pascal`.
Ranh giới A6 (mục 5 HOP-DONG): nhãn **do AppFront vẽ** thì A6 áp dụng; nhãn trong fork là nợ đã ghi (`docs/pascal/00-quyet-dinh.md:202`) — **ghi một lần ở đây, không đếm lại**. Bề mặt này chỉ có tầng trình diễn nên không có nhãn fork nào hiện ra.

**Số bài e2e hiện có:** `e2e/pascal-viewer.spec.ts` có **3** bài (dòng 294, 308, 384 [✓]). Kế hoạch này **mở rộng** nó, không viết lại.

---

## V10-a — Pascal vỏ, cờ TẮT

**1. Kiểu:** có route (`paths.ts:108` [V10]).

**2. Đường tới:** `ROUTE_PATTERNS.projectViewerPascal` với `:projectId` → `P-01` (hoặc `project-1`). Không ghi `localStorage`: cờ ở mặc định `false` (`lib/telemetry/flags.ts:157-165` [V10]).

**3. Tiền đề:** vai `engineer` mặc định (cờ là cổng, không phải vai; vai `viewer`: **chưa đo**). **Không** gọi `enablePascalFlag`. Không tour, không hộp thoại (`dialogs: 0` mọi lượt đo [V10]). Chờ: `getByRole('region',{name:'mô hình 3d'})` — có mặt ở cả bảy nhánh (`Frame` bọc, `PascalViewer.tsx:22-34` [V10]).

**4. Giá trị nghiệp vụ:** đây là cổng chặn một tính năng nặng (~1,5 MB gzip, ~1,6× CPU luồng chính — `flags.ts:161,163` [V10]) cho tới khi người trực bật. Đỏ ở đây ⇒ (a) tài khoản chưa được bật vẫn bị nạp WebGL và gói nặng; hoặc (b) màn trắng thay vì câu giải thích tiếng Việt; cả hai đều là thất bại mà A11 tồn tại để chặn.

**5. Đã kiểm ở tầng đơn vị** (33 bài toàn màn; phần liên quan cờ tắt, theo [V10]): `PascalViewer.test.tsx` — bảy trạng thái dựng đủ + mỗi trạng thái nói chính nó; A6 nhãn tiếng Việt; a11y; hộp Pascal chỉ có ở loading/success/partial, **bốn trạng thái kia không dựng hộp**. `PascalViewer.tree.test.tsx` — **cờ tắt KHÔNG dựng hộp và KHÔNG nạp gói** (jsdom, bộ nạp giả). `usePascalViewer.test.tsx` — máy trạng thái có `forbidden`.
**Điều `pascal-viewer.spec.ts` (bài 1, dòng 294) đã chứng minh — chép nguyên văn từ docblock:**
> 1. Cờ `scene.pascal-viewer` **tắt** (mặc định, `lib/telemetry/flags.ts:159`) thì màn nói "chưa bật" chứ không hiện khung Pascal nào — cổng của A11.

⇒ e2e KHÔNG lặp: nội dung từng trạng thái, chuỗi tiếng Việt, máy trạng thái.

**6. Ca luồng chính:**
- **A-1 (đã có, giữ nguyên):** `goto` → `getByRole('heading',{name:'chưa bật cho tài khoản này',exact:true})` hiện; `getByRole('status')` chứa "chưa bật"; `getByTestId('pascal-canvas')` **count 0** (đo `box: false`, `canvas: []` [V10]).
- **A-2 (MỚI, CẦN ĐO trước khi viết):** khi cờ tắt **không có request nào tới `/assets/pascal/pascal-mount.js`** (thẻ `<script src>` tới `MOUNT_URL`, `usePascalViewer.ts:40,96-125` [V10]). Đơn vị chỉ chứng minh "không nạp" trên bộ nạp giả; **chỉ trình duyệt thật chứng minh được rằng không một byte gói nặng rời máy**. [V10] **không đo** điều này (chỉ đo hộp/canvas vắng) ⇒ **chưa đo**; cần đo một lần bằng `page.on('request')` trước khi đưa vào bộ.
- Không đề xuất ca nào khác: nội dung/tiêu đề đã có đơn vị.

**7. Ca bảy trạng thái:** `forbidden`: **e2e** (A-1, đã có). Sáu trạng thái còn lại không thuộc cờ tắt — chúng thuộc **V10-b** và tầng đơn vị. Vai `viewer` với cờ tắt: **chưa đo**.

**8. Ca bàn phím (A12):** **không áp dụng** — cờ tắt không dựng khung nào để đóng. Phím `Escape` của màn đăng ký `scope:'canvas'`, `enabled: enabled && !isCollapsed` (`usePascalViewer.ts:301-310` [✓]); `enabled` lấy từ đâu khi cờ tắt: **chưa đo** (không suy ra). Tab đi hết màn: chưa đo (màn chỉ có tiêu đề + mô tả, không điều khiển).

**9. Ca tự lưu (A7):** không áp dụng (màn chỉ đọc).

**10. Ca hoàn tác (A8/A9):** không áp dụng (không sửa dữ liệu).

**11. Ca định dạng (A6/A15):** A6: chữ nguyên văn đã đo khớp — chú thích `màn xem 3D mới chưa bật cho tài khoản này.` (`pascalViewerTypes.ts:96`), tiêu đề H3 `chưa bật cho tài khoản này` (`PascalViewer.tsx:54`), mô tả `màn xem 3D mới đang chạy thử theo nhóm. người trực có thể bật nó cho bạn.` (`PascalViewer.tsx:55`) [V10]. Hai chuỗi có chữ hoa **"3D"** giữa câu — "3D" là ký hiệu, không phải vi phạm hiển nhiên; thuộc câu chữ A6 chung (câu Q2 của nhóm QC-a), không hỏi lại ở đây. A15: không áp dụng (không có số).

**12. Mốc neo** (nguyên văn; theo [V10] mục 2, nơi có [✓] tôi tự đọc):
- vùng ngoài cùng `getByRole('region',{name:'mô hình 3d'})` — `PascalViewer.tsx:25`; chuỗi gốc `pascalViewerTypes.ts:101` (`PASCAL_VIEWER_TITLE`). **Đừng** dùng `getByRole('region')` trần: có thêm `region "Thông báo"` (host toast).
- trạng thái `getByRole('status')` — `PascalViewer.tsx:28`; đo đúng 1 phần tử `role=status` ở mọi lượt.
- tiêu đề `getByRole('heading',{name:'chưa bật cho tài khoản này',exact:true})` (H3) — `PascalViewer.tsx:54`
- chú thích `màn xem 3D mới chưa bật cho tài khoản này.` — `pascalViewerTypes.ts:96`
- mô tả `màn xem 3D mới đang chạy thử theo nhóm. người trực có thể bật nó cho bạn.` — `PascalViewer.tsx:55`
- **không có** `pascal-canvas`: `getByTestId('pascal-canvas')` count 0 (dùng như khẳng định vắng mặt).

**13. KHÔNG kiểm được:**
- **Số ký tự thân trang.** HOP-DONG ghi 141; [V10] đo `document.body.innerText.length` = **145** (chênh 4, chưa rõ nguồn). **Đừng khẳng định `toHaveLength`**; khẳng định chuỗi.
- **Vai `viewer` với cờ tắt:** chưa đo.
- **A-2** (không tải gói khi cờ tắt): chưa đo — đơn vị `PascalViewer.tree.test.tsx` phủ trên bộ nạp giả.
- **Hiệu năng / hình đúng sai:** không thuộc cờ tắt (không dựng gì). Xem V10-b.
- **Hai danh sách docblock:** danh sách "không chứng minh" nguyên văn ở V10-b (trường 13); phần liên quan cờ tắt — **nguyên văn**:
  > - **Không kiểm `empty`/`error`/`R`/`E`.** Bảy trạng thái của A11 có bảy nguyên nhân (`docs/pascal/05-dung-man-pascal.md` mục 5); bài này chỉ đi qua ba — `forbidden`, `success`/`partial`, `collapsed` — vì ba nguyên nhân còn lại (dữ liệu rỗng thật, gói vách ngăn hỏng thật) không dựng lại được chỉ bằng thao tác trình duyệt trên bộ mẫu.
  (Câu này đã **lỗi thời một phần** — [V10] mục 6 chứng minh `error` dựng được bằng `page.route`; xem V10-b và PHÁT HIỆN P5.)
- Số bài đơn vị phủ phần còn lại: 33.

---

## V10-b — Pascal vỏ, cờ BẬT

**1. Kiểu:** có route (cùng route V10-a); bề mặt Pascal (một hộp `[data-testid="pascal-canvas"]` chứa một `<canvas>`; **không** phải trình soạn thảo — BỔ SUNG mục 1: shadow DOM không, iframe 0, `button`/`[role=tab]` thấy được 0, toàn thân trang **52 ký tự**).

**2. Đường tới:** như V10-a nhưng `addInitScript` ghi `localStorage['appfront-feature-flags'] = {"scene.pascal-viewer":true}` **trước mọi script** (`enablePascalFlag`, `pascal-viewer.spec.ts:~118` [✓ đọc hàm]; `useFeatureFlag` đọc `localStorage` ngay lượt vẽ đầu, `flags.ts:672-679` [V10]). Bật cờ là *vào* tính năng.

**3. Tiền đề:**
- Cờ bật bằng `addInitScript`; `pnpm pascal` đã chạy (có `pascal-mount.js`).
- Hạn chờ: Pascal ~1,6× CPU luồng chính (`flags.ts:163`) — **không đặt hạn như màn thường** và **không coi lượt chờ là phép đo nhịp khung** (HOP-DONG mục 5); bài hiện có dùng `PASCAL_RENDER_TIMEOUT_MS = 60_000` và `HEAVY_TEST_TIMEOUT_MS = 90_000`. Ca mới rẻ (PASCAL-01, `Esc`) **không** cần chờ WebGL nên dùng hạn thường (đừng nâng hạn cho chúng).
- Không tour, không hộp thoại. Vai `engineer` mặc định; `viewer`: **chưa đo**.
- Không đăng nhập bắt buộc.

**4. Giá trị nghiệp vụ:** đây là chỗ duy nhất trong cả đợt tích hợp Pascal chứng minh cảnh 3D dựng ra hình **thật** trong trình duyệt thật (33 bài đơn vị chạy trên jsdom không WebGL nên không bài nào từng thấy một khung hình). Đỏ ⇒ người bật cờ thấy một hộp trống, hoặc gói kéo tài sản ra ngoài máy (CDN), hoặc phím Esc bị Pascal nuốt mất lời hứa A12. Riêng lỗi nạp gói (`PASCAL-01`) đỏ ⇒ người dùng kẹt ở màn lỗi không thoát được.

**5. Đã kiểm ở tầng đơn vị** (33 bài: 14 + 5 + 14, tất cả jsdom không WebGL; [V10]):
- `PascalViewer.test.tsx` (14): bảy trạng thái dựng đủ + mỗi trạng thái nói chính nó; A6 nhãn tiếng Việt; a11y; hộp Pascal chỉ có ở loading/success/partial; nhánh không-có-GPU `PASCAL-03` không có nút thử lại, không sót chữ Anh (`:126-196`); lỗi hiện mã + nút thử lại gọi đúng hàm; thu gọn có nút mở lại; partial liệt kê từng loại + số đếm + lý do; success không liệt kê gì.
- `PascalViewer.tree.test.tsx` (5): cây thật container→view→hook: hộp có mặt lúc nạp; gói vách ngăn được nạp vào đúng hộp; nạp xong nói ra số đo; cờ tắt không dựng/không nạp; rời màn gọi `dispose`.
- `usePascalViewer.test.tsx` (14): máy trạng thái (forbidden / loading / empty / collapsed / `PASCAL-01` / `PASCAL-02` / partial); A12: `Esc` thu, `E` mở lại, nút chuột làm đúng việc phím làm (`:268`); node bị store dọn ⇒ partial + số bị dọn (`:234,303`); thử lại xoá dòng cũ; rời màn `dispose`; `PASCAL-02` (`:215`); `empty` (`:182`).
**Điều `pascal-viewer.spec.ts` ĐÃ chứng minh — chép nguyên văn từ docblock (`e2e/pascal-viewer.spec.ts`, đọc [✓]):**
> 1. Cờ `scene.pascal-viewer` **tắt** (mặc định, `lib/telemetry/flags.ts:159`) thì màn nói "chưa bật" chứ không hiện khung Pascal nào — cổng của A11.
> 2. Cờ **bật** thì hộp `[data-testid="pascal-canvas"]` xuất hiện.
> 3. Bên trong hộp ấy có một `<canvas>` THẬT — không phải hộp trống — với kích thước thật (`width`/`height` > 0). Đây là bằng chứng quan trọng nhất của cả tệp: 41 bài kiểm đơn vị của màn này (`docs/pascal/05-dung-man-pascal.md` mục 7) chạy trên jsdom, KHÔNG có WebGL, nên không bài nào trong số đó từng thấy một khung hình thật — bài này là bài ĐẦU TIÊN thấy.
> 4. Suốt lượt đăng nhập + dựng cảnh, không một request nào rời khỏi máy — đặc biệt không có `editor.pascal.app` (CDN mặc định của Pascal) hay `cdn.jsdelivr.net`. Hai vi phạm CSP này đã đóng ở commit `d14e380` (`vite.config.ts` ép `NEXT_PUBLIC_ASSETS_CDN_URL` về `/pascal` rỗng tại build time); bài này là hàng rào giữ chúng đóng.
> 5. `Esc` thu khung xem lại — lời hứa A12 "Esc đóng lớp trên cùng": khung Pascal là lớp trên cùng của màn này, và tắt nó không phá phần còn lại của màn (`<section aria-label="mô hình 3d">` vẫn còn).

Ghi chú số: docblock ghi "41 bài", số thật **33** (BỔ SUNG mục 5). Ngoài docblock, bài 2 còn khẳng định (đọc [✓]): PNG canvas > `PASCAL_FRAME_MIN_PNG_BYTES = 8_000` byte (`expect.poll`, chờ chứ không chụp một phát); không có dòng "phần mô hình" (không node nào bị store dọn); **listener phím ngoài `shortcutRegistry` = `[]`** (4 listener, cả 4 của `shortcutRegistry.ts:202`, 0 của Pascal); `findOffMachineRequests` rỗng; `trackBadAssetResponses` rỗng (kể cả tài sản trả `text/html`). ⇒ e2e KHÔNG lặp các thứ này.

**6. Ca luồng chính:**
- **B-1, B-2 (đã có, giữ nguyên):** bài 2 (cảnh thật) và bài 3 (Esc thu khung, dòng 384). Bài 3 đo `Esc` → hộp biến mất, H3 `khung xem đang thu gọn`, status chứa "thu gọn", vùng `mô hình 3d` còn nguyên.
- **B-3 (MỚI, một nửa đã đo [V10] mục 3):** **`Escape` thu khung ngay cả khi đang "đang nạp khung dựng hình…"** (đo: không cần chờ dựng xong) ⇒ hộp biến mất, status `khung xem đang thu gọn để đỡ tốn máy.`, nút `mở khung xem`; bấm `e` (chữ thường; khai báo `'E'`, `usePascalViewer.ts` phạm vi `canvas`) ⇒ hộp trở lại và về `đang nạp khung dựng hình…`. Test đơn vị `usePascalViewer.test.tsx:268` đã có `E` nhưng **không** đi qua `shortcutRegistry` thật gắn vào `window` thật ⇒ đây là thứ chỉ trình duyệt chứng minh. **`normaliseKey` (chữ hoa/thường): chưa đọc;** kết quả đo là bằng chứng.
- **B-4 (MỚI, một nửa đã đo [V10] mục 3):** hai lớp một lúc: bấm `?` mở `GlobalShortcutHelp` (`role="dialog"`, tiêu đề `Phím tắt`, nút `Đóng bảng phím tắt`) khi hộp Pascal có mặt ⇒ `Escape` **đóng đúng bảng phím tắt** (`dialogs` 1→0) và hộp Pascal **còn** (`box: true`); `Escape` lần hai ⇒ hộp thu. Đây là ca A12 "Esc đóng đúng MỘT lớp" giữa hai bề mặt của hai sổ phím. **Hạn chế đã ghi [V10]:** đo lúc trạng thái còn "đang nạp"; **chưa đo với cảnh đã "dựng xong"** ⇒ ca phải chờ dựng xong rồi mới bấm `?`, và kết quả ở trạng thái ấy là **chưa đo**.
- **B-5 (MỚI, đã đo ba cách [V10] mục 6) — `PASCAL-01`:** chặn đúng tệp `**/assets/pascal/pascal-mount.js` bằng `page.route` (không xoá tệp, không đụng repo) — cả ba cách ra cùng kết quả: `route.abort()`; `route.fulfill({status:404})`; `route.fulfill({status:200,contentType:'text/html',body:'<html></html>'})` (mô phỏng SPA fallback). Quan sát: status `không nạp được khung dựng hình.`; H3 `không nạp được khung dựng hình`; mô tả `thử lại một lần; nếu vẫn vậy thì báo người trực kèm mã PASCAL-01.`; nút `thử lại`; **không** hộp canvas. Chọn **một** cách cho bộ (khuyến nghị 404 — đơn giản nhất; đó là lựa chọn của người viết ca, không phải kết luận của [V10]); cách `text/html` đáng giữ một lần vì nó là hành vi thật của dev server (rơi về `index.html`).
  - **Ca mở rộng CHƯA CHẠY:** chặn → thấy PASCAL-01 → `page.unroute` → bấm `thử lại` (hoặc phím `R`, `enabled` khi `failure !== null`, `usePascalViewer.ts:312-321` [V10]) → thấy canvas. [V10]: "Chưa chạy". Không viết khẳng định "dựng lại được" cho tới khi chạy.
- Không đề xuất: PASCAL-02, PASCAL-03, `partial`, `empty` (xem 7 và 13).

**7. Ca bảy trạng thái:**
- `success`: **e2e** (B-1; bộ mẫu vỏ ra `success`: status `đã dựng xong toàn bộ bản vẽ.`).
- `loading`: quan sát được thoáng (`đang nạp khung dựng hình…`) và dùng trong B-3/B-4 — không viết ca riêng.
- `collapsed`: **e2e** (B-2/B-3).
- `error` (`PASCAL-01`): **e2e** (B-5).
- `partial`: **không dựng được** — bộ mẫu ra `success`, `droppedIds = 0`; muốn `partial` cần node bị store dọn; màn mock luôn đọc cố định `VIEWER_FIXTURE_SPATIAL`. Thuộc tầng đơn vị (`usePascalViewer.test.tsx:234,303`). e2e chỉ khẳng định `success`. **`partial` trên trình duyệt: chưa đo.**
- `empty`: **không dựng được** (cần đồ thị rỗng thật; màn mock luôn dùng bộ mẫu đầy). Đơn vị `:182`.
- `forbidden`: V10-a.
- `PASCAL-02`: **thuộc tầng đơn vị** (`usePascalViewer.test.tsx:215`). `page.route` không gây được: nó đến từ `onFatal` (`usePascalViewer.ts:259`), lỗi ném ở gốc React thứ hai; gây bằng một `pascal-mount.js` giả ném lỗi khi mount chỉ kiểm hợp đồng `onFatal` với một gói giả — việc `loadMount` giả của đơn vị đã làm. **Chưa đo.**
- `PASCAL-03` (máy không GPU): đơn vị (`PascalViewer.test.tsx:126-196`); máy e2e có GPU. Không dựng lại.

**8. Ca bàn phím (A12):** B-2, B-3, B-4. **Phạm vi đã grep:** `usePascalViewer.ts:301-310` [✓] — `id:'pascalViewer.collapse'`, `combo:'Escape'`, **`scope:'canvas'`**, `enabled: enabled && !isCollapsed`; `R` thử lại (`:312-321`, chỉ khi `failure !== null`), `E` mở lại (`:323-331`, chỉ khi thu gọn). Thứ tự `SCOPE_PRIORITY` = `dialog` → `sidePanel` → `canvas` → `global` (`shortcutRegistry.ts:59-64`): `global.closeTopLayer` (`shortcutRegistry.ts:678-684`, nối `router.tsx:287` tới `uiSlice.closeDialog` [V10]) chạy sau — Pascal ở `canvas` **đứng trước** nó nên không bị lấy mất phím. **Hai sổ phím không tranh nhau** — đo hai lớp: (i) spec hiện có: 4 listener phím, cả 4 của `shortcutRegistry.ts:202`, 0 của Pascal (gói `viewer` chỉ nghe phím sau `walkthroughMode` mặc định `false`; công cụ `nodes` không mount); (ii) [V10] đo thêm: `?` rồi `Escape` (B-4). Tab đi hết luồng: **chưa đo**, nhưng màn có 0 `button`/`[role=tab]` thấy được khi cảnh dựng xong (BỔ SUNG mục 1) — chỉ có nút `thử lại`/`mở khung xem` ở nhánh lỗi/thu gọn.

**9. Ca tự lưu (A7):** không áp dụng — màn chỉ đọc; 0 nút lưu (probe `saveButtons`/`buttons: []`).

**10. Ca hoàn tác (A8/A9):** không áp dụng — thu/mở khung là trạng thái giao diện, không phải thay đổi dữ liệu; không hành động không hoàn tác.

**11. Ca định dạng (A6/A15):**
- A6: chữ nguyên văn đã đo khớp ở mọi nhánh ([V10] mục 2): loading `đang nạp khung dựng hình…`; success `đã dựng xong toàn bộ bản vẽ.`; error `không nạp được khung dựng hình.`; collapsed `khung xem đang thu gọn để đỡ tốn máy.`, H3 `khung xem đang thu gọn` (`PascalViewer.tsx:123`), nút `mở khung xem` (`:125`). Đều viết thường kiểu câu. Một ca quét chữ dùng chung của cả đợt.
- **A15: không áp dụng** — bốn số hiện ra đều là số đếm nguyên (đo `tầng 4 · tường 16 · ô mở 0 · phòng 14`).
- **Bốn số và A14 — ĐỪNG khẳng định `tường 16`/`ô mở 0` như "số chuẩn A14"** ([V10] mục 5). Chỉ `tầng 4` và `phòng 14` **khớp cả hai bộ** (A14 và bộ vỏ), nên khẳng định an toàn là hai số ấy. Câu chọn bộ nào làm chuẩn thuộc Q1.

**12. Mốc neo** (nguyên văn; theo [V10] mục 2, nơi có [✓] tôi tự đọc):
- vùng `getByRole('region',{name:'mô hình 3d'})` — `PascalViewer.tsx:25`; trạng thái `getByRole('status')` — `PascalViewer.tsx:28`
- hộp canvas: `getByTestId('pascal-canvas')` **hoặc** `getByLabel('khung dựng mô hình 3d')` — `PascalViewer.tsx:154` / `:155`. `getByLabel` khả thi; testid là **ngoại lệ hợp đồng mục 7** (một `<canvas>` không có role).
- canvas `getByTestId('pascal-canvas').locator('canvas')` — không có role; đo **1406×190** (cả vùng đệm lẫn CSS). Hộp có `min-h-[12rem]` (= 192 px): canvas 190 sát mức tối thiểu, **không** chiếm hết màn; vùng bấm nhỏ; chưa đo ở cửa sổ khác.
- loading `đang nạp khung dựng hình…` — `pascalViewerTypes.ts:91`; success `đã dựng xong toàn bộ bản vẽ.` — `:94`; partial `đã dựng xong, nhưng một số đối tượng chưa chuyển sang được.` — `:93` (**chưa đo** trên trình duyệt); empty `bản vẽ chưa có đối tượng nào để dựng.` — `:92` (**chưa đo**); error chú thích `không nạp được khung dựng hình.` — `:95`
- error: H3 `không nạp được khung dựng hình` — `PascalViewer.tsx:106`; mô tả `thử lại một lần; nếu vẫn vậy thì báo người trực kèm mã PASCAL-01.` — `:110`; nút `getByRole('button',{name:/thử lại/})` — `:112`. **Bẫy đã đo:** `textContent` của nút là `"thử lạithử lại"` (nhãn lặp hai lần trong DOM); **tên truy cập thật của nút: chưa đo** ⇒ dùng regex `/thử lại/`, không `exact`, cho tới khi đo.
- collapsed: nút `mở khung xem` — `PascalViewer.tsx:125` (`textContent` cũng lặp đôi; cùng cảnh báo)
- bốn con số `<dt>` `tầng` · `tường` · `ô mở` · `phòng` — `PascalViewer.tsx:168,172,176,180`; thân trang đo `"đã dựng xong toàn bộ bản vẽ.\n\ntầng\n4\ntường\n16\nô mở\n0\nphòng\n14"` (**52 ký tự**, BỔ SUNG mục 1).
- khung bảng phím tắt (cho B-4): `getByRole('dialog')` tên `Phím tắt`, nút `Đóng bảng phím tắt` (đo [V10]; dòng nguồn **chưa ghi**).

**13. KHÔNG kiểm được** (chép nguyên văn danh sách "không chứng minh" từ docblock, kèm lý do đã đo và ai chứng minh):
> - **Không kiểm chất lượng hình** — không so khớp ảnh, không biết tường có đúng vị trí, vật liệu có đúng màu, hay đồ đạc có đúng chỗ. Canvas có điểm ảnh không phải là canvas có điểm ảnh ĐÚNG.
> - **Không kiểm hiệu năng.** `lib/telemetry/flags.ts:163` ghi Pascal tốn "khoảng 1,6 lần CPU luồng chính" so với màn cũ — con số đó không được đo lại ở đây, và không hạn chờ nào trong bài này là một phép đo nhịp khung.
> - **Không đi qua hai trạng thái lỗi** `PASCAL-01`/`PASCAL-02` (`pascalViewerTypes.ts:39-43`): tạo ra chúng cần một gói vách ngăn cố ý hỏng hoặc một `onFatal` giả — việc của bài kiểm đơn vị (`usePascalViewer.test.tsx`), không phải của trình duyệt thật.
> - **Không phân biệt `success` với `partial`.** Cả hai đều dựng hộp canvas; bài này không đọc bảng `<dl>` số đo hay danh sách "chưa chuyển sang được" để biết đang ở nhánh nào — chỉ cần MỘT trong hai để có bằng chứng "dựng được cảnh thật".
> - **Không kiểm `empty`/`error`/`R`/`E`.** Bảy trạng thái của A11 có bảy nguyên nhân (`docs/pascal/05-dung-man-pascal.md` mục 5); bài này chỉ đi qua ba — `forbidden`, `success`/`partial`, `collapsed` — vì ba nguyên nhân còn lại (dữ liệu rỗng thật, gói vách ngăn hỏng thật) không dựng lại được chỉ bằng thao tác trình duyệt trên bộ mẫu.

Cập nhật theo số đo [V10] (mục 7 của ghi chú; tôi không đo lại): trong năm việc trên, **kéo được vào e2e rẻ**: `PASCAL-01`, `error`, `R` (một nửa, ca mở rộng chưa chạy) và `E` (đo). **Vẫn không**: chất lượng hình đúng sai (chỉ "có hình học" — PNG > 8 000 B; "đúng" thuộc `pnpm e2e:visual`/`renderContract.test.ts`, và ảnh chuẩn `linux` chưa có — CLAUDE.md bẫy 5), hiệu năng (một phép đo riêng ngoài e2e thường; CPU 12 luồng/6 worker làm số e2e vô nghĩa), `PASCAL-02`, `partial`, `empty`.
Không kiểm được thêm: **CSP thật** (xem Q2 và P1: dev/`pnpm e2e` không gửi header CSP — `content-security-policy: null` mọi lượt đo; job `e2e:preview` với CSP nguyên văn là T9.6, chưa làm, `IMPLEMENTATION_STATUS.md:444` [V10]); **vai `viewer`** (chưa đo); **hình đúng sai của toà nhà** (bộ mẫu chỉ có tường bao + phòng, 0 ô mở, 0 đồ đạc — mọi cửa/cửa sổ/đồ đạc không có trên màn này; xem P2); **~16 bề mặt editor của fork — chưa có nơi gọi trong AppFront** (BỔ SUNG mục 1, không viết 16 mục).

---


<!-- ===== V11 ===== -->

## Nhóm V11

Nguồn: `HOP-DONG.md` → `HOP-DONG-BO-SUNG.md` (mục 1, 7.1, 7.2) → `ghi-chu-V11.md` (sự thật lớp 1), thêm `don-vi-theo-man.md`, `probe-35-routes.json`,
`questions.md` (để nối số Q). Không sửa repo, không viết test, không chạy cổng tổng.
Quy ước: **"V11"** = chép từ `ghi-chu-V11.md`; **"đo lớp 2"** = tôi tự mở Chrome (`channel:'chrome'`, 1440×900, dev server 5199) để xác minh — ghi từng chỗ;
**"chưa đo"** = đúng nghĩa. `file:dòng` từ gốc repo trừ khi ghi khác. `e2e` trong bảng coverage nghĩa "kế hoạch có ca", không nghĩa "đã xanh".

**Vì sao MỘT mục:** trường 4 của hợp đồng ("đỏ ở đây thì người dùng mất gì") trả lời được cho *cả nhóm* bằng đúng một câu — *người dùng không mất gì, vì họ không bao giờ thấy các
bề mặt này* — nên theo HOP-DONG mục 6 ("ca nào không trả lời được thì BỎ") không có 16 mục để giữ. Cái đáng giữ là **một ranh giới**: lúc nào bề mặt bắt đầu hiện, kế hoạch phải biết.

---

## Xác minh lớp 2 — các mảnh bằng chứng của lớp 1 tôi đã kiểm lại (không đo lại cả nhóm)

| Điều lớp 1 khẳng định | Kiểm lại (tôi chạy) | Kết quả |
|---|---|---|
| Không nơi nào trong `src` nhập `@pascal-app/editor` | `grep -rn "pascal-app/editor" src vite.pascal.config.ts scripts` | **0 dòng**; `package.json:29-32` khai đủ bốn gói `core`/`editor`/`nodes`/`viewer` |
| Sidebar chỉ có 2 tab, không phải 5 | đọc `vendor/pascal/packages/editor/src/components/ui/sidebar/icon-rail.tsx:30-42` | **đúng**: `panels = [sitePanel, settingsPanel]` (`Site`, `Settings`) |
| `00-quyet-dinh.md:197` lạc hậu ("`editor` và `nodes` không được cài") | đọc dòng ấy + `package.json:30-31` | **đúng lạc hậu** — dòng đọc được ngay dưới đề mục "Hệ quả của chỉ-xem trước", trong khi hai gói đã cài |
| Hộp `pascal-canvas` chỉ chứa một `<canvas>`, 0 điều khiển | `page.evaluate` trên `/projects/P-01/3d/pascal`, cờ bật bằng `addInitScript` (khoá `appfront-feature-flags`), chờ 3 s sau khi canvas hiện | `canvas:1, button:0, tab:0, dialog:0, [role]:0, input/select/textarea/a[href]:0, innerText:0 ký tự`; `canvas.width×height = 1406×190`; `role=status` = `đã dựng xong toàn bộ bản vẽ.`; toàn trang `button:0` |
| Hộp không nằm trong shadow DOM/iframe | V11 đo (không lặp) | tin V11 |
| 251 tệp `.js` trong `public/assets/pascal/`, 9 chuỗi chữ | V11 đo (không lặp) | tin V11; tôi **không** chạy lại `grep -l -F` |

Ghi chú khác biệt nhỏ: V11 ghi "cờ bật … qua `addInitScript`"; spec thật dùng đúng khoá ấy (`e2e/pascal-viewer.spec.ts:72,75,125-131`), nên phép đo lớp 2 dùng cùng cơ chế với sản phẩm.

---

### V11 — Trình soạn thảo Pascal: chưa có nơi gọi, nên chưa kiểm được · fork `@pascal-app/editor` (~16 bề mặt, 6 nhóm)

1. **Kiểu:** bề mặt Pascal (fork), **không được dựng**. Nhóm chủ duy nhất gần nhất: route `ROUTE_PATTERNS.projectViewerPascal` = `/projects/:projectId/3d/pascal`
   (`src/routes/paths.ts`, `router.tsx:332`) — nhưng nó dựng gói `viewer`, **không** phải `editor` (`src/components/pascal/PascalFrame.tsx:9` nhập `{ Viewer } from '@pascal-app/viewer'`; grep `editor` trong `src`: 0).
2. **Đường tới:** **KHÔNG CÓ.** Không route, không nút, không phím nào của AppFront dựng `Editor` (V11 #6-#7; đo lớp 2 grep: 0). Vai: không liên quan (không dựng ⇒ không ai có quyền gì).
3. **Tiền đề:** để tới *màn chủ* (không phải bề mặt): cờ `scene.pascal-viewer` bật (mặc định tắt, `lib/telemetry/flags.ts:157-165`) bằng `addInitScript` (khoá `appfront-feature-flags`, `e2e/pascal-viewer.spec.ts:72,75,125-131`) — bật cờ là **vào** tính năng, không phải tránh nó (cấm 3 không bị vi phạm). Không tour (tour do `ViewerShellContainer` gắn; màn Pascal không dùng vỏ đó — V11 #5: hộp không có button; đo lớp 2: toàn trang `button:0`).
   Thời hạn: dùng hằng đã có `PASCAL_RENDER_TIMEOUT_MS = 60_000` (`spec:92`) và `HEAVY_TEST_TIMEOUT_MS = 90_000` (`spec:115`) — **không tạo hằng mới, không nâng** (cấm 4). Pascal tốn ~1,6× CPU luồng chính (`flags.ts:163`); một lượt chờ không phải phép đo nhịp khung.
4. **Giá trị nghiệp vụ:** cho 16 bề mặt ⇒ **không có** (người dùng không thấy chúng ⇒ đỏ cũng không mất gì) ⇒ **BỎ** 16 mục con (mỗi bề mặt một dòng lý do ở trường 13). Cho **ca hàng rào** (H-1, trường 6) ⇒ có: nếu có người gắn `Editor` vào màn Pascal mà không ai cập nhật kế hoạch, thì người dùng sẽ thấy sidebar/hộp thoại/thanh điều khiển **tiếng Anh** (nợ A6 `docs/pascal/00-quyet-dinh.md:202`) và nhận **tính năng chưa có kế hoạch kiểm** — e2e vẫn xanh vì không ai kiểm. H-1 đỏ đúng lúc ấy ⇒ đó là lúc cần biết.
5. **Đã kiểm ở tầng đơn vị:** với *bề mặt editor*: **không có** ở phía AppFront — mã fork nằm ở `vendor/pascal/packages/editor/src/` (**không** phải `src/vendor/...`, HOP-DONG-BO-SUNG 7.1) và test của fork chạy bằng `bun test src` (`editor/package.json`; V11), **không** nằm trong `pnpm test`/`pnpm coverage` của AppFront; việc vitest có nhặt chúng không: **chưa đo**. Tệp tồn tại nhưng **chưa đọc, chưa chạy**: `components/viewer/viewer-stage.test.tsx`, `viewer-stage-modes.test.ts` (V11 2.3). Với *màn chủ Pascal* (bề mặt AppFront): `PascalViewer` **33 bài / 3 tệp** (`don-vi-theo-man.md`; BO-SUNG mục 5: đặc tả ghi 41, số thật 33), tất cả jsdom **không WebGL** ⇒ không bài nào từng thấy một khung hình thật (`usePascalViewer.test.tsx`, `PascalViewer.test.tsx:126-196` phủ nhánh GPU không hỗ trợ). **Không thuộc mục này** — nó là `e2e/pascal-viewer.spec.ts` + mục của nhóm khác; ở đây chỉ trỏ tới.
6. **Ca luồng chính:** **không áp dụng — bề mặt không được dựng.** Ngoại lệ DUY NHẤT là **ca hàng rào H-1**:
   - **H-1 — "hộp Pascal chỉ chứa khung dựng, không chứa điều khiển editor".** Dựng bằng cách **mở rộng** `e2e/pascal-viewer.spec.ts` (không viết lại; HOP-DONG mục 5). Thêm vào bài `cờ bật` (`spec:308-…`), ngay sau dòng `expect(canvasBox.locator('canvas')).toHaveCount(1, …)` (`spec:332`) — *đã có sẵn nửa đầu của hàng rào*: đúng một `<canvas>`:
     - `canvasBox.getByRole('button')` → `toHaveCount(0)`
     - `canvasBox.getByRole('tab')` / `getByRole('tablist')` → `toHaveCount(0)`
     - `canvasBox.getByRole('dialog')` và `getByRole('alertdialog')` → `toHaveCount(0)`
     - (tuỳ chọn) `canvasBox.locator('input, select, textarea, a[href]')` → `toHaveCount(0)`
     Quan sát được thay đổi bao nhiêu: chỉ **bốn lớp vai tương tác** (button/tab/dialog/nhập liệu). **Cố ý không** khẳng định "`[role]` đếm 0" (đo lớp 2 là 0, nhưng nếu fork thêm `role="img"` cho canvas thì đó không phải editor gắn vào — sẽ báo động giả).
     Trước chờ: `canvasBox` phải `toBeVisible({timeout: PASCAL_RENDER_TIMEOUT_MS})` (bài đã làm ở `:324`), rồi các khẳng định `toHaveCount(0)` chạy **sau** khi canvas có thật — nếu khẳng định `count 0` chạy trước khi cảnh dựng thì xanh giả (hộp còn trống).
     Đo lớp 2 xác nhận nó **xanh hôm nay**: `canvas:1, button:0, tab:0, dialog:0, input…:0` (bảng đầu mục).
7. **Ca bảy trạng thái:** **không áp dụng** cho bề mặt editor (không dựng ⇒ không có trạng thái để đo). Cho màn chủ: `forbidden` (cờ tắt) / `success`+`partial` (cờ bật) / `collapsed` (Esc) đã có ở `pascal-viewer.spec.ts` (3 bài); `PASCAL-01`/`PASCAL-02` dựng được bằng `page.route` (HOP-DONG-BO-SUNG 7.5) — thuộc mục của nhóm màn chủ, **không** ở đây.
8. **Ca bàn phím (A12):** **không áp dụng** cho editor. Phạm vi phím thật của màn chủ (đọc mã, V11): `Esc` `scope:'canvas'`, `enabled: enabled && !isCollapsed` — `src/screens/viewer/PascalViewer/usePascalViewer.ts:301-310` (BO-SUNG 7.6: hoạt động cả lúc đang nạp); `E`/`R` cùng phạm vi `canvas` (`:316-331`, theo grep đầu file: `scope:'canvas'` ở `:305,316,327`). Không `dialog`/`sidePanel`. Editor có bộ phím riêng ở fork (`use-keyboard.ts`, `04-doi-chieu` dòng 66) nhưng **không đăng ký** vào sổ AppFront vì không dựng — **chưa đo** sổ đăng ký trên màn Pascal (ai cần biết phải đo `appShortcutRegistry.listShortcuts()` trong trang, như V9).
9. **Ca tự lưu (A7):** **không áp dụng — bề mặt không được dựng.**
10. **Ca hoàn tác (A8/A9):** **không áp dụng — bề mặt không được dựng.** (`delete-confirmation-dialog` của fork là hộp xác nhận của *fork*; A9 của AppFront chứng minh ở `ShareScreen`, không ở đây — V11 2.5.)
11. **Ca định dạng (A6/A15):** **không áp dụng — bề mặt không được dựng.** Nợ A6 của Pascal (toàn bộ nhãn fork là tiếng Anh) **ghi một lần ở đây, không thành ca**: `docs/pascal/00-quyet-dinh.md:202`, `unsupported-gpu-fallback.tsx:5-9`. Ranh giới: nhãn **AppFront vẽ** (`PascalViewer.tsx`, `pascalViewerTypes.ts:90-98`: `mô hình 3d`, `khung dựng mô hình 3d`, bảy chú thích trạng thái…) thì A6 áp dụng và đơn vị đã phủ; nhãn **fork vẽ** là nợ. Hộp `pascal-canvas` bọc `DIV.transition-colors duration-700 bg-[#fafafa]` của fork (V11 #5): hai vi phạm (mục B `duration-700`, A1 `#fafafa`) **nợ đã ghi** ở `00-quyet-dinh.md` (đoạn ~200-203: "`transition-colors duration-700` trên Canvas"). Thẻ GPU tiếng Anh `unsupported-gpu-fallback.tsx` đã bị `PascalFrame.tsx:33-43` chặn bằng `onRendererUnavailable` — **không** lọt ra màn (`PascalViewer.test.tsx:126-196`).
12. **Mốc neo:** cho H-1 và màn chủ (không cho editor):
    - `getByTestId('pascal-canvas')` — `src/screens/viewer/PascalViewer/PascalViewer.tsx:154` (đọc lớp 2: `data-testid="pascal-canvas"` ở dòng 154, `aria-label="khung dựng mô hình 3d"` ở dòng sau; **ngoại lệ testid hợp lệ**: một `<canvas>` không role, hợp đồng mục 7)
    - `getByLabel('khung dựng mô hình 3d')` — cùng khối `PascalViewer.tsx:150-157`
    - `getByRole('region',{name:'mô hình 3d'})` — `<section aria-label="mô hình 3d">`, V11 #1 (`:25`, **dòng chưa tự dò**, tin V11)
    - `canvasBox.locator('canvas')` — không role; `spec:331-332` đã dùng
    - `role=status` `đã dựng xong toàn bộ bản vẽ.` (đo lớp 2)
    - Nhãn **editor**: **NOT FOUND trên màn** (cả 6 nhóm). Nguồn tiếng Anh của fork để dành, *không* chép lại ở đây (V11 mục 2 đã liệt kê; lặp lại là mười sáu lần nợ A6): sidebar tab thật là **2** (`Site`, `Settings`, `icon-rail.tsx:30-42`), không 5.
13. **KHÔNG kiểm được** (trường dài nhất; mỗi nhóm một dòng bằng chứng + **vì sao bỏ mục riêng**):

    | Nhóm (số bề mặt) | Bằng chứng KHÔNG render | Vì sao bỏ mục riêng | Ai chứng minh phần còn lại |
    |---|---|---|---|
    | **sidebar** (icon-rail, item-catalog, zone-panel, function-tree, plugins-panel, site-panel…) | hộp Pascal: 0 `button`/`tablist` (V11 #5, **đo lớp 2**: `button:0, tab:0`); `PascalFrame.tsx:84-88` chỉ dựng `<Viewer …>`; grep `editor` trong `src`: **0** (lớp 2) | đỏ ⇒ không ai mất gì (không ai thấy) | không ai; hàng rào H-1 |
    | **action-menu** (control-modes, structure-tools, furnish-tools, measurement-control, view-toggles, camera-actions, …) | như trên; 0 dòng riêng trong `04-doi-chieu` (V11 2.2) | như trên | không ai |
    | **khung xem của editor** (viewer-stage, controls-bar, units-panel, stage-switcher) | như trên; `viewer-stage-switcher.tsx:29,34` (`aria-label="Viewer layout"`) — 0 lần trong gói dựng (V11 #8, không lặp) | như trên. **Tên dễ nhầm:** `<Viewer>` AppFront dựng là gói `viewer`, còn bốn tệp này ở gói `editor` | test fork `viewer-stage.test.tsx`/`viewer-stage-modes.test.ts` — **chưa chạy, chưa đọc** |
    | **mặt bằng 2D** (floorplan-panel, riser-diagram-panel) | như trên; `riser-diagram-panel.tsx:76-77` `aria-label="DWV riser diagram"` — 0 trong gói dựng | như trên. `riser-diagram-panel` (ống DWV) không liên quan bản vẽ kiến trúc; **đừng lẫn với màn 2D riêng của AppFront** | không ai |
    | **hộp thoại** (keyboard-shortcuts, audio-settings, load-build, delete-confirmation, level-duplicate) | 0 `dialog` trong hộp (V11, lớp 2); 8 chuỗi chữ: 0 tệp, `Duplicate Level`: 1 tệp (mã `nodes` nhập lẻ, V11 #8) | như trên. A9 của AppFront không chứng minh ở đây | `ShareScreen` (A9 thật) |
    | **điện thoại** (mobile-selection-bar, mobile-panel-sheet, mobile-tab-bar) | như trên; **không phải** route `mobileViewer` của AppFront (probe: canvas 300×150, cảnh chưa dựng) | như trên | mục `mobileViewer` của nhóm khác |

    Cộng dồn thêm những gì **cũng không kiểm được** dù không thuộc 16: (a) **chất lượng hình** (canvas có điểm ảnh ≠ có điểm ảnh ĐÚNG; `pascal-viewer.spec.ts` 1b); (b) **hiệu năng** (~1,6× CPU không đo lại); (c) `PASCAL-01/02` — có `page.route` dựng được (BO-SUNG 7.5) nhưng thuộc nhóm màn chủ; (d) `success` vs `partial` (bảng `<dl>` số đo) — nhóm màn chủ; (e) bốn con số `tầng/tường/ô mở/phòng` lệch A14 (Q4 của `questions.md`) — không thuộc editor; (f) CSP: 1 vi phạm `eval` (BO-SUNG 7.4, Q5) — nhóm màn chủ.
    **Điều kiện mở lại** (thay cho `test.skip`, cấm 4): mục V11 mở lại khi **một** trong ba xảy ra — (i) H-1 đỏ (ai đó gắn `Editor`); (ii) `grep -rn "pascal-app/editor" src` ≠ 0; (iii) người dùng quyết định phạm vi A "xem + sửa" (`00-quyet-dinh.md`, đoạn "Hệ quả của chỉ-xem trước") không còn hoãn. Lúc ấy viết lại 6 nhóm từ nhãn ở `ghi-chu-V11.md` mục 2, và nợ A6 vẫn ghi một lần.

**Vì sao một ca hàng rào đáng hơn 16 ca `test.skip`** (câu điều phối yêu cầu nói rõ):
- 16 ca `test.skip` là 16 chỗ **im lặng**: chạy thì báo "skipped", không chứng minh điều gì, và không có gì kích hoạt chúng khi bề mặt hiện ra — người gỡ `skip` đầu tiên phải biết trước là nó đã hiện. Cấm 4 chỉ cho phép `skip` khi kèm lý do + điều kiện mở lại; điều kiện "khi editor được gắn" **không quan sát được bằng máy** ở dạng `skip`.
- H-1 là **một** khẳng định đếm được (`count 0` ×3-4) đặt vào bài **đã tồn tại**, tốn ~0 giây thêm (không thêm lượt đăng nhập, không thêm cờ), **xanh hôm nay** (đo lớp 2) và **đỏ đúng lúc** một điều khiển editor xuất hiện trong hộp ấy. Đỏ ở H-1 là *tín hiệu*, không phải nợ.
- H-1 không nhân nợ A6: nó không đọc chữ nào của fork, chỉ đếm vai.
- **Giới hạn thật của H-1** (không hứa hơn): nó chỉ thấy editor được gắn **bên trong** `[data-testid="pascal-canvas"]`. Nếu ai gắn `Editor` ở chỗ khác (route khác, `body`, portal) thì H-1 vẫn xanh. Bù bằng điều kiện (ii) ở trên (`grep` — đó là lệnh, không phải bài; **chưa** có bài e2e/CI nào chạy nó; ghi làm gợi ý cho điều phối, không phải quyết định của tôi).
- H-1 cũng không thấy editor nếu nó dựng **trong** canvas (WebGL/`<canvas>` thuần) — DOM không nói gì. Chấp nhận.

---


<!-- ===== V12 ===== -->

## Nhóm V12

Nguồn đọc theo thứ tự: `HOP-DONG.md` → `HOP-DONG-BO-SUNG.md` (thắng) → `ghi-chu-V12.md` (sự thật lớp 1) → `don-vi-theo-man.md`, `probe-35-routes.json`, `questions.md` (để nối số Q có sẵn), `muc-V9.md` (để theo cùng khuôn).
Không sửa repo, không viết test, không chạy cổng tổng.

Quy ước: **"V12"** = chép từ `ghi-chu-V12.md`. **"đo lớp 2"** = tôi tự mở Chrome (`channel:'chrome'`, 1280×800, dev server 5199) để xác minh một điều ghi chú lớp 1 ghi "chưa đo" hoặc còn ngờ — ghi từng chỗ. **"chưa đo"** = đúng nghĩa, không suy ra. `file:dòng` tính từ `src/screens/` trừ khi ghi khác. Cột `e2e` trong bảng coverage nghĩa là *kế hoạch này có ca e2e*, không nghĩa "đã xanh".

---

## 0. PHẦN DÙNG CHUNG

### 0.1 Cửa bơm kho — bốn màn phụ thuộc nó, và nó là Q1 chứ không phải quyết định của mục này
V12 (0.1) đo: `store.spatial` / `floors` / `project` không route nào nạp (`setFloors`/`setProject`: 0 nơi gọi ngoài kho và test; `setActiveFloor`: một nơi, `viewer/OverlayComparison/useOverlayComparison.ts:881`). Vào thẳng, `projectRules` · `projectRuleSettings` · `projectExport` · `projectData` đều ở `empty`. Cửa bơm (`import('/src/store/index.ts')` + `normalizeSpatial(createSampleBuilding())` + `setFloors` + `setActiveFloor`) **chạy được** (V12 đo; tôi không đo lại) nhưng **chỉ dev, chỉ sau `goto`**, đúng họ cửa mà `questions.md` **Q1** hỏi cho QC.
⇒ Mọi ca gắn **`[bơm]`** chỉ hợp lệ nếu người dùng chọn Q1-A (hoặc ngoại lệ hẹp của khuyến nghị B). Ca **không** gắn `[bơm]` đứng độc lập. Tôi viết mục theo hướng: *ca không-bơm là xương sống, ca `[bơm]` là lớp thêm* — để mục vẫn còn giá trị nếu Q1 ra B.
Cảnh báo kỹ thuật cho ca `[bơm]` (V12): bơm `createSampleBuilding()` chưa `normalizeSpatial` làm màn nổ (đó cũng là cách dựng ca `error` của `projectData`, nhưng là *lỗi do người viết test*, không phải ca sản phẩm — xem `projectData`); `Ctrl+Z` toàn cục hoàn tác chính lượt bơm (`zundo` theo dõi `spatial`) nên **không dùng `Ctrl+Z` trong ca bơm**.

### 0.2 `EditorTour` ở nhóm này — chỉ `projectExport` có, và chỉ khi có neo
`HOP-DONG-BO-SUNG.md` 7.8 ghi `projectExport` "không hiện". Đúng cho *vào thẳng* (kho rỗng ⇒ nút `xuất` — neo `exportResult` — không có ⇒ 0 bước sống ⇒ tour ẩn; V12 0.2). V12 còn đo: sau bơm + đổi cỡ viewport thì tour hiện `1 / 1`, `lấy tệp mang đi`, nút `bỏ qua`/`tiếp theo`, `Esc` đóng nó. Không màn nào khác trong nhóm gắn tour (`ExportPanel.container.tsx:192` là chỗ duy nhất; các màn còn lại không nhập `EditorTourContainer` — đọc `grep` lớp 1 đã ghi 3 màn: `projectWalls` · `/3d` · `projectExport`).
⇒ Fixture `tour.ts` **không phải tiền đề** của 9 trong 10 bề mặt; chỉ ca `[bơm]` của `projectExport` cần, và **đóng bằng nút `bỏ qua`** (không cờ, không khoá).
Hệ quả phải nói thẳng: chip **`xem hướng dẫn`** (`system/EditorTour/EditorTour.tsx:382-384`, `fixed right-[16px] top-[16px]`) hiện sau khi bỏ qua và **che hoàn toàn nút `chia sẻ`** (V12 0.3: chip `[1137,16,126×32]` vs nút `[1160,24,95×32]` ở 1279 px; `elementFromPoint`=`SPAN:xem hướng dẫn`). Mọi ca cần bấm `chia sẻ` sau khi tour bị bỏ qua dùng `focus()`+`Enter`.
Đo lớp 2 (điều kiện kích tour, mục "cần đo trước" của `questions.md`): tôi **không** đo lại — chỉ ghi nhận `resize` kích được trên `/export` sau bơm (V12), phù hợp với V2.

### 0.3 Vai
`engineer` là fallback khi `goto` thẳng (`HOP-DONG.md` 1.2). Đăng nhập `?next=` (khuôn `e2e/viewer3d.spec.ts:185-205`; nhãn `Thư điện tử` / `Mật khẩu` / `Đăng nhập`, `e2e/viewer3d.spec.ts:170-172`), **không `goto` lần hai**.
**Đo lớp 2 (điều V12 ghi "chưa đo") — vai `viewer` trên các màn V12:**

| Đường (đăng nhập `viewer@example.com`, không bơm) | Kết quả đo lớp 2 |
|---|---|
| `/projects/project-1/export` | **`forbidden` thật, không cần bơm**: `không có quyền xuất bản vẽ` + `chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc.` (`useExportPanel.ts:596-604`: `forbidden` xét **trước** `empty`) |
| `/projects/project-1/data` | giống `engineer`: `empty` (không `forbidden` — `canView = roles.length>0`) |
| `/projects/project-1/rules` | giống `engineer`: `empty` |
| `/projects/project-1/rules/settings` | giống `engineer`: `23/25 luật đang bật` + `chưa có bộ luật để cài đặt` |
| `/tai-khoan` | vào được, thư `viewer@example.com` |
| `/billing` (V12) | dòng `Chỉ quản trị viên có thể thay đổi gói.`; `Nâng gói` **disabled** — đo lớp 2 với `engineer`: `[true,true]` |

⇒ V12 ghi `projectExport` `forbidden`: "chưa đo `viewer`" — **nay đã đo**, và đây là ca `forbidden` rẻ nhất của nhóm vì không cần bơm.

### 0.4 Số bài đơn vị (từ `don-vi-theo-man.md`) — để hiệu chỉnh nơi e2e đi sâu
`AccountSettings` 151/8 tệp (đếm lại đo lớp 2: 21+31+11+16+19+21+13+19 = 151 ✓) · `SpatialJsonViewer` 38 · `ExportPanel` 25/2 · `BillingScreen` 22 · `UserManagement` 20/3 · `RuleReport` 19 · `RuleSettings` 15 · `ViolationDetail` 14 · `ModelLibrary` 13 · `VersionHistory` 13.
Không màn nào trong nhóm ≤ 10 bài; màn mỏng nhất (VersionHistory, ModelLibrary 13) lại là hai màn e2e ít đi sâu được (một chết, một chỉ đọc). ⇒ Chỗ e2e đáng giá nhất nhóm không phải nơi ít bài đơn vị mà là **nơi đơn vị không thể chạm**: trọng tài `Escape` giữa tấm trượt/hộp thoại, vai thật qua đăng nhập, tự lưu bằng đồng hồ thật, và nhánh `forbidden` của `adminUsers`.

### 0.5 Hai nợ chung, ghi một lần
- **A6 "viết thường, kiểu câu"**: đi theo hướng B của `questions.md` Q10f — nửa "tiếng Việt đủ dấu" là `đơn vị`; nửa "viết thường" **chưa phủ** ở e2e. Trong nhóm này nhiều nhãn viết hoa chữ đầu (`Chạy kiểm tra lại`, `Xem`, `Xác nhận đã xử lý`, `Cây`, `Thô`, `Tìm theo khoá hoặc giá trị`, `Đổi ảnh`, `Xoá tài khoản`, `Thanh toán`, `Nâng gói`, `Mời người dùng`) cùng nhãn viết thường (`chia sẻ`, `xuất`, `họ tên`, `vô hiệu hoá`). Nhãn `Chưa có thay đổi` viết hoa đến từ `components/feedback/SaveIndicator.tsx:48` dùng chung. **Không mục nào của tôi khẳng định "phải viết thường"**; tôi liệt nhãn nguyên văn để lớp sau đối chiếu nếu Q10f ra A.
- **A7**: 0/10 bề mặt có nút mang chữ "lưu" (bộ dò 35/35, `HOP-DONG.md` mục 2) — đã thay bằng **một** ca quét-toàn-bộ ở chỗ khác; các mục dưới không viết ca "đếm 0 nút lưu".

---

## 1. projectRules — Kiểm tra luật không gian · `ROUTE_PATTERNS.projectRules`

1. **Kiểu:** có route — `/projects/:projectId/rules` (`src/routes/paths.ts:100`; `RulesRoute`, `rules/RuleReport/RuleReport.container.tsx:205-206`).
2. **Đường tới:** `page.goto(ROUTES.project.rules('project-1'))` (`paths.ts:156`). Từ màn khác: `Xác nhận đã xử lý` của chính màn (`useRuleReport.ts:602`) đi *ra* `/export`, không đi *vào* đây; không nơi nào khác đi vào — **chưa grep** nơi gọi vào `ROUTES.project.rules` (tôi không đo lại).
3. **Tiền đề:** vai `engineer` (fallback) đủ; không cờ; **không tour**; không lớp chắn (0 dialog, 0 status lúc vào — V12). Ca `[bơm]` cần kho (mục 0.1).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không biết bản vẽ vi phạm luật nào trước khi xuất bản** — hoặc thấy một trạng thái sai (nút "Chạy kiểm tra" dẫn tới lỗi thay vì kết quả) và không biết vì sao.
5. **Đã kiểm ở tầng đơn vị:** `RuleReport.test.tsx` — **19 bài / 1 tệp**: số luật thật 25/23 (`:158-205`), không tên luật viết cứng (`:208`), 7 trạng thái dựng từ props (`:466`), `expectAccessible`+`expectVietnamese` (`:502`), chip mức độ dùng nhãn domain (`:523`), bọc `MemoryRouter` (`:542`), năng lực false gỡ khỏi DOM (`:589`), đỏ chỉ ở chip/chấm (`:625`), `message` nguyên văn (`:676`), hàng đã xử lý còn thấy (`:692`), **R-73: bấm dòng mở tấm trượt, Esc đóng** (`:731`). e2e **không** lặp: cấu trúc bảng, thứ tự nhãn, năng lực.
6. **Ca luồng chính:**
   - **R-1 (không bơm) `empty` → `error` bằng chính CTA của sản phẩm.** `goto` → thấy `heading 'Chưa chạy kiểm tra luật'` + thân `Bản vẽ này chưa được đối chiếu với bộ luật không gian. Chạy một lượt để biết những gì cần sửa trước khi xuất bản.` → bấm `button 'Chạy kiểm tra'` (exact) → thấy `heading 'Không chạy được lượt kiểm tra'` + nút `Thử lại`. *Đo V12:* đúng chuỗi này; nguyên nhân `runReport` ném khi `graph===null` (`useRuleReport.ts:365-368`).
     *Bất biến:* A11 (không màn trắng ở cả `empty` và `error`). *Đỏ thì:* người dùng bấm nút chính duy nhất của màn và rơi vào lỗi mà không biết đó là hiện trạng hay hỏng.
     *Cảnh báo cho người viết:* ca này **mã hoá một điều đáng ngờ** (xem PHÁT HIỆN F2). Đặt tên nói rõ "hiện trạng", và gỡ/đổi khi F2 được chữa.
   - **R-2 `[bơm]` bảng đầy đủ + chạy lại.** bơm → chuyển SPA sang `/rules` → thấy `tổng số kiểm tra`, `đạt`, `cảnh báo`, `vi phạm` là bốn số **nguyên**, và **tổng nhóm = số ở `vi phạm`** (đừng hard-code 147/35/15/23 — V12 đo trên `createSampleBuilding()`, khác 189/182 của test đơn vị, và có thể đổi theo bộ mẫu; xem Q4 `questions.md`) → bấm `Chạy kiểm tra lại` → bảng vẫn còn, không nhấp nháy về rỗng.
     *Bất biến:* A11 `success`. *Đỏ thì:* người dùng không xem được kết quả kiểm tra.
   - **R-3 `[bơm]` `Xác nhận đã xử lý` bị khoá khi còn vi phạm.** Khẳng định `disabled` (V12 đo `true`) — **chỉ một dòng**, đơn vị đã có tương đương ở `useRuleReport.ts:597-603`? *Không lặp:* nếu đơn vị đã khoá (chưa đọc test), bỏ ca này. **Chưa đo** xem đơn vị có khẳng định `disabled`; ca này *giữ tạm* là "kiểm khoá thật trong trình duyệt", sẵn sàng bỏ.
7. **Ca bảy trạng thái:** `success` **e2e** `[bơm]` (R-2) · `empty` **e2e** không bơm (R-1 bước đầu) · `error` **e2e** không bơm (R-1 bước sau) · `forbidden` **thuộc tầng đơn vị** (route không truyền `canEdit`, mặc định `true` — `useRuleReport.ts:341`; đo lớp 2: `viewer` cũng thấy `empty`, không `forbidden`) · `loading` **thuộc tầng đơn vị** (`runRules` đồng bộ, chỉ thoáng) · `partial` **thuộc tầng đơn vị** (`skipped.length>0`, không tham số route) · `collapsed` **thuộc tầng đơn vị** (`isCompact`, không tham số route).
8. **Ca bàn phím (A12):** màn có route, không lớp riêng. `Tab` đi hết luồng chính (chuỗi nút nhóm luật, `Chạy kiểm tra lại`): **chưa đo** — không viết ca cho tới khi đo. `Esc` đóng tấm trượt: xem mục 3 (không lặp ở đây).
9. **Ca tự lưu (A7):** không áp dụng — màn chỉ đọc, không dữ liệu để lưu.
10. **Ca hoàn tác (A8/A9):** không áp dụng — `Xác nhận đã xử lý` chỉ điều hướng sang `/export` (`useRuleReport.ts:602`), không đổi dữ liệu; `canAutoFix/canDismiss` hằng `false` (`ruleReportGateway.ts:48-52`) nên không có nút sửa/bỏ qua để hoàn tác.
11. **Ca định dạng (A6/A15):** A6: nhãn hỗn hợp hoa/thường (mục 0.5) — không khẳng định. A15: không áp dụng ở màn này (số nguyên); phần thập phân (`độ tin cậy 0,82`) nằm ở tấm trượt — mục 3.
12. **Mốc neo:** `getByRole('heading',{name:'Kiểm tra luật không gian'})` `RuleReport.tsx:283` · `getByRole('button',{name:'Chạy kiểm tra',exact:true})` `RuleReport.tsx:172` · `getByRole('button',{name:'Chạy kiểm tra lại'})` `RuleReport.tsx:290` · `getByRole('heading',{name:'Chưa chạy kiểm tra luật'})` `RuleReport.tsx:170` · `getByRole('heading',{name:'Không chạy được lượt kiểm tra'})` `RuleReport.tsx:181` · `getByRole('button',{name:'Thử lại'})` `RuleReport.tsx:186` · `getByRole('navigation',{name:'đường dẫn trang'})` `RuleReport.tsx:82` · nhóm luật `getByRole('button',{name:/^lỗ mở nằm trọn/})` (`aria-expanded`/`aria-controls`, `RuleReportGroups.tsx:93-94`; **tên chứa cả "nghiêm trọng · N mục chưa xử lý" ⇒ bắt buộc regex đầu chuỗi**) · dòng `getByRole('button',{name:/^Lỗ mở D-DOOR0000000/})` `RuleReportGroups.tsx:158-165` · `getByRole('button',{name:'Xác nhận đã xử lý'})` `RuleReport.tsx:342`. Không `data-testid`.
13. **KHÔNG kiểm được:** `forbidden` · `loading` · `partial` · `collapsed` (route không có tham số tới chúng; đơn vị chứng minh); nút sửa tự động / bỏ qua / xem trước 3D (không tồn tại — `canAutoFix/canDismiss/canPreview3d` `false`); nội dung `độ tin cậy`/số cụ thể (thuộc mục 3). Ai chứng minh: `RuleReport.test.tsx`.

---

## 2. projectRuleSettings — Cài đặt bộ luật · `ROUTE_PATTERNS.projectRuleSettings`

1. **Kiểu:** có route — `/projects/:projectId/rules/settings` (`paths.ts:101`; `RuleSettingsRoute`, `rules/RuleSettings/RuleSettings.container.tsx:144-146`).
2. **Đường tới:** `page.goto(ROUTES.project.ruleSettings('project-1'))` (`paths.ts:157-158`).
3. **Tiền đề:** `engineer` đủ; không cờ; không tour; không lớp chắn. Ca `[bơm]` cần kho (mục 0.1).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **đổi một ngưỡng/bật-tắt một luật mà không biết nó đã được lưu chưa**, hoặc thấy hai câu trái nhau về việc có luật hay không (F1).
5. **Đã kiểm ở tầng đơn vị:** `RuleSettings.test.tsx` — **15 bài / 1 tệp**: số luật 25/23 từ sổ đăng ký (`:115`), luật thay thế đang tắt (`:125`), không viết cứng câu luật (`:140`), 7 trạng thái (`:189`), a11y+tiếng Việt (`:212`), đếm hiện đúng (`:227`), luật tắt còn trong DOM ở độ mờ thấp (`:257`), **A7 không nút Lưu** (`:292`), tắt hết → cảnh báo hậu quả (`:325`), `impactCaption` 25 hàng (`:346`), ngưỡng ngoài khoảng (`:382`), preset "nhà xưởng" + khôi phục (`:435`). e2e **không** lặp: danh sách 25, cảnh báo tắt-hết, ngưỡng ngoài khoảng.
6. **Ca luồng chính:**
   - **RS-1 (không bơm) màn nói ra hai câu — chờ Q-V12-A.** `goto` → thấy `heading 'cài đặt bộ luật không gian'`, chữ `23/25 luật đang bật`, `Chưa có thay đổi`, và tiêu đề `chưa có bộ luật để cài đặt` + `Chưa có luật không gian nào được nạp cho dự án này.` *Đo V12:* đúng cả hai; nguồn: `23/25` từ sổ luật của domain không phụ thuộc kho (`useRuleSettings.ts:352`), `empty` từ `graph===null` (`useRuleSettings.ts:616-618`). **Ca này chỉ viết sau khi Q-V12-A có câu trả lời** vì nó khẳng định (A) hay không khẳng định (B) hai câu cùng hiện.
     *Bất biến:* A11 `empty` không màn trắng. *Đỏ thì:* người dùng đọc "chưa có luật nào" trong khi có 25.
   - **RS-2 `[bơm]` tự lưu bằng đồng hồ thật.** bơm → chuyển SPA sang `/rules/settings` → bật/tắt `switch 'bật hoặc tắt luật: lỗ mở nằm trọn trong tường chứa nó'` → **trong <800 ms** vùng `status` chứa `Có thay đổi chờ đồng bộ` và dòng đếm thành `22/25 luật đang bật` → **sau ≥800 ms** vùng `status` chứa `Đã lưu lúc HH:mm` (regex `/^Đã lưu lúc \d{2}:\d{2}$/`). *Đo V12:* 0,3 s `Có thay đổi chờ đồng bộ`; 1,5 s `Đã lưu lúc 14:07`. Chờ bằng `expect(...).toHaveText`, không `waitForTimeout`; hạn chờ chữ "đã lưu" ≥ 800 ms + biên (không nâng timeout chung).
     *Bất biến:* A7 (tự lưu 800 ms, nói ra qua `role=status`) — chỉ e2e với đồng hồ thật chứng minh được; đơn vị dùng đồng hồ giả. *Đỏ thì:* người dùng sửa luật, rời màn, và mất thay đổi mà không biết.
   - **RS-3 `[bơm]` không có nút lưu ở trạng thái đã bơm.** Đã thay bằng ca quét-toàn-bộ chung (mục 0.5) — **không viết ở đây**; ghi để khỏi lặp.
7. **Ca bảy trạng thái:** `empty` **e2e** không bơm (RS-1) · `success/ready` **e2e** `[bơm]` (RS-2) · `partial` **thuộc tầng đơn vị** (lỗi ngưỡng hoặc `saveState` saving/pending — thoáng qua; RS-2 chỉ *đi ngang* qua nó, không khẳng định) · `loading` **thuộc tầng đơn vị** (`configQuery.isPending` qua cổng bộ nhớ, thoáng) · `error` **chưa đo** (gateway `read` là cổng bộ nhớ, không endpoint để `page.route` — V12 ghi "chưa đo xem có chặn được không"; tôi không suy ra) · `forbidden` **thuộc tầng đơn vị** (`canEdit` mặc định `true`; đo lớp 2 `viewer` vẫn thấy `empty`) · `collapsed` **thuộc tầng đơn vị** (`isCompact`).
8. **Ca bàn phím (A12):** màn có route; không lớp riêng. Công tắc là `role="switch"` bấm được bằng `Space` — **chưa đo**. Không viết ca cho tới khi đo.
9. **Ca tự lưu (A7):** = RS-2. Ghi thêm: `Ctrl+S` xả sớm qua `flushAutosaves` (`routes/router.tsx` `SAVE_SHORTCUT`, `:203`) — **chưa đo** trên màn này; nếu đo được, một ca `Ctrl+S` thấy `Đã lưu lúc` *trước* 800 ms là bằng chứng rẻ nhất cho `flushAutosaves`.
10. **Ca hoàn tác (A8/A9):** **không kiểm được — và đây là phát hiện F3, không phải "đã đạt".** Hook tạo vé hoàn tác và gọi `onToast` (`useRuleSettings.ts:434-463`), nhưng `RuleSettingsRoute` gọi `<RuleSettingsContainer />` trần (`RuleSettings.container.tsx:144-146`) nên `onToast` không tồn tại ⇒ **không có toast hoàn tác** ở route (V12 đo: quét `[role=alert]` rỗng; nhãn toast **NOT FOUND**). `Ctrl+Z` toàn cục không hoàn tác cấu hình luật (`zundo` chỉ theo dõi `spatial`, comment `useRuleSettings.ts:36-40`). Nên A8 của màn này **không phủ ở cấp route**; đơn vị chứng minh phần hook (vé + toast được tiêm). Xem Q-V12-D.
11. **Ca định dạng (A6/A15):** nhãn trong màn viết thường (`cài đặt bộ luật không gian`, `bộ luật sẵn`, `khôi phục mặc định`); `Chưa có thay đổi` viết hoa do `SaveIndicator` dùng chung (mục 0.5). A15: không áp dụng — ô ngưỡng là số nhập (`bề dày tường tối thiểu`…): đơn vị `:383,416` kiểm khoảng, **chưa đo** hiển thị thập phân trong ô (nếu ngưỡng có phần lẻ).
12. **Mốc neo:** `getByRole('heading',{name:'cài đặt bộ luật không gian'})` `RuleSettings.tsx:251` (`h2`, dòng nằm sát `:253`) · `getByLabel('bật hoặc tắt luật: lỗ mở nằm trọn trong tường chứa nó')` — **`role="switch"`**, không phải `button` (`RuleSettingsRow.tsx:140`; V12 đã thử `getByRole('button')` không khớp) · `getByLabel('bật hoặc tắt cả nhóm: hình học')` `RuleSettingsGroups.tsx:66` · `getByRole('region',{name:'bộ luật sẵn'})` `RuleSettingsPresets.tsx:53` với nút tên bắt đầu `nhà ở` / `văn phòng` / `nhà xưởng` (tên dài kèm caption ⇒ regex đầu chuỗi, `RuleSettingsPresets.tsx:36`) · `getByRole('navigation',{name:'mục cài đặt bộ luật'})` `RuleSettings.tsx:135` · `getByRole('button',{name:'khôi phục mặc định'})` `RuleSettings.tsx:303` (chỉ khi khác mặc định) · `getByRole('status')` lọc theo chữ (`components/feedback/SaveIndicator.tsx:48`; **có ≥2 vùng status khi `hasContent`** — chọn theo `hasText`, không theo thứ tự). Không `data-testid`.
13. **KHÔNG kiểm được:** toast hoàn tác (F3, không nối); `error`/`loading`/`partial`/`forbidden`/`collapsed`; kết quả bấm preset `nhà xưởng` (**chưa đo** — lượt đo V12 bị `Ctrl+Z` làm rỗng màn trước khi tới). Ai chứng minh: `RuleSettings.test.tsx` (preset `:435`).

---

## 3. ViolationDetail — Chi tiết vi phạm · KHÔNG route (tấm trượt trên `projectRules`)

1. **Kiểu:** không route — `<aside aria-label="chi tiết vi phạm">` (`rules/ViolationDetail/ViolationDetail.tsx:327`), mở trên màn báo cáo luật.
2. **Đường tới:** `[bơm]` → `/projects/project-1/rules` → bấm nhóm `getByRole('button',{name:/^lỗ mở nằm trọn/})` → bấm dòng `getByRole('button',{name:/^Lỗ mở D-DOOR0000000/})` (`RuleReport.container.tsx:133-139` `onSelectRow`; render `:141-155`). **Không đường nào không cần bơm** (không có vi phạm nếu kho rỗng).
3. **Tiền đề:** kho có dữ liệu `[bơm]`, bảng luật đã hiện. Vai `engineer`. Không tour. Lớp chắn: không (tấm không `aria-modal`, `ViolationDetail.test.tsx:596`).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **bấm vào một vi phạm mà không thấy căn cứ để sửa**, hoặc — nặng hơn — `Esc` không đóng tấm/đóng nhầm lớp khác, khiến bàn phím (A12) mất tin cậy trên màn duyệt.
5. **Đã kiểm ở tầng đơn vị:** `ViolationDetail.test.tsx` — **14 bài / 1 tệp**: 7 trạng thái (`:450`), a11y/tiếng Việt/màu (`:472,481`), ≥2 nguyên nhân (`:493`), năng lực false gỡ khỏi DOM (`:520`), forbidden/collapsed (`:559,580`), **không phải hộp thoại** (`:596`), **J/K không đóng, Esc gọi `onClose`** (`:626`), rê vào hành động → xem trước (`:662`), nghiệm thu "sửa → đạt → Ctrl+Z" (`:747`). `RuleReport.test.tsx:731` (R-73) cũng đã kiểm "bấm dòng mở tấm, Esc đóng" **với `fireEvent`**. ⇒ e2e chỉ chứng minh cái đơn vị không thể: **trọng tài phạm vi trong trình duyệt thật** với sổ phím thật.
6. **Ca luồng chính:**
   - **VD-1 `[bơm]` `Esc` đóng đúng tấm trượt và không rời màn.** Mở tấm (mục 2) → thấy `complementary 'chi tiết vi phạm'` chứa câu vi phạm nguyên văn `Lỗ mở D-DOOR0000000 trải từ 300 mm đến 1.200 mm trên tường W-WALL0000000 chỉ dài 1.000 mm.` → bấm `Escape` **một lần** → `complementary` = 0 **và** `page.url()` vẫn `/projects/project-1/rules` **và** bảng luật còn nguyên. *Đo V12:* `aside` 1→0, `pathname` không đổi. Bất biến: **A12**. Đỏ thì: `Esc` trên màn duyệt rơi xuống `global.closeTopLayer` và đóng/điều hướng sai.
   - **VD-2 `[bơm]` `J` sang vi phạm kế **không** đóng tấm; `Esc` sau đó vẫn đóng đúng một lớp.** Sau VD-1 mở lại → `j` → nội dung đổi sang `D-DOOR0000040`, `complementary` vẫn 1 → `Escape` → 0. *Đo V12:* đúng. Bất biến: A12 (phạm vi `sidePanel` không nuốt `J`, không bị `dialog` nuốt). Đỏ thì: người duyệt mất nhịp `J/K`.
   - **VD-3 `[bơm]` trạng thái thật là `partial`, không phải `success`.** Khi tấm mở: thấy mục `Luật`, `Phát hiện`, `Nguyên nhân có thể` (≥2 dòng nguyên nhân) và câu `Chưa có cách sửa tự động nào cho vi phạm này. Phần căn cứ ở trên đủ để sửa tay trên bản vẽ.`; **không có** heading `Lựa chọn xử lý`. Bất biến: A11 (`partial` hiện phần chữ, không màn trắng). Đỏ thì: người dùng thấy tấm rỗng. *Lưu ý:* ca khẳng định *vắng* `Lựa chọn xử lý` (NOT FOUND ở mọi nơi gọi thật vì `canAutoFix:false`) — xem PHÁT HIỆN F4.
7. **Ca bảy trạng thái:** `partial` **e2e** `[bơm]` (VD-3; điều kiện `useViolationDetail.ts:1174-1200`: `actions.length===0` ở mọi nơi gọi thật) · `success` **thuộc tầng đơn vị** (cần ≥1 hành động, không có ở nơi gọi thật) · `empty` **thuộc tầng đơn vị** (`violation===null`, container không mở tấm khi không có dòng — `RuleReport.container.tsx:143,155`) · `forbidden` **thuộc tầng đơn vị** (cha không truyền `canEdit`) · `loading`/`error` **thuộc tầng đơn vị** (`mutation`, không hành động nào để chạy) · `collapsed` **thuộc tầng đơn vị**.
8. **Ca bàn phím (A12):** = VD-1, VD-2. Phạm vi **đã grep**: `useShortcut({combo:'Escape', id:'sidePanel.violationDetail.close', scope:'sidePanel'})` `ViolationDetail.tsx:316-322`; `J`/`K` cùng phạm vi `:300-314`. Thứ tự `dialog > sidePanel > canvas > global` (`lib/input/shortcutRegistry.ts:59-64`) ⇒ tấm thắng `global.closeTopLayer` (`:678`). Ca **`Esc` khi có một `dialog` chồng lên tấm**: **chưa đo** (không dialog nào mở được trên màn này) ⇒ không viết. Ghi ý: focus **không** chuyển vào tấm khi mở (V12: `activeElement` vẫn là nút dòng) — hệ quả cho người dùng bàn phím: sau khi mở phải `Tab` để tới tấm; **không** khẳng định đó là lỗi (chưa có luật nêu focus phải chuyển cho tấm không-modal).
9. **Ca tự lưu (A7):** không áp dụng — không dữ liệu để lưu.
10. **Ca hoàn tác (A8/A9):** không áp dụng ở e2e — không hành động sửa nào hiện (F4); đơn vị `:747` chứng minh chuỗi sửa → `Ctrl+Z` trên dữ liệu test.
11. **Ca định dạng (A6/A15):** **A15 e2e (VD-4 `[bơm]`)**: trong tấm thấy `độ tin cậy 0,82` (dấu phẩy) và **không** khớp `/\d\.\d{2}\b/` trong vùng `Phát hiện`; `1.200 mm` là dấu nghìn (không phải thập phân) — dùng regex bắt dấu ở vị trí thập phân. Đây là chỗ A15 rẻ nhất của nhóm (số có phần lẻ thật, hiện ngay). *Đỏ thì:* người dùng đọc `0.82` (kiểu Anh) trên màn tiếng Việt. A6: câu vi phạm viết hoa chữ đầu vì nguyên văn từ domain (`Lỗ mở …`); nhãn trong tấm viết thường — không khẳng định.
12. **Mốc neo:** `getByRole('complementary',{name:'chi tiết vi phạm'})` `ViolationDetail.tsx:327` (**role `complementary`**, không phải `dialog`) · `getByRole('button',{name:'vi phạm trước'})` `:137` · `'vi phạm kế tiếp'` `:144` · `'đóng tấm trượt chi tiết vi phạm'` `:151` · phím `J`/`K`/`Escape` `:300-322`. Không `data-testid`.
13. **KHÔNG kiểm được:** hành động sửa (không tồn tại, F4); `success`/`forbidden`/`collapsed`/`empty`/`loading`/`error` (đơn vị); `Esc` khi có `dialog` chồng (chưa đo); `figure` `role="img"` 2D/3D (`ViolationDetailFigure.tsx:106,141`) — **chưa đo** có canvas thật hay chỉ SVG. Ai chứng minh: `ViolationDetail.test.tsx`.

---

## 4. projectExport — Xuất bản vẽ · `ROUTE_PATTERNS.projectExport` · màn chủ của `ShareDialog` (V3) và `EditorTour` (V2)

1. **Kiểu:** có route — `/projects/:projectId/export` (`paths.ts:90`; `ExportPanelRoute`, `export/ExportPanel/ExportPanel.container.tsx:196-198`).
2. **Đường tới:** `page.goto(ROUTES.project.export('project-1'))` (`paths.ts:142`). Từ `projectRules`: `Xác nhận đã xử lý` (`useRuleReport.ts:602`) — nhưng nút bị khoá khi còn vi phạm (mục 1 R-3) nên **không đi được bằng sản phẩm** khi dữ liệu có vi phạm.
3. **Tiền đề:** `viewer` cho `forbidden` (không bơm); `engineer` + bơm đủ **ba** thứ (`setSpatial`+`setFloors`+`setActiveFloor`) cho `success` — thiếu `floors` là vẫn `empty` (V12: `useExportPanel.ts:614`). Tour: chỉ khi có neo (mục 0.2). Chip `xem hướng dẫn` che `chia sẻ` (mục 0.2).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không mang được mô hình ra khỏi ứng dụng** hoặc — tệ hơn — thấy "đã xuất" trong danh sách mà tệp không tới máy (F5).
5. **Đã kiểm ở tầng đơn vị:** `ExportPanel.test.tsx` — **25 bài / 2 tệp** (`ExportPanel.test.tsx` + `ExportPanel.container.test.tsx`): 7 trạng thái (`:85`), a11y+tiếng Việt (`:104`), không màu thô (`:131`), đúng 4 định dạng (`:143`), kiểm tra trước không chặn `xuất` (`:173`), tầng chưa duyệt vẫn chọn được (`:195`), năng lực false gỡ khỏi DOM (`:226`), đang xuất có `huỷ` + không thanh tiến độ giả (`:358`), error có mã + thử lại (`:393`); **`chia sẻ` mở `ShareDialogContainer`** (`container.test.tsx:62`). e2e **không** lặp: bốn định dạng, khối kiểm tra trước, chuỗi lỗi.
6. **Ca luồng chính:**
   - **EX-1 (không bơm) `forbidden` bằng vai thật.** Đăng nhập `viewer@example.com` `?next=/projects/project-1/export` → thấy (nguyên văn: `không có quyền xuất bản vẽ` + `chỉ quản trị viên và kỹ sư của dự án xuất được mô hình; bạn đang xem ở quyền chỉ đọc.`); **không** có nút `xuất`, không `chia sẻ`. *Đo lớp 2:* đúng chuỗi trên. Bất biến: **A11 `forbidden`** — rẻ nhất nhóm, không cần bơm. Đỏ thì: người xem thấy nút xuất rồi bị từ chối muộn, hoặc màn trắng.
   - **EX-2 (không bơm) `empty` không nút.** `engineer` `goto` → `heading 'chưa có gì được duyệt để xuất'` + `chưa chọn tầng nào để xuất.`; `buttons: []` (V12). Bất biến: A11 `empty`. *Ghi rõ:* `empty` này là hệ quả của "không route nào nạp floors" (0.1), *không phải* lựa chọn thiết kế đã thấy trong docblock — **chưa đọc** lý do docblock; xem PHÁT HIỆN F1.
   - **EX-3 `[bơm]` xuất `.glb` thành dòng trong `tệp đã xuất`.** bơm đủ ba thứ → SPA sang `/export` → thấy `radiogroup 'định dạng xuất'` với bốn `radio`, `Level 0`…`Level 3` `đã duyệt`, `kiểm tra trước khi xuất` (`cả 4 tầng đã chọn đều đã duyệt.` · `còn 182 vi phạm chưa xử lý.` · `còn 119 đối tượng chưa duyệt.` — V12; **đừng hard-code 182/119**) → bấm `button 'xuất'` (exact) → vùng `tệp đã xuất` có một dòng tên `.glb` với dung lượng **dấu phẩy** (V12: `160,3 KB`, `vừa xong`). Bất biến: A15 (dung lượng), A11 `success`/`partial`. **CẢNH BÁO — chưa chứng minh tệp tới máy**: V12 đo sự kiện `download` của Playwright **không nổ** trong 8 s (lượt 1) và 5 s (lượt 2) dù dòng đã hiện. **Ca này không được khẳng định "đã tải" cho tới khi đo lại** (mục "cần đo" ở CÂU HỎI). Chỉ khẳng định *dòng trong danh sách*, và ghi thẳng trong tên ca: "danh sách, chưa phải tệp".
   - **EX-4 `[bơm]` ShareDialog mở bằng bàn phím và `Esc` đóng đúng nó (nối V3).** `focus()` nút `chia sẻ` + `Enter` (không `click`, vì chip che — mục 0.2) → `dialog` `aria-modal="true"` tên `chia sẻ bản vẽ` → `Escape` → `dialog`=0 **và** URL vẫn `/projects/project-1/export`. *Đo V12:* đúng. Bất biến: A12, A9-họ (hộp thoại). Đỏ thì: `Esc` đóng nhầm/rời màn xuất.
   - **EX-5 `[bơm]` tour trên `/export`: `Esc` đóng đúng tour, và chip che nút (ghi lại, không "sửa").** Sau bơm + đổi cỡ viewport → tour `1 / 1 lấy tệp mang đi` → `Escape` → `section[aria-labelledby]`=0 (V12 đo 1→0); rồi khẳng định hiện trạng: `elementFromPoint` tại tâm nút `chia sẻ` không phải nút `chia sẻ`. **Ca thứ hai (che nút) mã hoá một lỗi giao diện thật (F6)** — đặt tên "hiện trạng", và bỏ/đảo khi chip được dời. Điều kiện kích tour: **chưa chốt** (0.2) ⇒ ca phải *chủ động kích bằng resize rồi bỏ qua*, không giả định đã hiện.
7. **Ca bảy trạng thái:** `forbidden` **e2e** không bơm (EX-1) · `empty` **e2e** không bơm (EX-2) · `success` **e2e** `[bơm]` (EX-3) · `partial` **e2e** `[bơm]` *có điều kiện* (đang xuất: `progress≠null` — `.glb` nhỏ nên thoáng; **chưa đo** có bắt được thanh `progressbar` không, nên không hứa) · `error` **thuộc tầng đơn vị** (`errorView`, `:393`) — **chưa đo** `page.route` chặn được đường xuất `.glb` (chạy trong trình duyệt, có thể không đi mạng) · `loading` **thuộc tầng đơn vị** · `collapsed` **thuộc tầng đơn vị** (`isCompact` không tham số route).
8. **Ca bàn phím (A12):** EX-4 (Esc dialog) + EX-5 (Esc tour) là hai ca *đã đo* của A12. Phạm vi: ShareDialog là `Modal` (`aria-modal`, `role="dialog"`) — phạm vi `dialog`, **chưa grep** giá trị `scope` trong `ShareDialog*.tsx` (không đo lại, thuộc V3); tour: hành vi Esc-đóng đã đo, phạm vi **chưa grep**. `Tab` đi hết `radiogroup` → `phạm vi` → `xuất`: **chưa đo**. Ai cần "phạm vi đã grep" cho hai bề mặt kia: **CẦN TỪ V2/V3**.
9. **Ca tự lưu (A7):** không áp dụng — màn xuất không tự lưu gì; `tệp đã xuất` chỉ trong phiên (`chỉ trong phiên làm việc này, sẽ mất khi tải lại trang.`).
10. **Ca hoàn tác (A8/A9):** không áp dụng — xuất không đổi dữ liệu; `huỷ` giữa lúc xuất không hộp thoại (footer `ExportPanelFooter.tsx:40`); `tải lại` là hành động lại. Không ca.
11. **Ca định dạng (A6/A15):** A15 = dung lượng `160,3 KB` (EX-3) và `57,9 KB` không thuộc màn này (thuộc `projectData`). A6: `chia sẻ`, `xuất`, `tuỳ chọn`, `phạm vi`, `huỷ` viết thường — nhất quán trong màn này (không khẳng định).
12. **Mốc neo:** `getByRole('heading',{name:'chưa có gì được duyệt để xuất'})` `ExportPanel.tsx:213` · `getByRole('button',{name:'chia sẻ'})` `ExportPanel.tsx:237-238` · `getByRole('radiogroup',{name:'định dạng xuất'})` `ExportPanelFormats.tsx:144` với `getByRole('radio',{name:/^\.glb/})` (`role="radio"` `:89` — **không phải button**) · `getByRole('region',{name:'phạm vi'})` `ExportPanelOptions.tsx:69` · `getByRole('region',{name:'kiểm tra trước khi xuất'})` `ExportPanelPreflight.tsx:26` · `getByRole('button',{name:'xuất',exact:true})` `ExportPanelFooter.tsx:68` · `getByRole('region',{name:'tệp đã xuất'})` `ExportPanel.tsx:112` · `getByRole('dialog',{name:'chia sẻ bản vẽ'})` (V3) · `data-tour-anchor="exportResult"` `ExportPanelFooter.tsx:65-68` — **chỉ để hiểu neo tour, không dùng làm mốc test** (nút `xuất` đã có `getByRole`).
13. **KHÔNG kiểm được:** tệp thật tới máy (`download` không nổ — F5; chưa đo nguyên nhân) · nội dung `.glb` (bộ đọc glTF, tầng đơn vị của `lib/export`) · `.pdf` và `.png` (màn nói thẳng: `chưa tải về được: dự án chưa có bộ dựng tệp PDF, mới đếm được số trang.` / `chưa tải về được: ảnh cần một khung nhìn ba chiều đang mở, màn này chưa gắn với khung nhìn nào.`) · `error`/`loading`/`collapsed` · thanh `progressbar` thoáng. Ai chứng minh: `ExportPanel.test.tsx`; `.pdf`/`.png` — không ai (sản phẩm chưa nối).

---

## 5. projectData — Dữ liệu không gian (Spatial JSON) · `ROUTE_PATTERNS.projectData`

1. **Kiểu:** có route — `/projects/:projectId/data` (`paths.ts:87`; `SpatialJsonViewerRoute`, `export/SpatialJsonViewer/SpatialJsonViewer.container.tsx` cuối tệp).
2. **Đường tới:** `page.goto(ROUTES.project.data('project-1'))` (`paths.ts:138`). Nút `Mở lại từ quản lý tầng` (ca lỗi) điều hướng `/floors` (`SpatialJsonViewer.container.tsx:167-169`).
3. **Tiền đề:** `engineer`; không cờ/tour/lớp chắn. `[bơm]` cho nội dung. Vai `viewer` **giống** `engineer` (đo lớp 2: `empty`) — không có `forbidden` (mục 7).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng (hoặc công cụ bên ngoài) **nhìn nhầm dữ liệu không gian** — số thập phân sai dấu trong cây, hoặc cây không mở/tìm được để kiểm dữ liệu trước khi giao.
5. **Đã kiểm ở tầng đơn vị:** `SpatialJsonViewer.test.tsx` — **38 bài / 1 tệp**: mô hình cây (`:61-176`), hằng bộ mẫu chuẩn + dấu phẩy (`:177-222`, gồm `:213` "dấu thập phân là dấu phẩy (A15)"), 7 trạng thái (`:231`), chỉ đọc (`:312`), hook (`:346`: mở sẵn `building`, mở/thu tất cả, tìm mở tổ tiên, không quyền không rò), phím mũi tên trên cây (`:471-516`). e2e **không** lặp: mô hình cây, phím mũi tên, hằng số. Điều còn lại cho e2e: dữ liệu thật đi qua `denormalizeSpatial`/`checkIntegrity` từ kho thật, và **vùng thô (JSON) khác vùng cây về dấu thập phân**.
6. **Ca luồng chính:**
   - **DA-1 (không bơm) `empty` trung thực có chữ, không màn trắng.** `goto` → thấy `Chưa có dữ liệu không gian` + `Bản vẽ này chưa được xử lý xong, nên chưa có Spatial JSON để xem. Chạy pipeline cho tầng rồi quay lại đây.` và chân `0 tầng · 0 tường · 0 ô mở · 0 phòng · 0 đồ đạc · 0 trục · 0 kích thước` (V12). Bất biến: A11 `empty`. Đỏ thì: người dùng thấy cây rỗng không lời. *Ghi:* dải `Hợp lệ theo hợp đồng Spatial JSON — 0 lỗi.` hiện cạnh `empty` (`spatialJsonModel.ts:269`) là hơi tự mâu thuẫn — F7; ca **không** khẳng định dải ấy.
   - **DA-2 `[bơm]` A15 đúng chỗ: cây dùng dấu phẩy, vùng thô dùng dấu chấm (và cả hai đều ĐÚNG).** bơm → SPA sang `/data` → trong `tree` có `treeitem` chứa `grossFloorAreaM2 : 248,60`; chân `57,9 KB`; **không** khớp `/\d\.\d{1,2}\b/` **trong `tree` và chân**. Chuyển tab `JSON` (chữ thô): chứa `248.6` — **phải nằm ngoài phép quét A15** vì là cú pháp JSON (V12 đo `248.6`, `0.82`). Bất biến: **A15**. Đỏ thì: số diện tích đọc kiểu Anh trong cây tiếng Việt. Đây là phép ca duy nhất trong nhóm phân biệt "định dạng số" với "dữ liệu thô" — dễ viết sai nhất, nên tên ca nói rõ.
   - **DA-3 `[bơm]` tìm và mở cây.** gõ `walls` vào `getByLabel('Tìm theo khoá hoặc giá trị')` → bộ đếm `1 / 1` (V12) → `getByRole('treeitem',{name:/walls/})`… (tên treeitem **rỗng** — dùng `filter({hasText})`). Bất biến: không (chức năng). *Cân nhắc BỎ:* đơn vị `:373` đã kiểm "tìm mở tổ tiên, đếm đúng số khớp". Giữ **chỉ nếu** Q1-A và cần một ca chạm trình duyệt thật; nếu không, bỏ ca này. Tôi *đề nghị bỏ*.
   - **DA-4 `error` bằng bơm sai dạng — KHÔNG viết.** V12 thấy `Không đọc được dữ liệu không gian` + `Mở lại từ quản lý tầng` khi bơm `createSampleBuilding()` chưa `normalizeSpatial`. Đó là **lỗi của người bơm**, không phải một ca sản phẩm (sản phẩm không bao giờ đưa dạng ấy vào kho). Ca này chứng minh trạng thái `error` chạy, nhưng bằng một đầu vào không thể xảy ra ⇒ **bỏ** (trả lời câu 3: nếu nó đỏ, người dùng *thật* mất gì? — không mất gì vì đầu vào không xảy ra ở sản phẩm).
7. **Ca bảy trạng thái:** `empty` **e2e** không bơm (DA-1) · `success` **e2e** `[bơm]` (DA-2) · `error` **thuộc tầng đơn vị** (`:267`; ca e2e DA-4 bị bỏ, lý do trên) · `forbidden` **thuộc tầng đơn vị** (`canView = roles.length>0` — không phiên nào có 0 vai; đo lớp 2 `viewer` cũng `empty`) · `loading` **thuộc tầng đơn vị** (`spatialLoading`, thoáng) · `partial` **thuộc tầng đơn vị** (`:253`) · `collapsed` **thuộc tầng đơn vị** (`isNarrow`, `:242`) — **chưa đo** `matchMedia` ở viewport hẹp trong Chrome thật.
8. **Ca bàn phím (A12):** cây có `role="tree"`, phím mũi tên đã có ở đơn vị (`:471-516`). Màn không có lớp riêng; `Esc` không đóng gì. **Chưa đo** `Tab` đi hết thanh công cụ. Không ca.
9. **Ca tự lưu (A7):** không áp dụng — chỉ đọc (test `:312-322`: ô nhập duy nhất là ô tìm).
10. **Ca hoàn tác (A8/A9):** không áp dụng — không thao tác ghi. `Sao chép nhánh đang chọn` ghi clipboard? **chưa đo** (route không truyền `onCopy`; test `:454` "không tự chạm clipboard").
11. **Ca định dạng (A6/A15):** A15 = DA-2. Cạnh đó: `Còn 2487 dòng nữa` (`SpatialJsonDetail.tsx:65-67` in `{hiddenCount}` thô) **không có dấu nhóm nghìn** trong khi `billing` viết `5.000`/`2.016,00` — nhất quán? Ca A15 *không* khẳng định nhóm nghìn (F8). A6: `Cây`, `Thô`, `JSON`, `Xem trước`, `Mở rộng tất cả`, `Thu gọn tất cả` viết hoa chữ đầu (mục 0.5).
12. **Mốc neo:** `getByLabel('Tìm theo khoá hoặc giá trị')` `SpatialJsonViewer.tsx:90` · `getByRole('button',{name:'Kết quả trước'})` `:108` · `'Kết quả sau'` `:114` · `'Mở rộng tất cả'` `:123` · `'Thu gọn tất cả'` `:129` · `getByRole('button',{name:'Sao chép nhánh đang chọn'})` `:143` · `getByRole('tree',{name:'Cấu trúc dữ liệu không gian'})` `SpatialJsonTree.tsx:60` · `getByRole('tablist',{name:'Cách xem nội dung'})` `SpatialJsonDetail.tsx:135` với `getByRole('tab',{name:'JSON'})` / `'Xem trước'` (`SpatialJsonDetail.tsx:41`) · `Cây`/`Thô` `SpatialJsonViewer.tsx:35-36` (nhóm `aria-label` `Cách hiện cấu trúc` `:135`) · `getByRole('heading'…)`/EmptyState title `Chưa có dữ liệu không gian` `SpatialJsonViewer.tsx:39,186`. Không `data-testid`.
13. **KHÔNG kiểm được:** clipboard (chưa đo) · `error` bằng đầu vào thật (không có) · `forbidden` (không tới được) · nội dung 2487 dòng đầy đủ (bị cắt có chủ ý) · tính đúng của `checkIntegrity` (đơn vị của `domain`). Ai chứng minh: `SpatialJsonViewer.test.tsx`.

---

## 6. projectVersions — Lịch sử phiên bản · `ROUTE_PATTERNS.projectVersions` · MÀN KHÔNG MỞ ĐƯỢC

1. **Kiểu:** có route — `/projects/:projectId/versions` (`paths.ts:106`; `router.tsx:339` `RouteVersionHistory`; `VersionHistoryRoute` `export/VersionHistory/VersionHistory.container.tsx:183`).
2. **Đường tới:** `page.goto(ROUTES.project.versions('project-1'))` (`paths.ts:165`). Không nơi nào trong sản phẩm đặt `activeFloorId` trước khi tới đây (F9).
3. **Tiền đề:** `engineer`. Không cờ/tour. Muốn qua cổng `activeFloorId` phải bơm (0.1) — **và kể cả vậy màn lỗi** (`không tải được lịch sử phiên bản` / `chưa có nguồn dữ liệu phiên bản nào được nối vào màn này`, V12).
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **không xem/phục hồi được phiên bản cũ** — nhưng hôm nay điều đó đã đỏ *bằng thiết kế*, nên chỉ có **một** ca đáng viết: đảm bảo màn không trắng.
5. **Đã kiểm ở tầng đơn vị:** `VersionHistory.test.tsx` — **13 bài / 1 tệp**: 7 trạng thái (`:121`), a11y kể cả hộp thoại xác nhận phục hồi (`:140,148`), tiếng Việt (`:183`), nền diff 8 % (`:200`), **phục hồi tăng thêm 1 phiên bản** (`:226`), **hoàn tác trong `UNDO_WINDOW_MS`** (`:253,327`), 409 hiện tên người sửa (`:401`), đổi tab giữ cuộn (`:440`), nút phục hồi rời DOM khi `canRestore:false` (`:479`). ⇒ **toàn bộ A8/A9/A11 nội dung của màn này đã ở tầng đơn vị; e2e không thêm được gì có nghĩa cho tới khi có nguồn dữ liệu.**
6. **Ca luồng chính:**
   - **VE-1 (không bơm) "không màn trắng" khi thiếu tầng — mã hoá một lỗi, chờ Q-V12-B.** `goto` → thấy `Không xác định được bản vẽ` + thân `Đường dẫn thiếu mã dự án hoặc chưa có tầng nào đang mở, nên không biết phải hiện lịch sử phiên bản của bản vẽ nào.`; 0 nút, 0 heading (V12; probe `bodyLen` 140). Bất biến: A11 (không màn trắng). Đỏ thì: người dùng bấm vào Lịch sử phiên bản và không có gì ngoài một câu báo. **Ca này chỉ tồn tại vì màn chết**; tên ca ghi "hiện trạng", đảo khi Q-V12-B chọn xong. Bảng chọn kết quả ca sau khi Q-V12-B: A ⇒ ca thành "route có tầng nên mở được" (cần nguồn phiên bản — vẫn chặn); B ⇒ ca thành "màn hiện bộ chọn tầng".
7. **Ca bảy trạng thái:** `error`-dạng-thiếu-tầng **e2e** (VE-1) · mọi trạng thái khác — `success`/`empty`/`loading`/`partial`/`forbidden`/`collapsed`: **chưa có dữ liệu nên chưa kiểm được** (và `error` nội dung đã đo lớp 1 chỉ sau bơm). Điều kiện A11 của `useVersionHistory.ts`: **chưa đo** (V12 cũng ghi chưa đọc). Không suy ra.
8. **Ca bàn phím (A12):** không áp dụng ở trạng thái hiện tại (0 nút). Sau khi màn sống: hộp thoại xác nhận phục hồi (`Escape` huỷ, không phục hồi) là ca có giá trị — **chưa phủ**, chờ nguồn.
9. **Ca tự lưu (A7):** không áp dụng.
10. **Ca hoàn tác (A8/A9):** đơn vị đã phủ (`:226,253,327`); e2e **không thể** (màn chết). Ghi `chưa phủ ở e2e` — không phải "đạt".
11. **Ca định dạng (A6/A15):** **chưa phủ** — không có ngày/giờ/dung lượng nào hiện ra để đối chiếu.
12. **Mốc neo:** `getByText('Không xác định được bản vẽ')` `VersionHistory.container.tsx:66` · sau bơm: `getByText('không tải được lịch sử phiên bản')` `VersionHistory.tsx:68` và `getByText('chưa có nguồn dữ liệu phiên bản nào được nối vào màn này')` (`versionHistoryGateway.ts:129-130`). Mọi mốc danh sách/so sánh/phục hồi: **NOT FOUND** (chưa vẽ ra). `getByText` chính xác là lựa chọn duy nhất vì màn không có role nào (0 nút, 0 heading) — nếu cần `getByRole`, đó là **đề xuất khả năng tiếp cận**: `InlineAlert` này không mang heading/role có tên dùng được (V12: `h1: []`, `h2: []`); tôi đề xuất người quyết định xem xét, không tự ép.
13. **KHÔNG kiểm được:** toàn bộ chức năng màn (danh sách, so sánh, diff, phục hồi, hoàn tác, 409). Lý do đã đo: `activeFloorId===null` khi vào bằng URL (V12) **và** không nguồn dữ liệu kể cả khi có tầng (V12). Ai chứng minh: `VersionHistory.test.tsx` (13 bài) cho phần chức năng trên fixture.

---

## 7. account — Cài đặt tài khoản · `ROUTE_PATTERNS.account`

1. **Kiểu:** có route — `/tai-khoan` (`paths.ts:67`; `AccountSettingsRoute` bọc `Toast.Provider`, `account/AccountSettings/AccountSettings.container.tsx` cuối tệp).
2. **Đường tới:** `page.goto(ROUTES.account)`. Từ màn khác: không nơi nào được grep trong lượt này — **chưa đo**.
3. **Tiền đề:** `engineer` (fallback) đủ; `viewer` cũng vào được (đo lớp 2: thư `viewer@example.com`). Không cờ/tour/lớp chắn. Dữ liệu **bộ nhớ trong của module** (`accountSettingsGateway.ts:1-30`) — **không** mock API, **không** `page.route` chặn được, và **mất khi tải lại trang**.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **sửa hồ sơ/giao diện mà không biết nó đã được lưu chưa** (A7), hoặc — với hộp thoại xoá tài khoản — Escape/focus hoạt động sai trên thao tác **không hoàn tác được**.
5. **Đã kiểm ở tầng đơn vị:** **151 bài / 8 tệp** (đếm lại đo lớp 2 từng tệp): `AccountSettings.test.tsx` 21 (đường dẫn `:117`, khung `:124`, đang tải cả trang `:156`, lỗi đọc cấp trang `:176`, **nối tự lưu D-07** `:194`, 7 trạng thái đo cả màn `:463`, tiếng Việt/a11y/màu thô `:511`, giảm chuyển động `:649`, tương phản chủ đề tối ≥ 4,5:1 `:741`, số phím tắt = registry `:777`, đổi chủ đề 5 lần không nháy `:813`) · `AppearanceSection.test.tsx` 31 · `ProfileSection.test.tsx` 21 · `PasswordSection.test.tsx` 19 · `ShortcutsSection.test.tsx` 19 · `NotificationsSection.test.tsx` 16 · `SessionsSection.test.tsx` 13 (gồm **vé hoàn tác tám giây** `:236-342`: hàng biến ngay, toast mời hoàn tác, bấm hoàn tác thì cổng chưa gọi; rời màn giữa cửa sổ vẫn thu hồi; hết tám giây thu hồi đúng một lần) · `DangerZone.test.tsx` 11 (gồm **`Esc` đóng hộp thoại, không xoá gì** `:144`). Đơn vị đã phủ dày: nhãn, mật khẩu, thông báo, phím tắt, phiên, hộp thoại xoá, giảm chuyển động, tương phản. **e2e không lặp bất kỳ thứ nào trong đó.**
6. **Ca luồng chính (gần như không còn gì — chỉ ba thứ trình duyệt thật chứng minh):**
   - **AC-1 tự lưu bằng đồng hồ thật.** `goto` → `getByLabel('họ tên')` `fill('Nguyễn Văn Thử')` → **trong <800 ms** một vùng `status` chứa `Có thay đổi chờ đồng bộ` → **≥800 ms** chứa `Đã lưu lúc HH:mm`. *Đo V12:* 0,3 s `Có thay đổi chờ đồng bộ`; 1,5 s `Đã lưu lúc 14:19`. Bất biến: A7. Đơn vị `:194` dùng đồng hồ giả ⇒ AC-1 là bằng chứng *thời gian thật*. *Cẩn thận neo:* trang có **hai** vùng `status` — `6 phím tắt đang có hiệu lực.` (`ShortcutsSection.tsx:126`) không phải trạng thái lưu; chọn theo chữ. *Đỏ thì:* sửa hồ sơ, rời màn, mất dữ liệu mà không biết.
   - **AC-2 hộp thoại xoá tài khoản: `Esc` đóng đúng nó, URL giữ nguyên, focus về nút gọi.** `Xoá tài khoản` → `dialog` `Xoá tài khoản này?` (`aria-modal="true"`) → `Xoá vĩnh viễn` **disabled** khi ô `địa chỉ thư` rỗng → `Escape` → `dialog`=0 và `page.url()` vẫn `/tai-khoan`. *Đo V12:* đúng. **Chưa đo**: focus có trả về nút `Xoá tài khoản` không — **phải đo trước khi khẳng định**. Bất biến: A9, A12. Đơn vị `DangerZone.test.tsx:144` đã có `fireEvent` Esc; e2e thêm *sổ phím thật + focus thật*. *Đỏ thì:* người dùng bấm Esc, hộp thoại đóng nhưng focus mất (trên thao tác nguy hiểm nhất của màn).
   - **AC-3 KHÔNG viết:** đổi chủ đề `tối` ⇒ `class="dark"` trên `<html>` (V12 đo; `data-theme` **không** có) — đơn vị `AccountSettings.test.tsx:741,813` và `AppearanceSection.test.tsx` (31 bài) đã phủ kỹ hơn nhiều. Bỏ.
7. **Ca bảy trạng thái:** `success` **e2e** (AC-1 chạy trên trạng thái thành công) · các trạng thái còn lại **thuộc tầng đơn vị**: `loading` (`isLoading` → khung xương cả bảy thẻ, `:156`), `error` đọc cấp trang (`:176`), `partial` (đọc phiên hỏng, `SessionsSection.test.tsx:154`), `forbidden` (SSO → mật khẩu chỉ đọc), `collapsed` (ma trận thông báo → danh sách), `empty` (chưa ảnh/chức danh, `T4`). **Không dựng được bằng `page.route`** — nguồn dữ liệu là bộ nhớ module, không endpoint (`accountSettingsGateway.ts:1-30`).
8. **Ca bàn phím (A12):** AC-2. `Tab` đi hết luồng: **chưa đo**. Nhóm chủ đề có `←/→` chuyển (`AppearanceSection.tsx:140-150`) — đơn vị phủ; e2e không lặp.
9. **Ca tự lưu (A7):** = AC-1. Lưu ý mật khẩu **không** đi qua tự lưu (`useAccountSettings.ts` docblock) — đơn vị.
10. **Ca hoàn tác (A8/A9):** A9 = AC-2 (hộp thoại, e2e xác nhận thêm; đơn vị chính). A8: **đăng xuất một phiên** có vé tám giây + toast — **đơn vị đã phủ** (`SessionsSection.test.tsx:237-342`). *Đo V12:* sửa `họ tên` hoặc đổi chủ đề **không có toast hoàn tác** và `Ctrl+Z` toàn cục không hoàn tác chúng (họ tên vẫn `Nguyễn Văn Thử`) — xem F3/Q-V12-D. Ca e2e cho A8 của đăng xuất phiên: **chưa đo** hành vi thật (V12 chưa bấm `Đăng xuất khỏi …`); không viết.
11. **Ca định dạng (A6/A15):** A15 không áp dụng — không số thập phân trên màn (V12). A6: nhãn khối viết thường (`hồ sơ`, `giao diện`, `vùng nguy hiểm`), nút viết hoa (`Đổi ảnh`, `Đổi thư điện tử`, `Đổi mật khẩu`, `Đăng xuất`, `Xoá tài khoản`) — mục 0.5; `expectVietnamese` đã ở `:511`.
12. **Mốc neo:** `getByRole('heading',{level:1,name:'cài đặt tài khoản'})` · `getByLabel('họ tên')` `ProfileSection.tsx:161` · `'chức danh'` `:170` · `'thư điện tử'` `:181` (readOnly) · `'điện thoại'` `:199` · công tắc `getByLabel('dùng nền tối cho khung nhìn 3D')` `AppearanceSection.tsx:215`, `'giảm chuyển động'` `:224`, `'hiện lưới 100 mm'` `:233` · `getByRole('button',{name:'Xoá tài khoản'})` `DangerZone.tsx:68` · `getByRole('dialog')` tiêu đề `Xoá tài khoản này?` (`DangerZone.tsx` `Modal.Header`) · ô `getByLabel('địa chỉ thư')` `DangerZone.tsx:90` · nút `Để sau` / `Xoá vĩnh viễn` · `getByLabel('Đăng xuất khỏi Trình duyệt trên máy tính xách tay')` `SessionsSection.tsx:114`. Nhóm chủ đề `sáng`/`tối`/`theo hệ thống`: **role của nút chưa đo** — `getByRole('button',{name:'tối'})` **không khớp** (V12 đã thử), `getByText('tối',{exact:true})` khớp ⇒ **đề xuất khả năng tiếp cận** (mục 12 khuôn): nhóm `SegmentedControl` chủ đề thiếu role có tên dùng được cho `getByRole`; chỉ nếu ca sau cần bấm chủ đề (AC-3 đã bỏ nên hiện chưa cần).
13. **KHÔNG kiểm được:** mọi trạng thái A11 ngoài `success` (không endpoint để chặn); đổi mật khẩu / thư điện tử / ngôn ngữ / ma trận thông báo / đăng xuất phiên trên trình duyệt thật (**chưa đo**); toast hoàn tác của hồ sơ (F3, không tồn tại); tính bền qua tải lại (không bền, `accountSettingsGateway.ts:1-30`). Ai chứng minh: 151 bài đơn vị.

---

## 8. billing — Thanh toán · `ROUTE_PATTERNS.billing`

1. **Kiểu:** có route — `/billing` (`paths.ts:70`; `BillingScreenContainer`, `billing/BillingScreen/BillingScreen.container.tsx`).
2. **Đường tới:** `page.goto(ROUTES.billing)`. Đường vào từ giao diện: **chưa grep**.
3. **Tiền đề:** đọc: mọi vai. **Đổi gói: phải `admin@example.com`** (`useBillingScreen.ts:276-277`), đăng nhập `?next=/billing` (V12 đo). Dữ liệu bộ nhớ module (`billingGateway.ts:1-27`) — không mock API. Không tour.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **nâng gói (tiền thật) mà không được hỏi trước**, hoặc thấy số tiền/diện tích sai dấu (`2.016,00 m²` đọc thành `2.016.00`).
5. **Đã kiểm ở tầng đơn vị:** `BillingScreen.test.tsx` — **22 bài / 1 tệp**: 7 trạng thái đo cả màn (`:225`), tiếng Việt/a11y/màu (`:303`), **định dạng — năm chuỗi nghiệm thu in nguyên văn** (`:342`), hạn mức gần đầy (`:365`), đổi kỳ chạy số (`:437`), vai không đổi được gói ⇒ cả màn ở chế độ đọc (`:492`), **nâng gói hỏi trước bằng bảng tóm tắt có số tiền (A9)** (`:546`), tải hoá đơn (`:644`), nối R-73 (`:748`). e2e **không** lặp: chuỗi số, thang hạn mức, chạy số.
6. **Ca luồng chính:**
   - **BI-1 vai thật quyết định nút: `admin` bật, `engineer` khoá.** Hai lượt đăng nhập `?next=/billing`: `engineer@example.com` ⇒ dòng `Chỉ quản trị viên có thể thay đổi gói.` và **cả hai** `Nâng gói` `disabled` (đo lớp 2: `[true,true]`); `admin@example.com` ⇒ dòng ấy mất và `Nâng gói` bật (V12: `[false,false]`). Bất biến: **A11 `forbidden`** (dạng chế độ đọc, dữ liệu vẫn hiện — `useBillingScreen.ts:498`). *Đỏ thì:* người không có quyền nâng gói bấm được nút tiền.
   - **BI-2 nâng gói: hộp thoại hỏi trước, `Esc` huỷ không đổi gì, xác nhận mới đổi (A9).** `admin` → bấm `Nâng gói` (nút đầu) → `dialog` `aria-modal="true"` tiêu đề `Xác nhận nâng gói` với `Gói mới | Chuyên nghiệp`, `Phần còn lại của chu kỳ | 31 ngày`, `Thanh toán ngay | 1.240.000 ₫` (V12 đo) → `Escape` → `dialog`=0 **và** thẻ `Gói hiện tại` vẫn `Cơ bản` → mở lại → bấm `Nâng gói` (nút cuối trong dialog) → dialog đóng **và** thẻ `Gói hiện tại` = `Chuyên nghiệp`. Bất biến: **A9**, A12. Đơn vị `:546` đã kiểm "hỏi trước bằng bảng tóm tắt"; e2e thêm: `Esc` thật + trạng thái sống sót sau đóng. *Đỏ thì:* nâng gói không hỏi, hoặc `Esc` vẫn nâng.
     *Ghi:* sau nâng, quota giữ `1.842 / 5.000 m²` (V12) — **chưa rõ** có phải lỗi fixture (không khẳng định).
   - **BI-3 A15 đúng dấu ở đúng chỗ.** Bảng hoá đơn: cột `Diện tích` của hàng `HD-2026-08` = `2.016,00 m²` (V12 đo, đo lớp 2 lặp: `2.016,00 m²`, `1.998,00 m²`…). Khẳng định: khớp `/\d{1,3}(\.\d{3})*,\d{2} m²/` ở **mọi** hàng và **không** khớp `/\d\.\d{1,2}(?!\d)/` trên cả `main` (đo V12: 0 khớp). `5.000 m²` / `20.000 m²` / `1.842 m²` là **dấu nhóm nghìn**, không phải thập phân (HOP-DONG mục 2) — đừng quét mọi dấu chấm. Bất biến: **A15**. Đỏ thì: diện tích/tiền hiển thị kiểu Anh trong sản phẩm tiếng Việt. Đây là ca A15 giàu nhất nhóm (10 hàng × 2 dấu).
7. **Ca bảy trạng thái:** `forbidden`-dạng-đọc **e2e** (BI-1) · `success` **e2e** (BI-2/BI-3 chạy trên nó) · `empty` (`invoices.length===0`, `useBillingScreen.ts:501`) **thuộc tầng đơn vị** · `loading` **thuộc tầng đơn vị** (`snapshotQuery.isPending`, cổng bộ nhớ, thoáng) · `error` **thuộc tầng đơn vị** (không endpoint để `page.route`) · `partial` **thuộc tầng đơn vị** (`degraded`) · `collapsed` **thuộc tầng đơn vị** (`forceCollapsed` không tham số route).
8. **Ca bàn phím (A12):** `Esc` trên hộp thoại nâng gói (BI-2). Phạm vi: `Modal` — **chưa grep** `scope` của `ConfirmUpgradeDialog`; hành vi đóng đã đo. `Tab`/mũi tên trên `radiogroup` kỳ (`Theo tháng`/`Theo năm`, `role="radio"`) — **chưa đo**.
9. **Ca tự lưu (A7):** không áp dụng (không thao tác lưu; nâng gói là mutation có xác nhận).
10. **Ca hoàn tác (A8/A9):** A9 = BI-2. A8 không áp dụng: nâng gói **không hoàn tác được** ⇒ thuộc A9 (đo V12: **không toast** sau nâng — đúng luật). Tải hoá đơn PDF: đo lớp 2 — bấm `Tải hoá đơn HD-2026-08 dạng PDF` **không sinh sự kiện `download`, không toast, không status** trong 2,5 s ⇒ **chưa rõ nút làm gì** (`useBillingScreen.ts:294` `gateway.downloadInvoice`); **không viết ca** cho tới khi đo/đọc gateway (đơn vị `:644` đã có một bài).
11. **Ca định dạng (A6/A15):** BI-3. Tiền `490.000 ₫`, `393.120.000 ₫`, `1.240.000 ₫` dùng dấu nghìn `.` — khẳng định không có thập phân (VND). A6: `Thanh toán` (h1), `So sánh gói`, `Ước tính`, `Hoá đơn` viết hoa chữ đầu — mục 0.5.
12. **Mốc neo:** `getByRole('heading',{level:1,name:'Thanh toán'})` `BillingScreen.tsx:197` · `getByRole('button',{name:'Đổi gói'})` `QuotaCard.tsx:57` · `getByRole('progressbar',{name:'1.842 / 5.000 m² đã số hoá trong chu kỳ này'})` `QuotaCard.tsx:23-27` · `getByRole('radio',{name:'Theo tháng'})` / `'Theo năm'` (`useBillingScreen.ts:189`; nhóm `aria-label` `Kỳ thanh toán` `PlanComparison.tsx:102`) · `getByRole('button',{name:'Nâng gói'})` (2 nút, `useBillingScreen.ts:160`) · `getByRole('dialog',{name:'Xác nhận nâng gói'})` (`useBillingScreen.ts:171`) · nút dialog `Huỷ` / `Nâng gói` · `getByRole('button',{name:'Tải hoá đơn HD-2026-08 dạng PDF'})` `InvoiceTable.tsx:31` · `getByRole('button',{name:'Trang sau'})` `InvoiceTable.tsx:120` · ghi chú `Chỉ quản trị viên có thể thay đổi gói.` `useBillingScreen.ts:158`. Không `data-testid`.
13. **KHÔNG kiểm được:** thanh toán thật (không có); tải hoá đơn (chưa đo); `loading`/`error`/`partial`/`empty`/`collapsed`; quota sau nâng (chưa rõ); `Nâng gói` ở gói `Doanh nghiệp` (**chưa đo**). Ai chứng minh: `BillingScreen.test.tsx`.

---

## 9. adminModels — Thư viện model · `ROUTE_PATTERNS.adminModels`

1. **Kiểu:** có route — `/admin/models` (`paths.ts:68`; `admin/ModelLibrary/ModelLibrary.container.tsx`).
2. **Đường tới:** `page.goto(ROUTES.adminModels)`; sản phẩm: **chưa grep** đường vào.
3. **Tiền đề:** mở: mọi vai. `admin` để mất banner chỉ-đọc; **admin cũng không có nút ghi nào** (chín năng lực ghi `false`, `modelLibraryGateway.ts:6-8`). Dữ liệu **mock API**. Không tour.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì người dùng **duyệt thư viện 16 model mà lọc/đổi chế độ hỏng**, hoặc `Esc` đóng nhầm khi đang xem chi tiết. Không có tiền/dữ liệu bị hại — màn chỉ đọc ⇒ giá trị e2e *thấp hơn* các màn khác; thứ duy nhất chỉ trình duyệt thật chứng minh là `Esc` và lọc/lưới.
5. **Đã kiểm ở tầng đơn vị:** `ModelLibrary.test.tsx` — **13 bài / 1 tệp**: 7 trạng thái (`:398`), a11y/tiếng Việt (`:417,440`), ba cột số `font-mono tabular-nums` (`:456`), đúng một badge `Nặng` (`:474`), bốn cột không có nguồn vắng (`:517`), ghi rời DOM (`:533`), sắp xếp cột (`:548`), **`Esc` gọi `closeDetail`** (`:595`), `readOnlyReason` khi `canManage:false` (`:614`).
6. **Ca luồng chính:**
   - **MD-1 lọc trả về `empty` có lời.** `getByRole('textbox',{name:'tìm model'})` `fill('zzzz')` → `tổng số model 0`, `tổng dung lượng 0 B`, `model nặng 0`, chữ `Không tìm thấy model phù hợp.` (V12/đo lớp 2 chuỗi `0 B`); xoá ô → `tổng số model 16` trở lại. Bất biến: **A11 `empty`**. Đỏ thì: lọc không ra gì mà không lời (màn trắng) hoặc không quay lại được.
   - **MD-2 `Esc` đóng đúng panel chi tiết, ở lại `/admin/models`.** bấm hàng `getByRole('button',{name:'bàn ăn sáu chỗ'})` → `complementary 'chi tiết model'` → `Escape` → 0 **và** URL giữ. *Đo V12:* đúng. Phạm vi **đã grep**: `useShortcut({combo:'Escape', id:'sidePanel.modelLibraryDetail.close', scope:'sidePanel'})` `ModelLibraryDetail.tsx:283-289` (đo lớp 2 — V12 ghi "chưa grep", nay xong). Bất biến: **A12**. *Cảnh báo:* panel hôm nay hiện `Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.` + `Thử lại` và canvas 300×150 (V12) ⇒ ca **chỉ khẳng định đóng/mở**, không khẳng định nội dung chi tiết.
   - **MD-3 chế độ lưới: 16 `listitem`, lọc `ghế` còn 2.** `getByRole('radio',{name:'Lưới'})` → `getByRole('list',{name:'lưới model'})` có 16 `listitem` → lọc `ghế` → 2 (V12 đo, đo lớp 2 lặp). *Cân nhắc BỎ:* đơn vị `:548` chỉ phủ sắp xếp cột, không phủ lọc/lưới ⇒ giữ, nhưng giá trị thấp (không hại nếu đỏ); là ca **thấp nhất nhóm**, sẵn sàng bỏ nếu cần cắt.
7. **Ca bảy trạng thái:** `success` **e2e** (16 model, MD-3) · `empty` **e2e** (MD-1) · `forbidden` **e2e dạng banner** (3 vai: `vai trò của bạn chỉ xem được thư viện, nên mọi hành động sửa danh mục không hiện` `useModelLibrary.ts:103`; `admin` mất banner — V12) — *khẳng định banner, không khẳng định "dữ liệu bị ẩn"* (bảng vẫn hiện) · `error` **chưa đo** (`page.route` chặn endpoint thư viện — chưa mở `src/api/endpoints.ts`; V12 cũng ghi chưa đo) · `loading`/`partial`/`collapsed` **thuộc tầng đơn vị**.
8. **Ca bàn phím (A12):** MD-2. Phạm vi `sidePanel` đã grep. `Tab` qua bảng/lưới: **chưa đo**.
9. **Ca tự lưu (A7):** không áp dụng — không ghi.
10. **Ca hoàn tác (A8/A9):** không áp dụng — mọi hành động ghi vắng mặt (`getByRole('checkbox').count()===0`, không `Tải lên model`; V12). Nhãn nút ghi: **NOT FOUND**.
11. **Ca định dạng (A6/A15):** **A15 e2e (MD-4, đi kèm MD-3, không thêm ca)**: `tổng dung lượng 29,0 MB`, `1,80 m × 0,90 m × 0,75 m` dấu phẩy ✔; `8.400` tam giác là nhóm nghìn — không phải thập phân. Khẳng định: trong bảng, khớp `/\d,\d{2} m/` và không `/\d\.\d{1,2} m/`. Đỏ thì: kích thước đọc kiểu Anh. A6: breadcrumb `Quản trị › Thư viện model` (hoa) khác `quản trị › người dùng` của `adminUsers` (thường) — cùng họ mục 0.5.
12. **Mốc neo:** `getByRole('navigation',{name:'Đường dẫn trang'})` `ModelLibrary.tsx:36,50` (**chữ hoa `Đ`** — khác `adminUsers` là `đường dẫn trang`) · `getByRole('textbox',{name:'tìm model'})` `ModelLibraryToolbar.tsx:17,39` (placeholder `Tìm theo tên model...`; nhãn `tìm model` khớp — đo lớp 2) · `getByRole('combobox',{name:'danh mục'})` `:19,47` · `getByRole('radiogroup',{name:'chế độ xem'})` `:20,57` với `getByRole('radio',{name:'Bảng'})` / `'Lưới'` (**radio, không button**) · `getByRole('button',{name:'bàn ăn sáu chỗ'})` · `getByRole('list',{name:'lưới model'})` `ModelLibraryTable.tsx:33,150` · `getByRole('complementary',{name:'chi tiết model'})` `ModelLibraryDetail.tsx:293` · nút đóng `đóng panel chi tiết model` `:306` · `Không tìm thấy model phù hợp.` `ModelLibraryTable.tsx:31`. Không `data-testid`.
13. **KHÔNG kiểm được:** mọi hành động ghi (không tồn tại, kể cả với `admin`) · xem trước 3D của model (canvas 300×150 + `Mất kết nối máy chủ…`; nguyên nhân cụ thể **chưa đo**) · `error`/`loading`/`partial`/`collapsed` · nút `Thử tải lại ảnh xem trước của chậu rửa đặt bàn` — hành vi sau bấm **chưa đo**. Ai chứng minh: `ModelLibrary.test.tsx`.

---

## 10. adminUsers — Quản lý người dùng · `ROUTE_PATTERNS.adminUsers` · MỤC ĐÁNG ĐI SÂU NHẤT NHÓM

1. **Kiểu:** có route — `/admin/users` (`paths.ts:69`; `admin/UserManagement/UserManagement.container.tsx`).
2. **Đường tới:** `page.goto(ROUTES.adminUsers)` (không đăng nhập ⇒ `engineer` ⇒ `forbidden`); `admin`: `?next=/admin/users` sau đăng nhập `admin@example.com` (khuôn `e2e/viewer3d.spec.ts:185-205`).
3. **Tiền đề:** **vai quyết định nội dung** (bảng V12/đo lớp 1: `admin` danh sách; `engineer`/`viewer`/không đăng nhập ma trận). Dữ liệu **mock API** (`src/api/__mocks__/client.ts:948`). Không tour. Không lớp chắn.
4. **Giá trị nghiệp vụ:** đỏ ở đây thì **người không phải quản trị nhìn thấy/đổi được tài khoản người khác** (rò quyền), hoặc quản trị viên vô hiệu hoá/xoá nhầm một người mà không hoàn tác/xác nhận được.
5. **Đã kiểm ở tầng đơn vị:** `UserManagement.test.tsx` + `useUserManagement.test.ts` (3 bài) + `activityKindLabel.test.ts` — **20 bài / 3 tệp**: 7 trạng thái (`UserManagement.test.tsx:133`), a11y/tiếng Việt/màu (`:154,189,207`), **ma trận quyền 3 cột × 7 dòng, mọi ô đọc được** (`:219`), **`forbidden`: chỉ ma trận, không danh sách người** (`:248`), hành động bị chặn hiện câu giải thích tại chỗ (`:263`), vai không chỉ bằng màu (`:278`), **xoá hẳn: nút xác nhận không bật khi email chưa khớp** (`:291`), ô mời nhận dấu phẩy/xuống dòng (`:335`). e2e **không** lặp: ma trận 3×7, nút xoá khoá khi email lệch, phân tích ô mời.
6. **Ca luồng chính:**
   - **UM-1 `forbidden` theo vai thật — ba lượt đăng nhập, ba kết quả (bảng dưới).** Đây là ca duy nhất nhóm dựng `forbidden` bằng **phiên thật** chứ không bằng props: lượt (a) không đăng nhập `goto` thẳng; (b) `engineer@example.com` `?next=`; (c) `viewer@example.com` `?next=`; (d) `admin@example.com` `?next=`. (a)(b)(c): thấy chữ `vai của bạn chưa quản lý được người dùng nên danh sách tài khoản không hiện; bảng dưới đây cho biết mỗi vai làm được những việc gì`, `ma trận quyền theo vai trò` với ba cột `quản trị` `kỹ sư` `người xem`, ô mẫu `quản trị: được phép tải bản vẽ ✓` và `người xem: không được phép tải bản vẽ –`; **không** có hàng người dùng, **không** nút `Mời người dùng`/`vô hiệu hoá`/`xoá`. (d): `người dùng 7`, `quản trị 1`, `lời mời đang chờ 3`, hàng đầu `Phạm An admin@example.com … bạn không thể tự đổi vai của mình`, có `Mời người dùng`.
     | Lượt | Đo | Yêu cầu tới máy chủ |
     |---|---|---|
     | không đăng nhập | ma trận (V12) | — |
     | `engineer` | ma trận (V12) | **0** yêu cầu có `user` trong đường dẫn (V12) |
     | `viewer` | ma trận (V12, và `HOP-DONG-BO-SUNG.md` 2.2: thân 976 ký tự) | không đo riêng |
     | `admin` | danh sách 7 người (V12) | có |
     **Về `role="alert"`:** `HOP-DONG-BO-SUNG.md` 2.2 ghi thân 976 ký tự và `role="alert"`. V12 đo `dialogs: []` và quét `[role=alert],[role=status]` thấy rỗng ở lượt admin nhưng **không ghi riêng cho lượt forbidden**; probe (`probe-35-routes.json`) ghi `status: []`. ⇒ *`role="alert"` của nhánh forbidden là điều BO-SUNG khẳng định, ghi chú lớp 1 không xác nhận, probe không thấy `role=status`* — **chưa đo**. Ca **không** hứa `getByRole('alert')` cho tới khi đo (xem CÂU HỎI, "cần đo trước"). Dùng `getByText` chuỗi nguyên văn trong khi chờ.
     Bất biến: **A11 `forbidden`**. Đỏ thì: vai thấp thấy danh sách tài khoản (rò dữ liệu người) hoặc màn trắng. Đây là *nhánh forbidden đầy đủ nhất repo* (BO-SUNG 2.2).
     **Điều phải nói thẳng (phát hiện F10):** nhánh 403 của **mock** (`client.ts:948` `isUserAdminForbidden`) **không bao giờ được giao diện gọi tới** — hook chặn từ trước bằng `enabled: canManage` (`useUserManagement.ts:498,510,522`, `userManagementGateway.ts:243`). Vậy ca này chứng minh **cổng phía client**, không phải "máy chủ từ chối". Tên ca không được nói "máy chủ trả 403".
   - **UM-2 `admin` vô hiệu hoá → thấy trạng thái đổi + toast `Hoàn tác` → bấm `Hoàn tác` → trạng thái trở lại (A8).** `admin` → hàng `Nguyễn Bình` (`engineer@example.com`, `kỹ sư`, `4` dự án) → bấm `vô hiệu hoá` → hàng đổi từ `đang hoạt động` + nút `vô hiệu hoá` sang `đã vô hiệu hoá` + nút `bật lại`; toast `đã vô hiệu hoá tài khoản — Nguyễn Bình` + nút `Hoàn tác` → bấm `Hoàn tác` → hàng lại `đang hoạt động` + `vô hiệu hoá`. *Đo lớp 2 (điều V12 ghi "chưa đo Hoàn tác"):* đúng chuỗi trên. Nút `Hoàn tác` **còn hiện sau khi bấm** (`toast còn: 1`) — chưa rõ (có thể đổi nội dung); không khẳng định biến mất. Bất biến: **A8**. Đỏ thì: quản trị vô hiệu hoá nhầm và không có đường quay lại. Cửa sổ hoàn tác 8 s (`lib/mutations/undoTicket`, V12): ca **không** kiểm "hết 8 s thì hết hoàn tác" (đơn vị/đồng hồ giả).
   - **UM-3 `admin` xoá hẳn: hộp thoại hỏi trước, `Esc` đóng đúng hộp thoại và để nguyên tấm chi tiết (A9 + A12).** bấm `xoá` một hàng không phải chính mình → **chờ bằng khẳng định** `dialog` xuất hiện (V12: hộp thoại đến muộn hơn 0,6 s; chờ cố định 0,6 s là **không đủ**) với tiêu đề dạng `xoá hẳn <Tên>?`, thân `xoá hẳn gỡ luôn phần ghi công của người này trong lịch sử và không hoàn tác được; gõ đúng địa chỉ thư của họ để xác nhận`, ô `địa chỉ thư`, nút `để sau` → `Escape` → `dialog`=0 **và** hàng người vẫn còn. Nếu tấm `chi tiết người dùng` đang mở cùng lúc thì `Escape` đóng **dialog trước**, tấm còn (V12 đo `dl` 1→0, `as` vẫn 1) — ca phụ này chứng minh **thứ tự lớp** (`dialog` > `sidePanel`). Bất biến: **A9, A12**. Đỏ thì: xoá vĩnh viễn một người mà không hỏi, hoặc `Esc` đóng nhầm tấm.
     *Kỹ thuật:* trong lượt V12 tấm `chi tiết người dùng` mở bằng `getByText('Nguyễn Bình',{exact:true})` (bấm tên), **không** bằng `getByRole('row').click()` (bấm hàng không mở tấm — V12 đo `asides 0`). Ca dùng bấm tên.
7. **Ca bảy trạng thái:** `forbidden` **e2e** (UM-1 a/b/c) · `success` **e2e** (UM-1 d, UM-2) · `error` **chưa đo** (cần `page.route` vào endpoint người dùng; chưa mở `src/api/endpoints.ts` — không đề xuất `page.route` chưa biết đường) · `empty` **chưa đo** (`emptyTeaching` `useUserManagement.ts:141` là chuỗi có sẵn nhưng danh sách 7 người không rỗng; dựng `empty` cần nguồn khác) · `loading`/`partial`/`collapsed` **thuộc tầng đơn vị**.
8. **Ca bàn phím (A12):** UM-3 (Esc dialog trước tấm). **Phạm vi đã grep:** `grep useShortcut|Escape` trong `UserManagement*.tsx` = **rỗng** (V12) ⇒ *trong file màn này không có đăng ký `Escape` nào*; `Escape` đóng dialog là do `Modal` chung (phạm vi `dialog` — **chưa grep** `components/ui/Modal`), và `Escape` đóng tấm `chi tiết người dùng`: V12 chưa đo Esc thứ hai. ⇒ **Ca UM-4: panel mời không đóng bằng `Esc`** — bấm `Mời người dùng` → khối inline `email người được mời` hiện (không `role="dialog"`) → `Escape` → khối **vẫn còn** (V12 đo). Bất biến A12 ("Esc đóng lớp trên cùng"): **hiện trạng vi phạm** (F11). Ca này là `test.fixme` với lý do "panel mời không đăng ký Esc (`UserManagement*.tsx` không có `useShortcut`)" và điều kiện mở lại "khi panel mời đóng được bằng Esc hoặc khi người duyệt xác nhận đó là chủ ý" — hỏi ở Q-V12-C.
9. **Ca tự lưu (A7):** không áp dụng — thao tác ghi có xác nhận/hoàn tác, không tự lưu.
10. **Ca hoàn tác (A8/A9):** UM-2 (A8), UM-3 (A9).
11. **Ca định dạng (A6/A15):** A15 không áp dụng — chỉ ngày `08/09/2026 15:57` (dd/mm/yyyy hh:mm, 24 h), số nguyên. A6: breadcrumb `quản trị › người dùng` và nhãn `tìm người dùng`/`vai`/`trạng thái` viết thường, nút `Mời người dùng`, `Gửi lời mời`, `Xem ma trận quyền` viết hoa — mục 0.5; **không khẳng định**.
12. **Mốc neo:** `getByRole('navigation',{name:'đường dẫn trang'})` `UserManagement.tsx:47,76` · `getByRole('button',{name:'Xem ma trận quyền'})` `UserManagement.tsx:48` · `getByRole('textbox',{name:'tìm người dùng'})` `UserManagementToolbar.tsx:26,60` · bộ lọc `vai` `:28,67` / `trạng thái` `:29,74` · `getByRole('button',{name:'Mời người dùng'})` `UserManagementToolbar.tsx:31` · panel mời: `getByRole('textbox',{name:/email người được mời/})` `:33,115`, `vai cho lời mời` `:32,136`, nút `Gửi lời mời`/`Huỷ` · `getByRole('button',{name:'vô hiệu hoá'})` `UserManagementTable.tsx:38` · `getByRole('button',{name:'xoá'})` `:40` (**dùng `filter` theo hàng**: `getByRole('row').filter({hasText:'Nguyễn Bình'})`; mọi hàng đều có cùng nhãn) · `getByRole('complementary',{name:'chi tiết người dùng'})` `UserManagementDetail.tsx:381` · `getByRole('button',{name:'đóng chi tiết người dùng'})` `:103` · `getByRole('button',{name:'Hoàn tác'})` (toast) · `getByRole('dialog')` tiêu đề `xoá hẳn …?` · ma trận: `getByText('quản trị: được phép tải bản vẽ')`… (nhãn ô, V12 / probe). Không `data-testid`.
13. **KHÔNG kiểm được:** phản hồi 403 của máy chủ (không bao giờ chạm, F10) · `role="alert"` của `forbidden` (chưa đo) · `error`/`empty` (chưa đo) · `Hoàn tác` hết hạn 8 s (đơn vị/đồng hồ giả) · gửi lời mời thật (**chưa đo** `Gửi lời mời`) · tấm chi tiết sau `Esc` thứ hai (chưa đo). Ai chứng minh: `UserManagement.test.tsx` (ma trận, nút xoá khoá) + `useUserManagement.test.ts`.

---

---

# 9. Phát hiện — thứ sai trong SẢN PHẨM, không phải trong kế hoạch

## 9.0 ĐÃ SỬA — hai lỗi dựng lại được bằng trình duyệt, đã chữa tận gốc

Cả hai do `scripts/probe-interact.mjs` tìm ra — bộ dò **bấm** từng điều khiển của từng
màn như một người dùng. Bộ dò trước đó chỉ **tải** trang nên không thể thấy chúng.

| | **404 → bảng điều khiển đổ** | **`Escape` ở `/thong-bao` ra `about:blank`** |
|---|---|---|
| Dựng lại | mở `/duong-khong-ton-tai-xyz`, bấm "về danh sách dự án" | mở `/thong-bao` **trực tiếp**, bấm `Escape` |
| Triệu chứng | `ProjectCardTile.tsx:149` ném `Cannot read properties of undefined (reading 'length')` | trình duyệt rịi ứng dụng |
| Vì sao sống lâu | mở `/` **thẳng** thì không vỡ — chỉ vỡ khi điều hướng trong ứng dụng | không gì trong `src` điều hướng tới route này, nên nhánh đúng **chưa bao giờ chạy** |
| Gốc | **một khoá bộ đệm, hai người ghi, hai hình dạng.** 404 đọc `client.projects.list()`; `fetchProjectList()` **không gọi API nào**, trả `SAMPLE_PROJECTS` có thêm `members` | `navigate(-1)` là một lượt lùi **mù** |
| Sửa | 404 nhận khoá riêng `queryKeys.project.recent()` | hỏi `location.key`; không có chỗ lùi thì `navigate(ROUTES.dashboard, { replace: true })` |
| Commit | `e63300c` | `a73007b` |

**Hai chỗ cố ý KHÔNG làm, và lý do:**

- **Không thêm `?.` vào `ProjectCardTile`.** `members` là trường bắt buộc của
  `DashboardProject`; một dấu chắn ở đó biến cú đổ thành một bảng điều khiển hiển thị
  **sai âm thầm** — nó sẽ vẽ danh sách rút gọn của màn 404 như thể là danh sách dự án
  đầy đủ. Đổ còn đỡ hơn.
- **Không viết `*.spec.ts` cho hai lỗi này.** Một bài kiểm để chứng minh một lỗi vừa
  dựng lại được và vừa chữa xong thì vòng. Bản ghi nằm ở đây; bộ dò là thứ tìm lại
  được nếu ai đó dựng lại chúng.

---

Cấm sửa mã sản phẩm để bài xanh (mục 7.2). Mọi thứ dưới đây là phát hiện để người quyết định.


### Nhóm V1

Sai trong **sản phẩm**, không đề xuất sửa mã. Bằng chứng từ ghi chú V1 (đã đo), trừ khi ghi khác.

1. **`/m/du-an/:projectId` luôn `empty` ở sản phẩm thật.** Route chỉ truyền `projectId`+`roles` (`MobileViewer.container.tsx:129-141`); hình học đọc từ `store.spatial` (`useMobileViewer.ts:249-250`, `:267`), không màn nào nạp cho route này; không request lấy hình học (đo mạng). Đơn vị xanh vì tiêm `spatial` trực tiếp (`MobileViewer.container.test.tsx:169-243`).
2. **`/khong-co-quyen` không có ai điều hướng tới** — `grep ROUTES.accessDenied` ngoài test = 0. Màn chỉ tới được gõ URL.
3. **`safeDestination` không có ca đơn vị nào** (ghi chú V1) và **chấp nhận `/login`** làm đích: người đã đăng nhập bị bỏ lại ở `/login` (đo). Ký tự `\` không bị chặn bởi luật nguồn (`AuthScreen.container.tsx:105-111` chỉ chặn `//`); việc nó vẫn về `/` cùng origin là do bước sau, **cơ chế chưa điều tra**.
4. **Nhãn login/onboarding hoa đầu câu, ba màn hệ thống viết thường hoàn toàn.** CLAUDE.md A6: "viết thường, kiểu câu" (ngoại lệ: mã trục, mã lỗi, tên phím). Ghi chú V1 mục C ghi "chưa đo". Số đã đo: login 6 nhãn hoa đầu câu (`Đăng nhập`, `Thư điện tử`, `Mật khẩu`, `Ghi nhớ máy này`, `Hiện mật khẩu`, `Đăng nhập bằng SSO công ty`); onboarding 6 nhãn (`Tạo dự án`, `Tải bản vẽ`, `Duyệt kết quả`, `Xem dự án mẫu`, `Xem hướng dẫn 2 phút`, `Bỏ qua`); accessDenied/notFound/mobileViewer thường hoàn toàn. Ghi chú V1 viết "`LUAT_MAN_HINH.md` đòi có phân biệt": tôi grep `viết thường|kiểu câu` trong `LUAT_MAN_HINH.md` và `RULE.md` → **không có kết quả**; câu nằm ở `CLAUDE.md` (A6). → Q1.
5. **`/login/invitation/*` và `/login/reset-password/*` công khai nhưng không có route** ⇒ ra NotFound (`paths.ts:194,214` + đo `/login/invitation/abc`).
6. **`role="status"` rỗng và 404 của accessDenied do hiểu nhầm** (ghi chú V1): status = vùng thông báo toàn cục (`region aria-live="polite"`, có ở mọi màn); 404 = `favicon.ico`, lần đầu của tiến trình, không lặp được.
7. **Chữ nhân đôi trong `textContent` của Button** ("Đăng nhậpĐăng nhập", "Tạo dự ánTạo dự án"): `name` truy cập vẫn khớp; nguyên nhân **chưa điều tra**. Ghi chú V1 nghi Button vẽ chữ hai lần cho hiệu ứng loading — **chưa xác minh**. Rủi ro cho lớp sau: `getByText` với chữ này khớp nhân đôi.
8. **Canvas mobileViewer không có mốc neo khả dụng** (aria-hidden, không testid) — xem trường 12 mục 5 (đề xuất được phép nêu).

---


### Nhóm V2

Không đề xuất sửa mã; trừ mục 7 (ngoại lệ khả năng tiếp cận, nói thẳng).

1. **Tour hiện muộn theo `resize`, không theo thời gian.** `useEditorTour.ts:476-483` (lọc bước sống sót theo phím/neo **tại lúc render**), `:423` (`subscribeViewport`). Quan sát: 0 thẻ sau 4 s và sau 11 s, bấm/phím/lăn chuột không kích, `resize` 1 px kích. Giả thuyết nguyên nhân, **chưa xác minh**.
2. **`plan-phan-dau.md` §1.4.1 nói tour hiện "sau cú bấm đầu tiên" — đo ở đây KHÔNG tái hiện** (bấm, phím, lăn, chờ: 0 thẻ). Hoặc bấm vào một phần tử cụ thể mới kích, hoặc kích là `resize`/render lại do lần bấm đó đổi trạng thái màn chủ. **Cần người đã thấy nó** cho biết bấm vào đâu.
3. **`Escape` ở `/thong-bao` rời khỏi ứng dụng khi vào thẳng.** `NotificationCenter.container.tsx:171-176` (`navigate(-1)`); đo `about:blank`.
4. **Vùng status của NotificationCenter nói sai sau khi đánh dấu hết.** Status `không có thông báo nào` trong khi **6 dòng vẫn hiện**. Nó nói "không có chưa đọc" bằng câu "không có thông báo". Người dùng trình đọc màn hình nghe sai. (Không rõ chủ ý; đo 1 lần.)
5. **Nền tối của tour bắt mọi cú bấm ngoài ô khoét và coi đó là "bỏ qua"** (`EditorTour.tsx:250`; `showsCutout` ở `:174` chỉ khi `cutout !== null`, tức có neo và không `collapsed`). Đọc từ mã, **chưa đo bằng một cú bấm thật**. Hệ quả nếu đúng: với nhóm khác, cú bấm đầu tiên sau khi tour hiện **không** đến đích.
6. **404 thật ở `/thong-bao`: `/api/streams/notifications`, 2 lần** (đo bằng `page.on('response')`). Không phải favicon. Mock không phục vụ luồng SSE.
7. **Thiếu mốc neo khả dụng (đề xuất sửa khả năng tiếp cận, không phải sửa để bài xanh):** `Drawer.tsx:141`/`:199` — `role="dialog" aria-modal="true"` **không có tên truy cập** (đo `name: null`) ⇒ trình đọc màn hình đọc "hộp thoại" không tên, và `getByRole('dialog', { name })` không khả dụng. Tôi **đang đề xuất** thêm `aria-label`/`aria-labelledby`. (Drawer là thành phần dùng chung; chưa kiểm còn màn nào khác dùng nó.)
8. **Bẫy ViewCube đã chữa; docblock cũ còn kể lỗi ở thì hiện tại-gần** (`Viewer3DOverlays.tsx:76-96`, "ViewCube không bấm được bằng chuột"). Người đọc sau dễ hiểu nhầm là lỗi còn đó. Hiện trạng: `PRESENCE_ANCHOR = 'right-4 top-[216px]'` (`:98`), hit-test trúng nút.
9. **`ConnectionStates` (35 bài) không ai dựng** — xem Q10b. **`NotificationBell` không ai dựng** (chỉ route).
10. **ExportPanel: tour không hiện dù đã `resize`** (nguyên nhân chưa đo) — hoặc neo `data-tour-anchor="exportResult"` chưa có (nút chỉ sáng khi có thứ để xuất, `EditorTour` bước 6) hoặc luật sống sót bỏ hết bước.

---


### Nhóm V3

(Thứ sai trong SẢN PHẨM. Không đề xuất sửa mã; người duyệt quyết.)

- **F1 — `role="status"` sr-only của dashboard đọc CHỮ TIẾNG ANH cho trình đọc màn hình.** `ProjectDashboard.tsx:~341-343`: `<span className="sr-only" role="status">{state}</span>` với `state` là khoá `SevenState` thô ("success", "forbidden", "partial", "collapsed" — V3 đo). Vi phạm A6/`expectVietnamese`; `ProjectDashboard.test.tsx` **không** dùng `expectVietnamese` (đo lớp 2: 0 chỗ) nên tầng đơn vị không bắt được. `projectSettings` in "trạng thái: thành công" (tiếng Việt) — hai màn nhất quán khác nhau (V3 phát hiện 3).
- **F2 — thu hồi liên kết chia sẻ không hỏi và không có Hoàn tác (đọc mã).** `ShareDialogLink.tsx:85-89` → `useShareDialog.ts:599` (`revokeLink: (id) => revokeMutation.mutate(id)`), toast `đã thu hồi liên kết` (`:437`) không có `onUndo`; chỉ đổi quyền có `onUndo` (`:535-554`). A9: việc A8 không hoàn tác được phải hỏi trước bằng hộp thoại. Chưa thấy chạy (hộp thoại không tới được dữ liệu trên mock). Không có bài đơn vị nào bấm "thu hồi" (đo lớp 2).
- **F3 — tiêu điểm đầu vào của hộp thoại tạo dự án là nút `Đóng hộp thoại`, không phải ô "tên dự án"** (V3 đo `BUTTON:Đóng hộp thoại`; cả dashboard lẫn onboarding). Người dùng bàn phím phải Tab một lần trước khi gõ tên. Ghi nhận hiện trạng — có thể chủ ý (nút đầu trong DOM); không kết luận sai.
- **F4 — toast "Đã xoá dự án." có thể mất khi điều hướng** (V3, chưa xác minh chắc): `onProjectDeleted` điều hướng (`ProjectSettings.container.tsx:52`, `useProjectSettings.ts:748-749`), `Toast.Provider` của màn settings gỡ; V3 đo `toasts:["",""]` sau 1,5 s. Ở mức "chưa đo", không phải kết luận.
- **F5 — hai nơi cùng gọi `CreateProjectModalContainer` mỗi nơi có `Toast.Provider` riêng** (`ProjectDashboard.container.tsx`; `WelcomeScreen.container.tsx:110`) — không sai, nhưng là lý do ca V3-CP-1 phải chạy ở **cả hai** màn chủ (toast host khác nhau).
- **F6 — mục "Xoá" hiện với vai viewer trong menu thẻ dashboard** (V3 đo `["Mở","Nhân bản","Đổi tên","Xoá"]`) dù `canDelete = role !== 'viewer'` (`useProjectDashboard.ts:341`) và story ghi "mất mục Xoá". **`aria-disabled` chưa đo** — không kết luận vi phạm; ghi vào "cần đo trước".
- **F7 — ghi chú V3 thiếu nửa công thức của cửa nạp-kho cho `ExportPanel`** (đo lớp 2, mục 0.2): cần thêm `setFloors`. Đây không phải lỗi sản phẩm mà lỗi ghi chú; ghi ở đây để `questions.md` Q1 và `fixture` không chép thiếu.
- **F8 — chữ nút nhân đôi trong `textContent`** ("Dự án mớiN", "Tạo dự ánTạo dự án") — đã ghi ở V1, vẫn accessible name khớp; không phải lỗi sản phẩm, chỉ là bẫy `getByText`.

---


### Nhóm V4

Thứ sai trong SẢN PHẨM; **không đề xuất sửa** — để người quyết định. **[✓]** = tôi tự đọc; **[V4]** = từ ghi chú, chưa mở lại.

- **P1 — "Tiếp tục xử lý" của `projectQuality` đi tiếp dù ô xác nhận chưa tích.** `onContinue: () => options.onNavigate?.(ROUTES.project.pipeline(projectId))` (`useInputQualityGate.ts:1126` [✓]) không kiểm `canContinue` (định nghĩa ở `:897` [✓] `canContinue: !(requiresAcknowledgement && !isAcknowledged)`). Đo [V4]: chọn hàng Tầng 1 (mức Kém) → dòng "Đánh dấu ô xác nhận bên trên rồi thử lại." hiện → bấm nút khi ô chưa tích → URL sang `/projects/project-1/pipeline`. Đây là **thiết kế đã ghi** (`InputQualityGateFooter.tsx:4-9` [✓]: "Nút chính luôn bấm được, ở mọi giá trị của `footer.canContinue`"), nhưng chữ "thử lại" và tên ca đơn vị "chặn cho tới khi tích ô" (`InputQualityGate.test.tsx:410` [V4]) dễ đọc thành "bị chặn". Người dùng thấy lời chặn rồi vẫn đi tiếp.
- **P2 — Chuỗi upload → pipeline đứt dữ liệu.** `useFloorUploadScreen.ts:812` [V4] (đọc lại [✓] `options.onNavigate?.(ROUTES.project.pipeline(projectId))`) không mang `uploadId`; `ProcessingScreenRoute` không truyền `floorUploads` (`ProcessingScreen.container.tsx:170-176` [✓]). Đo [V4]: tải đủ 4 tầng, bấm "Bắt đầu xử lý", màn xử lý báo "Đã xong 0/0 tầng". Người dùng vừa đưa 4 bản vẽ vào mà màn xử lý nói không có gì. Chú thích ở `ProcessingScreen.container.tsx:20-27` [V4] ("màn tải bản vẽ truyền sang") không khớp mã.
- **P3 — A9 và "không hộp thoại".** Chữ A9 (`CLAUDE.md`): "Hành động mà A8 **không** hoàn tác được thì phải hỏi trước bằng hộp thoại". `PipelineFailure` ("Bỏ qua tầng đó") và `ProcessingScreen` ("Huỷ xử lý") dùng xác nhận/cảnh báo **inline**, và test đơn vị cấm `role=dialog` (`PipelineFailure.test.tsx:525-537`, `ProcessingScreen.test.tsx:336` [V4]). Có thể là quyết định của màn (đặc tả cấm hộp thoại) chứ không phải lỗi; ghi để người duyệt xác nhận rằng A9 chấp nhận xác nhận inline. **Chưa đo**, chỉ đọc mã.
- **P4 — Tệp `.dwg` qua được `setInputFiles`/kéo-thả nhưng bị bỏ khỏi `accept`.** `validateUploadFile` cho `.dwg` qua (đuôi hợp lệ `ACCEPTED_UPLOAD_EXTENSIONS`), `PICKER_UPLOAD_EXTENSIONS` bỏ `.dwg`, `input accept=".png,.jpg,.pdf"`; đo [V4]: `a.dwg` vào khay chưa gán không lỗi. Server thật trả 422 `CAD_NOT_SUPPORTED`; mock không. Người dùng kéo `.dwg` sẽ không thấy lỗi ngay trên mock. Đơn vị có ca 422.
- **P5 — Tải lên không bền.** Tải xong chỉ nằm trong state cục bộ của màn; `drawings.*` của mock không ghi ngược vào `project.floors` (đo [V4]: tải lại trang là mất). Có thể chỉ là hạn chế của mock; **chưa đo** hành vi ở máy chủ thật (không có).
- **P6 — Tuyên bố "màn chất lượng là màn duy nhất dùng `L-1`" (HOP-DONG) sai về nguồn.** [V4 3.14] grep: `L-1` có trong `src/mocks/spatial.ts:9,1584`, `api/__tests__/client.test.ts`, `domain/spatial/__tests__/roomOpenings.test.ts`, `lib/three/present/__tests__/assemble.test.ts`. Điều đúng: trong nhóm màn có route dùng `page.goto`, màn chất lượng là nơi `L-1` ra chữ (Tầng hầm). Không phải lỗi sản phẩm — ghi để HOP-DONG được sửa.
- **P7 — Menu thẻ của upload không có role.** Đo [V4]: 0 phần tử `role=menu/listbox/dialog`, menu là `<div>`+`<button>` trần, Esc bắt cục bộ bằng `onKeyDown`/`stopPropagation`, không qua registry. Người dùng đọc màn hình không nghe thấy đây là menu. Chưa đo `aria-expanded`/`aria-haspopup` trên nút mở. (Nếu người duyệt đồng ý sửa khả năng tiếp cận, đó là sửa a11y, không phải sửa để test xanh — nhưng mốc neo hiện đủ bằng tên nút, nên **tôi không đề xuất sửa để phục vụ test**.)
- **P8 — Docstring lỗi thời.** `ProcessingScreen.container.tsx:11-13,180-183` [V4] nói route "CHƯA đăng ký … vẫn là `<Placeholder>`" — sai (đã đăng ký `router.tsx:319`). Cùng loại với "ba route Placeholder" trong `CLAUDE.md` mà HOP-DONG mục 0 đã ghi là không còn.

---


### Nhóm V5

Không đề xuất sửa mã sản phẩm.

1. **`Áp dụng tỷ lệ` im lặng không làm gì khi kho `spatial` rỗng.** `useScaleCalibration.ts:950` (`onApply`): nhánh `entity === undefined` **`return` không commit, không `setHasApplied`, không báo gì**. Đo: sau bấm (chờ 1,2 s) không `Đã áp tỷ lệ cho bản vẽ`, không hoàn tác. Cùng bệnh "kho rỗng" của Q1. Người dùng thật vào thẳng route cũng gặp (kho rỗng khi chưa qua màn nạp). *(Cơ chế: đọc mã lớp 2; chưa kiểm bằng cách tiêm kho.)*
2. **Tỷ lệ "chưa lưu lên máy chủ" nhưng màn vẫn trình bày như đã đặt.** `Tỷ lệ hiện tại: 4,991 mm/px` đổi **ngay khi gõ**, trước khi bấm áp; thanh trạng thái nói nguyên văn `tỉ lệ chỉ áp trong phiên này, chưa lưu lên máy chủ` (`useScaleCalibration.ts:613-617,1507-1518`). Mâu thuẫn A7.
3. **`projectPipelineGraph` khẳng định điều không có dữ liệu để khẳng định:** `Mỗi tầng đang đi một nhánh khác nhau, nên chưa có một câu trả lời chung cho cả hồ sơ.` (`pipelineGraphText.ts:156-157`, `reasonUnknown`) — hiện cả ba vai khi không có dữ liệu nào.
4. **Mã tầng lạ `ZZZ` ở `projectScale` báo "Nắn ảnh thất bại"** (`ScaleCalibration.tsx:72`): lỗi **đọc dữ liệu** gọi là lỗi **nắn ảnh**; nội dung `Hệ thống đã ghi nhận… Mã lỗi: UNKNOWN`, không ảnh. Không màn nào nói "không có tầng này" (bảng ghi chú §4).
5. **Hai quy ước số trong cùng màn `projectScale`:** `4.800 mm` (phân nhóm nghìn) và `1600,00` (toạ độ, không phân nhóm). Chưa kết luận lỗi.
6. **Tên phím viết hai kiểu trong cùng màn:** dòng nhắc `ESCAPE`/`ENTER`/`ARROWLEFT` (HOA) và ô phím `Esc`/`Enter`. Đúng ngoại lệ A6 (tên phím) nhưng không nhất quán.
7. **Viewer bấm `Vẫn dùng AI` vẫn điều hướng** dù câu trên hộp thoại nói không chốt được nhánh (`onChooseBranch('ai')` không bị chặn theo thiết kế, `useCadBranchConfirm.ts:19-23`). Ghi chú lớp 1: **chưa đo** bấm bằng viewer.
8. **`projectCadConfirm`: hộp thoại và màn nền lặp cùng câu**, và có `h1` + `h2` cùng chữ `Phát hiện tệp CAD` (probe). Hệ quả: mốc neo `heading` trùng hai phần tử.
9. **`projectScale` ở `forbidden`: nút `Đo lại` vẫn hiện** (đo), trong khi `Áp dụng tỷ lệ` biến mất.
10. **`L1` mở thẳng `error` ở `projectScale`** vì mock chất lượng `L1` có `frame.isFound:false` (`src/api/__mocks__/client.ts:186-191`); hợp đồng dùng `L1` làm tầng mặc định — ca luồng phải dùng `L2`.

---


### Nhóm V6

Thứ sai trong SẢN PHẨM; **không đề xuất sửa** — để người quyết định. Số dòng: **[✓]** tôi tự đọc, **[V6]** lấy từ ghi chú.

- **P1 — Vòng tròn kho↔cổng làm cả bốn màn skeleton mãi** [V6 F1]. `graph = { read: () => useStore.getState().spatial }` (`wallLayerReviewGateway.ts:326-328`), `readWallLayer: () => Promise.resolve(graph.read())` (`:357`), nên kho `null` ⇒ hook không nạp gì ⇒ `isLoading` dính `graph === null` (`useWallLayerReview.ts:1176` [V6]). Trên sản phẩm thật (không dev), không có đường nào nạp kho: mock API không có đường đọc `spatial.layer` (`__mocks__/client.ts:1210-1219` [V6]). Người dùng thấy skeleton vĩnh viễn ở 4/4 màn (61 · 16 · 16 · 24 khối).
- **P2 — Toast xoá tường lộ mã máy** [V6 F4]: "Đã xoá tường W-000001WALL." trong khi danh sách gọi nó `#W-001`; nguồn `wallLayerReviewGateway.ts:686-688` [✓ chuỗi `Đã xoá tường ${wallId}.`]. Vi phạm tinh thần mục B ("không lộ thứ dành cho lập trình viên"), giống phát hiện `L-01FIXTURE0` của vỏ 3D (BỔ SUNG mục 4).
- **P3 — Lời hứa A7 không thực hiện được ở tường** [V6 F3]: `persistWallLayer` **NOT FOUND** (`wallLayerReviewGateway.ts:39` [✓]); thanh trạng thái đọc "Có thay đổi chưa lưu" và vẫn thế sau 1,3 s. Nối thêm: `vi.json` `autosave.failed` = **"Lưu thất bại sau nhiều lần thử. Chỉnh sửa hoặc lưu lại thủ công."** (`src/i18n/vi.json:70` [✓]) — câu này dẫn người dùng tới "lưu lại thủ công" trong khi hệ thống không có nút lưu nào (0/35 màn, HOP-DONG mục 2). Đã đọc chữ và đã biết không có nút; **chưa đo** rằng chữ ấy thực sự hiện ra trên màn tường sau chuỗi thử lại 5/15/45 s.
- **P4 — Ghi chú lớp 1 có ba "NOT FOUND/chưa đo" mà nguồn thật có:**
  - Chuỗi "Có thay đổi chưa lưu" = `src/i18n/vi.json:68` [✓] (`autosave.dirty`), qua `hooks/useSaveIndicator.ts:55` [✓]. V6 nói "NOT FOUND — grep không ra chuỗi đúng"; chuỗi có, chỉ nằm ở `vi.json` chứ không ở mã màn.
  - `'Thêm trục ngang'`/`'Thêm trục dọc'` = `useAxisGridManager.ts:155` [✓] và `axisGridManagerScenarios.ts:140-141` [✓]. V6 nói "hằng khai báo: NOT FOUND — sinh từ group.title".
  - Nhóm công cụ đối tượng: `ObjectLayerToolRail.tsx:130` [✓] mẫu `chọn nhóm ${OBJECT_LAYER_LABELS[tool.id]} (phím ${tool.kbd})`; V6 ghi "dòng: chưa đo".
  Đây là chỗ ghi chú thiếu, không phải sai sản phẩm; ghi để điều phối viên cập nhật.
- **P5 — Nhãn A6 không nhất quán trong cùng một nhóm** [V6 F7]: tường `Duyệt lớp tường`, `Cây lớp`, `Ẩn lớp Tường`, `Thanh trạng thái`; kích thước `Bản vẽ lớp kích thước OCR`, `Kích thước đọc được`; trục `Căn chỉnh tự động`; ngược lại đối tượng `lớp đối tượng`, `cây lớp`. Riêng `Ẩn lớp Tường` có chữ hoa giữa câu. Nguồn quy tắc: `CLAUDE.md` A6 ("viết thường, kiểu câu. Ngoại lệ chữ hoa: mã trục, mã lỗi, tên phím"). Thuộc Q2.
- **P6 — Bộ mẫu chung không tương thích màn QC** [V6 F5]: `createSampleBuilding()` làm kích thước in cảnh báo React "hai con có cùng key", nút duyệt không đổi `reviewed` (0/34 → 0/34). Đây là lỗi đang gây hại cho test dùng nhầm bộ; chưa đo nó có xảy ra ở sản phẩm hay không (sản phẩm không dùng bộ chung ở đây).
- **P7 — Vùng `role="status"` biến mất sau `Ctrl+Z` ở kích thước** [V6 F6]: chưa rõ nguyên nhân (có thể do P6). **Chưa đo với bộ mẫu riêng.**

---


### Nhóm V7

Sai trong **sản phẩm**; không đề xuất sửa mã.

1. **F-Q1.** `rooms`/`thickness` chỉ có nội dung qua cửa nạp-kho; mở thẳng là `empty` thật (`useRoomLabelReview.ts:881`, `useThicknessStandardization.ts:860`; `roomLabelReviewGateway.ts:436`, `thicknessStandardizationGateway.ts:214`). Ghi vào kho khi `spatial === null` vô hiệu (`_applyPatches` trả nguyên, `src/store/spatialSlice.ts:38-46`) nên người dùng không thể vẽ tay phòng ra từ rỗng.
2. **F-Q2.** Không màn QC nào có cờ `persist…: true` (bốn cờ liệt kê ở mục 0) ⇒ A7-nửa-sau không kiểm được ở cả nhóm; rooms/thickness im lặng về lưu (không nói sai).
3. **F-R2.** `e2e/viewer3d.spec.ts` ghi floors hiện "0 tầng"; **đo: loading mãi (17 skeleton)** — `isLoading = floorListQuery.isPending || graph === null` (`useFloorManager.ts:570`). Danh sách tầng của mock API tải xong nhưng không được dùng để vẽ hàng. Câu chữ trong tệp spec cần người duyệt sửa (không đụng).
4. **F-R1.** Toast đổi tên phòng lộ mã máy `R-000001ROOM` (`roomFloorCommands.ts:230`, dùng `room.id`) trong khi danh sách gọi phòng đó `#R-001` — A6/UX, cùng họ `W-000001WALL` của walls (V6 F4). Thickness còn `'Chọn dòng W-000032THIK'` (`ThicknessSegmentTable.tsx`, chép từ ghi chú V7) — cùng họ.
5. **F-R3.** `Ctrl+Z` toàn cục không hoàn tác khi tiêu điểm còn trong ô nhập "Tên phòng" (đo: sau `Enter` tiêu điểm ở `INPUT`, tên giữ "Phòng thử e2e"; sau `blur()` mới hoàn tác). Có thể cố ý (giữ hoàn tác của ô văn bản) — người duyệt quyết → Q2.
6. **F-R4.** Rooms hiện **248,60 m²** từ bộ mẫu riêng (`roomLabelFixture.ts:143`, tổng `:167` bằng `totalArea(`), `R-014 = 26,20 m²`; không khớp cả hai con số của A14 (27,60 khai / 17,00 đo hình học). Bộ mẫu QC không phải `createSampleBuilding()` (`questions.md` Q4).
7. **F-T1.** `Ctrl+Z` thừa sau tiêm xoá `spatial` (thickness về 0 đoạn) vì tiêm là một bước zundo (`pastStates` = 1).
8. **F-T2 (nghi, CHƯA xác minh nguyên nhân).** Thickness: sau ô đồng ý + `Xem trước` + `Áp dụng`, độ dày không đổi và không toast; ô đồng ý `.click()` hết 5 s (`ThicknessGroupTable.tsx:74`). Có thể là lỗi thao tác của lượt đo (`force`), không phải lỗi sản phẩm — **không kết luận**.
9. **F-Q4 (từ bỏ sót của ghi chú V7).** Phòng có **A9 thật**: `Gộp phòng` / `Tách phòng` mở `Modal.Root` hỏi trước (`RoomLabelActionDialogs.tsx`, chú thích đầu file: "gộp xoá một phòng… tách sinh thêm một phòng… A9 nói rõ…") — mà tầng đơn vị **không có bài chạy luồng hộp thoại này** (chỉ `mergeCandidatesOf` thuần). Ghi chú V7 chỉ liệt kê nhãn hộp thoại làm mốc neo, không nêu nó là A9 và không đo.
10. **Chữ `3d` viết thường** trong câu nợ thứ hai của floors (`floorManagerGateway.ts:212`: "ẩn tầng khỏi mô hình 3d…") — ký hiệu "3D" hoa ở các nơi khác; ghi nhận, không kết luận vi phạm (A6 cho phép hay không phụ thuộc Q2 của V6).

---


### Nhóm V8

(Thứ sai trong SẢN PHẨM. Không đề xuất sửa mã; người duyệt quyết.)

- **F1 — mã máy lọt ra nút ray tầng, không chỉ ở bộ mẫu.** Bốn nút `role="option"` của ray tầng hiện chữ `L-01FIXTURE0`, `L-02FIXTURE0`, `L-03FIXTURE0`, `L-04FIXTURE0` (đo lớp 2), trong khi `aria-label` cùng nút là "Tầng trệt, cao độ 0,00 m". Truy nguồn (ghi chú V8 **không có file:dòng**): chữ nhìn thấy là `{storey.code}` — `ViewerShell/ViewerStoreyRail.tsx:78`; và `code` được gán là `storey.id` — `ViewerShell/useViewerShell.ts:600` (`code: storey.id`). Hậu tố `FIXTURE0` đến từ `FIXTURE_ID_SUFFIX` — `ViewerShell/viewerShellFixture.ts:68`; nhưng **gốc là `code = storey.id`**: với dữ liệu thật, nút sẽ hiện mã máy của id (dạng `L-…` do `createId` sinh) chứ không phải tên tầng. Vi phạm tinh thần mục B của `CLAUDE.md` ("điều khiển dành cho lập trình viên không xuất hiện trên màn sản phẩm") và A6. **Bài `getByRole('option',{name:/cao độ/u})` của spec hiện có xanh dù chữ nhìn thấy sai** (khớp theo `aria-label`). Không sửa.
- **F2 — thư viện đồ đạc khoá kéo-thả với MỌI vai kể cả admin, và câu giải thích sai với admin.** Nguyên nhân: `canDrag = options.canUploadModel` (`FurnitureLibraryPanel/useFurnitureLibraryPanel.ts:302`); `canUploadModel = canManageLibrary && uploadModel !== undefined` (`FurnitureLibraryPanel.container.tsx:118`); `Viewer3DPanels.tsx:269-273` không truyền `onUploadModel`. Kết quả (V8, đo `admin@example.com`): "Bạn đang xem ở vai chỉ xem nên không kéo mô hình vào bản vẽ được." và mỗi thẻ "Chỉ xem được, không kéo vào bản vẽ.". `onModelDropped` (`Viewer3DPanels.tsx:135`) không bao giờ chạy từ giao diện.
- **F3 — hai panel dữ liệu kẹt `loading` mãi vì kho rỗng.** `RoomAreaPanel` `aria-busy="true"` "Đang tính diện tích…" (15 s), `PropertyInspector` "Đang tải thuộc tính…" (8 s, chọn cả tường lẫn phòng). `useRoomAreaPanel.ts:213,283` (`spatialLoaded: spatial !== null`) → `useRoomAreaPanel.model.ts:571-572`; `PropertyInspector.tsx:67`. `Viewer3DContainer` tiêm bộ mẫu vào vỏ + cảnh (`Viewer3D.container.tsx:237-240`) nhưng không nạp kho. Docblock `viewer3d.spec.ts` "lý do 2" chỉ nói **bảy màn QC**; nó **rộng hơn** — ba panel trong `projectViewer` cũng dính.
- **F4 — hai mã hiển thị khác nhau cho cùng một bức tường.** Lớp phủ sửa hình học ghi `W-404FI`, panel thuộc tính ghi `W-0404FIXTURE0` cho cùng tường (V8). Hai mã hiển thị khác nhau cho cùng thực thể; **không kết luận là lỗi** (V8 cũng không), chỉ ghi để không ai khẳng định hai chuỗi bằng nhau.
- **F5 — nhãn tên trùng khiến `getByLabel` mơ hồ.** `aside` `Thanh tra đối tượng` (`ViewerInspector.tsx:56`) và `section role=region` `Thanh tra đối tượng` (`PropertyInspector.tsx:66`) cùng tên; `Sửa hình học tường` là tên của cả nút bật và vùng lớp phủ (`WallGeometryEditor.tsx:200`). **Đề xuất DUY NHẤT thuộc diện khả năng tiếp cận** (điều khoản ngoại lệ mục 3.2 của việc này, tôi nói thẳng là đang đề xuất sửa cái đó): hai vùng cùng tên cho người dùng đọc màn hình là hai điểm mốc trùng nhau; tách tên là sửa khả năng tiếp cận. Ca e2e hiện xử lý được bằng role nên **không cần sửa để bài chạy**.
- **F6 — "AI" viết hoa trong nhãn chip lọc lịch sử** (`tất cả`/`chỉnh sửa`/`duyệt`/`AI`, V8 2.5). A6 cho phép chữ hoa cho "mã trục, mã lỗi, tên phím"; "AI" không thuộc ba loại này. Chỉ ghi nhận — có thể được người duyệt coi là viết tắt. Không phải nợ Pascal.
- **F7 — hai `role=status` cùng lúc khi mô hình dựng xong** (thanh hiện diện + khối `sr-only`), nên `getByRole('status')` trần trúng 2 (V8 4.1). Không sai sản phẩm, nhưng là bẫy mốc neo.
- **F8 — tour chắn cú bấm thứ hai trên `projectViewer`, không có `role="dialog"`**; lớp phủ `z-40 pointer-events-auto` nuốt mọi cú bấm; bấm vào tấm tối cũng là "bỏ qua" (V8 P1). Cơ chế: bước tour chỉ sống khi neo/phím tồn tại (`useEditorTour.ts:480-483`). Đây không hẳn lỗi mà tính chất; ghi ở đây vì HOP-DONG mục 1.1 đã hụt nó (BO-SUNG 7.7).
- **F9 — ba con số cùng "248,60 m²" nhưng từ ba bộ mẫu khác nhau; A14 nói con số hình học là 238,00.** Đo: thanh trạng thái vỏ 3D ghi `4 tầng · 14 phòng · 248,60 m²` (đo lớp 2), panel diện tích ghi `248,60` sau tiêm `VIEWER_FIXTURE_GRAPH` (đo lớp 2), màn `RoomLabelReview` ghi 248,60 (V7). Đó là `VIEWER_FIXTURE_GRAPH` (`ViewerShell/viewerShellFixture.ts:304`) chứ không phải `createSampleBuilding()`. Xem **Q5**.

---


### Nhóm V9

- **P1 — Ba route không có đường vào từ giao diện.** `ROUTES.project.exploded / measure / overlay` khai ở `src/routes/paths.ts:141,146,149-150`, không nơi gọi trong `src/` (grep). Người dùng chỉ tới được bằng gõ URL. Kiểm: bản đồ điều hướng chưa nối; không phải lỗi bài test.
- **P2 — Mock thiếu route `measurements` ⇒ `measure` luôn `error`.** `src/api/__mocks__/client.ts` 0 lần nhắc `measurements` (grep, V9); yêu cầu `GET /api/projects/project-1/measurements` rơi ra máy chủ dev, 404 (`measurementToolGateway.ts:609`, `endpoints.ts:6,116`).
- **P3 — (tiếp P2) M-1 phụ thuộc vào chỗ hở ấy.** Nếu ai vá mock, ca "error dựng sẵn" đổi nghĩa; ghi trong tên ca.
- **P4 — Nhãn `thoát chế độ đo (phím Esc)` (`MeasurementTool.tsx:184`) không thoát công cụ.** Đo (V9 + đo lớp 2): `Escape` và bấm nút đều bỏ nháp, ray vẫn `đo (M)`. Mô tả đăng ký nói "thoát chế độ đo, bỏ phần đường dở dang" (`useMeasurementTool.ts:169`); `onEscape` (`:745-748`) chỉ `runToolEvent({type:'cancel'})` + `clearDraft()`. Thoát thật chỉ bằng `M` hoặc nút `bật tắt công cụ đo`.
- **P5 — Vai viewer đo được nhưng ray không có chỗ hiện "đang đo".** Đo lớp 2: `đo (M)` bị gỡ khỏi ray (5 công cụ, `useViewerShell.ts:153` `requiresEdit:true`), `M` vẫn vào chế độ đo và **không nút ray nào `aria-pressed=true`**; caption nói "vẫn đo và đọc số bình thường". Người dùng dùng bàn phím/đọc màn hình không có dấu hiệu chế độ.
- **P6 — Hai câu `forbidden` cạnh nhau viết hoa khác nhau.** `exploded` viewer (đo lớp 2): `Bạn đang xem ở vai người xem nên không sửa được vị trí tầng.` (chữ thường) và `Bạn đang xem ở vai Người xem nên không sửa được mô hình.` (`ViewerInspector.tsx:82-88`, hoa). Câu thứ nhất: `ExplodedView/ExplodedView.tsx:130` (`<span className="sr-only">`: chữ chỉ dành cho trình đọc màn hình; `innerText` vẫn đọc được nên `getByText` khớp). Không chắc là vi phạm A6 (tên vai có thể hoa), ghi để người duyệt.
- **P7 — Bốn nhãn quảng cáo phím không đăng ký** (`quay quanh mô hình (R)`, `kéo màn (H)`, `mặt cắt (C)`, `chọn (V)`; `useViewerShell.ts:151,152,154,155`), trên **cả `exploded` lẫn `measure`** (sổ đăng ký đo, V9). `useKeyboardMap.ts:26` và `lib/tools/shortcuts.ts:81` khai phím công cụ nhưng không `register`. Câu hỏi Q-V9-1.
- **P8 — Trên `measure`, `Escape` không bao giờ tới `global.closeTopLayer`** vì `measurementTool.draft.cancel` đăng ký `canvas` suốt lúc mount (`useMeasurementTool.ts:846-856`); trong khi vỏ `/3d` cố ý chỉ đăng ký Esc khi có chọn để không che `closeTopLayer` (`viewerShellShortcuts.ts:28-34`). Hai màn cùng vỏ, hai chính sách khác nhau. Hôm nay vô hại (không lớp nào để đóng); trở thành hại nếu sau này có dialog `global`.
- **P9 — `exploded` có một dòng console 404 mà không truy được nguồn** (V9). Không tái hiện ở 4 lượt sau. Đừng khẳng định `exploded` sạch console.
- **P10 — Nhãn `L-01FIXTURE0…` xuất hiện cả ở `exploded`/`measure` sau bơm** (V9 text sau bơm). Đã là Q8 của `questions.md`; thêm hai màn vào phạm vi ảnh hưởng.


### Nhóm V10

Thứ sai trong SẢN PHẨM; **không đề xuất sửa**. **[✓]** = tôi tự đọc/chạy lệnh đọc; **[V10]** = từ ghi chú.

- **P1 — "CSP 4 → 0" không còn đúng với mã hiện tại.** Nhát vá của vi phạm #1 (`eval` do phép dò `allowsEval` của zod 4.5.4) nằm ở `src/vach-ngan.tsx:30` (`window.__zod_globalConfig = { jitless: true }`, `docs/pascal/01-ho-so-cong-T4.1.md:~760` [V10]). **`ls src/vach-ngan*` → "No such file or directory"** [✓ tôi chạy]; `grep -rn jitless src vite.pascal.config.ts vendor/pascal/shims` → **0 kết quả** [✓]. Đo [V10]: dưới CSP tự dựng (`script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'`) `securitypolicyviolation` ghi **1 vi phạm** `script-src | eval | …/assets/pascal/pascalMount-D-XGBRdU.js`; cảnh vẫn dựng nên không ai thấy. Ba vi phạm `connect-src` (Iconify) **không tái hiện** ([V10]: cấu hình `vite.pascal.config.ts:29-32` alias `@iconify/react/offline` còn hiệu lực; chỉ có WebSocket Vite dev). **Không rõ nhát vá đã bị xoá hay chưa từng được chuyển từ bản spike sang màn thật** — lịch sử git của `src/vach-ngan.tsx` **chưa truy** [V10]. Hạn chế đo [V10]: CSP là tự dựng, có `'unsafe-inline'`; chính sách thật `B0-08.md:119` không có trong repo; vi phạm `eval` không phụ thuộc hai điểm ấy.
- **P2 — Bốn số Pascal in ra không phải bộ A14 và trang chỉ có tường bao + phòng.** `graph.walls.length`/`graph.openings.length` (`usePascalViewer.ts:370-371` [✓ tôi đọc `wallLabel`, `openingLabel`]) đếm đồ thị **trước** khi đổi; đồ thị là `VIEWER_FIXTURE_GRAPH` (`viewerShellFixture.ts:304-314` [V10]) với **`openings: []`** viết thẳng (`:308` [✓]) và 16 tường = 4 tầng × 4 tường bao (`:286-288`, docblock `:1-33`). `toPascal.ts` **không** làm mất 48→16 và 16→0 (nó lặp qua `graph.walls` `:472`, `graph.openings` `:501`; [V10]). Hệ quả: e2e không kiểm được cửa/cửa sổ/đồ đạc trên màn này; `<dt>ô mở</dt>` luôn hiện `0`. Không phải lỗi dữ liệu trên đường đi — hai bộ khác nhau **có chủ ý** ([V10] mục 5); quyết định giữa hai bộ: Q1.
- **P3 — Đồ đạc xuất sang Pascal ở cao 0 m.** `docs/pascal/04-doi-chieu` dòng 109 nói `FURNITURE_HEIGHT_M = 0` (`toPascal.ts:64` [V10]); với bộ mẫu này đồ đạc = 0 nên chưa ai thấy. Chưa đo.
- **P4 — Nhãn nút DOM lặp đôi.** Nút `thử lại` có `textContent` `"thử lạithử lại"`; nút `mở khung xem` cũng lặp đôi ([V10]). Đây là cùng kiểu đã thấy ở các màn khác cùng đợt ("Đăng nhậpĐăng nhập", "Tạo dự ánTạo dự án"); tên truy cập thật **chưa đo** ở màn này. Nguyên nhân chung chưa điều tra (nghi thành phần `Button`).
- **P5 — Docblock của `pascal-viewer.spec.ts` lỗi thời hai chỗ.** (a) Nói "41 bài kiểm đơn vị" trong khi số thật là **33** (BỔ SUNG mục 5, `don-vi-theo-man.md`). (b) Nói `error` "không dựng lại được chỉ bằng thao tác trình duyệt" — [V10] mục 6 đo được ba cách dựng `PASCAL-01` bằng `page.route` chặn `pascal-mount.js`. Đây là ghi chú sai trong tệp test hiện có, không phải lỗi hành vi sản phẩm.
- **P6 — HOP-DONG ghi "thân 141 ký tự" khi cờ tắt; [V10] đo 145.** Chênh 4, nguồn chưa rõ (có thể đếm khác: bỏ dòng trống). Ghi để HOP-DONG được cập nhật; ca không được khẳng định `toHaveLength`.
- **P7 — 404 console của Pascal không ổn định.** Cờ tắt: 1 `Failed to load resource: 404` (lặp 3 lượt); cờ bật: lượt đầu 1 lần, các lượt sau 0 ([V10]). [V10] bắt cả `response` lẫn `requestfinished` (≥400): **cả hai rỗng** dù console báo 404 ⇒ yêu cầu không đi qua vòng `response` của trang ⇒ khả năng là yêu cầu của chính trình duyệt. Ghi chú lượt trước (V1, cùng đợt, tôi đo) đã thấy `favicon.ico` 404 là yêu cầu đầu tiên của một tiến trình trình duyệt. **URL thật ở màn Pascal: chưa xác định** — không kết luận là favicon; và **không** ghi thành phát hiện của Pascal.

---


### Nhóm V11

- **P1 — `docs/pascal/00-quyet-dinh.md:197` lạc hậu** (V11 F1, lớp 2 xác nhận): "`editor` và `nodes` **không** được cài"; `package.json:30-31` cài cả hai; `nodes` được nạp thật (`src/components/pascal/pascalScene.ts:27`, V11); `editor` được cài nhưng chưa ai dựng.
- **P2 — HOP-DONG ghi sai hai chi tiết mã nguồn Pascal** (BO-SUNG 7.1, 7.2 đã sửa): đường `vendor/pascal/…` chứ không `src/vendor/…`; sidebar có **2** tab (`icon-rail.tsx:42`), không 5. (Lớp 2 xác nhận cả hai.)
- **P3 — (xuyên nhóm) Dòng console `Failed to load resource … 404` lượt đầu trên nhiều màn là `/favicon.ico`, không phải tài nguyên của màn nào.** Đo lớp 2 bằng CDP `Network.responseReceived` (bộ nghe `response` của Playwright **không thấy** yêu cầu favicon, nên các worker khác chỉ thấy dòng console mà không thấy URL): trên `/projects/project-1/3d/exploded`, chuỗi 404 duy nhất là `Other http://127.0.0.1:5199/favicon.ico`; `curl` cho `/favicon.ico` → 404 (`favicon.svg`,`vite.svg` → 200 vì máy chủ dev trả nền SPA cho đường lạ); `index.html` (đọc lớp 2) **không có thẻ `<link rel="icon">`** nên trình duyệt tự hỏi `/favicon.ico`. Giải thích **ít nhất** dòng 404 chưa truy được của V9 (`exploded`) và V11 F6, và khả năng cao cả bốn màn BO-SUNG mục 6 nêu (`accessDenied`, `notifications`, `projectMeasure`, `pascal` — chỉ `projectMeasure` đã có URL thật khác: `/api/projects/project-1/measurements`). **Chưa đo** trên bốn màn còn lại; "dùng chung một tài nguyên" là suy luận từ một màn. Bằng chứng: `index.html:1-10` không có `<link rel="icon">`. Ghi thành phát hiện, **không đề xuất sửa** (ngoài phạm vi; người quyết định).
- **P4 — Hộp Pascal cao 190 px** ở khung 1440×900 (V11 F5, lớp 2 lặp lại `ch=190`): `PascalViewer.tsx:~150` `min-h-[12rem]` (=192 px) rồi `flex-1` — có vẻ đang ở chiều cao tối thiểu. **Chưa đo** với cửa sổ khác. Ảnh hưởng nếu có ca bấm/kéo trên canvas: vùng bấm nhỏ. Không phải ca.
- **P5 — V11 F7 "trang Pascal không có button nào" đã đối chiếu** (V11 ghi "chưa đối chiếu"): đo lớp 2 `pageButtons: 0` trên toàn tài liệu, cờ bật, sau khi cảnh dựng xong. (Chưa đối chiếu `probe-35-routes.json`: probe không có khoá Pascal — V11 mục 5 F7; tôi **không** tìm khoá Pascal ở tệp ấy, ghi "chưa đối chiếu".)


### Nhóm V12

- **F1 — Bốn màn phụ thuộc kho luôn ở `empty` khi đi bằng đường sản phẩm.** `setFloors`/`setProject`: 0 nơi gọi ngoài kho và test (`store/projectSlice.ts:33-34`); `setSpatial` chỉ ở 7 hook QC và chúng đọc lại kho rỗng (`qc/RoomLabelReview/roomLabelReviewGateway.ts:435-437`). (V12 0.1, đo.) Hệ quả: `projectRules`, `projectRuleSettings`, `projectExport`, `projectData` không bao giờ ra `success` nếu không bơm.
- **F2 — Nút chính của `empty` ở `projectRules` dẫn tới `error`.** `rules/RuleReport/RuleReport.tsx:172` (`Chạy kiểm tra`) → `useRuleReport.ts:365-368` ném `RUN_FAILED_MESSAGE` khi `graph===null` → `RuleReport.tsx:181-186` `Không chạy được lượt kiểm tra`. (V12 đo.)
- **F3 — Toast hoàn tác của `RuleSettings` và `account` không tồn tại ở cấp route.** `rules/RuleSettings/RuleSettings.container.tsx:144-146` không truyền `onToast`; hook có sẵn vé (`useRuleSettings.ts:434-463`). `Ctrl+Z` toàn cục chỉ theo dõi `spatial` (`useRuleSettings.ts:36-40`). `account`: sửa họ tên/đổi chủ đề không toast, `Ctrl+Z` không hoàn tác (V12 đo). Vi phạm A8 ở hai màn (đăng xuất phiên là ngoại lệ có toast, đơn vị).
- **F4 — Không màn nào nối hành động sửa cho `ViolationDetail`.** `rules/RuleReport/ruleReportGateway.ts:48-52`: `canAutoFix/canDismiss/canPreview3d` = `false` cố định, có ghi lý do dài; tấm hiện `Chưa có cách sửa tự động nào cho vi phạm này.` Đây là *hiện trạng đã lập luận* (docblock `ruleReportGateway.ts:1-45`), **không phải lỗi** — ghi để không ai lập ca chờ `Lựa chọn xử lý`.
- **F5 — Xuất `.glb` có thể không tải được.** `export/ExportPanel/exportPanelGateway.ts:747-757`: `<a download>` chưa gắn DOM, `click()`, rồi `URL.revokeObjectURL` ngay. Sự kiện `download` của Playwright không nổ trong 8 s và 5 s (V12). **Nguyên nhân chưa chứng minh** — giả thuyết thu hồi URL quá sớm. Dòng vẫn hiện trong `tệp đã xuất` (`160,3 KB`) ⇒ giao diện nói "đã xuất" trong khi chưa rõ tệp tới máy.
- **F6 — Chip `xem hướng dẫn` che nút `chia sẻ`.** `system/EditorTour/EditorTour.tsx:382-384` (`fixed right-[16px] top-[16px]`) vs nút `export/ExportPanel/ExportPanel.tsx:237-238`. Đo: 1200 px chip `[1058,16,126×32]` vs nút `[1081,24,95×32]`; 1279 px `[1137,16,…]` vs `[1160,24,…]`; `elementFromPoint`=`SPAN:xem hướng dẫn`. `click()` thường: 62 lần thử rồi hết 30 s (V12).
- **F7 — `projectData` empty nói "Hợp lệ … 0 lỗi".** `export/SpatialJsonViewer/spatialJsonModel.ts:269` hiện dải hợp lệ khi chưa có dữ liệu để kiểm. Nhẹ.
- **F8 — Không nhất quán dấu nhóm nghìn.** `SpatialJsonDetail.tsx:65-67` in `Còn 2487 dòng nữa` (số thô) trong khi `billing` `5.000`, `2.016,00`. Nhẹ; không thuộc A15 (A15 nói dấu thập phân).
- **F9 — `projectVersions` không mở được từ URL.** `export/VersionHistory/VersionHistory.container.tsx:183-187` cần `activeFloorId` (store) mà route `/projects/:projectId/versions` (`paths.ts:106`) không mang; nơi duy nhất đặt `activeFloorId` trong sản phẩm là `viewer/OverlayComparison/useOverlayComparison.ts:881`. Kể cả có tầng: `versionHistoryGateway.ts:129-130` `chưa có nguồn dữ liệu phiên bản nào được nối vào màn này`. (V12 đo.) → Q-V12-B.
- **F10 — Nhánh 403 của mock `adminUsers` không được giao diện gọi tới.** `src/api/__mocks__/client.ts:948` nhưng hook chặn bằng `enabled: canManage` (`admin/UserManagement/useUserManagement.ts:498,510,522`, `userManagementGateway.ts:243`); `engineer` phát ra 0 yêu cầu `user` (V12). Ca `forbidden` chạm được là cổng phía client.
- **F11 — Panel mời người dùng không đóng bằng `Esc`.** `admin/UserManagement/UserManagementToolbar.tsx:115-136` — khối inline, không `role="dialog"`; `grep useShortcut|Escape` trong `UserManagement*.tsx` rỗng (V12 đo: `Escape` xong khối vẫn còn). A12 hứa "Esc đóng lớp trên cùng". → Q-V12-C.
- **F12 — Tự mâu thuẫn chữ ở `RuleSettings` trạng thái `empty`.** `rules/RuleSettings/RuleSettings.tsx:270-276` `chưa có bộ luật để cài đặt` / `Chưa có luật không gian nào được nạp cho dự án này.` trong khi `:252-254` in `23/25 luật đang bật`. (Q-V12-A.)
- **F13 — Ghi chú lớp 1 thiếu (đo lớp 2 bù):** `viewer` trên `/export` là `forbidden` thật, không cần bơm (mục 0.3) — V12 ghi "chưa đo `viewer`". Và `Escape` phạm vi của `ModelLibraryDetail` là `sidePanel` (`ModelLibraryDetail.tsx:283-289`) — V12 ghi "chưa grep".
- **F14 — Nhãn `ModelLibrary` lệch hoa/thường với `UserManagement`:** `Đường dẫn trang` (`ModelLibrary.tsx:36`) vs `đường dẫn trang` (`UserManagement.tsx:47`) và `RuleReport.tsx:82` (`đường dẫn trang`). Nợ A6 nhẹ; **ảnh hưởng mốc neo**: `getByRole('navigation',{name:'đường dẫn trang'})` **không khớp** `ModelLibrary` nếu khớp phân biệt hoa/thường (Playwright mặc định không phân biệt với chuỗi — nhưng chưa đo; dùng đúng chuỗi từng màn).

---
