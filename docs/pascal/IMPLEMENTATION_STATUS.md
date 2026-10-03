# Trạng thái tích hợp Pascal vào AppFront

Cập nhật: **2026-09-28**, trên nhánh `mungvu2004/tich-hop-pascal` (HEAD `76eff9b`).
Tài liệu này là bản đọc-trước-khi-tiếp-tục. Luật của nó: **không có bằng chứng thì ghi "không
biết"**, và **không bước nào được ghi "đạt" nếu chưa chạy** (E.11 · E.10).

Ba tài liệu đi kèm, đọc khi cần chi tiết: `00-quyet-dinh.md` (nguyên lời người dùng),
`01-ho-so-cong-T4.1.md` (số đo của đợt G3), `02-soat-dong-dot-G3.md` (soát 71 mã việc),
`03-buoc-8-bo-doi-du-lieu.md` (bộ đổi dữ liệu). Kế hoạch và sổ tay ở ngoài repo:
`F:/pascal-work/ke-hoach-ghep-pascal-ban-2.md`, `F:/pascal-work/so-tay-ban-2.md`.

---

## 1. Mục tiêu

Đưa Pascal (`pascalorg/editor`, phát hành thành bốn gói `@pascal-app/*`) vào AppFront làm màn
không gian 3D, lấy **đúng phần cần dùng** chứ không kéo cả repo. Phạm vi đã chốt ở cổng T4.2:
**A — xem + sửa** (`00-quyet-dinh.md`, bản 3, 2026-09-27).

## 2. Trạng thái repository

| Thứ | Giá trị | Bằng chứng |
|---|---|---|
| Nhánh làm việc | `mungvu2004/tich-hop-pascal`, đi trước `master` **9 commit** | `git log master..HEAD` |
| Cây làm việc | **sạch**, 0 tệp chưa track | `git status --porcelain -uall` rỗng |
| `master` | `ddbf8e8` — đã gồm PR #4 và PR #6 | `gh pr list --state all` |
| PR #7 (three 0.186) | **CLOSED, không gộp vào master** — nội dung đã rebase rồi gộp `--no-ff` vào nhánh này (merge `aa21bc1`) | `gh pr view 7`, `git log` |
| PR #5 (cổng visual) | **OPEN**, chờ thứ ngoài tầm | `gh pr list` |
| node · pnpm | 24.16.0 · 9.4.0 (máy này; `package.json` **không** khai `packageManager` lẫn `engines`) | `node -v`, `pnpm -v` |
| react · three | 19.2.7 · 0.186.0 | `package.json:32,36` |
| typescript · vite · vitest | 5.5.3 · 5.3.4 · 2.0.3 | `package.json:81,82,83` |
| lucide-react | **0.414.0** | `package.json:31` |
| `@react-three/fiber` · `drei` | **chưa cài** | không có trong `package.json` lẫn lockfile |
| `@pascal-app/*` | **chưa cài** | như trên |
| `src/components/pascal/` | **chưa tồn tại** | `test -d` |
| Cổng kích thước | **bốn** trần: màn đầu 175 · chunk lớn nhất 170 · route 280 · CSS 12; thêm một mốc **cảnh báo** tổng JS 800 (không chặn) | `scripts/check-bundle-size.mjs:91,99,109,111,123` |
| Cổng thứ năm (thư mục Pascal) | **chưa có** — sẽ là T9.1 | — |

### Ba chỗ tài liệu cũ đã lạc hậu

1. `02-soat-dong-dot-G3.md:30` ghi *"Gộp ba PR — CHỜ NGƯỜI DÙNG"*. **Đã xảy ra một phần**: #4 và
   #6 gộp rồi, #7 bị đóng có chủ ý (mọi thao tác chuyển sang nhánh riêng, không làm gì trên
   `master`), #5 vẫn treo.
2. Sổ tay ghi T8.1 và T8.3 *"Sau: T5.5"* (`so-tay-ban-2.md:594,596`). **Thực tế đã làm mà không
   chờ T5.5**, vì Bước 8 chỉ đọc hợp đồng của Pascal chứ không gọi Pascal.
3. `00-quyet-dinh.md:176-178` và `03-buoc-8:8-9` đều ghi Bước 5 đứng sau *"một bản phát hành của
   fork"*. **Không còn đúng như một điều kiện cần** — xem mục 4.1.

## 3. Việc đã hoàn thành

| Bước | Mã việc | Trạng thái |
|---|---|---|
| 1 — gỡ chốt, rebase, đo lại nền | T1.0–T1.5 | **XONG** |
| 2 — đo giây, độ mượt, CSS | T2.1–T2.8 | **hỗn hợp** — số đã có; T2.6 (sửa điểm kéo trong `e2e/i-commit.spec.ts`) còn làm được ngay |
| 3 — cắt gọt và quy đổi | T3.1–T3.7 | **XONG** — bước duy nhất không kèm chữ "nhưng" |
| 4 — cổng quyết định | T4.1, T4.2(1), T4.3 | **XONG**; T4.2(2) và T4.2(3) còn treo — mục 6 |
| 5 — hợp nhất nền | T5.0, T5.1, T5.2 | **XONG, đã vào master** (PR #4, #6) |
| 5 — three 0.186 | T5.3 | **áp trên nhánh này**, không vào master (PR #7 closed) |
| 8 — bộ đổi dữ liệu | T8.1–T8.8 | **XONG** — 7 tệp `src/lib/pascal`, 51 + 7 bài kiểm, độ phủ 96,99 % |

### Bước 8 nay có bằng chứng mà hôm 27/09 còn thiếu

`03-buoc-8-bo-doi-du-lieu.md:156-159` tự ghi giới hạn: *"bài kiểm hôm nay chứng minh hình dạng,
không chứng minh lược đồ zod chấp nhận nó."* **Lỗ đó đã bịt, 2026-09-28**, đo trên gói thật
`@pascal-app/core@1.0.0` trong `F:/pascal-spike` (AppFront **không** thêm phụ thuộc nào):

| Phép kiểm | Kết quả |
|---|---|
| `validateBuildJson(toPascalScene(createSampleBuilding()).scene)` — lược đồ zod **thật** của Pascal | `ok: true` · **0 lỗi · 0 cảnh báo · 0 vấn đề lược đồ** |
| Đếm node theo loại | 105 node: `level` 4 · `wall` 48 · `door` 9 · `window` 7 · `zone` 14 · `item` 21 · `building` 1 · `site` 1 — khớp từng con số của A14 |
| Danh sách bỏ qua | 39: **4** trục + **34** kích thước + **1** ghi chú — khớp A14 |
| `useScene.setScene(nodes, rootNodeIds)` — **store thật** của Pascal | nhận đủ **105/105** node, **0** node bị dọn đi, `rootNodeIds = ["site_APPFRONT"]` |
| `metadata.appfront` sau khi qua store | **còn nguyên** (`reviewed`, `confidence`, `source`, `fields`) — vật chứa của A5 sống qua store thật |
| `setReadOnly(true)` | **hoạt động** — chế độ chỉ-xem là cơ chế có sẵn của Pascal, không phải thứ phải tự dựng |

Một con số lệch, và nó **không** phải khuyết tật: `stats.floorAreaM2 = 0`. Pascal chỉ cộng diện
tích từ node loại `slab` (`core/dist/validation/validate-build-json.js:236-247`), còn AppFront
sinh `zone`. Hệ quả cần biết ở Bước 9: **cảnh từ AppFront không có sàn** — tường, ô mở, phòng thì
có, mặt sàn thì không.

Một ghi chú A6: node `zone` mang tên `"Room 0"` — chữ Anh. Nó đến từ **bộ mẫu**
(`sampleBuilding.ts:156`), không từ bộ đổi dữ liệu (`toPascal.ts:221` chỉ chuyển tiếp
`room.name`). Nhưng tên node **hiện trên giao diện Pascal**, nên dữ liệu thật phải có tên tiếng
Việt, nếu không A6 vỡ ở bên kia tường.

## 4. Kết quả điều tra — bốn gói Pascal

Đo trên `F:/pascal-spike/node_modules/@pascal-app/**` (bản cài 1.0.0) và `npm view` (bản công bố
1.0.3). Giấy phép cả bốn gói: **MIT**, Copyright (c) 2026 Pascal Group Inc., mỗi gói có tệp
`LICENSE` riêng.

### 4.1. Gói đã có trên npm công khai — fork **không** phải điều kiện cần để có gói

```
npm view @pascal-app/{core,editor,nodes,viewer} version  →  1.0.3   (spike đang dùng 1.0.0)
```

Không lỗi 404. Lịch sử phiên bản đầy đủ (0.3.x → 1.0.0-beta.x → 1.0.0 → 1.0.1 → 1.0.3).
Nên câu *"Bước 5 đứng sau một bản phát hành của fork"* cần sửa lại cho đúng: **nguồn gói không
còn là vật cản; cái fork giải quyết là hình dạng của gói `editor`** — mục 4.3.

### 4.2. ĐÍNH CHÍNH — bảng dưới đúng về *phụ thuộc*, nhưng kết luận rút ra từ nó thì SAI

Bảng ở 4.2a liệt kê đúng: `core` và `viewer` sạch, mớ rắc rối nằm trong `editor`/`nodes`. Nhưng tôi
đã rút từ đó một kết luận không đo: *"`core` + `viewer` dựng được cảnh AppFront"*. **Sai.** Mục 4.9
ghi phép đo bác bỏ nó. Giữ bảng lại vì dữ kiện trong bảng vẫn đúng và vẫn cần; đừng đọc nó như một
lời khuyên chọn gói.

### 4.2a. Phụ thuộc: mớ rắc rối nằm **gọn trong `editor`** (và `nodes`), không ở `core`/`viewer`

| | `core` | `viewer` | `editor` | `nodes` |
|---|---|---|---|---|
| Có `dist` dựng sẵn + `types` | **có** | **có** | **KHÔNG** | có |
| Peer `next >= 15` | không | không | **CÓ** | không (nhưng peer `editor`) |
| `@iconify/react` (3 CDN ngoài → 4 vi phạm CSP) | không | không | **có** | — |
| `lucide-react` | không | không | dep `^1.7.0` | **peer `^1`** |
| `manifold-3d` (541 KB `.wasm`) · `pdfkit` · `howler` · `motion ^12` | không | không | **có** | — |
| Dựng được cảnh AppFront? | — | **có** — `viewer/dist/systems/` có đủ `wall`, `door`, `window`, `zone`, `item`, `level` | — | không cần (nó là bảng thuộc tính để **sửa**) |

Bằng chứng cho dòng "không": `grep -rlE "@iconify|lucide-react|next/image|next/link|pdfkit|manifold|howler"`
trên `core/dist` và `viewer/dist` trả về **rỗng** (một lần khớp duy nhất ở `core/dist/registry/types.d.ts:1383`
là **chú thích**, không phải import).

**Đọc cho đúng:** đây là phát biểu về *phụ thuộc*, không phải về ngày công. Bước 7 (tiếng Việt,
dấu phẩy thập phân theo A15, đổi tên CSS, `keyboard:'host'`) vẫn phải làm cho `viewer` nếu đi
hướng chỉ-xem. Cái biến mất trong hướng chỉ-xem là: shim `next/image`/`next/link`, Iconify ngoại
tuyến, xung đột lucide, `manifold.wasm`, `pdfkit`, `howler`, và runtime chuyển động thứ hai.

### 4.3. `editor` vẫn chưa được dựng, kể cả ở bản 1.0.3

```
npm view @pascal-app/editor@1.0.3 exports
  { ".": "./src/index.tsx", "./catalog": "./src/components/ui/item-catalog/catalog-items.tsx", … }
npm view @pascal-app/editor@1.0.3 main types   →  (không có cả hai)
npm view @pascal-app/editor@1.0.3 peerDependencies.next  →  ">=15"
```

Tức bản mới nhất trên npm **vẫn** xuất mã TSX nguồn và **vẫn** đòi Next.js. 26+ tệp nhập
`next/image`, 1 tệp nhập `next/link`. Đây chính là việc T6.2–T6.6 của fork tồn tại để làm.

### 4.4. Ba thứ bất kỳ hướng nào cũng phải xử lý

1. **`process.env` ở tầng module.** `viewer/dist/lib/asset-url.js:2` —
   `export const ASSETS_CDN_URL = process.env.NEXT_PUBLIC_ASSETS_CDN_URL || 'https://editor.pascal.app'`.
   Vite không polyfill `process`, nên thiếu `define` là **`ReferenceError` ngay lúc nhập module**.
   Mặc định của nó trỏ ra **CDN ngoài do Pascal vận hành**; AppFront phải đặt lại, nếu không mọi
   URL tài sản đi ra ngoài `src/lib/http`.
2. **`viewer/dist/lib/texture-reference.js:12`** đọc `process.env.NEXT_PUBLIC_SUPABASE_URL` — có
   ràng buộc cứng với Supabase.
3. **`@types/three@0.186.0` khai `@dimforge/rapier3d-compat` làm dependency thật**
   (`pnpm-lock.yaml:6549-6551`). Bất thường với một gói *types*, đã kiểm hai lần. Nó là
   devDependency nên không vào gói sản phẩm, nhưng đừng để con số ấy lọt vào phép đo dung lượng.

### 4.5. Bề mặt Next.js của `editor` **đóng lại ở hai module** — đã đếm, không đoán

Cả hai vai tranh luận (mục 10) đều dừng ở cùng một câu "chưa đo": shim `next/*` có đủ, hay nó sẽ
phình thành một fork ẩn trong cấu hình vite? Đếm xong:

| Đo | Kết quả |
|---|---|
| Module `next/*` mà `editor/src` nhập | **đúng hai**: `next/image` (26 tệp) · `next/link` (1 tệp) |
| `next/router` · `next/head` · `next/navigation` · server action | **không có** |
| Biến `process.env` cần `define` | **7**: `NEXT_PUBLIC_{APP_URL,SUPABASE_URL,VERCEL_ENV,VERCEL_PROJECT_PRODUCTION_URL,VERCEL_URL}` · `NODE_ENV` · `PORT` |
| `'use client'` | 172 tệp — vô hại ngoài Next, bundler chỉ cảnh báo |
| Lớp shim mà dự án thử **đã** viết | `next-image.tsx` **10 dòng** + `next-link.tsx` **7 dòng** = **17 dòng**, cộng một alias `@iconify/react` → `@iconify/react/offline` |

Kết luận: **dùng `editor` thẳng từ npm với 17 dòng shim là đường đã chạy thật**, không phải giả
thuyết — dự án thử làm đúng thế và `mount()` chạy, CSP 0 vi phạm. Nỗi lo "fork ẩn" đã bị đo bác bỏ.

### 4.6. Hướng chỉ-xem nặng bao nhiêu — đã dựng và đã cân

Dựng `core` + `viewer` + React + three + R3F + drei thành **một** tệp (vite lib mode, terser, mọi
thứ nội tuyến), trên `@pascal-app@1.0.0` trong `F:/pascal-spike`:

| | KiB |
|---|---|
| thô | 7 143,8 |
| **gzip** | **1 578,6** |

Đối chiếu với đường `editor` (vách ngăn 8 tệp, `01-ho-so-cong-T4.1.md` §7): **2 170,4** gzip trước
nhát cắt C2, **≈ 1 727,6** sau C2.

**Đọc cho đúng, và đây là chỗ dễ kết luận sai nhất của cả phiên:** hai con số đến từ **hai đường
dựng khác nhau** (một tệp nội tuyến ↔ tám tệp có tách chunk), nên **không trừ nhau được**. Cái nói
được là bậc độ lớn: **1 578,6 và ≈ 1 727,6 cùng một bậc**, không phải một nửa. Lý do: `three` +
R3F + drei chiếm phần lớn khối lượng, và **cả hai hướng đều cần chúng**.

Nên phát biểu đúng là: **rút về chỉ-xem KHÔNG phải một nhát cắt dung lượng.** Cái nó cắt là chỗ
khác — mục 10.

Một cái bẫy tôi tự bước vào ở lượt đo này, ghi lại vì nó xác nhận cảnh báo cũ: lượt dựng đầu
**không** khai `publicDir: false`, nên nó chép cả `public/` của dự án thử (`assets`, `audios`,
`icons`, `items`) vào thư mục ra. Đúng cái `01-ho-so-cong-T4.1.md` §7 đã cảnh báo: *"thiếu dòng đó
là đếm 7,8 MB tài sản của app thành dung lượng Pascal"*. Con số 1 578,6 ở trên là **chỉ tệp JS**,
đã loại phần chép nhầm ấy.

### 4.7. Thư viện tài sản 5 398,2 KiB **không nằm trong gói nào**

`find` trên cả bốn gói `@pascal-app/*`: **0** tệp `.webp`, **0** `.glb`, **0** `.mp3`. Con số
5 398,2 KiB (224 `.webp` + 145 `.glb` + 24 `.mp3`) đến từ `public/` của **dự án thử**, tức đã được
chép tay từ repo Pascal.

Và bộ đổi dữ liệu của AppFront **không trỏ tới một tệp nào trong đó**: cả 21 đồ đạc dùng
`asset://appfront/table`, `asset.dimensions = [0,8 · 0 · 0,8]`.

**Hệ quả cho câu hỏi T4.2(2):** đơn vị ≈ 7 125,8 KiB mà mọi tài liệu đang dùng **gồm 5 398,2 KiB
thư viện đồ đạc/vật liệu/âm thanh của Pascal mà AppFront hiện không dùng tệp nào**. Chốt trần theo
con số ấy là chốt trần cho một thứ có thể không bao giờ được chép vào. Câu hỏi phải tách làm hai:
*có tự host thư viện tài sản của Pascal không*, rồi mới tới *trần bao nhiêu*.

*(Phụ, cho ai mở rộng Bước 8: bộ mẫu cho cả 21 đồ đạc cùng `kind: 'table'` —
`sampleBuilding.ts:143`. Nên bài kiểm vòng tròn chưa bao giờ chạy qua hai loại đồ đạc khác nhau.
Không phải lỗi bộ đổi dữ liệu, là lỗ che phủ.)*

### 4.9. Đo trong trình duyệt — và nó lật lại mục 4.2

Dựng cảnh nhà mẫu bằng `viewer` thật trong Chromium (SwiftShader), ghi mọi yêu cầu mạng. Năm lượt,
mỗi lượt đổi đúng một biến.

| Lượt | Cách nhúng | Kết quả |
|---|---|---|
| 1 | `setScene` → `<Viewer/>` | 105 node trong store, WebGL sống, **không vẽ gì**, `ready` không đo |
| 2 | thêm `loadScene()`, chụp ảnh trước khi chạm canvas | **`ready: false`**, không vẽ gì |
| 3 | `registerNode` 6 loại, **bỏ shim `next/*`** | **DỰNG HỎNG**: *"Rollup failed to resolve import `next/image` from `@pascal-app/editor/src/components/ui/controls/tool-options-panel.tsx`"* |
| 4 | như 3, **bật lại shim** | dựng được, `ready: false`, không vẽ gì |
| 5 | đường bootstrap **chính thức**: `await loadPlugin(builtinPlugin)` rồi mới mount | **48 loại node đã đăng ký**, 105 node, `bootErr: null`, vẫn **`ready: false`**, `hydrationToken: null`, **85/105 node còn bẩn**, không vẽ gì |

#### Cái lượt 3 chứng minh — và nó là phát hiện quan trọng nhất của mục này

`nodes/dist/index.d.ts` nói thẳng: *"Apps load this once at bootstrap (`loadPlugin(builtinPlugin)`)
**before mounting the viewer**… As of Phase 6 the legacy mount points in `viewer/` are gone —
**every kind dispatches through the registry**."*

Tức **`nodes` là bắt buộc để vẽ được bất cứ thứ gì.** Và:

| Đo | Kết quả |
|---|---|
| `nodes/dist` nhập `@pascal-app/editor` | **220 lần** |
| `nodes/dist` nhập `lucide-react` | **31 lần** |
| Chỉ đăng ký 6 loại node có né được `editor` không? | **không** — `wall/definition.js:2` nhập `DRAFTING_SURFACE_EXTENSION_KEY` từ `editor`, và rollup phải giải cả cây trước khi rung |

**Hệ quả, và nó xoá một lựa chọn khỏi bàn:** không có đường "chỉ `core` + `viewer`". Mọi hướng —
kể cả chỉ-xem — đều kéo đủ **bốn** gói và **bắt buộc** phải có lớp shim `next/*`. Khác biệt giữa
xem và sửa là **render `<Viewer/>` hay `<Editor/>`**, không phải cài gói nào.

**Và nó làm câu trả lời lucide của người dùng thành đúng:** `nodes` khai `lucide-react` peer `^1`,
AppFront có 0.414.0. Câu tôi nói trước đó — *"nâng lucide không còn cần"* — **sai**, vì nó dựa trên
giả định `nodes` không được cài.

#### ĐÃ GIẢI — cảnh AppFront **vẽ được** trong viewer thật của Pascal

Mục "chưa giải được" ngay dưới đây là bản ghi lúc còn bí; giữ lại vì đường truy vấn có ích. Kết quả
cuối: **vẽ được.** Tường có vân vữa, cửa có cánh và tay nắm, cửa sổ có kính và khung, phòng có mặt
sàn, có bóng đổ. `dirty: 0` (cả 85 node được dựng), `hydrationToken` giữ nguyên, 8 chunk renderer
nạp, 0 phản hồi khác 200. Ảnh: `pascal-render-thanh-cong.png` trong thư mục nháp của phiên (không
commit).

##### Gốc rễ — một câu, và nó bao trùm mọi triệu chứng

> Cảnh của AppFront **hợp lệ với lược đồ**, nhưng `setScene` **không chạy zod**. Mọi trường có
> `.default()` trong lược đồ vì thế **thiếu hẳn** lúc chạy. Bộ vẽ đọc thẳng chúng.

`validateBuildJson` báo 0 lỗi **vì chính nó parse** — nó áp mặc định rồi mới kiểm. Đường chạy thật
thì không. Nên:

| Trường thiếu | Ai đọc | Hậu quả |
|---|---|---|
| `site.polygon` | `nodes/dist/site/renderer.js:293` — `if (!(node && lineGeometry)) return null;` | **Cả cây con biến mất.** Không lỗi, không cảnh báo |
| `position` · `rotation` (68/105 node) | `nodes/dist/building/renderer.js` — `node.rotation[0]` | **Ném lỗi**, ranh giới lỗi của viewer nuốt, không thấy gì |

Thêm `site.polygon` → 2 chunk renderer nạp thay vì 1, hydration thôi bị xoá. Thêm
`position`/`rotation`/`scale` cho 68 node → **`dirty` 85 → 0**, 8 chunk renderer, cảnh hiện.

**Đính chính `03-buoc-8-bo-doi-du-lieu.md:156-159`.** Tài liệu đó viết: *"phép kiểm thật là nạp
`toPascalScene(...)` qua `validateBuildJson` của chính Pascal"*. **Cần, nhưng KHÔNG đủ.** Nó qua
lược đồ với 0 lỗi mà vẫn không vẽ được gì. Phép kiểm thật là **một khung hình**.

##### ĐÃ SỬA, và vòng đã khép kín (2026-09-28)

Ba thay đổi trong bộ đổi dữ liệu, rồi **sinh lại cảnh từ chính mã đã sửa** và dựng lại trong
Chromium trên GPU thật:

| Đo | Trước | Sau |
|---|---|---|
| `dirty` sau 15 s | **85** / 105 | **0** |
| `hydrationToken` | bị xoá lúc 1 809 ms | **giữ nguyên** |
| Chunk renderer nạp | 1 | **8** |
| `ready` (với `sceneReadyKey` đổi đúng cách) | kẹt ở giá trị của cảnh rỗng | **true** |
| Phản hồi hỏng | 0 | **0** |
| Màn hình | chỉ nền trời | **tường có vân vữa, cửa có cánh và tay nắm, cửa sổ có kính và khung, phòng có mặt sàn, bóng đổ** |

Ảnh: `render-sau-sua.png` trong thư mục nháp của phiên (không commit).

Bài kiểm khoá hành vi: `src/lib/pascal/__tests__/renderContract.test.ts`, **5 bài**, tên tệp nói
đúng việc nó làm — *những trường bộ vẽ đọc thẳng, không qua zod*. Bộ `src/lib/pascal` nay **56 bài**
(trước 51).

##### Việc đã sửa trong `src/lib/pascal/toPascal.ts`

Bộ đổi dữ liệu phải **khai đủ mọi trường mà bộ vẽ đọc**, không dựa vào mặc định của lược đồ:

1. `position`, `rotation`, `scale` trên **mọi** node (hiện chỉ `item` có).
2. `polygon` cho node `site` — đường bao khu đất. Mặc định của lược đồ là ô vuông 30×30 quanh gốc
   (`core/dist/schema/nodes/site.js:15-24`), nhỏ hơn nhà mẫu (trải x 0..56 m), nên **không thể dựa
   vào mặc định kể cả khi nó được áp** — phải tính từ chính đường bao công trình.

Cả hai kiểm được bằng bài kiểm đơn vị trong AppFront, không cần gói Pascal.

##### Hợp đồng nhúng cho T9.4 — đã đo, theo đúng thứ tự

1. `await loadPlugin(builtinPlugin)` **trước khi mount** → 48 loại node vào registry.
2. Mount `<Viewer/>`.
3. `setScene(nodes, rootNodeIds, { installedPlugins: [builtinPlugin.id], hasExplicitPluginInstallState: true })`.
4. Node phải **đã đủ trường** (xem trên).
5. **`sceneReadyKey` phải đổi mỗi lần nạp cảnh mới.** Tôi để nó cố định và `ready` kẹt ở `true` từ
   cảnh rỗng — số `ready` ở các bảng trên vì thế vô nghĩa, ghi ra để không ai trích nhầm.
6. **Mọi `pointermove`/`pointerdown`/`wheel` gọi `invalidateHydration()`**
   (`viewer/dist/systems/wall/wall-build-lifecycle.js:65`) — người dùng chạm chuột lúc cảnh đang
   dựng là cắt ngang lượt dựng đầu. Cần biết khi viết màn.

##### Tài sản: câu hỏi T4.2 nay trả lời được, và câu trả lời KHÁC cái mọi tài liệu đang giả định

Trên một cảnh **vẽ thật**, 10 yêu cầu đi ra ngoài:

| Đích | Tệp | Là gì |
|---|---|---|
| `https://editor.pascal.app` | `prepared_drywall_{basecolor,normal,roughness,ao}_512.ktx2` | **4 texture vữa mặc định của tường** |
| `https://cdn.jsdelivr.net` | `basis_transcoder.js` + `basis_transcoder.wasm` | bộ giải Basis mà **drei tự tải lúc chạy** |
| `blob:` | ×4 | worker của chính bộ giải |

Ba hệ quả:

1. **Viewer gọi ra HAI CDN ngoài lúc chạy.** Cả hai vi phạm luật "mọi truy cập mạng đi qua
   `src/lib/http`", cả hai là vi phạm `connect-src` của CSP, và cả hai để lộ hoạt động người dùng
   cho bên thứ ba. Đây là vi phạm CSP **thứ năm và thứ sáu**, chưa có trong danh sách 4 vi phạm mà
   §8e đã đóng — vì §8e đo trên cảnh chưa vẽ được.
2. **Thứ AppFront cần tự host KHÔNG phải 5 398,2 KiB kia.** Không tệp `.webp`/`.glb`/`.mp3` nào
   được gọi. Thứ được gọi là **texture vật liệu `.ktx2`** — 4 tệp cho một loại vữa, và số đó tăng
   theo số vật liệu cảnh dùng. Câu hỏi trần cổng thứ năm phải hỏi lại theo đơn vị này.
3. **Nhát cắt C2 sẽ làm vỡ vật liệu mặc định.** C2 bỏ bộ giải KTX2; cảnh nhà mẫu dùng đúng đường
   `.ktx2`. Cái giá mà §5 ghi là *"mọi texture .ktx2 không nạp được"* nay có mặt cụ thể: **tường
   AppFront mất vân vữa**. Chốt C2 là chốt điều đó.

#### Cái chưa giải được, ghi thẳng *(bản ghi lúc còn bí — đã giải, xem ngay trên)*

Với 48 loại node đã đăng ký, 105 node trong store, 0 lỗi console, 0 lỗi bootstrap — viewer **vẫn
báo `ready: false`**, `hydrationToken` là `null`, và **85/105 node còn bẩn** sau 14 giây. Tức hệ
dựng hình tiêu thụ được 20 node rồi dừng.

Manh mối đọc được từ mã, chưa xác nhận là nguyên nhân: `use-scene.js:1059-1065` — **mọi lượt `set`
chạm `nodes`/`rootNodeIds`/`materials`/`collections`/`installedPlugins` đều gọi
`invalidatePendingHydration()` và đặt `hydrationToken` về `null`**, trừ khi lượt ấy là một
normalization của chính hydration. Còn `setScene` đặt token qua một **callback chạy sau**
(`:1219`). Nghĩa là thứ tự các lời gọi lúc nhúng có thể huỷ hydration — và
`viewer/dist/systems/wall/wall-build-lifecycle.js:49-52` đọc đúng token ấy để quyết định dựng lại.

**Không kết luận gì thêm từ đây.** Hai khả năng còn mở và chưa phân biệt được: (a) thứ tự nhúng của
tôi sai, (b) `three/webgpu` (viewer nhập `three/webgpu`, không phải `three`) không dựng được dưới
SwiftShader headless. Việc đúng tiếp theo là chạy lại trên máy có GPU thật, và hỏi ngược tác giả gói
về thứ tự nhúng đúng.

#### Câu tài sản Pascal — số đã có, nhưng đọc nó phải kèm một chữ "nhưng"

Cả năm lượt: **0 yêu cầu ra ngoài**, **0 tệp `.webp`/`.glb`/`.mp3`/`.ktx2`**, 0 yêu cầu hỏng. Không
lượt nào chạm `editor.pascal.app`.

**Nhưng không lượt nào vẽ được cảnh**, nên con số 0 ấy **chưa trả lời được** câu "viewer có cần tài
sản nào để dựng cảnh AppFront không" — nó mới chỉ nói "lúc chưa vẽ thì chưa đòi". Đây là lý do câu
hỏi tài sản vẫn để ngỏ, và lần này là ghi đúng chứ không phải hỏi ép.

Một điều đo được chắc chắn: bản dựng kéo `basis_transcoder.wasm` **527,3 KiB thô** — bộ giải KTX2,
đúng thứ nhát cắt C2 gỡ. Nó nằm trong chunk nạp muộn và **chưa lượt nào tải nó về**.

### 4.10. Hợp đồng nhúng — `mount()` là của AppFront, không của Pascal

Pascal xuất **component React**: `Viewer` (`viewer/dist/index.d.ts:4`) và `Editor`
(`editor/src/index.tsx:21-22`). Không gói nào xuất `mount`. Chuỗi `mount(el, deps): MountHandle`
là hợp đồng **AppFront tự thiết kế** (`F:/pascal-spike/src/pascal-mount.tsx`), bọc `createRoot`
quanh component ấy để giữ **gốc React thứ hai** tách biệt — cần thế vì
`ScreenErrorBoundary` của AppFront **không bắt được** lỗi xuyên gốc, phải tự truyền `onFatal`.

Cửa vào dữ liệu thì là của Pascal, và nó đã chạy: `useScene.setScene(nodes, rootNodeIds, extra?)`,
cộng `applyNodeChanges({create,update,delete})` — khớp đúng hình dạng mà `fromPascal.ts` sinh ra.

## 5. Baseline build/test

Đo trên HEAD `76eff9b`, trong pane RUNNER, log ở thư mục nháp của phiên.

| Lượt | Điều kiện | Kết quả |
|---|---|---|
| 1 | `pnpm verify` **trong lúc 3 agent + 2 lượt vite build cùng chạy** | **EXIT=1** — dừng ở bước 4. `typecheck` · `lint` · `import vòng` đạt; `build`/`kích thước`/`độ dài` **chưa chạy** |
| 1 — hai bài hỏng | `src/routes/router.test.tsx` (*Unable to find role="dialog" and name "Phím tắt"*) · `src/screens/admin/ModelLibrary/ModelLibrary.test.tsx` (*Test timed out in 5000ms*) | |
| 2 | Chạy **riêng** đúng hai tệp ấy | **17/17 đạt**, 3,92 s, EXIT=0 |
| 3 | `pnpm verify` trên máy rảnh, TRƯỚC khi sửa bộ đổi dữ liệu | **7/7, EXIT=0** — xem mục 5b |
| 4 | `pnpm verify` SAU khi sửa, lượt 1 | **EXIT=1** — hỏng đúng `router.test.tsx > [UndoShortcuts] phím ?`, bài đã hỏng theo tải ở lượt 1 |
| 5 | Chạy riêng `router.test.tsx` | **4/4 đạt**, 2,70 s |
| 6 | `pnpm verify` SAU khi sửa, máy rảnh | **7/7, EXIT=0** — 347/347 tệp, **7 252/7 252** bài. Bốn cổng dung lượng **không đổi một KiB nào** (137,4 · 154,1 · 279,6 · 10,9), đúng như phải thế: `src/lib/pascal` chưa có nơi gọi nên bị rung khỏi gói |

Phán quyết của lượt 1 và 2: **hỏng theo tải, không phải hồi quy**. Bằng chứng phụ cùng hướng —
`src/lib/testing/__tests__/noRawColor.test.ts` mất **41 870 ms** ở lượt 1. Đây đúng lớp hỏng mà
`03-buoc-8:120-141` đã mô tả: tệp ngồi sẵn ở mép hạn 5 000 ms thì đổ khi máy bị tranh.

**Bài học quy trình:** đừng chạy `pnpm verify` song song với agent điều tra. Số đo sẽ nói dối.

### 5b. Lượt verify trên máy rảnh — 7/7, mã thoát 0

`pnpm verify` bảy bước, log `verify-clean.log`:

| Bước | Kết quả |
|---|---|
| typecheck · lint · import vòng | **đạt** |
| test + độ phủ | **đạt** — **346/346** tệp, **7 247/7 247** bài kiểm |
| build · kích thước gói · độ dài file | **đạt** |
| **Tổng** | **7/7, EXIT=0** |

Bốn cổng dung lượng, và chỗ dư của từng cổng:

| Cổng | Đo | Trần | Dư |
|---|---|---|---|
| màn hình đầu tiên | 137,4 | 175 | 37,6 |
| chunk JS lớn nhất (`three.module`) | 154,1 | 170 | 15,9 |
| **chi phí thêm cho một màn** | **279,6** | **280** | **0,4** |
| tổng CSS | 10,9 | 12 | 1,1 |
| *(mốc cảnh báo, không chặn)* tổng JS mọi chunk | **1 227,3** | 800 | **quá 427,3** |

**Con số phải mang đi mọi cuộc bàn là 0,4 KiB.** Màn Pascal là một **route mới**, và cổng thứ ba
đo đúng "chi phí thêm khi vào một màn". Với 0,4 KiB còn lại, đưa Pascal qua gói chính là **không
thể** — đây chính là lý do cơ chế vách ngăn (Q2 = B) được chọn, và bây giờ nó có số chứng minh
thay vì chỉ có lập luận.

Mốc cảnh báo tổng JS vượt 427,3 KiB. Nó **không** chặn cổng nào (`check-bundle-size.mjs:123-125`),
nhưng đừng để ai đọc "4/4 đạt" mà không thấy dòng này.

## 6. Blocker

### 6a. Chờ đúng một câu của người dùng

| Mã | Câu | Chặn mã việc nào |
|---|---|---|
| T4.2 (2) | Ba con số trần cho **cổng thứ năm**, theo đơn vị **tổng-thư-mục** (≈ 7 125,8 KiB sau nhát cắt C2, **đã gồm** React + three trùng bản) | T9.1 |
| T4.2 (3) | **lucide**: để hai bản cùng chạy, hay nâng AppFront lên lucide 1.x | T5.4 → T5.5 |
| T6.1 | Tạo fork `pascalorg/editor` (quyền đã cấp ở G0 câu 1 = "Có", **chưa dùng**) | T6.2–T6.9 → T7.x → T9.4 |
| T9.2 | Thêm hai khoá cờ `scene.pascal-viewer`, `scene.pascal-editor` vào hợp đồng cờ | T9.3 |
| T9.6 | Thêm job CI thứ sáu (`e2e:preview` với CSP nguyên văn) | — |
| G2-R19-size · G2-THREE (c) | Hai phương án A **đã áp trong mã** nhưng **chưa có nguyên lời người dùng**; ô đó để trống theo E.10 | (giấy tờ) |

Về T4.2(3), nay đã đo được chỗ đau chính xác: `lucide-react` là **dependency** của `editor` (bản
lồng, hai bản sống chung được) nhưng là **peerDependency `^1`** của `nodes`. AppFront có 0.414.0,
**không** thoả `^1` → cài `nodes` sẽ sinh cảnh báo peer. Vậy câu hỏi thật là: nâng AppFront lên
lucide 1.x, hay khai `pnpm.peerDependencyRules.allowedVersions`.

### 6b. Chờ thứ ngoài tầm cả hai

| Thứ | Chặn |
|---|---|
| Backend **F-04a (W10)** | T9.8 — nối dữ liệu thật vào màn |
| F-04b (W11) · F-04c (W12) · F-05 · F-08 | Bước 10 — chế độ sửa |
| F-14 (W14) | Bước 11 — chuyển hẳn |
| GitHub gỡ khoá thanh toán | PR #5 |
| Ảnh chuẩn `linux` cho cổng visual | bẫy số 5 của `CLAUDE.md` |

## 7. Quyết định kiến trúc đã chốt

| # | Quyết định | Nguồn |
|---|---|---|
| 1 | Phạm vi **A — xem + sửa** | T4.2(1), 2026-09-27 |
| 2 | **Vách ngăn**: Pascal dựng ở lượt build **thứ hai**, ra `public/assets/pascal/` kèm `publicDir: false`; cộng **cổng thứ năm** quét đệ quy. Giá: React và three **trùng bản** | Q2 = B, 2026-09-26 |
| 3 | **Gốc React thứ hai** qua `mount()` tự viết, không nhúng `<Editor/>` vào cây React của AppFront | T3.7 |
| 4 | Bộ đổi dữ liệu là **tầng thuần** ở `src/lib/pascal`, chỉ `import type` gói Pascal | T8.1 · `project.js:215-230` |
| 5 | Chỉ `src/components/pascal/**` được nhập gói Pascal (cổng bằng `overrides`, không phải luật nội bộ thứ tám) | T8.1 · `project.js:112-214` |
| 6 | **A5 không truyền qua tường**: `toSpatial.ts` chỉ tin siêu dữ liệu khi id dịch ngược ra id AppFront hợp lệ; `fromPascal.ts` lấy ba trường duyệt từ ảnh chụp **trước** | Bước 8 |
| 7 | Cổng lọc thay đổi ma dùng **bốn luật, 0 con số thời gian** | `guard.ts` |
| 8 | Trục định vị, kích thước, ghi chú **không** sang Pascal — lược đồ Pascal không có loại node tương ứng, quy sang là bịa dữ liệu | Bước 8 §7 |

## 8. Việc tiếp theo

1. ~~`pnpm verify` trên máy rảnh~~ — **xong, 7/7** (mục 5b).
2. ~~Làm cho cảnh vẽ được~~ — **xong** (mục 4.9). Gốc rễ và hợp đồng nhúng đã ghi ở đó.
3. ~~Sửa `toPascal.ts`~~ — **xong.** `building.position`/`rotation`, `door`/`window.rotation`,
   `site.polygon` tính từ hình học. `scale` **không** thêm: không lược đồ nào của tám loại ta viết
   ra khai nó. Khoá bằng `renderContract.test.ts` (5 bài).
4. **Bổ sung phép kiểm "một khung hình" vào tiêu chí nghiệm thu của Bước 8.** `validateBuildJson`
   là cần nhưng không đủ — nó đã báo xanh trên một cảnh không vẽ được gì. Hiện phép kiểm ấy chạy
   **bằng tay ngoài repo**; đưa nó vào CI là việc của T9.6/T9.7.
5. **Hai vi phạm CSP mới, chưa có trong §8e**: `editor.pascal.app` (texture `.ktx2`) và
   `cdn.jsdelivr.net` (bộ giải Basis của drei). Phải tự host cả hai trước khi có màn thật.
6. **T4.2(2) hỏi lại theo đơn vị đúng**: thứ cần tự host là **texture vật liệu `.ktx2`**, không
   phải thư viện 5 398,2 KiB.
7. **Người dùng xem lại lựa chọn "chỉ-xem trước"** với tiền đề đã sửa (mục 4.9): nó tiết kiệm việc
   và rủi ro giao diện sửa, **không** tiết kiệm cây phụ thuộc.
8. **T4.2(3) lucide** — `nodes` bắt buộc, peer `^1`, AppFront 0.414.0. Người dùng đã chọn nâng 1.x.
9. **Nhát cắt C2 cần quyết lại**: nó bỏ bộ giải KTX2, mà tường AppFront dùng đúng đường đó.
10. T2.6 — sửa điểm kéo trong `e2e/i-commit.spec.ts`; làm được ngay, không chờ ai.
11. Đo hai thứ mục 10 ghi "chưa đo": Tailwind 4 `prefix()` có thay được T7.5 không; `EditorProps`
    có prop nào ẩn được công cụ tầng/sàn/trần/site không.

## 9. Tệp đã đổi trong phiên 2026-09-28

| Tệp | Đổi gì |
|---|---|
| `docs/pascal/IMPLEMENTATION_STATUS.md` | tệp này, mới |
| `docs/pascal/00-quyet-dinh.md` | thêm bản 4 (hướng đi, lucide) và đính chính bản 4 |
| `src/lib/pascal/types.ts` | `PascalSiteNode.polygon`, `PascalBuildingNode.position`/`rotation`, `PascalDoorNode`/`PascalWindowNode.rotation` — đều **bắt buộc**, kèm lý do ngay tại chỗ khai |
| `src/lib/pascal/toPascal.ts` | khai ba nhóm trường trên; thêm `sitePolygonOf()` tính đường bao khu đất từ tường và phòng, lùi 5 m, có nhánh dự phòng cho bản vẽ rỗng |
| `src/lib/pascal/__tests__/renderContract.test.ts` | **mới**, 5 bài |
| `src/lib/pascal/__tests__/guard.test.ts` · `skipped.test.ts` | dữ liệu mẫu thêm các trường mới (trình biên dịch chỉ đúng từng chỗ) |

Mã nguồn bị đổi ở **đúng bốn tệp trong `src/lib/pascal`**, không tệp nào ngoài thư mục đó. Các tệp tạm đã dựng và đã xoá: một bài kiểm dò ở
`src/lib/pascal/__tests__/` (xuất cảnh ra JSON), và trong `F:/pascal-spike/` là bộ kiểm lược đồ,
bộ nạp store, bản dựng đo hướng chỉ-xem. Cây làm việc của cả hai nơi sạch trở lại.

---

## 9b. Bước ngoặt 2026-09-28 — Pascal vào thẳng repo, làm mã của AppFront

Người dùng đổi hướng sau khi nhận ra Pascal **chưa hề nằm trong dự án**: *"tôi muốn là clone
pascal về và lấy luôn làm code của mình và ko liên quan gì đến code trên git của [họ] nữa, mục
đích là để tôi ưu cho phần editor và dựng mô hình 3d để tối ưu và ko cần phải xây dựng lại"*.

Điều đó **thay thế** cả cuộc bàn "npm hay fork" ở mục 10: không dùng gói npm, không tạo fork trên
GitHub — chép mã vào và sở hữu nó.

### Đã làm

| Việc | Kết quả |
|---|---|
| Clone `pascalorg/editor` | `F:/pascal-editor`, `--depth 1`, commit `cd14090`, 2026-09-27, **MIT**, 115 MB |
| `bun install` | **764 gói, 68,8 s, EXIT=0** — Bun 1.3.14 đã sẵn trên máy, đúng bản repo khai |
| `bun run build` (cả monorepo) | **8/8 tác vụ, 2 m 53 s, EXIT=0** — kể cả hai app Next.js. Đây là lần đầu có bằng chứng repo dựng được; mọi số trước đó lấy từ gói npm đã dựng sẵn |
| Chép vào `vendor/pascal/` | **49 MB** — bốn gói nguồn + `typescript-config` + `LICENSE` + `NGUON.md` + 22 MB tài sản |
| Loại trừ cổng | hai dòng: `.eslintrc.cjs` `ignorePatterns` và `vitest.config.ts` `exclude` |

### Vì sao chỉ hai cổng cần loại trừ, không phải bốn

Con số "369 tệp vượt 400 dòng" tôi đưa lúc hỏi **chỉ đúng nếu đặt dưới `src/`**. Đọc lại bốn cổng:

| Cổng | Phạm vi | Có chạm `vendor/` không |
|---|---|---|
| `length` | `ROOT = 'src'`, chỉ `.tsx` (`check-file-length.mjs:27`) | **không** |
| `typecheck` | `tsconfig.json` `include`: `src/**`, `e2e/**` | **không** |
| `import vòng` | `eslint src` (`check-import-cycles.mjs:36`) | **không** |
| `coverage` | `include: ['src/**/*.{ts,tsx}']` | **không** |
| **`lint`** | `eslint .` — quét cả cây | **có** → thêm `'vendor'` vào `ignorePatterns` |
| **`test`** | vitest tự nhặt mọi `*.test.*` | **có** → thêm `'**/vendor/**'` vào `exclude` |

### Cái cố ý không chép

`apps/editor/public/items` (4,5 MB đồ đạc `.glb` — đo được là cảnh AppFront không gọi tệp nào),
`audios` (824 KB), `demos`, và các app/gói ngoài phạm vi nhúng (`cli`, `mcp`, `ifc-converter`,
`ui`, `eslint-config`). Bản clone đầy đủ còn ở `F:/pascal-editor` nếu cần lấy thêm.

**`assets/material` 18 MB thì PHẢI chép**: nó chứa các tệp `.ktx2` mà §4.9 đo được là viewer đi
xin từ `editor.pascal.app` lúc chạy. Tự host chúng ở đây là cách cắt đường gọi ra CDN ngoài.

### Nối vào đường dựng — và bài học đắt nhất của bước này

| Việc | Kết quả |
|---|---|
| `pnpm-workspace.yaml` | thêm `vendor/pascal/packages/*` và `vendor/pascal/tooling/*` |
| `package.json` | bốn `@pascal-app/*` ở `workspace:*`, cộng `@react-three/fiber ^9.6.1` và `@react-three/drei ^10.7.7` (hai gói này là **peer** của cả bốn, AppFront phải tự cấp) |
| `pnpm install` | **EXIT=0**, 15,3 s. `node_modules/@pascal-app/*` là symlink trỏ `vendor/pascal/packages/*` |
| Shim Next.js | `vendor/pascal/shims/{next-image,next-link}.tsx`, khai ở **cả** `vite.config.ts` lẫn `vitest.config.ts` — vitest thay thế hoàn toàn cấu hình vite chứ không hợp nhất |
| Bảy biến `process.env.NEXT_PUBLIC_*` | `define` ở cả hai cấu hình, để rỗng — mặc định của Pascal trỏ ra CDN ngoài |
| Điểm nhúng | `src/components/pascal/pascalScene.ts` — thư mục duy nhất cổng ESLint cho nhập `@pascal-app/*` |
| **Bài kiểm đầu tiên trên gói Pascal THẬT** | `src/components/pascal/__tests__/pascalScene.test.ts` — **4/4**: registry nhận 48 loại node, store nhận đủ cảnh, **0 node bị dọn**, dấu xác minh A5 sống nguyên |
| Cổng tổng | **7/7, EXIT=0**, 348 tệp, **7 256 bài**, bốn cổng dung lượng **không đổi một KiB** |

#### Bài học: trỏ `exports` vào `src` làm tsc nuốt cả 90 013 dòng

Tôi trỏ bốn gói vào `src/` để sửa nguồn là thấy ngay, không phải dựng lại. Hệ quả **không lường
trước**: `tsconfig.json` chỉ khai `include: src/**`, nhưng **TypeScript đi theo đường nhập**. Vừa có
một tệp trong `src/components/pascal` nhập `@pascal-app/core`, tsc kéo toàn bộ mã Pascal vào chương
trình và kiểm nó dưới `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess` của
AppFront:

| Nơi | Số lỗi |
|---|---|
| `vendor/pascal/packages/editor` | 718 |
| `vendor/pascal/packages/nodes` | 672 |
| `vendor/pascal/packages/viewer` | 154 |
| `vendor/pascal/packages/core` | 74 |
| `src/` của AppFront | 8 |
| **Tổng** | **1 626** |

Và lượt `verify` trước đó bị **hệ thống dừng vì cạn bộ nhớ** — cùng một nguyên nhân: dịch 90k dòng
mỗi lượt. Bài kiểm Pascal mất **47 s, trong đó 45 s là "collect"**.

#### Lời chữa: hai lối vào, kiểu lấy `.d.ts`, chạy lấy mã nguồn

`skipLibCheck: true` đã bật sẵn ở `tsconfig.json:11`, nên **tsc bỏ qua nội dung tệp khai báo**. Chỉ
cần bốn gói xuất `.d.ts` là 1 618 lỗi kia biến mất, mà vẫn giữ được vòng sửa-thấy-ngay:

```jsonc
"exports": { ".": { "types": "./dist/index.d.ts",   // tsc đọc cái này, và bỏ qua ruột nó
                    "import": "./src/index.ts" } }  // Vite dịch mã nguồn thật
```

`editor` khai `noEmit: true` và **không có script dựng** — nó vốn được dùng ở dạng nguồn. Nhưng nó
là mã của ta, nên ép xuất khai báo được: `tsc --noEmit false --declaration --emitDeclarationOnly`
cho **660 tệp `.d.ts`, 0 lỗi**. Tổng bốn gói: **1 816 tệp `.d.ts`, 6,6 MB** — chỉ lấy `.d.ts`,
không lấy `.js`, vì lúc chạy vẫn dùng mã nguồn.

Kết quả: **1 626 → 0 lỗi kiểu.**

**Khi nào phải sinh lại `.d.ts`:** chỉ khi **bề mặt API** của gói Pascal đổi. Sửa phần ruột — đúng
việc "tối ưu" mà đợt này nhắm tới — thì không cần, Vite đọc thẳng nguồn.

#### Tám lỗi còn lại là của AppFront, và một trong số đó đáng ghi

Một lỗi ở bài kiểm tôi mới viết (tra `nodes` bằng `string` trong khi khoá là kiểu mẫu). Bảy lỗi còn
lại ở `src/components/ui/Table.tsx`, và chúng **không** phải lỗi có sẵn: dòng
`motion.tr as React.ElementType` gom **mọi** loại phần tử thành một hợp, nên prop của thẻ co về
`never`. Trước đây vô hại; từ khi `@react-three/fiber` có mặt, hợp ấy gồm cả trăm phần tử three nên
nó vỡ thật. Chữa bằng cách bỏ phép ép rộng và ép hẹp đúng vào kiểu của chính thẻ ấy.

**Đây là loại tác dụng phụ cần biết:** thêm R3F vào repo là mở rộng không gian JSX toàn cục, và mọi
chỗ đang ép kiểu lỏng đều là chỗ có thể vỡ.

### Hai bài kiểm hỏng ngắt quãng — có sẵn, không do đợt này

Cổng tổng đỏ hai lượt liền ở hai tệp **khác nhau**, cả hai đều đã hỏng ở lượt baseline **đầu phiên,
trước mọi thay đổi**:

| Tệp | Triệu chứng | Chạy riêng |
|---|---|---|
| `routes/router.test.tsx` | `Unable to find role="dialog"` — trần chờ đặt **đúng bằng** hạn mặc định 5 000 ms nên hai trần hết hạn cùng lúc | **4/4 đạt**, 2,70 s |
| `screens/admin/ModelLibrary/ModelLibrary.test.tsx` | `Test timed out in 5000ms` — bài nạp view qua `import()` lúc chạy | đạt |

Đây là tệp thứ hai và thứ ba cùng lớp, sau `ShareDialog.test.tsx:144`. Vá theo từng tệp đúng tiền
lệ ấy (`vi.setConfig({ testTimeout: 20_000 })`), **không** đụng `vitest.config.ts`. Lời chữa chung
cho cả repo đã có ở nhánh `mungvu2004/debt-share` — chốt nó là việc của người duyệt.

Nâng hạn chờ không nới cổng chất lượng nào: mọi khẳng định giữ nguyên từng dòng.

---

## 10. Hai vai tranh luận hướng đi cho `editor` — và phán quyết

Hai agent chỉ-đọc, động cơ ngược nhau, cùng một bộ dữ kiện. Cái đáng giữ lại:

### Vai 1 (giữ phạm vi A + làm fork) — lý lẽ mạnh nhất còn đứng

1. **Nửa "sửa" của phạm vi A không tồn tại mà không có `editor`.** Đúng, và `editor` là gói duy
   nhất không dựng sẵn.
2. **`@property` không bọc scope được.** Tailwind của Pascal khai **89** `@property` + 12
   `@keyframes` tiền tố `--tw-`, trùng token của AppFront; `@property` là khai báo **phạm vi tài
   liệu** theo đặc tả CSS nên không nhét dưới `.pascal-root` được. Hậu quả không phải hôm nay mà
   mai: *"PR đầu tiên thêm gradient sẽ rơi về `initial-value:#0000` và gradient biến mất im lặng"*
   (`so-tay-ban-2.md:579-586`). Đây là lý lẽ **mạnh nhất** của cả cuộc tranh luận.
3. **Nhát cắt C2 lấy từ nguồn**, npm phát hành nguyên khối.

### Vai 2 (fork là cược sai) — lý lẽ mạnh nhất còn đứng

1. **Fork không phải chi phí một lần.** Bước 11 ghi *"lượt theo kịp bản gốc 2–4 tuần một lần"*
   (`so-tay-ban-2.md:665`), và vì `editor` **không có `dist`**, mỗi lượt đồng bộ là chạy lại cả
   chuỗi T6.2 → T6.3 (Bun 1.3.14, thứ tự bốn gói) → T6.4 → T6.5. Với `core`/`viewer` thì cập nhật
   là **một dòng `package.json`**.
2. **Bước 10 (chế độ sửa) dù sao cũng bị backend chặn** — F-04b (W11), F-04c (W12), F-05, F-08
   (`so-tay-ban-2.md:650-653`). Tức fork phải được **bảo trì để nuôi một khả năng chưa dùng được**.
3. **Ước lượng 11,5–13,5 ngày đáng bị chiết khấu**: T5.1 — việc dễ hơn nhiều, trên chính repo này —
   từng bị báo sai **13 lần** (§10b), và `02-soat-dong-dot-G3.md` §7 liệt kê năm con số khác cùng
   một lỗi hệ thống.
4. **Con số "1,6 lần CPU" là một điểm đơn lẻ.** Khoảng thật là **1,202–1,628**; cặp 4 (1,2016) làm
   tròn hai chữ số thì **không** chạm ngưỡng; và cả phép đo chỉ chạy trên **GPU tích hợp** — chưa ai
   đo GPU rời vì `chay-c.sh` hỏng ba chỗ im lặng (§8f).

### Chỗ cả hai vai cùng nói "chưa đo" — đã đo, ở mục 4.5

Cả hai dừng ở cùng một câu hỏi: shim `next/*` có đủ không. **Đủ** — bề mặt đóng ở hai module, 17
dòng shim, và dự án thử đã chạy thật. Nên **lý lẽ "fork là con đường duy nhất để dùng `editor`" bị
bác bỏ bằng số.** Vai 1 tự nhận điểm yếu này trước.

### Phán quyết của người điều phối

> **Đọc kèm mục 4.9.** Phán quyết dưới đây viết trước phép đo trong trình duyệt. Phần *"fork không
> còn là điều kiện cần"* **vẫn đứng**. Phần ngầm hiểu rằng có một đường "chỉ `core` + `viewer`"
> **đã bị đo bác bỏ**: mọi hướng đều cần đủ bốn gói và lớp shim `next/*`.

**Fork không còn là điều kiện cần để *dùng* Pascal — cả hướng xem lẫn hướng sửa.** Cái fork còn mua
được, sau khi trừ hết những gì đo được là làm ở phía AppFront:

| Việc | Cần fork? | Bằng chứng |
|---|---|---|
| Dùng `editor` ngoài Next.js | **không** | mục 4.5 — 17 dòng shim, đã chạy |
| 4 vi phạm CSP | **không** | 3 vi phạm Iconify đã sửa phía AppFront (alias `@iconify/react/offline`, còn hiệu lực). **Vi phạm `eval` của zod CÒN 1 trên màn thật** — nhát vá `jitless` của §8e chỉ nằm trong trang spike `src/vach-ngan.tsx`, không theo sang `/projects/:id/3d/pascal` (đo 2026-10-03, `docs/notes/e2e/fragments/W08.md` B-V10-05) |
| Nhát cắt C2 (−74,9 % `.wasm`) | **không** | đo được ở cấu hình vite của dự án thử; cần vá thêm lượt dựng **worker** |
| Nhát cắt C3 | có | nhưng nó đổi **0,0 KiB** — không đáng |
| **Đổi tên 89 `@property` `--tw-`** | **có, hoặc một tiền tố Tailwind** | phạm vi tài liệu, không bọc scope được. Tailwind 4 có `prefix()` — **chưa đo** liệu nó đủ |
| Chuỗi tiếng Việt + dấu phẩy thập phân **trong `editor`** | **có** | ~74+ chuỗi; `lingoUnitSpec` là bộ đơn vị đo, **không** phải cơ chế dịch; `EditorProps` có vài slot `ReactNode` nhưng không phủ hết |
| Ẩn công cụ tầng/sàn/trần/site, `keyboard:'host'` | không biết | chưa đo có prop nào làm được không |

Và **rút về chỉ-xem không phải nhát cắt dung lượng** (mục 4.6): 1 578,6 so với ≈ 1 727,6 KiB gzip,
cùng một bậc. Cái hướng chỉ-xem thật sự cắt là **rủi ro và nghĩa vụ**: không shim Next, không đụng
`@property` (viewer/dist chỉ có **5** chỗ `className`, editor/src có **1 913**), không xung đột peer
lucide, không Iconify, không `pdfkit`/`manifold`/`howler`, và cập nhật bằng một dòng thay vì một
lượt dựng lại.

Hai chỗ hướng chỉ-xem **vẫn** vướng, đã tìm ra trong `viewer/dist`:

- `unsupported-gpu-fallback.js:3` — màn dự phòng khi GPU không đỡ được, chuỗi **tiếng Anh** *"3D
  viewer unavailable"*. Đó là một trong bảy trạng thái của A11, do Pascal vẽ, bằng tiếng Anh → **vỡ
  A6**. Né được mà không cần fork: AppFront tự kiểm WebGL trước và không bao giờ để Pascal vẽ màn ấy.
- `components/viewer/index.js:319` — `transition-colors duration-700` trên Canvas. Mục B của
  `CLAUDE.md` nói 700 ms *"không phần tử nào chuyển từ trạng thái này sang trạng thái khác ở tốc độ
  đó"*. Pascal chuyển màu nền Canvas ở đúng tốc độ đó.
