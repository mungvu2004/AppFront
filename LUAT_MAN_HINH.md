# LUAT_MAN_HINH.md — Luật và quy trình dựng 47 màn

**Phạm vi:** mọi công việc dưới `src/screens/**`, và mọi lượt chạy prompt trong bộ 47 màn.
**Quan hệ với tài liệu khác:** file này **nối tiếp** RULE.md, đánh số từ **R-59**. Toàn bộ
R-01 → R-58 vẫn có hiệu lực đầy đủ; file này chỉ thêm phần RULE.md chưa phủ.

**Thứ tự ưu tiên khi ba tài liệu nói khác nhau:**

```
LUAT_MAN_HINH.md  →  RULE.md  →  CLAUDE.md  →  prompt màn hình
```

Prompt xếp cuối vì nó viết trước khi repo có hình dạng như hôm nay. Prompt bảo làm một
đằng mà luật bảo một nẻo thì **theo luật, rồi báo lại để sửa prompt** — đừng im lặng chọn bên.

---

## Phần 0 — Cổng tiên quyết

Chưa qua đủ sáu mục dưới đây thì **không được chạy bất kỳ prompt màn nào**. Chạy sớm chỉ
tạo ra màn phải làm lại.

```bash
# 1. Vỏ ứng dụng đã dựng: router, dữ liệu, chuyển động
rg "RouterProvider|QueryClientProvider|MotionProvider" src/main.tsx src/App.tsx

# 2. Nhóm endpoint xác thực đã có (nếu màn cần đăng nhập)
rg "auth" src/api/endpoints.ts

# 3. Ranh giới lỗi đã chốt đúng một bản
rg "ScreenErrorBoundary" src --files-with-matches

# 4. Bộ khẳng định dùng chung còn nguyên
ls src/lib/testing/expect{SevenStates,Accessible,Vietnamese,NoRawColor}.ts

# 5. Cổng tổng chạy được
pnpm verify

# 6. Luật ESLint thứ tám đã cài (xem Phần 3)
rg "no-data-layer-in-view" eslint-rules/configs/project.js
```

Mục nào đỏ thì sửa mục đó trước. Đừng miễn trừ, đừng ghi chú "sẽ làm sau".

---

## Phần 1 — Luật (R-59 → R-72)

Định dạng giống RULE.md: **Vì sao · Đúng · Sai · Kiểm bằng · Mức**.

---

### R-59 — Một màn gồm đúng sáu file, đặt tại `src/screens/<area>/<Name>/`.

`index.ts` · `<Name>.tsx` · `use<Name>.ts` · `<Name>.container.tsx` ·
`<Name>.stories.tsx` · `<Name>.test.tsx`

- **Vì sao:** Sáu file này không phải nghi thức. Mỗi file gỡ một ràng buộc: view tách ra
  thì test được từ props và dựng được story; hook tách ra thì logic test được không cần
  DOM; container tách ra thì có chỗ gắn ranh giới lỗi. Gộp lại là mất cả ba.
- **Đúng:** `src/screens/auth/AuthScreen/` — đã tách view / container / hook. Đây là khuôn
  gần nhất hiện có; kiểm xem đã đủ `index.ts` chưa và bổ sung nếu thiếu.
- **Sai:** `src/screens/project/ShareScreen.tsx` (460 dòng) + `hooks/useShareLinks.ts` —
  khuôn hai file cũ, hook nằm ngoài thư mục màn. **Đây là nợ đã ghi nhận, không phải mẫu
  để chép.** Nó cũng đang vi phạm R-22 (>400 dòng) nên sẽ phải tách lại.
- **Kiểm bằng:** với mỗi thư mục màn, `ls` phải ra đúng sáu tên trên.
- **Mức:** BẮT BUỘC

---

### R-60 — `<Name>.tsx` là view thuần: không import `src/api`, `src/store`, `src/domain`, `src/lib/http`.

- **Vì sao:** Đây là luật quan trọng nhất của cả tầng màn hình. View chạm được tầng dữ
  liệu thì story không dựng nổi nếu thiếu provider, test phải giả lập cả hệ thống, và
  logic bắt đầu rò ngược vào JSX. Bảng ranh giới tầng hiện tại để `src/screens/**` trống
  ở cột cấm — nghĩa là **hiện không có gì chặn**, phải bổ sung.
- **Đúng:** view nhận toàn bộ dữ liệu và hàm xử lý qua props; mọi thứ khác do
  `use<Name>.ts` và container cung cấp.
- **Sai:** chưa đo được trước khi luật ESLint bật. Chạy lệnh ở Phần 4 để có số thật.
- **Kiểm bằng:** `local/no-data-layer-in-view` — luật ESLint thứ tám, xem Phần 3.
- **Mức:** BẮT BUỘC

---

### R-61 — `use<Name>.ts` chỉ nối lại logic đã có; không chứa công thức tự chế.

- **Vì sao:** Diện tích, căn tầng, va chạm, tỉ lệ, quy đổi đơn vị đều đã nằm trong
  `src/domain` và có test đạt ngưỡng 90%. Viết lại trong hook nghĩa là tạo bản thứ hai
  không test, và hai bản sẽ lệch nhau vào lúc bạn không để ý.
- **Đúng:** hook gọi hàm của `src/domain`, `src/lib`, `src/store`, `src/lib/query` rồi
  ghép kết quả lại.
- **Sai:** bất kỳ phép tính hình học, làm tròn, hay quy đổi đơn vị nào viết mới trong
  thư mục màn.
- **Kiểm bằng:** `local/no-raw-number` (đã có, chặn `toFixed`/quy đổi) + soi tay khi review.
- **Mức:** BẮT BUỘC

---

### R-62 — `<Name>.container.tsx` bọc màn bằng `ScreenErrorBoundary` của `src/components/feedback`.

- **Vì sao:** Không có ranh giới thì một ngoại lệ ở component con làm trắng cả trang —
  đúng thất bại mà bất biến A11 sinh ra để chặn. Repo có **hai** cài đặt cùng tên; bản
  đang được gắn trong `src/App.tsx` là bản ở `src/components/feedback`.
- **Đúng:** `src/App.tsx` — bọc màn đang hiện, có `key={activeScreen}` để ranh giới gắn
  lại mỗi lần đổi màn, phần dự phòng dựng bằng `EmptyState` từ `report.description`.
  Màn thật chép đúng khuôn đó.
- **Sai:** dùng `src/lib/screen-state/screenErrorBoundary.ts`. Bản đó chưa được gắn ở đâu;
  trước khi có màn thật nào dùng nó, mặc định là **không dùng**. Nếu prompt bảo lấy bản
  P-05 ở `src/lib/screen-state` thì prompt sai — theo luật này và báo lại.
- **Kiểm bằng:** `rg "<ScreenErrorBoundary" src/screens` — số kết quả bằng số màn.
- **Mức:** BẮT BUỘC *(nâng từ R-55, vốn ở mức NÊN)*

---

### R-63 — Mỗi màn đi qua `expectSevenStates`, và có đủ bảy story tương ứng.

Bảy trạng thái: `Rỗng` · `Đang tải` · `Một phần` · `Lỗi` · `Xong` · `Không có quyền` · `Thu gọn`.

- **Vì sao:** Bất biến A11 nói màn trắng là thất bại duy nhất nó tồn tại để chặn. Repo đã
  viết sẵn `expectSevenStates` (138 dòng) và `sevenStateScenarios`; màn không đi qua thì
  khoản đầu tư đó không bảo vệ được gì.
- **Đúng:** `src/lib/testing/expectSevenStates.ts` + `sevenStateScenarios.ts`;
  `AuthScreen.container.tsx` đã xử lý theo A11.
- **Sai:** tự khai `isLoading` / `isError` rời rạc rồi tự dựng nhánh hiển thị.
- **Kiểm bằng:** `rg "expectSevenStates" src/screens` phải khớp số màn; `pnpm test`.
- **Mức:** BẮT BUỘC *(nâng từ R-50, vốn ở mức NÊN)*

---

### R-64 — Trạng thái máy chủ cắm vào `src/lib/query` và `src/lib/mutations`; không dựng lại.

- **Vì sao:** Hai thư mục đó là tầng logic **đã hoàn thành theo kế hoạch**, có test đầy
  đủ và tính vào ngưỡng độ phủ 80% của `src/lib`. Chưa màn nào gọi tới chỉ vì chưa có màn
  thật nào được dựng. Màn thật đầu tiên phải cắm vào, không dựng bản thứ hai.
- **Đúng:** dùng `queryKeys`, `cachePolicy`, `invalidation`, `createOptimisticMutation`
  đã có.
- **Sai:** `hooks/useShareLinks.ts` tự viết `isLoading` / `error` / `cancelled` bằng tay.
  **Ngoại lệ đi trước, không phải khuôn mẫu.** Chép nó là vi phạm.
- **Kiểm bằng:** `rg "useState.*[Ll]oading|useState.*error" src/screens` phải rỗng.
- **Mức:** BẮT BUỘC *(nâng từ R-09, vốn ở mức NÊN)*

---

### R-65 — Không có chuỗi bắt đầu bằng `/` hay `http` trong `src/screens/**`.

- **Vì sao:** Đây là hình dạng cụ thể của ca hard-code đã xảy ra một lần. Đường dẫn API
  sống ở `src/api/endpoints.ts` (R-07). Đường dẫn điều hướng lấy từ hằng `ROUTES` trong
  `src/routes.tsx`. Chuỗi rải rác trong màn là loại lỗi chỉ lộ ra lúc chạy, và lộ ở môi
  trường khác với môi trường bạn thử.
- **Đúng:** `src/api/endpoints.ts` — mỗi đường dẫn là một hàm có kiểu trả về, gom trong
  `ENDPOINTS ... as const`.
- **Sai:** `navigate('/du-an/' + id)`, `http.post('/api/v1/auth/login', ...)`.
- **Kiểm bằng:** `rg "['\"\`](/|https?://)" src/screens` → phải rỗng.
- **Mức:** BẮT BUỘC

---

### R-66 — Màn mới phải đăng ký trong `src/routes.tsx` và thay đúng `<Placeholder>` của nó.

- **Vì sao:** `routes.tsx` hiện khai sẵn 28 route, 17 trong đó còn là `<Placeholder>`.
  Màn dựng xong mà không thay chỗ giữ chỗ thì nó tồn tại nhưng không ai tới được, và lần
  sau sẽ có người dựng lại nó lần nữa.
- **Đúng:** thêm route trỏ tới container của màn, xoá `<Placeholder>` tương ứng, và bổ
  sung hằng đường dẫn vào `ROUTES`.
- **Sai:** để lại `<Placeholder>` bên cạnh route mới.
- **Kiểm bằng:** `rg "Placeholder" src/routes.tsx` — số phải giảm đúng một sau mỗi màn.
- **Mức:** BẮT BUỘC

---

### R-67 — Chuỗi hiển thị mới phải được thêm khoá vào `src/i18n/vi.json`.

- **Vì sao:** `vi.json` **không phải bảng dịch lúc chạy** — chuỗi vẫn viết thẳng bằng
  tiếng Việt trong JSX. Nó là **từ điển kiểm tra** mà `expectVietnamese` dùng để soát chữ
  mất dấu và tiếng Anh sót lại. Không thêm khoá nghĩa là chuỗi mới lọt lưới soát, im lặng.
- **Đúng:** `lib/testing/expectVietnamese.ts` đọc `vi.json` làm từ điển đối chiếu.
- **Sai:** thêm nhãn mới trong JSX mà không đụng `vi.json`.
- **Kiểm bằng:** `expectVietnamese` trong `<Name>.test.tsx`.
- **Mức:** BẮT BUỘC

---

### R-68 — Khi dựng màn, chỉ được sửa ba nơi.

Được sửa: `src/screens/<area>/<Name>/**` · `src/routes.tsx` · `src/i18n/vi.json`.
Cấm chạm: `src/lib/**` · `src/domain/**` · `src/store/**` · `src/api/**` ·
`src/components/**` · `eslint-rules/**` · `CLAUDE.md` · `RULE.md`.

- **Vì sao:** Tầng logic đã có test đạt ngưỡng 90% / 80%. Sửa nó trong lúc dựng màn nghĩa
  là đổi nền móng để cho vừa cái đang xây bên trên — thứ sẽ làm hỏng các màn đã dựng xong
  mà không ai phát hiện tới tận lượt hồi quy.
- **Đúng:** cần một hàm chưa có ở tầng logic thì **dừng và đề xuất một prompt logic mới**
  (xem R-69), không tự thêm.
- **Sai:** thêm một hàm nhỏ vào `src/domain` "cho tiện", sửa một component chung để hợp
  với màn đang làm.
- **Kiểm bằng:** `git diff --name-only` trước khi mở PR — mọi đường dẫn phải nằm trong
  ba nhóm được phép.
- **Mức:** BẮT BUỘC

---

### R-69 — Thiếu logic thì DỪNG và hỏi; không tự chế, không stub, không TODO.

- **Vì sao:** Đây là nguyên nhân gốc của ca hard-code đã xảy ra. Agent gặp hàm không tồn
  tại, không có đường thoát nào được phép, nên chọn đường rẻ nhất là viết thẳng vào màn.
  Luật này mở cho nó một đường thoát hợp lệ: dừng lại.
- **Đúng:** in ra tên file và tên hàm còn thiếu, đề xuất mã prompt logic cần bổ sung
  (ví dụ nhóm `T` cho endpoint, nhóm `M` cho phép đo), rồi dừng chờ trả lời.
- **Sai:** viết bản tạm, tạo stub, đặt `TODO` rồi đi tiếp, hoặc chọn bừa một cách rồi
  báo là xong.
- **Kiểm bằng:** `rg "TODO|FIXME|stub" src/screens` → phải rỗng. R-58 (cấm báo "đạt" cho
  bước chưa chạy) áp luôn ở đây.
- **Mức:** BẮT BUỘC

---

### R-70 — Không làm vừa lòng bài kiểm thử.

- **Vì sao:** Test đỏ nghĩa là code sai **hoặc** đặc tả sai. Cả hai trường hợp đều cần
  người quyết, không phải nới điều kiện. Ngưỡng độ phủ cũng vậy: số thấp hơn ngưỡng thì
  viết thêm test, không hạ ngưỡng.
- **Đúng:** dữ liệu test lấy từ `src/lib/testing` (`fixtures`, `fakeClock`,
  `sevenStateScenarios`, `render`) và `src/api/mocks/client.ts`.
- **Sai:** sửa test cho khớp code, nới điều kiện khẳng định, thêm `.skip` / `.only`, trả
  giá trị cố định để qua test, bịa dữ liệu mẫu tại chỗ.
- **Kiểm bằng:** `rg "\.(skip|only)\(" src` → rỗng (R-46); `git diff` không được chạm file
  test có sẵn ngoài phần thêm mới.
- **Mức:** BẮT BUỘC

---

### R-71 — Không hằng số viết tay trong màn.

Mã lỗi · thời gian chờ · số lần thử lại · tên khoá lưu trữ · ngưỡng số · thời lượng
chuyển động.

- **Vì sao:** Repo đã có nguồn cho từng loại: `MOTION_DURATIONS_MS` (đúng năm giá trị
  120/180/260/340/700), `MILLIMETRES_PER_METRE`, `DEFAULT_ROUNDING_STEP`, và tự lưu là
  800 ms cố định theo A7. Viết lại con số ở màn là tạo bản sao sẽ lệch.
- **Đúng:** `src/lib/motion/tokens.ts`, `src/domain/units`, `hooks/useAutosave.ts`.
- **Sai:** `setTimeout(fn, 800)` trong màn, `duration: 200`, `'appshell:left-collapsed'`
  viết thẳng.
- **Kiểm bằng:** `local/no-raw-duration`, `local/no-raw-number` (đã có, mức `error`).
- **Mức:** BẮT BUỘC

---

### R-72 — Màn phải đi qua `expectAccessible` và `expectVietnamese`.

- **Vì sao:** Bàn phím là đường đi hạng nhất theo A12, và Esc phải đóng lớp trên cùng —
  lời hứa không tính năng nào được lấy mất. Hai bộ khẳng định này (728 và 726 dòng) là
  cách duy nhất kiểm tự động được điều đó.
- **Đúng:** gọi cả hai trong `<Name>.test.tsx`; phím tắt đăng ký qua
  `src/lib/input/shortcutRegistry` (R-54).
- **Sai:** tự gắn `addEventListener('keydown')`; nút chỉ có biểu tượng mà thiếu `aria-label`.
- **Kiểm bằng:** `pnpm test`; `@storybook/addon-a11y` khi xem story.
- **Mức:** BẮT BUỘC

---

## Phần 2 — Quy trình chạy một prompt màn

Sáu giai đoạn. Không nhảy cóc.

### G1 — Cổng tiên quyết
Chạy sáu lệnh ở Phần 0. Đỏ chỗ nào, dừng chỗ đó.

### G2 — Kế hoạch, chờ duyệt
Agent **chưa được ghi file nào**. Trình bày sáu mục:
1. Sáu file sẽ sinh, mỗi file một dòng nói rõ trách nhiệm.
2. Danh sách hàm và hook sẽ gọi lại, kèm đường dẫn thật. **Phải mở file kiểm tra hàm có
   tồn tại không và dán lệnh đã dùng để kiểm.** Không đoán tên hàm.
3. Bảy trạng thái ánh xạ sang phần tử giao diện nào.
4. Khoá i18n sẽ thêm và câu tiếng Việt tương ứng.
5. Thứ tự viết file, lệnh kiểm sau mỗi bước.
6. Điểm chưa chắc chắn, hỏi theo mẫu ở G3.

Kết thúc bằng đúng một dòng `CHỜ DUYỆT`, rồi dừng.

> Mục 2 là chốt chặn quan trọng nhất của cả quy trình. Ca `/login` hard-code lẽ ra đã bị
> chặn ở đây: kiểm trước thì phát hiện `client.ts` không có nhóm auth, **trước khi** viết
> dòng code đầu tiên.

### G3 — Hỏi khi vướng
Sáu tình huống bắt buộc dừng: hàm không tồn tại hoặc sai chữ ký · component chung chưa có ·
đặc tả mâu thuẫn với luật · cần hằng số không rõ nguồn · muốn sửa file ngoài R-68 · test đỏ
mà cách sửa nhanh nhất là đổi test.

Mẫu câu hỏi, viết như giải thích cho người không đọc code:

```
1. ĐANG LÀM GÌ      — tên file, việc đang dở
2. VƯỚNG GÌ         — 2–3 câu đời thường, nói rõ hậu quả nếu làm sai
3. VÌ SAO KHÔNG TỰ QUYẾT ĐƯỢC — nêu điều luật hoặc thông tin còn thiếu
4. CÁC PHƯƠNG ÁN    — 2–3 phương án, mỗi cái đủ bốn dòng:
                      cách làm · được gì · mất gì · đụng file hoặc tầng nào
5. TÔI NGHIÊNG VỀ   — chọn một, lý do một câu
6. Dừng chờ trả lời
```

Gom hết câu hỏi vào **một lượt**, đánh số, để trả lời gọn kiểu `1-A, 2-B, 3-giữ nguyên`.
Cấm: chọn bừa rồi đi tiếp · làm cả hai phương án · viết bản tạm hứa sửa sau · im lặng bỏ qua.

### G4 — Dựng
Viết theo đúng kế hoạch đã duyệt. Lệch khỏi kế hoạch thì dừng, nói rõ lệch chỗ nào và vì
sao, chờ đồng ý. Mỗi lượt làm đúng một việc; thấy chỗ khác nên sửa thì ghi vào báo cáo,
không sửa kèm.

### G5 — Tự kiểm
Chạy khối lệnh ở Phần 4, dán **kết quả nguyên văn** vào phần trả lời. Rồi `pnpm verify`.

### G6 — Báo cáo
Bốn phần: (a) kế hoạch so với thực tế, lệch chỗ nào · (b) các câu hỏi đã hỏi và phương án
được chọn · (c) kết quả nguyên văn các lệnh kiểm · (d) việc còn nợ.

R-58 áp ở đây: **cấm báo "đạt" cho bước chưa chạy.**

---

## Phần 3 — Luật ESLint thứ tám

R-60 hiện không có gì thực thi. Chép khuôn `no-fetch-outside-http` đã có sẵn.

**Tên:** `local/no-data-layer-in-view`
**Áp cho:** `src/screens/**/*.tsx`, **trừ** `*.container.tsx`, `*.test.tsx`, `*.stories.tsx`
**Chặn:** import từ `src/api/**`, `src/store/**`, `src/domain/**`, `src/lib/http/**`
**Thông điệp lỗi (tiếng Việt, giống bảy luật đang có):**

> View thuần không được chạm tầng dữ liệu. Đưa việc này xuống `use<Name>.ts` rồi truyền
> kết quả vào view bằng props. (R-60)

**Sau khi thêm, bắt buộc chạy lại `pnpm install`** — pnpm sao chép cứng `eslint-rules/`
vào `node_modules/.pnpm/`, không cài lại thì ESLint vẫn đọc bản cũ và bạn sẽ tưởng luật
mình vừa viết không chạy (Bẫy số 1 trong CLAUDE.md).

**Sổ nợ:** nếu `ShareScreen.tsx` đỏ ngay, được miễn trừ **đúng file đó**, ghi vào sổ nợ
`project.js` kèm ngày và điều kiện gỡ. Danh sách đó chỉ được ngắn đi.

---

## Phần 4 — Khối lệnh kiểm cho mỗi màn

Thay `<area>/<Name>` rồi chạy. Dán nguyên kết quả vào báo cáo G6.

```bash
SCREEN=src/screens/<area>/<Name>

echo "R-59 sáu file:";        ls $SCREEN
echo "R-60 view chạm dữ liệu:"; rg "from '@/(api|store|domain|lib/http)" $SCREEN --glob '!*.container.tsx' --glob '!*.test.tsx' --glob '!*.stories.tsx'
echo "R-62 ranh giới lỗi:";   rg "<ScreenErrorBoundary" $SCREEN
echo "R-63 bảy trạng thái:";  rg "expectSevenStates" $SCREEN
echo "R-64 tự viết loading:"; rg "useState.*([Ll]oading|error)" $SCREEN
echo "R-65 đường dẫn thô:";   rg "['\"\`](/|https?://)" $SCREEN
echo "R-69 stub/nợ:";         rg "TODO|FIXME|stub|any\b" $SCREEN
echo "R-70 test bị tắt:";     rg "\.(skip|only)\(" $SCREEN
echo "R-71 hằng số thô:";     rg "setTimeout\([^,]*, *[0-9]|duration: *[0-9]" $SCREEN
echo "R-68 phạm vi sửa:";     git diff --name-only

pnpm verify
```

Sáu lệnh đầu phải **rỗng** (trừ `ls`, `<ScreenErrorBoundary` và `expectSevenStates` — ba
lệnh đó phải **có** kết quả).

---

## Phần 5 — Danh sách tự kiểm trước khi mở PR

- [ ] Đúng sáu file, đúng vai từng file (R-59)
- [ ] View không import `api` / `store` / `domain` / `lib/http` (R-60)
- [ ] Hook không chứa công thức tự chế (R-61)
- [ ] Container bọc `ScreenErrorBoundary` của `components/feedback` (R-62)
- [ ] `expectSevenStates` xanh, đủ bảy story (R-63)
- [ ] Dữ liệu máy chủ qua `lib/query` / `lib/mutations` (R-64)
- [ ] Không chuỗi bắt đầu bằng `/` hay `http` (R-65)
- [ ] Route đã đăng ký, `<Placeholder>` tương ứng đã xoá (R-66)
- [ ] Khoá mới đã thêm vào `vi.json` (R-67)
- [ ] `git diff --name-only` chỉ có ba nhóm được phép (R-68)
- [ ] Không `TODO` / stub; chỗ thiếu logic đã hỏi chứ không tự chế (R-69)
- [ ] Không sửa, nới, hay tắt test có sẵn (R-70)
- [ ] Không hằng số viết tay (R-71)
- [ ] `expectAccessible` + `expectVietnamese` xanh (R-72)
- [ ] `pnpm verify` xanh, kết quả dán nguyên văn vào PR (R-56, R-58)

---

## Phần 6 — Thứ tự chạy 47 màn

1. **S-01 AuthScreen làm màn mẫu.** Nó đã đi được phần lớn chặng đường, nên dùng nó để đo
   xem quy trình có chạy thật không: agent có dừng ở `CHỜ DUYỆT` không, có hỏi khi thiếu
   logic không, có tự chế đường dẫn không.
2. **Hiệu chỉnh luật và prompt theo những gì quan sát được ở màn mẫu.** Đây là lúc rẻ nhất
   để sửa. Sau màn thứ mười thì mọi sai sót đã nhân lên mười lần.
3. **Chạy theo cụm cùng khu vực** (`auth` → `project` → `viewer` → …), không chạy theo số
   thứ tự. Màn cùng khu vực dùng chung component và khoá i18n, làm liền nhau thì phát hiện
   thiếu sót sớm hơn.
4. **Cứ năm màn thì dừng lại chạy `pnpm verify` toàn repo một lượt.** Lỗi hồi quy phát
   hiện ở màn thứ sáu rẻ hơn nhiều so với phát hiện ở màn thứ bốn mươi.

---

**Phiên bản:** 1.0 · Luật mới thêm vào đây trước, rồi mới sửa prompt.
