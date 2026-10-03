# Bước 8 — bộ đổi dữ liệu Pascal ↔ AppFront: đã thi công gì, và cái gì chưa

2026-09-27, trên nhánh `mungvu2004/tich-hop-pascal`, ngay sau khi cổng T4.2 được người dùng mở với
phương án **A — xem + sửa** (`00-quyet-dinh.md`, bản 3).

Bước 8 là phần **duy nhất** của kế hoạch sau cổng không cần fork và không cần bản phát hành gói
Pascal: nó là mã thuần trong `src/lib/pascal`, đọc hợp đồng của Pascal chứ không gọi Pascal. Vì vậy
nó được làm trước, trong khi Bước 5 (thêm gói), Bước 6–7 (fork) và Bước 9 (màn xem) vẫn đứng sau một
bản phát hành chưa có.

---

## 1. Bảy tệp, và mỗi tệp trả lời một câu

| Tệp | Câu nó trả lời |
|---|---|
| `types.ts` | Cảnh Pascal có hình dạng gì, theo đúng tên trường của lược đồ 1.0.0 |
| `ids.ts` | `W-WALL0010` ↔ `wall_W-WALL0010`, và làm sao biết một node do ai đẻ |
| `toPascal.ts` | Đồ thị không gian → cảnh `{ nodes, rootNodeIds }`, kèm danh sách bỏ qua |
| `toSpatial.ts` | Cảnh → đồ thị không gian, **không** để dấu xác minh đi ngược chiều |
| `guard.ts` | Lượt ghi này có thật không, hay là một thay đổi ma |
| `fromPascal.ts` | Lượt ghi thật ấy đổi những gì → **một lệnh** có nhãn tiếng Việt |
| `diff.ts` | Bản vẽ đổi mà không do Pascal đổi: phần chênh nào phải đẩy sang |

**Chưa có nơi gọi nào, và đó là đúng thứ tự của kế hoạch.** Nơi gọi đầu tiên là T9.4 (khung nhúng),
và nó cần `mount()` thật. Bảy tệp này vì thế là hợp đồng đã chạy được, không phải mã chết: **58 bài
kiểm** gọi chúng — 51 ở `src/lib/pascal/__tests__`, 7 ở `eslint-rules/__tests__/pascalGate.test.ts`.

---

## 2. Bốn quy ước của Pascal đã tra từ mã gói, không đoán

Mỗi dòng dưới đây đọc từ `F:/pascal-spike/node_modules/@pascal-app/**`, và mỗi dòng là một chỗ sai
được thì sai im lặng — hình vẽ lệch mà không có lỗi nào nổ.

| Quy ước | Chỗ đọc được |
|---|---|
| Tường đặt gốc mesh tại `start`; con của tường đo `u` **từ đầu tường**, không từ giữa | `viewer/systems/wall/wall-system.js:827`, `core/store/actions/node-actions.js:815-826` |
| Ô mở đọc **tâm** ở cả hai trục: mép dưới là `position[1] - height / 2` | `wall-system.js:1215-1221` |
| Góc quanh trục `y` **đảo dấu** so với góc mặt bằng | `wall-system.js:828` (`setFromAxisAngle(yAxis, -angle)`) |
| Tầng **không** lưu cao độ tuyệt đối; `baseElevation` là phần cộng thêm vào vị trí xếp chồng | `core/services/storey.js:41-73` |
| Phòng (`zone`) gắn vào tầng bằng `parentId`, không bằng một trường `levelId` | `viewer/components/viewer/selection-manager.js:174` |
| `item.asset` là **bắt buộc**, và `asset.src` phải qua `AssetUrl` | `core/schema/nodes/item.js:143`, `core/schema/asset-url.js` |

Hai chỗ phải tự quyết vì AppFront không có dữ liệu tương ứng:

- **Đồ đạc không có chiều cao.** `Furniture.boundingBox` là hộp **mặt bằng** (`{min, max}` chỉ có
  `x`, `y`). Bản đầu vì thế viết `asset.dimensions = [rộng, 0, sâu]` — và **đó là một lỗi, không
  phải một sự chờ đợi**: `PreviewModel` (`nodes/item/renderer.tsx:521`) dựng
  `boxGeometry [w, h, d]`, nên một `item` cao 0 m không phải "đồ đạc phẳng" mà là đồ đạc **không
  nhìn thấy được**. Nay `FURNITURE_HEIGHT_MM` trong `toPascal.ts` giữ chiều cao **danh nghĩa** theo
  loại (bàn 750, tủ áo 2 000, …), còn cái thang lấy **chiều cao tầng thật** vì số ấy đồ thị CÓ lưu.
  Số danh nghĩa không thể nhiễm vào dữ liệu người dùng: lượt về dựng lại hộp bao từ
  `metadata.appfront.boundingBox`, và `boxAround` (`toSpatial.ts:294-302`) chỉ đọc `dimensions[0]`
  với `dimensions[2]`.
- **`asset.src` là chỗ giữ chỗ** `asset://appfront/<loại>`. Nó hợp lệ với lược đồ, nhưng không trỏ
  tới mô hình nào, nên Pascal rơi về `PreviewModel` — một khối hộp mờ đúng kích thước. Kèm với đó,
  `scale` phải khai đích danh `[1, 1, 1]`: `getScaledDimensions`
  (`core/schema/nodes/item.ts:210`) viết `const [sx, sy, sz] = item.scale`, và `setScene` không
  chạy zod nên mặc định của lược đồ không tới. Thiếu trường là `TypeError` giữa lượt render, bị
  ranh giới lỗi của Pascal nuốt — cảnh vẫn hiện, chỉ là **thiếu hẳn đồ đạc**.

Và một chỗ AppFront có dữ liệu nhưng bản đầu không viết ra:

- **Mỗi phòng nay ra HAI node.** `zone` là khối không gian — Pascal đọc nó để đếm phòng, gán công
  năng, tính thể tích — nhưng nó **không dựng ra mặt sàn nào**. Mặt sàn là node `slab`. Cảnh chỉ có
  `zone` thì nhìn xuống thấy nền trời. `slabNodeOf` dùng đúng đường bao của `zone`, đặt
  `elevation: 0` và `thickness: 0,05 m` để tấm sàn dày **xuống dưới** mặt phẳng tầng — tường và đồ
  đạc đều mọc từ 0, nên đó là cách duy nhất không chèn vào chân tường. Lược đồ Pascal mặc định
  `elevation: 0,05`; AppFront cố ý không mượn nó.

---

## 3. A5 — dấu xác minh, và hai lỗ đã bịt

Sổ tay ghi một câu đáng nhắc lại: *"mọi năng lực đi qua tường rời tầm với của ESLint vĩnh viễn — vì
vậy A5 không được phép trở thành một năng lực truyền qua đó."* Hai đường Pascal có thể đặt dấu xanh,
và cả hai đã đóng:

| Đường | Chỗ đóng | Bài kiểm |
|---|---|---|
| Node Pascal **tự đẻ** khai `metadata.appfront.reviewed = true` | `toSpatial.ts` chỉ tin siêu dữ liệu khi id node dịch ngược ra một id AppFront hợp lệ; id nanoid không qua được | `roundTrip.test.ts` — "phòng Pascal tự đẻ về với dấu xác minh TẮT" |
| Node **cũ của AppFront** bị sửa siêu dữ liệu bên kia tường | `fromPascal.ts` lấy ba trường duyệt từ ảnh chụp **trước** cho mọi lượt sửa | `edits.test.ts` — "Pascal sửa `reviewed` … thì lệnh KHÔNG mang dấu ấy về" |

Lỗ thứ hai không nằm trong kế hoạch; nó lộ ra khi viết lượt về, và hàng rào đặt ở **đường ghi** chứ
không ở lượt đọc — vì đường ghi chỉ có một.

---

## 4. Cổng lọc thay đổi ma: bốn luật, 0 con số thời gian

Kế hoạch ghi rõ *"không dùng biên 193 ms làm luật"*, nên `guard.ts` không có mốc giờ nào:

| Mã | Luật |
|---|---|
| `PASCAL_BEFORE_LOAD` | Chưa xác nhận nạp xong lần đầu thì không lượt ghi nào qua |
| `PASCAL_WHILE_LOADING` | Đang nạp thì không lượt ghi nào qua |
| `PASCAL_EMPTY_COMMIT` | Lượt ghi không nêu được node nào đã đổi |
| `PASCAL_MASS_DELETE` | Xoá từ 1/5 số đối tượng một tầng trở lên |

`guard.test.ts` không nhập đồng hồ giả nào — nếu một luật nào cần thời gian thì file ấy sẽ phải có
một lượt `advance`, và khi đó chính nó là lời tố giác.

Một điều đáng nói rõ cho Bước 9: **`PASCAL_MASS_DELETE` không có nghĩa "đây là thay đổi ma"**. Nó có
nghĩa "việc này lớn quá để đi im lặng". A9 đòi hành động không hoàn tác được phải hỏi trước, nên màn
hình bắt mã này rồi **mở hộp thoại**, chứ không nuốt lượt ghi. Ngưỡng 1/5 áp theo tỉ lệ đúng như kế
hoạch viết, nên trên một tầng nhỏ nó nổ sớm — đó là hành vi cố ý, không phải khuyết tật.

---

## 5. Nghiệm thu — từng dòng "Đạt khi" của kế hoạch, và bài kiểm chứng minh nó

| "Đạt khi" của kế hoạch | Bài kiểm | Kết quả |
|---|---|---|
| Nhà mẫu đổi qua rồi về vẫn đủ 4 tầng, 48 tường, 16 ô mở, 21 đồ đạc, 14 phòng | `roundTrip.test.ts` — "vẫn đủ 4 tầng…" | đạt |
| So **từng trường của từng phòng**: id, `areaM2`, dấu xác minh | `roundTrip.test.ts` — "so từng trường của từng phòng" | đạt |
| 100 vòng đổi qua đổi về lệch **0 mm** | `roundTrip.test.ts` — "một trăm vòng liền nhau lệch 0 mm" | đạt |
| Nạp qua Pascal rồi so lại: **0** thay đổi tự sinh | `edits.test.ts` — "nạp bản vẽ vào Pascal rồi đọc ngược ra: 0 lệnh" | đạt |
| Mở dự án rỗng → **0** lệnh | `edits.test.ts` — "dự án rỗng: 0 lệnh" | đạt |
| Độ phủ ≥ 80 % | `pnpm coverage`, ngưỡng `src/lib` | đạt — **96,99 %**, xem §6 |

Thêm ngoài danh sách, vì lượt về đòi: cao độ tầng giữ nguyên **kể cả khi các tầng không khít nhau**
(bài kiểm nhấc tầng trên cùng lên 12 000 mm — bỏ trống `baseElevation` thì nó trôi về 10 800), và góc
quay đồ đạc khép lại qua phép đổi độ ↔ radian.

---

## 6. Số đo của lượt chạy

Điền từ log thật, không ước lượng (E.10). Log: `F:/pascal-work/G4/log/`.

| Bước | Kết quả | Log |
|---|---|---|
| `src/lib/pascal` (bốn tệp kiểm) | **51/51**, 1,1 s — dưới jsdom lượt đầu mất 36 s | `t7-pascal-and-flake.txt` |
| `eslint-rules/__tests__/pascalGate.test.ts` | **7/7** | `t5-node-env.txt` |
| Độ phủ **của riêng `src/lib/pascal`** | **96,99 % câu lệnh · 89,76 % nhánh · 100 % hàm · 96,99 % dòng** (ngưỡng `src/lib` là 80) | `t12-cov2.txt` |
| `pnpm verify` — bảy bước | **7/7, mã thoát 0** · 7 247/7 247 bài kiểm · bốn cổng dung lượng đạt | `t14-verify5.txt` |

### Một tệp kiểm ngoài Pascal phải sửa, và tôi là nguyên nhân

Ba lượt `verify` đầu dừng ở bước 4 với **1 hỏng / 7 247**, ở một tệp không liên quan gì tới Pascal:
`src/screens/export/ShareDialog/ShareDialog.test.tsx` — *"Test timed out in 5000ms"*. Và **bài vượt
hạn đổi theo từng lượt** (hai bài khác nhau ở hai lượt liền nhau), dấu của một tệp ngồi sẵn ở mép
hạn chứ không phải một bài hỏng.

Ba phép đo, theo đúng luật "đổi đúng một biến":

| Điều kiện | Kết quả |
|---|---|
| Chạy **riêng** tệp ấy | **17/17 đạt**, `tests 4 059 ms` — tức 81 % hạn 5 000 ms mặc định |
| Cả bộ, `--coverage`, **có** bốn tệp kiểm của `src/lib/pascal` | tệp ấy **đỏ, 3/3 lượt** |
| Cả bộ, `--coverage`, **bỏ** bốn tệp ấy ra | **7 196/7 196 xanh** |

Nên nói thẳng: **thay đổi của đợt này làm nó đổ**, không phải máy. Nhưng bốn tệp kia chỉ tốn 0,19 s —
chúng không thêm tải đáng kể, chúng đổi cách vitest xếp tệp vào worker. Thứ đổ là một tệp đã ngồi ở
81 % hạn từ trước.

Sửa: một dòng `vi.setConfig({ testTimeout: 20_000 })` **trong chính tệp ấy**, kèm khối chú thích ghi
cả ba phép đo trên. Cái này không nới cổng chất lượng nào — mọi khẳng định giữ nguyên từng dòng, và
phạm vi là một tệp, không phải cả repo. Bản sửa gốc (nâng `testTimeout` cho toàn repo, trong
`vitest.config.ts` — một tệp nằm trong danh sách cấm đổi ngưỡng) đã có sẵn ở nhánh
`mungvu2004/debt-share`, commit `5367f9b`: chốt nó là việc của người duyệt.

---

## 7. Cái Bước 8 **không** làm

- **Trục định vị, kích thước, ghi chú không sang Pascal.** Lược đồ Pascal không có loại node tương
  ứng cho hai thứ đầu (`ConstructionDimensionNode` có, nhưng nó là kích thước **bản vẽ thi công**,
  không phải chuỗi kích thước đã dò của AppFront — quy sang là bịa dữ liệu). Cả ba vào `skipped` kèm
  lý do, và lượt về trả ba danh sách ấy **rỗng**: người gọi giữ bản cũ.
- **Không có `index.ts`.** Nhập theo module cụ thể, đúng như bẫy số 3 của `CLAUDE.md` dạy.
- **Chưa nối vào store hay màn hình nào.** `dispatch` nhận lệnh là việc của T9.4/T9.5.
- **Chưa chạy trên gói Pascal thật.** Mọi quy ước đọc từ mã gói 1.0.0 trong
  `F:/pascal-spike/node_modules`, và `pnpm` của AppFront **chưa** có `@pascal-app/*` — đó là T5.5.
  Ngày nào gói vào repo, phép kiểm thật là nạp `toPascalScene(...)` qua `validateBuildJson` của
  chính Pascal; bài kiểm hôm nay chứng minh hình dạng, không chứng minh lược đồ zod chấp nhận nó.
