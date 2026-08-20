# BÁO CÁO ĐỘ LỆCH

Đối chiếu `RULE.md` với mã nguồn hiện tại. Đo ngày 2026-08-20, trên `master` (`622d73f`),
503 file / 112.037 dòng trong `src/`.

> **Ghi chú phương pháp đo.** Lần đo thứ nhất (2026-08-20) bị hook `PreToolUse` trỏ vào
> `.agent/hooks/pre_tool_use.py` chặn mọi lệnh, nên mọi con số đến từ grep. **Lần đo thứ hai
> đã chạy được lệnh thật** — hook đã gỡ khỏi `.claude/settings.json`, xem D2. Chín con số ở
> bảng dưới đã sửa theo lần đo thứ hai. Nguyên nhân lệch là **một**: lần đầu đếm bằng lệnh
> khác với lệnh ghi ở trường "Kiểm bằng" của `RULE.md`. Từ nay cột "Số chỗ" phải là **đầu ra
> của chính lệnh ở cột Kiểm bằng**, không phải một phép đo song song.
>
> **Lần đo thứ ba (2026-08-21)** chạy sau khi sửa mã: bảng vi phạm dưới đây chỉ còn những mục
> THẬT SỰ còn vi phạm, mỗi mục kèm trạng thái. Mọi con số đến từ đúng lệnh ở trường "Kiểm bằng".
>
> R-05 (import vòng) **đã đo** ở lần thứ hai: `import/no-cycle` báo **0**. Còn để trống: độ
> phủ thật theo thư mục. Không mục nào được báo "đạt" khi chưa chạy (mục E.10 của `CLAUDE.md`).

---

## 1. BẢNG VI PHẠM

**Nghiêm trọng:** Cao = lỗi thật hoặc lỗ hổng bất biến · Trung bình = sẽ thành lỗi khi mã lớn thêm · Thấp = nhất quán.
**Chi phí:** Thấp = công cụ sửa tự động hoặc dưới 1 giờ · Trung bình = sửa tay dưới một ngày · Cao = phải tái cấu trúc.

Cột **Số chỗ** là đầu ra của chính lệnh ở trường "Kiểm bằng" của luật, đo ngày 2026-08-21
(lần đo thứ ba, sau khi sửa mã). Bảng chỉ liệt kê mục CÒN vi phạm; mục đã về 0 nằm ở hai
dòng ngay dưới bảng.

| Mã | Vi phạm | Số chỗ | File tệ nhất | Nghiêm trọng | Chi phí | Trạng thái |
|---|---|---:|---|---|---|---|
| R-31 | `useCallback` không có người tiêu thụ | 74 / 99 | `src/hooks/useMiniMap.ts` (6) | Thấp | Trung bình | hoãn |
| R-04 | Import tương đối vượt thư mục | 646 / 226 file | `src/components/shell/AppShell.tsx` (12) | Thấp | Thấp *(có fixer)* | hoãn |
| R-15 | `any` | 14 / 12 file | `src/components/feedback/Toast.stories.tsx` (3) | Trung bình | Trung bình | hoãn *(toàn bộ trong story)* |
| R-21 | File component vượt 250 dòng | 8 | `src/screens/project/ShareScreen.tsx` (460) | Trung bình | Cao | hoãn |
| R-27 | `useEffect` đồng bộ state → state | 4 | `src/hooks/useCombobox.ts:67` | Trung bình | Trung bình | hoãn *(2/6 đã sửa)* |
| R-51 | `console.*` còn trong mã sản phẩm | 6 | `src/lib/input/shortcutRegistry.ts` (2) | Thấp | Thấp | xong *(cả 6 giữ có chủ ý)* |
| R-47 | Dữ liệu mẫu ngoài `lib/testing` | 1 file / 1.612 dòng | `src/mocks/spatial.ts` | Trung bình | Trung bình | hoãn *(đã loại khỏi độ phủ)* |
| R-22 | File component vượt 400 dòng | 2 | `src/screens/project/ShareScreen.tsx` (460) | Trung bình | Cao | hoãn — **`pnpm verify` đang ĐỎ vì mục này** |
| R-26 | `useEffect` lấy dữ liệu thay vì dùng `lib/query` | 1 | `src/hooks/useShareLinks.ts:314` | **Cao** | Trung bình | hoãn |

**Đã về 0 trong lượt sửa này:** R-05 · R-10 · R-12 · R-13 · R-14 · R-17 · R-18 · R-19 ·
R-20 · R-24 · R-29 · R-30 · R-39 · R-41 · R-45 · R-50 · R-52 · R-54 · R-55.

**Khiếm khuyết đã xử lý:** D1 · D2 · D4 · D5 · D6 · D8. Còn hoãn: D3, D7.

**Chín con số đã sửa ở lần đo thứ hai** — mọi lệch đều cùng một nguyên nhân: lần đầu đếm
bằng lệnh khác với lệnh ở trường "Kiểm bằng".

| Mã | Số cũ | Số mới | Vì sao lệch |
|---|---:|---:|---|
| R-12 | 445 | **7** | 445 là **mọi** type alias trong `src`. R-12 chỉ cấm `type` cho *hình dạng đối tượng thuần*; union, tuple, kiểu nhãn dùng `type` là **đúng theo chính luật đó**. Tức là lần đầu đếm cả phía đúng. Luật thật `@typescript-eslint/consistent-type-definitions` bắt 7 |
| R-13 | 44 | **99** (1) | Lần đầu đếm bằng grep trên chữ ký hàm, bỏ sót hàm nhiều dòng và arrow xuất khẩu. Luật thật bắt 99 toàn `src`; trong đúng phạm vi mục 3 đề xuất (`src/lib` + `src/domain`, trừ test) chỉ còn **1** |
| R-14 | 0 | **45** | Lần đầu grep `import type` — phép đo đó chỉ nhìn thấy **phía đúng**, nên đếm được 604 chỗ đúng rồi kết luận "không vi phạm". Vi phạm của R-14 là chỗ **thiếu** `import type`, thứ grep không bao giờ thấy. Chỉ `@typescript-eslint/consistent-type-imports` phát hiện được |
| R-54 | 4 | **0** | Lệnh kiểm của R-54 loại trừ `src/lib/input/**` (`--glob '!src/lib/input/**'`) — đó là chính thư mục cài đặt `shortcutRegistry`, nơi gắn listener là **đúng**. Lần đầu bỏ cờ loại trừ nên đếm cả 4 chỗ trong đó. Khớp duy nhất còn lại là một dòng **chú thích** ở `useShortcut.ts:10` |
| R-41 | 5 | **7** | Lần đầu chỉ đếm `rgba()`. Lệnh kiểm còn bắt cả hex, và `tailwind.config.ts:25-26` có `white: '#ffffff'`, `black: '#000000'` |
| R-50 | ~8 | **5** | Lần đầu đoán, không đối chiếu. Đối chiếu thật `*.tsx` với `*.stories.tsx`: đúng 5 file thiếu |
| R-51 | 12 | **11** | Sai số đếm tay |
| R-21 | 11 | **8** | Lần đầu đếm **mọi** dòng kể cả dòng trống. Đơn vị đúng là dòng có nội dung — chênh lệch là dòng chỉ có khoảng trắng. Cả hai bộ số giờ đo được bằng `node scripts/check-file-length.mjs` |
| R-22 | 3 | **2** | Như trên. `src/components/ui/Table.tsx` là 417 dòng thô nhưng **367 dòng có nội dung**, tức dưới ngưỡng |

**Không vi phạm nào:** R-01, R-02, R-03 (ranh giới tầng, 0/503) · R-06 (mạng, 0) ·
R-07 (đường dẫn API, 0) · R-23 (component lồng nhau, 0) · R-25 (hook có điều kiện, 0) ·
R-32, R-33 (ghi store, 0) · R-36 (màu thô ở tầng giao diện, 0) · R-37 (thời lượng ngoài
thang, 0) · R-43, R-44 (đơn vị, hệ kiểu chặn) · R-46 (`skip`/`only`, 0) ·
**R-54** (listener bàn phím, 0 — chuyển xuống đây ở lần đo thứ hai; xem bảng lệch trên).

> `R-14` đã **rời** danh sách này ở lần đo thứ hai. Nó từng nằm đây với ghi chú "604 chỗ
> đúng" — một con số chỉ chứng minh phía đúng tồn tại, không chứng minh phía sai vắng mặt.

### Khiếm khuyết ngoài phạm vi luật, phát hiện lúc quét

| # | Khiếm khuyết | Vị trí | Nghiêm trọng |
|---|---|---|---|
| D1 | ~~**Cổng "visual" của CI không chặn được gì**~~ — **ĐÃ SỬA** (`b598e98`): CI gọi `pnpm e2e` (so sánh) thay cho `pnpm e2e:visual` (ghi đè). **Còn nợ:** ảnh chuẩn `linux` chưa sinh được — cần Docker, daemon trên máy đo không chạy. Job có bước `upload-artifact` khi hỏng để lượt CI đỏ đầu tiên trả về đúng những ảnh đó. Mô tả cũ:  — `e2e:visual` chạy với `--update-snapshots`, tức ghi đè ảnh chuẩn thay vì so sánh. Ảnh chuẩn hiện có cũng chỉ có bản `win32`, CI chạy `ubuntu-latest` | `package.json:18`, `ci.yml:91` | **Cao** |
| D2 | ~~**Hook chặn toàn bộ công cụ**~~ — **ĐÃ XONG**, tự hết. `.claude/settings.json` hiện **không còn khối `hooks`** (`grep -c hooks .claude/settings.json` → 0) và thư mục `.agent/` không tồn tại. Bằng chứng trực tiếp: `pnpm typecheck`, `pnpm lint`, `pnpm coverage` đều chạy được ở lần đo thứ hai. Giữ dòng này để nhớ vì sao lần đo thứ nhất phải dùng grep | `.claude/settings.json` | ~~Cao~~ → xong |
| D3 | **`src/routes.tsx` chưa được gắn** — 28 route, 20 trong đó là `<Placeholder>`, không nơi nào dựng `RouterProvider`. Vẫn được đóng gói vào bản dựng | `src/routes.tsx`, `src/main.tsx:21` | Trung bình |
| D4 | ~~**`src/lib/format.ts` che khuất `src/lib/format/`**~~ — **ĐÃ SỬA** (`9760cc4`): xoá file, chuyển 13 nơi gọi sang module cụ thể, tương đương từng chuỗi đã chứng minh trước khi đổi. Mô tả cũ:  — `@/lib/format` giải về file 30 dòng; 874 dòng trong thư mục chỉ tới được bằng đường dẫn đầy đủ | `src/lib/format.ts` | Trung bình |
| D5 | ~~**Hai cấu hình vitest**~~ — **ĐÃ SỬA** (`3017257`). Mô tả cũ:  — khối `test` trong `vite.config.ts:12-15` bị `vitest.config.ts` che, không bao giờ chạy | `vite.config.ts:12-15` | Thấp |
| D6 | ~~**`eslint-plugin-import` nạp nhưng 0 luật bật**~~ — **ĐÃ SỬA** (`d1a7f32`): bật 5 luật rẻ, cộng `import/no-cycle` ở `pnpm cycles`. Mô tả cũ:  — tốn thời gian khởi động lint mà không kiểm gì | `.eslintrc.cjs:24` | Thấp |
| D7 | **Bốn phụ thuộc khai mà 0 lần dùng** — `@react-three/fiber`, `@react-three/drei`, `react-hook-form`, `d3-zoom` (+`@types/d3-zoom`) | `package.json` | Thấp |
| D8 | ~~**Module trùng lặp**~~ — **ĐÃ SỬA** (`9e28035`): xoá `lib/scale.ts`, `lib/geometry/area.ts`, `components/shell/CommandPalette.tsx`, cả ba đều 0 nơi dùng. **Cặp thứ tư trong danh sách cũ là SAI:** `hooks/useCountUp.ts` ↔ `lib/motion/useCountUp.ts` không trùng lặp — một bên là engine THUẦN (`createCountUp`, `sampleCountUp`, không chạm React), bên kia là lớp bọc React gọi thẳng vào engine đó. Đúng ranh giới mục 0.4, giữ cả hai. | — | ~~Trung bình~~ → xong |

---

## 2. BA VIỆC NÊN SỬA TRƯỚC

### Việc 1 — Phục hồi cổng "visual" của CI (D1)

**Làm gì:** bỏ `--update-snapshots` khỏi lệnh CI chạy; sinh ảnh chuẩn `linux` một lần rồi
commit. Giữ `e2e:visual` như lệnh cập nhật ảnh dùng tại máy, và cho CI gọi `pnpm e2e`.

```diff
- "e2e:visual": "node scripts/run-playwright.mjs --update-snapshots --reporter=line"
+ "e2e:visual": "node scripts/run-playwright.mjs --update-snapshots --reporter=line",
+ "e2e:ci": "node scripts/run-playwright.mjs --reporter=line"
```
```diff
# .github/workflows/ci.yml:91
-      - run: pnpm e2e:visual
+      - run: pnpm e2e:ci
```

**Vì sao chọn việc này trước:** một trong năm cổng của CI đang xanh vô điều kiện. Nó không
kiểm gì cả, nhưng bảng CI hiển thị dấu tích — tức nó **báo "đạt" cho bước chưa chạy**, đúng
thứ mục E.10 cấm và `scripts/verify.mjs:14` viết ra thành luật. Sửa tốn hai dòng và không
đụng đến một dòng mã sản phẩm nào. Không việc nào khác có tỷ lệ lợi ích trên công sức gần
bằng.

### Việc 2 — `Toast.tsx:149` (R-29)

**Làm gì:** lấy id từ `src/lib/http/ids.ts` thay vì `Math.random()`, và đưa
`setSummaryResetKey` ra khỏi hàm cập nhật.

```tsx
// Hiện tại — src/components/feedback/Toast.tsx:147-153
const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
  setQueue((prev) => {
    const newToast = { ...toast, id: Math.random().toString(36).substring(2, 9) };
    setSummaryResetKey(k => k + 1);   // gọi setState bên trong updater
    return [newToast, ...prev];
  });
}, []);
```

**Vì sao chọn việc này chứ không phải R-04 hay R-21:** đây là **lỗi**, không phải chuyện
phong cách. `src/main.tsx:20` bật `React.StrictMode`, nên React gọi hàm cập nhật hai lần
lúc phát triển; `Math.random()` cho hai id khác nhau và `setSummaryResetKey` chạy hai lần.
Triệu chứng là toast thỉnh thoảng nhân đôi hoặc mất — loại lỗi không tái hiện được theo yêu
cầu và tốn nửa ngày để lần ra. Sửa mất mười phút. So với nó, 646 import tương đối (R-04)
không làm hỏng gì đang chạy.

### Việc 3 — Gắn `ScreenErrorBoundary` (R-55)

**Làm gì:** bọc `<ActiveComponent />` trong `src/App.tsx:53-57`, và bọc mỗi phần tử route
khi `routes.tsx` được gắn.

```diff
  <div className="flex-1 relative overflow-hidden bg-bg-app">
+   <ScreenErrorBoundary>
      <Toast.Provider>
        <ActiveComponent />
      </Toast.Provider>
+   </ScreenErrorBoundary>
  </div>
```

**Vì sao chọn việc này:** bất biến A11 nói màn trắng là thất bại duy nhất nó tồn tại để
chặn (`src/hooks/useShareLinkGateway.ts:18`, `AuthScreen.container.tsx:129`). Repo đã có
92 dòng cài đặt và 167 dòng test cho ranh giới lỗi, **xanh hoàn toàn, nhưng chưa bọc lấy
một màn** — nghĩa là bộ test đang chứng minh một thứ chưa được dùng, và bất biến quan trọng
nhất về độ bền của giao diện hiện không có gì bảo vệ. Chi phí là bốn dòng.

**Vì sao không phải R-39 (framer-motion, 16 file):** lỗ hổng `useReducedMotion` nghiêm
trọng ngang, nhưng nó cần làm ba việc trước — mở rộng `src/lib/motion/index.ts` để tái xuất
`motion`/`AnimatePresence`/`useAnimation`, viết luật `local/no-framer-outside-motion`, rồi
mới sửa 16 file. Đó là việc của tuần sau, không phải việc làm trước.

---

## 3. NỢ KỸ THUẬT CHẤP NHẬN SỐNG CHUNG

| Nợ | Vì sao chấp nhận | Điều kiện quay lại xử lý |
|---|---|---|
| **646 import tương đối** (R-04) | Không làm hỏng gì đang chạy. Sửa tự động được nhưng tạo diff 646 dòng che mọi thay đổi thật trong vài tuần | Khi **không có nhánh tính năng lớn nào đang mở** — diff cơ học kiểu này gây xung đột merge với mọi nhánh đang sống. Làm trong một PR riêng, không kèm thay đổi nào khác |
| **4 file trong sổ nợ `no-raw-number`** | Đã có sổ nợ, có lý do viết sẵn, danh sách không dài thêm | Khi màn tương ứng được chuyển sang ViewModel của `src/lib/viewmodel`. Xoá dòng khỏi sổ nợ trong **cùng PR** đó |
| **2 file > 400 dòng** (R-22) | Tách `ShareScreen` 460 dòng là tái cấu trúc thật, có rủi ro | Khi lần tới có người sửa vào chính file đó. Đến lúc đó tách trước, sửa sau. **Lưu ý mới:** từ lần đo thứ hai, `pnpm verify` có bước thứ sáu `pnpm length` và bước đó **đang HỎNG** vì đúng hai file này — nợ này không còn im lặng được nữa |
| **`src/mocks/spatial.ts` 1.612 dòng** (R-47) | Là dữ liệu demo cho 9 màn demo hiện tại | ~~Việc rẻ làm ngay: thêm `src/mocks/**` vào `coverage.exclude`~~ — **ĐÃ LÀM** (`304e548`), độ phủ tổng 85,08% → 84,42%, con số đi xuống vì nó đang nói đúng hơn. Xoá hẳn file khi màn thật thay demo |
| **`src/routes.tsx` chưa gắn** (D3) | Nó là bản đồ route đã thiết kế, có giá trị tham chiếu | Khi dựng vỏ ứng dụng thật: hoặc gắn `RouterProvider`, hoặc chuyển thành tài liệu. Không để nguyên trạng quá lần dựng màn thật đầu tiên |
| **10 file story tắt `no-explicit-any`** (R-15) | `any` chỉ ở `args` của story, không vào bản dựng sản phẩm | Khi viết được một type helper cho `args`. Ưu tiên thấp |
| **`useShareLinks` tự viết fetch** (R-26) | Nó đang chạy và có test | Khi màn thật đầu tiên dùng `lib/query` — chuyển luôn cùng lúc, để chỉ có một khuôn mẫu trong repo |
| **4 phụ thuộc không dùng** (D7) | Không tốn gì lúc chạy vì không được import, tree-shaking bỏ hết | Khi có người thật sự định dùng `react-three-fiber` thì quyết; nếu sáu tháng nữa vẫn 0 import thì gỡ |

> **Hai dòng đã RỜI danh sách này ở lần đo thứ hai — R-12 và R-13.**
>
> Cả hai được hoãn vì một tiền đề về **quy mô**: R-12 "445 chỗ, diff lớn", R-13 "44 chỗ,
> 34/35 file là tầng UI". Đo lại bằng đúng luật ESLint thì R-12 còn **7 chỗ** và R-13 còn
> **1 chỗ** trong chính phạm vi mà mục này đề xuất. Tiền đề sai thì kết luận hoãn không
> đứng được: 7 chỗ có bộ sửa tự động không phải là "diff cơ học lớn", và 1 chỗ thì không
> phải là gánh nặng tầng UI.
>
> **Phần đúng của mục này về R-13 được giữ nguyên và vẫn là cách làm:** bật
> `@typescript-eslint/explicit-module-boundary-types` **chỉ cho `src/lib/**` và
> `src/domain/**`, trừ test** — nơi kiểu trả về thật sự mang thông tin. Tầng UI để nguyên,
> vì hàm component trả `JSX.Element` và khai ra thêm ít giá trị. Khuôn override có sẵn ở
> mục 4.3 bên dưới. Chỉ có *kết luận hoãn* bị bỏ, không phải *phạm vi*.

---

## 4. ĐỀ XUẤT CẤU HÌNH — **chỉ đề xuất, chưa áp dụng**

### 4.1 Nguyên tắc: không biến mã cũ thành lỗi ngay

Mỗi luật mới đi qua ba bước. **Không luật nào nhảy thẳng lên `error` toàn repo.**

| Bước | Làm gì | Khi nào sang bước sau |
|---|---|---|
| **1. Đo** | Bật `warn`, chạy `pnpm lint`, đếm. Vẫn xanh vì `--max-warnings 0` chưa áp cho luật mới *(xem lưu ý dưới)* | Có con số thật |
| **2. Chặn file mới và file có sửa đổi** | Job CI riêng, chỉ lint các file trong diff, ở mức `error` | Số vi phạm còn lại về 0 |
| **3. Chặn toàn repo** | Nâng lên `error` trong `project.js`, xoá job riêng | — |

> ⚠️ **Lưu ý về bước 1:** `pnpm lint` chạy với `--max-warnings 0`, nên `warn` **cũng làm
> hỏng lệnh**. Để đo mà không chặn, chạy riêng `pnpm eslint . --ext ts,tsx` (không kèm cờ
> đó), hoặc đặt luật ở `off` trong `project.js` và bật tạm bằng `--rule`.

### 4.2 Bước 2 — job CI chỉ lint file trong diff

```yaml
# .github/workflows/ci.yml — thêm job, đặt sau `lint`
  lint-changed:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - name: Lint chỉ các file thay đổi, với bộ luật đang bật dần
        run: |
          FILES=$(git diff --name-only --diff-filter=ACMR \
            origin/${{ github.base_ref || 'master' }}...HEAD \
            -- 'src/**/*.ts' 'src/**/*.tsx')
          if [ -z "$FILES" ]; then echo "Không file nào đổi."; exit 0; fi
          pnpm eslint $FILES --no-error-on-unmatched-pattern --max-warnings 0 \
            -c .eslintrc.staged.cjs
```

```js
// .eslintrc.staged.cjs — chỉ dùng cho job trên. Bộ luật đang bật dần, mức `error`.
module.exports = {
  extends: ['./.eslintrc.cjs'],
  rules: {
    'no-relative-import-paths/no-relative-import-paths': [
      'error',
      { allowSameFolder: true, rootDir: 'src', prefix: '@' },   // R-04
    ],
    '@typescript-eslint/consistent-type-definitions': ['error', 'interface'], // R-12
    '@typescript-eslint/consistent-type-imports': 'error',                    // R-14
  },
  plugins: ['no-relative-import-paths'],
};
```

Cài thêm: `pnpm add -D eslint-plugin-no-relative-import-paths`.
**Đây là plugin có bộ sửa tự động.** `import/no-relative-parent-imports` không có fixer —
cài nhầm thì 646 dòng phải sửa tay.

### 4.3 Luật thêm vào `eslint-rules/configs/project.js`

```js
// -- 1. LUẬT — bổ sung -------------------------------------------------------
rules: {
  // ... sáu luật hiện có giữ nguyên ...

  // R-39: ba tên rò useReducedMotion. Cần src/lib/motion/index.ts tái xuất
  // chúng TRƯỚC khi bật, nếu không 16 file thành lỗi mà không có đường sửa.
  'local/no-framer-outside-motion': 'off',   // → 'error' ở bước 3

  // R-17: mọi lần tắt luật phải nói vì sao.
  'eslint-comments/require-description': 'off',  // cần eslint-plugin-eslint-comments
},

overrides: [
  // R-13: kiểu trả về chỉ bắt buộc ở hai tầng nó mang thông tin.
  {
    files: ['src/lib/**/*.ts', 'src/domain/**/*.ts'],
    excludedFiles: ['**/__tests__/**', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/explicit-module-boundary-types': 'warn',  // → 'error'
    },
  },

  // R-45: cấm test-id, miễn trừ theo đường dẫn — không miễn trừ theo lời hứa.
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
    excludedFiles: ['src/components/canvas/**', 'src/lib/three/**'],
    rules: {
      'no-restricted-syntax': ['warn', {                            // → 'error'
        selector: "MemberExpression[property.name=/^(get|find|query)(All)?ByTestId$/]",
        message: 'R-45: tìm theo vai trò. Canvas và three được miễn trừ theo đường dẫn.',
      }],
    },
  },

  // R-04 / R-05: import vòng chỉ chạy ở verify và CI — chậm thấy rõ trên 503 file.
  // Đặt ở `off` tại đây, bật bằng --rule trong scripts/verify.mjs.
  { files: ['src/**/*'], rules: { 'import/no-cycle': 'off' } },
],
```

### 4.4 Script kiểm bổ sung — `scripts/check-file-length.mjs` — **ĐÃ DỰNG**

Không còn là đề xuất. Script có thật tại `scripts/check-file-length.mjs`, khai trong
`package.json` là `pnpm length`, và là **bước thứ sáu của `pnpm verify`**.

```
$ node scripts/check-file-length.mjs

Độ dài file component (dòng có nội dung) — nhắc 250, hỏng 400

  HỎNG   460 dòng  src/screens/project/ShareScreen.tsx
  HỎNG   403 dòng  src/components/ui/Combobox.tsx
  nhắc   367 dòng  src/components/ui/Table.tsx
  nhắc   346 dòng  src/components/ui/Select.tsx
  nhắc   340 dòng  src/screens/auth/AuthScreen/AuthScreen.tsx
  nhắc   291 dòng  src/components/shell/AppShell.tsx
  nhắc   277 dòng  src/components/overlay/Drawer.tsx
  nhắc   256 dòng  src/components/overlay/Modal.tsx

66 file đã quét · 8 vượt 250 · 2 vượt 400

2 file vượt 400 dòng. Tách trước, rồi sửa. Không nới ngưỡng để cho qua.
$ echo $?
1
```

**Đoạn mã mẫu ở phiên bản trước của mục này hỏng ba chỗ — đừng chép lại nó:**

1. `globSync` **không có** trong `node:fs` ở Node 20; nó xuất hiện từ Node 22 và ở đó vẫn
   là API thử nghiệm. `.github/workflows/ci.yml` chốt `node-version: '20'`, nên đoạn mẫu
   hỏng ngay dòng import trên chính máy CI.
2. `node:fs` bị import hai lần.
3. `exclude` của `globSync` **không nhận hàm**.

Bản thật dùng `readdirSync` đệ quy, và nói rõ đơn vị đếm ngay trong đầu file: **dòng có
nội dung**, tức `line.trim() !== ''`. Đơn vị này không phải chi tiết vụn — đếm cả dòng
trống cho ra 12/3 thay vì 8/2 trên cùng cây mã.

**Hệ quả phải biết trước:** bước thứ sáu **đang HỎNG**. `pnpm verify` đỏ ở
`ShareScreen.tsx` (460) và `Combobox.tsx` (403). Đó là R-22 lần đầu tiên có răng — trước
đây nó là luật BẮT BUỘC trỏ vào một script không tồn tại, tức không chặn được gì. Cách xử
lý là **tách hai file đó**, không phải nới ngưỡng.

### 4.5 Lộ trình — **đã chạy**, còn lại là phần cố ý hoãn

Toàn bộ mục 2 và phần lớn mục 1 đã làm, mỗi mục một commit. Cổng kiểm nay có **bảy** bước
(`pnpm verify`): typecheck · lint · **import vòng** · test + độ phủ · build · kích thước gói
· **độ dài file**. Hai bước in đậm là mới.

Việc còn lại, tất cả đều nằm trong mục 3 và đều có điều kiện quay lại viết sẵn:

| Việc | Vì sao chưa làm |
|---|---|
| R-22 — tách `ShareScreen` (460) và `Combobox` (403) | **Đây là việc cấp nhất còn lại.** Cổng độ dài file nay có thật, nên `pnpm verify` ĐỎ ở bước bảy cho tới khi hai file này được tách. Một cổng luôn đỏ thì không phát hiện được hồi quy |
| R-21 — sáu file 256–367 dòng | Tập cha của R-22; làm sau |
| R-04 — 646 import tương đối | Đợi lúc không có nhánh tính năng lớn nào mở |
| R-31 — 74 `useCallback` không người tiêu thụ | Phép đo theo tên có lỗ ở ranh giới prop; cần soi tay từng chỗ |
| R-26 — `useShareLinks` tự viết fetch | Đợi màn thật đầu tiên dùng `lib/query` |
| R-15 — 14 chỗ `any` trong story | Đợi type helper cho `args` |
| R-47 — xoá `src/mocks/spatial.ts` | Đợi màn thật thay 9 màn demo |
| D3 — gắn `routes.tsx` | Đợi dựng vỏ ứng dụng thật |
| D7 — 4 phụ thuộc không dùng | Đợi quyết định về react-three-fiber |
| D1 — ảnh chuẩn `linux` | Cần Docker; lượt CI đỏ đầu tiên sẽ trả ảnh về qua artifact |

**Không làm trong lộ trình này:** tách ba file > 400 dòng (đợi lần sau có người sửa vào
chúng), xoá `routes.tsx` (đợi lúc dựng vỏ ứng dụng thật), gỡ bốn phụ thuộc không dùng
(đợi quyết định về react-three-fiber).
