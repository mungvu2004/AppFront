## Dự án

AppFront — công cụ dựng mô hình không gian từ bản vẽ kiến trúc: nhận bản vẽ, dò trục,
tường, phòng, ô mở, rồi xuất ra mô hình.

three.js dựng tay (**không** dùng react-three-fiber) · Tailwind với bảng màu thay hoàn
toàn bằng token. Phiên bản các gói: xem `package.json`.

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

CI (`.github/workflows/ci.yml`) chạy năm job nối tiếp trên cả `main` và `master`.

---

## Kiến trúc và ranh giới import — mục 0.4

Nhóm file theo **loại**, không theo tính năng. Ranh giới dưới đây được ESLint ép,
khai tại `eslint-rules/configs/project.js:75-156`, hiện **0 vi phạm**.

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

**Sổ nợ** nằm ở `project.js:158-174`: bốn file được miễn `no-raw-number`. Danh sách này
**chỉ được ngắn đi**. Thêm một dòng vào đó là quyết định của người duyệt, không phải của
người đang vội. Sổ nợ của `no-fetch-outside-http` đã trả hết và bị xoá — đừng dựng lại nó.

---

## Bất biến sản phẩm — mục A

| Mã | Bất biến | Trích dẫn |
|---|---|---|
| A1 | Màu lấy từ token, không mã màu thô ở tầng giao diện | `project.js:54` |
| A2 | Màu nhấn dành cho thứ tương tác được, và chỉ nhờ nó là thứ tương tác được | `lib/three/interaction/gizmo.ts:440` |
| A4 | Đúng **ba** màu trạng thái. Màu thứ tư là thứ A4 tồn tại để chặn | `gizmo.ts:439`, `lib/viewmodel/types.ts:60` |
| A5 | Xanh "đã xác minh" **chỉ** đánh dấu việc người duyệt. Đầu ra của AI không bao giờ được đặt nó | `viewmodel/types.ts:18`, `toViewModel.ts:30,208` |
| A6 | Nhãn giao diện tiếng Việt, **viết thường, kiểu câu**. Ngoại lệ chữ hoa: mã trục, mã lỗi, tên phím | `toolMachine.ts:120,326`, `shortcuts.ts:106`, `gizmo.ts:81` |
| A7 | **Không có nút lưu.** Hệ thống tự lưu 800 ms sau thao tác cuối, và nói ra trạng thái đó cho trình đọc màn hình | `hooks/useAutosave.ts:6`, `useSaveIndicator.ts:86` |
| A8 | Mọi thay đổi hoàn tác được, kèm toast hoàn tác | `useShareLinks.ts:225,415`, `lib/telemetry/events.ts:214` |
| A9 | Hành động mà A8 **không** hoàn tác được thì phải hỏi trước bằng hộp thoại | `screens/project/ShareScreen/ShareScreen.tsx:20-26,127` |
| A10 | Ghi vào store qua `commit(patch, label)`, không gọi `set()` | `project.js:65`, `lib/tools/toolMachine.ts:37` |
| A11 | **Bảy trạng thái màn hình.** Màn trắng là thất bại duy nhất mà A11 tồn tại để chặn | `useShareLinks.ts:172`, `AuthScreen.container.tsx:129` |
| A12 | Bàn phím là đường đi hạng nhất, không phải phương án dự phòng. **Esc đóng lớp trên cùng** — lời hứa không tính năng nào được lấy mất | `lib/input/shortcutRegistry.ts:21,108,573`, `lib/input/dragDrop.ts:23` |
| A14 | Bộ mẫu chuẩn dùng chung là `createSampleBuilding()` (`domain/spatial/__fixtures__/sampleBuilding.ts`): **14 phòng, 4 trục, 16 ô mở (9 cửa + 7 cửa sổ), 21 đồ đạc, 34 kích thước**; 248,60 m² là tổng diện tích cả 14 phòng. `coloring.test.ts:34-38,91` tự khai lại một bộ **khác** (34 phòng, 21 trục, 14 ô mở, 248,60 m² là diện tích MỘT sảnh) thay vì gọi `createSampleBuilding()` — hai con số 21 và 34 ở đó là số đồ đạc/kích thước của bộ thật bị gán nhầm sang trục/phòng. Đừng chép số của `coloring.test.ts` làm "bộ mẫu chuẩn" | `domain/spatial/__fixtures__/sampleBuilding.ts:36-38`, `lib/coloring/__tests__/coloring.test.ts:34-38,91`, `legend.test.ts:106` |
| A15 | Định dạng số xảy ra ở viewmodel, không ở view. Dấu thập phân là **dấu phẩy** | `project.js:57`, `gizmo.ts:417` |

---

## Mục B — chuyển động, ngôn ngữ định danh, chỗ đặt tính toán

- **Thang chuyển động có đúng năm giá trị: 120, 180, 260, 340, 700 ms.** Không con số nào
  khác. `tailwind.config.ts:14` và `hooks/useListReview.ts:102` đều dẫn luật này; nguồn
  duy nhất là `MOTION_DURATIONS_MS` trong `src/lib/motion/tokens.ts`.
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
- **`src/i18n/vi.json` không phải bảng dịch lúc chạy.** Chuỗi viết thẳng bằng tiếng Việt;
  file đó là **từ điển để kiểm tra**, dùng bởi `lib/testing/expectVietnamese.ts:25-31`.

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
