# Audit trang chủ `/welcome` (21-10-2026)

Nhánh `feat/homepage-audit`, tách từ `4db77838` (`feat/landing-v2`), đúng bản trong video 70 giây chủ dự án đã review.
Bằng chứng (ảnh, JSON, script đo) nằm ngoài repo, ở `F:/App-review/homepage-audit/`:
`before/` (bản cũ, :5193), `after/` (bản sửa, :5195), `STAGE/`, `UI/`, `coord/`, `gate/`.

## 1. Kiến trúc tìm được

- React 19.2 + Vite 5.3, pnpm, TypeScript 5.5, Tailwind với token màu. Route `/welcome` nạp lười `Landing.container.tsx`.
- Cảnh 3D: three.js 0.186 vẽ trên một `<canvas>` dính toàn màn (`src/lib/landing/stage`). Hậu kỳ `postprocessing` + `n8ao` chỉ ở bậc `full`.
  Ba bậc chất lượng `full / balanced / lite`, bộ điều tốc khung hình tự hạ bậc. GPU Intel UHD của máy chủ dự án chạy bậc `balanced`.
- Chuyển động: một hàm thuần `stateAt(p)` (`src/lib/landing/timeline`) cho camera, mức dựng và nhãn theo tiến độ cuộn `p` ∈ [0, 1].
  Cuộn bằng Lenis, nhịp vẽ bằng `gsap.ticker`, có ngủ khi đứng yên (`useLandingScroll.ts`). Trang dài 46 màn + 1 màn ghim, 9 cảnh, 6 bước.
- Chữ là DOM thật, không vẽ trong canvas (`LandingView.tsx`, `overlay.ts` ghi style mỗi khung, không render React).
- Dữ liệu nhà mẫu: `src/lib/landing/house` (ba tầng T1/T2/T3, phòng, cửa, cầu thang, 12 mục kiểm tra). Toàn bộ là **dữ liệu minh hoạ**, không phải kết quả AI thật.
  Mặt bằng 2D vẽ từ cùng dữ liệu đó (`stage/ink`, `house/planSvg.ts`).
- Tài sản: nội thất và cây là GLB của Pascal (`public/pascal/items`, sinh bởi `pnpm pascal`), texture và HDRI CC0 của Poly Haven (`public/landing`).
- Dự phòng: giảm chuyển động, không có WebGL2, hay mất context nhiều lần → `StaticLanding.tsx` (trang tĩnh, có đủ chữ và nút).
- Tính năng thật để đối chiếu lời hứa: màn Xuất có đúng 4 định dạng `.glb .pdf .png .json` (`screens/export/ExportPanel/types.ts`), không có IFC.
  Đăng ký đang đóng ở v1 (`screens/auth/AuthScreen`), nên mọi nút "bắt đầu" dẫn tới `/login`.

## 2. Baseline (bản cũ, chưa sửa)

| Hạng mục | Kết quả | Cách đo |
|---|---|---|
| Test landing + router | 18 tệp, 121/121 đạt | `vitest run src/lib/landing src/screens/landing src/routes/router.test.tsx` |
| eslint (landing) / tsc | 0 cảnh báo / đạt | trên worktree `landing-old` |
| LCP / FCP | 616–1040 ms / 612–1012 ms | 3 lần lạnh + 3 lần ấm × 1920, 1366; server dev cục bộ |
| CLS | ≤ 0,0003 lúc tải, 0 khi cuộn 10 s | PerformanceObserver |
| INP (proxy) | ≤ 16 ms (sàn của observer) | bấm thanh bước, "Bỏ qua" |
| Khung hình khi cuộn | p95 toàn trang 29–42 ms, 5–13 % khung > 33 ms | cuộn bánh xe thật, bậc balanced, 2 lần mỗi cỡ |
| Tài nguyên | 17 MB (bản dev), texture 4,7 MB, HDRI 1,6 MB, GLB 0,8 MB | `assets.mjs` |
| Console | 0 lỗi, 0 request hỏng; cảnh báo zustand + cảnh báo biên dịch shader X4122 | quét 16 vị trí |

Điều kiện chung: Chromium 1248 headless, GPU "ANGLE Intel UHD Graphics D3D11", `hardwareConcurrency=4` (bậc balanced), server Vite dev, không giới hạn mạng.
Mọi lượt Playwright chạy trong khoá GPU dùng chung (`gpu-lock.mjs`).

## 3. Các phát hiện

Mức: P0 sai lời hứa / chặn dùng · P1 ảnh hưởng lớn · P2 đáng sửa · P3 hoàn thiện. Độ chắc: **xác nhận** = đã tái hiện; **có thể** = có dấu hiệu, chưa chứng minh gốc.

| ID | Mức | Chỗ | Bằng chứng | Ảnh hưởng | Gốc | Độ chắc | Trạng thái |
|---|---|---|---|---|---|---|---|
| F-01 | P0 | `landing.copy.ts` STEPS[5], EXPORTS | `before/shots/1366x768/p100.png`: "GLB, IFC, PDF, JSON, PNG", ô IFC "BIM" | Hứa một định dạng sản phẩm không có | Chữ viết tay, không nối với màn Xuất | xác nhận | **Đã sửa**: đúng 4 định dạng, mỗi cái kèm nghĩa; test chặn IFC |
| F-02 | P0 | `LandingView`, `LandingParts` | `before/keyboard.json`: Tab đi Đăng nhập → Bỏ qua → 01..06 rồi rời trang; nút "Bắt đầu dự án" `visibility:hidden` tới cuối (~55 màn) | Người dùng phải cuộn hết trình diễn mới tới hành động chính | CTA chỉ có ở cảnh cuối | xác nhận | **Đã sửa**: CTA ngay màn đầu, đứng thứ 3 trong thứ tự Tab; "Bỏ qua" đổi thành "Tới phần bắt đầu ↓" |
| F-03 | P0 | S01–S04 so với S05+ | Review 20/10 §5i; bản vẽ 1 tầng, mô hình 3 tầng | Kiến trúc sư không tin mô hình đến từ bản vẽ | Không nói mặt bằng là tầng nào, không cho thấy tầng 2–3 | xác nhận | **Đã sửa**: nhãn "Mặt bằng tầng 1 · Dữ liệu minh hoạ"; dải 3 mặt bằng nhỏ ở S07 vẽ từ cùng dữ liệu (`levelPlanSvg`) |
| F-04 | P1 | `landing.css` | `before/contrast.json`: dòng mắt 2,24–2,31:1, dòng phụ 3,81:1, liên kết đầu trang 4,10:1 | Chữ khó đọc, dưới WCAG AA | Mực pha trong suốt | xác nhận | **Đã sửa**: 5,3–7,3:1 trên giấy, thấp nhất 4,92:1 trên cảnh 3D (p 0,84) |
| F-05 | P1 | `useLandingScroll.ts` | `STAGE/`: sau "Xem lại từ đầu" 2 khung còn trạng thái cuối | Lóe khung cũ khi nhảy bước | `shown` giảm chấn lướt qua mọi cảnh ở giữa | xác nhận | **Đã sửa**: bước nhảy > 0,03 gán thẳng `shown`; đo lại 4 khung đầu đều ở đích (`coord/jump.mjs`) |
| F-06 | P2 | `stage/build.ts` | `STAGE/base2/1440-0.7.png`: hai đèn thả lơ lửng trên bàn ăn khi đã cắt trần | Vật thể nổi giữa không trung | Đồ treo không ẩn cùng trần | xác nhận | **Đã sửa**: đèn thả, hút mùi, tranh treo ẩn khi cắt (`STAGE/after/1440-0.7.png`) |
| F-07 | P2 | `stage/site/plants.ts` | `STAGE/base2/crop-bush-p1.png` | Bụi hoa hồng tím trông như thiếu texture | Màu `#A3346B` | xác nhận | **Đã sửa**: dùng màu lá có sẵn |
| F-08 | P2 | `stage/build.ts` | Mép trên khung cửa trùng mặt cắt tường | Răng cưa tối nhấp nháy ở đỉnh tường | Hai mặt đồng phẳng (z-fighting) | có thể | **Đã sửa**, chỉ kiểm bằng test (khung cắt thấp hơn 2 cm); chưa có ảnh phóng to |
| F-09 | P1 | Lưới định dạng xuất, thanh bước | `before/overlap`, review §7: thanh bước đè chân trang ở 1024; di chuột hiện hai nhãn; ô định dạng trông như nút | Rối, bấm nhầm | CSS | xác nhận | **Đã sửa**: danh sách phẳng, thanh bước ẩn ở bước cuối dạng hàng, một nhãn khi di chuột; zoom 200 % hết chồng |
| F-10 | P1 | Bước 03 và 05 | "Rà soát" và "Kiểm tra" nghe như nhau | Người thường không phân biệt | Tên bước | xác nhận | **Đã sửa**: "Chỉnh sửa" và "Kiểm tra tự động" |
| F-11 | P3 | Vùng chạm | `before/touch.json`: thanh bước 24×40 px, "Đăng nhập" chân trang 64×18 | Khó chạm trên màn cảm ứng | CSS | xác nhận | **Đã sửa**: 44×40 ở ≤ 768 px, 40×40 ở 1024, chân trang cao 24 px |
| F-12 | P1 | Cả cảnh 3D | Ảnh mọi cỡ; review 20/10 §5: cây low-poly, ánh sáng phẳng, vật liệu nhám đồng đều | Mô hình trông như đồ chơi nhựa | Mẫu cây Pascal low-poly, bậc balanced không có AO/bóng mềm | xác nhận | **Chưa sửa** — cần một đợt nâng cấp hình ảnh riêng, xem mục 10 |
| F-13 | P1 | S09 (cảnh cuối) | `after/perf/frames.json`, `before/perf-rerun`: ~50 % khung > 33 ms, p95 49–76 ms | Khựng ở cảnh cuối trên GPU Intel | Toàn cảnh nhiều draw call nhất (768 call, 131k tam giác) | xác nhận | **Chưa sửa** (có sẵn) |
| F-14 | P2 | Bước nhảy xa ngay sau khi tải | `coord/back.mjs`: loạt 256 cảnh báo `GL_INVALID_OPERATION ... sampler type` quanh p 0,30 | Một số lệnh vẽ bị GPU bỏ qua trong vài khung | Chưa xác định (gắn công cụ đo vào là mất) | có thể | **Chưa sửa** (có sẵn ở bản cũ) |
| F-15 | P3 | Mất context WebGL | `coord/loss-cmp.png` | Sau khi dựng lại, cột tường tối hơn bản gốc | Chưa xác định | xác nhận | **Chưa sửa**; trang vẫn tự dựng lại và giữ chữ |
| F-16 | P2 | Đoạn "Bước vào" (p 0,29–0,685) | `before/shots/*/p043.png`: camera dí bức tường trống; 39 % trang một tiêu đề | Dài, chán | Đường camera | xác nhận | **Chưa sửa**: đổi nhịp và camera là đổi kịch bản; bản rút gọn trước đã bị bác |
| F-17 | P3 | 360 px | `after/shots/360x800/p100.png` | Tiêu đề cuối đè lên ngôi nhà | Khối chữ neo đáy | xác nhận | **Chưa sửa** (bản cũ cũng bị, nặng hơn); mobile ngoài phạm vi |
| F-18 | — | Va chạm camera | `collision.test.ts` lấy mẫu toàn đường đi, kể cả đi trong nhà | — | — | — | **Không phải lỗi**: camera chỉ đi sát qua lỗ cửa D1, không xuyên tường |
| F-19 | — | Vòng vẽ lúc nghỉ | `STAGE/perf/idle.mjs`: 28 lần vẽ/s trong 8 s đầu, 0 sau 10 s | — | Mặt nước + cá koi ≤ 30 fps rồi ngủ | — | **Đúng thiết kế**, không phải lỗi |
| F-20 | — | Đồ đạc trắng | `coord/tl-base.png`: t=0 trắng, t=3 s có vật liệu | Chỉ thấy khi nhảy xa ngay lúc vừa tải | GLB tải muộn | xác nhận | Chấp nhận; cuộn bình thường không gặp |

## 4. Tệp đã đổi

- `src/screens/landing/landing.copy.ts`: 4 định dạng xuất đúng với màn Xuất (`ExportFormatId`), tên bước 03/05, nhãn mới.
- `src/screens/landing/LandingParts.tsx`: `HeroCta`, `PlanTag`, `FloorStrip`; nhãn "Tới phần bắt đầu".
- `src/screens/landing/LandingView.tsx`, `StaticLanding.tsx`: gắn các phần trên; thanh bước dời sau khối chữ trong DOM (thứ tự Tab).
- `src/screens/landing/landing.css`: tương phản, vùng chạm, vùng an toàn ở 1024/768 và màn thấp, danh sách định dạng phẳng, màn ≤ 480 px.
- `src/screens/landing/useLandingScroll.ts`: bước nhảy gán thẳng `shown` (hết lóe khung cũ).
- `src/lib/landing/house/planSvg.ts` (+ `index.ts`): `levelPlanSvg(house, levelId)`.
- `src/lib/landing/stage/build.ts`: ẩn đồ treo khi cắt trần; khung cửa cắt thấp hơn mặt tường 2 cm.
- `src/lib/landing/stage/site/plants.ts`: bỏ màu hồng tím.
- Test: `Landing.test.tsx` (định dạng xuất, hai CTA, thứ tự Tab), `house/__tests__/levelPlanSvg.test.ts` (mới), `stage/__tests__/house.test.ts` (đặc tả mới cho đồ treo và khung cửa, không nới lỏng).

## 5. Quyết định quan trọng

1. **Không đổi phong cách 3D, không rút kịch bản.** Hai lần đổi trước (v4 "đất sét", kịch bản rút ngắn) bị chủ dự án đánh giá là tệ hơn bản này. Chỉ sửa lỗi chứng minh được, so ảnh cùng `p` và cùng cỡ.
2. **Không bịa:** CTA nói rõ "Đăng nhập để tạo dự án" vì đăng ký đang đóng; không thêm "miễn phí", không có giá. Mọi số liệu nhà mẫu vẫn ghi "Dữ liệu minh hoạ".
3. **Không vẽ đồng bộ trong sự kiện cuộn.** Bản sửa ban đầu của agent gọi `paint()` ngay trong sự kiện; cách này làm lộ ra loạt cảnh báo `GL_INVALID_OPERATION` ngay ở lần nhảy đầu. Bỏ lời gọi đó, chỉ gán `shown`; khung kế tiếp của ticker vẽ đúng đích.
4. **Mobile:** chủ dự án đã chốt web nhắm desktop và tablet. Ở 390/360 tôi chỉ kiểm không cuộn ngang và còn tới được CTA; ở ≤ 480 px CTA đầu trang ẩn để không đè lên bản vẽ (đầu trang vẫn có "Đăng nhập" và "Tới phần bắt đầu").
5. **Không thêm gói phụ thuộc nào.**

## 6. Kiểm tra sau khi sửa

| Cổng | Kết quả |
|---|---|
| `tsc --noEmit` | đạt |
| `pnpm lint` (cả repo, `--max-warnings 0`) | đạt |
| `pnpm cycles`, `pnpm length` | đạt |
| vitest landing + routes + ExportPanel | 37 tệp, 328/328 đạt |
| `vite build` + `pnpm size` | đạt. Cảnh báo "tổng JS quá mốc" có sẵn: 1573,9 → 1574,7 KiB. Chunk trang chủ 170,6 → 180,8 KB (nén 60,9 → 63,8 KB) |
| Không chạy | `pnpm coverage` toàn repo, e2e Playwright của repo |

Trình duyệt (cùng script cho trước và sau, `BASE-VIS/scripts/vis.mjs`):

| Mục | Trước | Sau |
|---|---|---|
| Chồng chữ ở 6 cỡ × 5 vị trí | 0 (bộ dò thô) | 0 |
| Zoom 200 % (720×450) | thanh bước đè CTA 162×14 px; đầu trang đè dòng mắt | 0 chồng, không cuộn ngang |
| Thứ tự Tab | CTA không tới được | Đăng nhập → Tới phần bắt đầu → **Bắt đầu dự án** → 01..06 |
| Viền focus | có ở mọi nút | có ở mọi nút |
| Giảm chuyển động | trang tĩnh đủ chữ, có IFC | trang tĩnh đủ chữ, 2 CTA, 3 mặt bằng tầng, không IFC |
| Không có WebGL | về trang tĩnh, CTA tới `/login` | như cũ |
| Console | 0 lỗi | 0 lỗi |

Hiệu năng (đo nối tiếp cũ → mới cùng điều kiện, `BASE-PERF/scripts/frames.mjs`):

| | p95 toàn trang | khung > 33 ms | S09 p95 |
|---|---|---|---|
| Bản cũ (đo lại) | 34,9–48,6 ms | 10,2–11,7 % | 48,9–76,3 ms |
| Bản mới | 34,9–48,5 ms | 10,3–14,4 % | 48,7–69,4 ms |

Bản cũ đo lúc đầu buổi: p95 29–42 ms. GPU lúc sau bận hơn, nên chỉ so hai lượt đo nối tiếp. LCP bản mới 644–1216 ms (cũ 616–1040), CLS ≤ 0,0007; số lấy trên server dev, không phải bản build.

## 7. Ảnh trước–sau

- Bảng ghép: `before/sheet-<cỡ>.png` và `after/sheet-<cỡ>.png` (6 cỡ × 16 vị trí).
- S07 ba mặt bằng tầng: `coord/s07-1920-0.76.png`, `coord/s07-1366-0.76.png`.
- Đèn thả: `STAGE/base2/1440-0.7.png` → `STAGE/after/1440-0.7.png`. Bụi hoa: `STAGE/*/crop-bush-p1.png`.
- 390/360: `coord/m390.png` (lần đầu, có hồi quy), `coord/m-after2.png` (đã sửa), `coord/m360-before.png`.

**Bẫy khi đo lại:** worktree mới phải chạy `pnpm pascal` trước khi mở Vite. Thiếu `public/pascal`, cây thành quả cầu và đồ đạc thành hộp trắng. Lượt ảnh "sau" đầu tiên và phép đo tốc độ đầu của agent 3D bị sai vì lỗi này; đã đo lại toàn bộ.

## 8. Còn tồn tại / chưa kiểm

- F-12 (trông như đồ chơi nhựa), F-13 (cảnh cuối khựng), F-14, F-15, F-16, F-17: xem bảng.
- Chưa đo trên bản build production, chưa giới hạn mạng, chưa đo bộ nhớ GPU theo thời gian, chưa có dữ liệu thực địa (field) cho Core Web Vitals.
- Chưa kiểm bằng trình đọc màn hình thật. Không tuyên bố đạt WCAG 2.2 AA đầy đủ: chỉ đo tương phản, focus, thứ tự Tab, vùng chạm và zoom.
- F-08 chỉ kiểm bằng test, chưa có ảnh phóng to trước–sau.

## 9. Checklist nghiệm thu

| Tiêu chí | Trạng thái |
|---|---|
| A1 Không lỗi xuyên hình/hở hình nghiêm trọng ở góc chuẩn | PASS (test va chạm; đèn lơ lửng đã sửa) |
| A2 Mặt bằng 2D, tổng thể và từng tầng khớp dữ liệu | PASS (nhãn tầng 1 + 3 mặt bằng từ cùng dữ liệu) |
| A3 Vật liệu, ánh sáng đồng nhất giữa các cảnh | FAIL (F-12) |
| A4 Cây, nội thất gần camera đạt chất lượng | FAIL (F-12) |
| A5 Không dùng cảnh yếu làm hình chủ đạo | FAIL một phần (F-16) |
| B1 Hiểu giá trị và hành động chính ở màn đầu | PASS |
| B2 CTA hoạt động, không bị animation chặn | PASS (desktop/tablet); ≤ 480 px CTA ở đầu trang |
| B3 Bỏ qua được phần trình diễn | PASS |
| B4 Nhãn, trạng thái lỗi dễ hiểu | PASS |
| B5 Không nội dung quan trọng bị che/cắt | PASS ở 1920/1366/1024/768; FAIL ở 360 (F-17) |
| C1 Không giật, nhảy vị trí trong chuyển cảnh chuẩn | PASS (hết lóe khung cũ) |
| C2 Không animation lặp vô hạn không cần | PASS (mặt nước ngủ sau 8 s) |
| C3 Camera có mục đích, không xuyên vật | PASS va chạm; FAIL một phần về mục đích (F-16) |
| C4 Trạng thái cuối ổn định | PASS |
| C5 Giảm chuyển động đủ nội dung | PASS |
| D1 Có báo cáo hiệu năng rõ điều kiện | PASS |
| D2 Kiểm frame time và lúc tải nặng | PASS (đo); FAIL mục tiêu ở S09 (F-13) |
| D3 Không lỗi console nghiêm trọng | PASS về lỗi; cảnh báo GL ngắt quãng (F-14) |
| D4 Có fallback khi không có WebGL/mô hình | PASS |
| D5 Không rò tài nguyên | PASS (0 context WebGL còn sống sau khi rời trang, heap +8 % sau 5 vòng) |
| E1 Đạt các cỡ mục tiêu | PASS desktop/tablet; mobile xem F-17 |
| E2 Bàn phím, focus | PASS |
| E3 Tương phản, tên truy cập | PASS ở các điểm đã đo |
| E4 Zoom 200 % | PASS |
| E5 Mobile không tải trải nghiệm nặng nếu không cần | NOT TESTED (chưa đo bậc `lite` trên thiết bị yếu) |
| F1 Chức năng cũ, luồng xuất không vỡ | PASS (test ExportPanel, router) |
| F2 Build, lint, typecheck, test đã chạy | PASS (trừ coverage toàn repo và e2e: NOT TESTED) |
| F3 Có ảnh trước–sau | PASS |
| F4 Ghi rõ lỗi chưa sửa | PASS |
| F5 Hướng dẫn chạy, giới hạn | PASS (mục 7, 8) |

## 10. Muốn hết "trông như đồ chơi nhựa" (F-12)

Cần một đợt làm riêng, không phải sửa lỗi: thay cây low-poly bằng mẫu cây có tán lá thật (billboard hoặc mesh nhiều lá), bóng tiếp xúc và AO cho bậc balanced, vật liệu có độ nhám và phản xạ khác nhau theo loại (gỗ, đá, kính, vải), nội thất đủ đồ hơn.
Mỗi bước phải quay video trên GPU thật và đặt cạnh bản cũ trước khi giữ lại, vì hai lần đổi trước đã làm hình xấu đi.
