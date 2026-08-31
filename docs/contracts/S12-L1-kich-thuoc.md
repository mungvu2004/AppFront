# A3 — Đo lại tại HEAD và quy phần đóng góp kích thước gói của màn S-12

Đo tại **HEAD = `ae7db031aee20787fc519c7007bb07fd01df4d63`**, nhánh
`mungvu2004/s12-a3-kich-thuoc` (từ `master`), cây làm việc sạch trước và sau khi đo.
Không sửa mã màn S-12, không sửa cấu hình dựng, không nới ngân sách.

Bốn phép đo đầu bảng dưới do điều phối viên đo ngay trước lượt này, ở đúng HEAD này;
năm phép còn lại do lượt này đo. Xem mục 7.10 và mục (d) món nợ số 7 của
`docs/contracts/T8-bao-cao-tich-hop.md` để biết vì sao `pnpm build`/`pnpm size` chưa
từng chạy trước lượt này.

---

## Bảng số nền tại HEAD `ae7db03`

| Phép đo | Kết quả tại `ae7db03` | Nguồn số |
|---|---|---|
| `pnpm typecheck` | exit 0 | điều phối viên đo, trước lượt này |
| `pnpm lint` | exit 0 (0 lỗi, 0 cảnh báo) | điều phối viên đo, trước lượt này |
| `pnpm test` | Test Files 206 passed (206) · Tests 4266 passed (4266) | điều phối viên đo, trước lượt này |
| dãy đếm bàn phím (nghiệm thu S-12) | 12,13,14,15,16,17 → 16,15,14,13,12 | điều phối viên đo, trước lượt này |
| `pnpm cycles` | Import vòng: không có | lượt này, mục 1 |
| `pnpm length` | 161 file đã quét · 18 vượt 250 · 0 vượt 400 | lượt này, mục 1 |
| `pnpm build` | thành công, exit 0 (~69 giây) | lượt này, mục 2 |
| `pnpm size` — tổng JS (gzip) | **578,8 KiB** / ngân sách 175 KiB → **VƯỢT 403,8 KiB** | lượt này, mục 2 |
| `pnpm size` — tổng CSS (gzip) | 9,3 KiB / ngân sách 12 KiB → đạt (còn dư 2,7 KiB) | lượt này, mục 2 |
| `pnpm size` — chunk JS lớn nhất (gzip) | 132,9 KiB / ngân sách 170 KiB → đạt (còn dư 37,1 KiB) — chunk này là `scene-WfNF36mG.js`, **không phải** chunk của S-12 | lượt này, mục 2 |
| ngân sách gzip (nguồn) | js 175 KiB · css 12 KiB · largestJsChunk 170 KiB | `scripts/check-bundle-size.mjs:35-47` |
| chunk `WallLayerReview` (gzip) | **30,2 KiB** (thô 91,1 KiB) — file `dist/assets/index-BvDLQvm7.js` | lượt này, mục 2 |

**Kết luận một câu:** màn S-12 đóng góp **30,2 KiB gzip** vào gói JS (chunk lazy riêng của
route), trong khi cổng kích thước gói tổng JS đang **đỏ, vượt ngân sách 403,8 KiB** — vượt
này lớn gấp gần **13,4 lần** đóng góp của riêng S-12, tức cổng đỏ **không phải do S-12 gây
ra**, mà do các chunk khác đã có sẵn ở `master` từ trước (xem danh sách đầy đủ ở mục 2 bên
dưới; ba chunk nặng nhất là `scene-WfNF36mG.js` 132,9 KiB, `index-C9rTj0ED.js` 113,9 KiB,
`EmptyState-B1kxPI2r.js` 58,1 KiB — tổng ba chunk này đã hơn 300 KiB, chưa kể phần còn lại).

---

## Việc 1 — Hai cổng còn thiếu

### `pnpm cycles` — nguyên văn

```
> app-front@0.0.0 cycles C:\Users\mxuan\orca\workspaces\AppFront\s12-a3-kich-thuoc
> node scripts/check-import-cycles.mjs

Import vòng (import/no-cycle) — quét src/

Import vòng: không có.
```
(exit 0)

### `pnpm length` — nguyên văn

```
> app-front@0.0.0 length C:\Users\mxuan\orca\workspaces\AppFront\s12-a3-kich-thuoc
> node scripts/check-file-length.mjs

Độ dài file component (dòng có nội dung) — nhắc 250, hỏng 400

  nhắc   390 dòng  src/screens/pipeline/ScaleCalibration/ScaleCalibrationCanvas.tsx
  nhắc   383 dòng  src/screens/pipeline/PipelineGraph/PipelineGraphDetail.tsx
  nhắc   367 dòng  src/components/ui/Table.tsx
  nhắc   367 dòng  src/screens/auth/AuthScreen/AuthScreen.tsx
  nhắc   358 dòng  src/screens/qc/WallLayerReview/WallLayerCanvas.tsx
  nhắc   357 dòng  src/screens/dashboard/ProjectDashboard/ProjectDashboard.tsx
  nhắc   346 dòng  src/components/ui/Select.tsx
  nhắc   346 dòng  src/screens/pipeline/CadBranchConfirm/CadBranchConfirm.tsx
  nhắc   318 dòng  src/screens/onboarding/WelcomeScreen/WelcomeScreen.tsx
  nhắc   311 dòng  src/screens/pipeline/PipelineGraph/PipelineGraphOverview.tsx
  nhắc   308 dòng  src/screens/upload/InputQualityGate/InputQualityGateReportPanel.tsx
  nhắc   299 dòng  src/screens/upload/InputQualityGate/InputQualityGateImageOverlays.tsx
  nhắc   292 dòng  src/components/shell/AppShell.tsx
  nhắc   289 dòng  src/screens/project/CreateProjectModal/CreateProjectModal.tsx
  nhắc   287 dòng  src/components/overlay/Drawer.tsx
  nhắc   276 dòng  src/screens/pipeline/CadBranchConfirm/CadLayerPreviewCanvas.tsx
  nhắc   269 dòng  src/screens/upload/FloorUploadScreen/FloorUploadCard.tsx
  nhắc   267 dòng  src/components/overlay/Modal.tsx

161 file đã quét · 18 vượt 250 · 0 vượt 400

Độ dài file: đạt.
```
(exit 0)

**Ba con số:** 161 file đã quét · 18 vượt 250 · 0 vượt 400. Ngưỡng hỏng (vượt 400) không
bị chạm — file lớn nhất trong màn S-12 là `WallLayerCanvas.tsx` với 358 dòng, ở mức "nhắc",
chưa "hỏng".

---

## Việc 2 — Kích thước gói và quy phần của màn

### `pnpm build` — kết quả

Chạy thành công, **exit 0**, ~69 giây. Rollup cảnh báo "some chunks are larger than 500 kB"
(không phải lỗi, chỉ là gợi ý code-splitting) — chunk đó là `scene-WfNF36mG.js`
(552,41 kB thô), không liên quan tới S-12.

### `pnpm size` — nguyên văn (kể cả khi đỏ)

```
> app-front@0.0.0 size C:\Users\mxuan\orca\workspaces\AppFront\s12-a3-kich-thuoc
> node scripts/check-bundle-size.mjs

Kích thước gói (gzip)

  scene-WfNF36mG.js                     132,9 KiB   (thô 539,5 KiB)
  index-C9rTj0ED.js                     113,9 KiB   (thô 353,9 KiB)
  EmptyState-B1kxPI2r.js                 58,1 KiB   (thô 195,2 KiB)
  index-BvDLQvm7.js                      30,2 KiB   (thô 91,1 KiB)
  houseScene-Da3Q2x9j.js                 18,9 KiB   (thô 51,1 KiB)
  index-zP6JKBf4.js                      14,5 KiB   (thô 43,9 KiB)
  GLTFLoader-DiasUgFH.js                 13,0 KiB   (thô 44,6 KiB)
  index-C70aSWrf.js                      12,4 KiB   (thô 36,1 KiB)
  index-0D2rAgPW.js                      12,2 KiB   (thô 37,4 KiB)
  index-DO0cfv7i.js                      11,3 KiB   (thô 33,5 KiB)
  index-BM1ooJQM.js                      11,3 KiB   (thô 33,9 KiB)
  index-H6upjWWy.js                      10,8 KiB   (thô 31,0 KiB)
  index-fjAozgcb.js                      10,6 KiB   (thô 32,1 KiB)
  index-CwkwRpZO.css                      9,3 KiB   (thô 48,3 KiB)
  ShareRoute-CQa_-OgM.js                  9,1 KiB   (thô 24,9 KiB)
  index-DVCo98rP.js                       7,9 KiB   (thô 22,3 KiB)
  index-CXlU2XQj.js                       7,8 KiB   (thô 23,4 KiB)
  index-CXzSSzWo.js                       7,7 KiB   (thô 22,4 KiB)
  CreateProjectModal.container-B2Ojuv8l.js      6,7 KiB   (thô 17,7 KiB)
  index-BVNCn3dM.js                       5,2 KiB   (thô 14,3 KiB)
  index-CTakyg9o.js                       4,9 KiB   (thô 12,0 KiB)
  processingGateway-DItEG6Bu.js           4,8 KiB   (thô 11,9 KiB)
  index-BRWL24gR.js                       4,0 KiB   (thô 12,7 KiB)
  client-DL-mUGBM.js                      3,3 KiB   (thô 8,5 KiB)
  useShortcut-C53pyMKh.js                 3,2 KiB   (thô 7,1 KiB)
  appClient-aV-aKT9K.js                   3,0 KiB   (thô 8,1 KiB)
  suspense-C_4s2XV3.js                    2,9 KiB   (thô 8,4 KiB)
  commit-Cf03uKbq.js                      2,8 KiB   (thô 6,6 KiB)
  Select-Bu9zjh4H.js                      2,6 KiB   (thô 6,5 KiB)
  DRACOLoader-8WcOlCfd.js                 2,5 KiB   (thô 6,1 KiB)
  registry-CDEl3Bck.js                    2,5 KiB   (thô 6,0 KiB)
  Table-zvP_Q4cn.js                       2,2 KiB   (thô 5,8 KiB)
  validate-D3dQMk-1.js                    2,2 KiB   (thô 4,5 KiB)
  Modal-BpYoopYb.js                       2,1 KiB   (thô 4,7 KiB)
  alignFloors-Bb5BmMq1.js                 1,9 KiB   (thô 4,9 KiB)
  sender-BHC3n5w9.js                      1,9 KiB   (thô 4,3 KiB)
  validate-B5a13KrA.js                    1,8 KiB   (thô 4,4 KiB)
  useContextMenu-BftIqEoa.js              1,8 KiB   (thô 4,0 KiB)
  Tabs-CC6E6-yd.js                        1,5 KiB   (thô 3,2 KiB)
  NumericField-BuZhfK-5.js                1,4 KiB   (thô 3,1 KiB)
  toViewModel-CkTgjHgn.js                 1,4 KiB   (thô 2,9 KiB)
  index-B57pgniy.js                       1,4 KiB   (thô 4,5 KiB)
  Tooltip-CZnvaZCP.js                     1,2 KiB   (thô 2,8 KiB)
  SegmentedControl-B_eH0aSN.js            1,2 KiB   (thô 2,4 KiB)
  useMutation-Caj89Jxi.js                 1,2 KiB   (thô 2,8 KiB)
  useSaveIndicator-BJlljev6.js            1,2 KiB   (thô 2,5 KiB)
  scale-DN-LvWGV.js                       1,1 KiB   (thô 2,7 KiB)
  Textarea-mElcUsre.js                    1,1 KiB   (thô 2,2 KiB)
  Skeleton-Dsg2FZdQ.js                    1,1 KiB   (thô 2,8 KiB)
  ZoomCluster-O8q6uiRu.js                 1,0 KiB   (thô 2,2 KiB)
  Input-Cr8XPzd-.js                       1,0 KiB   (thô 2,2 KiB)
  snap-D8U0ZWGt.js                        1,0 KiB   (thô 1,9 KiB)
  Checkbox-BlorjdAI.js                    0,9 KiB   (thô 1,7 KiB)
  Toggle-B_WPkkj6.js                      0,9 KiB   (thô 1,9 KiB)
  ScreenErrorBoundary-CXnf5nQa.js         0,9 KiB   (thô 1,6 KiB)
  useCountUp-aLkJIw8e.js                  0,8 KiB   (thô 1,8 KiB)
  SaveIndicator-DpUtl-DN.js               0,8 KiB   (thô 1,5 KiB)
  datetime-DiFkU6ED.js                    0,8 KiB   (thô 1,6 KiB)
  Avatar-B-0Nz6eK.js                      0,8 KiB   (thô 1,6 KiB)
  useCanvasViewport-Bdi9dWUx.js           0,8 KiB   (thô 1,5 KiB)
  IconButton-C19ysHJj.js                  0,7 KiB   (thô 1,2 KiB)
  useQuery-DNCN6kPY.js                    0,6 KiB   (thô 1,0 KiB)
  FieldRow-BUlt7lz2.js                    0,5 KiB   (thô 1,1 KiB)
  transition-BtCjFduR.js                  0,5 KiB   (thô 1,0 KiB)
  announcer-sPJimP3u.js                   0,5 KiB   (thô 0,9 KiB)
  queryKeys-DkvNbriM.js                   0,4 KiB   (thô 1,0 KiB)
  image-off-CdOSJwCR.js                   0,4 KiB   (thô 0,6 KiB)
  Badge-BPzEXy2Z.js                       0,4 KiB   (thô 0,7 KiB)
  invalidation-C7y7iInT.js                0,4 KiB   (thô 1,1 KiB)
  trash-2-DiBk7iqv.js                     0,3 KiB   (thô 0,5 KiB)
  copy-BZGes-Dm.js                        0,3 KiB   (thô 0,6 KiB)
  minus-DDtTWa5n.js                       0,3 KiB   (thô 0,7 KiB)
  measure-Cr3L-qed.js                     0,3 KiB   (thô 0,7 KiB)
  permissions-CniLNmNN.js                 0,3 KiB   (thô 0,9 KiB)
  inbox-DnNVOEUN.js                       0,3 KiB   (thô 0,4 KiB)
  materialMap-BxErndl6.js                 0,3 KiB   (thô 0,7 KiB)
  stagger-DW5I9Jra.js                     0,3 KiB   (thô 0,5 KiB)
  lock-cO7tyjSm.js                        0,3 KiB   (thô 0,4 KiB)
  semantic-Cw-TsYHt.js                    0,3 KiB   (thô 0,3 KiB)
  types-C4s0q2fE.js                       0,3 KiB   (thô 0,3 KiB)
  compare-DA_WLLm0.js                     0,3 KiB   (thô 0,5 KiB)
  search-D91uB1oc.js                      0,3 KiB   (thô 0,3 KiB)
  ellipsis-D3rxw1q1.js                    0,3 KiB   (thô 0,4 KiB)
  x-D7VEGXlI.js                           0,2 KiB   (thô 0,3 KiB)
  plus-k2OGwGDe.js                        0,2 KiB   (thô 0,3 KiB)
  chevron-up-Dhop7VsS.js                  0,2 KiB   (thô 0,3 KiB)
  chevron-down-BcPrusA2.js                0,2 KiB   (thô 0,3 KiB)
  check-Zpy8oFD5.js                       0,2 KiB   (thô 0,3 KiB)
  orchestrate-hqJ6HSad.js                 0,2 KiB   (thô 0,2 KiB)
  platform-DIfHJwPx.js                    0,2 KiB   (thô 0,2 KiB)
  entityQueue-C5g65MjL.js                 0,2 KiB   (thô 0,2 KiB)
  limits-tOuPg0Xb.js                      0,1 KiB   (thô 0,2 KiB)
  useSession-uBo5okZ8.js                  0,1 KiB   (thô 0,1 KiB)
  zIndex-C24SOtE8.js                      0,1 KiB   (thô 0,0 KiB)

  VƯỢT  tổng JS                 578,8 KiB /  175 KiB (quá 403,8 KiB)
  đạt   tổng CSS                  9,3 KiB /   12 KiB (còn dư 2,7 KiB)
  đạt   chunk JS lớn nhất       132,9 KiB /  170 KiB (còn dư 37,1 KiB)

Vượt ngân sách kích thước gói: tổng JS.
Tách chunk, bỏ dependency, hoặc lazy-load màn hình. Không nới ngân sách để cho qua.
```
(exit 1 — **đỏ, đúng như đã biết trước ở master; không sửa gì để làm nó xanh.**)

Ngân sách đọc từ `scripts/check-bundle-size.mjs:35-47`:
```js
const BUDGETS_KIB = {
  js: 175,
  css: 12,
  largestJsChunk: 170,
};
```

### Quy phần đóng góp của màn S-12

**1) Danh sách chunk kèm thô/gzip** — bảng đầy đủ ở trên, do chính `pnpm size` in ra (nó
tự tính gzip bằng `zlib.gzipSync` — `scripts/check-bundle-size.mjs:74`). Đối chiếu độc lập
hai cách khác nhau trên đúng file nghi là của S-12:

```
$ gzip -c dist/assets/index-BvDLQvm7.js | wc -c
30810

$ node -e "
const { gzipSync } = require('zlib');
const { readFileSync } = require('fs');
const buf = readFileSync('dist/assets/index-BvDLQvm7.js');
console.log('raw bytes:', buf.length);
console.log('gzip bytes:', gzipSync(buf).length);
"
raw bytes: 93330
gzip bytes: 30924
```
`gzip` CLI (mức nén mặc định, có header khác) ra 30810 byte; `zlib.gzipSync` của Node
(đúng hàm mà `pnpm size` dùng) ra 30924 byte = 30,2 KiB, khớp con số trong bảng
`pnpm size` ở trên (30,2 KiB / thô 91,1 KiB — 93330 byte ≈ 91,1 KiB). Chênh lệch giữa
hai công cụ là do khác cách nén/metadata, không phải sai số đo; số dùng để báo cáo là số
của `pnpm size` (`zlib.gzipSync`), vì đó là số cổng CI thực sự chặn.

**2) Xác định chunk nào là của `WallLayerReview` — chứng minh, không đoán:**

```
$ rg -l "WallLayerReview|wallLayer" dist/assets/*.js
dist/assets/index-BvDLQvm7.js
dist/assets/index-C9rTj0ED.js
```

Hai chunk cùng khớp tên module. Phân biệt bằng cách grep một chuỗi tiếng Việt chỉ màn
này có (`PANEL_TITLE = 'Đoạn tường'` ở `WallLayerInspector.tsx:39`,
`SCREEN_ARIA_LABEL = 'Duyệt lớp tường'` ở `WallLayerReview.tsx:68`), rồi grep chéo với
nhãn của các màn khác (`SCREEN_ARIA_LABEL` của `CadBranchConfirm.tsx` và của
`AuthScreen`) để loại chunk dùng chung:

```
$ grep -o "Đoạn tường\|Duyệt lớp tường" dist/assets/index-BvDLQvm7.js | sort | uniq -c
      1 Đoạn tường
      1 Duyệt lớp tường

$ grep -l "Màn phát hiện tệp CAD" dist/assets/index-BvDLQvm7.js dist/assets/index-C9rTj0ED.js
dist/assets/index-C9rTj0ED.js

$ grep -l "Đăng nhập" dist/assets/index-BvDLQvm7.js dist/assets/index-C9rTj0ED.js
dist/assets/index-C9rTj0ED.js
```

Kết luận: `index-BvDLQvm7.js` **chỉ** chứa chuỗi của S-12 (không chứa "Màn phát hiện tệp
CAD" của `CadBranchConfirm`, không chứa "Đăng nhập" của `AuthScreen`) → đây là **chunk
lazy riêng của route S-12** (`RouteWallLayerReview` — `src/routes/router.tsx:33`).
`index-C9rTj0ED.js` chứa cả ba nhãn của ba màn khác nhau → đó là **chunk dùng chung**
(dependency chung giữa nhiều route lazy, Rollup gộp lại), không phải chunk riêng của
S-12, dù nó cũng chứa mã của S-12 (vì S-12 gọi tới các phần dùng chung đó).

Không cần làm phép thử tháo route (Việc 2, bước dự phòng): chunk đã xác định được
bằng grep chuỗi, không phải đoán theo tên.

**3) Báo cáo số:**

| | |
|---|---|
| gzip của chunk `WallLayerReview` (`index-BvDLQvm7.js`) | **30,2 KiB** (thô 91,1 KiB) |
| tổng gzip toàn bộ JS | **578,8 KiB** |
| ngân sách JS | 175 KiB — `scripts/check-bundle-size.mjs:37` |
| ngân sách chunk lớn nhất | 170 KiB — `scripts/check-bundle-size.mjs:46` |
| ngân sách CSS | 12 KiB — `scripts/check-bundle-size.mjs:39` |
| phần S-12 chiếm trong tổng JS | 30,2 / 578,8 ≈ 5,2% |
| phần S-12 so với mức vượt (403,8 KiB) | 30,2 / 403,8 ≈ 7,5% |

---

## Việc 3 — Trạng thái commit

`git status --short` sạch trước và sau khi đo; `dist/` nằm trong `.gitignore` nên
`pnpm build` không tạo thay đổi cần commit. **Không cần làm và không đã làm** phép thử
tháo route ở `src/routes/router.tsx` — chunk xác định được thẳng bằng grep chuỗi
(Việc 2, bước 2).

---

## Kết luận

Màn S-12 "Duyệt lớp tường" đóng góp **30,2 KiB gzip** vào gói JS, qua đúng một chunk lazy
riêng của route (`dist/assets/index-BvDLQvm7.js`, xác nhận bằng grep chuỗi tiếng Việt độc
quyền của màn, loại trừ chunk dùng chung). Cổng kích thước gói (`pnpm size`) đang **đỏ**:
tổng JS 578,8 KiB, vượt ngân sách 175 KiB tới **403,8 KiB** — số vượt này gấp gần 13,4 lần
đóng góp riêng của S-12, và đã đỏ từ trước khi màn này tồn tại (mục 7.10 và món nợ số 7 của
`docs/contracts/T8-bao-cao-tich-hop.md`). Hai cổng còn lại đã chạy sạch: `pnpm cycles`
không có import vòng; `pnpm length` — 161 file đã quét, 18 vượt mức nhắc 250, **0 vượt mức
hỏng 400**. Không có bước nào trong nhiệm vụ này "chưa chạy": cả năm phép đo được giao
(`cycles`, `length`, `build`, `size`, quy phần chunk) đều đã chạy và có số thật ở trên.
