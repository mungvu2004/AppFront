# S12-B1 — Báo cáo sửa 19 mục "trong phạm vi" của màn S-12 "Duyệt lớp tường"

Nhiệm vụ **B1**. Nhánh `mungvu2004/s12-b1-sua`, gốc `6031c2b` (merge của A2 + A4).
Ngày đo: 01-09-2026. Đầu vào thẩm quyền: **mục A** của `docs/contracts/S12-L1-doi-chieu.md`.

---

## 0. Ba cổng — kết quả nguyên văn tại HEAD của nhánh này

```
$ pnpm typecheck
> tsc --noEmit
(exit 0)                                   → 0 lỗi typecheck

$ pnpm lint
> eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0
(exit 0)                                   → 0 lỗi + 0 cảnh báo lint

$ pnpm test
 Test Files  206 passed (206)
      Tests  4290 passed (4290)
   Duration  101.73s
```

**0 lỗi typecheck · 0 lỗi + 0 cảnh báo lint · 206/206 file, 4290/4290 test.**

Số nền là 4266; **+24 bài kiểm mới**, không bài kiểm nào bị xoá, không `.skip`, không `.only`.

### Dãy đếm bàn phím — in nguyên văn từ `useWallLayerReview.test.ts`

```
dãy đếm lên:    12, 13, 14, 15, 16, 17
dãy đếm xuống:  16, 15, 14, 13, 12
```

### Năm phép nghiệm thu

| # | Phép | Kết quả |
|---|---|---|
| 1 | Duyệt 5 tường bằng bàn phím → 12…17, rồi `Ctrl+Z` ×5 → 16…12 | **đạt**, dãy in ở trên |
| 2 | `grep -rn "Math\." src/screens/qc/WallLayerReview/` | **rỗng** (exit 1) |
| 3 | `expectSevenStates` 7/7 · `expectAccessible` 7/7 · `expectVietnamese` 7/7 · `expectNoRawColor` | **đạt cả bốn** |
| 4 | Chú giải độ dày luôn hiện khi lớp Tường bật | **đạt** — `[NGHIEM-2]` 7/7, cộng một bài kiểm mới bấm THẬT nút con mắt |
| 5 | Ba độ dày phân biệt được khi che hết chữ | **đạt** — `[NGHIEM-3]` ba token khác nhau, `[NGHIEM-4]` tỉ lệ 1:2:3 |

---

## 1. Mười chín mục — trạng thái từng mục

| Mục | Trạng thái | Ghi chú ngắn |
|---|---|---|
| A-01 | **xong** | Khối điều hướng tầng, lối ra qua `ROUTES.project.walls` |
| A-02 | **xong** | Ô "Hiện tim tường"; hành vi cũ thành giá trị khởi tạo |
| A-03 | **xong** | Ba công cụ nối vào máy công cụ; nhãn đo thật |
| A-04 | **xong một nửa** | Ctrl-bấm xong; **khoanh vùng CHƯA làm** — xem §3 |
| A-05 | **xong** | `heightLabel` → `"3.000,00 mm"` |
| A-06 | **xong** | Toast hoàn tác qua `appNotificationBus`, không qua `Toast.Provider` — xem §2.1 |
| A-07 | **cố ý không sửa** | Giữ bộ mẫu; xem §3 |
| A-08 | **xong** | `Badge` cho độ dày và cho "cần chú ý" |
| A-09 | **xong** | Nút con mắt của hàng cây lớp "Tường" |
| A-10 | **xong** | `attentionDotPx` dựng ở hook bằng `centreOfBounds` |
| A-11 | **giữ nguyên có chủ đích** | Không sửa mã, không "dọn dẹp" chú thích lý do |
| A-12 | **xong cả ba vế** | Đúng sự kiện, trường riêng + token + `duration-340`, và TỰ TẮT |
| A-13 | **xong** | Ngưỡng 0,70 theo quyết định của người duyệt — xem §2.2 |
| A-14 | **xong theo phương án (a)** | Xoá chuỗi ở mã; khoá `vi.json` giữ lại — xem §2.3 |
| A-15 | **xong cả bốn chuỗi** | Mã đi theo `vi.json` |
| A-16 | **xong cả hai vế** | Giữ ảnh gốc + đúng nguồn lỗi — xem §2.4 |
| A-17 | **xong** | Bộ đếm đổi sang token "đã xác minh" ở trạng thái Xong |
| A-18 | **xong** | Nút "Thu gọn hai panel" cuối ray công cụ |
| A-19 | **xong** | "nối đoạn" đứng trước "đo"; hai nhánh vai Người xem giữ nguyên |

**18/19 xong trọn vẹn, 1 mục (A-04) xong một nửa và ghi rõ.** A-13 nhận được quyết định
"dùng ngưỡng 0,70" từ điều phối viên trong lúc chạy (`msg_ed683a36a472`) và đã làm.

---

## 2. Bốn quyết định cần người duyệt biết

### 2.1 A-06 — toast đi qua `notificationBus`, KHÔNG qua `Toast.Provider`

Mục A-06 chỉ đường "dùng `useToast` / `Toast.Provider` có sẵn". Bản đầu làm đúng như vậy,
rồi bài kiểm lộ ra một chuyện: **`Toast.Provider` mang thêm một cầu nối riêng tới
`useUndoableToast`** (`Toast.tsx:168-180`), thứ tự phát một toast cho **mọi** lượt `commit()`
và gắn vào nút "Hoàn tác" của nó `useStore.temporal.getState().undo()` — tức ngăn xếp
**zundo**, không phải ngăn xếp 100 bước của S-06 mà màn này dùng.

Hệ quả đo được (nhìn thấy trong DOM lúc chạy bài kiểm): một lượt xoá cho **hai** toast, và
cái thứ hai hoàn tác bằng một ngăn xếp khác, để lại `dispatchBundle.history` lệch pha — lần
`Ctrl+Z` kế tiếp sẽ hoàn tác thêm một bước nữa.

Đường đúng đã có sẵn và không cần miễn trừ nào: `appNotificationBus` +
`NotificationHost` (`src/main.tsx:66`), vẽ bằng chính `Toast.Item`, và nút "Hoàn tác" của nó
gọi `undoTicket.undo()` — đúng vé `createWallUndoTicket` dựng. Tiền lệ:
`ProcessingScreen/useProcessingScreen.ts`. Hook nhận thêm tuỳ chọn `notifications?: NotificationBus`
để bài kiểm tiêm bus riêng.

**Nợ ngoài phạm vi phát sinh:** `Toast.Provider` hoàn tác bằng zundo là một cái bẫy cho MỌI
màn bọc nó (`App.tsx`, `AccountSettings`, `ProjectDashboard`). `src/components/**` nằm ngoài
phạm vi lượt này.

### 2.2 A-13 — ngưỡng 0,70, và nó sửa một chỗ lệch chưa ai ghi

Ngưỡng cũ là `confidenceLevel(...) !== 'certain'` (dưới 0,90). Nhưng canvas gạch chéo theo
`materialMap.isLowConfidence`, vốn **đã là** `needsReview` (dưới 0,70). Nên trước lượt này
**canvas và danh sách nói hai chuyện khác nhau về cùng một tường**: một tường 0,80 bị gạch
trong danh sách và không gạch trên bản vẽ. Đổi sang `=== 'needsReview'` vừa theo đúng quyết
định 0,70, vừa gom hai bên về một nguồn — có bài kiểm khẳng định hai tập tường trùng nhau.

Hai chú thích đếm nhầm đã đếm lại: **sáu** tường của bộ mẫu dưới 0,70 (W-004, W-007, W-010,
W-017, W-021, W-033), ba tường còn lại (W-014 0,71 · W-026 0,72 · W-041 0,74) nằm trong băng
`suggested` nên vẫn là `attention` trong danh sách mà **không** bị gạch chéo.

### 2.3 A-14 — chọn (a), nhưng khoá `vi.json` KHÔNG bị xoá

Mục A-14 phương án (a) nói xoá cả hai chuỗi: ở mã **và** ở `vi.json:1418`. Phần 4 của nhiệm
vụ nói `src/i18n/vi.json` **"chỉ THÊM khoá; không xoá"**. Luật hẹp hơn thắng: chuỗi ở mã đã
xoá, khoá `wallLayerReview.shortcuts.approve` để nguyên. Một khoá thừa trong từ điển kiểm
tra là vô hại (nó không phải bảng dịch lúc chạy), nhưng **cần một lượt xoá của người duyệt**
để từ điển thôi mô tả một phím không tồn tại.

### 2.4 A-16 — thêm `readWallLayer` vào cổng của chính màn

Vế (2) nói "nếu không có đường đọc lớp tường nào hỏng được thì ghi lại và chỉ làm vế (1)".
Chỉ làm vế (1) thì **không đủ**: kịch bản `error` ép trạng thái bằng `failReadBackground`,
tức giết chính ảnh gốc mà nó khẳng định là còn xem được, nên "giữ lượt đọc thành công gần
nhất" không có gì để giữ ở lượt đọc đầu tiên.

Nên `WallLayerReviewGateway` — **cổng của chính màn, nằm trong danh sách trắng, và mục A-16
liệt kê đích danh "`wallLayerReviewGateway.ts` (cổng giả)"** — nhận thêm `readWallLayer`.
Cổng thật trả lại đúng `graph.read()` (**không bịa endpoint nào**; `WALL_LAYER_MISSING_ENDPOINTS`
giữ nguyên); cổng giả có cờ `failReadWallLayer`. Hook đọc nó dưới `queryKeys.space.byFloor` —
đúng khoá `invalidationMap.editWall` đã dọn sau mỗi lượt ghi.

Kết quả: trạng thái `error` nay **có ảnh bản vẽ gốc**, và "ảnh nền hỏng" không còn bị đọc
thành "lớp tường hỏng". Cả hai đều có bài kiểm.

---

## 3. Việc CHƯA làm, và vì sao

### A-04 vế khoanh vùng (marquee) — CHƯA LÀM

Ctrl/Cmd-bấm đã xong ở cả canvas lẫn danh sách, và `toolRail.canMerge` bật thật (có bài kiểm
gọi tới `wall.merge` và đếm tường giảm đi một). **Khoanh vùng thì chưa**: `src/lib/selection/marquee.ts`
có sẵn, nhưng nối nó cần một lớp theo dõi CỬ CHỈ KÉO trên canvas (pointerdown → move → up,
kèm hình chữ nhật đang kéo vẽ lên `<svg>`), tức một hợp đồng props thứ hai và một lớp trạng
thái mà lượt này chưa dựng. Mục A-04 cho phép đúng điều này: *"Nếu B1 chỉ làm được vế Ctrl-bấm
mà chưa làm khoanh vùng thì ghi rõ, đừng báo xong cả hai."*

### A-07 — cố ý KHÔNG đổi bộ mẫu

Theo đúng khuyến nghị của mục A-07. Lưới toạ độ của bộ mẫu là một mặt bằng khép kín; đổi
W-014 từ 2.500 mm sang 4.250 mm sẽ phá `resolveWallShapes` ở bốn nút giao và làm đỏ
`[NGHIEM-4]`. Con số 4.250 mm của đặc tả là **ví dụ minh hoạ**, không phải một bất biến.

### `types.ts` — chỉ sửa CHÚ THÍCH, không sửa kiểu

Mục A-05 hỏi có sửa chú thích ví dụ `"3,00 m"` ở `types.ts:268` không. **Đã không sửa file
đó**: nó tự khai "ĐÓNG BĂNG kể từ lúc lớp L1 xong". Chú thích ấy nay nói sai đơn vị. Đề nghị
người duyệt cho một lượt sửa chú thích riêng, hoặc chấp thuận sửa tại chỗ ở lượt sau.

### Ba mục B (ngoài phạm vi) — KHÔNG CHẠM

Không một dòng nào của `src/lib/**`, `src/api/**`, `src/domain/**`, `src/store/**`,
`src/components/**`, `src/routes/**` bị sửa. `src/routes/router.tsx` không cần chạm: màn đã
có `WallLayerReviewRoute` và mọi lối ra mới đều tra `ROUTES`.

---

## 4. Ba chỗ đáng sửa PHÁT HIỆN THÊM — ghi lại, KHÔNG sửa kèm

Theo luật làm việc #1.

### 4.1 `WallLayerList` — ảo hoá không bao giờ vẽ một hàng nào trong jsdom

`findScrollParent` chạy trong một `useEffect` và ghi vào `scrollParentRef`; ghi một ref
**không** kích hoạt lượt render mới, nên `useVirtualizer` gọi `getScrollElement()` lần đầu
lúc ref còn `null` và không bao giờ hỏi lại. Đo được: `screen.queryAllByRole('option').length`
là **0** ở cả bảy trạng thái, kể cả sau khi tiêm `ResizeObserver` báo khổ thật và ép
`getBoundingClientRect`. Hệ quả kép:

- không bài kiểm DOM nào (kể cả `expectAccessible`) từng nhìn thấy một hàng danh sách;
- trên trình duyệt, ảo hoá chỉ chạy nhờ một lượt render tình cờ đến sau.

Vì thế **A-08 (chip) và A-12 (nháy nền) không có bài kiểm DOM** — hai mục đó được đo ở tầng
hook (cờ `flashingWallId` bật đúng sự kiện và tự tắt) và bảo đảm bằng `expectNoRawColor` +
typecheck. Cách sửa: cho `scrollParentRef` thành `useState` thay vì `useRef`. **Nằm trong
`src/screens/**` nhưng KHÔNG nằm trong mục A**, nên không sửa kèm.

### 4.2 `Toast.Provider` hoàn tác bằng zundo

Xem §2.1. Ở `src/components/feedback/Toast.tsx` — ngoài phạm vi R-68.

### 4.3 `WallLayerList` gọi `getComputedStyle` trong một vòng lặp lên DOM

`findScrollParent` đi ngược cây và gọi `getComputedStyle` mỗi bậc. Không sai, nhưng nó là lý
do §4.1 khó thấy. Ghi lại để lượt sửa §4.1 dọn luôn.

---

## 5. Một hành vi mới cần người duyệt gật đầu

**Một lượt bấm bằng công cụ tách đoạn cắt luôn tại chỗ bấm.** `SPLIT_WALL_TOOL` hỏi hai bước
(tường, rồi điểm cắt). Trong màn, lượt bấm lên một đa giác tường trả lời bước `entity` qua
`onSelect`, rồi cùng sự kiện đó nổi bọt lên `<svg>` và trả lời bước `point` — nên một lần
bấm là tách xong, tại đúng chỗ con trỏ (điểm được `perpendicularFoot` chiếu xuống tim tường).

Đây là cử chỉ tự nhiên hơn hai lần bấm và không bịa một phép hình học nào, nhưng nó **bỏ qua
câu gợi ý "Chấm vị trí nhát cắt trên tim tường"** của bước hai. Nếu người duyệt muốn đúng hai
bước, sửa đúng một chỗ: bỏ nhánh `entity` trong `onSelect` và thêm một hàm chọn tường riêng
cho canvas.

Cùng lý do đó, **không có `onCanvasCommit`/`onCanvasCancel` riêng** trên hợp đồng canvas: hook
chốt ngay khi cử chỉ đủ bước, và huỷ là đổi công cụ (phím `V` hoặc ray công cụ). Thêm hai prop
mà không nơi gọi nào truyền là đúng thứ R-73 chặn.

---

## 6. Phạm vi file — xác nhận

```
$ git diff --name-only 6031c2b...HEAD     # đúng bốn commit của B1
src/i18n/vi.json
src/screens/qc/WallLayerReview/**         (16 file)
```

Không một đường dẫn nào ngoài danh sách trắng Phần 4. `vi.json` **chỉ thêm sáu khoá**
(`row.attention`, `filters.showCentrelines`, `tools.collapsePanels`, `tools.expandPanels`,
`layerTree.showWalls`, `layerTree.hideWalls`, `aria.floorNav`) — không xoá khoá nào, không
chạm khoá của màn khác.

> `git diff --name-only mungvu2004/s12-a2-doi-chieu...HEAD` có thêm
> `docs/contracts/S12-L1-no-ngoai-pham-vi.md`. Đó là hồ sơ A4 mà **điều phối viên đã gộp
> vào nhánh này** ở `af3683b`, không phải thay đổi của B1.

## 7. Bốn commit

```
0a82ab7 fix(s12): tầng dữ liệu của màn — ngưỡng, đơn vị, tâm chấm, nguồn lỗi, số đo
b832750 fix(s12): hook — nối cử chỉ vào máy công cụ, chọn nhiều, toast, ba cờ còn thiếu
4459b0f fix(s12): view — bốn điều khiển chưa từng được dựng, chip độ dày, thứ tự ray
7c69433 test(s12): mỗi hành vi vừa nối có một phép đo, và hai bài kiểm cũ nói lại cho đúng
```

Chia theo VAI TRÒ file để dễ đọc. **Chỉ HEAD là trạng thái xanh**: ba commit đầu là các mảnh
của một thay đổi cài răng lược (hợp đồng ↔ hook ↔ view), nên chúng không dùng để `git bisect`.

## 8. R-70 — hai bài kiểm cũ đổi khẳng định, và vì sao đó không phải nới điều kiện

1. **`heightLabel`: `'3,00 m'` → `'3.000,00 mm'`** (A-05). Chuỗi mới **chặt hơn** chuỗi cũ,
   không lỏng hơn: nó khẳng định thêm cả đơn vị lẫn số chữ số thập phân. Đây là đổi đặc tả
   hiển thị, đúng thứ mục A-05 yêu cầu.
2. **"lỗi lớp tường vẫn để ảnh gốc xem được"** — đổi **cách ép** trạng thái, không đổi điều
   kiện. Tiêu đề bài kiểm vốn đã nói đúng điều đặc tả đòi; bản trước ép bằng
   `failReadBackground`, tức giết chính ẢNH GỐC mà nó đang khẳng định là còn xem được, rồi
   chỉ đo `canvas.shapes` thay cho ảnh. Bản mới ép bằng `failReadWallLayer` và **thêm** phép
   đo đúng thứ phải đo (`backgroundImageUrl` khác `null`), cộng một bài kiểm thứ hai khẳng
   định ảnh nền hỏng KHÔNG bị đọc thành lớp tường hỏng.

Không bài kiểm nào bị xoá, nới, `.skip` hay `.only`.
