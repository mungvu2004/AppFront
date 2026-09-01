# S-15 — Quyết định của điều phối viên

Đọc file này TRƯỚC khi viết mã. Mọi mục dưới đây đã được chốt; không tranh luận lại,
không tự chọn cách khác. Nếu bạn thấy một quyết định ở đây mâu thuẫn với thực tế mã
nguồn, DỪNG VÀ HỎI (`orca orchestration ask`) chứ đừng tự sửa quyết định.

---

## Q1 — Bốn lệnh trục không tồn tại ở tầng logic

`src/lib/commands/business/` chỉ có `wallCommands` · `openingCommands` ·
`roomFloorCommands`. Không có lệnh trục nào. R-68 cấm thêm file vào `src/lib` trong
lúc dựng màn.

**Quyết định: phương án A.** Bốn lệnh `axis.add` / `axis.remove` / `axis.move` /
`axis.setOrigin` được dựng TRONG `axisGridManagerGateway.ts` bằng nguyên thuỷ công
khai `createCommand` + `changeForUpdate`.

Hợp lệ vì đây đúng tiền lệ đã được duyệt một lần cho `wall.approve`
(`src/screens/qc/WallLayerReview/wallLayerReviewGateway.ts:482-508`): `CommandType`
là `string` mở, `validateCommands` chỉ kiểm `command.type` khác rỗng chứ không so với
bảng cho phép, và lệnh tự hoàn tác được vì `changeForUpdate` mang ĐỦ ảnh chụp
`before`/`after` mà `invertCommand` chỉ việc hoán đổi.

---

## Q2 — Đường dẫn route

Đặc tả gốc ghi `/du-an/:projectId/tang/:floorId/lop/truc`. Nhưng `src/routes/paths.ts`
viết đường dẫn bằng tiếng Anh toàn bộ, và `/tai-khoan` là ngoại lệ tiếng Việt DUY NHẤT
được ghi nhận trong chính JSDoc của file đó. LUAT_MAN_HINH xếp trên prompt.

**Quyết định:** thêm `projectGrids` = `/projects/:id/floors/:floorId/layers/grids`,
đúng khuôn `projectWalls` / `projectObjects`. Route `layerGrids` đang trỏ vào
`<RouteCanvas />` (một Placeholder) thì trỏ về màn mới, để số Placeholder giảm đúng
một theo R-66.

Lưu ý `src/routes.tsx` KHÔNG CÒN TỒN TẠI — nay là thư mục `src/routes/`. Màn nhập
`@/routes/paths`, không nhập `@/routes` (nhập sai gây vòng import, `pnpm cycles` đỏ).

---

## Q3 — Bốn lỗ hổng T1 báo ở mục G của `S15-T1-axes.contract.md`

T1 đã khảo sát và kết luận bốn thứ KHÔNG TÌM THẤY. Dưới đây là cách xử lý ĐÃ CHỐT cho
từng thứ. Nguyên tắc chung: **ráp từ nguyên thuỷ đã có, đặt trong cổng của màn, không
đụng `src/domain` và `src/lib`** — cùng một hình dạng với Q1.

### Q3.1 — Không có validator khoảng cách tối thiểu 100 mm giữa hai trục

T1 xác nhận `AXIS_ALIGNMENT_THRESHOLD_MM` (`detect.ts:46`) là ngưỡng GOM tường thành
một trục, **ngữ nghĩa khác hẳn**. Tái dùng nó cho việc này là sai.

**Quyết định:** khai một hằng riêng, có tên riêng, TRONG `axisGridManagerGateway.ts`:

```ts
/** Hai trục gần nhau hơn mức này thì bản vẽ không đọc được nữa — luật sản phẩm của
 *  màn S-15, không phải ngưỡng hình học của `src/domain`. Cố tình KHÔNG tái dùng
 *  AXIS_ALIGNMENT_THRESHOLD_MM: hằng đó gom tường thành trục, việc khác hẳn.
 *  Chuyển xuống `src/domain/axes` khi nào tầng logic có module lệnh trục thật. */
export const MIN_AXIS_SPACING_MM: Millimetres = millimetres(100);
```

Đây KHÔNG vi phạm R-71: R-71 cấm chép lại con số đã có nguồn (thời lượng chuyển động,
quy đổi đơn vị, khoá lưu trữ). Con số này chưa có nguồn nào trong repo, và đặt nó cạnh
chính hàm kiểm tra là cách duy nhất không phạm R-68. Tiền lệ cùng dạng đã có trong
`wallLayerReviewGateway.ts`: `MIN_WALL_LAYER_ZOOM`, `ZOOM_STEP`,
`WALL_LAYER_SAMPLE_DRAWING_WIDTH_MM` đều là hằng phạm vi màn khai trong cổng.

### Q3.2 — Không có hàm tính khoảng cách tới trục kế tiếp

**Quyết định: không cần hàm mới.** T1 đã chứng minh `verticalAxes()` / `horizontalAxes()`
(`detect.ts:250,255`) trả mảng đã sắp tăng dần theo `coordinateMm` — đó là hợp đồng, không
phải may mắn. Khoảng cách là một phép trừ hai toạ độ liền kề trong mảng đó.

Phép trừ này nằm ở HOOK hoặc CỔNG, không nằm ở view. Kết quả đưa vào view-model dưới
dạng chuỗi đã định dạng (A15). Đây không phải "công thức tự chế" theo R-61 — nó là đọc
đúng hợp đồng của `detectAxes`, không phải phát minh lại hình học.

### Q3.3 — Không có hàm dựng đường bao tầng để vẽ bóng ma

T1 xác nhận `src/domain` chỉ có KIỂU `BoundingBox`, không có hàm gấp N điểm thành hộp
bao; và cả BA màn QC đã dựng xong đều tự khai `boundsOfPoints` riêng trong cổng của
mình, có JSDoc biện minh cho việc trùng lặp có chủ ý.

**Quyết định: đi theo đúng tiền lệ ba màn kia.** Khai `boundsOfPoints` trong
`axisGridManagerGateway.ts`, kèm JSDoc nói rõ đây là bản thứ tư có chủ ý và vì sao
(không có primitive N-điểm ở `src/domain`, và R-68 cấm thêm vào đó lúc dựng màn).
KHÔNG nhập chéo từ cổng của màn khác — màn không phụ thuộc màn.

### Q3.4 — Không có hàm chuyển `FloorTransform` thành patch

**Quyết định: ráp trong cổng, và chính chỗ ráp này là thứ làm "căn tự động = một lệnh".**

Đường ráp, dùng toàn hàm đã có:
1. `alignFloors(floors)` → `FloorAlignmentReport` (M-11 tính lệch; **màn không tự tính**).
2. Với mỗi `FloorAlignment` không phải tầng gốc: `applyFloorTransform(point, transform)`
   (`alignFloors.ts:209`) dời từng điểm, `transformAxis(axis, transform)`
   (`alignFloors.ts:224`) dời từng trục.
3. Bọc mỗi kết quả thành `UpdatePatch<'wall'>` / `UpdatePatch<'axis'>`
   (`applyPatch.ts:32-37`).
4. Gom **toàn bộ** patch của **mọi tầng** vào ĐÚNG MỘT `Command` qua `createCommand` +
   `changeForUpdate`, rồi `commit(patches, label)` một lần.

Bước 4 là điều kiện nghiệm thu: một `Command` mang nhiều `Change` phải là MỘT bước lịch
sử. `.orca-notes/S15-T2-commands.contract.md` mục D trả lời dứt khoát câu này. **Nếu câu
trả lời của T2 là KHÔNG** (mỗi Change thành một bước), thì DỪNG VÀ HỎI ngay — đừng tự
nghĩ cách vòng, vì lúc đó cả yêu cầu "một lần Ctrl+Z" phải thiết kế lại.

---

## Nhắc lại ba điều dễ quên

- Màn **không tự sinh trục** (gọi `detectAxes`) và **không tự tính lệch tầng**
  (gọi `alignFloors`). Cấm tuyệt đối của đặc tả.
- Mọi độ lệch hiện đủ **cả pixel và milimét**, bằng chữ đều, dấu thập phân là dấu PHẨY.
- Thiếu logic thì DỪNG VÀ HỎI (R-69). Cấm stub, cấm TODO, cấm bịa hàm.
