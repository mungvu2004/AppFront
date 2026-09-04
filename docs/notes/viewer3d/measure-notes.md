# Ghi chú `scripts/measure-viewer3d.mjs` — T7

Đọc trước: `docs/notes/viewer3d/three-contract.md` (chữ ký thật của mọi hàm/hằng số
script này gọi).

## Chạy thế nào

```sh
node scripts/measure-viewer3d.mjs                 # mặc định: 30s quay + 5 vòng vào/rời
node scripts/measure-viewer3d.mjs --duration-s 5 --cycles 2   # chạy nhanh khi gỡ lỗi
node scripts/measure-viewer3d.mjs --path=/viewer3d # khi màn Viewer3D thật đã lên route
node scripts/measure-viewer3d.mjs --headed         # mở cửa sổ Chrome thật để xem
node scripts/measure-viewer3d.mjs --help           # đủ mọi tuỳ chọn + mặc định
```

Script tự mở `vite --host` nếu `--base-url` (mặc định `http://127.0.0.1:5173`) chưa có
ai lắng nghe, và tự tắt lại khi đo xong. Nếu bạn đã có `pnpm dev` chạy sẵn ở cổng đó,
script dùng lại, không mở thêm.

Thoát mã `0` khi cả hai phép đo đạt ngưỡng, `1` khi có phép đo không đạt hoặc không kết
luận được (renderer là phần mềm — xem mục "GPU thật hay phần mềm" bên dưới).

## Vì sao chạy được mà không cần màn Viewer3D tồn tại

Script không mở màn Viewer3D — nó mở **bất kỳ trang nào** trên dev server Vite (mặc
định `/`, tức bảng chọn màn demo ở `src/App.tsx`, vì đó là route duy nhất tồn tại lúc
viết script này), rồi tự dựng scene ngay trong trang đó bằng `import()` động tới đúng
các hàm thật:

- `src/domain/units/types.ts` (`millimetres`)
- `src/lib/three/build/floor.ts` (`buildFloorMesh`, `SLAB_THICKNESS_MM`)
- `src/lib/three/perf/materialCache.ts` (`MaterialCache`, `paintByPartKind`)
- `src/lib/three/perf/monitor.ts` (`PerfMonitor`)
- `src/lib/three/perf/dispose.ts` (`disposeFloor`, `ResourceLedger`)
- `src/lib/three/perf/budget.ts` (`SCENE_BUDGET`, `measureScene`, `readRenderInfo`)

Vite dev-serve mọi file `.ts` theo URL tuyệt đối, nên `import('/src/lib/...')` chạy
được thẳng trong `page.evaluate`, không cần build trước và không cần màn nào mount các
hàm này. Khi màn Viewer3D thật lên route riêng, truyền `--path` để mở đúng route đó —
không bắt buộc, vì script không đọc gì từ màn cả.

`three` được nhập qua `/@id/three` — endpoint nội bộ của Vite dev để lấy đúng bản đã tối
ưu hoá (`node_modules/.vite/deps/three.js?v=...`), **cùng một bản** mà mọi file
`src/lib/three/**` cũng nhận khi chúng viết `import ... from 'three'`. Nhập thẳng
`/node_modules/three/build/three.module.js` sẽ được một bản ba.js KHÁC (module instance
khác) — `instanceof` giữa hai bản không khớp, và các hàm nội bộ dựa vào đó (ví dụ
`paintByPartKind`'s `object instanceof Mesh`) sẽ âm thầm bỏ qua mọi thứ script này tạo
ra. Đã xác minh thủ công bằng cách so hash `?v=` giữa hai đường dẫn trước khi viết script
chính thức.

## Ý nghĩa từng con số

### Phép đo 1 — quay liên tục 30 giây

- **fps nhỏ nhất / trung bình**: lấy từ `PerfMonitor.onSample`, mỗi mẫu là một cửa sổ
  500 ms (`SAMPLE_INTERVAL_MS`, không phải fps tức thời từng khung hình — số tức thời
  nhiễu hơn nhiều và không phải thứ `checkBudget`/R-04 dùng để quyết định hạ chất
  lượng). `PerfMonitor.read` gọi `readRenderInfo(renderer.info, graphicsMemoryMb)` —
  tức số **draw call/tam giác renderer THẬT SỰ vẽ** ở khung hình đóng cửa sổ đó (sau
  frustum culling), không phải số ước lượng từ việc đi bộ qua scene.
- **Ngưỡng đạt**: `SCENE_BUDGET.minFrameRate.desktop`, đọc trực tiếp từ
  `src/lib/three/perf/budget.ts` lúc chạy (script KHÔNG gõ lại số 45 ở đâu cả) — nếu ai
  đó đổi ngân sách sau này, script tự theo mà không cần sửa.
- **draw call / tam giác mẫu cuối**: chỉ để tham khảo quy mô cảnh, KHÔNG so với
  `SCENE_BUDGET.maxDrawCalls` (150) / `maxTriangles` (900.000) — cảnh ở đây cố tình
  KHÔNG gộp lưới (xem mục "Cố tình không dùng LOD/gộp lưới" bên dưới) nên chắc chắn vượt
  150 draw call (mô hình 4 tầng × 110 mesh/tầng = 440 draw call không gộp); so với ngân
  sách đó ở đây sẽ luôn đỏ và vô nghĩa.
- **Bộ nhớ đồ hoạ ước lượng**: `measureScene(scene).graphicsMemoryMb`, tính một lần
  trước khi quay (hình học không đổi trong lúc quay vì không dùng LOD) — chính module
  ghi rõ đây là **ước lượng** (tổng byte buffer + texture, cộng 1/3 cho mipmap), không
  phải số driver báo, vì WebGL không cung cấp số đó.

### Phép đo 2 — vào/rời màn 5 lần

Mỗi "vòng": dựng cả 4 tầng (mới hoàn toàn, không tái dùng mesh vòng trước) → tô màu qua
`paintByPartKind` với một `MaterialCache` sống suốt cả 5 vòng (mô phỏng viewer thật giữ
một cache vật liệu cho cả phiên) → `ledger.track()` từng tầng → đọc `ledger.counts`
("sau khi vào") → gọi `disposeFloor(floorGroup, { materials: cache })` cho từng tầng
("rời màn") → đọc lại `ledger.counts` ("sau khi rời").

- Cột "sau khi vào" > 0 mỗi vòng chứng minh việc dựng hình THẬT SỰ xảy ra mỗi vòng (nếu
  không, một bảng toàn số 0 sẽ trông giống "không rò rỉ" nhưng thực ra vì có gì được
  dựng đâu).
- Cột "sau khi rời" bằng 0 (hình học) và về lại y hệt giữa các vòng (vật liệu — ở đây
  cũng về 0 vì mỗi vòng giải phóng đúng số tham chiếu đã lấy) chứng minh
  `disposeFloor`/R-05 thật sự chạy và không để sót.
- Kết luận "không leo thang": so cột "sau khi rời" của mỗi vòng với vòng 1; vòng sau lớn
  hơn vòng 1 ở bất kỳ loại tài nguyên nào là rò rỉ.
- `textures` luôn 0 trong cả hai phép đo: script tô vật liệu bằng màu phẳng
  (`MeshStandardMaterial({ color })`), không gán texture map nào — bản dựng ở
  `src/lib/three/build/**` cũng không gán texture (đó là việc của `src/lib/three/present`
  cho nhà mẫu trình diễn, ngoài phạm vi ngân sách T7).

## GPU thật hay phần mềm

Script mở **Chrome cài sẵn trên máy** (`channel: 'chrome'`, không phải Chromium đóng gói
của Playwright) kèm cờ `--use-gl=angle --use-angle=d3d11 --ignore-gpu-blocklist` để
headless Chrome vẫn chạm GPU thật qua ANGLE/Direct3D11, rồi xác nhận bằng
`WEBGL_debug_renderer_info` (`UNMASKED_RENDERER_WEBGL`). Trên máy viết script này,
renderer đọc được là:

```
ANGLE (Intel, Intel(R) UHD Graphics (0x0000468B) Direct3D11 vs_5_0 ps_5_0, D3D11)
```

Nếu máy khác không có Chrome hệ thống, script tự lùi về Chromium đóng gói của
Playwright — **rất nhiều khả năng renderer khi đó là SwiftShader (phần mềm)**. Script
luôn kiểm chuỗi renderer trả về, và nếu thấy `swiftshader`/`llvmpipe`/`software`/
`microsoft basic render`, nó:

- in rõ dòng "Nguồn số đo: PHẦN MỀM ... — số dưới đây KHÔNG kết luận được về hiệu năng
  GPU thật",
- không tuyên bố "ĐẠT" cho phép đo 1 dù fps đo được có cao đến đâu (mã thoát vẫn 1),
- vẫn in đủ số (không giấu), vì "không kết luận được" khác "không đo được".

Số đo thật trên máy này (Chrome hệ thống, cờ ANGLE, 30 giây, mặc định): fps nhỏ nhất
≈ 115, fps trung bình ≈ 144 (ngưỡng đạt ≥ 45) — xa ngưỡng vì cảnh 440 draw call đơn giản
(hộp/tấm phẳng, không texture) là rất nhẹ cho một GPU tích hợp hiện đại; đây KHÔNG phải
lý do để tin fps màn Viewer3D thật cũng cao như vậy (xem mục dưới).

## Cố tình không dùng LOD/gộp lưới — vì sao đây là ngân sách xấu nhất, không phải tốt nhất

`three-contract.md` cảnh báo (mục CẠM BẪY #1): gộp lưới (`mergeByMaterial`) không hiểu
cấu trúc `LOD` — nếu gộp cả ba rung của `buildFloorLod` lại làm một batch, cả ba rung sẽ
vẽ đồng thời thay vì đúng một rung theo khoảng cách camera, tức dùng sai cả hai module
cùng lúc. Viết đúng sự phối hợp LOD + gộp lưới (gộp riêng từng rung, giữ `LOD` chọn rung)
là việc của màn/hook thật, không phải của một script đo — làm ẩu ở đây có nguy cơ cho ra
số đẹp giả tạo hoặc gãy khó phát hiện.

Vì vậy script luôn dựng cả 4 tầng ở rung `'full'` (gọi thẳng `buildFloorMesh`, không qua
`buildFloorLod`) và không gộp draw call nào (440 draw call cho 4 tầng × 110 mesh/tầng,
so với ngân sách gộp lưới thật `SCENE_BUDGET.maxDrawCalls = 150`). Đây là **ngân sách
xấu nhất có chủ đích**: một màn Viewer3D thật dùng `buildFloorLod` (giảm chi tiết khi xa)
+ `mergeByMaterial` (gộp draw call theo vật liệu) chỉ có thể **bằng hoặc nhanh hơn** con
số này, không bao giờ chậm hơn. fps đo được ở đây vẫn đạt xa ngưỡng 45 dù là kịch bản
xấu nhất, nhưng **không suy ra được** màn thật (có LOD + gộp lưới, có thêm nội thất/vật
liệu phức tạp hơn từ `src/lib/three/present`) cũng sẽ đạt — số đó phải đo lại trên chính
màn thật khi nó tồn tại, bằng cách trỏ `--path` vào route của nó.

## Bộ mẫu hình học dùng để đo

48 tường / 14 phòng / 34 ô mở mỗi tầng × 4 tầng — chép lại đúng bộ mẫu chuẩn của gói
dựng hình ba chiều, `buildQueue.test.ts` (`WALL_COUNT`/`OPENING_COUNT`/`ROOM_COUNT` ở đó
là 48/34/14). **Đây KHÔNG phải** bộ mẫu "34 phòng và sảnh 248,60 m²" mà A14 nói tới
(`src/lib/coloring/__tests__/coloring.test.ts`) — bộ đó phục vụ kiểm tra tô màu/diện
tích, không phải dựng hình ba chiều; hai bộ mẫu phục vụ hai mục đích khác nhau và không
nên lẫn vào nhau. Tường của mỗi tầng dịch cao độ theo tầng
(`baseElevationMm`/`topElevationMm` = tầng × (3000 mm + `SLAB_THICKNESS_MM`)); phòng và
ô mở dùng chung giữa các tầng vì chỉ mô tả hình dạng mặt bằng/vị trí trên tường, không
mang cao độ tuyệt đối.

## Những gì phép đo này KHÔNG chứng minh được

1. **Không đo màn Viewer3D thật.** Không có LOD, không gộp lưới, không nội thất/vật liệu
   từ `src/lib/three/present`, không tương tác chuột/bàn phím, không camera director/đung
   đưa thật. Đây là benchmark của riêng gói `build/`+`perf/`, ở kịch bản xấu nhất.
2. **Không đo trên thiết bị di động/GPU yếu.** `SCENE_BUDGET.minFrameRate.mobile` (30)
   không được kiểm ở đây; script luôn dùng `profile: 'desktop'`.
3. **Không đo hành vi hạ chất lượng của R-04.** `PerfMonitor.onDegrade` không được lắng
   nghe/áp dụng ở đây (cảnh quá nhẹ để chạm ngưỡng hạ chất lượng 30 fps
   `DEGRADE_FRAME_RATE`) — việc màn thật có thực sự áp dụng `onDegrade` lên
   `LOD.levels`/`renderer.shadowMap.type` hay không phải kiểm bằng test riêng của màn/hook
   đó (unit test dựng `PerfMonitor` với `read` giả lập tần số thấp), không phải bằng
   script đo hiệu năng thật này.
4. **`graphicsMemoryMb` là ước lượng**, không phải số VRAM driver báo (WebGL không cung
   cấp số đó — chính `budget.ts` ghi rõ điều này).
5. **Không đo trên trình duyệt/hệ điều hành khác.** Số renderer/fps ở trên là của một
   máy Windows với Intel UHD Graphics cụ thể; máy khác (GPU rời, laptop khác, CI không có
   Chrome hệ thống) sẽ cho số khác — có thể rơi vào nhánh "phần mềm, không kết luận
   được" nếu không có Chrome hệ thống.
6. **Không đo trải nghiệm người dùng thật** (mất bao lâu để quay/thu phóng/tìm phòng cho
   một người chưa dùng CAD) — việc đó cần người thật ngồi thử, xem
   `docs/notes/viewer3d/usability-script.md`.
