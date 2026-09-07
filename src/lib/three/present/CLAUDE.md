# `src/lib/three/present` — tầng trình diễn

Nạp khi làm việc trong thư mục này. Bản tóm tắt một dòng nằm ở `CLAUDE.md` gốc.

**`src/lib/three/present` là tầng trình diễn** — biến một plan JSON thành mặt bằng 3D
cắt mở: tô vật liệu theo phòng/loại tường, mặt ngoài tường bao sơn xám (`dressing`),
cửa mở sẵn + khung cửa trắng + lan can thanh (`joinery`), len chân tường + chỉ trần +
bậu cửa + ngưỡng cửa lùa + dải tối chân tường (`trim`), nội thất thủ tục chia theo
phòng trong `pieces/` + `.glb` tải muộn có dự phòng (`catalogue`/`assets`/`placement`),
camera phối cảnh ống kính dài + đung đưa + khung hình cân theo phối cảnh (`director`),
đèn theo **ngân sách 8 đèn thật** — đèn nhỏ được "vẽ" thành vũng sáng cộng thêm
(`lighting.budgetLights`), AO nướng vào màu đỉnh lúc lắp (`occlusion`), normal map vẽ
bằng canvas cho sàn (`relief`), môi trường studio tự dựng qua PMREM (`environment`),
bóng tiếp xúc, và bước gộp mesh tĩnh + decal theo vật liệu (`merge`).
**Vòng vẽ theo nhu cầu** (`frameLoop` + `presence`): chỉ vẽ khi mô hình dịch đủ một
pixel, trần 30 fps, dừng hẳn khi tab ẩn / canvas ngoài màn / mất focus / reduced
motion; đèn key + shadow map tĩnh (camera quay quanh nhà, map vẽ đúng một lần);
`dispose()` trả cả GL context (`forceContextLoss`).
`mountPresentation(canvas, plan)` là cửa vào; `/login` chỉ là một người gọi
(`AuthScreen/houseScene.ts`) và **fetch bản vẽ như một asset** qua `loadPlan`
(`houseModel.json?url` — bản vẽ là nội dung, không nằm trong gói JS). Plan có ba
trường tuỳ chọn mà builder không có: `liftMm` (đồ đặt trên đồ khác, tranh trên tường),
`opensTowards` (phía cánh cửa mở), và `ceilingLights.positionsMm` (đèn rọi thêm cho
phòng dài). Mô hình `.glb` nén Draco cần `pnpm draco` (chép bộ giải mã vào
`public/draco/`, đã gitignore).
