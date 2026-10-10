## Dự án

AppFront — công cụ dựng mô hình không gian từ bản vẽ kiến trúc: nhận bản vẽ, dò trục,
tường, phòng, ô mở, rồi xuất ra mô hình.

three.js **của AppFront** : `src/lib/three` được dùng react-three-fiber gói Pascal dùng `@react-three/fiber` **trực
tiếp** (đo ở T3.3 — 45,5 KiB, cộng 6,7 KiB `drei`), nên khi gói ấy được cài, R3F có mặt
trong repo. Nó bị khoanh vào đúng `src/components/pascal` bằng cổng nhập ở
`eslint-rules/configs/project.js` — xem mục 0.4. · Tailwind với bảng màu thay hoàn toàn
bằng token. Phiên bản các gói: xem `package.json`.

**Ngôn ngữ:** mọi thứ người dùng đọc là tiếng Việt có dấu. Mọi định danh trong mã là
tiếng Anh — xem mục B và E.11.

---

## Lệnh

| Lệnh | Việc |
|---|---|
| `pnpm verify` | **Cổng tổng.** Bảy bước tuần tự: typecheck → lint → **import vòng** → test+độ phủ → build → kích thước gói → **độ dài file**. Dừng ở bước hỏng đầu tiên. Chạy cái này trước khi mở PR |
| `pnpm lint` | cảnh báo cũng là lỗi (`--max-warnings 0`) |
| `pnpm test` | **không** đối chiếu ngưỡng độ phủ |
| `pnpm coverage` | có đối chiếu ngưỡng. CI chạy cái này, không chạy `test` |
| `pnpm cycles` | `import/no-cycle` — tách khỏi `pnpm lint` vì nó chậm trên 500+ file |
| `pnpm length` | Độ dài file component: nhắc 250, hỏng 400, đếm dòng CÓ NỘI DUNG |

Các lệnh còn lại (`dev`, `typecheck`, `build`, `size`, `e2e`, `e2e:visual`, `storybook`,
`draco`) là lệnh chuẩn — xem `scripts` trong `package.json`.

CI (`.github/workflows/ci.yml`) chạy năm job **song song và độc lập** — `lint` ·
`typecheck` · `unit` · `build` · `visual` — trên cả `main` và `master`. Không job
nào `needs:` job nào: một lượt chạy phải cho năm phán quyết, không phải một. Lý do
đầy đủ nằm trong khối chú thích ngay trên `jobs:` của file đó.

---

## Kiến trúc và ranh giới import — mục 0.4

Nhóm file theo **loại**, không theo tính năng. Ranh giới dưới đây được ESLint ép,
khai tại `eslint-rules/configs/project.js:126-231`, hiện **0 vi phạm**.

| Tầng | Không được import |
|---|---|
| `src/types/**` | bất cứ thứ gì |
| `src/lib/**` | **React**, `react-dom`, store, hooks, components, screens |
| `src/domain/**` | (thuần; mô hình nghiệp vụ: trục, tường, phòng, ô mở, đơn vị) |
| `src/store/**` | hooks, components, screens |
| `src/hooks/**` | components, screens |
| `src/components/**` | screens |
| `src/screens/**` | — |

> *"lib TUYỆT ĐỐI không import React"* — `project.js:26`. Đây là lý do `src/lib` chạy
> được trong worker và test được không cần DOM. Xem `src/hooks/useShortcut.ts:5`,
> `src/hooks/useFeatureFlag.ts:18`, `src/lib/mutations/undoTicket.ts:11`.

Ngoại lệ duy nhất: `src/lib/testing/**` được import `@testing-library/react` (nó phải
dựng được cây React để test màn hình), nhưng `react` và `react-dom` vẫn bị chặn đích danh.

**Cổng nhập gói Pascal** (`@pascal-app/*`) là ranh giới thứ hai, cùng chỗ khai:

| Thư mục | Được nhập gói Pascal |
|---|---|
| `src/components/pascal/**` | **có** — thư mục duy nhất; nó dựng gốc React thứ hai và gọi `mount()` |
| `src/lib/pascal/**` | chỉ `import type` (`allowTypeImports`) — bộ đổi dữ liệu là tầng thuần |
| mọi chỗ khác | không, kể cả nhập kiểu |

Cổng này dùng `@typescript-eslint/no-restricted-imports` chứ không phải luật nội bộ thứ
tám, và nó chặn cả đường vòng qua một file tái xuất — vì chính file tái xuất cũng phải qua
cổng. Bài kiểm gọi thẳng ESLint: `eslint-rules/__tests__/pascalGate.test.ts`.

---

## Bảy luật ESLint nội bộ

Tất cả ở mức `error`. Nguồn: `eslint-rules/`, ghép vào qua `plugin:local/project`.

| Luật | Ép bất biến |
|---|---|
| `local/no-raw-color` | A1 — màu lấy từ token, cấm hex/rgb/hsl ở tầng giao diện |
| `local/no-raw-duration` | B — thời lượng chỉ 120/180/260/340/700 ms |
| `local/no-raw-number` | A15 + D — không `toFixed`/`toLocaleString`/quy đổi đơn vị trong view |
| `local/no-direct-set` | A10 — không gọi `set()` của store trong component |
| `local/no-draft-write-outside-commands` | A10 — `draftSlice` chỉ ghi từ tầng lệnh trong `src/store` |
| `local/no-fetch-outside-http` | mọi truy cập mạng đi qua `src/lib/http` |
| `local/no-framer-outside-motion` | R-39 — `framer-motion` nhập ở đúng `src/components/motion` |

Sổ nợ của `no-raw-number` và của `no-fetch-outside-http` đều đã trả hết và bị xoá — đừng
dựng lại chúng. Miễn luật cho một file mới là quyết định của người duyệt, không phải của
người đang vội.

---

## Bất biến sản phẩm — mục A

| Mã | Bất biến | Trích dẫn |
|---|---|---|
| A1 | Màu lấy từ token, không mã màu thô ở tầng giao diện | `project.js:70` |
| A2 | Màu nhấn dành cho thứ tương tác được, và chỉ nhờ nó là thứ tương tác được | `lib/three/interaction/gizmo.ts:440` |
| A4 | Đúng **ba** màu trạng thái. Màu thứ tư là thứ A4 tồn tại để chặn | `gizmo.ts:439`, `lib/viewmodel/types.ts:60` |
| A5 | Xanh "đã xác minh" **chỉ** đánh dấu việc người duyệt. Đầu ra của AI không bao giờ được đặt nó | `viewmodel/types.ts:18`, `toViewModel.ts:30,208` |
| A6 | Nhãn giao diện tiếng Việt, **kiểu câu, viết hoa chữ đầu** ("Đăng nhập", "Tạo dự án", "Ẩn lớp tường") — chỉ chữ đầu, phần còn lại viết thường. Câu cũng viết hoa chữ đầu. Giữ hoa: mã trục, mã lỗi, tên phím, viết tắt (AI, OCR, SSO, PDF, CAD, 2D/3D), tên riêng (AppFront). Tên vai là danh từ chung, viết thường khi đứng giữa câu ("vai người xem"). Người dùng chốt 2026-10-04, thay quy ước "viết thường" cũ | `toolMachine.ts:120,326`, `shortcuts.ts:106`, `gizmo.ts:81` |
| A7 | **Không có nút lưu.** Hệ thống tự lưu 800 ms sau thao tác cuối, và nói ra trạng thái đó cho trình đọc màn hình | `hooks/useAutosave.ts:6`, `useSaveIndicator.ts:86` |
| A8 | Mọi thay đổi hoàn tác được, kèm toast hoàn tác | `useShareLinks.ts:225,415`, `lib/telemetry/events.ts:214` |
| A9 | Hành động mà A8 **không** hoàn tác được thì phải hỏi trước bằng hộp thoại | `screens/dashboard/ProjectDashboard/ProjectDashboard.tsx:342-344` ("Xoá dự án?"), `screens/export/ShareDialog/ShareDialog.tsx:96` (thu hồi liên kết) |
| A10 | Ghi vào store qua `commit(patch, label)`, không gọi `set()` | `project.js:80`, `lib/tools/toolMachine.ts:37` |
| A11 | **Bảy trạng thái màn hình.** Màn trắng là thất bại duy nhất mà A11 tồn tại để chặn | `useShareLinks.ts:172`, `AuthScreen.container.tsx:129` |
| A12 | Bàn phím là đường đi hạng nhất, không phải phương án dự phòng. **Esc đóng lớp trên cùng** — lời hứa không tính năng nào được lấy mất | `lib/input/shortcutRegistry.ts:21,108,573`, `lib/input/dragDrop.ts:23` |
| A14 | Bộ mẫu chuẩn dùng chung là `createSampleBuilding()` (`domain/spatial/__fixtures__/sampleBuilding.ts`): **4 tầng, 48 tường, 16 ô mở (9 cửa + 7 cửa sổ), 21 đồ đạc, 14 phòng, 4 trục, 34 kích thước**. Về diện tích: `SAMPLE_TOTAL_AREA_M2` = **248,60 m²**, và `totalArea()` (công thức dây giày, `domain/rooms/area.ts`) trên 14 đường bao thật của `createSampleBuilding()` ra đúng số ấy (13 × 4000×4250 mm + 1 × 4000×6900 mm) — `area.test.ts` khẳng định. Số 238,00 trong ghi chú cũ là của đường bao trước B-V8-10; đừng dùng. `coloring.test.ts:34-38,91` tự khai lại một bộ **khác** (34 phòng, 21 trục, 14 ô mở, 248,60 m² là diện tích MỘT sảnh) thay vì gọi `createSampleBuilding()` — hai con số 21 và 34 ở đó là số đồ đạc/kích thước của bộ thật bị gán nhầm sang trục/phòng. Đừng chép số của `coloring.test.ts` làm "bộ mẫu chuẩn" | `domain/spatial/__fixtures__/sampleBuilding.ts:34-44`, `domain/rooms/area.ts:204-207`, `lib/coloring/__tests__/coloring.test.ts:34-38,91`, `legend.test.ts:106` |
| A15 | Định dạng số xảy ra ở viewmodel, không ở view. Dấu thập phân là **dấu phẩy** | `project.js:74`, `gizmo.ts:417` |

---

## Mục B — chuyển động, ngôn ngữ định danh, chỗ đặt tính toán

- **Thang tốc độ có đúng bốn giá trị: 120, 180, 260, 340 ms.** Không con số nào khác.
  Nguồn duy nhất là `MOTION_DURATIONS_MS` trong `src/lib/motion/tokens.ts` — bốn khoá
  `instant` 120, `fast` 180, `standard` 260, `slow` 340. **700 ms** (`AMBIENT_LOOP_MS`,
  cùng file) là một hằng số **riêng**, cố ý không phải khoá thứ năm: nó pace cho hiệu ứng
  lặp (skeleton sweep, thanh tiến trình), không phần tử nào *chuyển* từ trạng thái này
  sang trạng thái khác ở tốc độ đó. Luật `local/no-raw-duration` vẫn nhận cả năm con số
  120/180/260/340/700 — chỉ khác là 700 không đến từ bảng `MOTION_DURATIONS_MS`.
  `tailwind.config.ts:14` và `hooks/useListReview.ts:102` đều dẫn luật này.
- **Định danh trong mã viết bằng tiếng Anh**, kể cả khi đặc tả nghiệp vụ đặt tên tiếng Việt.
  Đặc tả gọi màn này là `manHinhChiaSe`, mã gọi nó là `ShareScreen`; chuỗi người đọc vẫn
  là tiếng Việt. Xem `ShareScreen/ShareScreen.tsx:39`, `lib/coloring/modes.ts:52`, `lib/export/screenshot.ts:65`.
- **Tính toán không nằm trong màn hình.** Đưa xuống hook hoặc `src/lib` —
  `hooks/useShareLinkGateway.ts:8-9`.
- **Điều khiển dành cho lập trình viên không xuất hiện trên màn sản phẩm** (ví dụ chip
  "Toggle Empty State") — `lib/testing/expectVietnamese.ts:6-8`.

## Mục D — tách màn phức tạp làm hai

View thuần, **test được chỉ từ props**, không chạm store và không chạm mạng; toàn bộ logic
nằm trong một hook đi kèm. Khuôn mẫu đang chạy: `screens/project/ShareScreen/` +
`hooks/useShareLinks.ts`, và `screens/auth/AuthScreen/` (view / container / hook tách sẵn).
Cả hai màn này là **thư mục**, không phải file: khi view vượt trần 400 dòng của R-22 thì
phần con tách ra file anh em, và `index.ts` giữ nguyên đường nhập để không nơi gọi nào
phải sửa theo.
Xem `useShareLinks.ts:4`, `viewmodel/types.ts:20`, `ShareScreen.stories.tsx:12`.

Ngoại lệ được ghi nhận: `components/feedback/ScreenErrorBoundary.tsx:22` phải là class
component, và D không cản đường ở đó.

## Mục E — báo cáo trung thực

- **E.10 — Cấm báo "đạt" cho bước chưa chạy.** `scripts/verify.mjs:14` cài đặt luật này:
  bảng tổng kết chỉ in trạng thái lấy từ mã thoát thật, bước chưa tới thì ghi "chưa chạy".
- **E.11 — Định danh bằng tiếng Anh** (đi cùng mục B ở trên).


---

## Bẫy đã biết

1. **Sửa `eslint-rules/**` xong phải chạy lại `pnpm install`** (mục 0.3). pnpm **sao chép
   cứng** thư mục đó vào `node_modules/.pnpm/` (khai bằng `file:eslint-rules`), không
   symlink. Không cài lại thì ESLint vẫn đọc bản cũ và bạn sẽ tưởng luật mình vừa viết
   không chạy. `.eslintrc.cjs:9-11`.

2. **`pnpm test` không kiểm độ phủ, `pnpm coverage` mới kiểm.** Ngưỡng đặt theo tầng ở
   `vitest.config.ts:54-67` — `src/domain` 90%, `src/lib` 80%. Số thấp hơn ngưỡng thì
   cách xử lý là viết thêm test, **không phải hạ ngưỡng**.

3. **~~`src/lib/format.ts` che khuất thư mục `src/lib/format/`~~ — đã gỡ.** File đó và ba
   module trùng lặp khác (`lib/scale.ts`, `lib/geometry/area.ts`,
   `components/shell/CommandPalette.tsx`) đã bị xoá; nhập theo module cụ thể
   (`@/lib/format/number`, `@/lib/format/measure`…).
   **KHÔNG phải trùng lặp, đừng gộp:** `hooks/useCountUp.ts` ↔ `lib/motion/useCountUp.ts` —
   một bên là engine thuần, bên kia là lớp bọc React của chính nó.

4. **Bản dựng minify bằng terser, không phải esbuild** (`vite.config.ts`): chậm hơn vài
   giây, đổi lấy ~9,6 KiB gzip trên tổng JS. Đừng gỡ để "dựng nhanh hơn" — cổng kích
   thước gói đo bản dựng này.

5. **Cổng "visual" của CI: đã cho so sánh thật, nhưng CHƯA có ảnh chuẩn `linux`.** CI nay
   gọi `pnpm e2e` (so sánh) chứ không `pnpm e2e:visual` (ghi đè). Ảnh chuẩn hiện có vẫn chỉ
   có bản `win32` còn CI chạy `ubuntu-latest`, nên lượt chạy đầu sẽ ĐỎ và đẩy ảnh linux ra
   artifact để commit một lần. `pnpm e2e:visual` giờ chỉ là lệnh cập nhật ảnh tại máy.

---

## Trạng thái hiện tại — đọc trước khi dựng màn mới

- **Router đã được gắn.** `src/routes.tsx` không còn tồn tại — router thật là
  `src/routes/router.tsx` (47 route, chỉ còn **một** `Placeholder`, dùng bởi `RouteCanvas`
  và gắn vào ba đường tĩnh `/layers/objects`, `/layers/dimensions`, `/floors`).
  `src/main.tsx` dựng đủ `QueryClientProvider` → `MotionProvider` → `RouterProvider`, với
  `NotificationHost` là **anh em** của `RouterProvider`.
- **`src/App.tsx` nay là route `/demo`**, chỉ trong bản dựng phát triển — vẫn là bảng chọn
  9 màn demo, dùng `useState` để đổi màn, nhưng không còn là thứ `main.tsx` render thẳng.
  `/` là route thật, `ProjectDashboardRoute`.
- **`src/lib/query` và `src/lib/mutations` đã có nơi gọi thật** từ các màn đã dựng — không
  còn là tầng logic chờ màn đầu tiên cắm vào. Đây chưa từng là mã chết.
- **`hooks/useShareLinks.ts` tự viết `isLoading`/`error` bằng tay.** Đó là ngoại lệ đi
  trước, **không phải khuôn mẫu để chép**.
- **`components/feedback/ScreenErrorBoundary.tsx` ĐÃ được gắn.** `src/App.tsx` bọc màn
  đang hiện, có `key={activeScreen}` để ranh giới gắn lại mỗi lần đổi màn, và phần dự
  phòng dựng bằng `EmptyState` từ `report.description`. Màn thật đầu tiên chép khuôn đó.
- **`src/lib/three/present` là tầng trình diễn** — plan JSON thành mặt bằng 3D cắt mở;
  `mountPresentation(canvas, plan)` là cửa vào, `/login` chỉ là một người gọi. Chi tiết
  (ngân sách đèn, vòng vẽ theo nhu cầu, ba trường tuỳ chọn của plan, Draco) nằm ở
  `src/lib/three/present/CLAUDE.md` — nạp khi làm việc trong thư mục đó.
- **`src/components/motion` là chỗ DUY NHẤT được nhập `framer-motion`.** `MotionProvider`
  ở đó đặt `reducedMotion="user"` một lần cho toàn ứng dụng, và `local/no-framer-outside-motion`
  chặn mọi đường vòng. **Không** đặt ở `src/lib/motion`: `framer-motion` nhập React, mà
  `src/lib` cấm React (mục 0.4).
- **`src/i18n/vi.json` vừa là từ điển kiểm tra, vừa có khối được đọc lúc chạy.** Phần lớn
  chuỗi viết thẳng trong màn; tệp là **từ điển để kiểm tra** (`lib/testing/expectVietnamese.ts:25-31`).
  NHƯNG các khối `common`, `errors`, `autosave`, `pipeline`, `auth` được nhập lúc chạy
  (`describeError.ts`, `notificationBus.ts`, `useSaveIndicator.ts`, `AuthScreen.tsx`,
  `lib/realtime/pipeline.ts`) — sửa chúng là sửa chữ thật trên màn và đổi kích thước gói. Các
  khối khác là bản chép, có thể lệch mã; mã thắng.

---

## Bộ khẳng định dùng chung

Dùng chúng thay vì viết lại phép kiểm:

| Hàm | Việc |
|---|---|
| `lib/testing/expectAccessible` | Soát khả năng tiếp cận của một cây đã render |
| `lib/testing/expectVietnamese` | Soát chuỗi tiếng Anh sót lại và chữ mất dấu |
| `lib/testing/expectNoRawColor` | Soát mã màu thô |
| `lib/testing/expectSevenStates` | Soát đủ bảy trạng thái của A11 |
| `lib/testing/render` · `fixtures` · `fakeClock` · `sevenStateScenarios` | Bộ dựng và dữ liệu mẫu |

---

## Viết test nhanh (PERF-01, đo 2026-10-10)

Mỗi dòng là một chỗ đã đo được làm bộ test chậm; viết test mới theo đúng cách nhanh, phép kiểm không đổi.

- Tệp không render React/không đọc DOM → môi trường `node` (thêm vào `environmentMatchGlobs` của `vitest.config.ts` **sau khi**
  `pnpm exec vitest run <tệp> --environment node` xanh, hoặc `/** @vitest-environment node */` đầu tệp). jsdom tốn ~2,8 s CPU/tệp.
- `userEvent.setup({ delay: null })` (fake timers thì `advanceTimers`); mặc định `delay: 0` là một `setTimeout` thật mỗi phím
  (DimensionOcrReview 28 → 15 s).
- Không ngủ thật trong test: `vi.useFakeTimers()` + `await vi.advanceTimersByTimeAsync(n)` (accountWiring 11 → 6 s).
- Dữ liệu/cảnh bất biến dựng một lần (`beforeAll`/hằng module), không trong `beforeEach` (houseScene 6,1 → 1,0 s).
- Tệp gom quá nhiều màn/route thì tách theo nhóm để chạy song song (mainLandmark 21 → 12 s).
- `waitFor`/`findBy*` đã hỏi mỗi 5 ms (`vitest.setup.dom.ts`); vẫn ưu tiên `getBy*` khi dữ liệu đã có đồng bộ.
- Đo trước khi tối ưu: `pnpm exec vitest run <tệp> --maxWorkers=2 --minWorkers=1 --reporter=verbose`.
