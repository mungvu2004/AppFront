# Kích thước gói — quy trách nhiệm 760,8 KiB

> Đo ngày 2026-09-05 trên `mungvu2004/n4-bundle-size` (HEAD `0a1a80e`), bản dựng sạch
> (`rm -rf dist && pnpm build`), terser như cấu hình thật. Mọi con số là **gzip**, đơn vị
> KiB, dấu thập phân là dấu phẩy theo A15.
>
> Cách đo: một plugin Rollup tạm ghi `renderedLength` của **từng module trong từng chunk**
> ra JSON, rồi phân bổ gzip của chunk theo tỉ lệ đó. Không đoán theo tên file.

---

## 1. Bảng tổng — cổng bước 6 nói gì

```
  VƯỢT  tổng JS                 760,8 KiB /  175 KiB (quá 585,8 KiB)
  đạt   tổng CSS                  9,8 KiB /   12 KiB (còn dư 2,2 KiB)
  đạt   chunk JS lớn nhất       137,3 KiB /  170 KiB (còn dư 32,7 KiB)
```

- 128 chunk JS, tổng thô 2 387,5 KiB.
- **Không chunk nào vượt ngưỡng riêng.** Cái đỏ là *tổng*.

## 2. Câu hỏi quan trọng nhất: `three` có nằm trong chunk khởi động không?

**Không.**

Chunk vào (`assets/index-*.js`, 124,7 KiB gz) có **`imports: []`** — nó không nhập tĩnh
một chunk nào khác. Toàn bộ 127 chunk còn lại chỉ tới được bằng `import()` động. `three`
nằm gọn trong `scene-*.js` (137,3 KiB gz), và chunk đó chỉ có hai người gọi động:
`screens/auth/AuthScreen/houseScene.ts` (màn `/login`) và `screens/viewer/Viewer3D`.

Nói cách khác: **`router.tsx` đã `lazy()` đúng, và nó đang có tác dụng.** Món lãi lớn mà
task đi tìm — "three lọt vào đường khởi động" — không tồn tại; lỗi đó đã không xảy ra.

| Đường đi | JS gzip |
|---|---|
| Mở trang lần đầu (chunk vào, đóng kín) | **124,7 KiB** (+ 9,8 KiB CSS) |
| Điều hướng sang `/login` (thêm) | +225,7 KiB — trong đó `three` 137,3 |
| Điều hướng sang `/projects/:id/3d` (thêm) | +264,4 KiB — `three` + GLTFLoader + DRACO |
| Một màn QC bất kỳ (thêm) | +95…143 KiB |

## 3. Của chúng ta bao nhiêu, của thư viện bao nhiêu

| Nguồn | gzip | % tổng |
|---|---|---|
| `src/**` (mã của chúng ta) | **429,7 KiB** | 56,5 % |
| `node_modules/**` | **320,2 KiB** | 42,1 % |
| helper của Vite (preload, polyfill) | 0,6 KiB | 0,1 % |

Chia nhỏ `src/`:

| Thư mục | gzip | thô |
|---|---|---|
| `src/screens` | 243,0 | 1 387,6 |
| `src/lib` | 90,1 | 486,3 |
| `src/domain` | 32,2 | 169,8 |
| `src/components` | 29,6 | 130,6 |
| `src/i18n` (chỉ `vi.json`) | 14,4 | 77,4 |
| `src/hooks` | 9,3 | 42,7 |
| `src/api` | 6,6 | 36,8 |
| `src/routes` + `src/store` + `src/mocks` + `main` | 4,7 | 24,0 |

**`src/screens` một mình đã lớn hơn `three`.** Đây là ứng dụng 25 màn thật, không phải
một gói bị dependency làm phình.

## 4. Ba thư viện ngoài nặng nhất

| # | Thư viện | gzip | thô | Ai kéo vào | Nằm ở đâu |
|---|---|---|---|---|---|
| 1 | **`three` 0.166** | **152,7** | 1 155,8 | 74 file trong `src/lib/three/**`, `houseScene.ts` | `scene-*` (137,3) + `GLTFLoader-*` (13,0) + `DRACOLoader-*` (2,6) — **tất cả tải muộn** |
| 2 | **`framer-motion` + `motion-dom` + `motion-utils`** | **41,2** | 391,7 | `src/components/motion/**` (chỗ duy nhất được nhập, R-39) | `useReducedMotion-*` (chunk dùng chung, tải muộn) |
| 3 | **`@remix-run/router`** | **28,8** | 154,8 | `react-router-dom` ← `src/routes/router.tsx` | **chunk vào** |

Kế tiếp: `react-dom` 24,4 · `tailwind-merge` **18,5** · `zod` 14,8 · `@tanstack/query-core`
13,0 · `lucide-react` 9,1 · `@tanstack/virtual-core` 3,8 · `zustand` 3,7.

Bên trong `three` (thô): `build/three.module.js` 1 034,5 · `GLTFLoader.js` 106,0 ·
`DRACOLoader.js` 13,2 · `BufferGeometryUtils.js` 2,1. Toàn bộ mã nguồn nhập bằng **named
import** (`import { Vector3 } from 'three'`) — đã đúng cách; `three.module.js` là **một
module gộp sẵn** nên Rollup không tách nhỏ hơn được (xem §6, phương án 4 đã đo).

Trong chunk vào (124,7 KiB gz), phần thô lớn nhất: `@remix-run/router` 154,8 ·
`react-dom` 131,0 · `tailwind-merge` 99,8 · **`src/i18n/vi.json` 77,4** ·
`@tanstack/query-core` 46,0 · `src/lib` 37,0.

## 5. Ba phát hiện phụ, có số

1. **Không có module nào bị nhân bản.** Kiểm tra toàn bộ 128 chunk: **0 module trùng, 0 KiB
   lãng phí**. Việc chia chunk của Rollup hiện đã tối ưu ở mặt này — nên **không có KiB nào
   lấy lại được bằng cách sắp xếp lại chunk** (§6 đo lại điều này bằng bốn thí nghiệm).

2. **Fixture/scenario/mock của test đang nằm trong gói sản phẩm: 94,1 KiB thô** (≈ 20 KiB
   gz). Lớn nhất: `api/__mocks__/client.ts` 12,2 · `AxisGridManager/axisGridManagerScenarios.ts`
   10,3 · `FloorManager/floorManagerFixture.ts` 8,3 · `AxisGridManager/axisGridFixture.ts` 7,6 ·
   `domain/spatial/__fixtures__/sampleBuilding.ts` 6,0 · `ThicknessStandardization/thicknessFixture.ts`
   5,8 · và mười hai file nữa. Đây là **món lãi thật lớn nhất còn lại**, nhưng mọi file đều
   nằm trong `src/screens/**`, `src/api/**`, `src/domain/**` — ngoài phạm vi sửa của lượt này.

3. **`src/i18n/vi.json` 77,4 KiB thô nằm nguyên trong chunk vào.** CLAUDE.md nói file này
   "không phải bảng dịch lúc chạy… là từ điển để kiểm tra", nhưng bốn module sản phẩm nhập
   nó bằng **default import** (`useSaveIndicator.ts`, `lib/errors/describeError.ts`,
   `lib/mutations/notificationBus.ts`, `lib/realtime/pipeline.ts`, cộng ba file trong
   `AuthScreen/`). Default import làm cả 26 nhóm khoá bị giữ lại; `describeError.ts` còn
   đọc bằng đường dẫn động (`readPath(viMessages, path)`) nên rung cây cũng không bỏ được gì.

4. **Năm dependency khai trong `package.json` nhưng không có mặt trong gói:**
   `@react-three/drei`, `@react-three/fiber`, `d3-zoom`, `i18next`, `react-hook-form`.
   Chúng **không tốn KiB nào** (đã bị rung cây bỏ hết) — gỡ khỏi `package.json` là dọn dẹp,
   không phải cắt gói.

## 6. Danh sách phương án — đã ĐO, không phỏng đoán

Bốn phương án dưới đây đều được dựng sạch và cân thật. Cột "khởi động" là chunk vào cộng
đóng kín nhập tĩnh của nó — tức thứ người dùng thật sự tải khi mở trang.

| # | Phương án | Tổng JS | Δ tổng | Khởi động | Δ khởi động | Kết luận |
|---|---|---|---|---|---|---|
| — | **hiện tại** | 760,8 | — | **124,7** | — | mốc |
| 1 | `manualChunks`: gộp `lucide-react` | 753,9 | **−6,9** | 129,7 | **+5,0** | lãi 0,9 % trên cổng, lỗ 4,0 % trên trang đầu |
| 2 | thêm `zod` | 754,4 | −6,4 | 129,7 | +5,0 | tệ hơn #1 ở cả hai cột |
| 3 | thêm `framer-motion` | 755,2 | −5,6 | 169,0 | **+44,3** | lỗ nặng |
| 4 | gộp toàn bộ vendor (trừ `three`) | 750,2 | −10,6 | 174,7 | **+50,0** | lỗ nặng nhất |
| 5 | alias `three` → `three/src/Three.js` để rung cây từng module | **767,8** | **+7,0** | 169,1 | +44,4 | **phản tác dụng**, đồng thời đổi hành vi |

**Vì sao gộp chunk gần như không giúp gì:** không có module trùng (§5.1), nên gộp chỉ ăn
được phần gzip nén tốt hơn khi file to hơn — vài KiB. Đổi lại, `manualChunks` biến một
chunk vốn chỉ tới được bằng `import()` thành **nhập tĩnh của chunk vào**, kéo cả gói icon
/ motion / zod vào trang đầu. **Đó là đánh đổi lỗ**: cổng nhích 1 %, người dùng thật chậm đi
4–40 %. Không phương án nào trong bảng đưa cổng về gần 175 — sau phương án tốt nhất vẫn
còn vượt 575,2 KiB.

Vì vậy **lượt này không sửa `vite.config.ts`**, và cũng không đổi câu lệnh nhập nào: mọi
thay đổi khả thi trong phạm vi được phép đều làm sản phẩm chậm đi để làm đẹp một con số.

### Phương án còn lại, xếp theo (KiB cắt được) so với (rủi ro) — cần người duyệt

| KiB gz | Việc | Rủi ro | Ngoài phạm vi lượt này vì |
|---|---|---|---|
| ~20 | Đưa 94,1 KiB thô fixture/scenario/mock ra khỏi gói sản phẩm (tách sang file `*.fixture.ts` chỉ test nhập, hoặc chắn bằng `import.meta.env.DEV` như `buildDevOnlyRoutes`) | **thấp** — không màn nào cần chúng lúc chạy | file nằm ở `src/screens/**`, `src/api/**`, `src/domain/**` |
| ~10–14 | Cắt `vi.json` theo nhóm khoá (`vi/errors.json`, `vi/autosave.json`…) và bỏ đường đọc động trong `describeError.ts` | trung bình — chạm 7 file, phải giữ `expectVietnamese` xanh | chạm `src/hooks/**` và `src/screens/**` |
| ~18 | Bỏ `tailwind-merge` khỏi đường khởi động (nó ở chunk vào vì `Button` → `cn`) | **cao** — đổi cách giải xung đột class, A1/B có thể lệch | đổi hành vi |
| 152,7 | Bỏ `three` | không chấp nhận được — xoá tính năng 3D | — |

## 7. Về ngân sách 175 KiB — lập luận, không phải hành động

**Không sửa `BUDGETS_KIB` trong lượt này** (R-70). Phần dưới là dữ liệu để người duyệt
quyết, đúng như task yêu cầu.

`check-bundle-size.mjs` tự khai lý do tồn tại: *"một ngày màn hình đầu tiên mất hai giây
mới hiện trên máy chậm"* — tức nó muốn chặn **chi phí màn hình đầu tiên**. Nó cũng tự khai
hoàn cảnh lúc đặt số: *"Đặt từ số đo thật của bản dựng ngày 2026-08-18 — JS 155,7 KiB…
**một chunk duy nhất**"* và *"Hiện bản dựng chỉ có một chunk nên số này gần bằng tổng JS"*.

Khi có đúng một chunk, "tổng JS" **chính là** "chi phí màn hình đầu tiên". Từ lúc
`RouterProvider` được gắn và 25 màn được `lazy()`, hai đại lượng đó tách hẳn nhau:

- chi phí màn hình đầu tiên: **124,7 KiB** — *dưới* 175, còn dư 50,3 KiB;
- tổng mọi chunk từng được dựng ra: **760,8 KiB** — không ai tải cả 760,8 KiB đó bao giờ.

Cổng vì thế đang đo tổng khối lượng mã của một ứng dụng 25 màn, chứ không đo thứ nó viết ra
là muốn chặn. Nó sẽ đỏ thêm mỗi lần một màn mới được dựng, kể cả một màn `lazy()` hoàn hảo —
đúng như lịch sử cho thấy (509,3 KiB ở `23fc4b9` → 760,8 KiB hôm nay, không lượt nào có lỗi
nhập tĩnh).

**Đề xuất để người duyệt cân nhắc** (không tự thi hành):

| Ngưỡng | Đo cái gì | Số hôm nay | Đề xuất |
|---|---|---|---|
| `entry` (mới) | chunk vào + đóng kín nhập tĩnh | 124,7 | **175** — giữ nguyên con số cũ, chỉ đổi thứ được đo; đây là đại lượng docstring nói tới |
| `largestJsChunk` | giữ nguyên | 137,3 | **170** — giữ nguyên, đang đạt |
| `routeChunk` (mới) | chi phí thêm khi vào một màn bất kỳ | 264,4 (Viewer3D) | **~280**, và tách riêng cho màn 3D |
| `js` (tổng) | giữ lại làm cảnh báo | 760,8 | chuyển thành **cảnh báo có mốc**, không phải cổng đỏ — hoặc đặt lại ở mức chặn được đà tăng (ví dụ 800) và siết dần cùng §6 |

Con số nào cũng được, nhưng phải là **quyết định có người ký**, kèm lý do trong PR — đúng
như chính file đó viết. Cho tới lúc đó, **bước 6 vẫn đỏ, và báo cáo này ghi nhận nó đỏ.**

## 8. Cách dựng lại các số trên

Không có công cụ nào được thêm vào repo. Để đo lại: thêm tạm một plugin Rollup có
`generateBundle(_, bundle)` ghi `Object.entries(chunk.modules).map(([id, m]) => [id, m.renderedLength])`
cho mỗi chunk ra JSON, dựng bằng đúng `build` của `vite.config.ts` nhưng `outDir` khác, rồi
gzip từng file trong `assets/` và phân bổ theo `renderedLength`. Đóng kín khởi động lấy từ
`chunk.imports` của chunk có `isEntry`.

---

## 9. Hậu ký — cổng đã đổi theo §7 (2026-09-05)

Người duyệt đã ký bảng đề xuất ở §7. `scripts/check-bundle-size.mjs` nay đo **bốn** đại
lượng thay vì ba; `vite.config.ts` bật `build.manifest: true` vì ba trong bốn phép đo cần
**đồ thị nhập** (`imports` / `dynamicImports` trong `dist/.vite/manifest.json`), chứ không
chỉ cần danh sách file trong `assets/`.

| Ngưỡng | Đo cái gì | Số đo hôm nay | Ngưỡng | Loại |
|---|---|---|---|---|
| `entry` *(mới)* | chunk `isEntry` **+ bao đóng nhập tĩnh** của nó | **124,7** | 175 | cổng |
| `largestJsChunk` | không đổi | **137,3** | 170 | cổng |
| `routeChunk` *(mới)* | bao đóng nhập tĩnh của một chunk tải muộn, **trừ** bao đóng khởi động | **264,8** (`viewer/Viewer3D`) | 280 | cổng |
| `css` | không đổi | **9,8** | 12 | cổng |
| `js` (tổng) | không đổi cách đo, hạ cấp | **761,2** | 800 | **cảnh báo** — in ra, không làm hỏng mã thoát |

Mức nghiêm khắc giữ nguyên: `entry` là **đúng con số 175 cũ**, `largestJsChunk` là đúng
170 cũ. Chỉ *thứ được đo* là đổi. Tổng JS ở lại làm mốc để đà tăng không đi im lặng
(509,3 ở `23fc4b9` → 761,2 hôm nay), nhưng nó không còn chặn PR: một màn `lazy()` mới làm
nó tăng mà không làm ai chậm đi.

Vì sao `routeChunk` chỉ đi theo `imports` chứ không theo `dynamicImports`: các màn tới được
nhau qua điều hướng, nên bao đóng **động** của màn nào cũng là gần cả gói (đo thử: 626,2 KiB
cho mọi màn — một con số không phân biệt được gì). Bao đóng **tĩnh** mới là thứ trình duyệt
buộc phải tải trong một lượt.

Kiểm chứng `entry` thật sự chặn: sửa `dist/.vite/manifest.json` để chunk vào **nhập tĩnh**
chunk `scene-*` (giả lập một `import { Scene } from 'three'` lọt vào đường khởi động), rồi
chạy `pnpm size`. Kết quả: `entry` nhảy 124,7 → **262,0 KiB**, cổng in `VƯỢT`, mã thoát **1**
— trong khi kích thước *file* entry không đổi một byte nào. Đây đúng là trường hợp cổng cũ
và cách đo "kích thước file entry" đều không thấy. Manifest được khôi phục ngay sau đó.
