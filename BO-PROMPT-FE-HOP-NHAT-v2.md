# BỘ PROMPT FRONTEND HỢP NHẤT v2.0 — 1 màn = 1 prompt · khung 12 khối
### Hợp nhất "Quiet Blueprint v1.1 + 55 prompt" (UI/UX) × "47 màn trên nền 81 prompt logic" (kiến trúc)

> Tài liệu này **thay thế** cả hai bộ prompt màn hình cũ. Không chạy song song hai bộ.
> Bộ 81 prompt logic frontend (T · D · M · S · P · R · A · I · X · O) là **tầng dưới đã hoàn thành** — mọi prompt ở đây chỉ gọi lại, không viết lại.

---

## 0.1 — Vì sao phải hợp nhất

| Bộ cũ | Có gì | Thiếu gì |
| --- | --- | --- |
| **Báo cáo hợp nhất (A/B/C/D/E/F/G/H)** | Design System đầy đủ, persona, bố cục theo pixel, danh sách component, chuyển động từng phần tử, dữ liệu mẫu, nghiệm thu thẩm mỹ | Ra **một file duy nhất** mỗi màn; **không biết** 81 prompt logic tồn tại → agent viết lại `fetch`, tự tính diện tích, tự dựng mesh |
| **47 màn trên nền 81 logic (S-01…S-47)** | Trỏ đúng tên prompt logic + đường dẫn, 6 file mỗi màn, cấm view import `src/api`/`src/store`, lệnh kiểm tra cụ thể, khoá vùng không được sửa | UI bị nén còn một gạch đầu dòng; mất persona, mất chi tiết chuyển động, mất checklist thẩm mỹ → màn ra "đúng nhưng xấu" |

Hai bộ **khớp 1:1 từng màn** (xem bảng tra 0.5). Bộ này ghép từng cặp: giữ toàn bộ chiều sâu UI/UX của bộ thứ nhất, đặt trong bộ khung kỹ thuật của bộ thứ hai.

---

## 0.2 — Chuỗi thực thi và tình trạng hiện tại

| # | Chặng | Số prompt | Sinh ra gì | Tình trạng |
| --- | --- | --- | --- | --- |
| 1 | Tầng nền | L-01, L-02, L-03 | `src/lib/http`, `src/lib/auth`, `src/lib/errors` | ✅ xong |
| 2 | **Tầng logic** | 81 prompt: T·D·M·S·P·R·A·I·X·O | `src/api`, `src/domain`, `src/store`, `src/lib/**` | ✅ xong |
| 3 | **Nền giao diện** | **DS-01** (Phần 1.4) | `src/theme/tokens.ts` (kiểm và hoàn thiện), `tokens.css`, `tailwind.config.ts`, route `/design-system` | ⬅️ **làm tiếp ở đây** |
| 4 | **Thư viện thành phần** | **CL-01 → CL-07** (Phần 1.5) | `src/components/**` — 34 thành phần | ⬅️ rồi đến đây |
| 5 | 47 màn hình | S-01 → S-47 (Phần 2 trở đi) | `src/screens/**`, `src/routes.tsx`, `src/i18n/vi.json` | sau cùng |

> ⚠️ **Cảnh báo phát hiện được khi hợp nhất:** 81 prompt logic **đọc** `src/theme/tokens.ts` nhưng **không prompt nào tạo ra nó** — nó nằm trong danh sách "không được sửa" của A-01, P-06, P-07. Nghĩa là file đó hoặc đang là bản tạm do agent tự bịa ra để cho qua typecheck, hoặc đang thiếu.
> **Việc đầu tiên phải làm:** mở `src/theme/tokens.ts` và đối chiếu với bảng token trong DS-00. Nếu thiếu hoặc sai màu, DS-01 phải sửa nó **trước**, vì P-06 (bảy chế độ tô màu) và P-07 (chú giải và kiểm tương phản) đang phụ thuộc vào các khoá màu ở đó. Sửa muộn thì mọi màu trên canvas đều lệch.

Vùng duy nhất được viết mới ở chặng 5: `src/screens/<area>/<Name>/**` · `src/routes.tsx` · `src/i18n/vi.json`.

---

## 0.3 — Luật vàng của cả 47 prompt

**Nhóm luật kiến trúc** (từ bộ 47 màn — vi phạm là dừng phiên):

- **Màn hình không được chứa logic.** Không tính toán hình học, không gọi `fetch`, không tự lưu, không tự tính diện tích, không tự dựng mesh, không tự viết câu lỗi.
- Mỗi màn đúng **6 file**: `index.ts` · `<Name>.tsx` (view thuần) · `use<Name>.ts` (chỉ nối logic, không chứa công thức) · `<Name>.container.tsx` · `<Name>.stories.tsx` (7 trạng thái) · `<Name>.test.tsx`.
- View **không** import `src/api`, `src/store`, `src/domain`. Chỉ hook được phép.
- Trạng thái màn lấy từ `useScreenState` (P-04). Không tự viết cờ `isLoading` rời rạc.
- Chuyển động lấy từ `src/lib/motion/tokens.ts` (A-01). Không viết `transition` bằng số tay.
- Phím tắt khai báo qua `shortcutRegistry` (I-01). Không gắn `keydown` trực tiếp.
- Chuỗi tiếng Việt vào `src/i18n/vi.json`. Không viết chuỗi cứng trong JSX.
- Số và đơn vị định dạng qua `src/lib/format/**` (P-01, P-02). Không tự nối chuỗi số.
- **Không tạo component mới.** Thiếu component → dừng và báo, không tự dựng trong thư mục màn.

**Nhóm luật cảm giác** (từ Design System — vi phạm là trả lại màn):

- Ngăn cách bằng khoảng trắng và sắc nền, **không** bằng viền. Mặc định không viền.
- Không gradient, không glow, không glassmorphism trên panel dữ liệu.
- Không nhãn VIẾT HOA. Nhãn nhóm 13/18/600 chữ thường.
- Không khối màu lớn hơn 120px. Không quá 3 màu dữ liệu hiện cùng lúc.
- Mọi bề mặt tương tác bo tối thiểu 8px, cao tối thiểu 36px. Không chữ dưới 13px.
- Đúng một màu nhấn `--accent`, đúng ba màu trạng thái.
- Mọi chuỗi tiếng Việt **đủ dấu**. Chữ không dấu trong code là lỗi, không phải lựa chọn.

---

## 0.4 — Khung 12 khối của mỗi prompt

```
[1  CONTEXT]                — route, vai, mục tiêu, người dùng thật, cảm giác cần đạt
[2  LOGIC ĐÃ CÓ]            — tên prompt logic + đường dẫn được phép gọi
[3  ĐỌC FILE NÀO]           — danh sách file agent phải đọc trước khi viết
[4  BỐ CỤC]                 — kích thước theo pixel ở 1440, mốc đổi ở 1920 / 1024
[5  THÀNH PHẦN & DỮ LIỆU]   — component nào, chứa gì, dữ liệu mẫu tiếng Việt đủ dấu
[6  NỐI LOGIC]              — hàm nào gọi hàm nào, cấm tính toán tại chỗ
[7  TƯƠNG TÁC & CHUYỂN ĐỘNG]— sự kiện, phím tắt, thời lượng, đường cong
[8  BẢY TRẠNG THÁI]         — rỗng · đang tải · một phần · lỗi · xong · không quyền · thu gọn
[9  CẤM TUYỆT ĐỐI]          — hợp của cấm kiến trúc và cấm thẩm mỹ
[10 DELIVERABLES]           — 6 file + routes + vi.json
[11 NGHIỆM THU]             — lệnh chạy + phép đo thẩm mỹ, có số để đối chiếu
[12 KHÔNG ĐƯỢC SỬA FILE NÀO]— khoá cứng tầng logic và component
```

Khối 2 là điểm chống viết lại logic. Khối 4–5–7 là điểm chống ra màn xấu. Khối 11 là điểm chống "xanh mà sai".

**Cách dán:** mở phiên mới → dán `DS-00` (1.1) → dán `KNOWN FAILURE MODES` (1.2) → dán `DS-BIND` (1.3) → dán đúng **một** prompt màn hình. Một phiên = một màn.

---

## 0.5 — Bảng tra 47 màn (mã cũ ↔ mã mới ↔ file ↔ logic chính)

| Mới | Cũ (báo cáo) | Tên màn | Thư mục | Logic chính |
| --- | --- | --- | --- | --- |
| S-01 ⭐ | A-01 | Đăng nhập và đăng ký | `auth/AuthScreen` | L-02, L-03, T-04, T-05, P-04, I-01, I-02 |
| S-02 ⭐ | A-02 | Danh sách dự án | `dashboard/ProjectDashboard` | D-01, D-02, D-03, P-01, P-03, A-02, O-01 |
| S-03 ⭐ | A-03 | Tạo dự án mới | `project/CreateProjectModal` | T-04, M-11, D-03, D-04, L-03, P-01 |
| S-04 | A-04 | Cài đặt dự án | `project/ProjectSettings` | D-07, D-08, D-05, D-09, M-01, M-02, M-12 |
| S-05 | A-05 | Cài đặt tài khoản | `account/AccountSettings` | L-02, D-07, D-08, O-02, A-01, A-03, I-01 |
| S-06 | A-06 | Màn chào ba bước | `onboarding/WelcomeScreen` | D-01, D-02, O-02, A-02, P-04 |
| S-07 | A-07 | Gói dịch vụ và hoá đơn | `billing/BillingScreen` | P-01, P-02, P-07, D-01, D-02, A-03 |
| S-08 ⭐ | B-01 | Tải bản vẽ theo tầng | `upload/FloorUploadScreen` | T-01, T-02, T-03, D-04 |
| S-09 | B-06 | Kiểm tra chất lượng ảnh | `upload/InputQualityGate` | T-03, M-02, P-06 |
| S-10 ⭐ | B-02 | Theo dõi tiến trình AI | `pipeline/ProcessingScreen` | T-06, T-07, T-08, A-03 |
| S-11 ⭐ | B-03 | Hiệu chỉnh tỷ lệ thủ công | `pipeline/ScaleCalibration` | M-01, M-02, M-03, M-15 |
| S-12 | B-04 | Sơ đồ nhánh xử lý | `pipeline/PipelineGraph` | T-08, P-03 |
| S-13 | B-05 | Xác nhận nhánh CAD | `pipeline/CadBranchConfirm` | T-03, T-08 |
| S-14 | B-07 | Pipeline thất bại | `pipeline/PipelineFailure` | L-03, T-08, T-10 |
| S-15 ⭐ | C-01 | Xem và sửa lớp Tường | `qc/WallLayerReview` | M-04, M-05, S-04→S-11, D-04, P-06 |
| S-16 ⭐ | C-02 | Xem và sửa Cửa và đồ đạc | `qc/ObjectLayerReview` | M-08, M-09, S-07, S-10, P-06 |
| S-17 | C-03 | Kích thước OCR | `qc/DimensionOcrReview` | M-02, M-15, P-02 |
| S-18 | C-04 | Trục và gốc toạ độ | `qc/AxisGridManager` | M-10, M-11, M-03 |
| S-19 ⭐ | C-05 | Quản lý tầng | `qc/FloorManager` | M-11, D-11, D-12, S-02 |
| S-20 | C-06 | Duyệt nhãn phòng | `qc/RoomLabelReview` | M-06, M-07, P-03 |
| S-21 | C-07 | Chuẩn hoá độ dày tường | `qc/ThicknessStandardization` | M-04, M-05, S-07, P-06 |
| S-22 ⭐ | D-01 | Trình xem 3D chính | `viewer/Viewer3D` | R-01→R-09, S-08, S-11 |
| S-23 ⭐ | D-02 | Panel thuộc tính đối tượng | `viewer/PropertyInspector` | S-07, D-07, P-01, P-03 |
| S-24 | D-03 | Thư viện đồ nội thất | `viewer/FurnitureLibraryPanel` | R-01, R-10, S-07, I-03 |
| S-25 | D-04 | Sửa hình học tường trong 3D | `viewer/WallGeometryEditor` | M-04, M-05, R-10, S-06 |
| S-26 | D-05 | Panel phòng và diện tích | `viewer/RoomAreaPanel` | M-06, M-07, P-01, S-11 |
| S-27 | D-06 | Lịch sử thao tác | `viewer/HistoryPanel` | S-04, S-05, S-06, P-02 |
| S-28 | D-07 | Đối chiếu bản vẽ và mô hình | `viewer/OverlayComparison` | M-15, R-06, P-06 |
| S-29 | D-08 | Xem tách tầng | `viewer/ExplodedView` | R-01, R-02, A-01, R-06 |
| S-30 | D-09 | Công cụ đo trong 3D | `viewer/MeasurementTool` | M-15, R-09, S-08 |
| S-31 | E-01 | Báo cáo vi phạm luật | `rules/RuleReport` | M-12, M-13, M-14, P-06 |
| S-32 | E-02 | Chi tiết một vi phạm | `rules/ViolationDetail` | M-12, S-07, R-07 |
| S-33 | E-03 | Cấu hình bộ luật | `rules/RuleSettings` | M-12, D-07, O-02 |
| S-34 ⭐ | F-01 | Xuất mô hình | `export/ExportPanel` | X-01, X-02, X-03, T-08 |
| S-35 | F-02 | Chia sẻ và nhúng | `export/ShareDialog` | X-04, R-08 |
| S-36 | F-03 | Xem Spatial JSON | `export/SpatialJsonViewer` | D-11, D-12, D-13 |
| S-37 | F-04 | Lịch sử phiên bản mô hình | `export/VersionHistory` | D-09, D-10, P-02 |
| S-38 | G-01 | Thư viện model .glb | `admin/ModelLibrary` | R-02, R-05, T-02 |
| S-39 | G-02 | Quản lý người dùng và vai | `admin/UserManagement` | D-04, D-05, P-02 |
| S-40 | G-03 | Hướng dẫn trong trình soạn thảo | `tour/EditorTour` | O-02, A-01, I-02 |
| S-41 | H-01 | Trung tâm thông báo | `notify/NotificationCenter` | T-06, P-02, D-03 |
| S-42 | H-02 | Cộng tác và bình luận | `collab/CollaborationLayer` | D-09, T-06, S-11 |
| S-43 | H-03 | Không tìm thấy trang | `system/NotFound` | P-04, O-01 |
| S-44 | H-04 | Không có quyền truy cập | `system/AccessDenied` | L-02, P-04 |
| S-45 | H-05 | Trạng thái kết nối | `system/ConnectionStates` | T-09, T-10, D-08 |
| S-46 | H-06 | Xem trên di động | `system/MobileViewer` | R-04, R-06, P-04 |
| S-47 | H-07 | Trang trưng bày trạng thái | `system/StateGallery` | P-04, P-05, O-03 |

⭐ = 12 màn MVP, chạy trước theo thứ tự: S-01 → S-02 → S-03 → S-08 → S-10 → S-11 → S-15 → S-16 → S-19 → S-22 → S-23 → S-34.

---

## 0.6a — Xung đột giữa tầng logic đã dựng và Design System

Hai xung đột này ảnh hưởng toàn bộ 47 màn, đã chốt và áp vào mọi prompt bên dưới.

| Điểm | Tầng logic đã dựng | Design System nói | Chốt | Vì sao |
| --- | --- | --- | --- | --- |
| Bảng thời lượng | A-01 dựng **120 / 180 / 240 / 340ms** | 120 / 180 / **260** / 340 / 700ms | **120 / 180 / 240 / 340ms** | Code đã tồn tại và đã có test. Đổi 240 → 260 phải sửa `src/lib/motion`, mà tầng đó bị khoá. Mốc 700ms không có trong A-01 → thanh tiến độ dùng 340ms, hoặc bổ sung một prompt nhỏ vào nhóm A rồi mới dùng. |
| Nguồn màu | `src/theme/tokens.ts` (TypeScript) | `tokens.css` (biến CSS) | **`src/theme/tokens.ts` là nguồn duy nhất**, `tokens.css` sinh ra từ nó | Logic đã import từ file TS. Nếu để hai nguồn song song, màu canvas do P-06 tính sẽ lệch màu giao diện do Tailwind tô. |

## 0.6 — Bảng xử lý xung đột giữa hai bộ (nhóm A)

Hai bộ mô tả cùng một màn nhưng lệch số đo. Bảng này chốt phương án, đã áp vào prompt bên dưới — không cần tra lại tài liệu cũ.

| Màn | Bộ UI/UX nói | Bộ 47 màn nói | Chốt |
| --- | --- | --- | --- |
| S-01 | Form bên **trái** 45%, minh hoạ bên phải; thẻ 420 đệm 40 | Minh hoạ bên **trái** 45%, form bên phải; khối form 360 | Minh hoạ trái · form phải · thẻ trắng 420 đệm 40 (vùng nội dung còn 340 ≈ 360) |
| S-01 | Minh hoạ động 12 giây | Lưới trục 1px **tĩnh** | Động 12 giây, tự chuyển sang tĩnh khi bật giảm chuyển động |
| S-02 | Thẻ preview 120, ba Select lọc, 9 dự án mẫu | Thẻ cao 240 preview 132, dải lọc 4 mục, 3 dự án mẫu | Thẻ 240 / preview 132 · dải lọc 4 mục + Select sắp xếp · 9 mẫu, 3 tên có thật |
| S-03 | Hộp thoại 640, đệm 32 | Hộp thoại 560, thân tối thiểu 320 | 560 × thân ≥ 320, đệm 24 |
| S-04 | Rãnh điều hướng 200 + 7 mục | 4 thẻ, cột 720 | 4 thẻ, gom 7 mục của bộ cũ vào 4 thẻ (xem prompt) |
| S-05 | 6 mục, có phím tắt và phiên đăng nhập | 4 nhóm, có đổi mật khẩu | Hợp thành 6 nhóm |
| S-06 | 3 thẻ lựa chọn 200 rộng | 3 thẻ bước 300×220, có khoá theo tiến độ | 300×220 có khoá + 2 liên kết phụ của bộ cũ |
| S-07 | Rộng tối đa 1120, có dải so sánh 3 gói | Cột 960, ba khối | 4 khối: gói hiện tại · so sánh 3 gói (1120) · ước tính · hoá đơn (960) |

---

# PHẦN 1 — Ba khối dán đầu mỗi phiên

## 1.1 — DS-00 Design System (dán khối 1)

```markdown
SYSTEM - DESIGN SYSTEM "QUIET BLUEPRINT" v1.1 (SOFT / UX-FIRST)

You are building the front-end of a professional AEC application that turns multi-floor 2D architectural drawings into interactive 3D models. Output working code only (React + TypeScript + Tailwind + Framer Motion + react-three-fiber). Never output images or design prose.

Aesthetic: calm, soft, warm-paper, generous, unhurried. Precision without rigidity. It should feel like a well-lit drafting table, not a control room.

The single most important rule: user experience beats visual preference. If a visual choice slows the user down, drop the visual choice.

Softness rules - these are what make it feel gentle: separate regions with whitespace and background tone, not with borders (default to no border); at most three elevation levels (warm app background, white floating panels, popovers); minimum 20px padding inside any content block and 24px between functional groups; every interactive surface has at least 8px radius; panels are white cards with 12px radius floating 8px from the window edge; the 2D and 3D canvases are rounded 16px and inset 12px - the drawing sits on a surface, it is not nailed into a frame.

Absolute prohibitions: no gradients of any kind; no glow, neon, or coloured shadows; no glassmorphism on data panels; no ALL-CAPS section labels (sentence case only, except axis codes and error codes); no colour block larger than 120px; never more than 3 data colours visible at once; no emoji as functional icons; no radius below 6px on interactive elements; no text below 13px; no fully-filled status badges.

Colour tokens (exact values, never invent):
--bg-app #F6F4F0, --bg-surface #FFFFFF, --bg-sunken #F1EEE8, --bg-hover rgba(43,42,40,0.035), --bg-active rgba(43,42,40,0.06), --bg-selected #EAF0F5.
Only two borders exist: --border-hairline #EFEBE4, --border-default #E3DED6.
--text-primary #33322F, --text-secondary #6B6862, --text-muted #97928A.
Single accent: --accent #567A96, --accent-hover #4A6B85, --accent-active #3F5D74, --accent-wash #EDF2F6, --accent-border #B9CBD9; focus ring 2px --accent offset 2px.
Canvas: --canvas-2d #FFFFFF, --canvas-2d-grid #F2EFEA, --canvas-3d #EDEBE6, --canvas-3d-ground #E4E1DA, --canvas-3d-horizon #D9D5CD (1px solid, not a gradient).
Materials: --wall-idle #CFCAC1, --wall-110 #B3ACA1, --wall-220 #8A8377, --wall-330 #5C564D, --wall-centerline #567A96 at 55%, --data-door #B98055, --data-window #7C9EA9, --data-furniture #8E9C87, --data-dimension #A99B76, --data-axis #A19C93, --data-room #6B6862 at 5%.
Exactly three states. Dot, border and icon use --state-verified #6B9A79, --state-attention #BE9B4F, --state-violation #C0685A on the tints #EEF4EF, #F8F3E8, #F9EFED. Text on those tints must use the darker text tokens --state-verified-text #3E6B4C, --state-attention-text #7A5F16, --state-violation-text #9A4034, because the base hues only reach 2.4-3.5:1 and fail WCAG AA. Never use --accent for 13px text; use --accent-active #3F5D74 for small accent text and links.

Colour logic: geometry is grey by default; a material colour appears only while its data layer is active; wall thickness 110/220/330 mm is three grey lightness steps with a permanent on-screen legend; low-confidence and auto-fixed share --state-attention, separated by a 45 degree hatch, never by a new colour.

Type: Inter for UI, JetBrains Mono for every technical number. display 30/40/600, h1 24/34/550, h2 19/28/550, h3 16/24/550, body 15/24/400, label 14/20/500, section label 13/18/600 sentence case, caption 13/18/400, mono 13/20/400, mono-lg 20/28/400.

Radii: 6 / 8 / 12 / 16 / 20 / 999. Shadows (neutral, wide, faint): 0 1px 2px rgba(43,42,40,0.04), 0 2px 8px rgba(43,42,40,0.05), 0 8px 24px rgba(43,42,40,0.07), 0 20px 48px rgba(43,42,40,0.09).

Shell: 56px top bar, 56px tool rail (20px icons), 280px left panel, flexible canvas (min 640px), 344px right inspector, 32px status bar showing only coordinates, scale, and save state. Rows: table 40, property row 36, tree item 32, button 36 with 40px hit area, input 38. Panel padding 20px.

Motion: 120 / 180 / 240 / 340ms (khớp src/lib/motion/tokens.ts đã dựng ở A-01). Primary easing cubic-bezier(0.32, 0.72, 0, 1). Buttons press to scale(0.985); cards lift -1px on hover; lists stagger in at 24ms; numeric values tween instead of jumping; tab indicators slide; panels open with eased width. Always honour prefers-reduced-motion.

UX laws you must implement in code, not just style: visible feedback within 100ms using optimistic updates; autosave 800ms after the user stops, with a "Saved at HH:MM" indicator and no Save button; undo for everything via an 8-second toast instead of confirmation dialogs (dialogs only for irreversible deletion); no blocking modals during QC work - edit inline or in the right panel; progressive disclosure with advanced fields collapsed; full keyboard support with the shortcut shown in every tooltip; inline validation as the user types; a persistent breadcrumb and auto-scroll-into-view for the selected object in both 2D and 3D; empty states that teach the next action in plain Vietnamese; human-language errors with a small error code, never a bare status number; long AI jobs show named steps, an ETA, and let the user leave and be notified; approved QC items are never overwritten by a re-run, and progress such as "12/48 walls approved" is always visible.

Seven required states per screen: Empty, Loading (content-shaped skeletons, never a centred spinner), Partial, Error, Success, Permission denied, Collapsed. Expose a dev-only state switcher.

Self-check before answering: zero gradients, zero all-caps labels, no visible border where whitespace would do, every interactive element at least 36px tall with at least 8px radius, one accent hue, three state colours, no colour block over 120px, body text 15px at 7:1 or better contrast, every action gives feedback under 100ms, undo available, keyboard reachable, reduced-motion path present. Fix any failure before responding.

Reply with the code, then exactly this line: Quiet Blueprint v1.1 locked - soft radii 6/8/12/16/20, easing 0.32,0.72,0,1, autosave + undo enabled
```

> ⚠️ **Khác bản cũ:** khối `Deliverables` (tokens.css, tailwind.config, /design-system, app shell) đã bị **cắt khỏi DS-00**, vì bốn thứ đó do CL-01 → CL-07 dựng xong trước rồi. Giữ lại sẽ khiến agent dựng lại Design System ở mỗi màn.

## 1.2 — KNOWN FAILURE MODES (dán khối 2)

```markdown
KNOWN FAILURE MODES - do not repeat these:

1. Writing section labels in ALL CAPS (GEOMETRY, MATERIAL ATTRIBUTES). Use sentence case at 13/18/600 in --text-secondary.
2. Giving side panels a grey fill and a 1px outline. Panels are pure #FFFFFF, radius 12px, shadow-rest, separated by 8px of --bg-app. No outline.
3. Using black or charcoal to mark the active tool. The only interactive colour is --accent; active tool = --accent-wash background with --accent icon.
4. Rendering the selected list row in plain grey. Selection is always --bg-selected #EAF0F5 with a 2px --accent bar on the left edge.
5. Tinting the status bar with a state colour. State colours never fill an area larger than 120px. The status bar uses --bg-app and contains exactly three items: cursor coordinates, scale, save state.
6. Leaving the dev-only state switcher visible inside the product. Render it only when process.env.NODE_ENV !== "production", as a collapsed floating chip in the bottom-right corner, never overlapping the canvas.
7. Omitting the breadcrumb. The top bar always shows Du an > Tang 01 > Tuong. Never put project or floor selectors as floating dropdowns over the canvas.
8. Turning wall thickness into a free numeric input. Thickness is a three-option segmented control (110 / 220 / 330 mm), 38px tall, radius 8px, each option preceded by a 12px grey swatch matching the canvas colour.
9. Drawing the canvas without the wall thickness legend. Without it the three-step grey encoding is unreadable.
10. Shipping a screen with no QC affordances. Every review screen must show confidence values, a state badge, and an approval counter such as 12/48 tuong da duyet.
11. Re-implementing anything that already exists in src/lib, src/domain, src/api or src/store. If a calculation, a fetch, a save, an undo, a mesh build or an export appears inside src/screens, that is a defect. Call the existing module instead.
12. Copying the Vietnamese strings from a prompt with the diacritics stripped. Every user-facing string in this prompt set is already written with full diacritics. Reproduce them exactly, character for character. Shipping unaccented Vietnamese is a defect, not a style choice.

Language: all user-facing strings are in Vietnamese with full diacritics ("Điều hướng tầng", "Lớp", "Đoạn tường", "Kích thước hình học", "Vật liệu", "Đã lưu lúc 14:32"). Keep code identifiers in English.
```

## 1.3 — DS-BIND: ràng buộc tầng logic (dán khối 3, khối mới của v2.0)

```markdown
ARCHITECTURE BINDING - this project already has a complete front-end logic layer.

Layers, from bottom to top:
  src/lib/http, src/lib/auth, src/lib/errors      (L-01, L-02, L-03)
  src/api/**                                       (T-04, T-05)
  src/lib/upload, src/lib/realtime, src/lib/offline (T-01..T-10)
  src/lib/query, src/lib/mutations, src/lib/autosave, src/lib/versioning (D-01..D-10)
  src/domain/**  spatial, units, walls, rooms, openings, axes, rules, measure (D-11..D-13, M-01..M-15)
  src/store/**, src/lib/commands, src/lib/tools, src/lib/selection (S-01..S-11)
  src/lib/format, src/lib/viewmodel, src/lib/screen-state, src/lib/coloring (P-01..P-07)
  src/lib/three/**                                 (R-01..R-10)
  src/lib/motion, src/lib/input, src/lib/export, src/lib/telemetry, src/lib/testing (A, I, X, O)
  src/components/**                                (CL-01..CL-07)
  src/screens/**                                   <- the only place you may write

Every one of those modules is finished, typed and tested. You are forbidden from opening them for editing, from duplicating their behaviour, and from working around them.

If a screen needs something those modules do not provide: STOP, output the exact prompt id that owns that behaviour (for example "this belongs to M-07, not to this screen"), and wait. Do not improvise the missing piece inside src/screens.

The screen layer may only: read data through a hook, render, dispatch commands, format through src/lib/format, and animate through src/lib/motion.

Confirm you have understood by replying with this line before the code:
Architecture binding acknowledged - screens compose, they do not compute
```

---

# PHẦN 1.4 — DS-01: Nền giao diện (chạy ngay sau 81 prompt logic)

Đây là prompt **duy nhất** được phép chạm vào `src/theme/tokens.ts`. Chạy một mình, một phiên riêng, trước CL-01.

```
[CONTEXT]
Dự án đã có đủ 81 module logic frontend nhưng chưa có tầng giao diện. Nhiều module logic đang đọc src/theme/tokens.ts — đặc biệt P-06 (bảy chế độ tô màu theo dữ liệu) và P-07 (chú giải tự sinh và kiểm tương phản) — nhưng chưa prompt nào tạo hoặc kiểm file đó.
Mục tiêu của prompt này: chốt một nguồn màu duy nhất cho cả code logic lẫn code giao diện, rồi dựng khung Tailwind và trang trưng bày.

[TRẠNG THÁI CẦN XÁC ĐỊNH TRƯỚC KHI VIẾT]
Trước khi sinh bất kỳ dòng nào, hãy mở src/theme/tokens.ts và báo cáo:
- File có tồn tại không.
- Nó đang có bao nhiêu khoá màu, và những khoá nào P-06/P-07 đang import.
- Khoá nào thiếu so với bảng token của Quiet Blueprint v1.1 ở DS-00.
Báo cáo xong mới làm tiếp. Nếu file đang chứa màu bịa ra để cho qua typecheck, nói rõ khoá nào.

[LOGIC ĐÃ CÓ — PHẢI GIỮ NGUYÊN GIAO DIỆN HÀM]
- P-06 src/lib/coloring: bảy chế độ tô màu theo dữ liệu. Đang import khoá màu từ src/theme/tokens.ts.
- P-07 src/lib/coloring/legend.ts: chú giải tự sinh và kiểm tương phản.
- A-01 src/lib/motion/tokens.ts: bảng thời lượng 120 / 180 / 240 / 340ms, ba đường cong dịu, useReducedMotion.
Đổi tên khoá màu là hành vi cấm — sẽ làm hỏng P-06 và P-07. Chỉ được **bổ sung** khoá thiếu và **sửa giá trị sai**, không đổi tên, không xoá.

[ĐỌC FILE NÀO]
- src/theme/tokens.ts, src/lib/coloring/**, src/lib/motion/tokens.ts
- tailwind.config.ts nếu đã có, package.json

[TASK]
1) Hoàn thiện src/theme/tokens.ts thành nguồn màu duy nhất, đúng 38 token của Quiet Blueprint v1.1 ở DS-00: nền và bề mặt, đúng hai viền, ba bậc chữ, một màu nhấn kèm 4 biến thể, nhóm canvas, nhóm vật liệu, đúng ba màu trạng thái kèm ba token chữ tối đi kèm. Xuất kèm bảng chữ, bo góc, bóng và khoảng cách.
2) Sinh src/theme/tokens.css **từ** file TypeScript trên, không gõ tay lần hai. Có khối [data-theme="dark"].
3) Viết tailwind.config.ts ánh xạ token sang tên ngữ nghĩa: bg-app, bg-surface, bg-sunken, border-hairline, text-primary, accent, state-verified… Cấm để lọt màu mặc định của Tailwind vào lớp tiện ích được dùng.
4) Dựng route /design-system: ô màu 64×64 đặt cạnh ví dụ dùng thật, thang chữ, khoảng cách, bo góc, bóng, và một khu chơi chuyển động đọc thẳng từ src/lib/motion/tokens.ts.
5) Viết một bài kiểm tự động đọc mọi cặp chữ trên nền trong bảng token và khẳng định tương phản: chữ thân 15px ≥ 7:1, chữ 13px trên nền trạng thái ≥ 4,5:1.

[CẤM TUYỆT ĐỐI]
- Không đổi tên hoặc xoá khoá màu đang được P-06, P-07 import.
- Không tạo nguồn màu thứ hai. tokens.css sinh ra từ tokens.ts, không viết tay.
- Không gradient, không màu ngoài 38 token.
- Không đụng vào src/lib/motion/tokens.ts — bảng thời lượng đã chốt ở A-01 là 120/180/240/340ms. Nếu cần mốc 700ms cho thanh tiến độ, hãy dừng lại và báo rằng đó là một prompt bổ sung cho nhóm A, không tự thêm.
- Không dựng component nào trong prompt này. Đây chỉ là tầng token.

[DELIVERABLES]
- src/theme/tokens.ts (hoàn thiện), src/theme/tokens.css (sinh tự động), src/theme/generate-css.ts
- tailwind.config.ts
- src/routes/design-system/** và một mục trong src/routes.tsx
- src/theme/__tests__/contrast.test.ts

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- In bảng đối chiếu: khoá màu trước và sau, đánh dấu khoá nào được thêm, khoá nào bị sửa giá trị.
- Chạy lại test của P-06 và P-07 → vẫn xanh. Nếu đỏ thì đã đổi tên khoá, phải hoàn lại.
- In kết quả 12 phép đo tương phản kèm số thật.
- Mở /design-system: đếm số màu nhấn thấy được → đúng 1. Đếm số màu trạng thái → đúng 3.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, src/screens/**, AGENTS.md.
  Ngoại lệ duy nhất của toàn bộ tài liệu này: prompt DS-01 được sửa src/theme/tokens.ts.
```

---

# PHẦN 1.5 — CL-01 → CL-07: Thư viện thành phần (34 thành phần)

Bảy prompt này đã được **viết lại** so với bản gốc: bản gốc ra đời khi chưa có tầng logic, nên nó bảo component tự chống rung, tự lưu localStorage, tự đếm giờ hoàn tác. Giờ những thứ đó đã có module riêng — component chỉ được **hiển thị**, không được **giữ hành vi**.

**Luật chung của cả bảy prompt:**

- Component là **thuần hiển thị và tương tác cục bộ**. Không gọi mạng, không tự lưu, không tự chống rung, không tự đếm ngược, không tự tính màu theo dữ liệu.
- Mọi thời lượng đọc từ `src/lib/motion/tokens.ts` (A-01). Cấm số thời lượng viết thẳng.
- Mọi màu đọc từ `src/theme/tokens.ts` qua lớp tiện ích Tailwind ngữ nghĩa. Cấm mã màu thô.
- Mỗi prompt kết thúc bằng một route demo `/design-system/<tên>` hiển thị **mọi biến thể × mọi trạng thái**.
- Không được import `src/domain`, `src/api`, `src/store`. Component nhận dữ liệu qua props.
- Chạy đúng thứ tự CL-01 → CL-07, mỗi prompt một phiên.

---

## CL-01 — Button, IconButton, SegmentedControl, Toggle

```
[CONTEXT]
Bốn thành phần cơ sở, xuất hiện trên cả 47 màn, nên phải đúng tuyệt đối trước khi dựng bất cứ thứ gì khác.
Người dùng: kỹ sư và nhân viên vận hành nhấn hàng trăm lần mỗi phiên. Vùng bấm phải rộng rãi, phản hồi phải tức thì, và không gì được xê dịch bố cục khi trỏ chuột.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- A-01 src/lib/motion/tokens.ts: nhấn 120ms, trượt con chạy 340ms, useReducedMotion.
- I-01 src/lib/input/shortcutRegistry: nguồn duy nhất của phím tắt. Prop `shortcut` nhận **mã phím tắt**, component tra chuỗi hiển thị từ sổ đăng ký, không nhận chuỗi tự do.

[ĐỌC FILE NÀO]
- src/theme/tokens.ts, src/lib/motion/tokens.ts, src/lib/input/shortcutRegistry.ts

[THÀNH PHẦN]
1. **Button** — biến thể: primary (nền accent, chữ trắng, không viền) · secondary (nền trắng, viền 1px --border-default) · ghost (trong suốt, chữ --text-secondary, trỏ chuột thì nền --bg-hover) · danger (nền #F9EFED, chữ --state-violation-text, viền 1px #E8CFC9). Kích thước: sm 32 / đệm ngang 12, md 36 / 16, lg 40 / 20. Bo 8. Biểu tượng dẫn đầu 18, khe 8. Props: variant, size, icon, iconOnly, loading, disabled, shortcut.
   - loading: biểu tượng đổi thành vòng xoay 18, **giữ nguyên nhãn và nguyên chiều rộng**.
   - disabled: độ mờ 0,4, không đổi màu. Lý do vô hiệu **không** đặt trong tooltip mà là chữ bên cạnh.
   - shortcut: hiện chip Kbd bên phải, chữ đều 13 --text-muted, và cùng phím tắt đó xuất hiện trong tooltip.
2. **IconButton** — vuông 36 (vùng bấm 40 bằng lề âm), bo 8, biểu tượng 18 nét 1,5. Trạng thái đang chọn dùng nền --accent-wash với biểu tượng --accent. Không bao giờ nền đen hay xám.
3. **SegmentedControl** — rãnh --bg-sunken, bo 8, đệm trong 4, cao 38. Con chạy là thẻ trắng có bóng nghỉ, trượt giữa các mục bằng layoutId. Hỗ trợ một ô màu 12 đứng trước nhãn, dùng cho độ dày tường 110 / 220 / 330 mm.
4. **Toggle** — rãnh 44×24, núm 20, bo 999. Tắt: --bg-sunken. Bật: --accent.
   - Lạc quan: lật ngay. Nếu hàm bất đồng bộ do bên ngoài truyền vào trả về lỗi thì trượt ngược lại và gọi onError. **Component không tự thử lại, không tự lưu** — việc đó thuộc D-04 và D-07 ở tầng gọi.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Nhấn: scale(0.985), mốc 120ms của A-01.
- Trỏ chuột lên secondary và ghost: đổi nền 120ms, không nâng.
- Tiêu điểm nhìn thấy: vòng 2px --accent lệch 2px, phóng từ 0,96 lên 1 trong 120ms.
- Con chạy SegmentedControl: layout animation 340ms, easing cubic-bezier(0.32,0.72,0,1).
- Tooltip: hiện sau 400ms, bo 12, bóng nổi, gồm nhãn và chip phím tắt.
- Giảm chuyển động: bỏ phóng và trượt, giữ chuyển màu.

[TRẠNG THÁI]
Mặc định · trỏ chuột · đang nhấn · tiêu điểm nhìn thấy · đang tải · vô hiệu · đang chọn.

[CẤM TUYỆT ĐỐI]
- Không nút nào thấp dưới 32 hoặc bo dưới 8.
- Trạng thái đang tải không được đổi chiều rộng nút.
- Màu nền chỉ gồm: accent, trắng, trong suốt, và nền cảnh báo. Không có màu thứ năm.
- Không nhận chuỗi phím tắt tự do — chỉ nhận mã tra từ I-01.
- Không viết số thời lượng thẳng trong file.

[DELIVERABLES]
- src/components/ui/{Button,IconButton,SegmentedControl,Toggle}.tsx
- src/routes/design-system/controls.tsx — lưới mọi biến thể × mọi trạng thái

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- Mọi thành phần tới được bằng Tab, kích hoạt bằng Enter và Space. Báo cáo kết quả thử.
- grep số có đuôi "ms" trong bốn file → rỗng.
- Bật loading trên nút dài nhất và nút ngắn nhất, in chiều rộng trước và sau → chênh lệch phải bằng 0.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

---

## CL-02 — Input, NumericField, Select, Combobox, FieldRow

```
[CONTEXT]
Tầng nhập liệu. Phần lớn giá trị là số kỹ thuật theo milimét và được tự lưu, không có nút Lưu.
Người dùng: người duyệt đang sửa kết quả AI. Họ Tab qua các ô, gõ một số, và mong nó được lưu mà không phải xác nhận gì.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- P-01 src/lib/format: định dạng số, độ dài, diện tích, góc. NumericField **hiển thị** bằng P-01, không tự nối chuỗi số.
- D-07 src/lib/autosave: cơ chế chống rung 800ms nằm ở đây. Component **chỉ nhận** prop trạng thái lưu và vẽ hiệu ứng nháy — **tuyệt đối không tự đặt setTimeout 800ms**.
- T-04 src/api/schemas và L-03 src/lib/errors: nguồn của thông báo lỗi. Component chỉ nhận chuỗi lỗi qua prop, không tự sinh câu.
- A-01 tokens; I-02 src/lib/input: quản lý tiêu điểm.

[ĐỌC FILE NÀO]
- src/lib/format/**, src/lib/autosave/index.ts, src/lib/errors/index.ts, src/theme/tokens.ts, src/lib/motion/tokens.ts

[THÀNH PHẦN]
1. **Input** — cao 38, bo 8, viền 1px --border-default, nền trắng, vòng tiêu điểm 2px --accent lệch 2px. Có khe trước và khe sau. Khe sau dùng cho đơn vị (mm, m², %) bằng chữ đều 13 --text-muted, **không bao giờ nằm trong chuỗi người dùng gõ**.
2. **NumericField** — chữ đều, giá trị căn phải, mũi tên tăng giảm chỉ hiện khi trỏ chuột, tăng bằng phím mũi tên (Shift = ×10), kẹp min/max. Định dạng hiển thị gọi P-01 — không tự chèn dấu phân cách nghìn.
3. **Select** — nút mở cao 38, mũi tên 18, thực đơn là thẻ trắng bo 12 bóng nổi, đệm 8, mục cao 36 bo 8, mục đang chọn có dấu tích và nền --bg-selected.
4. **Combobox** — như Select, thêm ô tìm trong thực đơn, lọc mờ, di chuyển bằng bàn phím, và trạng thái không kết quả ghi "Không tìm thấy kết quả" kèm chính chuỗi vừa gõ.
5. **FieldRow** — bố cục panel thuộc tính: nhãn 40% bên trái, điều khiển 60% bên phải, hàng cao 36, ngăn bằng nét mảnh, không viền bao ngoài.
6. **Lớp hiển thị lỗi** — chữ lỗi nằm ngay dưới ô, 13/18 màu --state-violation-text, có chấm 6px --state-violation, viền ô đổi sang --state-violation. Thêm biến thể gợi ý màu --text-muted, ví dụ "Giá trị thường nằm trong khoảng 8 – 20 mm/px".

[NỐI LOGIC]
- Prop `saveState` nhận một trong: nghỉ · đang lưu · vừa lưu · lỗi lưu. Khi chuyển sang "vừa lưu" thì nền ô nháy #EEF4EF trong 400ms rồi tắt. Component **không quyết định khi nào lưu**.
- Prop `error` nhận chuỗi đã dịch sẵn từ L-03. Component không tự viết câu lỗi, không tự kiểm tra bằng regex.
- Giá trị hiển thị đi qua P-01. Giá trị đang gõ thì để nguyên, chỉ định dạng khi rời ô hoặc khi đặt bằng lệnh.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Số đặt bằng lệnh từ bên ngoài thì **chạy số** trong 240ms; số do người dùng gõ thì không bao giờ chạy.
- Vòng tiêu điểm hiện trong 120ms.
- Thực đơn Select mở bằng phóng 0,98 → 1 và dịch lên 4px, 180ms.
- Esc trả ô về giá trị đã ghi nhận gần nhất.

[TRẠNG THÁI]
Rỗng (chữ mờ gợi ý --text-muted) · đang gõ · đã ghi nhận · sai · vô hiệu · chỉ đọc (**bỏ viền**, chỉ còn giá trị) · đang tải (thanh khung xương đúng chiều cao ô).

[CẤM TUYỆT ĐỐI]
- Không tự đặt setTimeout để chống rung. Không tự lưu.
- Không tự định dạng số bằng toLocaleString. Chỉ gọi P-01.
- Không tự sinh câu lỗi.
- Đơn vị không bao giờ là một phần của chuỗi sửa được.
- Chế độ chỉ đọc bỏ viền chứ không làm xám chữ.

[DELIVERABLES]
- src/components/ui/{Input,NumericField,Select,Combobox,FieldRow}.tsx
- src/routes/design-system/fields.tsx

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- grep "setTimeout\|toLocaleString\|Intl.NumberFormat" trong năm file → rỗng.
- Mọi giá trị số hiển thị bằng chữ đều và căn phải. Chụp một FieldRow để đối chiếu.
- Tab qua toàn bộ trang demo → thứ tự tiêu điểm trùng thứ tự nhìn thấy. In thứ tự ra.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

---

## CL-03 — Table, TreeItem, Badge, ConfidenceMeter

```
[CONTEXT]
Tầng danh sách và duyệt. Đây là nơi hiển thị kết quả AI mà con người phải xác nhận từng cái một.
Người dùng: người duyệt đang quét 48 đoạn tường được nhận diện, sắp theo độ tin cậy, và duyệt theo lô.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- P-06 src/lib/coloring: bảy chế độ tô màu theo dữ liệu. **Màu của ConfidenceMeter lấy từ đây**, không tự chọn ngưỡng màu trong component.
- P-01, P-02 định dạng số và thời gian.
- D-05 src/lib/mutations: vé hoàn tác 8000ms. Bảng chỉ **phát ý định xoá**, không tự dựng cơ chế hoàn tác.
- S-10, S-11 src/lib/selection: mô hình vùng chọn và đồng bộ chọn giữa 2D, 3D và danh sách. Bảng nhận vùng chọn qua props và phát sự kiện, **không tự giữ trạng thái chọn toàn cục**.
- A-01 tokens.

[ĐỌC FILE NÀO]
- src/lib/coloring/**, src/lib/format/**, src/lib/selection/index.ts, src/theme/tokens.ts, src/lib/motion/tokens.ts

[THÀNH PHẦN]
1. **Table** — hàng 40, chỉ có nét mảnh #EFEBE4 giữa các hàng, không viền bao ngoài, không sọc ngựa vằn, không đường kẻ dọc. Đầu bảng dính cao 40 nền --bg-sunken, nhãn 13/18/600 chữ thường. Cột sắp xếp được (mũi tên hiện khi trỏ chuột, giữ lại khi đang sắp). Cột hộp kiểm, chọn nhiều bằng Shift. Dải tóm tắt dính đáy hiện "12/48 tường đã duyệt" và các hành động theo lô khi có hàng được chọn.
   - Trỏ chuột hàng: nền --bg-hover và một vạch 2px --accent mọc ra từ mép trái trong 120ms.
   - Hàng đang chọn: nền --bg-selected và vạch 2px --accent giữ nguyên bên trái.
   - Dữ liệu mẫu một hàng: W-014 | 220 mm | tin cậy 0,71 | Tầng 01 | Chưa duyệt.
2. **TreeItem** — cao 32, bo 8, thụt 16 mỗi cấp, mũi tên 18 xoay 90 độ trong 180ms, tuỳ chọn nút con mắt bật tắt lớp, tuỳ chọn ô màu 12, và badge đếm bằng chữ đều 13 --text-muted.
3. **Badge** — **không bao giờ tô đặc**. Cấu trúc: chấm 6px màu trạng thái gốc + nhãn 13 màu token chữ tương ứng, nền là màu nhạt của trạng thái, bo 6, cao 24, đệm ngang 8. Đúng ba biến thể trạng thái, cộng một biến thể trung tính dùng --bg-sunken và --text-secondary.
4. **ConfidenceMeter** — rãnh 4px bo 999 rộng 64, kèm số bằng chữ đều 13. **Màu phần đầy do P-06 quyết định**, component chỉ vẽ. Dưới ngưỡng thì hàng có thêm lớp gạch chéo 45 độ 2px ở 6% độ mờ. Trên ngưỡng thì phần đầy là --text-muted, **không phải xanh lá** — xanh lá nghĩa là người đã duyệt, không bao giờ nghĩa là máy tự tin.

[NỐI LOGIC]
- Vùng chọn nhận qua prop và phát ra qua callback, khớp giao diện của S-10/S-11.
- Ngưỡng và màu tin cậy đọc từ P-06. Không viết số 0,75 vào component.
- Hành động xoá phát sự kiện lên trên; tầng gọi mới dựng vé hoàn tác của D-05.
- Bộ đếm "12/48" nhận qua prop, không tự đếm từ mảng.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Sắp xếp: hàng đổi chỗ bằng layout animation 240ms.
- Duyệt theo lô: các hàng được chọn nháy #EEF4EF trong 400ms, badge chuyển sang đã duyệt, bộ đếm chạy số từ 12 lên 24 trong 240ms.
- Bàn phím: mũi tên di chuyển hàng đang tiêu điểm, Space chọn, Enter mở hàng ở panel phải, phím L bật tắt lớp trên TreeItem đang tiêu điểm. Tất cả khai qua I-01.

[TRẠNG THÁI]
Rỗng (khung trống dạy nghề, đúng một nút chính) · đang tải (8 hàng khung xương đúng chiều cao thật) · một phần (hàng đã tải cộng dải cảnh báo cho trang lỗi) · lỗi · xong · không có quyền · thu gọn (chỉ còn hai cột đầu).

[CẤM TUYỆT ĐỐI]
- Xanh lá không bao giờ chỉ độ tin cậy của máy, chỉ chỉ việc người đã duyệt.
- Không sọc ngựa vằn, không đường kẻ dọc, không viền bao ngoài bảng.
- Xoá một hàng không được mở hộp thoại xác nhận.
- Không viết ngưỡng tin cậy trong component.
- Nhãn đầu bảng viết thường.

[DELIVERABLES]
- src/components/ui/{Table,TreeItem,Badge,ConfidenceMeter}.tsx
- src/routes/design-system/lists.tsx — gieo sẵn 48 hàng tường mẫu

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- grep "0.75\|0,75\|#6B9A79" trong ConfidenceMeter.tsx → rỗng.
- In màu thực tế của thanh tin cậy ở 0,71 và 0,80 → phải khác nhau và phải khớp kết quả P-06 tính.
- Chụp bảng, che hết chữ → vẫn phân biệt được hàng đã chọn và hàng chưa.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

---

## CL-04 — AppShell, Panel, Breadcrumb, StatusBar, CommandPalette, DevStateSwitcher

```
[CONTEXT]
Khung chứa mọi màn làm việc. Sai ở đây thì cả 47 màn đều cứng.
Người dùng: kỹ sư mở ứng dụng cả ngày, cần canvas rộng nhất có thể mà vẫn không mất phương hướng.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- S-02 src/store: bốn lát trạng thái phiên làm việc. **Trạng thái gấp panel lưu vào lát phiên này**, không lưu localStorage.
- I-01 src/lib/input/shortcutRegistry: nguồn duy nhất của mọi phím tắt. CommandPalette đọc danh sách lệnh từ đây.
- I-02 src/lib/input: bẫy tiêu điểm cho bảng lệnh.
- D-08 src/lib/autosave/useSaveIndicator: chuỗi "Đã lưu lúc 14:32". StatusBar **chỉ hiển thị**, không tự dựng chuỗi thời gian.
- M-02 src/domain/units: tỷ lệ mm/px hiển thị trên StatusBar.
- P-04 src/lib/screen-state, P-05 ranh giới lỗi: DevStateSwitcher đọc bộ máy bảy trạng thái từ đây, không tự định nghĩa lại danh sách trạng thái.
- A-01 tokens.

[ĐỌC FILE NÀO]
- src/store/session.ts, src/lib/input/**, src/lib/autosave/useSaveIndicator.ts, src/domain/units/index.ts
- src/lib/screen-state/**, src/theme/tokens.ts, src/lib/motion/tokens.ts

[BỐ CỤC]
Panel là thẻ trắng thuần bo 12, bóng 0 1px 2px rgba(43,42,40,0.04), trôi trên --bg-app với khe 8 ở mọi phía kể cả mép cửa sổ. **Không panel nào có viền. Không có đường kẻ dọc nào trong toàn bộ khung.**
- Thanh trên 56: logo · tên dự án h3 · breadcrumb "Dự án > Tầng 01 > Lớp tường" · khoảng đệm · nút mở bảng lệnh kèm chip Kbd · chuông · ảnh đại diện 28.
- Ray công cụ 56, biểu tượng 20, nhóm căn giữa dọc và một nút trợ giúp ghim đáy. Công cụ đang chọn dùng --accent-wash với biểu tượng --accent. Mỗi biểu tượng có tooltip kèm phím tắt.
- Panel trái 280, đệm 20, các mục cách nhau 24, mỗi mục có nhãn 13/18/600 chữ thường.
- Canvas chiếm phần còn lại, tối thiểu 640, bo 16, thụt 12 trong bề mặt trắng của chính nó.
- Panel phải 344, đệm 20.
- Thanh trạng thái 32 trên --bg-app, chứa **đúng ba thứ**: toạ độ con trỏ bằng chữ đều · chip tỷ lệ "12 mm/px" · trạng thái lưu "Đã lưu lúc 14:32". Không có thứ tư. Không có "System Ready".

[THÀNH PHẦN]
1. **AppShell** — CSS grid, hai panel bên gấp được, trạng thái gấp ghi vào lát phiên của S-02.
2. **Panel** — thẻ trắng, đầu dính tuỳ chọn (h3 và khe hành động), thân cuộn được có mặt nạ mờ hai đầu khi nội dung tràn.
3. **Breadcrumb** — mỗi cấp là một nút mở thực đơn, cấp cuối là chữ thường; dấu ngăn là mũi tên 14 màu --text-muted.
4. **StatusBar** — như trên; nhấn chip tỷ lệ thì mở màn hiệu chỉnh tỷ lệ S-11.
5. **CommandPalette** — Cmd+K, hộp thoại giữa màn rộng 560, bo 16, bóng hộp thoại. Tìm mờ trên dự án, tầng, lớp, đối tượng và lệnh. **Danh sách lệnh lấy từ I-01, không viết tay.** Kết quả gom nhóm, nhãn nhóm chữ thường. Mũi tên di chuyển, Enter chạy, Esc đóng.
6. **DevStateSwitcher** — chỉ dựng khi NODE_ENV khác production. Chip 32 gấp lại ở góc phải dưới, mở ra khi nhấn. Danh sách trạng thái đọc từ P-04. Khi gấp lại không được che nội dung canvas.

[NỐI LOGIC]
- Gấp panel → ghi vào S-02. Cấm localStorage, cấm useState riêng ở tầng khung.
- Chuỗi trạng thái lưu → D-08. Cấm tự định dạng giờ.
- Chip tỷ lệ → M-02. Cấm tự tính mm/px.
- Danh sách lệnh và mọi phím tắt → I-01. Cấm gắn keydown trực tiếp.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Gấp panel: chiều rộng chuyển trong 340ms với easing chính; nội dung mờ đi trong 120ms đầu nên chữ không bao giờ thấy nhảy dòng.
- Thực đơn breadcrumb: phóng 0,98 → 1 trong 180ms.
- Bảng lệnh: lớp phủ rgba(43,42,40,0.28) mờ vào 240ms, hộp phóng 0,98 → 1.
- Chỉ báo lưu: khi lưu xong, chữ hoà tan từ "Đang lưu" sang "Đã lưu lúc 14:32" trong 240ms.
- Phím tắt: Cmd+K bảng lệnh, [ và ] đổi tầng, 2 và 3 đổi 2D/3D, ? mở bảng phím tắt. Tất cả khai qua I-01.

[TRẠNG THÁI]
Rỗng (chưa nạp dự án, canvas hiện khung trống dạy nghề) · đang tải (panel khung xương) · một phần · lỗi (dải cảnh báo trên cùng, khung vẫn dùng được) · xong · không có quyền · thu gọn (ẩn cả hai panel, canvas tràn chiều rộng, hiện một cụm công cụ trôi bo 999 bóng nổi ở giữa đáy).

[CẤM TUYỆT ĐỐI]
- Không localStorage ở bất kỳ đâu trong khung.
- Thanh trạng thái đúng ba mục, không nhuộm màu trạng thái.
- Không viết tay danh sách lệnh hay danh sách phím tắt.
- DevStateSwitcher không được lọt vào bản dựng production.
- Không nhãn nào viết hoa toàn phần.

[DELIVERABLES]
- src/components/shell/{AppShell,Panel,Breadcrumb,StatusBar,CommandPalette,DevStateSwitcher}.tsx
- src/routes/design-system/shell.tsx

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- grep "localStorage" trong src/components/shell → rỗng.
- Nheo mắt nhìn trang demo: phải thấy vài tấm trắng trôi trên nền giấy ấm, không phải một lưới ô. Đếm số đường kẻ nhìn thấy → dưới 10.
- Đối chiếu số lệnh trong bảng lệnh với số mục của shortcutRegistry → phải bằng nhau, in cả hai số.
- Dựng bản production và grep DevStateSwitcher trong gói xuất ra → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

---

## CL-05 — Lớp phủ canvas: chú giải, cụm thu phóng, bản đồ nhỏ, nhãn đo, gizmo

```
[CONTEXT]
Mọi thứ trôi bên trên bản vẽ 2D hoặc mô hình 3D. Đây là cách mã hoá tường bằng ba bậc xám trở nên đọc được.
Người dùng: người duyệt cần đọc độ dày, vị trí và tỷ lệ mà không rời khỏi bản vẽ.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- P-06 bảy chế độ tô màu và P-07 chú giải tự sinh. **WallThicknessLegend hiển thị chú giải do P-07 sinh ra**, không viết tay ba dòng 110/220/330.
- M-15 src/domain/measure: phép đo 2D và 3D. MeasurementLabel chỉ vẽ kết quả, không tự tính khoảng cách.
- R-09 src/lib/three/interaction: bắn tia, di chuột, tra ngược đối tượng. R-10: tay nắm biến đổi và **phát lệnh khi thả**. TransformGizmo là lớp hiển thị của R-10, không tự áp biến đổi vào dữ liệu.
- S-11 src/lib/selection: đồng bộ vùng chọn giữa 2D, 3D và danh sách. SelectionHalo và việc cuộn hàng vào tầm nhìn đều đi qua đây.
- R-06 ba chế độ máy quay, A-01 tokens.

[ĐỌC FILE NÀO]
- src/lib/coloring/**, src/domain/measure/**, src/lib/three/interaction/**, src/lib/selection/**, src/theme/tokens.ts

[THÀNH PHẦN]
1. **WallThicknessLegend** — góc trái dưới. Mỗi dòng một ô màu 12 bo 4 kèm chữ đều. Nội dung dòng do P-07 sinh. Nhấn một dòng thì cô lập tường độ dày đó và làm mờ phần còn lại xuống 15%. Luôn hiện khi lớp Tường đang bật.
2. **ZoomCluster** — góc phải dưới, bo 999, gồm trừ, phần trăm bằng chữ đều, cộng, vừa màn hình và về 1:1. Độ mờ 0,4 lúc nghỉ, lên 1,0 khi con trỏ vào trong 120px, chuyển 180ms.
3. **MiniMap** — góc phải trên, 160×120, bo 12, vẽ toàn mặt bằng với khung nhìn hiện tại là hình chữ nhật 1px --accent. Kéo được.
4. **MeasurementLabel** — bám con trỏ khi đang đo: chữ đều 13 trên viên thuốc trắng bo 999, hiện khoảng cách trực tiếp theo milimét. **Số lấy từ M-15.** Khi chốt thì neo vào trung điểm đoạn đo với đường dẫn 1px --accent.
5. **TransformGizmo** — chỉ 3D. Ba trục; trục đang kéo dày lên 3px, hai trục kia xuống 0,3 độ mờ; số bằng chữ đều bám con trỏ; bắt điểm dùng đường cong mềm. Khi thả, **phát sự kiện lên R-10**, không tự ghi vào dữ liệu.
6. **SelectionHalo** — đối tượng đang chọn có viền 2px --accent và nền --accent 6%; hàng tương ứng ở panel bên tự cuộn vào tầm nhìn qua S-11.
7. **ContextMenu** — chuột phải, thẻ trắng bo 12, mục cao 36, mục nguy hiểm chỉ đổi **màu chữ** sang --state-violation-text.

[NỐI LOGIC]
- Màu tường, màu lớp, chú giải: P-06 và P-07. Cấm bảng màu cứng trong component.
- Khoảng cách và diện tích: M-15. Cấm tính toán hình học trong lớp phủ.
- Biến đổi hình học: chỉ phát ý định, R-10 dựng lệnh, S-05/S-06 lo hoàn tác.
- Vùng chọn và nổi bật liên kết hai chiều: S-11.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Bật tắt lớp: đối tượng mờ dần kèm dịch dọc 4px trong 240ms, so le 24ms.
- Nổi bật liên kết: trỏ vào hàng ở panel thì đối tượng trên canvas sáng lên trong 180ms và ngược lại, không nhấp nháy.
- Nhịp vi phạm: viền đập từ 1 xuống 0,45 rồi về 1 trong 1,8 giây, tối đa ba nhịp, rồi giữ viền tĩnh 2px.
- Con trỏ đổi theo công cụ: chữ thập khi vẽ, bàn tay và bàn tay nắm khi kéo màn, thước khi đo. Khai qua I-03.
- Quán tính xoay trong 3D lấy từ R-06, không tự viết hệ số giảm chấn.

[TRẠNG THÁI]
Rỗng (chưa nạp bản vẽ) · đang tải (mặt bằng hiện dần 240ms kèm một đường quét) · một phần (lớp còn đang xử lý thì gắn chip cần chú ý lên đúng lớp đó) · lỗi · xong · không có quyền (canvas ở 0,4 độ mờ kèm thẻ giải thích) · thu gọn (lớp phủ co lại còn biểu tượng).

[CẤM TUYỆT ĐỐI]
- Che hết chữ vẫn phải phân biệt được ba độ dày tường trên canvas.
- Chú giải phải hiện bất cứ khi nào tường hiện.
- Không lớp phủ nào có bóng màu hoặc gradient.
- Lớp phủ không bao giờ che 60% chính giữa canvas.
- Không tính hình học, không ghi dữ liệu trong bất kỳ file nào của prompt này.

[DELIVERABLES]
- src/components/canvas/{WallThicknessLegend,ZoomCluster,MiniMap,MeasurementLabel,TransformGizmo,SelectionHalo,ContextMenu}.tsx
- src/routes/design-system/overlays.tsx — trên một mặt bằng giả

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- grep "Math.sqrt\|Math.hypot\|#B3ACA1" trong src/components/canvas → rỗng.
- Chụp canvas ở chế độ đen trắng → ba bậc xám tường vẫn phân biệt được. In ảnh.
- Đo diện tích lớp phủ che canvas ở 1440 → không quá 40% và không chạm vùng giữa.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

---

## CL-06 — Toast hoàn tác, Skeleton, EmptyState, InlineAlert, PipelineStepper, ProgressOverlay

```
[CONTEXT]
Tầng phản hồi. Đây là thứ thay thế hộp thoại xác nhận, vòng xoay và mã lỗi.
Người dùng: người vừa xoá nhầm một đoạn tường, hoặc đang chờ bốn phút cho pipeline AI chạy xong.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-05 src/lib/mutations: **vé hoàn tác và kênh thông báo, hạn 8000ms**. Toast là lớp hiển thị của kênh này — **không tự đếm ngược, không tự giữ hàng đợi**. Nhận vé, vẽ thanh rút, gọi lại hàm hoàn tác của vé.
- T-08 src/lib/realtime: **mô hình tiến độ xử lý AI sáu giai đoạn**. PipelineStepper đọc mô hình này, **không tự khai danh sách bước**.
- L-03 src/lib/errors: câu lỗi và mã kỹ thuật. InlineAlert nhận chuỗi đã dịch, không tự viết.
- P-04, P-05 src/lib/screen-state: bảy trạng thái và ranh giới lỗi.
- P-02 định dạng thời gian trôi qua và thời gian còn lại.
- A-01 tokens.

[ĐỌC FILE NÀO]
- src/lib/mutations/undo.ts, src/lib/realtime/progress.ts, src/lib/errors/index.ts
- src/lib/screen-state/**, src/lib/format/**, src/theme/tokens.ts, src/lib/motion/tokens.ts

[THÀNH PHẦN]
1. **Toast** — góc phải dưới, thẻ trắng bo 12 bóng nổi rộng 320: chấm trạng thái 6px · thông điệp 15px · nút chữ "Hoàn tác" · thanh đếm 2px rút cạn trong 8 giây. Xếp chồng tối đa ba, cái cũ nén còn 4px ló ra. Trỏ chuột thì **báo cho D-05 tạm dừng vé**, không tự dừng đồng hồ nội bộ.
2. **Skeleton** — khối --bg-sunken có hình dạng đúng như nội dung thật, một dải sáng phẳng chạy ngang trong 1,4 giây. **Không phải gradient**: một dải đặc rgba(255,255,255,0.55) di chuyển bằng transform.
3. **EmptyState** — biểu tượng nét 32 tự vẽ bằng stroke-dashoffset trong 600ms, tiêu đề h3, đúng một câu dạy việc, đúng một nút chính, và một liên kết chữ tuỳ chọn. Ví dụ: "Chưa có tầng nào. Tải lên một bản vẽ mặt bằng (.png, .jpg, .pdf, .dwg) để bắt đầu."
4. **InlineAlert** — đặt **ngay chỗ có vấn đề**, không bao giờ ở đầu trang. Nền nhạt, viền 1px màu trạng thái ở 30% độ mờ, bo 12, đệm 16: tiêu đề · một câu nguyên nhân bằng tiếng thường · tối đa hai nút · mã lỗi nhỏ bằng chữ đều căn phải dưới.
5. **PipelineStepper** — dọc, một hàng mỗi bước. **Tên bước và thứ tự đọc từ T-08.** Mỗi hàng: biểu tượng · tên bước · thời gian trôi qua hoặc còn lại bằng chữ đều · thanh tiến độ riêng. Bước xong vẽ dấu tích trong 240ms và chuyển sang --state-verified. Ba nhánh AI chạy song song hiển thị thành hàng con thụt vào.
6. **ProgressOverlay** — một đường quét 1px --accent ở 40% độ mờ chạy ngang ảnh nguồn mỗi 1,6 giây. Không glow.

[NỐI LOGIC]
- Toast đăng ký vào kênh của D-05. Cấm useState giữ hàng đợi toast riêng, cấm setTimeout 8000.
- Danh sách bước pipeline lấy từ T-08. Cấm mảng tên bước viết cứng trong component.
- Chuỗi thời gian đi qua P-02. Cấm tự tính "còn 2 phút".
- Chuỗi lỗi và mã lỗi đến từ L-03 qua prop.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Toast vào từ dưới lên 16px kèm độ mờ, 240ms; ra bằng thu chiều cao trong 180ms.
- Hoàn tác: mục được khôi phục nháy --bg-selected trong 340ms và cuộn vào tầm nhìn.
- Bước xong: dấu tích tự vẽ, nền hàng nháy #EEF4EF trong 400ms.
- Con số như thời gian trôi qua thì chạy số, không nhảy.

[TRẠNG THÁI]
Cả bảy, trình diễn trên một route demo có bộ đổi trạng thái đọc từ P-04.

[CẤM TUYỆT ĐỐI]
- Không bao giờ có vòng xoay đặt giữa trang. Khung xương phải khớp bố cục thật.
- Hành động phá huỷ không mở hộp thoại xác nhận; chỉ xoá dự án mới được giữ hộp thoại.
- Không khung trống nào ghi "Không có dữ liệu".
- Không thông báo lỗi nào chỉ hiện một con số.
- Dải sáng của Skeleton không được là CSS gradient.
- Không tự đếm ngược, không tự khai danh sách bước.

[DELIVERABLES]
- src/components/feedback/{Toast,Skeleton,EmptyState,InlineAlert,PipelineStepper,ProgressOverlay}.tsx
- src/routes/design-system/feedback.tsx

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- grep "setTimeout\|setInterval\|linear-gradient" trong src/components/feedback → rỗng.
- Đối chiếu số bước PipelineStepper hiển thị với số giai đoạn của T-08 → phải bằng nhau, in cả hai số.
- Xoá một mục trong demo → phải hoàn tác được. Báo cáo kết quả thử.
- In sáu tên bước bằng tiếng Việt đủ dấu để kiểm chính tả.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

---

## CL-07 — Slider, Checkbox, Radio, Textarea, Tabs, Avatar, Tooltip, Kbd, Modal, Drawer

```
[CONTEXT]
Nhóm điều khiển dùng chung còn lại. Mỗi cái đều được gọi đích danh trong 47 prompt màn hình, nên phải tồn tại trước khi dựng màn. Không cái nào là trang trí.
Người dùng: kỹ sư chỉnh ngưỡng bằng thanh trượt, tick ma trận thông báo, tra bảng phím tắt, và mở đúng hai loại lớp phủ — hộp thoại để rời luồng, ngăn kéo để làm một việc phụ.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- I-01 shortcutRegistry: Kbd hiển thị phím tắt tra từ đây, không nhận chuỗi tự do.
- I-02 src/lib/input: **bẫy tiêu điểm và trả tiêu điểm về nút mở**. Modal và Drawer dùng hàm này, không tự viết bẫy tiêu điểm.
- P-01 định dạng số cho viên thuốc giá trị của Slider.
- A-01 tokens và useReducedMotion.

[ĐỌC FILE NÀO]
- src/lib/input/**, src/lib/format/**, src/theme/tokens.ts, src/lib/motion/tokens.ts

[THÀNH PHẦN]
1. **Slider** — rãnh 4px bo 999 màu --bg-sunken, phần đầy --accent, núm trắng 16 viền 1px --border-default bóng nghỉ. Khi kéo, giá trị hiện trên núm bằng viên thuốc trắng chữ đều 13 bóng nổi, **số định dạng qua P-01**. Hỗ trợ min, max, step và cặp nhãn đầu cuối bằng chữ đều. Dùng cho ngưỡng AI (0,75 · 0,60 · 0,80), vị trí đối tượng dọc tường (0 đến 1), độ mờ lớp, khoảng cách tách tầng.
2. **Checkbox** — vuông 18 bo 6, viền 1,5px --border-default lúc nghỉ, khi tick thì nền --accent và dấu tích trắng tự vẽ bằng stroke-dashoffset trong 180ms. Biến thể nửa chừng vẽ một vạch 10px. Nhãn 15/24 bên phải cách 8, cả hàng cao 32 đều nhấn được.
3. **Radio và RadioGroup** — tròn 18 bo 999, chấm 6px --accent phóng 0 → 1 trong 120ms. Thêm biến thể radio biểu tượng: một hàng IconButton 36, đúng một cái được chọn bằng --accent-wash, dùng cho chiều mở cánh cửa.
4. **Textarea** — viền và bo như Input, tối thiểu 3 dòng, tự cao dần tối đa 8 dòng với chuyển 180ms, bộ đếm ký tự màu --text-muted chỉ hiện khi có giới hạn.
5. **Tabs** — hàng ngang các nút cao 36 chữ thường, --text-secondary lúc nghỉ và --text-primary khi đang chọn, với vạch chỉ báo 2px --accent trượt giữa các nút bằng layoutId. Không tab dạng hộp, không tô nền tab đang chọn.
6. **Avatar và AvatarStack** — 28 mặc định và 64 cho trang hồ sơ, bo 999, ảnh hoặc chữ cái đầu trên --bg-sunken màu --text-secondary. AvatarStack chồng lấn 8 với vòng 2px --bg-surface, hiện tối đa 3 cộng một chip đếm trung tính. Vòng hiện diện nếu có là 2px --accent, không bao giờ màu riêng theo người.
7. **Tooltip** — thẻ trắng bo 12 bóng nổi, đệm 8/12, chữ 13/18, hiện sau 400ms và biến mất ngay. Hiển thị nhãn và chip Kbd nếu có. **Tooltip không bao giờ chứa hành động và không bao giờ hiện trên điều khiển đã vô hiệu** — điều khiển vô hiệu nêu lý do bằng chữ bên cạnh.
8. **Kbd** — chip cao 20 bo 6, nền --bg-sunken, viền 1px --border-hairline, chữ đều 13 --text-secondary, rộng tối thiểu 20. Chuỗi phím lấy từ I-01.
9. **Modal** — giữa màn, các bề rộng 480 / 560 / 640, bo 16, bóng hộp thoại, đệm 24, lớp phủ rgba(43,42,40,0.28). Cấu trúc: đầu có h2 và IconButton đóng · thân cuộn được · chân có nút chìm bên trái và nút chính bên phải. Esc đóng và **giữ nguyên bản nháp**. Bẫy tiêu điểm và trả tiêu điểm về nút mở đều gọi I-02. Chỉ được dùng khi rời luồng hiện tại hoặc cho hành động không hoàn tác được, **không bao giờ trong lúc duyệt QC**.
10. **Drawer và Sheet** — ngăn kéo phải rộng 480, cao tràn trừ khe 8 mọi phía, bo 16, bóng hộp thoại, trượt vào trong 340ms với easing chính. Dưới 1024 thì cùng nội dung đó thành tấm trượt từ đáy với ba nấc 88px, 40% và 90%, kéo bằng đường cong mềm và đóng bằng kéo xuống.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo Slider: núm bám con trỏ không làm mượt, viên thuốc giá trị hiện trong 120ms, và **hậu quả cập nhật ngay trong lúc kéo**, không đợi thả.
- Checkbox và Radio: nhấn thì co còn 0,94 rồi về trong 120ms.
- Tabs: vạch chỉ báo trượt 240ms; nội dung hoà tan 180ms mà không nhảy chiều cao.
- Modal: lớp phủ mờ vào 240ms, hộp phóng 0,98 → 1; đóng thì chạy ngược trong 180ms.
- Giảm chuyển động: mọi lớp phủ thay transform bằng đổi độ mờ 120ms.

[TRẠNG THÁI]
Mặc định · trỏ chuột · đang nhấn · tiêu điểm nhìn thấy · vô hiệu · chỉ đọc · đang tải · lỗi — trình diễn cho từng thành phần trên một route demo có bộ đổi trạng thái.

[CẤM TUYỆT ĐỐI]
- Không màu ngoài danh sách token.
- Tabs dùng gạch dưới trượt, không bao giờ tab tô nền.
- Không tự viết bẫy tiêu điểm — gọi I-02.
- Esc không bao giờ phá bản nháp.
- Điều khiển vô hiệu giải thích bằng chữ bên cạnh, không bằng tooltip.
- Slider hiện hậu quả trong lúc kéo, không phải sau khi thả.

[DELIVERABLES]
- src/components/ui/{Slider,Checkbox,Radio,Textarea,Tabs,Avatar,Tooltip,Kbd}.tsx
- src/components/overlay/{Modal,Drawer}.tsx
- src/routes/design-system/controls-extra.tsx

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh.
- grep "focusTrap\|tabIndex=\"-1\"" tự viết trong Modal.tsx và Drawer.tsx → phải thấy gọi I-02, không thấy cài đặt riêng.
- Mở Modal, Tab vòng quanh → tiêu điểm không thoát ra ngoài; đóng → tiêu điểm quay về nút mở. Báo cáo kết quả.
- Thu cửa sổ xuống dưới 1024 → Drawer thành tấm trượt ba nấc. Chụp cả ba nấc.
- Thao tác toàn bộ trang demo chỉ bằng bàn phím → không kẹt ở đâu. In danh sách thành phần đã thử.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/theme/**, AGENTS.md.
```

> ✅ **Xong tầng nền.** Sau DS-01 và bảy prompt CL, mở `/design-system` và soi một lượt trước khi sang màn đầu tiên. Mọi lỗi ở tầng này sẽ được nhân bản 47 lần.

---

# PHẦN 2 — Nhóm A: Tài khoản và dự án (7 màn)

---

## S-01 — Đăng nhập và đăng ký (AuthScreen) ⭐

```
[CONTEXT]
Route /dang-nhap. Vai: khách. Đây là màn đầu tiên và là màn mẫu cho 46 màn sau — mọi thói quen tốt hay xấu ở đây sẽ bị nhân bản.
Người dùng: kỹ sư dự án hạ tầng, đăng nhập từ máy để bàn, phần lớn qua đăng nhập một lần của công ty.
Mục tiêu: vào được hệ thống trong ba thao tác; khi sai thì biết vì sao và làm gì tiếp; không mất chữ đã nhập.
Cảm giác: yên và chuyên nghiệp, không mang giọng quảng cáo. Đây là bàn vẽ được chiếu sáng tốt, không phải trang bán hàng.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI, KHÔNG VIẾT LẠI]
- L-02 src/lib/auth: đăng nhập, đăng nhập một lần, làm mới phiên, lưu thẻ, sự kiện phiên hết hạn.
- L-03 src/lib/errors: đổi lỗi sang câu tiếng Việt kèm mã kỹ thuật ngắn.
- T-04 src/api/schemas: schema đăng nhập và đăng ký.
- T-05 src/api/client.ts: gọi mạng.
- P-04 src/lib/screen-state/useScreenState: bảy trạng thái màn.
- A-01 src/lib/motion/tokens.ts: 120 / 180 / 240 / 340ms, easing cubic-bezier(0.32,0.72,0,1), cờ giảm chuyển động.
- I-01, I-02 src/lib/input: Enter gửi, thứ tự tiêu điểm, bẫy tiêu điểm.
- O-01 src/lib/telemetry: ghi sự kiện đăng nhập thành công và thất bại.

[ĐỌC FILE NÀO]
- src/lib/auth/index.ts, src/lib/errors/index.ts, src/api/schemas/index.ts
- src/lib/screen-state/useScreenState.ts, src/lib/motion/tokens.ts, src/lib/input/index.ts
- src/components/ui/{Input,Button,SegmentedControl,Checkbox}.tsx, src/components/feedback/InlineAlert.tsx

[BỐ CỤC]
Nền --bg-app, hai cột, ở 1440:
- Cột trái 45%: vùng minh hoạ trên --bg-app. Một bản vẽ mặt bằng 2D vẽ bằng nét 1px --data-axis ở độ mờ 8%, đùn dần lên thành khối 3D dạng khung dây theo vòng lặp 12 giây. Không ảnh chụp, không màu, không gradient. Đệm 48. Một câu giá trị rộng tối đa 420 và một câu phụ bên dưới.
- Cột phải 55%: căn giữa dọc một thẻ trắng --bg-surface rộng 420, bo 20, đệm 40, bóng 0 20px 48px rgba(43,42,40,0.09). Vùng nội dung trong thẻ còn 340.
Trong thẻ, từ trên xuống: logo 32 · tên sản phẩm chữ display 30/40/600 · một dòng phụ "Số hoá bản vẽ 2D thành mô hình 3D tương tác" · SegmentedControl "Đăng nhập / Đăng ký" cao 38 · các ô cách nhau 16 · nhóm cách nhau 24 · nút chính cao 40 tràn chiều rộng · vạch ngăn có chữ "hoặc" ở giữa, nét mảnh hai bên · nút phụ "Đăng nhập bằng SSO công ty" · liên kết "Quên mật khẩu".
Dưới thẻ: một dòng caption 13 --text-muted ghi số phiên bản và liên kết trạng thái hệ thống.
Dưới 1024: ẩn cột trái, thẻ căn giữa toàn màn.

[THÀNH PHẦN & DỮ LIỆU]
- Input email và mật khẩu cao 38 bo 8, ô mật khẩu có nút hiện/ẩn.
- Checkbox "Ghi nhớ đăng nhập" ở chế độ đăng nhập; ở chế độ đăng ký thay bằng một dòng điều khoản có liên kết.
- InlineAlert dùng cho mọi lỗi đăng nhập.
- Câu lỗi mẫu, lấy từ L-03 chứ không tự viết: "Email hoặc mật khẩu không đúng. Bạn có thể đặt lại mật khẩu qua email." kèm mã chữ đều nhỏ.
- Câu quá nhiều lần: "Đã sai 5 lần. Thử lại sau 60 giây." với số giây đếm ngược bằng chữ đều.
- Câu tài khoản chưa kích hoạt: "Tài khoản chưa được kích hoạt. Liên hệ quản trị viên của bạn." kèm nút "Liên hệ quản trị".
Toàn bộ chuỗi vào vi.json khoá auth.*.

[NỐI LOGIC]
- Gọi hàm đăng nhập của L-02 qua hook dựng trên T-05. View không import src/api.
- Kiểm tra ô bằng schema T-04, chạy lúc rời ô và lúc gõ sau lần lỗi đầu tiên.
- Mọi câu lỗi lấy từ L-03. Không có chuỗi lỗi nào viết cứng trong màn.
- Thành công thì quay lại đường dẫn ban đầu người dùng định vào; nếu không có thì về /.
- Ghi sự kiện qua O-01, không tự gọi endpoint đo đạc.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Thẻ vào bằng mờ dần và nâng 12px trong 340ms.
- Đổi thẻ Đăng nhập ↔ Đăng ký: con trượt của SegmentedControl chạy bằng layoutId, các ô hoà tan chéo, chiều cao thẻ chuyển mượt trong 180ms để không nhảy. Email đã nhập được giữ lại.
- Tự đặt tiêu điểm ô đầu khi vào màn. Enter gửi ở mọi ô.
- Nút đang gửi giữ nguyên nhãn và nguyên chiều rộng, khoá gửi trùng.
- Sai mật khẩu: InlineAlert hiện phía trên nút. Thẻ **không** rung.
- Xong: nút đổi sang dấu tích, nháy nhẹ 240ms rồi chuyển trang.
- Bật giảm chuyển động: minh hoạ cột trái dừng ở khung tĩnh, mọi hiệu ứng còn lại rút về hoà tan 0ms.

[BẢY TRẠNG THÁI]
1. Rỗng — form sạch, chưa gõ gì.
2. Đang tải — nút xoay, ô khoá, chiều rộng nút không đổi.
3. Một phần — SSO còn chạy nhưng đăng nhập mật khẩu tạm ngừng; giải thích ngay trong form, nút SSO thành nút chính.
4. Lỗi — sai mật khẩu; và biến thể quá nhiều lần có đếm ngược 60 giây.
5. Xong — dấu tích rồi chuyển trang.
6. Không có quyền — tài khoản tồn tại nhưng bị vô hiệu, kèm nút "Liên hệ quản trị".
7. Thu gọn — dưới 1024, ẩn cột minh hoạ.

[CẤM TUYỆT ĐỐI]
- Không modal, không toast cho lỗi đăng nhập. Chỉ InlineAlert trong form.
- Không gọi fetch, không tự lưu thẻ, không tự viết câu lỗi, không tự đếm số lần sai.
- Không tạo component mới, không màu ngoài token, không gradient kể cả trong minh hoạ.
- Không rung thẻ, không đổi màu viền ô sang đỏ đặc.
- View không import src/api, src/store.

[DELIVERABLES]
- src/screens/auth/AuthScreen/{index.ts,AuthScreen.tsx,useAuthScreen.ts,AuthScreen.container.tsx,AuthScreen.stories.tsx,AuthScreen.test.tsx}
- Cập nhật src/routes.tsx, src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7; expectVietnamese và expectNoRawColor sạch.
- Chỉ dùng Tab và Enter phải đăng nhập được. In ra thứ tự tiêu điểm thực tế: kỳ vọng email → mật khẩu → ghi nhớ → nút chính → SSO → quên mật khẩu.
- grep "fetch(" trong src/screens/auth → rỗng. grep chuỗi tiếng Việt trong .tsx → rỗng.
- Đếm số đường kẻ nhìn thấy trên màn → phải dưới 10.
- Không có nhãn viết hoa toàn phần. Thẻ bo 20 và đệm ≥ 40.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md.
```

---

## S-02 — Danh sách dự án (ProjectDashboard) ⭐

```
[CONTEXT]
Route /. Màn nhà sau khi đăng nhập.
Người dùng: quản lý dự án đang giữ 12 đến 60 công trình, cần tìm đúng một dự án thật nhanh và thấy ngay cái nào đang chờ duyệt.
Mục tiêu: quét hết danh sách trong 5 giây và nhấn một lần là vào đúng việc còn dở.
Cảm giác: vài tấm trắng trôi trên nền ấm. Nửa nhắm mắt nhìn không được thấy một lưới ô.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-01 src/lib/query/queryKeys.ts, D-02 cachePolicy (staleTime 30 giây), D-03 nạp trước khi trỏ chuột 200ms.
- P-03 src/lib/viewmodel/toViewModel.ts: đổi dữ liệu thô sang dữ liệu hiển thị.
- P-01 src/lib/format: "4 tầng · 248,60 m²"; P-02: "Sửa 2 giờ trước".
- P-04 useScreenState; A-02 stagger trễ bậc 24ms tối đa 8 mục; A-01 tokens; A-03 chạy số.
- D-05 vé hoàn tác 8000ms cho lưu trữ dự án.
- O-01 src/lib/telemetry: ghi sự kiện mở dự án.

[ĐỌC FILE NÀO]
- src/lib/query/**, src/lib/viewmodel/**, src/lib/format/**, src/lib/motion/**, src/lib/mutations/**
- src/components/ui/{Table,Badge,Input,SegmentedControl,Select,Button,Avatar,IconButton}.tsx
- src/components/feedback/{Skeleton,EmptyState,InlineAlert}.tsx, src/components/overlay/ContextMenu.tsx

[BỐ CỤC]
Ở 1440, vùng nội dung rộng tối đa 1440, đệm trang 32, nền --bg-app.
- Thanh trên 56: logo · chữ "Dự án của tôi" · ô tìm 320 · chip bảng lệnh · chuông · ảnh đại diện 28 · nút chính "Dự án mới" bên phải.
- Dải tóm tắt trên lưới: ba con số chữ đều mono-lg, nhãn chữ thường 13 bên dưới — tổng dự án · dự án chờ duyệt · số tầng đã số hoá. Đặt thẳng trên nền ấm, không ô màu, không thẻ.
- Dải lọc cao 56: SegmentedControl 4 mục "Tất cả / Đang xử lý / Cần QC / Hoàn thành"; bên phải Select sắp xếp và SegmentedControl đổi lưới hoặc bảng.
- Lưới: 3 cột ở 1440, 4 cột ở 1920, 2 cột ở 1024, khe 20, thẻ rộng tối thiểu 320.
- Chế độ bảng: hàng cao 40.

[THÀNH PHẦN & DỮ LIỆU]
Thẻ dự án cao 240:
- Vùng xem trước 132: vẽ đường bao mặt bằng bằng nét 1px trên --canvas-2d. Không bao giờ dùng ảnh chụp. Thang xám ấm.
- Tên dự án h3 một dòng, cắt bằng dấu ba chấm.
- Dòng phụ caption: "4 tầng · 2.480,00 m² · Sửa 2 giờ trước".
- Thanh tiến độ 3px kèm chữ "12/48 tường đã duyệt" khi đang xử lý hoặc đang QC.
- Hàng cuối: badge trạng thái dạng chấm và chữ (không phải viên thuốc tô đặc) · ba ảnh đại diện xếp chồng · IconButton mở menu ngữ cảnh.
Menu ngữ cảnh: Mở · Nhân bản · Đổi tên · Lưu trữ · Xoá.
Dữ liệu mẫu: 9 dự án, trong đó ba dự án có tên thật — "Toà nhà HQ Renovation" 4 tầng, "Chung cư Sunrise Block B" 12 tầng, "Nhà máy Bắc Ninh" 2 tầng — sáu dự án còn lại sinh thêm để đủ trạng thái.
Khung trống dạy nghề: "Chưa có dự án nào. Tạo dự án đầu tiên để bắt đầu số hoá bản vẽ." kèm một nút chính và một liên kết mở dự án mẫu.

[NỐI LOGIC]
- Dữ liệu qua hook query dùng đúng khoá của D-01. Không tự đặt tên khoá cache.
- Đổi bộ lọc: giữ dữ liệu cũ và làm mờ 60% trong 180ms. Tuyệt đối không nhảy về khung xương.
- Trỏ chuột vào thẻ 200ms → gọi prefetch của D-03.
- Mọi con số và mốc thời gian đi qua P-01 và P-02. Không nối chuỗi số trong JSX.
- Lưu trữ dự án dùng mutation lạc quan D-04 kèm vé hoàn tác D-05. Chỉ **xoá** mới được phép mở hộp thoại xác nhận, vì không hoàn tác được.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Thẻ hiện so le 24ms cho 8 thẻ đầu, chỉ ở lần tải đầu tiên của phiên.
- Lọc: lưới xếp lại bằng layout animation 240ms.
- Trỏ chuột: thẻ nâng -1px trong 180ms và đổi sang bóng nổi.
- Ba con số của dải tóm tắt chạy số khi vào màn, 700ms.
- Nhấn thẻ đi đúng nơi theo trạng thái: đang xử lý → màn tiến trình, cần QC → lớp tường, hoàn thành → trình xem 3D.
- Phím N tạo dự án mới. Phím mũi tên di chuyển giữa các thẻ. Cmd+K mở bảng lệnh đã lọc sẵn theo dự án.
- Ô tìm lọc ngay khi gõ, không có nút gửi.

[BẢY TRẠNG THÁI]
1. Rỗng — khung trống dạy nghề như trên.
2. Đang tải — 6 khung xương đúng kích thước thẻ thật. Không spinner giữa màn.
3. Một phần — tìm không ra kết quả, hoặc hai dự án tải hỏng: dải cảnh báo mảnh có liên kết thử lại, các thẻ còn lại vẫn hiện.
4. Lỗi — không tải được danh sách, có nút thử lại và mã lỗi nhỏ.
5. Xong — 9 thẻ.
6. Không có quyền — vai Người xem: ẩn nút "Dự án mới" và mục Xoá; thẻ không có quyền hiện mờ kèm nút "Yêu cầu truy cập".
7. Thu gọn — dưới 1024 còn 2 cột, dải lọc gấp xuống dòng.

[CẤM TUYỆT ĐỐI]
- Không ảnh thật trong vùng xem trước, chỉ sơ đồ đơn sắc thang xám ấm.
- Không thẻ nào có nền màu. Trạng thái báo bằng chấm và chữ, không dùng viên thuốc tô đặc.
- Không dùng màu "đã duyệt" cho dự án chưa có ai duyệt.
- Không tự viết khoá cache, không gọi API trong view, không tự định dạng số.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/dashboard/ProjectDashboard/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi bộ lọc ba lần liên tiếp → xác nhận không thấy khung xương, chỉ thấy mờ 180ms. Báo cáo quan sát.
- Chụp 1920 / 1440 / 1024 và đếm số cột: kỳ vọng 4 / 3 / 2.
- In 5 chuỗi đã định dạng để kiểm dấu chấm và dấu phẩy kiểu Việt.
- Đếm số đường kẻ trên màn → dưới 10. Không có nền màu trên thẻ.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-03 — Tạo dự án mới (CreateProjectModal) ⭐

```
[CONTEXT]
Hộp thoại ba bước, mở từ danh sách dự án, không có route riêng. Đây là một trong ba nơi duy nhất trong toàn sản phẩm được dùng hộp thoại, vì người dùng đang rời luồng duyệt.
Người dùng: kỹ sư đang có một thư mục ảnh quét bản vẽ và muốn bắt đầu trong dưới một phút.
Mục tiêu: khai báo xong dự án và bảng tầng mà không phải nhập lại gì ở bước sau.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-04 schema dự án và tầng: tên 3–80 ký tự, số tầng 1–50, cao độ −30 đến 300 m, chiều cao 2,0–10,0 m.
- M-11 src/domain/axes/alignFloors.ts và hàm tính cao độ tích luỹ theo chiều cao tầng.
- D-04 src/lib/mutations: tạo dự án lạc quan; D-03: làm mới danh sách sau khi tạo.
- L-03 câu lỗi; P-01 định dạng số; A-01 chuyển bước 180ms.

[ĐỌC FILE NÀO]
- src/domain/axes/**, src/lib/mutations/**, src/api/schemas/**
- src/components/overlay/Modal.tsx
- src/components/ui/{Input,NumericField,Table,Select,Toggle,Checkbox,Textarea,Stepper,FieldRow,Button}.tsx

[BỐ CỤC]
Hộp thoại rộng 560, bo 16, lớp phủ rgba(43,42,40,0.28).
- Đầu: tiêu đề h2 và chỉ báo "Bước 2 / 3" bên phải. Bên dưới là Stepper ngang: ba vòng tròn 24 đánh số, nối bằng nét mảnh 1px tự đầy dần bằng --accent khi bước hoàn thành. Nhãn ba bước: "Thông tin", "Số tầng", "Xác nhận".
- Thân: đệm 24, **chiều cao tối thiểu 320** để hộp thoại không nhảy khi đổi bước.
- Chân: "Quay lại" bên trái; "Huỷ" và nút chính bên phải.
Dưới 1024: hộp thoại tràn chiều rộng, chân dính đáy.

[THÀNH PHẦN & DỮ LIỆU]
Bước 1 — Thông tin: Input tên dự án · Input mã tự sinh từ tên nhưng sửa được · Select loại công trình (Văn phòng, Chung cư, Nhà xưởng, Trường học, Bệnh viện) · Input địa chỉ · Textarea ghi chú. Địa chỉ và ghi chú nằm dưới một khối gấp "Thông tin bổ sung".
Bước 2 — Số tầng: NumericField số tầng mặc định 4 có nút cộng trừ · Checkbox "Có tầng hầm" · bảng tầng sinh tự động, mỗi dòng gồm Input tên tầng, NumericField cao độ theo mét, NumericField chiều cao tầng · nút "Áp chiều cao này cho mọi tầng".
Giá trị mặc định: Tầng 1 cao độ 0,0 chiều cao 3,9 · Tầng 2 cao độ 3,9 chiều cao 3,6. Có tầng hầm thì thêm Tầng hầm cao độ −3,0.
Bước 3 — Xác nhận: bảng tóm tắt chỉ đọc bằng FieldRow · Checkbox "Bắt đầu tải lên bản vẽ ngay sau khi tạo" · một câu dẫn sang bước tải bản vẽ.
Câu chặn trùng cao độ: "Tầng 2 và Tầng 3 có cùng cao độ 3,9 m. Sửa một trong hai để tiếp tục." kèm nút cuộn đến dòng sai.

[NỐI LOGIC]
- Cao độ tích luỹ **luôn** gọi hàm của M-11. Tuyệt đối không cộng cao độ trong màn.
- Kiểm tra mọi ô bằng schema T-04, gắn lỗi vào đúng ô, không gom lên đầu.
- Trùng cao độ thì chặn chuyển bước và hiện dải cảnh báo nói đúng hai tầng nào.
- Tạo dự án dùng mutation lạc quan D-04, sau đó làm mới danh sách bằng bản đồ vô hiệu hoá của D-03.
- Câu lỗi lấy từ L-03; số định dạng bằng P-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Chuyển bước: trượt ngang 16px kèm hoà tan chéo, 180ms; chiều cao thân chuyển mượt nên chân không nhảy.
- Thêm dòng tầng: hiện ra bằng chuyển chiều cao và độ mờ 240ms; xoá dòng thì thu lại cùng đường cong.
- Đoạn nối của Stepper đầy dần trong 240ms.
- Nút "Tiếp tục" chỉ vô hiệu khi ô bắt buộc chưa hợp lệ, và lý do hiện ngay trong form — **không** hiện lý do bằng tooltip trên nút đã vô hiệu.
- Esc khi đã có dữ liệu: hỏi lại bằng dải cảnh báo trong chính hộp thoại, giữ nguyên bản nháp. Không mở hộp thoại thứ hai.

[BẢY TRẠNG THÁI]
1. Rỗng — bước 1 trắng.
2. Đang tải — đang tạo: khoá form, nút chính xoay.
3. Một phần — thiếu cao độ của một tầng, dòng đó được đánh dấu.
4. Lỗi — tên dự án trùng, lỗi gắn vào đúng ô tên.
5. Xong — nội dung hoà tan sang dấu tích và một dòng "Đã tạo dự án. Đang mở màn hình tải lên bản vẽ."
6. Không có quyền — vai Người xem không mở được; đã đạt hạn mức gói thì hiện liên kết nâng gói.
7. Thu gọn — dưới 1024 hộp thoại tràn chiều rộng, chân dính đáy.

[CẤM TUYỆT ĐỐI]
- Không hộp thoại lồng hộp thoại.
- Không tự tính cao độ, không tự viết luật kiểm tra.
- Không để chiều cao hộp thoại nhảy khi đổi bước.
- Không bắt nhập lại dữ liệu của bước trước.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/project/CreateProjectModal/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Tạo dự án 4 tầng có hầm → bảng cao độ phải đúng −3,0 / 0,0 / 3,9 / 7,5. In bảng ra để đối chiếu.
- Đóng bằng Esc rồi mở lại → bản nháp còn nguyên. Báo cáo kết quả.
- Đo chiều cao hộp thoại ở cả ba bước và in ba số: chênh lệch phải bằng 0 hoặc là chuyển động mượt, không nhảy.
- Chụp ba bước ở 1440.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-04 — Cài đặt dự án (ProjectSettings)

```
[CONTEXT]
Route /du-an/:id/cai-dat. Bốn thẻ: Chung · Đơn vị và tỷ lệ · Thành viên · Vùng nguy hiểm. Tự lưu, không có nút Lưu.
Người dùng: trưởng dự án, cấu hình một lần rồi hiếm khi quay lại.
Mục tiêu: đổi một thiết lập và tin chắc nó đã lưu, mà không phải tìm nút.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-07 src/lib/autosave/createAutosave.ts: nghỉ 800ms, chờ tối đa 5000ms, thử lại 5–15–45 giây.
- D-08 useSaveIndicator: "Đã lưu lúc 14:32".
- D-05 vé hoàn tác 8000ms; D-09 xử lý xung đột 409.
- M-01, M-02 src/domain/units: đơn vị và tỷ lệ mm/px.
- M-12 src/domain/rules/registry: danh sách luật không gian và cờ bật tắt.
- T-04 schema dự án; P-01 định dạng; P-04 trạng thái màn.

[ĐỌC FILE NÀO]
- src/lib/autosave/**, src/lib/mutations/**, src/domain/units/**, src/domain/rules/registry.ts
- src/components/ui/{Tabs,FieldRow,Input,NumericField,Select,SegmentedControl,Slider,Toggle,Table,Avatar,Button}.tsx
- src/components/feedback/{SaveIndicator,InlineAlert}.tsx

[BỐ CỤC]
Một cột rộng 720 căn giữa, đệm 32. Tabs ngang ở đầu. Chỉ báo lưu ở góc phải trên và nhắc lại ở thanh trạng thái.
Trong mỗi thẻ: các nhóm cách nhau 24, mỗi nhóm có nhãn 13/18/600 chữ thường và một dòng mô tả --text-secondary, rồi đến các FieldRow ngăn bằng nét mảnh.
Dưới 1024: Tabs đổi thành một Select ở đầu trang.

[THÀNH PHẦN & DỮ LIỆU]
**Thẻ 1 — Chung:** tên · mã · loại công trình · địa chỉ · ghi chú.
**Thẻ 2 — Đơn vị và tỷ lệ**, gồm bốn nhóm:
- Đơn vị: Select đơn vị dài (mm, cm, m), Select đơn vị diện tích, Select cách làm tròn.
- Tỷ lệ: tỷ lệ hiện tại "12 mm/px" hiển thị bằng chữ đều, chỉ đọc, kèm nút "Hiệu chỉnh lại" dẫn sang S-11. Dung sai bắt điểm 50 mm.
- Ngưỡng AI: ba Slider có số chữ đều đọc được — độ tin cậy tường 0,75 · đối tượng 0,60 · OCR 0,80. Mỗi Slider có một câu hậu quả, ví dụ "Dưới ngưỡng này, đối tượng sẽ được đánh dấu vàng để người kiểm tra xem lại." Ba Slider nằm trong khối gấp "Nâng cao".
- Chuẩn hoá độ dày tường: một Toggle, ba NumericField 110 / 220 / 330 mm và một ô dung sai theo mm.
- Luật không gian: ba Toggle — "Chuẩn hoá nhãn phòng", "Kiểm tra thiết bị vệ sinh kề tường", "Cửa sổ chỉ trên tường bao ngoài". Mỗi Toggle một dòng giải thích. Bật xong hiện ngay chú thích "Sẽ áp dụng ở lần chạy kiểm tra tiếp theo."
**Thẻ 3 — Thành viên:** bảng người dùng với ảnh đại diện, Select vai, hoạt động cuối theo thời gian tương đối, nút mời và ô nhập email.
**Thẻ 4 — Vùng nguy hiểm:** ba việc, mỗi việc kèm đúng một câu hậu quả — đặt lại kết quả AI · xoá mọi tầng · xoá dự án.

[NỐI LOGIC]
- Mọi ô đi qua autosave D-07. Không có nút Lưu ở bất kỳ đâu trừ ô mời thành viên.
- Chỉ báo lưu lấy từ D-08. Không tự viết chuỗi thời gian.
- Lưu lỗi: hoàn giá trị về cũ và hiện lời nhắc của D-05.
- Nhận 409: đi đường xử lý xung đột của D-09, không ghi đè im lặng.
- Danh sách luật đọc từ sổ đăng ký M-12, không viết cứng ba luật trong màn.
- Tỷ lệ mm/px chỉ đọc từ M-02, không tính lại.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đổi một ô: 800ms sau khi ngừng gõ thì lưu; nền hàng nháy #EEF4EF trong 400ms rồi tắt.
- Kéo Slider: số chữ đều hiện ngay trên con trượt trong lúc kéo.
- Đổi thẻ: gạch dưới trượt 180ms, nội dung hoà tan.
- Xoá dự án là hộp thoại xác nhận duy nhất trong màn, và bắt gõ đúng tên dự án mới cho bấm.

[BẢY TRẠNG THÁI]
1. Rỗng — dự án mới, hiện giá trị mặc định kèm gợi ý có thể đổi sau.
2. Đang tải — FieldRow dạng khung xương.
3. Một phần — đang lưu; hoặc danh sách thành viên hỏng thì dải cảnh báo chỉ nằm trong thẻ Thành viên.
4. Lỗi — lưu thất bại, có nút thử lại.
5. Xong.
6. Không có quyền — vai Người xem đọc được mọi thứ, ẩn hẳn thẻ Vùng nguy hiểm; ô chỉ đọc thì **bỏ viền**, không làm xám chữ.
7. Thu gọn — Tabs thành Select.

[CẤM TUYỆT ĐỐI]
- Không nút Lưu, không tự viết cơ chế chống rung, không tự tính tỷ lệ.
- Không đỏ đặc cho Vùng nguy hiểm; dùng biến thể nút cảnh báo của thư viện.
- Không làm xám chữ ở chế độ chỉ đọc — bỏ viền thay vì làm mờ.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/project/ProjectSettings/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi tên → sau 800ms thấy "Đã lưu lúc 14:32"; tải lại trang thì giá trị mới còn nguyên.
- grep chữ "Lưu" dạng nút trong thư mục màn → rỗng.
- Mỗi Slider ngưỡng phải có đúng một câu hậu quả bằng tiếng Việt. In ba câu ra để kiểm.
- Bật một luật không gian → phải thấy chú thích "Sẽ áp dụng ở lần chạy kiểm tra tiếp theo."

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-05 — Cài đặt tài khoản (AccountSettings)

```
[CONTEXT]
Route /tai-khoan. Sáu nhóm: hồ sơ · mật khẩu · giao diện · thông báo · phím tắt · phiên đăng nhập, cộng vùng nguy hiểm ở cuối. Tự lưu mọi thứ trừ mật khẩu.
Người dùng: bất kỳ ai, ghé rất thưa, thường chỉ để đổi cách nhận thông báo hoặc tra một phím tắt.
Mục tiêu: tìm đúng thiết lập cần đổi trong vài giây và không phải nghĩ về việc lưu.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- L-02 đổi mật khẩu, danh sách phiên, đăng xuất một phiên; L-03 câu lỗi.
- D-07 tự lưu, D-08 chỉ báo lưu, D-05 vé hoàn tác 8000ms.
- A-01 tokens và cờ giảm chuyển động; A-03 chạy số.
- I-01 src/lib/input/shortcutRegistry: nguồn duy nhất của danh sách phím tắt.
- O-02 src/lib/telemetry/flags.ts cho các khoá bật tắt.
- P-02 thời gian tương đối; P-04 trạng thái màn; T-04 schema mật khẩu (tối thiểu 8 ký tự, có chữ và số).

[ĐỌC FILE NÀO]
- src/lib/auth/**, src/lib/autosave/**, src/lib/motion/tokens.ts, src/lib/telemetry/flags.ts, src/lib/input/shortcutRegistry.ts
- src/components/ui/{FieldRow,Input,Toggle,SegmentedControl,Select,Checkbox,Avatar,Kbd,Table,Button}.tsx

[BỐ CỤC]
Một cột rộng 720, sáu khối nền nổi --bg-surface bo 12 đệm 20, cách nhau 24. Chỉ báo lưu ở đầu trang.

[THÀNH PHẦN & DỮ LIỆU]
1. **Hồ sơ** — ảnh đại diện 56 bo tròn, trỏ chuột hiện lớp phủ "Đổi ảnh"; họ tên; chức danh; email chỉ đọc kèm liên kết "Đổi email"; điện thoại; Select ngôn ngữ.
2. **Mật khẩu** — ba ô (cũ, mới, nhắc lại), thanh sức mạnh 4px ba mức, nút "Đổi mật khẩu". Đây là nút duy nhất trong màn.
3. **Giao diện** — SegmentedControl chủ đề "Sáng / Tối / Theo hệ thống"; Toggle "Dùng nền tối cho khung nhìn 3D" kèm chú thích "Chỉ đổi màu vùng mô hình, giao diện vẫn sáng."; Toggle "Giảm chuyển động"; Toggle "Hiện lưới 100 mm"; SegmentedControl mật độ hiển thị đổi chiều cao dòng giữa 40 và 36.
4. **Thông báo** — một ma trận nhỏ: hàng là sự kiện ("AI xử lý xong", "Phát hiện vi phạm mới", "Được mời vào dự án", "Bình luận nhắc đến tôi", "Tổng hợp mỗi sáng"), cột là kênh ("Trong ứng dụng", "Email"). Mỗi ô là một Checkbox. Đầu bảng không tô màu.
5. **Phím tắt** — bảng hai cột chỉ đọc, hiển thị mọi phím tắt bằng Kbd, có ô tìm lọc ngay khi gõ.
6. **Phiên đăng nhập** — danh sách phiên đang mở: thiết bị, vị trí, hoạt động cuối theo thời gian tương đối, nút chìm "Đăng xuất" từng dòng.
Cuối trang: **Vùng nguy hiểm** — xoá tài khoản, bắt gõ đúng email để xác nhận.

[NỐI LOGIC]
- Tự lưu qua D-07 cho mọi trường trừ mật khẩu.
- Đổi mật khẩu gọi L-02 và hiện câu lỗi của L-03.
- Mọi khoá bật tắt đọc và ghi qua O-02. Không tự lưu vào localStorage.
- Danh sách phím tắt sinh từ `shortcutRegistry` của I-01. **Không** viết tay danh sách này — viết tay là nguồn sai lệch.
- "Giảm chuyển động" ghi vào cờ của A-01 và có hiệu lực toàn ứng dụng, không chỉ là media query.
- Đăng xuất một phiên gọi L-02, dùng vé hoàn tác D-05.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đổi chủ đề áp dụng ngay, hoà tan màu nền và màu chữ trong 240ms, không tải lại trang, không nháy màu thô.
- Mọi ô tự lưu sau 800ms và nền hàng nháy #EEF4EF trong 400ms.
- Đăng xuất một phiên: hàng thu chiều cao trong 240ms và hiện lời nhắc hoàn tác 8 giây.
- Ô tìm phím tắt lọc ngay khi gõ, danh sách xếp lại bằng layout animation.
- Bật "Giảm chuyển động" → mọi hoạt cảnh trong màn tắt ngay lập tức.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có ảnh (hiện chữ cái đầu trên --bg-sunken), chưa có chức danh.
2. Đang tải.
3. Một phần — đang tải ảnh lên; hoặc danh sách phiên không lấy được thì dải cảnh báo chỉ nằm trong khối đó.
4. Lỗi — sai mật khẩu cũ, lỗi gắn vào đúng ô.
5. Xong.
6. Không có quyền — tài khoản dùng đăng nhập một lần: khối mật khẩu chỉ đọc kèm câu "Do quản trị viên công ty quản lý."
7. Thu gọn — ma trận thông báo đổi thành danh sách sự kiện, mỗi sự kiện hai Toggle.

[CẤM TUYỆT ĐỐI]
- Không tự lưu mật khẩu.
- Chủ đề tối dùng đúng bộ token tối, không tự làm tối màu bằng bộ lọc.
- Không tô màu ô nào trong ma trận thông báo.
- Không viết tay danh sách phím tắt.
- Không tạo component mới.

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Bật giảm chuyển động → xác nhận mọi hoạt cảnh trong màn tắt; báo cáo kết quả.
- Đo tương phản chữ ở chủ đề tối ≥ 4,5:1 và in số đo.
- Đối chiếu số phím tắt hiển thị với số mục trong shortcutRegistry → phải bằng nhau, in cả hai số.
- Đổi chủ đề 5 lần liên tiếp → không được thấy nháy màu thô.

[DELIVERABLES]
- src/screens/account/AccountSettings/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-06 — Màn chào và ba bước bắt đầu (WelcomeScreen)

```
[CONTEXT]
Route /onboarding, hiện một lần sau khi đăng ký lần đầu.
Người dùng: quản lý toà nhà chưa từng dùng phần mềm CAD, sắp nhìn thấy một mô hình 3D lần đầu trong đời.
Mục tiêu duy nhất: đưa người dùng đến hành động đầu tiên. Không dạy gì thêm.
Ranh giới: phần dạy trong trình soạn thảo thuộc S-40. Màn này **không** chứa coach mark, không chứa vùng sáng chỉ dẫn — chỉ dẫn sang S-40.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-01, D-02 truy vấn danh sách dự án để biết bước nào đã xong.
- O-02 flags: cờ đã xem màn chào, lưu theo người dùng.
- A-02 stagger 60ms cho ba thẻ; A-01 tokens; P-04 trạng thái màn.

[ĐỌC FILE NÀO]
- src/lib/query/**, src/lib/telemetry/flags.ts, src/lib/motion/**
- src/components/ui/Button.tsx, src/components/feedback/EmptyState.tsx

[BỐ CỤC]
Một cột rộng 960 căn giữa trên --bg-app, đệm trên 64.
Tiêu đề chữ display "Chào {tên}, bắt đầu trong ba bước" và một đoạn hai câu nói sản phẩm làm gì.
Ba thẻ ngang 300×220, khe 20, bo 16, đệm 20. Mỗi thẻ: số thứ tự bằng chữ đều · biểu tượng nét 24 độ dày 1,5 · tiêu đề · một câu · một nút.
Dưới ba thẻ: hai liên kết chìm "Xem dự án mẫu" và "Xem hướng dẫn 2 phút", rồi liên kết "Bỏ qua".
Dưới 1024: ba thẻ xếp dọc.

[THÀNH PHẦN & DỮ LIỆU]
Ba thẻ, theo đúng thứ tự:
1. "Tạo dự án" — "Khai báo tên công trình và danh sách tầng."
2. "Tải bản vẽ theo từng tầng" — "Kéo ảnh quét hoặc tệp CAD vào từng tầng."
3. "Duyệt kết quả và dựng 3D" — "Kiểm tra tường, cửa, phòng rồi xem mô hình."
Thẻ 2 và 3 vô hiệu cho đến khi điều kiện đạt, kèm một câu chú giải vì sao, ví dụ "Cần tạo dự án trước."
Câu khi bỏ qua: "Có thể xem lại hướng dẫn trong menu trợ giúp."

[NỐI LOGIC]
- Trạng thái từng bước **suy ra từ dữ liệu query** của D-01/D-02, không tự đoán, không lưu cờ riêng cho từng bước.
- Cờ "không hiện lại" đọc và ghi qua O-02.
- "Xem hướng dẫn 2 phút" mở dự án mẫu rồi chuyển sang S-40. Màn này không tự vẽ chỉ dẫn.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Biểu tượng tiêu đề tự vẽ bằng stroke-dashoffset trong 600ms khi vào màn.
- Ba thẻ hiện so le 60ms.
- Thẻ nâng -1px khi trỏ chuột, nhấn xuống scale(0.985).
- Chọn một thẻ: nội dung hoà tan 240ms rồi chuyển trang; màn đích vào bằng nâng 8px nên chuyển tiếp liền mạch.
- Sau khi hoàn tất một phiên đầy đủ, màn này không bao giờ tự hiện lại.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có gì, thẻ 1 là thẻ chính.
2. Đang tải — 3 khung xương đúng kích thước thẻ.
3. Một phần — đã tạo dự án nhưng chưa tải ảnh: thẻ 1 xong, thẻ 2 mở, thẻ 3 còn khoá.
4. Lỗi — không đọc được tiến độ, có nút thử lại.
5. Xong — đủ ba bước, hiện một nút "Vào danh sách dự án".
6. Không có quyền — vai Người xem chỉ thấy thẻ 3.
7. Thu gọn — ba thẻ xếp dọc.

[CẤM TUYỆT ĐỐI]
- Không băng trình chiếu, không video, không hình minh hoạ nhiều màu.
- Không thẻ nào có nền màu.
- Mỗi thẻ đúng một câu, không được là một đoạn.
- Không lặp lại bất kỳ chuỗi nào của S-40, không viết mã coach mark trong file này.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/onboarding/WelcomeScreen/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đối chiếu chuỗi với S-40 → không trùng câu nào; in danh sách đã so.
- Đếm số lựa chọn trên màn → đúng ba thẻ, hai liên kết phụ, một liên kết bỏ qua.
- grep "coach\|spotlight\|tour" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-07 — Gói dịch vụ và hoá đơn (BillingScreen)

```
[CONTEXT]
Route /thanh-toan. Chỉ vai Quản trị thay đổi được.
Người dùng: trưởng dự án đang so chi phí số hoá với báo giá thủ công 200.000–500.000 VNĐ mỗi m² diện tích được số hoá.
Mục tiêu: biết đang dùng bao nhiêu, sắp hết chưa, và tốn bao nhiêu so với làm tay.
Cảm giác: một trang tài chính yên tĩnh. Không băng "phổ biến nhất", không thẻ gói tô màu.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- P-01 định dạng tiền và diện tích kiểu Việt; P-02 định dạng kỳ và ngày.
- D-01, D-02 truy vấn hoá đơn và hạn mức; P-07 thang màu nhạt cho ngưỡng.
- P-04 trạng thái màn; A-03 chạy số 240ms cho con số hạn mức và giá.
- L-03 dịch lỗi của cổng thanh toán sang tiếng Việt kèm mã ngắn.

[ĐỌC FILE NÀO]
- src/lib/format/**, src/lib/coloring/legend.ts, src/lib/query/**, src/lib/errors/index.ts
- src/components/ui/{Table,Badge,Button,FieldRow,SegmentedControl,IconButton}.tsx
- src/components/feedback/InlineAlert.tsx

[BỐ CỤC]
Trên --bg-app, bốn khối dọc cách nhau 24. Dải so sánh gói rộng tối đa 1120; các khối còn lại rộng 960, đều căn giữa.
1. **Gói hiện tại** — thẻ trắng bo 12 đệm 24: tên gói h2 · dòng dùng "1.842 / 5.000 m² đã số hoá trong chu kỳ này" · thanh 6px nền --bg-sunken, phần đầy --accent · ngày gia hạn · nút chìm "Đổi gói".
2. **So sánh gói** — ba thẻ trắng bo 16 đệm 28 cao bằng nhau: tên gói h3 · giá chữ đều mono-lg với đơn vị --text-secondary bên dưới · nét mảnh · sáu dòng tính năng, mỗi dòng một dấu tích 18 màu --text-secondary (**không** màu xanh) · một nút ở đáy. Gói khuyến nghị chỉ được đánh dấu bằng viền 1px --accent-border và một badge nhỏ nền --accent-wash.
3. **Ước tính** — một câu văn xuôi nêu đơn giá thị trường và chi phí tương đương với sản phẩm này, cả hai số bằng chữ đều, đặt thẳng trên nền ấm, không hộp gọi. Kèm bảng ba dòng: diện tích tháng này · đơn giá · tạm tính.
4. **Hoá đơn** — bảng Mã · Kỳ · Diện tích · Số tiền (chữ đều căn phải) · Trạng thái · IconButton tải PDF. 10 dòng một trang.
SegmentedControl đổi kỳ thanh toán đặt trên khối 2.
Dưới 1024: ba thẻ gói xếp dọc, bảng hoá đơn đổi thành thẻ.

[THÀNH PHẦN & DỮ LIỆU]
- Vượt 80% hạn mức: thanh đổi sang thang cần chú ý của P-07 và hiện InlineAlert "Sắp hết hạn mức. Còn 620 m²."
- Badge trạng thái hoá đơn dạng nền nhạt, không tô đặc.
- Câu lỗi thanh toán mẫu: lấy từ L-03, kèm mã chữ đều nhỏ và một nút thử lại.

[NỐI LOGIC]
- Mọi con số đi qua P-01 và P-02. Tuyệt đối không nối chuỗi số trong JSX.
- Màu theo ngưỡng lấy từ P-07, không tự chọn màu.
- Tạm tính đọc từ dữ liệu trả về, không nhân chia trong màn.
- Lỗi cổng thanh toán dịch qua L-03.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Thanh hạn mức chạy từ 0 đến giá trị thật trong 700ms khi vào màn.
- Đổi kỳ thanh toán: giá **chạy số** sang giá trị mới trong 240ms, không thay chữ đột ngột.
- Thẻ gói nâng -1px khi trỏ chuột; thẻ khuyến nghị không được động khác ba thẻ kia.
- Nâng gói mở một bảng tóm tắt xác nhận có số tiền chia theo tỷ lệ trước khi chốt — đây là ngoại lệ hợp lý vì là cam kết tài chính.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có hoá đơn, khung trống dạy nghề.
2. Đang tải — 8 dòng khung xương và ba thẻ gói khung xương.
3. Một phần — hạn mức đang tính lại, hoặc lịch sử hoá đơn không lấy được: dải cảnh báo chỉ nằm trong khối đó.
4. Lỗi — thanh toán thất bại, InlineAlert nêu lý do và nút thử lại.
5. Xong.
6. Không có quyền — vai Kỹ sư và Người xem thấy toàn bộ ở chế độ đọc kèm câu "Chỉ quản trị viên có thể thay đổi gói."
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không thẻ gói nào có nền màu, không băng nhiều màu, không "phổ biến nhất" nổi bật.
- Dấu tích tính năng màu trung tính, không xanh lá.
- Không đỏ đặc cho hoá đơn quá hạn; dùng badge nền nhạt.
- Không tự định dạng số, không tự tính tạm tính.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/billing/BillingScreen/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- In 5 chuỗi tiền và diện tích đã định dạng để kiểm dấu chấm và dấu phẩy: kỳ vọng "2.480,00 m²" và "1.240.000 ₫".
- Đặt hạn mức lên 85% → phải thấy đổi thang màu và thấy InlineAlert. Báo cáo kết quả.
- Đổi kỳ thanh toán → xác nhận giá chạy số, không nhảy.
- grep mã màu thô trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

> ✅ **Xong nhóm A — 7/47 màn.** Chụp cả 7 màn ở 1440 và xem một lượt cạnh nhau. Đây là lần rẻ nhất để phát hiện lệch nhịp thị giác trước khi nhân bản sang 40 màn còn lại.

---

---

# PHẦN 3 — Nhóm B: Tải lên và pipeline AI (7 màn)

> 📤 Cả nhóm này dựng trên nhóm T (T-01 → T-10): chia khúc 5 MB × 3 song song · dòng sự kiện SSE giãn cách 1/2/4/8/16/30 giây · quay vòng 2500ms khi SSE chết · trọng số sáu bước 5/30/20/15/20/10 · hàng đợi ngoại tuyến ≤ 200 lệnh.
> **Màn hình không được viết lại bất kỳ con số nào ở trên.** Nếu thấy một trong các số đó xuất hiện trong `src/screens`, đó là lỗi.

## 3.0 — Bộ dữ liệu mẫu chuẩn (dùng chung cho mọi màn từ đây trở đi)

Mọi màn hình, mọi story, mọi test đều dùng đúng bộ số này. Lệch một con số là lỗi, vì người kiểm sẽ đi từ màn tiến trình sang màn QC rồi sang màn 3D và phải thấy cùng một công trình.

| Hạng mục | Giá trị |
| --- | --- |
| Dự án mẫu | Toà nhà HQ Renovation |
| Số tầng | 4 (cao độ −3,0 / 0,0 / 3,9 / 7,5 m) |
| Đoạn tường | 48 |
| Đối tượng | 21 — gồm 9 cửa đi, 7 cửa sổ, 5 nội thất |
| Chuỗi kích thước OCR | 34 |
| Phòng | 14 |
| Tổng diện tích | 248,60 m² |
| Mục dưới ngưỡng tin cậy 0,75 | 9 |
| Tỷ lệ | 12 mm/px (4800 mm ÷ 400 px) |
| Ảnh sau nắn | 3000 × 3000 px |
| Mã lỗi mẫu | SEG-2041 · yêu cầu 8f2a-41 |

Sáu tên bước pipeline, **đúng nguyên văn, không viết tắt, không dịch lại**:
`Tiền xử lý ảnh` · `Nhận diện tường (SegFormer)` · `Nhận diện cửa và nội thất (YOLOv8)` · `Đọc kích thước (PaddleOCR)` · `Chuẩn hoá độ dày tường` · `Dựng Spatial JSON`

## 3.1 — Bảng xử lý xung đột (nhóm B)

| Màn | Bộ UI/UX nói | Bộ 47 màn nói | Chốt |
| --- | --- | --- | --- |
| S-08 | Danh sách **thẻ tầng** có ảnh thu nhỏ 96×72, nội dung 1120, khối thả tối thiểu 200 | **Bảng** dòng 40, nội dung 1080, khối thả 180 | Thẻ tầng cao 96 (bảng dòng 40 không chứa nổi ảnh thu nhỏ, mà không có ảnh thì không kiểm được ghép đúng tầng) · nội dung 1120 · khối thả 180 |
| S-09 | Ảnh có chú thích lỗi vẽ đè lên vùng có vấn đề, danh sách phát hiện dạng thẻ, nút tự nắn | Bốn chỉ số dạng bảng, ô tích xác nhận khi có mức Kém | Giữ cả hai: cột trái ảnh có chú thích · cột phải bốn chỉ số **và** thẻ phát hiện có nút sửa · ô tích xác nhận |
| S-10 | Cột phải là **ảnh xem trước** có đường quét | Cột phải 344 là **panel nhật ký** | Cột phải 344 có Tabs "Xem trước / Nhật ký", mặc định Xem trước |
| S-11 | SegmentedControl hai phương pháp: từ chuỗi OCR hoặc vẽ tay | Ba bước kéo tay | Hai phương pháp; phương pháp "vẽ tay" chính là ba bước của bộ 47 màn |
| S-12 | Sơ đồ DAG 7 nút cho người kỹ thuật, có chạy lại từ một nút | Sơ đồ hai nhánh đơn giản, "màn tạo niềm tin, không phải màn điều khiển" | Hai chế độ trong một màn: **Tổng quan** (hai nhánh, mặc định) và **Chi tiết kỹ thuật** (DAG 7 nút, mở bằng khối gấp, chỉ vai Quản trị) |
| S-13 | Màn ánh xạ 9 lớp CAD có xem trước trực tiếp, panel 420 | Hộp thoại 560 chọn nhánh | Hai giai đoạn trong cùng route: hộp thoại 560 chốt nhánh → nếu chọn CAD thì màn ánh xạ lớp mở ra. Không lồng hộp thoại |
| S-14 | Giữ nguyên khung, InlineAlert trong vùng nội dung | Giữ nguyên bố cục S-10 | Trùng nhau, không xung đột |

---

## S-08 — Tải bản vẽ theo từng tầng (FloorUploadScreen) ⭐

```
[CONTEXT]
Route /du-an/:id/tai-len. Cửa ngõ dữ liệu: sai ở đây thì toàn bộ pipeline sai.
Người dùng: kỹ sư có một thư mục ảnh quét đặt tên lộn xộn, cần chắc chắn rằng trang 3 đúng là tầng 2. Thường tải 4–12 tệp một lần.
Mục tiêu: mỗi tầng gắn đúng một tệp, đúng cao độ, và tin được rằng ghép đúng.
Định dạng nhận: .png, .jpg, .pdf, .dwg. Tệp .dwg đi nhánh khác, chính xác hơn ảnh quét.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-01 chia khúc 5 MB và băm tệp; T-02 uploadTask — 3 tệp song song, huỷ, thử lại, tiến trình tối đa 4 lần mỗi giây.
- T-03 kiểm tệp (≤ 100 MB, PDF ≤ 20 trang, định dạng nhận được) và hàm đoán tầng từ tên tệp; T-04 schema tầng.
- T-09 hàng đợi ngoại tuyến; L-03 câu lỗi theo mã (413, 422).
- M-11 tính cao độ tích luỹ; P-01 định dạng dung lượng và phần trăm; P-04 trạng thái màn.
- D-05 vé hoàn tác 8000ms cho việc gỡ tệp.

[ĐỌC FILE NÀO]
- src/lib/upload/**, src/lib/offline/**, src/domain/axes/**, src/lib/format/**, src/lib/mutations/undo.ts
- src/components/ui/{Select,NumericField,Badge,Button,IconButton}.tsx
- src/components/feedback/{InlineAlert,EmptyState,Skeleton,Toast}.tsx

[BỐ CỤC]
Breadcrumb "Dự án > Tải lên bản vẽ". Nội dung rộng tối đa 1120 căn giữa, đệm 32, trên --bg-app.
- Khối kéo thả cao 180, bo 16, viền nét đứt 2px --border-default. Bên trong: biểu tượng nét 32 tự vẽ khi vào màn · câu "Kéo thả bản vẽ vào đây, hoặc chọn tệp" · nút phụ · caption liệt kê định dạng nhận được và dung lượng tối đa.
- Danh sách gắn tầng: mỗi tầng một thẻ trắng bo 12 đệm 20, cách nhau 12, cao 96. Thẻ là một hàng ngang: ảnh thu nhỏ 96×72 bo 8 bên trái · tên tầng h3 với cao độ và chiều cao bằng chữ đều bên dưới · tên tệp kèm dung lượng và số trang · badge trạng thái căn phải · IconButton mở menu.
- Khay tệp chưa gắn ở dưới cùng, cho tệp nào không tự ghép được.
- Chân trang dính, thẻ trắng bo 12: bên trái "3 / 4 tầng đã có bản vẽ", bên phải nút chính "Bắt đầu xử lý".
Dưới 1024: danh sách thẻ thành bảng gọn.

[THÀNH PHẦN & DỮ LIỆU]
- Select gắn lại tệp sang tầng khác, ngay trong thẻ.
- Bộ chọn trang PDF hiện ngay trong thẻ khi tệp là PDF nhiều trang.
- Viên thuốc nhỏ trên tệp .dwg: "Nhánh CAD · độ chính xác cao".
- Gợi ý khi ghép tự động: "Ghép tự động từ tên tệp — kiểm tra lại", ở mức cần chú ý.
- Khung trống: "Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu."
- Câu lỗi mẫu (lấy từ L-03): tệp quá lớn, tệp không đọc được. Lỗi nằm **trong thẻ của tệp đó**, các thẻ khác không bị ảnh hưởng.
- Mất mạng: dải "Đang làm việc ngoại tuyến" theo T-09.

[NỐI LOGIC]
- Mọi tệp đi qua uploadTask của T-02. Màn hình chỉ vẽ phần trăm và gắn nút huỷ hoặc thử lại.
- Kiểm tệp bằng T-03. **Không tự kiểm dung lượng, không tự đọc số trang PDF.**
- Đoán tầng từ tên tệp bằng hàm của T-03, luôn cho sửa lại bằng ô chọn.
- Cao độ tích luỹ gọi M-11, không cộng trong màn.
- Gỡ tệp là hành động tức thì kèm vé hoàn tác D-05, không hỏi lại.
- Chặn "Bắt đầu xử lý" khi còn tầng thiếu tệp, thiếu cao độ, trùng cao độ, hoặc còn tệp đang tải. Bấm trong trạng thái đó thì **liệt kê đúng tầng nào sai và cuộn tới dòng đầu tiên** — không vô hiệu nút im lặng.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo tệp qua cửa sổ: khối thả đổi viền và nền trong 120ms, phần còn lại của trang mờ nhẹ xuống 0,96. **Khối thả tuyệt đối không đổi kích thước.**
- Thả tệp: mỗi thẻ hiện ra bằng chuyển chiều cao và độ mờ 240ms, so le 24ms.
- Gắn lại tệp sang tầng khác: ảnh thu nhỏ bay giữa hai thẻ bằng shared layout animation 340ms.
- Tiến trình tải là thanh 2px chạy dọc mép dưới thẻ, **không phải vòng xoay**.
- Bộ đếm "3 / 4" chạy số khi đổi.

[BẢY TRẠNG THÁI]
1. Rỗng — 4 thẻ tầng trống kèm câu dạy việc.
2. Đang tải — thanh tiến trình trên từng thẻ.
3. Một phần — 3/4 tầng đã gắn; chân trang nói rõ tầng nào còn thiếu.
4. Lỗi — một tệp quá lớn, một tệp không đọc được; lỗi gói trong thẻ tương ứng.
5. Xong — đủ 4 tầng, nút chính bật, bộ đếm chạy số.
6. Không có quyền — bảng chỉ đọc, không kéo thả được.
7. Thu gọn — danh sách thẻ thành bảng dọc.

[CẤM TUYỆT ĐỐI]
- Không hộp thoại cho bất kỳ lỗi tải tệp nào.
- Không tự chia khúc, không tự đếm song song, không tự viết giới hạn dung lượng.
- Không vô hiệu nút chính mà không nêu lý do.
- Lỗi của một tệp không được chặn cả trang.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/upload/FloorUploadScreen/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Thả 4 tệp → gắn đúng 4 tầng → bắt đầu xử lý → sang màn tiến trình. Báo cáo số lần cập nhật tiến trình mỗi giây, phải ≤ 4.
- grep "5242880\|104857600\|100 MB" trong thư mục màn → rỗng. Các con số đó chỉ được ở T-01 và T-03.
- Bấm "Bắt đầu xử lý" khi thiếu 1 tầng → phải thấy tên tầng thiếu và trang cuộn tới đó. In kết quả.
- Kéo tệp vào và đo kích thước khối thả trước sau → chênh lệch bằng 0.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-09 — Kiểm tra chất lượng ảnh đầu vào (InputQualityGate)

```
[CONTEXT]
Bước chặn trước khi tiêu bốn phút GPU. Nói thật chất lượng ảnh sẽ cho kết quả thế nào, nhưng **không cấm** người dùng tiếp tục.
Người dùng: người vừa tải lên một ảnh chụp điện thoại của bản vẽ in và không hiểu vì sao nó sẽ không chạy tốt.
Nguyên tắc viết chữ: lỗi nói bằng **hậu quả vật lý**, không nói bằng mã. Người dùng phải học được rằng độ phân giải thấp sẽ khiến họ mất gì.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-05 gọi API chất lượng; T-04 schema kết quả đo.
- P-03 viewmodel đổi số đo thành ba mức Tốt / Cần chú ý / Kém; P-07 thang màu và chú giải.
- P-01 định dạng "3.000 × 3.000 px", "0,8°", độ tin cậy 0,82; ngưỡng 0,75 lấy từ M-12.
- I-01 phím mũi tên trái phải đổi tầng đang xem; P-04 trạng thái màn.

[ĐỌC FILE NÀO]
- src/lib/viewmodel/**, src/lib/coloring/**, src/lib/format/**, src/lib/input/**, src/domain/rules/registry.ts
- src/components/canvas/{ZoomCluster,SelectionHalo}.tsx
- src/components/ui/{Table,Badge,Button,Tooltip,Checkbox,Slider}.tsx, src/components/feedback/InlineAlert.tsx

[BỐ CỤC]
Hai cột, nội dung tối đa 1280.
- Cột trái 62%: khung xem ảnh bo 16, ảnh rộng tối đa 640, có cụm thu phóng góc phải dưới. Vẽ **chú thích đè lên đúng vùng có vấn đề**: viền mức vi phạm quanh góc bị cắt, viền mức cần chú ý quanh vùng mờ, và một đường 1px --accent chỉ góc nghiêng so với phương ngang.
- Cột phải 344: trên là bốn chỉ số, dưới là danh sách phát hiện.
Dưới 1024: cột phải thành tấm trượt đáy.

[THÀNH PHẦN & DỮ LIỆU]
Bốn chỉ số, mỗi dòng: tên · giá trị chữ đều · badge ba mức · một câu khuyến nghị khi ở mức cần chú ý.
- Độ phân giải · Độ nghiêng · Độ tương phản · Độ nhiễu.
Dòng dự báo bên dưới: "Dự kiến độ tin cậy trung bình 0,82".
Thẻ phát hiện, mỗi thẻ trắng bo 12 đệm 16: chấm trạng thái · tiêu đề · **một câu nói hậu quả** · một nút sửa nếu có. Ba thẻ mẫu:
- "Độ phân giải thấp — 1.240 × 900 px. Ở mức này, tường 110 mm chỉ dày khoảng 1 pixel nên có thể bị bỏ sót. Nên dùng ảnh từ 2.000 px trở lên."
- "Ảnh bị nghiêng 3,4 độ. Hệ thống có thể tự nắn." + nút "Tự động nắn"
- "Không tìm thấy khung bản vẽ. Bạn có thể tự chọn 4 góc." + nút "Chọn góc thủ công"
Bảng 4 tầng ở dưới, bấm để đổi ảnh đang xem.
Chân trang: nút chìm "Tải lên ảnh khác" và nút chính "Tiếp tục dù vậy".
Khi có chỉ số mức Kém: phải tích ô "Tôi hiểu kết quả có thể cần sửa nhiều" mới đi tiếp. **Không dùng hộp thoại.**
Trạng thái đạt: một thẻ mức đã duyệt duy nhất — "Bản vẽ đạt yêu cầu. Độ phân giải 3.200 × 2.400 px, độ nghiêng 0,2 độ."

[NỐI LOGIC]
- Mức và màu lấy từ P-03 và P-07. **Không đặt ngưỡng trong màn.**
- Không tự tính chỉ số ảnh. Mọi số đến từ API qua T-05.
- Trỏ vào một chỉ số hoặc một thẻ phát hiện thì tô sáng vùng ảnh liên quan, và ngược lại.
- Phím mũi tên đổi tầng khai qua I-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Nổi bật liên kết hai chiều: trỏ vào thẻ thì vùng ảnh có viền 2px trong 180ms; trỏ vào vùng ảnh thì thẻ sáng lên.
- Tự động nắn: ảnh xoay về ngay ngắn trong 700ms, rồi thẻ phát hiện thu lại và được thay bằng một dòng mức đã duyệt. Nếu A-01 không có mốc 700ms thì dùng 340ms — **không viết số tay**.
- Chọn góc thủ công: đặt bốn tay nắm 10px kéo được; xem trước phối cảnh cập nhật ngay khi kéo.
- Thẻ đã sửa xong thu chiều cao trong 240ms và bộ đếm còn lại chạy số.
- Sau khi nắn, hiện thanh trượt so sánh trước và sau.

[BẢY TRẠNG THÁI]
1. Rỗng — không phát hiện vấn đề nào, một thẻ đã duyệt duy nhất.
2. Đang tải — đang phân tích: 4 dòng khung xương và một vạch quét 1,6 giây.
3. Một phần — 2/4 tầng đã đo xong, hoặc một phép kiểm không chạy được.
4. Lỗi — tệp không giải mã được.
5. Xong — đủ 4 tầng mức Tốt.
6. Không có quyền — ẩn hai nút hành động.
7. Thu gọn — panel thành lớp phủ đáy.

[CẤM TUYỆT ĐỐI]
- Không chặn cứng người dùng; chỉ cảnh báo có ý thức.
- Không dùng màu "đã duyệt" cho kết quả do máy đánh giá.
- Không tự tính chỉ số ảnh, không tự đặt ngưỡng.
- Mọi phát hiện phải neo vào đúng vùng ảnh nó nói tới.
- Không mã lỗi nào đứng một mình mà không có câu giải thích bên cạnh.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/upload/InputQualityGate/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Có mức Kém → không đi tiếp được cho đến khi tích ô. Báo cáo kết quả.
- In ba câu phát hiện ra và kiểm: mỗi câu phải nêu hậu quả vật lý, không câu nào chỉ nêu con số.
- grep "0.75\|0,75" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-10 — Theo dõi tiến trình xử lý AI (ProcessingScreen) ⭐

```
[CONTEXT]
Route /du-an/:id/xu-ly. Màn chờ lâu nhất của sản phẩm — hai đến sáu phút mỗi tầng.
Người dùng: kỹ sư muốn biết nên ngồi đợi hay đi pha cà phê, và tầng nào đang làm chậm.
Ba nguyên tắc: luôn biết đang ở bước nào · luôn biết còn bao lâu · rời đi được mà không mất việc.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-06 dòng sự kiện SSE (giãn cách 1/2/4/8/16/30 giây, nhiễu 0–200ms); T-07 quay vòng 2500ms và gộp sự kiện trùng.
- T-08 pipeline: sáu bước, trọng số 5/30/20/15/20/10, phần trăm tổng, thời gian còn lại.
- P-01 định dạng phần trăm và "còn khoảng 2 phút"; P-02 thời gian trôi qua.
- P-04 trạng thái màn; A-01 chuyển số 180ms; A-03 chạy số 240ms.
- L-03 câu lỗi và mã kỹ thuật; O-01 ghi sự kiện bắt đầu và kết thúc.

[ĐỌC FILE NÀO]
- src/lib/realtime/**, src/lib/format/**, src/lib/motion/**, src/lib/telemetry/**
- src/components/feedback/{PipelineStepper,ProgressOverlay,InlineAlert,Toast}.tsx
- src/components/ui/{Button,Toggle,IconButton,Tabs,Badge}.tsx

[BỐ CỤC]
Hai cột trên --bg-app, tối đa 1280.
- Trên hai cột: dải chọn tầng — các chip ngang, mỗi chip có tên tầng và một chấm trạng thái.
- Cột trái 60%: PipelineStepper dọc, sáu bước theo đúng tên nguyên văn ở mục 3.0. Bước 2, 3, 4 chạy song song nên vẽ thành ba hàng con thụt vào dưới một hàng cha "Nhận diện", mỗi hàng con một thanh riêng. Mỗi bước có thanh 3px và thời gian còn lại; bước đang chạy có vạch quét 1,6 giây. Dưới stepper là bốn dòng tầng kèm số đối tượng đã nhận.
- Cột phải 344: Tabs "Xem trước / Nhật ký", mặc định Xem trước.
  - Xem trước: bản vẽ nguồn với đường quét 1px --accent 40% chạy từ trên xuống mỗi 1,6 giây khi giai đoạn của nó đang chạy. Hình học đã nhận diện hiện dần đè lên bằng nét --wall-idle mờ.
  - Nhật ký: chữ đều 13, tối đa 200 dòng, có khoá tự cuộn và nút sao chép.
- Dưới hai cột: dòng tóm tắt chữ đều "Đã xong 2/4 tầng · Còn lại khoảng 4 phút 20 giây".
- Ở khu vực đầu trang luôn có nút chìm "Để chạy nền và thông báo cho tôi".
Dưới 1024: stepper thành một thanh ngang duy nhất kèm tên bước hiện tại; nhật ký thành ngăn trượt.

[THÀNH PHẦN & DỮ LIỆU]
- Khối chi tiết mở được của từng bước, hiện số đếm khi dữ liệu về: "Đã tìm thấy 48 đoạn tường" · "Đã tìm thấy 21 cửa và nội thất" · "Đã đọc 34 chuỗi kích thước".
- Nút huỷ có xác nhận **ngay tại chỗ**, không hộp thoại.
- Khi xong, khối tóm tắt: 48 tường · 21 đối tượng · 34 kích thước · 14 phòng · 248,60 m², kèm câu "Có 9 mục độ tin cậy dưới 0,75 cần bạn xem lại." và hai nút "Duyệt lớp tường" hoặc "Hiệu chỉnh tỷ lệ".
- Rời màn: toast "Sẽ báo cho bạn khi xử lý xong" và chuông thông báo mọc một chấm.
- Trạng thái xếp hàng: các bước xám kèm "Đang chờ hàng đợi — vị trí 2".

[NỐI LOGIC]
- Mọi con số tiến độ lấy từ T-08. **Màn hình không tự tính trọng số, không tự tính phần trăm tổng.**
- Dòng sự kiện lấy từ T-06 và tự chuyển sang T-07 khi mất kết nối. Màn hình chỉ hiển thị, không viết lại cơ chế này, không tự mở kết nối.
- Dừng nghe khi thẻ trình duyệt bị ẩn, nghe lại khi quay về.
- Ghi sự kiện bắt đầu và kết thúc qua O-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Bước xong: dấu tích tự vẽ trong 240ms, nền hàng nháy #EEF4EF trong 400ms, rồi chữ chuyển sang --state-verified.
- Các số đếm chạy số, không nhảy.
- Thời gian dự kiến cập nhật mượt, không bao giờ đếm ngược rồi tăng lên thất thường.
- Đổi tầng: ảnh xem trước hoà tan 240ms.
- Giảm chuyển động: dừng đường quét, thay bằng thanh tiến độ tĩnh.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa chạy.
2. Đang tải — đang xếp hàng, chưa có thời gian dự kiến.
3. Một phần — 3/6 bước; hoặc một tầng lỗi trong khi các tầng khác vẫn chạy: chip tầng đó có chấm vi phạm và dòng tóm tắt nói rõ xử lý vẫn tiếp tục.
4. Lỗi — cả bốn tầng lỗi, InlineAlert đầy đủ, dẫn sang S-14.
5. Xong — mọi bước đã duyệt, nút chính "Duyệt lớp tường" hiện lên bằng nâng nhẹ.
6. Không có quyền — xem được, ẩn nút huỷ.
7. Thu gọn — như mô tả ở bố cục.

[CẤM TUYỆT ĐỐI]
- Tên sáu bước đúng nguyên văn, không viết tắt, không dịch lại.
- Không thanh tiến độ giả: không tự tăng khi không có dữ liệu.
- Không vòng xoay đặt giữa trang.
- Không tự viết giãn cách thử lại, không tự mở kết nối mạng.
- Không hộp thoại chặn trong màn này.
- Một tầng lỗi không bao giờ được dừng các tầng khác.
- Đường quét không glow, không gradient.

[DELIVERABLES]
- src/screens/pipeline/ProcessingScreen/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Giả lập SSE chết giữa bước 3 → xác nhận màn tự chuyển sang quay vòng mà tiến độ **không nhảy lùi**. In log.
- grep sáu tên bước trong vi.json → đủ sáu chuỗi, đủ dấu.
- grep "5, 30, 20, 15, 20, 10\|2500" trong thư mục màn → rỗng.
- Rời màn giữa chừng rồi quay lại → tiến độ đúng, không mất. Báo cáo.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-11 — Hiệu chỉnh tỷ lệ thủ công (ScaleCalibration) ⭐

```
[CONTEXT]
Route /du-an/:id/hieu-chinh-ty-le. Đây là ô nhập số quan trọng nhất của sản phẩm: mọi kích thước phía sau đều nhân với con số này. 4800 mm ÷ 400 px = 12 mm/px.
Người dùng: kỹ sư đang kiểm xem AI đọc chuỗi kích thước có đúng không, hoặc vẽ tay một đường tham chiếu khi OCR trượt.
Nguyên tắc: **hiện phép tính ra**, đừng giấu. Người dùng phải tự kiểm được.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-02 src/domain/units/scale.ts: tính tỷ lệ, so với ước tính của AI, phát hiện lệch quá 15%. M-01: đơn vị và khoảng hợp lệ 1–200 mm/px.
- M-03 bắt điểm lưới 50 mm, góc 15°, bán kính 120 mm.
- S-05 phát lệnh và S-06 ngăn xếp hoàn tác; D-07 tự lưu 800ms.
- P-01 định dạng "12 mm/px", "+2,4%", "1:100"; I-03 con trỏ theo ngữ cảnh và phiên kéo.
- R-07 bay khung nhìn tới một đối tượng (dùng cho việc nhảy tới chuỗi kích thước đã chọn).

[ĐỌC FILE NÀO]
- src/domain/units/**, src/lib/commands/**, src/lib/autosave/**, src/lib/input/**
- src/components/canvas/{ZoomCluster,MeasurementLabel,SelectionHalo,MiniMap}.tsx
- src/components/ui/{NumericField,Button,FieldRow,Kbd,SegmentedControl,ConfidenceMeter}.tsx
- src/components/feedback/InlineAlert.tsx

[BỐ CỤC]
Canvas chiếm vùng giữa, bo 16 thụt 12. Panel phải 344 tiêu đề "Hiệu chỉnh tỷ lệ". Thanh trạng thái 32 ba mục.
- Canvas: bản vẽ đã nắn 3000 × 3000 px, thu phóng được. Chuỗi kích thước OCR nhận được tô màu --data-dimension. Đường hiệu chỉnh là 2px --accent với hai tay nắm đầu cuối là vòng tròn trắng 10px viền 2px --accent.
- Panel phải, từ trên xuống:
  1. "Tỷ lệ hiện tại" — số chữ đều mono-lg "12 mm/px", dưới là dòng dẫn xuất "1 pixel = 12 mm · Bản vẽ ở tỷ lệ khoảng 1:100".
  2. "Cách xác định" — SegmentedControl hai mục: "Từ chuỗi kích thước" và "Vẽ đường tham chiếu".
  3. Điều khiển theo phương pháp (xem dưới).
  4. Khối đối chiếu: "Kết quả: 4.800 mm ÷ 400 px = 12 mm/px" bằng chữ đều, **hiện đủ phép tính**.
  5. Ba dòng kiểm chứng và chân panel: nút chính "Áp dụng tỷ lệ" kèm caption cảnh báo rằng đổi tỷ lệ sẽ tính lại mọi kích thước dẫn xuất, và ô chọn áp cho mọi tầng hay riêng tầng này.
Dưới 1024: panel thành tấm trượt đáy.

[THÀNH PHẦN & DỮ LIỆU]
**Phương pháp 1 — Từ chuỗi kích thước:** danh sách các chuỗi đã đọc, mỗi hàng gồm giá trị chữ đều ("4800", "3600"), ConfidenceMeter, và chiều dài pixel đo được. Chọn một hàng thì tính tỷ lệ ngay.
**Phương pháp 2 — Vẽ đường tham chiếu**, ba bước:
  1. Kéo một đoạn dọc theo cạnh đã biết kích thước. Khi kéo hiện số pixel bằng chữ đều theo thời gian thực, bắt điểm theo M-03.
  2. Ô "Chiều dài thật" gợi sẵn 4800, kèm chú giải lấy từ OCR nếu có.
  3. Kết quả "12 mm/px" chữ đều lớn.
Câu cảnh báo giá trị vô lý: "Giá trị này cho ra bức tường dày 3 mét. Kiểm tra lại đơn vị hoặc chiều dài tham chiếu."
Câu cảnh báo lệch: khi chênh quá 15% so với ước tính của AI thì hiện dải mức cần chú ý — **cảnh báo, không chặn**.

[NỐI LOGIC]
- Tỷ lệ **luôn** gọi M-02. Tuyệt đối không chia số trong màn.
- Bắt điểm gọi M-03, không tự viết.
- Áp dụng tỷ lệ là một **lệnh** phát qua S-05, nên hoàn tác được bằng S-06.
- Tự lưu qua D-07.
- Làm tròn theo P-01, không tự chọn số chữ số thập phân.
- Chọn một chuỗi kích thước thì bay khung nhìn tới nó bằng R-07.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo tay nắm: chiều dài pixel và tỷ lệ cập nhật trực tiếp, cả hai chạy số trong 120ms.
- Chọn một chuỗi kích thước: khung nhìn bay tới trong 340ms và tô sáng chuỗi đó.
- Nhập giá trị vô lý: gợi ý hiện ngay khi gõ, không đợi rời ô.
- Áp dụng tỷ lệ: hiện toast có Hoàn tác, và mọi nhãn kích thước đang hiện chạy số sang giá trị mới trong 240ms.
- Phím: Esc huỷ đoạn đang kéo · Shift khoá theo trục · R đo lại · Enter xác nhận · mũi tên nhích đầu đoạn 1px, kèm Shift là 10px. Khai qua I-01.

[BẢY TRẠNG THÁI]
1. Rỗng — không tìm thấy chuỗi kích thước nào: phương pháp vẽ tay được chọn sẵn kèm giải thích.
2. Đang tải — đang tải ảnh.
3. Một phần — đã kéo đoạn nhưng chưa nhập chiều dài; hoặc một số chuỗi đọc được với độ tin cậy thấp, đánh dấu mức cần chú ý kèm gạch chéo.
4. Lỗi — nắn ảnh thất bại nên bản vẽ có thể méo, có liên kết quay lại bước tiền xử lý.
5. Xong — tỷ lệ đã áp, badge chuyển sang đã duyệt.
6. Không có quyền — canvas không kéo được.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự tính tỷ lệ, không tự viết bắt điểm, không tự làm tròn.
- Không hộp thoại.
- Không giấu phép tính — luôn hiện đủ "4.800 mm ÷ 400 px".
- Không chặn khi lệch, chỉ cảnh báo.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/pipeline/ScaleCalibration/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Kéo đoạn 400 px, nhập 4800 → hiện đúng 12 mm/px → tự lưu → hoàn tác trả về tỷ lệ cũ. In cả bốn bước.
- Nhập tỷ lệ 250 mm/px → phải thấy câu cảnh báo tường dày 3 mét trước khi áp được.
- grep "/ *400\|4800 *\/" hoặc bất kỳ phép chia nào trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-12 — Sơ đồ nhánh xử lý (PipelineGraph)

```
[CONTEXT]
Hai nhánh: tệp CAD cho đường hình học chính xác, ảnh quét dùng AI sáu bước. Màn này giải thích hệ thống đã chọn nhánh nào và vì sao.
Màn này có **hai chế độ**:
- "Tổng quan" — mặc định, cho mọi người dùng. Đây là **màn tạo niềm tin, không phải màn điều khiển**.
- "Chi tiết kỹ thuật" — mở bằng khối gấp, chỉ vai Quản trị và hỗ trợ thấy. Đây là nơi gỡ lỗi khi tầng 3 ra 12 tường thay vì 48.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-08 trạng thái pipeline, nhánh đang dùng theo từng tầng, thời lượng và số lượng đầu ra của từng bước; T-04 schema kết quả đọc tệp CAD.
- P-03 viewmodel: đổi dữ liệu nhánh thành dòng dẫn chứng theo tầng; P-04 trạng thái màn.
- A-01 tokens cho đổi trạng thái khối 180ms; A-02 so le 24ms.
- O-02 cờ tính năng để ẩn hiện chế độ chi tiết theo vai.

[ĐỌC FILE NÀO]
- src/lib/realtime/pipeline.ts, src/lib/viewmodel/**, src/lib/motion/**, src/lib/telemetry/flags.ts
- src/components/ui/{Badge,Tooltip,Button,Table}.tsx, src/components/canvas/{MiniMap,ZoomCluster}.tsx

[BỐ CỤC — CHẾ ĐỘ TỔNG QUAN]
Nội dung 1080 căn giữa. Sơ đồ vẽ bằng khối và đường SVG 1px, **không dùng thư viện đồ thị**: tệp đầu vào → hai nhánh → hợp lại ở Spatial JSON đa tầng → dựng 3D. Khối rộng 200, bo 12, đệm 16, viền mảnh.
Dưới sơ đồ: bảng so sánh hai nhánh, bốn dòng — độ chính xác · thời gian xử lý · có cần QC nhiều không · rủi ro. Mỗi ô một câu ngắn, không biểu tượng màu.
Nút "Đổi sang nhánh AI" có cảnh báo ngay tại chỗ.

[BỐ CỤC — CHẾ ĐỘ CHI TIẾT KỸ THUẬT]
Canvas đồ thị kéo và thu phóng được, panel phải 344.
Nút, từ trái sang phải:
1. "Ảnh gốc" — tên tệp và độ phân giải.
2. "Tiền xử lý" — năm hàng con ngay trong nút: chuyển xám · làm mờ Gauss · dò cạnh Canny · tìm đường biên · nắn phối cảnh 3000×3000.
3. Điểm rẽ thành ba nút song song: "SegFormer MIT-B5 — phân vùng tường" · "YOLOv8m — nhận diện đối tượng" · "PaddleOCR — đọc kích thước".
4. "Trích xuất độ dày" — distanceTransform L2, công thức hiện bằng chữ đều: `W_pixel = 2 × Distance_max`.
5. "Làm mỏng và đơn giản hoá" — Zhang-Suen, Douglas-Peucker.
6. "Chuẩn hoá độ dày" — quy về 110 / 220 / 330 mm hoặc cột bê tông.
7. "Dựng Spatial JSON".
Mỗi nút hiện: tên · thời lượng chữ đều · số lượng đầu ra · một chấm trạng thái.
Panel phải hiện đầu vào, tham số, số lượng đầu ra của nút đang chọn, và ảnh thu nhỏ của bước trung gian nếu có. Có nút phụ "Chạy lại từ bước này" và một khối gấp chứa nhật ký chữ đều 13 trên --bg-sunken.
Dưới 1024: sơ đồ xếp dọc thành danh sách bước.

[NỐI LOGIC]
- Nhánh đang dùng đọc từ T-08: hiện viền đậm và badge "Đang dùng". Nhánh không dùng để mờ 0,55 và **không đổi màu**.
- Dòng dẫn chứng theo tầng lấy từ P-03.
- Thời lượng và số đầu ra của từng nút lấy từ T-08, không bịa.
- Quyền xem chế độ chi tiết đọc từ O-02.
- "Chạy lại từ bước này" phải **cảnh báo ngay tại chỗ** những mục QC đã duyệt sẽ bị ảnh hưởng, và đề nghị giữ lại chúng. Việc chạy lại phát lệnh cho T-08, màn không tự gọi API.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đồ thị vào bằng so le 24ms mỗi nút.
- Chọn một nút: viền 2px --accent và panel phải cuộn tới.
- Khi đang chạy thật, các cạnh chạy nét đứt 1px di chuyển.
- Chạy lại từ một nút: mọi nút phía sau mờ xuống 0,4 rồi lần lượt sáng lại khi xong.
- Nút thất bại đập viền vi phạm ba nhịp rồi giữ tĩnh.
- Đồ thị đi được bằng Tab và phím mũi tên.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa tải tệp, sơ đồ mờ.
2. Đang tải — chạy trực tiếp, cạnh có nét đứt di chuyển.
3. Một phần — mỗi tầng một nhánh; hoặc một nhánh lỗi thì đường thành công vẽ nét thường, nhánh lỗi có viền vi phạm.
4. Lỗi.
5. Xong.
6. Không có quyền — ẩn hẳn chế độ chi tiết và nút đổi nhánh, kèm một câu giải thích.
7. Thu gọn — sơ đồ xếp dọc.

[CẤM TUYỆT ĐỐI]
- Không thư viện vẽ đồ thị, không màu biểu đồ, chỉ đường 1px một màu.
- Không nút nào tô nền màu.
- Chế độ Tổng quan **không** được hiện tên thư viện kỹ thuật (SegFormer, YOLOv8, PaddleOCR chỉ xuất hiện ở chế độ chi tiết và ở tên sáu bước đã chốt).
- Chạy lại phải cảnh báo về việc đã duyệt trước khi làm.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/pipeline/PipelineGraph/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Chụp 1440 bốn ảnh: Tổng quan nhánh CAD · Tổng quan nhánh AI · Chi tiết kỹ thuật · Chi tiết khi một nhánh lỗi.
- Đăng nhập bằng vai Kỹ sư → chế độ chi tiết phải không thấy được. Báo cáo.
- grep tên thư viện đồ thị trong package.json của màn → rỗng.
- Bấm "Chạy lại từ bước này" khi đã duyệt 12 tường → phải thấy cảnh báo nêu đúng số 12.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-13 — Xác nhận nhánh CAD và ánh xạ lớp (CadBranchConfirm)

```
[CONTEXT]
Route /du-an/:id/xac-nhan-cad. Kích hoạt khi phát hiện tệp .dwg hợp lệ. Đây là quyết định một lần ảnh hưởng toàn bộ kết quả.
Người dùng: kỹ sư nhận được tệp CAD gốc và muốn đi đường chính xác thay vì đường AI.
Màn có **hai giai đoạn nối tiếp trong cùng một route**, không lồng hộp thoại:
- Giai đoạn 1: hộp thoại 560 chốt nhánh. Đây là một trong ba nơi duy nhất được dùng hộp thoại.
- Giai đoạn 2: nếu chọn CAD thì hộp thoại đóng và màn ánh xạ lớp mở ra bên dưới.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-03 kiểm tệp CAD: có lớp tường hay không, có khai báo đơn vị hay không, danh sách lớp và số thực thể mỗi lớp.
- T-08 đặt nhánh cho pipeline; T-04 schema kết quả đọc CAD.
- O-02 flags ghi nhớ lựa chọn theo dự án; I-02 bẫy tiêu điểm cho hộp thoại.
- L-03 câu lỗi khi tệp CAD hỏng hoặc phiên bản mới hơn mức hỗ trợ.
- P-06 màu theo vai trò lớp; P-01 định dạng số lượng.

[ĐỌC FILE NÀO]
- src/lib/upload/validate.ts, src/lib/realtime/pipeline.ts, src/lib/input/focusTrap.ts, src/lib/telemetry/flags.ts, src/lib/coloring/**
- src/components/overlay/Modal.tsx, src/components/ui/{Button,Badge,Table,Select,SegmentedControl}.tsx
- src/components/canvas/WallThicknessLegend.tsx, src/components/feedback/InlineAlert.tsx

[BỐ CỤC — GIAI ĐOẠN 1]
Hộp thoại 560, tiêu đề "Phát hiện tệp CAD", một câu giải thích vì sao nên dùng đường từ CAD.
Bảng so sánh hai lựa chọn, ba dòng: độ chính xác · công việc QC · thời gian.
Dưới bảng, một bảng nhỏ liệt kê tầng nào có CAD, tầng nào chỉ có ảnh, lấy từ kết quả T-03.
Chân: nút chính "Dùng đường từ CAD" **tự nhận tiêu điểm** · nút phụ "Vẫn dùng AI" · nút mờ "Huỷ" · ô tích "Ghi nhớ lựa chọn cho dự án này".
Tệp CAD thiếu khai báo đơn vị thì hiện dải cảnh báo nhưng **vẫn cho chọn**.

[BỐ CỤC — GIAI ĐOẠN 2, ÁNH XẠ LỚP]
Hai cột: panel ánh xạ 420 bên trái, canvas xem trước bên phải.
- Panel trái: bảng lớp CAD đọc từ tệp. Cột: tên lớp chữ đều · số thực thể chữ đều · một ô màu nhỏ hiện màu CAD gốc · Select gán vai trò (Tường, Cửa đi, Cửa sổ, Kích thước, Trục, Nội thất, Bỏ qua). Lớp chưa gán mặc định là "Bỏ qua".
- Dưới bảng, trong khối gấp "Tuỳ chọn nhập": Select "Đơn vị bản vẽ" (mm, cm, m, inch) có giá trị tự nhận làm gợi ý, và Select "Gốc toạ độ" với hai lựa chọn "Giữ nguyên gốc CAD" hoặc "Đặt tại giao trục A-1".
- Cột phải: canvas xem trước cập nhật **trực tiếp** khi đổi ánh xạ, có chú giải độ dày tường.
- Chân: dòng tóm tắt "Đã ánh xạ 4/9 lớp · 312 đối tượng sẽ được nhập" và nút chính "Nhập hình học".
Dữ liệu mẫu: 9 lớp CAD.

[NỐI LOGIC]
- Danh sách lớp, số thực thể, đơn vị tự nhận: tất cả từ T-03. **Màn không tự đọc tệp CAD.**
- Chọn nhánh phát cho T-08.
- Ghi nhớ lựa chọn qua O-02.
- Bẫy tiêu điểm và trả tiêu điểm gọi I-02.
- Màu xem trước lấy từ P-06 theo vai trò đã gán — **màu CAD gốc chỉ hiện thành ô nhỏ trong bảng, không bao giờ áp lên canvas**.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đổi ánh xạ một lớp: các thực thể tương ứng đổi màu trên canvas bằng hoà tan 240ms, số tóm tắt chạy số.
- Nổi bật liên kết hai chiều: trỏ vào hàng lớp thì tô sáng thực thể của nó trên canvas trong 180ms và ngược lại.
- Chọn nhánh AI: panel hoà tan sang phần cài đặt AI trong 340ms kèm caption mức cần chú ý nói rằng sẽ cần hiệu chỉnh tỷ lệ.
- Lớp chưa gán mà chứa nhiều thực thể: gợi ý nhẹ ngay tại chỗ, **không phải lỗi chặn**.

[BẢY TRẠNG THÁI]
1. Rỗng — tệp không có lớp đặt tên, hệ thống chuyển sang ánh xạ theo loại hình học.
2. Đang tải — đang đọc .dwg, số thực thể tăng dần.
3. Một phần — chỉ một số tầng có CAD; hoặc một số loại thực thể không hỗ trợ, **liệt kê đích danh kèm số lượng** trong dải mức cần chú ý.
4. Lỗi — tệp hỏng hoặc phiên bản mới hơn mức hỗ trợ: nêu rõ số phiên bản và gợi ý thiết lập khi xuất lại; chỉ còn lựa chọn AI.
5. Xong.
6. Không có quyền.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Chỉ hai lựa chọn chính, không thêm lựa chọn thứ ba gây rối.
- Không lồng hộp thoại trong hộp thoại.
- Không tự đọc tệp CAD trong màn.
- Người dùng **luôn** phải quay về nhánh AI được.
- Xem trước cập nhật trực tiếp, không đợi bấm gửi.
- Thực thể không hỗ trợ phải gọi tên, không được gộp thành "một số lỗi".
- Không tạo component mới.

[DELIVERABLES]
- src/screens/pipeline/CadBranchConfirm/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Kiểm Esc và bẫy tiêu điểm, Tab đúng thứ tự, đóng hộp thoại thì tiêu điểm về nút mở. Báo cáo.
- Đổi ánh xạ một lớp → canvas đổi màu trong cùng khung hình, không cần bấm gì. Quay video hoặc mô tả.
- grep mã màu CAD gốc được áp lên canvas → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-14 — Pipeline thất bại (PipelineFailure)

```
[CONTEXT]
Khi một bước AI lỗi, ví dụ SEG-2041 ở bước nhận diện tường của Tầng 03.
Người dùng: kỹ sư quay lại sau năm phút và thấy tầng 3 chưa xong.
Ba nguyên tắc: giữ nguyên mọi việc đã làm · nói thật chuyện gì xảy ra bằng tiếng Việt · luôn có ít nhất hai đường đi tiếp. **Không đổ lỗi người dùng.**

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-08 thử lại **đúng một bước** và giữ lịch sử các bước đã xong; T-07 gộp sự kiện để không mất tiến độ cũ.
- L-03 câu tiếng Việt, mã lỗi và mã yêu cầu; T-10 phát lại nhật ký để sao chép.
- O-01 ghi sự kiện lỗi; P-04 trạng thái màn; P-02 thời gian.

[ĐỌC FILE NÀO]
- src/lib/realtime/**, src/lib/offline/replayer.ts, src/lib/errors/**, src/lib/telemetry/**
- src/components/feedback/{PipelineStepper,InlineAlert}.tsx
- src/components/ui/{Button,Badge,Table,IconButton}.tsx

[BỐ CỤC]
**Giữ nguyên bố cục và khung của S-10. Không đổi trang, không chiếm toàn màn.**
- Breadcrumb và khung giữ nguyên.
- Thay phần đầu cột trái bằng một InlineAlert mức vi phạm rộng hết cột, bo 12, đệm 20.
- Dưới dải cảnh báo: khối "Kết quả đã có", mỗi dòng một chấm đã duyệt.
- Dải tầng hiện đủ 4 tầng kèm trạng thái, để thấy tầng 1, 2, 4 vẫn ổn.
- Khối gấp "Chi tiết kỹ thuật" chứa nhật ký chữ đều trên --bg-sunken, có nút sao chép.

[THÀNH PHẦN & DỮ LIỆU]
Khối lỗi, **đúng thứ tự này**:
1. Câu dễ hiểu: "Không nhận diện được lớp tường ở Tầng 03."
2. Một dòng nguyên nhân cụ thể: "Bản vẽ có nét quá mảnh và nhiều vết nhiễu, mô hình không tách được tường khỏi nội thất."
3. Mã lỗi chữ đều nhỏ căn phải dưới: "SEG-2041 · yêu cầu 8f2a-41", có nút sao chép.
Ba hướng đi tiếp, mỗi hướng một câu: "Thử lại với ngưỡng thấp hơn" · "Tải lên bản vẽ rõ hơn" · "Bỏ qua tầng đó" (có cảnh báo sẽ thiếu một tầng).
Khối "Kết quả đã có": "Tiền xử lý ảnh — xong" · "Nhận diện cửa và nội thất — 21 đối tượng" · "Đọc kích thước — 34 chuỗi". Kèm caption in đậm ý: "Những kết quả này đã được giữ lại. Chạy lại sẽ không xoá chúng."
Bộ đếm "Lần thử 2". Sau 3 lần thất bại thì đổi câu sang gợi ý liên hệ hỗ trợ, kèm nút sao chép toàn bộ nhật ký và liên kết chìm "Báo lỗi cho hỗ trợ" điền sẵn mã lỗi và mã yêu cầu.

[NỐI LOGIC]
- "Thử lại bước này" gọi T-08 để chạy lại **đúng bước đó**, không chạy lại toàn bộ.
- Nhật ký lấy từ T-10, không tự dựng chuỗi.
- Câu lỗi, mã lỗi, mã yêu cầu đều từ L-03.
- Ghi sự kiện lỗi qua O-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Dải cảnh báo vào bằng mở chiều cao và mờ dần trong 240ms. **Không rung, không nháy.**
- Thử lại: dải cảnh báo được thay tại chỗ bằng PipelineStepper, không đổi trang.
- Sao chép nhật ký: nhãn nút đổi thành "Đã sao chép" trong 1,2 giây.
- Mở khối chi tiết kỹ thuật: chuyển chiều cao 240ms.

[BẢY TRẠNG THÁI]
1. Rỗng — không áp dụng ngoài đời, chỉ mô tả trong story.
2. Đang tải — đang thử lại ngay tại chỗ.
3. Một phần — **đây là trạng thái chính**: một tầng lỗi, ba tầng xong.
4. Lỗi — cả bốn tầng lỗi: khối kết quả thay bằng một dòng, hành động chính đổi thành tải lại ảnh.
5. Xong — thử lại thành công, dải cảnh báo hoà tan thành toast đã duyệt rồi chuyển tiếp.
6. Không có quyền — ẩn ba nút hành động và ẩn nhật ký kỹ thuật.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không hộp thoại, không trang lỗi toàn màn, không nền đỏ.
- Không xoá tiến độ đã có; phải liệt kê rõ cái gì được giữ.
- Không hiện vết lỗi kỹ thuật dài ra ngoài khối gấp.
- Không giọng điệu trách người dùng.
- Luôn có ít nhất hai đường đi tiếp.
- Mã lỗi có mặt nhưng phải nhỏ.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/pipeline/PipelineFailure/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Thử lại bước 2 → pipeline tiếp tục từ bước 2, bước 1 **không** chạy lại. In log để chứng minh.
- Đọc to ba câu lỗi: không câu nào được có chủ ngữ là người dùng. In ba câu ra.
- Đếm số hành động đi tiếp ở trạng thái chính → ≥ 2.
- grep "background.*red\|#C0685A" dùng làm nền lớn trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

> ⚡ **Xong nhóm B — 14/47 màn.** Đây là mốc chạy được luồng đầu–cuối đầu tiên: đăng nhập → tạo dự án → tải ảnh → chạy AI → hiệu chỉnh tỷ lệ. **Đi hết luồng bằng chuột, rồi đi lại lần nữa chỉ bằng bàn phím**, trước khi sang nhóm QC.

---

---

# PHẦN 4 — Nhóm C: QC bản vẽ 2D (7 màn)

> 🔍 Bảy màn này dùng chung một **vỏ QC** định nghĩa ở mục 4.0. Mọi chỉnh sửa là **lệnh** qua S-04/S-05/S-07 nên luôn hoàn tác được. Màu theo độ tin cậy lấy từ P-06, chú giải từ P-07, chọn đối tượng qua S-10/S-11.
> **Không màn nào được tự sửa dữ liệu trong store. Không màn nào được tính hình học.**

## 4.0 — QC-SHELL: vỏ dùng chung (dán kèm mỗi prompt nhóm C)

Khối này lặp lại ở cả bảy màn nên tách riêng. Khi chạy một prompt nhóm C, dán khối này ngay sau `DS-BIND`.

```
[QC-SHELL — VỎ CHUNG CỦA BẢY MÀN QC 2D]

Bố cục ở 1440, dùng lại AppShell của CL-04, không dựng lại:
- Thanh trên 56 với breadcrumb "Dự án > Tầng 01 > <tên lớp>".
- Ray công cụ trái 56: chọn (V) · vẽ (W) · tách · nối · đo (M). Công cụ đang dùng nền --accent-wash, biểu tượng --accent, có vạch 2px bên trái.
- Panel trái 280: điều hướng tầng ở trên · cây lớp (Tường · Cửa và nội thất · Kích thước · Trục · Phòng) · bộ lọc · **danh sách đối tượng ảo hoá, dòng 40** · bộ đếm duyệt ở đầu panel kèm thanh tiến độ 4px.
- Canvas giữa, tối thiểu 640, bo 16, thụt 12. Ảnh bản vẽ gốc nằm dưới ở **20% độ mờ**, lớp dữ liệu vẽ đè lên. Chú giải góc trái dưới, cụm thu phóng góc phải dưới, bản đồ nhỏ góc phải trên.
- Panel phải 344: thanh tra đối tượng **đang chọn**. Tiêu đề h3, mã đối tượng chữ đều mono-lg ngay dưới, rồi các FieldRow. Thông số ít dùng nằm trong khối gấp "Thông số nâng cao". Chân panel có nút chính duyệt và nút chìm bỏ qua.
- Thanh trạng thái 32, đúng ba mục: toạ độ con trỏ · "12 mm/px" · "Đã lưu lúc 14:32".

Quy ước dùng chung:
- Bộ đếm duyệt luôn nhìn thấy, dạng "12/48 tường đã duyệt".
- Mục dưới ngưỡng tin cậy mang gạch chéo 45 độ 2px ở 6% độ mờ cộng một chấm cần chú ý — **không bao giờ đổi sang màu khác**.
- Xanh lá chỉ xuất hiện trên mục **người đã duyệt**, không bao giờ trên độ tin cậy của máy.
- Chọn trên canvas đồng bộ hai chiều với danh sách qua S-11; hàng tương ứng cuộn vào tầm nhìn trong 180ms; canvas dịch chuyển bằng chuyển động dịu 340ms, không nhảy.
- Trỏ chuột lên hàng thì tô sáng đối tượng trên canvas trong 180ms và ngược lại, **không nhấp nháy**.
- Duyệt xong một mục thì tự chuyển sang mục chưa duyệt tiếp theo.
- Xoá là tức thì kèm vé hoàn tác 8000ms của D-05; mục quay lại thì nháy --bg-selected.
- Phím dùng chung, khai qua I-01: J xuống · K lên · Enter duyệt · Backspace xoá · Space lắc canvas · F khắp đối tượng đang chọn · Ctrl+Z hoàn tác.
- **Không màn QC nào được mở hộp thoại.** Không có nút Lưu.
- Vai Người xem: ô trong thanh tra **bỏ viền** thay vì làm xám, nút duyệt thay bằng một câu giải thích.
```

## 4.1 — Bảng xử lý xung đột (nhóm C)

| Màn | Bộ UI/UX nói | Bộ 47 màn nói | Chốt |
| --- | --- | --- | --- |
| Cả nhóm | Danh sách đối tượng ở **panel trái 280**, panel phải 344 là thanh tra | Danh sách ở **panel phải 344** | Danh sách bên **trái**, thanh tra bên **phải**. Đây là bố cục của AppShell đã dựng ở CL-04; đảo lại sẽ phải sửa `src/components/shell`, mà tầng đó bị khoá |
| Cả nhóm | Ảnh gốc dưới lớp dữ liệu ở **20%** | Làm mờ **12%** | 20% cho ảnh gốc dưới lớp dữ liệu · 12% dành riêng cho bóng ma tầng dưới ở S-18 |
| S-17 | Bố cục chia đôi 60/40, **không** dùng vỏ chuẩn, vì đối chiếu là toàn bộ công việc | Dùng vỏ QC | Chia đôi 60/40 — **ngoại lệ duy nhất của nhóm C**, có nêu lý do trong prompt |
| S-19 | Lát cắt đứng rộng 360 | Lát cắt đứng rộng 320 | 360 |
| S-21 | Biểu đồ phân bố có ba ngưỡng kéo được, bảng 48 tường, xem trước phải 320 | Bảng nhóm hai cột, nội dung 1080 | Giữ biểu đồ phân bố (đó là thứ làm cho quyết định của máy soi được), cộng bảng nhóm của bộ 47 màn; nội dung 1280 |
| S-16 | Bộ đếm "9/21 đối tượng đã duyệt" | Ba nhóm gấp 9 · 7 · 5 | Cả hai: cây lớp ba nhóm ở panel trái, bộ đếm 9/21 ở đầu panel |

---

## S-15 — Xem và sửa lớp Tường (WallLayerReview) ⭐

```
[CONTEXT]
Route /du-an/:id/tang/:floorId/lop/tuong. Màn được dùng lâu nhất trong toàn sản phẩm.
Người dùng: kỹ sư đi qua 48 đoạn tường, sửa khoảng một tá cái AI làm sai, và cần biết chính xác còn bao nhiêu.
Mục tiêu: duyệt nhanh **bằng bàn phím**, không rời tay khỏi nhịp làm việc. Trạng thái hiện tại của dữ liệu mẫu: 12/48 đã duyệt.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-11 mô hình Spatial, D-12 chuẩn hoá và tra cứu theo id; S-01 lát dữ liệu, S-03 selector có ghi nhớ.
- S-07 lệnh nghiệp vụ: duyệt tường, sửa độ dày, xoá tường, gộp tường, tách tường. S-05 điều phối lệnh, S-06 ngăn xếp hoàn tác 100 bước.
- M-04 mô hình tường và giải nút giao, M-05 cắt nối và làm sạch, M-03 bắt điểm 50 mm.
- S-08 máy trạng thái công cụ, S-10 vùng chọn và khoanh vùng, S-11 đồng bộ chọn; I-01 phím tắt.
- P-06 tô màu theo độ tin cậy (ngưỡng 0,75), P-07 chú giải tự sinh; D-07 tự lưu, D-05 vé hoàn tác.

[ĐỌC FILE NÀO]
- src/domain/{spatial,walls}/**, src/lib/commands/business/**, src/lib/tools/**, src/lib/selection/**, src/lib/coloring/**
- src/components/canvas/{WallThicknessLegend,ZoomCluster,SelectionHalo,MeasurementLabel,MiniMap,ContextMenu}.tsx
- src/components/ui/{SegmentedControl,ConfidenceMeter,Badge,NumericField,Select,IconButton,Kbd,Tooltip}.tsx

[BỐ CỤC]
Theo QC-SHELL. Riêng màn này:
- Ray công cụ: chọn (V) · vẽ tường (W) · tách đoạn · nối đoạn · đo (M).
- Panel trái: đầu panel là bộ đếm "12/48 tường đã duyệt" với thanh 4px. Dưới là điều hướng tầng, cây lớp với Tường đang bật, rồi ba hộp kiểm lọc: "Chỉ hiện chưa duyệt" · "Chỉ hiện độ tin cậy thấp" · "Chỉ hiện độ dày không chuẩn". Dưới cùng là danh sách tường ảo hoá, dòng 40: mã chữ đều · chip độ dày · ConfidenceMeter · chấm trạng thái.
- Canvas: tường vẽ thành đa giác tô đầy theo màu độ dày; tim tường 1px --wall-centerline bật tắt được. Chú giải độ dày **luôn hiện khi lớp Tường bật**.
- Panel phải khi chọn một tường: tiêu đề "Đoạn tường", mã "#W-014" mono-lg, SegmentedControl độ dày ba mục mỗi mục có ô màu 12 đứng trước (110 / 220 / 330 mm), rồi FieldRow: chiều dài 4.250,00 mm · chiều cao 3.000,00 mm · độ tin cậy kèm ConfidenceMeter ở 0,71 · vật liệu. Khối gấp "Thông số nâng cao": lệch Z, toạ độ đầu, toạ độ cuối. Chân panel: nút chính "Duyệt đoạn này" và nút chìm "Bỏ qua".
- Menu chuột phải trên canvas: Duyệt · Đổi độ dày · Tách đoạn · Xoá.

[NỐI LOGIC]
- Mọi thao tác sửa **phải** gọi đúng lệnh của S-07 rồi điều phối qua S-05. Tuyệt đối không đặt state trực tiếp, không sửa store.
- Công cụ đang dùng lấy từ S-08. Chọn nhiều và khoanh vùng dùng S-10, đồng bộ hai chiều qua S-11.
- Mọi phép nối, tách, đo gọi `src/domain`. **Không có phép hình học nào trong màn.**
- Màu độ tin cậy từ P-06; nội dung chú giải từ P-07.
- Tự lưu qua D-07; xoá dùng vé hoàn tác D-05.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đổi độ dày: đa giác đổi màu bằng chạy màu 240ms, nền hàng nháy #EEF4EF trong 400ms.
- Duyệt một tường: badge chuyển sang đã duyệt, bộ đếm chạy số từ 12 lên 13 trong 240ms, rồi tự chọn tường chưa duyệt kế tiếp.
- Tường dưới 0,75 mang gạch chéo 45 độ 2px ở 6% cộng chấm cần chú ý.
- Phím riêng của màn: 1 / 2 / 3 đặt độ dày · W vẽ tường · các phím chung theo QC-SHELL.

[BẢY TRẠNG THÁI]
1. Rỗng — "Chưa phát hiện được đoạn tường nào ở tầng này. Bạn có thể vẽ tường thủ công bằng phím W, hoặc chạy lại với ngưỡng thấp hơn."
2. Đang tải — canvas khung xương và 12 dòng danh sách khung xương.
3. Một phần — 12/48; hoặc đã có tường nhưng chưa chuẩn hoá xong, gắn chip cần chú ý lên đúng hàng.
4. Lỗi — không tải được lớp, **canvas vẫn xem được ảnh gốc**.
5. Xong — 48/48: bộ đếm chuyển sang đã duyệt và hiện nút chính "Sang lớp Cửa và nội thất".
6. Không có quyền — chỉ xem, ô thanh tra bỏ viền, ẩn mọi nút sửa.
7. Thu gọn — ẩn hai panel, còn cụm công cụ trôi và chú giải.

[CẤM TUYỆT ĐỐI]
- Không tính hình học trong màn.
- Không hộp thoại; xoá dùng vé hoàn tác.
- Không đỏ đặc cho độ tin cậy thấp; dùng thang cần chú ý của P-06.
- Độ dày là điều khiển ba lựa chọn, **không bao giờ là ô nhập số tự do**.
- Che hết chữ vẫn phải phân biệt được ba độ dày.
- Không tạo component mới, không màu ngoài token.

[DELIVERABLES]
- src/screens/qc/WallLayerReview/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Duyệt 5 tường **chỉ bằng bàn phím** → bộ đếm lên 17/48 → Ctrl+Z năm lần trả về 12/48. In số đếm sau mỗi bước.
- grep "Math\." trong thư mục màn → không được có phép hình học nào.
- Chụp canvas ở chế độ đen trắng, che hết chữ → ba độ dày vẫn phân biệt được.
- Kiểm chú giải hiện khi lớp Tường bật → phải luôn có.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-16 — Xem và sửa lớp Cửa và nội thất (ObjectLayerReview) ⭐

```
[CONTEXT]
Route .../lop/doi-tuong. 21 đối tượng: 9 cửa đi, 7 cửa sổ, 5 nội thất. Hiện 9/21 đã duyệt.
Người dùng: người duyệt phần lớn chỉ xác nhận, thỉnh thoảng đổi một cửa đi thành cửa sổ.
Dùng lại QC-SHELL, **không định nghĩa lại vỏ**.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-08 gắn lỗ mở lên tường: kiểm chồng lấn, chiều mở, vị trí hợp lệ. M-09 trôi lỗ mở khi tường đổi và kiểm hợp lệ.
- S-07 lệnh: đổi loại, đổi chiều mở, di chuyển, xoá, duyệt. S-05 điều phối, S-06 lịch sử.
- S-10, S-11 vùng chọn; D-06 gộp lệnh 400ms khi kéo liên tục; D-04 cập nhật lạc quan.
- P-06 màu độ tin cậy và màu lớp dữ liệu; P-01 định dạng "900 × 2.200 mm".
- R-07 bay khung nhìn tới đối tượng (dùng khi bấm vào tường chủ).

[ĐỌC FILE NÀO]
- src/domain/openings/**, src/lib/commands/business/**, src/lib/selection/**, src/lib/mutations/**, src/lib/coloring/**
- src/components/canvas/{SelectionHalo,MeasurementLabel,WallThicknessLegend,ContextMenu}.tsx
- src/components/ui/{Select,Slider,Radio,NumericField,SegmentedControl,ConfidenceMeter,Badge,IconButton}.tsx

[BỐ CỤC]
Theo QC-SHELL. Riêng màn này:
- Panel trái: bộ đếm "9/21 đối tượng đã duyệt". Cây lớp có ba lớp con bật tắt được, mỗi lớp một ô màu và một số đếm: Cửa đi (9) · Cửa sổ (7) · Nội thất (5) · tổng 21 đối tượng. Dưới là hàng chip lọc theo loại: cửa đơn · cửa đôi · cửa sổ · giường · sofa · bàn ăn · bồn cầu · chậu rửa. Dưới cùng là danh sách gộp theo ba nhóm gấp được, mỗi dòng: mã · kích thước · tường chủ · độ tin cậy.
- Canvas: đối tượng vẽ bằng **ký hiệu kiến trúc**, không phải khung bao. Cửa đi có cung mở, cửa sổ hai vạch song song nét 4-2. Viền 1px màu dữ liệu của lớp, nền 6%. Tường hạ xuống --wall-idle để đối tượng nổi lên. Hộp chọn có 4 tay cầm 6px.
- Panel phải khi chọn: tiêu đề "Đối tượng", mã "#D-007" mono-lg, Select loại có biểu tượng, rồi FieldRow: chiều rộng 900 mm · chiều cao 2.200 mm · tường chứa nó dạng liên kết bấm được "#W-014" · vị trí trên tường là Slider 0–1 có số chữ đều · hướng mở là bốn radio biểu tượng · ConfidenceMeter. Riêng cửa sổ có thêm FieldRow "cao độ bệ cửa 900 mm".

[NỐI LOGIC]
- Gắn vào tường, chặn chồng lấn, gợi ý vị trí hợp lệ: **tất cả gọi M-08**. Màn không tự tính vị trí gắn.
- Kéo liên tục gộp thành **một** lệnh theo D-06 (cửa sổ 400ms).
- Đổi loại bằng ô chọn hoặc phím; mỗi lần đổi là một lệnh S-07, hoàn tác được.
- Đối tượng không gắn được vào tường nào: hiện badge cần chú ý "Chưa gắn vào tường nào" kèm hành động "Gắn vào tường gần nhất" — hành động này gọi M-08, không tự tìm.
- Bấm liên kết tường chủ thì chọn tường đó và bay khung nhìn tới bằng R-07.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Bật tắt một lớp con: đối tượng của lớp đó mờ dần kèm dịch dọc 4px trong 240ms, so le 24ms.
- Đổi loại: ký hiệu trên canvas biến hình trong 240ms và đổi màu bằng chạy màu.
- Kéo Slider vị trí: đối tượng trượt dọc tường chủ theo thời gian thực, hiện số đo khoảng cách tới **hai đầu tường** bằng MeasurementLabel.
- Phím riêng: D / W / F đặt nhóm loại · 1 / 2 / 3 đổi loại trong nhóm · các phím chung theo QC-SHELL.

[BẢY TRẠNG THÁI]
1. Rỗng — AI không tìm thấy đối tượng nào; giải thích rằng nhận diện nội thất phụ thuộc kiểu vẽ, kèm nút thêm thủ công.
2. Đang tải.
3. Một phần — 5 mục dưới ngưỡng 0,75 được lọc sẵn; hoặc nhánh nội thất lỗi trong khi cửa vẫn xong: lớp nội thất hiện một hàng cần chú ý, **không chặn cả màn**.
4. Lỗi.
5. Xong — 21/21.
6. Không có quyền.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự tính vị trí gắn cửa, không tự kiểm chồng lấn.
- Vẽ bằng ký hiệu kiến trúc, **không phải khung bao**.
- Không quá ba màu dữ liệu hiện cùng lúc.
- Không biểu tượng tô đầy màu cho loại đối tượng.
- Số 21 = 9 + 7 + 5 phải đúng ở mọi nơi xuất hiện.
- Mọi đối tượng phải nói rõ tường nào chứa nó, hoặc bị gắn cờ nếu không có.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/qc/ObjectLayerReview/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Kéo một cửa 20 lần liên tục → lịch sử chỉ tăng **1** bước. In số bước.
- Đếm màu dữ liệu hiện cùng lúc khi bật cả ba lớp → đúng 3.
- In tổng số đối tượng ở cả bốn nơi (cây lớp, bộ đếm, danh sách, canvas) → phải cùng bằng 21.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-17 — Xem và sửa Kích thước OCR (DimensionOcrReview)

```
[CONTEXT]
Route .../lop/kich-thuoc. 34 chuỗi kích thước đã đọc, 18/34 đã duyệt.
Người dùng: người duyệt kiểm 34 số, nơi mà đọc nhầm 3 thành 8 làm lệch một phòng nửa mét.
**Ngoại lệ bố cục:** màn này KHÔNG dùng vỏ QC chuẩn. Nó chia đôi 60/40, vì việc đối chiếu ảnh gốc với số đã đọc chính là toàn bộ công việc — panel 344 quá hẹp để đặt ảnh cắt cạnh ô nhập.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-12 tra cứu kích thước theo tường; M-01 đơn vị; M-02 đối chiếu với tỷ lệ hiện tại; M-15 đo lại từ hình học.
- S-07 lệnh sửa giá trị và duyệt chuỗi; S-05 điều phối; D-07 tự lưu.
- P-06 màu độ tin cậy; P-01 định dạng số và sai số "lệch 0,25%".
- I-01 phím tắt, I-02 thứ tự tiêu điểm; R-07 bay khung nhìn.

[ĐỌC FILE NÀO]
- src/domain/{units,spatial,measure}/**, src/lib/commands/business/**, src/lib/coloring/**, src/lib/input/**
- src/components/canvas/{MeasurementLabel,SelectionHalo,ZoomCluster}.tsx
- src/components/ui/{NumericField,Select,ConfidenceMeter,Badge,SegmentedControl,Kbd}.tsx

[BỐ CỤC]
Chia đôi, nội dung tối đa 1440.
- Trái 60%: canvas. Mỗi chuỗi kích thước phát hiện được bao bằng hình chữ nhật 1px --data-dimension, giá trị vẽ cạnh nó bằng chữ đều. Chuỗi vẽ đúng kiểu bản vẽ: đường gióng, hai đầu mũi, số ở giữa.
- Phải 40%: danh sách duyệt. Đầu danh sách dính: bộ đếm "18/34 kích thước đã duyệt" và SegmentedControl lọc "Tất cả / Độ tin cậy thấp / Chưa duyệt".
  Mỗi hàng là thẻ trắng bo 12 đệm 16: **bên trái là ảnh cắt vùng gốc tỷ lệ 1:1 rộng tối đa 160, bo 8** · bên phải là NumericField giữ giá trị đã đọc bằng mono-lg, đơn vị **mm cố định hiển thị bên phải ô, không phải ô nhập**, ConfidenceMeter, và một caption ghi liên kết suy ra "Gắn với #W-014".
- Dải đối chiếu dính đáy: "So sánh với hình học: chuỗi đọc được 4.800 mm · đo từ bản vẽ 4.812 mm · lệch 0,25%". Số bằng chữ đều. **Độ lệch chỉ tô màu cần chú ý khi vượt 2%.**
Dưới 1024: ảnh cắt thu về 96.

[NỐI LOGIC]
- "Giá trị đo lại từ hình học" lấy từ D-12 và M-15. **Màn không tự đo, không tự tính lệch, không tự quy đổi đơn vị.**
- Sửa số là một lệnh qua S-05, tự lưu bằng D-07.
- Ngưỡng tô màu lấy từ P-06; định dạng phần trăm lấy từ P-01.
- Chọn một hàng thì bay khung nhìn tới vùng đó bằng R-07 và bao bằng viền 2px --accent.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Sửa một giá trị: phép đối chiếu chạy lại ngay, phần trăm lệch chạy số trong 240ms.
- Duyệt xong tự sang chuỗi chưa duyệt kế tiếp và cuộn vào tầm nhìn.
- Phím: Enter lưu và nhảy dòng sau · Tab sang cột sau · Esc bỏ sửa · R bật **chế độ duyệt bàn phím**.
- Chế độ duyệt bàn phím: cả màn thu về **một ảnh cắt lớn và một ô nhập duy nhất**. Gõ số, Enter, ảnh cắt kế tiếp hiện ra bằng hoà tan 180ms. Đây là đường nhanh nhất, phải có một caption chỉ ra nó.
- Nhập giá trị vô lý (ví dụ hàm ý phòng dài 30 mét) thì gợi ý hiện ngay khi gõ.

[BẢY TRẠNG THÁI]
1. Rỗng — OCR không đọc được gì; giải thích và dẫn sang hiệu chỉnh tỷ lệ thủ công.
2. Đang tải.
3. Một phần — 9 mục dưới ngưỡng, có bộ lọc "chỉ hiện mục cần xem"; hoặc OCR mới xong một phần bản vẽ.
4. Lỗi.
5. Xong — 34/34.
6. Không có quyền.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự tính lệch, không tự quy đổi đơn vị, không tự đo.
- Đơn vị là mm cố định hiển thị bên phải ô, không phải ô nhập tự do.
- Mỗi số đọc được **phải** có ảnh cắt gốc nằm cạnh.
- Độ lệch chỉ tô màu khi thật sự đáng kể.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/qc/DimensionOcrReview/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Sửa 5 giá trị chỉ bằng bàn phím trong một lượt. Báo cáo số lần phải dùng chuột — phải bằng **0**.
- Trong chế độ duyệt bàn phím, đếm số lần gõ phím để xong một chuỗi → phải là 2 (số rồi Enter).
- Đặt lệch 1,5% và 2,5% → chỉ cái thứ hai được tô màu. In cả hai.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-18 — Quản lý trục và gốc toạ độ (AxisGridManager)

```
[CONTEXT]
Route .../lop/truc. Gốc toạ độ và hệ trục quyết định các tầng có xếp đúng lên nhau hay không. Giao của trục A và trục 1 được định nghĩa là (0,0,0) và mọi tầng đăng ký theo nó.
Người dùng: kỹ sư đang kiểm xem tầng 2 có nằm đúng trên tầng 1 hay bị lệch hai mét.
Nguyên tắc: lệch tầng phải **lộ ra ở đây**, đừng để tới lúc dựng 3D mới phát hiện.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-10 hệ trục: sinh trục, đặt tên A B C và 1 2 3, khoảng cách tối thiểu 100 mm.
- M-11 căn các tầng và cảnh báo lệch trên 150 mm.
- S-07 lệnh thêm, xoá, di chuyển trục, đặt gốc; S-05 điều phối; M-03 bắt điểm; D-05 vé hoàn tác.
- P-01 định dạng toạ độ và độ lệch; P-04 trạng thái màn.

[ĐỌC FILE NÀO]
- src/domain/axes/**, src/lib/commands/business/**, src/lib/format/**, src/lib/mutations/undo.ts
- src/components/canvas/{SelectionHalo,MeasurementLabel,MiniMap,ZoomCluster}.tsx
- src/components/ui/{Table,NumericField,Select,Button,Badge,Toggle}.tsx

[BỐ CỤC]
Theo QC-SHELL, breadcrumb "Dự án > Trục và gốc toạ độ".
- Canvas: trục vẽ nét gạch-chấm 1px --data-axis kéo dài quá đường bao công trình. Nhãn trục là chữ đều 13 trong vòng tròn 24 viền 1px --data-axis — **đây là một trong hai nơi duy nhất được viết hoa**. Gốc toạ độ là vòng tròn --accent 10px có chữ thập, nhãn "0,0". Bóng ma tầng dưới vẽ ở **12% độ mờ** để thấy ngay lệch.
- Panel trái: danh sách trục hai nhóm "Trục ngang" và "Trục dọc", mỗi hàng có nhãn, khoảng cách tới trục kế bằng chữ đều, và nút bật tắt hiển thị. Mỗi nhóm có nút chìm "Thêm trục". Toggle bật tắt bóng ma tầng dưới.
- Panel phải: mục "Gốc toạ độ" có Select chọn giao trục neo, mặc định "A-1", và các FieldRow chỉ đọc chữ đều hiện độ lệch **cả theo pixel và theo milimét**. Mục "Căn chỉnh giữa các tầng": liệt kê từng tầng với độ lệch so với gốc bằng chữ đều và một chấm trạng thái; tầng lệch quá dung sai mang mức cần chú ý. Nút phụ "Căn chỉnh tự động".

[NỐI LOGIC]
- Sinh trục tự động từ tường chịu lực gọi M-10. Căn tầng gọi M-11. **Màn không tự sinh, không tự tính lệch.**
- Kéo trục dùng bắt điểm M-03 và tạo lệnh qua S-07.
- Chặn đặt hai trục cách nhau dưới 100 mm — chặn bằng **câu giải thích nói rõ hai trục nào**, không chặn im lặng.
- Lệch quá ngưỡng thì hiện dải cảnh báo kèm nút "Xem trên bản vẽ".
- Căn tự động là **một** lệnh, hoàn tác được bằng một lần Ctrl+Z, kèm toast hoàn tác.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo một trục: mọi khoảng cách phụ thuộc cập nhật trực tiếp bằng chữ đều, bắt vào tim tường gần nhất bằng đường cong mềm.
- Đổi giao trục neo: dấu gốc chạy tới vị trí mới trong 340ms và mọi số toạ độ chạy số sang giá trị mới.
- Bật tắt bóng ma tầng dưới: hoà tan 240ms.
- Căn tự động: từng tầng trượt vào vị trí trong 340ms, so le 60ms, rồi hiện toast có Hoàn tác.
- Trỏ vào một hàng tầng trong danh sách lệch thì đường bao bóng ma của tầng đó nháy lên trên canvas.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có trục: giải thích kèm hai nút "Vẽ trục thủ công" và "Suy ra từ tường bao".
2. Đang tải — đang tính.
3. Một phần — chỉ có trục dọc; hoặc chỉ một số tầng có trục, liệt kê theo tầng.
4. Lỗi.
5. Xong — mọi tầng trong dung sai, badge đã duyệt.
6. Không có quyền.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự sinh trục, không tự tính lệch tầng.
- Không cho hai trục cách nhau dưới 100 mm, và phải nói vì sao.
- Căn tự động phải hoàn tác được trong **một** thao tác.
- Mọi độ lệch hiện bằng chữ đều, đủ cả pixel và milimét.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/qc/AxisGridManager/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Căn tự động → độ lệch mọi tầng dưới 50 mm. **In bảng lệch trước và sau.**
- Ctrl+Z một lần sau khi căn tự động → trở về nguyên trạng. In số bước lịch sử, phải bằng 1.
- Thử đặt hai trục cách 80 mm → phải thấy câu chặn nêu đúng tên hai trục.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-19 — Quản lý tầng (FloorManager) ⭐

```
[CONTEXT]
Route /du-an/:id/tang. Bộ điều khiển đa tầng: 4 tầng, cao độ −3,0 / 0,0 / 3,9 / 7,5 m, tổng cao 14,7 m.
Người dùng: kỹ sư thêm một tầng hầm bị quên, hoặc sửa tầng 2 nhập nhầm 3,6 m trong khi thực tế là 3,9 m.
Đây là **màn điều phối, không phải màn sửa hình học**. Không dùng vỏ QC.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-11 căn tầng và tính cao độ tích luỹ; D-11 mô hình đa tầng; D-12 đếm đối tượng theo tầng.
- S-07 lệnh thêm, nhân bản, đổi thứ tự, đổi cao độ, xoá tầng; S-05 điều phối; D-05 vé hoàn tác.
- P-01 định dạng cao độ và diện tích; P-03 viewmodel tiến độ QC theo tầng; A-03 chạy số 240ms.

[ĐỌC FILE NÀO]
- src/domain/{axes,spatial}/**, src/lib/commands/business/**, src/lib/viewmodel/**, src/lib/mutations/undo.ts
- src/components/ui/{Table,Badge,NumericField,Toggle,IconButton,Button,ContextMenu}.tsx
- src/components/feedback/{EmptyState,InlineAlert,Toast}.tsx

[BỐ CỤC]
Hai cột, nội dung tối đa 1120, đệm 32.
- Trái 360: **lát cắt đứng** vẽ bằng SVG 1px, đọc từ dưới lên. Mỗi tầng là một dải ngang **cao theo tỷ lệ thật**, nền --bg-sunken viền nét mảnh; tầng đang chọn nền --bg-selected có vạch 2px --accent bên trái. Mỗi dải hiện tên tầng, chiều cao bằng chữ đều, và một ảnh thu nhỏ mặt bằng. Mép trái có thang cao độ bằng chữ đều theo mét. Đầu cột hiện tổng chiều cao công trình bằng mono-lg.
- Phải: bảng tầng dòng 40. Cột: tay nắm kéo · Tên tầng · Cao độ (m) · Chiều cao (m) · Bản vẽ · Tường · Phòng · Diện tích · Tiến độ QC · hành động. NumericField sửa ngay trong ô.
- Trên bảng: nút phụ "Thêm tầng" và nút chìm "Nhân bản tầng".
- Dưới bảng: caption nói rõ luật — cao độ tính tự động từ chiều cao các tầng dưới trừ khi ghi đè — kèm Toggle "Tự động tính cao độ". Chân bảng hiện tổng: "4 tầng · tổng cao 14,7 m · 248,60 m²".
- Menu ngữ cảnh mỗi dòng: Nhân bản · Đổi tên · Ẩn khỏi mô hình 3D · Xoá.
Dưới 1024: lát cắt chuyển xuống dưới bảng.

[NỐI LOGIC]
- Đổi cao độ hay thứ tự **luôn** gọi M-11 rồi phát lệnh S-07. Không cộng cao độ trong màn.
- Số tường, phòng, diện tích đọc từ D-12. **Không đếm tay.**
- Tiến độ QC theo tầng lấy từ P-03.
- Xoá tầng dùng vé hoàn tác D-05, **không hộp thoại**.
- Nhân bản tầng hỏi có sao chép nội thất hay không **ngay tại dòng**, không mở hộp thoại.
- Chặn trùng cao độ giữa hai tầng, nói rõ hai tầng nào.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo đổi thứ tự: có đường chèn 2px; các dải lát cắt xếp lại trong 340ms và mọi số cao độ chạy số sang giá trị vừa tính lại.
- Sửa chiều cao: dải tương ứng **cao lên hoặc thấp xuống ngay trong lúc gõ**, để thấy hậu quả trước khi chốt.
- Nhân bản: bản sao trượt vào ngay trên bản gốc bằng chuyển chiều cao 240ms.
- Xoá: dải thu lại, các dải trên trượt xuống, toast hoàn tác 8 giây.
- Trỏ vào một dòng bảng thì dải tương ứng sáng lên và ngược lại.

[BẢY TRẠNG THÁI]
1. Rỗng — "Chưa có tầng nào. Thêm tầng đầu tiên, hoặc nhập số tầng từ màn hình tạo dự án."
2. Đang tải.
3. Một phần — một tầng chưa có bản vẽ: chấm cần chú ý và liên kết "Tải lên" ngay trong dòng.
4. Lỗi.
5. Xong.
6. Không có quyền — ẩn mọi hành động sửa.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự tính cao độ, không tự đếm đối tượng.
- Không cho trùng cao độ; chặn bằng câu nói rõ hai tầng nào.
- Không hộp thoại cho xoá tầng.
- Chiều cao dải **phải** tỷ lệ với chiều cao thật — lát cắt là bản xem trước hậu quả, không phải trang trí.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/qc/FloorManager/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi chiều cao Tầng 1 từ 3,9 sang 4,2 → cao độ Tầng 2 phải tự dịch từ 3,9 sang 4,2. **In bảng cao độ trước và sau.**
- Đo chiều cao pixel của bốn dải và đối chiếu tỷ lệ với 3,0 / 3,9 / 3,6 / 3,6 m. In bốn cặp số.
- Xoá một tầng rồi hoàn tác → thứ tự và cao độ trở về nguyên trạng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-20 — Duyệt nhãn phòng (RoomLabelReview)

```
[CONTEXT]
Route .../lop/phong. 14 phòng đã nhận diện, tổng 248,60 m². Phòng #R-005 có 18,40 m².
Người dùng: người duyệt xác nhận 14 tên phòng, trong đó vài cái OCR đọc thành "PHÒNG NGỦ 1" và một cái để trống.
Vì sao quan trọng: tên phòng về sau **điều khiển luật không gian** — một phòng đặt tên GARA thì không được chứa giường.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-06 dò phòng từ đồ thị tường; M-07 tính diện tích và diễn giải cách tính.
- M-14 bảy luật công năng, dùng để nhắc sớm (ví dụ phòng ngủ không có cửa sổ).
- S-07 lệnh đổi tên, đổi công năng, gộp phòng, tách phòng, duyệt; S-05 điều phối; D-05 vé hoàn tác.
- P-06 tô màu theo công năng, P-07 chú giải và kiểm tương phản; P-01 định dạng diện tích.

[ĐỌC FILE NÀO]
- src/domain/{rooms,rules}/**, src/lib/commands/business/**, src/lib/coloring/**
- src/components/canvas/{SelectionHalo,WallThicknessLegend,MeasurementLabel}.tsx
- src/components/ui/{Combobox,Select,Input,ConfidenceMeter,Badge,Tooltip,Table}.tsx

[BỐ CỤC]
Theo QC-SHELL, breadcrumb "Dự án > Tầng 01 > Nhãn phòng".
- Canvas: đa giác phòng tô nền theo công năng bằng **thang rất nhạt** do P-06 sinh; phòng đang chọn nâng lên 10% và có viền 2px --accent. Tường hạ xuống --wall-idle. Nhãn giữa phòng hai dòng: tên bằng chữ thân 15 và diện tích bằng chữ đều 13 bên dưới. **Nhãn tự ẩn khi phòng nhỏ hơn ngưỡng hiển thị.**
- Panel trái: dòng tóm tắt đầu panel "Tổng diện tích sàn 248,60 m² · 14 phòng". Dưới là danh sách 14 phòng, dòng 40: tên · diện tích chữ đều "18,40 m²" · chấm trạng thái. Có chip lọc "Chưa đặt tên".
- Panel phải khi chọn: tiêu đề "Phòng", mã "#R-005" mono-lg, Combobox tên phòng với từ vựng chuẩn (Phòng ngủ, Phòng khách, Bếp, WC, Gara, Hành lang, Cầu thang, Kho, Văn phòng, Phòng họp) **cộng chữ tự do**, Select công năng điều khiển luật, rồi FieldRow chỉ đọc chữ đều: diện tích · chu vi · chiều cao thông thuỷ. Cuối là ConfidenceMeter cho tên do OCR gợi ý, kèm **ảnh cắt gốc đặt bên cạnh**.
- Nút phụ "Chuẩn hoá tên": quy các biến thể chữ tự do về từ vựng chuẩn, **hiện danh sách xem trước những gì sẽ đổi trước khi áp**.

[NỐI LOGIC]
- Diện tích và cách tính lấy từ M-07, kèm chú giải "tính theo mép trong tường". **Màn không tự tính diện tích.**
- Gộp hoặc tách phòng gọi M-06 rồi phát lệnh S-07.
- Cảnh báo công năng lấy từ M-14, hiện dạng **dòng nhắc trong panel**, có liên kết sang màn luật không gian, và **không chặn**.
- Danh mục công năng lấy từ nguồn chung, không định nghĩa lại trong màn.
- Chuẩn hoá tên hàng loạt là một lệnh, kèm hoàn tác 8 giây.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Chọn một phòng từ danh sách: đa giác tô đậm dần trong 180ms và canvas dịch mượt tới.
- Đổi tên: nhãn trên canvas hoà tan trong 180ms; diện tích **chỉ** tính lại khi hình học đổi.
- Phòng chưa đặt tên mang chấm cần chú ý, lọc được bằng một chip.
- Chuẩn hoá tên: hiện danh sách xem trước, áp khi xác nhận, rồi mời hoàn tác trong 8 giây.

[BẢY TRẠNG THÁI]
1. Rỗng — vòng tường chưa kín nên chưa có phòng: giải thích rằng tường có thể còn khe hở, kèm nút "Kiểm tra khe hở tường" và nút sang lớp tường.
2. Đang tải — đang tính.
3. Một phần — 3 phòng chưa có tên; hoặc một số vòng còn hở, liệt kê kèm kích thước khe hở bằng chữ đều.
4. Lỗi.
5. Xong.
6. Không có quyền.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự tính diện tích, không tự định nghĩa lại danh mục công năng.
- Màu công năng phải **rất nhạt** để không đè nhãn; tương phản chữ trên nền phòng từ 4,5:1 trở lên.
- Từ vựng chuẩn được gợi ý nhưng **không bao giờ ép**.
- Thao tác hàng loạt luôn xem trước trước khi áp.
- Vòng hở phải báo kèm một bước đi tiếp cụ thể.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/qc/RoomLabelReview/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Tổng diện tích hiển thị đúng **248,60 m²** và #R-005 đúng **18,40 m²**. In hai số này.
- Đo tương phản chữ nhãn trên nền phòng đậm nhất → ≥ 4,5:1. In số đo.
- Bấm "Chuẩn hoá tên" → phải thấy danh sách xem trước trước khi có bất kỳ thay đổi nào.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-21 — Chuẩn hoá độ dày tường (ThicknessStandardization)

```
[CONTEXT]
Bước hàng loạt: gộp mọi độ dày đo được lệch lạc về nhóm chuẩn 110 / 220 / 330 mm hoặc Cột bê tông cốt thép. Làm đúng một lần tiết kiệm hàng giờ sửa tay.
Người dùng: người duyệt để ý thấy 30 bức tường đo được 195 mm đều bị quy về 220 mm và muốn kiểm xem như vậy có đúng không.
Điểm mấu chốt: **biểu đồ phân bố làm cho quyết định của máy soi được**, thay vì giấu nó đi. Không dùng vỏ QC.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-05 gợi ý nhóm độ dày và làm sạch; M-04 dọn mối nối sau khi đổi độ dày.
- S-07 lệnh áp nhóm độ dày theo lô; S-06 lịch sử — **một lô bằng đúng một bước hoàn tác**; D-05 vé hoàn tác.
- P-01 định dạng; P-03 viewmodel nhóm theo độ dày; P-04 trạng thái màn; P-06 màu tường.

[ĐỌC FILE NÀO]
- src/domain/walls/**, src/lib/commands/business/**, src/lib/viewmodel/**, src/lib/coloring/**
- src/components/ui/{Table,SegmentedControl,NumericField,Badge,Button,Checkbox,Slider}.tsx
- src/components/canvas/{SelectionHalo,WallThicknessLegend}.tsx

[BỐ CỤC]
Màn phân tích rộng, nội dung tối đa 1280, canvas chỉ là xem trước phụ.
- Trên: **biểu đồ phân bố** độ dày đo được. Trục x theo milimét có vạch chữ đều, cột gộp theo bậc 5 mm, cao 200. Cột dùng --text-muted trên nền --bg-sunken — **không bao giờ cột màu**. Ba đường ngưỡng 1px --accent **kéo được**, mỗi đường có nhãn chữ đều hiện giá trị hiện tại. Dải giữa các ngưỡng tô bằng đúng màu xám tường tương ứng ở 8% để đọc được ánh xạ.
- Giữa: hàng tóm tắt bốn con số trần bằng mono-lg với nhãn chữ thường bên dưới — số đoạn tường · đã chuẩn hoá · lệch quá ngưỡng sai số · cột bê tông cốt thép.
- Dưới: hai cột.
  - Trái, bảng nhóm: Độ dày đo được · Số tường · Nhóm chuẩn đề xuất · ô đồng ý.
  - Dưới bảng nhóm là bảng chi tiết 48 đoạn: mã · độ dày đo được (chữ đều, một chữ số thập phân) · độ dày chuẩn hoá (SegmentedControl ba lựa chọn ngay trong ô) · sai lệch (chữ đều, có chấm cần chú ý khi vượt dung sai) · độ tin cậy · tầng · trạng thái. Sắp xếp được theo sai lệch để trường hợp tệ nhất nổi lên đầu. Chọn hàng thì hiện dải hành động theo lô dính đáy.
  - Phải 320: canvas xem trước nhỏ, tô sáng nhóm hoặc tường đang trỏ tới, để giữ ngữ cảnh không gian. Có chú giải độ dày.
- Ô dung sai bằng NumericField và nút phụ "Áp dụng lại bộ lọc".

[NỐI LOGIC]
- Nhóm đề xuất lấy từ M-05. **Không tự làm tròn.**
- Áp dụng tạo **một lệnh lô duy nhất** qua S-07, nên một lần Ctrl+Z trả về hết.
- Sau khi áp **phải** gọi M-04 dọn mối nối. Màn không tự xử lý nút giao.
- Màu dải và màu tường lấy từ P-06.
- Áp dụng lại bộ lọc **phải cảnh báo ngay tại chỗ** có bao nhiêu tường đã duyệt sẽ bị đổi, và đề nghị loại chúng ra — giữ đúng luật việc đã duyệt không bị ghi đè im lặng.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo một ngưỡng: bảng gộp lại theo thời gian thực, các hàng đổi chỗ bằng layout animation 240ms, bốn con số tóm tắt chạy số.
- Trỏ vào một cột biểu đồ: các hàng khớp sáng lên bằng --bg-hover và những tường đó được viền trên canvas xem trước.
- Gán độ dày theo lô: các hàng được chọn nháy #EEF4EF trong 400ms rồi mời hoàn tác.
- Tóm tắt trước khi áp, hiện thành câu: "48 tường → 3 nhóm chuẩn. 6 tường lệch quá 20 mm sẽ không đổi." Sáu tường không đổi được **liệt kê rõ** và có nút xem từng cái.

[BẢY TRẠNG THÁI]
1. Rỗng — độ dày đã chuẩn, không cần làm gì; hoặc chưa có số đo.
2. Đang tải — biểu đồ khung xương **đúng chiều cao 200** để không nhảy khung.
3. Một phần — chỉ chọn hai nhóm; hoặc mới có số đo của một số tầng.
4. Lỗi.
5. Xong — kèm dòng kết quả và nút hoàn tác; nếu mọi đoạn đều trong dung sai thì tóm tắt chuyển sang mức đã duyệt.
6. Không có quyền.
7. Thu gọn — ẩn canvas xem trước.

[CẤM TUYỆT ĐỐI]
- **Không áp thay đổi nào trước khi người dùng bấm.** Không tích sẵn toàn bộ.
- Không tách thành nhiều bước hoàn tác.
- Cột biểu đồ trung tính; chỉ các dải mang màu xám tường ở độ mờ thấp.
- Áp dụng lại bộ lọc không bao giờ được ghi đè im lặng tường đã duyệt.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/qc/ThicknessStandardization/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Áp ba nhóm → Ctrl+Z **một lần** trả về nguyên trạng. In số bước lịch sử, phải bằng 1.
- Kéo một ngưỡng qua lại 5 lần → bảng và bốn con số cập nhật, không lần nào ghi vào dữ liệu. Xác nhận lịch sử vẫn 0 bước.
- Áp dụng lại bộ lọc khi đã duyệt 12 tường → cảnh báo phải nêu đúng số tường đã duyệt bị ảnh hưởng.
- grep mã màu trong biểu đồ → chỉ được có --text-muted và các xám tường.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

> 🧱 **Xong nhóm C — 21/47 màn.** Dữ liệu 2D giờ đã đủ sạch để dựng 3D. Trước khi sang nhóm D, chạy một lượt QC thật trên cả 4 tầng và **đếm số lần phải rời bàn phím** — nếu quá 3 lần cho một tầng thì có màn nào đó thiếu phím tắt.

---

---

# PHẦN 5 — Nhóm D: Xem và sửa 3D (9 màn)

> 🧊 Cả nhóm dựng trên nhóm R (R-01 → R-10): dựng mesh · gộp và LOD · worker dựng hình · ngân sách hiệu năng (tối đa 150 lệnh vẽ · 900.000 tam giác · 40 vật liệu · 350 MB GPU, từ 45 fps trên máy để bàn) · dọn tài nguyên · chế độ camera · bắn tia · gizmo.
> **Màn hình không được tạo geometry, không tạo material, không tự viết vòng lặp vẽ.**

## 5.0 — Việc phải làm trước khi chạy nhóm D

Bộ Design System dùng mốc **700ms** cho ba việc: bay camera tới đối tượng · chuyển 2D sang 3D bằng đùn khối · tách tầng theo mốc sẵn. Nhưng A-01 chỉ dựng bốn mốc **120 / 180 / 240 / 340ms**. Không có 700ms.

Hai lựa chọn, chọn một rồi ghi lại:

- **Cách A (khuyến nghị):** chạy thêm một prompt nhỏ bổ sung vào nhóm A của tầng logic, thêm mốc `trinhDien: 700` vào `src/lib/motion/tokens.ts` cùng ba mốc cũ. Đây là lần duy nhất được mở lại tầng logic, và phải làm **trước** S-22.
- **Cách B:** dùng 340ms cho mọi chuyển động camera. Chấp nhận rằng chuyển 2D→3D sẽ nhanh hơn thiết kế gốc.

Mọi prompt bên dưới viết theo **cách A**. Nếu chọn cách B thì thay mọi chỗ ghi "700ms" thành "340ms" — và tuyệt đối không viết số 700 vào `src/screens`.

## 5.1 — VIEWER-SHELL: vỏ dùng chung của chín màn 3D

```
[VIEWER-SHELL — VỎ CHUNG CỦA CHÍN MÀN 3D]

Khung: dùng lại AppShell của CL-04 ở chế độ 3D. Khung nhìn 3D bo 16, thụt 12.

Nền và vật liệu — đây là thứ quyết định sản phẩm trông như bản vẽ hay như game:
- Nền khung nhìn --canvas-3d #EDEBE6, mặt đất vô tận --canvas-3d-ground #E4E1DA, đường chân trời là **1px đặc** --canvas-3d-horizon #D9D5CD. Không gradient trời.
- Vật liệu mờ và nhạt: tường #D8D3CA · sàn #E4E1DA · kính --data-window ở 25% · cửa --data-door ở độ bão hoà thấp.
- Ánh sáng: **một** đèn định hướng dịu cộng ánh sáng môi trường và che khuất môi trường. Không đốm sáng bóng, không bloom, không glow, không phản chiếu gương, không bóng đổ gắt.

Bố cục quanh khung nhìn:
- Thanh trên: breadcrumb · SegmentedControl 2D/3D · Select góc nhìn sẵn (Phối cảnh · Trục đo · Trên xuống · Mặt cắt).
- Ray công cụ trái 56: quay quanh · kéo màn · đo · mặt cắt · chọn · cô lập.
- Ray tầng trái 56 (hoặc phần trên của panel trái 280): 4 tầng, bấm chọn, giữ Shift chọn nhiều, mỗi tầng một con mắt ẩn hiện. Thanh trượt "Độ tách" ở đáy.
- Panel phải 344: thanh tra đối tượng. Khi chưa chọn gì thì hiện câu dạy "Chọn một đối tượng trên mô hình để xem thuộc tính."
- ViewCube 72 góc trên phải, dưới bản đồ nhỏ. Cụm thu phóng góc phải dưới. Chú giải góc trái dưới. Thang cao độ tầng dạng chữ đều dọc mép trái.
- Thanh trạng thái 32: "4 tầng · 14 phòng · 248,60 m² · 58 fps".
- Chip hiệu năng hiện số tam giác bằng chữ đều, **chỉ khi cờ nhà phát triển bật**.

Quy ước dùng chung:
- Trỏ vào đối tượng: viền 1px --accent ở 60% trong 120ms, kèm nhãn nhỏ bám con trỏ. Chọn: viền 2px ở 100% cộng nền --accent 6%.
- Chọn trong 3D thì hàng tương ứng ở panel cuộn vào tầm nhìn, và ngược lại — qua S-11.
- Quay có quán tính, giảm chấn 0,08, dừng lại trong khoảng 400ms. Không bắt góc trừ khi giữ Shift.
- Nháy đúp khuôn đối tượng vào khung hình trong 700ms.
- Chuyển 2D sang 3D: mặt bằng **đùn dần lên** trong 700ms, so le 60ms theo tầng. Chuyển ngược lại thì sập xuống y hệt. **Không bao giờ cắt cảnh khô.**
- Phím dùng chung, khai qua I-01: 1–4 đổi tầng · 0 xem toàn cảnh · O bật trực giao · H ẩn · Alt+H cô lập · F khuôn đối tượng · E bật tắt tách tầng · M bật công cụ đo · Esc bỏ chọn · / mở tìm đối tượng.
- **Không hộp thoại nào được mở đè lên khung nhìn.**
- Camera **luôn** di chuyển có hoạt cảnh, để người dùng không mất phương hướng.
- Giảm chuyển động: tắt hoạt cảnh đùn khối và tắt quán tính quay.
- Vai Người xem: công cụ sửa **bị gỡ khỏi ray**, không phải làm mờ.
```

## 5.2 — Bảng xử lý xung đột (nhóm D)

| Màn | Bộ UI/UX nói | Bộ 47 màn nói | Chốt |
| --- | --- | --- | --- |
| Cả nhóm | Nhiều hoạt cảnh 700ms | A-01 chỉ có 120/180/240/340 | Xem mục 5.0 — bổ sung mốc 700ms vào A-01 trước, hoặc hạ hết về 340ms |
| S-24 | Ngăn kéo trái **320** | Panel trái **280** | 280 — bằng panel trái của AppShell |
| S-24 | Thẻ model 120, 24 model mẫu | Thẻ 128×128 | Thẻ 128, 24 model mẫu |
| S-26 | Panel **320**, có thêm chế độ bảng toàn trang | Panel **344**, dòng 36 | 344 (bằng panel phải của shell) · giữ chế độ bảng toàn trang · dòng 36 |
| S-27 | Ngăn kéo phải **360**, dòng lịch sử có hiện diff giá trị cũ và mới | Panel **320**, dòng 36 | 344 · **giữ diff** — đó là thứ làm lịch sử đọc được thay vì chỉ liệt kê |
| S-28 | Ba kiểu: chồng lớp · trượt · **cạnh nhau hai khung đồng bộ** | Ba kiểu: chồng lớp · chia đôi · chập chờn | Chồng lớp · trượt chia đôi · cạnh nhau hai khung đồng bộ. Bỏ "chập chờn" vì nó là hoạt cảnh nhấp nháy, vi phạm luật chuyển động dịu |
| S-30 | Số đo khi đang đo **không được chạy số**, vì chính xác quan trọng hơn mượt | Không nói | Không chạy số khi đang đo. Chỉ chạy số khi **đổi đơn vị** |

---

## S-22 — Trình xem 3D chính (Viewer3D) ⭐

```
[CONTEXT]
Route /du-an/:id/3d. Màn gây ấn tượng nhất của sản phẩm và cũng là nơi làm việc chính với 4 tầng.
Hai người dùng rất khác nhau phải cùng dùng được: quản lý toà nhà **chưa từng mở phần mềm CAD**, chỉ muốn tìm một phòng; và kỹ sư đang kiểm xem khối đùn có khớp mặt bằng không.
Yêu cầu: nhẹ, êm, không giật, luôn biết mình đang ở đâu.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- R-01 dựng mesh từ Spatial JSON; R-02 gộp lưới và ba mức chi tiết; R-03 worker dựng hình (không chặn giao diện); R-05 dọn tài nguyên khi rời màn.
- R-04 ngân sách hiệu năng và tự hạ chất lượng; R-06 bốn chế độ camera; R-07 góc nhìn sẵn và khuôn vào đối tượng.
- R-09 bắn tia chọn đối tượng; S-10 chọn nhiều; S-11 đồng bộ chọn; S-08 máy trạng thái công cụ; I-01 phím tắt.
- P-06 bảy chế độ tô màu theo dữ liệu (công năng · độ tin cậy · tầng · vi phạm); P-07 chú giải tự sinh.
- A-01 tokens; O-01 ghi fps trung bình.

[ĐỌC FILE NÀO]
- src/lib/three/{build,perf,camera,interaction}/**, src/lib/coloring/**, src/lib/selection/**, src/lib/tools/**
- src/components/viewer/{ViewportFrame,ViewCube,CameraToolbar,FloorRail,PerfBadge}.tsx
- src/components/canvas/{WallThicknessLegend,ZoomCluster,MiniMap}.tsx
- src/components/ui/{IconButton,SegmentedControl,Select,Toggle,Slider,Kbd}.tsx

[BỐ CỤC]
Theo VIEWER-SHELL. Riêng màn này: khung 3D chiếm toàn bộ vùng giữa; nhóm camera nổi góc dưới phải gồm quay quanh · đi bộ · trực giao · lát cắt · khuôn · góc nhìn sẵn.
Panel phải ở trạng thái rỗng cho tới khi chọn đối tượng, khi đó S-23 trượt vào trong 240ms.

[THÀNH PHẦN & DỮ LIỆU]
- Bộ chuyển đổi hướng dạng ViewCube 72.
- Điều hướng tầng có con mắt từng tầng, thanh trượt tách tầng ở đáy.
- Tay nắm mặt phẳng cắt.
- Chip hiệu năng chỉ hiện khi cờ nhà phát triển bật.
- Câu trạng thái rỗng: "Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường." kèm nút quay lại S-15.
- Câu khi không có WebGL: giải thích bằng tiếng thường kèm liên kết sang bản 2D. **Không hiện mã lỗi trần.**

[NỐI LOGIC]
- Hình học lấy từ R-01 và dựng trong worker của R-03. **Tuyệt đối không dựng trong luồng chính, không tạo geometry hay material trong màn.**
- Camera hoàn toàn do R-06 và R-07 điều khiển.
- Chọn đối tượng qua R-09 rồi đồng bộ với S-10 và S-11.
- Đổi chế độ tô màu qua P-06; chú giải tự đổi theo P-07.
- Khi fps chạm ngưỡng của R-04 thì **để R-04 hạ chất lượng**, màn không tự can thiệp.
- Rời màn gọi R-05 dọn tài nguyên.
- Ghi fps trung bình qua O-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
Theo VIEWER-SHELL. Riêng màn này:
- Bật tắt hiển thị một tầng: hoà tan 240ms.
- Chọn đối tượng: panel thuộc tính trượt vào 240ms.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có hình học đã duyệt, kèm nút sang QC.
2. Đang tải — mô hình chảy vào từng tầng, có mặt đất khung xương; lớp phủ nhạt "Đang dựng mô hình 4 tầng" và **phần trăm thật lấy từ R-03**.
3. Một phần — 2/4 tầng đã dựng; tầng chưa dựng vẽ bằng **khung dây** kèm caption cần chú ý.
4. Lỗi — không có WebGL hoặc không dựng được: giải thích bằng tiếng thường, có nút thử lại và liên kết xem 2D.
5. Xong.
6. Không có quyền — xem và quay được, công cụ sửa **bị gỡ khỏi ray** chứ không làm mờ.
7. Thu gọn — ẩn panel, ray tầng thành thanh ngang dưới, nhóm camera gộp lại thành cụm trôi.

[CẤM TUYỆT ĐỐI]
- Không tạo geometry hoặc material trong màn; không gọi vòng lặp vẽ trực tiếp.
- Không bóng đổ gắt, không trời HDRI, không phản chiếu gương, không bloom.
- Không gradient trên nền khung nhìn; dùng một màu token.
- Không cắt cảnh khô khi chuyển 2D ↔ 3D.
- Không để fps rơi dưới ngưỡng R-04 mà không đi qua đường hạ chất lượng của R-04.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/Viewer3D/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Quay liên tục 30 giây trên mô hình 4 tầng → **in fps nhỏ nhất và fps trung bình**, phải từ 45 fps.
- Rời màn rồi quay lại 5 lần → **in dung lượng GPU sau mỗi lần** để chứng minh không rò rỉ (R-05 được gọi).
- Đưa một người chưa từng dùng CAD ngồi trước màn, không hướng dẫn gì → họ phải quay, thu phóng và tìm được một phòng. Ghi lại họ mất bao lâu.
- grep "new THREE\.\|Mesh(\|Material(" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-23 — Panel thuộc tính đối tượng (PropertyInspector) ⭐

```
[CONTEXT]
Panel phải 344 trong Viewer3D, hiện khi chọn đối tượng. Đây là nơi sửa số chính xác.
Panel phải phục vụ cả kỹ sư chỉnh chiều cao tường lẫn quản lý toà nhà chỉ muốn đọc diện tích phòng mà **không muốn nhìn thấy toạ độ**.
Luật định hình màn này: **bộc lộ dần**. Mặc định năm trường, mọi thứ khác gấp lại.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-12 tra cứu đối tượng theo id; D-11 mô hình; P-03 viewmodel nhóm thuộc tính theo loại.
- S-07 lệnh sửa thuộc tính; S-05 điều phối; S-06 lịch sử; D-06 gộp 400ms khi kéo thanh trượt; D-07 tự lưu; D-08 chỉ báo lưu.
- M-04, M-08, M-09 kiểm tra sau khi đổi; M-12 luật để cảnh báo ngay.
- P-01 định dạng số; R-07 khuôn đối tượng.

[ĐỌC FILE NÀO]
- src/lib/viewmodel/**, src/lib/commands/business/**, src/domain/{walls,openings,rules}/**, src/lib/autosave/**
- src/components/ui/{FieldRow,NumericField,Select,Toggle,Slider,SegmentedControl,Badge,IconButton}.tsx
- src/components/feedback/InlineAlert.tsx

[BỐ CỤC]
Panel 344, đệm 20, trắng, bo 12. Dòng thuộc tính cao 36, nhãn 40% trái màu --text-secondary, điều khiển 60% phải. Nét mảnh **chỉ giữa các dòng**, không bao quanh panel.
Từ trên xuống:
1. Đầu panel: loại đối tượng h3 · mã chữ đều mono-lg ngay dưới · Badge trạng thái bên phải · nút khuôn · nút đóng.
2. Dải ảnh thu nhỏ cao 64: đối tượng được tách riêng trên nền --bg-sunken, để người dùng chắc chắn mình đang chọn đúng cái gì.
3. Nhóm "Kích thước hình học".
4. Nhóm "Vật liệu": Select có ô màu 16 mỗi lựa chọn, cộng Slider độ trong cho kính.
5. Nhóm "Quan hệ": liên kết bấm được như "Nằm trên #W-014", "Thuộc phòng #R-005".
6. Nhóm "Kiểm tra": liệt kê vi phạm liên quan từ M-12 và nút sang S-32.
7. Khối gấp "Thông số nâng cao": lệch Z · toạ độ đầu và cuối · mã đối tượng gốc trong Spatial JSON · độ tin cậy.
8. Chân panel: nút chính "Duyệt" và nút chìm "Bỏ qua", cộng caption ghi ai sửa lần cuối và lúc nào.

[THÀNH PHẦN & DỮ LIỆU]
Nội dung theo loại, lấy nhóm từ P-03:
- **Tường:** SegmentedControl độ dày 110/220/330 có ô màu · chiều dài 4.250,00 mm · chiều cao 3.000,00 mm · loại · tường nối · số lỗ mở.
- **Lỗ mở:** chiều rộng 900 mm · chiều cao 2.200 mm · cao độ bệ · chiều mở · tường chủ.
- **Nội thất:** kích thước bao · góc xoay.
- **Phòng:** tên · công năng · diện tích · số cửa · số cửa sổ.
**Chọn nhiều:** hiện số lượng bằng mono-lg, chỉ hiện thuộc tính chung của mọi mục, giá trị khác nhau hiển thị **dấu gạch ngang** kèm gợi ý "Giá trị khác nhau". Tuyệt đối không hiện một giá trị đơn gây hiểu nhầm.

[NỐI LOGIC]
- Mọi ô đều tạo lệnh qua S-07 rồi S-05. **Không ghi trực tiếp vào store.**
- Kéo thanh trượt gộp lệnh theo D-06.
- Sau khi đổi hình học **phải** gọi kiểm tra của M-04 hoặc M-08 và hiện cảnh báo **tại đúng dòng gây ra nó**.
- Xem trước trong 3D theo thời gian thực **trong lúc kéo**, không đợi rời ô.
- Tự lưu theo D-07, chỉ báo lấy từ D-08.
- Bấm liên kết quan hệ thì bay camera tới đối tượng đó bằng R-07 trong 700ms và panel đổi bằng trượt có hướng.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đổi đối tượng đang chọn: nội dung hoà tan 180ms, chiều cao panel chuyển mượt để **chân panel không nhảy**.
- Giá trị đã ghi nhận: nền dòng nháy #EEF4EF trong 400ms, thanh trạng thái đổi sang "Đã lưu lúc 14:32".
- Duyệt: bộ đếm toàn cục chạy số và tự chuyển sang đối tượng chưa duyệt kế tiếp **cùng loại**.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa chọn gì: biểu tượng nét 32, một câu dạy, và gợi ý rằng Tab duyệt vòng qua các đối tượng.
2. Đang tải — dòng khung xương cao 36.
3. Một phần — chọn nhiều đối tượng; hoặc một số thuộc tính không có với đối tượng cũ, hiện thành **caption** chứ không phải dòng trống.
4. Lỗi — giá trị bị bộ máy hình học từ chối: nêu lý do ngay tại dòng, giá trị quay về cũ, có nút thử lại.
5. Xong.
6. Không có quyền — mọi dòng chỉ đọc, **bỏ viền**, vẫn sao chép được.
7. Thu gọn — dưới 1280 panel thành thẻ phủ; trên di động thành tấm trượt từ dưới cao 60%.

[CẤM TUYỆT ĐỐI]
- Không quá **năm** trường hiện ra trước khi mở khối gấp.
- Không tính lại hình học, không tự kiểm luật.
- Không nhảy bố cục khi đổi loại đối tượng: chiều rộng nhãn cố định, chiều cao dòng cố định.
- Chọn nhiều không bao giờ hiện một giá trị đơn gây hiểu nhầm.
- Không nút Lưu. Panel không có viền bao ngoài.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/PropertyInspector/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi độ dày #W-014 từ 220 sang 330 → 3D đổi **ngay trong lúc kéo**, mối nối được dọn, Ctrl+Z một lần trả về 220. In cả ba bước.
- Đếm số trường hiện ra khi chọn một tường → phải ≤ 5.
- Đổi qua lại giữa một tường và một phòng 10 lần → đo vị trí chân panel, không được nhảy.
- Chọn 3 tường có độ dày khác nhau → ô độ dày phải hiện dấu gạch ngang, không hiện 220.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-24 — Panel thư viện đồ nội thất (FurnitureLibraryPanel)

```
[CONTEXT]
Panel trái 280 trong Viewer3D, thay chỗ cây lớp khi công cụ nội thất đang bật. Kéo model .glb vào cảnh.
Người dùng: kỹ sư thay một khối hộp chung chung bằng model bàn làm việc thật, và quản lý toà nhà đặt thiết bị.
Yêu cầu về giọng: **nhẹ nhàng, không được biến thành chợ hình ảnh.**

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-01 truy vấn thư viện; D-02 cache; D-03 nạp trước khi trỏ chuột.
- R-01 và R-02 nạp và tối ưu model; R-05 dọn khi bỏ; R-08 kiểm va chạm khi đặt; R-04 ngân sách hiệu năng.
- I-03 phiên kéo thả và con trỏ; S-07 lệnh thêm đồ đạc; S-05 điều phối; D-05 vé hoàn tác.
- P-01 định dạng kích thước và dung lượng tệp; P-04 trạng thái màn.

[ĐỌC FILE NÀO]
- src/lib/query/**, src/lib/three/{build,interaction,perf}/**, src/lib/input/dragDrop.ts, src/lib/commands/business/**
- src/components/ui/{Input,Badge,Tooltip,IconButton,Button}.tsx, src/components/feedback/{Skeleton,EmptyState,Toast}.tsx

[BỐ CỤC]
Panel trái 280 (dưới 1024 thành tấm trượt đáy cao 240 cuộn ngang).
- Ô tìm trên cùng.
- Hàng chip nhóm: Tất cả · Bàn · Ghế · Giường · Sofa · Tủ kệ · Thiết bị vệ sinh · Bếp · Thiết bị kỹ thuật · Của tôi.
- Mục "Đã phát hiện" ghim trên đầu lưới: liệt kê các lớp YOLO tìm thấy ở tầng này kèm số đếm và một hành động chìm "Thay thế tất cả" cho mỗi lớp, ví dụ "sofa (4) — Thay thế tất cả".
- Lưới 2 cột, thẻ 128×128, khe 12, thẻ trắng bo 12 bóng nghỉ, nâng -1px khi trỏ chuột. Mỗi thẻ: ảnh xem trước **đơn sắc trên nền --bg-sunken** · tên một dòng · kích thước bao bằng chữ đều "1.200 × 600 × 750 mm" · caption dung lượng tệp. Model đã dùng trong dự án có một viên thuốc nhỏ đánh dấu.
- Chân panel: nút phụ "Tải lên model" khi có quyền.

[NỐI LOGIC]
- Kéo thẻ vào cảnh dùng phiên kéo của I-03. **Không tự viết xử lý kéo thả.**
- Vị trí đặt và kiểm va chạm do R-08 quyết định. Màn không tự tính.
- Nạp model qua R-01 và R-02, **không tự gọi loader**, không tự tối ưu.
- Thả xong tạo lệnh S-07 nên hoàn tác được, kèm toast 8 giây.
- Model nặng hơn ngưỡng của R-04 thì **cảnh báo trước khi cho kéo**, không im lặng chặn.
- "Thay thế tất cả" phải **xem trước danh sách sẽ đổi**, rồi mới áp.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đang kéo: cảnh 3D hiện bóng model trong suốt, bắt vào mặt sàn và tường gần nhất bằng đường cong mềm. Chỗ không đặt được thì bóng đổi sang thang cần chú ý và hiện **một câu lý do**.
- Thả: đối tượng mới nháy --bg-selected trong 340ms, mời hoàn tác 8 giây.
- "Thay thế tất cả": xem trước, rồi áp bằng biến hình so le 60ms để người dùng **thấy từng cái đổi**.
- Trỏ vào thẻ: ảnh xem trước xoay chậm 30 độ trong 600ms rồi dừng khi rời chuột. Tắt khi bật giảm chuyển động.
- Tìm kiếm lọc lưới bằng layout animation 240ms.
- Esc huỷ phiên kéo.

[BẢY TRẠNG THÁI]
1. Rỗng — không có model khớp bộ lọc: nhắc lại chuỗi vừa tìm và cho liên kết "Xoá bộ lọc". Nếu thư viện rỗng thật thì dẫn sang S-38.
2. Đang tải — 8 thẻ khung xương **đúng kích thước thẻ thật**.
3. Một phần — một số ảnh xem trước không dựng được: hiện biểu tượng thay thế trung tính, **không phải ảnh vỡ**.
4. Lỗi.
5. Xong.
6. Không có quyền — ẩn nút tải lên, vẫn xem được, không kéo được.
7. Thu gọn — tấm trượt đáy cuộn ngang.

[CẤM TUYỆT ĐỐI]
- Ảnh xem trước đơn sắc trên nền lún; không ảnh thật nhiều màu, không nền ca rô.
- Không tự nạp .glb, không tự kiểm va chạm.
- Thao tác hàng loạt luôn xem trước trước khi áp.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/FurnitureLibraryPanel/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Kéo 5 đồ vào cảnh → fps vẫn từ 45. **In fps và số lệnh vẽ** trước và sau.
- Bấm "Thay thế tất cả" cho lớp sofa (4) → phải thấy danh sách xem trước 4 mục trước khi có thay đổi nào.
- grep "GLTFLoader\|useLoader" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-25 — Chỉnh sửa hình học tường trong 3D (WallGeometryEditor)

```
[CONTEXT]
Chế độ sửa trong Viewer3D: kéo đỉnh, thêm và xoá đỉnh, tách, nối, đổi chiều cao. Mặt bằng 2D cập nhật **đồng thời**.
Người dùng: kỹ sư sửa một bức tường AI vẽ lệch hai centimét, mà không muốn làm lại cả tầng.
Yêu cầu: luôn rõ đang sửa cái gì, hoàn tác được ngay, và huỷ giữa chừng được sạch sẽ.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- R-10 tay nắm biến đổi và phát lệnh khi thả; R-09 bắn tia; R-08 kiểm va chạm.
- M-04 nối lại mối nối; M-05 cắt nối và làm sạch; M-09 trôi lỗ mở khi tường đổi; M-03 bắt điểm 50 mm và góc 15°.
- S-08 máy trạng thái công cụ ở chế độ sửa; S-07 lệnh; S-05 điều phối; S-06 lịch sử; D-06 gộp kéo liên tục.
- P-01 định dạng số đo theo thời gian thực.

[ĐỌC FILE NÀO]
- src/lib/three/interaction/**, src/domain/{walls,openings}/**, src/lib/tools/**, src/lib/commands/business/**
- src/components/viewer/{GizmoHud,MeasurementOverlay}.tsx
- src/components/ui/{NumericField,Kbd,SegmentedControl,Badge,Table}.tsx

[BỐ CỤC]
Giữ nguyên khung Viewer3D. Thêm:
- Dải chế độ sửa trên cùng canvas, cao 36, ghi rõ "Đang sửa: #W-014" và một nút "Xong".
- Thanh công cụ sửa nổi dạng viên thuốc bo 999 bóng nổi phía trên canvas: di chuyển đỉnh · thêm đỉnh · xoá đỉnh · tách tường · nối tường · đặt lại chiều cao. Mỗi nút có biểu tượng và tooltip kèm phím tắt.
- Chuỗi kích thước sống chạy dọc bức tường đang sửa, bằng chữ đều, cập nhật khi hình học đổi.
- Panel phải chuyển sang **bảng đỉnh**: mỗi hàng là mã đỉnh và toạ độ x, y bằng chữ đều, sửa được ngay trong ô.
- Chip đối chiếu ở góc: "Lệch so với bản vẽ gốc: 12 mm", chuyển mức cần chú ý khi vượt ngưỡng.
Tay nắm: đỉnh là vòng tròn trắng 8px viền 2px --accent, to lên 12px khi trỏ chuột. Tay nắm cạnh là ô vuông 6px. Đường bắt điểm là nét đứt 1px --accent kèm nhãn chữ đều.

[NỐI LOGIC]
- Mọi thao tác kéo đi qua tay nắm của R-10 và bắt điểm của M-03. **Không tự viết gizmo, không tự tính giao điểm.**
- Kết thúc kéo tạo **một** lệnh duy nhất theo D-06.
- Sau mỗi lệnh gọi M-04, M-05, M-09 để dọn mối nối, làm sạch và trôi lại lỗ mở. Màn không tự xử lý hình học.
- Hình học tự cắt nhau bị từ chối: hiện giải thích ngay tại chỗ và **tô sáng đúng cạnh gây lỗi**.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo một đỉnh: cả 3D và mặt bằng 2D cập nhật đồng thời ở 60fps; chiều dài các tường phụ thuộc chạy số trong chuỗi kích thước.
- Bắt điểm trong 8px vào: đường trục · đỉnh khác · phương vuông góc với đoạn trước · vết vẽ gốc của AI. **Mỗi loại bắt điểm có một đường dẫn riêng và một nhãn gọi tên nó**, ví dụ "Vuông góc" hoặc "Trục B". Bắt điểm dùng đường cong mềm để tay nắm lắng xuống chứ không giật.
- Tách tường: hai nửa tách ra 2px trong chốc lát để người dùng **thấy vết cắt xảy ra**.
- Nối hai tường: hai đầu mút gộp lại trong 240ms.
- Kéo liên tục **không** hiện toast; chỉ thao tác rời rạc mới hiện.
- Esc giữa lúc kéo: huỷ và trả đỉnh về gốc bằng chuyển động dịu 180ms.
- Shift khoá trục, Alt bỏ bắt điểm.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa chọn tường; thanh công cụ hiện một câu gợi ý.
2. Đang tải — đang tính lại.
3. Một phần — chọn nhiều tường thì chỉ cho đổi chiều cao; hoặc tường có vòng hở, hiện kích thước khe hở bằng chữ đều và nút "Đóng khe hở".
4. Lỗi — đa giác tự cắt: từ chối kèm giải thích và tô sáng cạnh gây lỗi; giá trị tự trả về.
5. Xong.
6. Không có quyền — công cụ sửa **không bật được**, bị gỡ khỏi thanh.
7. Thu gọn — khoá sửa trên di động, chỉ xem.

[CẤM TUYỆT ĐỐI]
- Không tự viết gizmo, không tự tính giao điểm.
- Một phiên kéo chỉ được sinh **một** bước hoàn tác.
- Không cho sửa khi đang ở chế độ trực giao lát cắt.
- Mỗi loại bắt điểm phải được **gọi tên trên màn hình**, không chỉ cảm nhận được.
- Hình học không hợp lệ phải được giải thích, không bao giờ bị từ chối im lặng.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/WallGeometryEditor/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Kéo một đỉnh tường qua 40 khung hình → lịch sử tăng đúng **1**. Cửa trên tường đó vẫn đúng vị trí tương đối. In cả hai kết quả.
- Bật lần lượt cả bốn loại bắt điểm → **in bốn nhãn** hiện trên màn.
- Kéo rồi Esc → toạ độ đỉnh trở về đúng giá trị ban đầu. In trước và sau.
- Sửa trong 3D → chụp mặt bằng 2D cùng lúc, hai bên phải khớp.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-26 — Panel danh sách phòng và diện tích (RoomAreaPanel)

```
[CONTEXT]
Panel phải 344 trong Viewer3D: 14 phòng, tổng 248,60 m².
Người dùng: **quản lý toà nhà đang lập bảng diện tích, chưa từng mở phần mềm CAD.** Đây là màn họ thật sự quan tâm.
Vì vậy màn này viết cho người không kỹ thuật: **không toạ độ, không mã đối tượng ở chế độ mặc định.** Mã chỉ hiện trong khối gấp nâng cao.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-07 tính diện tích và **hàm giải thích cách tính**; D-12 tra cứu theo tầng.
- P-03 viewmodel gộp theo tầng và theo công năng; P-01 định dạng; A-03 chạy số 240ms khi đổi tổng.
- R-07 khuôn vào phòng; P-06 tô màu theo công năng; D-07 tự lưu khi sửa tên.

[ĐỌC FILE NÀO]
- src/domain/rooms/**, src/lib/viewmodel/**, src/lib/format/**, src/lib/three/camera/**, src/lib/coloring/**
- src/components/ui/{Table,Badge,SegmentedControl,Select,Tooltip,IconButton,Input}.tsx

[BỐ CỤC]
Hai chế độ, đổi bằng nút ở đầu panel.
**Chế độ panel** (344):
- Đầu panel: bộ chọn tầng, rồi **tổng diện tích bằng mono-lg** "248,60 m²" với caption "Tổng diện tích sàn Tầng 01 — 14 phòng". Diện tích là dữ liệu chính của màn nên là ngoại lệ duy nhất được dùng mono-lg ngoài mã đối tượng.
- Dải đổi cách nhóm: theo tầng · theo công năng. Select sắp xếp: theo diện tích · theo tên · theo loại.
- Danh sách gộp nhóm: mỗi đầu nhóm hiện số lượng và tổng phụ bằng chữ đều. Hàng cao 36: tên phòng · diện tích chữ đều căn phải · chấm trạng thái · thanh tỷ trọng 2px.
- Một thanh xếp chồng nhỏ thể hiện phân bố diện tích theo loại phòng, dùng ba xám tường cộng tông trung tính, **không quá ba màu dữ liệu**.
**Chế độ bảng toàn trang:** Table đủ cột — tầng · tên phòng · loại · diện tích m² · chu vi m · chiều cao thông thuỷ m · số cửa · số cửa sổ · trạng thái. Đầu bảng dính, **hàng tổng ghim đáy** bằng chữ đậm với số chữ đều, và một nút xuất.
Chân panel: nút sao chép bảng dạng văn bản và nút sang S-34.

[NỐI LOGIC]
- Mọi con số từ M-07 và P-03. **Không tự tính tổng, không tự làm tròn.**
- Trỏ vào một số diện tích thì hiện chú giải cách tính lấy từ M-07 ("tính theo mép trong tường").
- Bấm một dòng thì khuôn camera vào phòng đó bằng R-07 trong 700ms và tô sáng trong 3D; ở chế độ 2D thì kéo màn tới.
- Sửa tên phòng ngay trong dòng thì tự lưu sau 800ms qua D-07 và nháy dòng.
- **Không tự sinh tệp ở màn này** — xuất là việc của S-34.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Trỏ vào một hàng: nền phòng trên mô hình nâng từ 5% lên 10% trong 180ms và có viền; trỏ vào mô hình thì hàng sáng lên.
- Đổi tầng: danh sách hoà tan và tổng **chạy số** từ giá trị cũ sang giá trị mới trong 240ms.
- Sắp xếp: hàng đổi chỗ bằng layout animation.

[BẢY TRẠNG THÁI]
1. Rỗng — không có vòng phòng kín: giải thích về khe hở tường kèm hành động "Kiểm tra khe hở tường".
2. Đang tải — hàng khung xương cộng **một khung xương cho ô tổng**.
3. Một phần — 3 phòng chưa có tên, hiện "Phòng chưa đặt tên"; hoặc chỉ một số tầng có diện tích, **gọi tên tầng thiếu**.
4. Lỗi.
5. Xong.
6. Không có quyền.
7. Thu gọn — tấm trượt đáy chỉ hiện tổng và năm phòng lớn nhất.

[CẤM TUYỆT ĐỐI]
- Không tự tính tổng, không làm tròn khác hai chữ số thập phân.
- Không biểu đồ tròn nhiều màu; chỉ thanh tỷ trọng và thanh xếp chồng trung tính.
- Đơn vị nằm **ngoài** con số, không nhét vào chuỗi.
- Chế độ mặc định không hiện toạ độ hay mã đối tượng.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/RoomAreaPanel/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Tổng của 14 dòng phải bằng đúng **248,60 m²**. In phép cộng đầy đủ.
- Đưa panel cho một người không kỹ thuật đọc, không giải thích gì → họ phải nói được phòng nào lớn nhất. Ghi lại kết quả.
- Đếm số màu dữ liệu trên thanh xếp chồng → ≤ 3.
- grep "toFixed\|reduce((" cho phép cộng diện tích trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-27 — Lịch sử thao tác (HistoryPanel)

```
[CONTEXT]
Panel lịch sử 100 bước, mở bằng Ctrl+H. Ghi mọi chỉnh sửa, duyệt, lần chạy AI và lần nhập dữ liệu.
Người dùng: kỹ sư vừa nhận ra hai mươi phút vừa rồi đi sai hướng; và trưởng nhóm đang xem ai đổi cái gì.
Yêu cầu ngôn ngữ: **đọc được bằng tiếng Việt tự nhiên, không phải nhật ký kỹ thuật.** Không tên hàm, không id lệnh, không JSON.
Luật cốt lõi: **hoàn tác không bao giờ phá huỷ** — đường làm lại vẫn nhìn thấy được.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- S-06 lịch sử 100 bước và gộp bước; S-04 kiểu lệnh **có sẵn nhãn tiếng Việt**; S-05 điều phối để nhảy trạng thái.
- P-02 thời gian tương đối; P-03 gộp theo phiên làm việc.
- A-03 chuyển động danh sách; I-01 phím tắt; R-07 khuôn đối tượng liên quan.

[ĐỌC FILE NÀO]
- src/lib/commands/**, src/lib/viewmodel/**, src/lib/format/**, src/lib/motion/**
- src/components/ui/{Badge,IconButton,Kbd,Avatar,Select}.tsx, src/components/feedback/EmptyState.tsx

[BỐ CỤC]
Panel phải 344 (thay chỗ thanh tra khi mở).
- Đầu panel: hàng chip lọc theo loại (Tất cả · Chỉnh sửa · Duyệt · AI · Nhập xuất) và một Select lọc theo người.
- Thân là **dòng thời gian dọc**: sống lưng nét mảnh 1px --border-hairline với các chấm 8px. Vị trí hiện tại là chấm --accent tô đầy; các mục **sau** vị trí hiện tại, tức đã hoàn tác, hạ xuống 0,4 độ mờ **chứ không biến mất**.
- Gộp theo ngày, rồi theo phiên, mỗi nhóm có nhãn.
- Mỗi mục cao 36: biểu tượng nét 18 theo loại · một dòng mô tả bằng chữ thân 15 · đối tượng bị ảnh hưởng dạng liên kết chữ đều bấm được · ảnh đại diện người thực hiện 20 · thời gian tương đối bằng caption.
- **Mục đổi giá trị hiện diff ngay trong dòng:** "Độ dày #W-014: 110 mm → 220 mm", giá trị cũ gạch ngang màu --text-muted, giá trị mới màu --text-primary.
- Mục theo lô thu gọn: "Duyệt 12 đoạn tường", mở ra được thành từng mục con.
- Trỏ vào một mục thì hiện nút "Quay lại trạng thái này".
Dưới 1024: thành tấm trượt đáy.

[NỐI LOGIC]
- Nội dung lấy từ S-06. **Nhãn câu lấy từ S-04, không tự sinh câu.**
- Bấm một mục thì nhảy về trạng thái đó qua S-05.
- Thời gian định dạng bằng P-02, gộp phiên bằng P-03.
- **Không tự quản lý ngăn xếp hoàn tác.**
- Trỏ vào mục thì tô sáng đối tượng liên quan trong 3D và hiện bóng ma trạng thái trước của nó.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Nhảy về một mục: mô hình chuyển sang trạng thái đó bằng hoạt cảnh 340ms — **không bao giờ nhảy tức thì**.
- Ctrl+Z và Ctrl+Shift+Z dịch vị trí hiện tại; dòng thời gian cuộn mục đang hoạt động vào tầm nhìn kèm nháy --bg-selected 340ms.
- Mở nhóm theo lô: chuyển chiều cao 240ms, so le 24ms.
- Mục mới trượt vào từ trên trong 240ms trong lúc người dùng đang làm việc.
- **Không hộp thoại xác nhận khi lùi bước**, vì tiến lại luôn được.

[BẢY TRẠNG THÁI]
1. Rỗng — "Chưa có thao tác nào. Mọi thay đổi của bạn sẽ được ghi lại ở đây."
2. Đang tải — dòng thời gian khung xương.
3. Một phần — đạt 100 bước, có câu nhắc bước cũ nhất sẽ bị bỏ; hoặc lịch sử cũ đã lưu trữ, có nút "Tải thêm" ở đáy.
4. Lỗi.
5. Xong.
6. Không có quyền — xem được nhưng không nhảy trạng thái; mục của người khác hiện thành "Người dùng khác" không kèm tên.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không hiện tên hàm, id lệnh hay JSON.
- Không tự quản lý ngăn xếp hoàn tác.
- Mục đã hoàn tác **phải còn nhìn thấy** ở độ mờ thấp.
- Mọi mục phải dẫn tới được đối tượng của nó.
- Lùi bước phải có hoạt cảnh, không tức thì.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/HistoryPanel/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Làm 12 thao tác → nhảy về bước 5 → làm thêm 1 thao tác → **in toàn bộ danh sách** và đối chiếu với kỳ vọng.
- Sau khi lùi 3 bước, đếm số mục còn nhìn thấy → phải vẫn đủ 12, ba mục cuối ở 0,4 độ mờ.
- grep "commandId\|JSON.stringify\|typeof" hiện ra chữ trong dòng lịch sử → rỗng.
- In 10 câu mô tả ra và đọc to: câu nào cũng phải là tiếng Việt tự nhiên.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-28 — Đối chiếu bản vẽ và mô hình (OverlayComparison)

```
[CONTEXT]
Đặt ảnh bản vẽ gốc dưới mô hình để đo xem việc số hoá đã trôi xa nguồn bao nhiêu.
Người dùng: trưởng nhóm ký duyệt trước khi mô hình này thành hồ sơ chính thức.
Nguyên tắc: **bằng chứng thay vì khẳng định.** Cho người dùng nhìn thấy nguồn và kết quả cùng lúc, thay vì bảo họ tin rằng mô hình đúng.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- R-06 camera trực giao từ trên xuống và khoá góc; M-02 tỷ lệ để căn ảnh; M-11 căn theo trục và tính độ lệch.
- M-15 đo khoảng cách cho các vùng lệch; P-06 tô màu đơn sắc cho lớp mô hình; P-01 định dạng độ lệch.
- A-01 tokens; I-03 phiên kéo.

[ĐỌC FILE NÀO]
- src/lib/three/camera/**, src/domain/{units,axes,measure}/**, src/lib/coloring/**, src/lib/input/**
- src/components/canvas/{ZoomCluster,MeasurementLabel}.tsx
- src/components/ui/{Slider,SegmentedControl,NumericField,Toggle,IconButton,Table}.tsx

[BỐ CỤC]
Canvas đối chiếu rộng toàn vùng, panel phải 344.
- Thanh công cụ nổi trên cùng giữa, cao 40, bo 12: chọn tầng · SegmentedControl ba kiểu đối chiếu · Slider độ mờ ảnh nguồn 0–100 có phần trăm chữ đều · khoá căn.
- Ba kiểu đối chiếu: **Chồng lớp** (cả hai đè lên nhau) · **Trượt** (đường chia đôi dọc kéo được, gạt qua lại giữa hai bên, tay cầm 32) · **Cạnh nhau** (hai khung nhìn đồng bộ, kéo và thu phóng cùng nhau).
- Ba lớp thị giác, **không được có lớp thứ tư**: ảnh quét gốc vẽ bằng --text-primary ở 25% dưới dạng **nét thuần** · hình học sinh ra vẽ bằng --accent ở 60% · vùng lệch đánh dấu bằng gạch chéo --state-attention.
- Panel phải: ba con số mono-lg với nhãn chữ thường — sai số trung bình 8 mm · sai số lớn nhất 41 mm · số vùng vượt ngưỡng 3. Dưới là NumericField dung sai theo milimét. Dưới nữa là danh sách vùng lệch **sắp tệ nhất lên đầu**, mỗi hàng có vị trí tham chiếu, độ lệch chữ đều, và mã đối tượng bị ảnh hưởng.
- Chân panel: nút "Xác nhận mô hình khớp bản vẽ" đánh dấu tầng đã kiểm.
Dưới 1280: kiểu "Cạnh nhau" bị tắt kèm caption giải thích vì sao.

[NỐI LOGIC]
- Căn ảnh vào mô hình dùng tỷ lệ của M-02 và trục của M-11. **Màn không tự tính phép biến hình.**
- Camera bị khoá về trực giao bằng R-06. **Không cho quay tự do trong chế độ này.**
- Chỉ số khớp lấy từ M-11 và M-15, không tự đo.
- Đổi dung sai thì đánh giá lại **trực tiếp**: danh sách vùng sắp lại và số đếm chạy số.
- Xác nhận là **hành động rõ ràng của con người**, không tự động đánh dấu.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo đường chia đôi: trực tiếp, **không hoạt cảnh trong lúc kéo**. Riêng tay cầm to từ 4px lên 6px khi trỏ chuột trong 120ms.
- Đổi kiểu đối chiếu: hoà tan 340ms, **giữ nguyên camera**.
- Chọn một vùng lệch: cả hai khung bay tới trong 700ms và vẽ một đường đo kèm giá trị chữ đều.
- Vùng vượt dung sai đập viền gạch chéo ba nhịp khi mới hiện, rồi giữ tĩnh.

[BẢY TRẠNG THÁI]
1. Rỗng — tầng này không có ảnh gốc, ví dụ tầng nhập từ CAD: giải thích một câu.
2. Đang tải — đang tải ảnh.
3. Một phần — chỉ 2 tầng có ảnh, hoặc một số tầng chưa dựng.
4. Lỗi — không căn được vì tỷ lệ khác nhau, kèm liên kết sang S-11.
5. Xong — mọi vùng trong dung sai, badge đã duyệt và một câu xác nhận điềm đạm.
6. Không có quyền — không đổi được căn chỉnh.
7. Thu gọn — thanh công cụ xếp hai hàng, tắt kiểu cạnh nhau.

[CẤM TUYỆT ĐỐI]
- **Không bản đồ nhiệt, không thang màu cầu vồng.**
- Ảnh nguồn là **nét thuần**, không bao giờ là ảnh raster tô đầy.
- Không cho quay camera tự do.
- Không quá ba lớp thị giác cùng lúc.
- Xác nhận phải do người bấm.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/OverlayComparison/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Chụp ba kiểu đối chiếu ở 1440 và kiểm độ mờ ở 0, 50, 100 → chín ảnh.
- Đổi dung sai từ 20 mm lên 50 mm → số vùng vượt ngưỡng phải giảm và chạy số. In trước và sau.
- Đếm số màu trên canvas → đúng ba lớp, không hơn.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-29 — Xem tách tầng (ExplodedView)

```
[CONTEXT]
Tách 4 tầng theo trục đứng để nhìn từng tầng và với tới được mọi tầng cùng lúc.
Người dùng: trưởng dự án trình bày công trình đã số hoá cho các bên liên quan; và kỹ sư kiểm xem lõi thang và hộp kỹ thuật có thẳng hàng qua các tầng không.
**Đây là khoảnh khắc ấn tượng nhất của sản phẩm và nó phải điềm đạm chứ không phô trương.** Khoảnh khắc đẹp vẫn phải theo luật: không tô màu theo tầng, không camera nhào lộn, người dùng luôn giữ quyền điều khiển thanh trượt.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- R-06 camera; R-07 góc nhìn sẵn và khuôn; R-02 ba mức chi tiết để giữ fps khi hiện cả 4 tầng.
- A-01 tokens và cờ giảm chuyển động; A-02 so le.
- M-11 cao độ thật và độ lệch thẳng đứng; D-12 số liệu từng tầng; P-01 định dạng cao độ; X-03 chụp ảnh khung nhìn.

[ĐỌC FILE NÀO]
- src/lib/three/{camera,perf}/**, src/lib/motion/**, src/lib/viewmodel/**, src/domain/axes/**, src/lib/export/snapshot.ts
- src/components/viewer/{FloorRail,ViewCube}.tsx, src/components/ui/{Slider,Toggle,Badge,IconButton,SegmentedControl}.tsx

[BỐ CỤC]
Khung 3D toàn vùng.
- Thanh trượt "Độ tách" dọc ghim mép trái canvas, cao 240, có nhãn chữ đều ở mức 0 và ở mức tách lớn nhất tính theo mét. Dưới thanh trượt là hàng ba mức sẵn: "Gộp" · "Tách vừa" · "Tách hết".
- Mỗi tầng có một thẻ nhãn nổi ở mép phải: tên tầng · cao độ chữ đều · diện tích chữ đều · một con mắt ẩn hiện. Thẻ trắng bo 12 bóng nổi rộng 200.
- Một **đường nối dọc** 1px --data-axis chạy qua trọng tâm mọi tầng, có vạch đánh dấu ở mỗi cao độ.
- **Chỉ báo thẳng hàng:** phần tử phải liên tục qua các tầng như lõi thang hay hộp kỹ thuật được vẽ bằng đường dẫn dọc nét đứt 1px --accent. Chỗ không thẳng hàng thì đường dẫn chuyển sang --state-attention và một caption ghi độ lệch bằng chữ đều.

[NỐI LOGIC]
- Vị trí tách tính từ **cao độ thật** lấy qua M-11 và D-12. **Không đặt số cứng.**
- Chuyển động dùng A-01 và A-02; tầng dưới đi trước.
- Bật ba mức chi tiết của R-02 khi độ tách lớn hơn 0.
- Độ lệch thẳng đứng lấy từ M-11 — **đây là nơi duy nhất lệch tầng nhìn ra được rõ**, nên phải hiện.
- Nút chụp ảnh gọi X-03, không tự dựng ảnh.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Kéo thanh trượt: tách liên tục và trực tiếp, không trễ; thả ra **không bắt về mức sẵn**.
- Ba mức sẵn: các tầng chạy tới vị trí trong 700ms, so le 60ms **từ tầng dưới lên**, dùng easing chính nên chồng tầng lắng xuống chứ không nảy.
- Thẻ nhãn tầng chỉ hiện khi độ tách vượt 20%, hoà tan 240ms — để cảnh gộp lại vẫn sạch.
- Trỏ vào một thẻ tầng: mọi tầng khác mờ xuống 0,25 trong 180ms.
- Bấm thẻ tầng: khuôn vào tầng đó và panel trái đổi sang tầng ấy.
- Phím E bật tắt; Space chạy một lượt tách rồi hợp trong 1,2 giây.
- Giảm chuyển động: các mức sẵn nhảy thẳng kèm hoà tan 120ms thay vì chạy vị trí.

[BẢY TRẠNG THÁI]
1. Rỗng — chỉ có 1 tầng nên không tách được: ẩn điều khiển kèm một câu nói rằng nó xuất hiện khi có từ hai tầng.
2. Đang tải — các tầng chảy vào từ dưới lên.
3. Một phần — 2/4 tầng đã dựng, hoặc có tầng chưa duyệt: vẽ khung dây kèm caption cần chú ý trên thẻ của tầng đó.
4. Lỗi.
5. Xong.
6. Không có quyền — xem được.
7. Thu gọn — thanh trượt thành điều khiển ngang trong cụm trôi.

[CẤM TUYỆT ĐỐI]
- **Không tô màu theo tầng.** Khoảng cách và đường nối là thứ truyền đạt sự tách, không phải màu.
- Không chuyển động nảy hoặc đàn hồi quá đà; chỉ dùng đường cong dịu của A-01.
- Không tự viết vòng lặp chuyển động bằng setInterval.
- Thẻ nhãn chỉ hiện khi tách đủ nhiều.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/ExplodedView/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Bật giảm chuyển động → tách tầng xảy ra tức thì, không hoạt cảnh. Báo cáo.
- Đo fps ở mức tách lớn nhất với cả 4 tầng hiện → in fps nhỏ nhất.
- Dựng một lõi thang lệch 180 mm → phải thấy đường dẫn chuyển sang cần chú ý và caption ghi đúng 180 mm.
- grep "setInterval\|requestAnimationFrame" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-30 — Công cụ đo trong 3D (MeasurementTool)

```
[CONTEXT]
Đo điểm tới điểm, vuông góc với bề mặt, chiều cao, diện tích mặt sàn — ngay trong mô hình 3D, và giữ lại danh sách số đo làm hồ sơ.
Người dùng: quản lý toà nhà kiểm xem hành lang có đủ rộng cho xe lăn không; và kỹ sư kiểm một lỗ cửa.
Nguyên tắc riêng của màn này: **số đo đang lấy không bao giờ được chạy số.** Ở đây chính xác quan trọng hơn mượt mà.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-15 đo lường: khoảng cách hai điểm, điểm tới mặt, chu vi, diện tích mặt; M-03 bắt điểm và bắt góc.
- R-09 bắn tia lấy điểm trên bề mặt; S-08 máy trạng thái công cụ ở chế độ đo; I-03 con trỏ chữ thập.
- P-01 định dạng "3.450 mm" và "3,45 m"; I-01 phím tắt; D-05 vé hoàn tác.

[ĐỌC FILE NÀO]
- src/domain/measure/**, src/lib/three/interaction/**, src/lib/tools/**, src/lib/input/**, src/lib/format/**
- src/components/viewer/MeasurementOverlay.tsx
- src/components/ui/{SegmentedControl,Select,Badge,IconButton,Kbd}.tsx

[BỐ CỤC]
Khung Viewer3D với công cụ đo đang bật.
- SegmentedControl chế độ trong một viên thuốc nổi trên canvas: "Điểm đến điểm" · "Vuông góc với bề mặt" · "Chiều cao" · "Diện tích mặt sàn".
- **Chip chỉ báo bắt điểm** hiện con trỏ đang bắt vào cái gì: "Đỉnh" · "Trung điểm" · "Cạnh" · "Bề mặt" · "Giao trục".
- Mục "Phép đo" trong panel phải, danh sách số đo đã ghim, hàng 40: tên tự sinh · giá trị chữ đều · biểu tượng chế độ · con mắt ẩn hiện · nút xoá. Đầu mục hiện tổng số phép đo. Select đơn vị ở đầu mục: mm, cm, m.
Đường đo 2px --accent với đĩa đầu mút 8px. Đường gióng 1px --accent nét đứt ở 50%. Nhãn là viên thuốc trắng bo 999 chữ đều 13 bóng nổi. **Không bao giờ đỏ, không bao giờ vàng.**

[NỐI LOGIC]
- Mọi phép đo gọi M-15. **Màn tuyệt đối không tính khoảng cách, không tính diện tích, không quy đổi đơn vị.**
- Điểm lấy qua R-09 và bắt điểm M-03.
- Hiển thị bằng P-01 ở cả hai đơn vị.
- Số đo là **lớp phủ theo phiên**, không ghi vào mô hình — nhưng phải lưu kèm dự án để dùng làm hồ sơ.
- Xoá một số đo dùng vé hoàn tác D-05.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Trong lúc đo, nhãn bám con trỏ và giá trị cập nhật **liên tục bằng chữ đều, không chạy số**.
- Bắt điểm trong 8px: lắng xuống bằng đường cong mềm, và chip bắt điểm hoà tan để **gọi tên loại bắt điểm** trong 120ms.
- Ghim một số đo: đường gióng vẽ ra trong 240ms và nhãn lắng vào trung điểm.
- Nhãn số đo **luôn đứng thẳng hướng người xem**, nền mờ nhạt để đọc được trên mọi nền.
- Trỏ vào một hàng đã ghim: tô sáng số đo đó và làm mờ các số đo khác xuống 0,3.
- Đổi đơn vị: mọi nhãn **chạy số** sang giá trị mới trong 240ms — đây là chỗ duy nhất được chạy số.
- Esc thoát chế độ và phần đường dở dang mờ đi trong 180ms · Enter ghim · Delete xoá số đo đang chọn · M bật tắt công cụ.

[BẢY TRẠNG THÁI]
1. Rỗng — "Chưa có phép đo nào. Nhấn M rồi chọn hai điểm trên mô hình."
2. Đang đo — một điểm đã đặt.
3. Một phần — chuỗi đo chưa đóng; hoặc số đo tham chiếu tới hình học đã bị xoá, hiện chấm cần chú ý kèm giải thích.
4. Lỗi — không bắt được bề mặt.
5. Xong.
6. Không có quyền — **vẫn đo được** vì không đổi dữ liệu, nhưng không ghim được, kèm caption giải thích.
7. Thu gọn — danh sách thành chip đếm trong cụm trôi.

[CẤM TUYỆT ĐỐI]
- Không tự tính số đo, không tự quy đổi đơn vị.
- Giá trị đang đo **không được chạy số**.
- Loại bắt điểm hiện tại luôn phải được gọi tên trên màn.
- Số đo không được ghi vào mô hình.
- Không dùng đỏ hay vàng cho đường đo.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/viewer/MeasurementTool/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đo một tường đã biết chiều dài 4.250 mm → sai số không quá 1 mm. **In giá trị đo và giá trị thật.**
- Quay camera 360 độ với 5 số đo đã ghim → mọi nhãn vẫn đọc được, không nhãn nào lộn ngược. Chụp bốn góc.
- Đổi đơn vị từ mm sang m → cả 5 nhãn phải đổi. In trước và sau.
- Bật lần lượt 5 loại bắt điểm → in 5 nhãn hiện trên chip.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

> 🧊 **Xong nhóm D — 30/47 màn.** Lúc này sản phẩm đã dùng được thật. Chạy một lượt đo hiệu năng theo R-04 trên máy yếu nhất trong nhóm trước khi sang nhóm luật và xuất bản.

---

---

# PHẦN 6 — Nhóm E/F: Luật không gian, xuất bản và chia sẻ (8 màn)

> ⚖️ Nhóm này dựng trên M-12 (sổ đăng ký luật), M-13 (bảy luật hình học), M-14 (bảy luật công năng), nhóm X (X-01 xuất .glb bằng worker · X-02 PDF · X-03 chụp ảnh · X-04 liên kết chia sẻ và nhúng), cùng D-09 xung đột và D-10 so sánh phiên bản.
> **Màn hình không được tự viết luật và không được tự sinh tệp.**

## 6.0 — Hai điều phải biết trước khi chạy nhóm này

**1. Số định dạng xuất là 4, không phải 6.** Bộ UI/UX liệt kê sáu định dạng gồm `.ifc` và `.obj`. Nhưng nhóm X chỉ dựng bốn đường xuất: X-01 (.glb), X-02 (PDF), X-03 (ảnh), và Spatial JSON lấy thẳng từ D-11. **Không có bộ xuất IFC hay OBJ trong tầng logic.** Vì vậy S-34 chỉ có bốn định dạng. Nếu dự án cần IFC thì đó là một prompt logic mới cho nhóm X, phải chạy trước — tuyệt đối không viết bộ xuất trong `src/screens`.

**2. Số luật là 14, không phải 3 nhóm.** Bộ UI/UX gom thành ba họ luật (nhãn phòng · kề cận · vị trí cửa sổ). Tầng logic đã dựng **14 luật**: 7 hình học ở M-13 và 7 công năng ở M-14. Ba họ kia là cách **gộp để hiển thị**, không phải cấu trúc dữ liệu. Danh sách luật luôn đọc từ sổ đăng ký M-12.

## 6.1 — Bảng xử lý xung đột (nhóm E/F)

| Màn | Bộ UI/UX nói | Bộ 47 màn nói | Chốt |
| --- | --- | --- | --- |
| S-31 | 3 họ luật, 3 số tóm tắt | 14 luật, 3 số tóm tắt | 14 luật từ M-12, gộp hiển thị theo hai nhóm · **4 số tóm tắt**: tổng số kiểm tra · đạt · cảnh báo · vi phạm |
| S-31 | Dòng đã xử lý **không biến mất**, chuyển xuống nhóm gấp "Đã xử lý" | Không nói | Giữ nhóm "Đã xử lý" — người dùng cần thấy tiến độ của chính mình |
| S-32 | Panel bên rộng tối đa 720, có khối "Nguyên nhân có thể" | Tấm trượt 420 | Tấm trượt **420** · **giữ khối "Nguyên nhân có thể"**, đó là thứ biến một cảnh báo thành một quyết định |
| S-34 | 6 định dạng gồm .ifc và .obj | 4 định dạng | **4** — xem mục 6.0 |
| S-35 | Tấm 640, có mục mời người theo email | Hộp thoại 560, hai thẻ | **640**, ba mục: Mời người · Liên kết · Nhúng. Cần chỗ cho khung xem trước nhúng |
| S-36 | Nửa phải là **canvas xem trước**, tô cú pháp 3 tông | Nửa phải là **khối JSON**, tối đa 2 mức đậm nhạt | Trái 400 cây · phải có Tabs "JSON / Xem trước" · tô cú pháp đúng **3 tông** (khoá, chuỗi, số) |
| S-37 | Phục hồi **tạo phiên bản mới**, không xoá gì; nền diff luôn ở 8% | Phục hồi kèm vé hoàn tác | Cả hai: phục hồi tạo phiên bản mới **và** có vé hoàn tác · nền diff luôn 8%, không bao giờ đặc |

---

## S-31 — Báo cáo vi phạm luật không gian (RuleReport)

```
[CONTEXT]
Route /du-an/:id/kiem-tra. 14 luật (7 hình học + 7 công năng) chạy trên 4 tầng.
Người dùng: kỹ sư đang dọn 7 vi phạm trước khi phát hành, cần biết **cái nào thật sự quan trọng**.
Mục tiêu: đọc một lượt là biết phải sửa gì trước.
Giọng: luật viết thành **câu người không phải kỹ sư cũng đọc được**, không phải mã. Mức độ phải trung thực — cảnh báo không được hoá trang thành vi phạm.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-12 sổ đăng ký luật và bộ chạy kiểm tra tăng dần; M-13 bảy luật hình học; M-14 bảy luật công năng.
- P-03 viewmodel gộp vi phạm theo tầng, theo luật, theo mức; P-07 thang màu ba mức và chú giải.
- R-07 khuôn camera tới đối tượng vi phạm; P-01 định dạng số đo trong câu vi phạm.
- D-05 vé hoàn tác cho sửa tự động; O-03 helper kiểm thử theo bộ dữ liệu mẫu của D-13.

[ĐỌC FILE NÀO]
- src/domain/rules/**, src/lib/viewmodel/**, src/lib/coloring/**, src/lib/three/camera/**, src/lib/mutations/undo.ts
- src/components/ui/{Table,Badge,SegmentedControl,Select,Button,IconButton,Input}.tsx
- src/components/feedback/{EmptyState,InlineAlert,Skeleton,Toast}.tsx

[BỐ CỤC]
Báo cáo toàn trang trong khung chuẩn, breadcrumb "Dự án > Kiểm tra luật không gian". Nội dung 1080 căn giữa.
- Dải tóm tắt **bốn con số trần** bằng mono-lg với nhãn chữ thường bên dưới: tổng số kiểm tra · đạt · cảnh báo · vi phạm. **Không bao giờ dựng thành thẻ màu.**
- Dải lọc: SegmentedControl mức (Tất cả · Vi phạm · Cảnh báo · Đạt) · Select nhóm luật · Select tầng.
- Danh sách vi phạm **gộp theo luật**. Mỗi đầu nhóm ghi luật bằng tiếng Việt thường, ví dụ "Phòng GARA không được chứa giường hoặc sofa", kèm số vi phạm. Nhóm gấp được.
- Mỗi hàng 40: chấm mức · **một câu mô tả cho người** ("Phòng #R-005 (GARA) đang chứa 1 sofa") · tầng · mã đối tượng chữ đều · hai hành động "Xem" và "Sửa tự động" khi có cách sửa tự động.
- Nhóm gấp "Đã xử lý" ở đáy: **hàng đã sửa không biến mất**, chúng chuyển xuống đây để người dùng thấy tiến độ của mình.
- Panel xem trước phải 344: hiện vi phạm đang chọn trong ngữ cảnh trên một canvas nhỏ.
- Chân trang: nút phụ "Sửa tự động tất cả (4)" và nút chính "Xác nhận đã xử lý", chỉ bật khi không còn vi phạm.

[NỐI LOGIC]
- Kết quả kiểm tra lấy từ M-12. **Màn không tự viết bất kỳ điều kiện luật nào, không tự đặt ngưỡng.**
- Câu mô tả vi phạm **đã có sẵn** trong M-13 và M-14 — không viết lại.
- Gộp và đếm bằng P-03; màu mức bằng P-07.
- Bấm một hàng thì mở S-32 và khuôn camera qua R-07 trong 700ms.
- Sửa tự động là một lệnh, hoàn tác được, kèm toast 8 giây.
- Sửa tự động theo lô **phải xem trước danh sách mọi thay đổi** rồi mới áp; kết quả báo bằng toast, **không phải hộp thoại**.
- Bỏ qua một vi phạm bắt buộc chọn lý do từ danh mục và ghi lại ai bỏ qua.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Dấu vi phạm trên canvas đập viền ba nhịp trong 1,8 giây khi mới hiện rồi giữ tĩnh. **Không bao giờ nhấp nháy liên tục.**
- Sửa tự động: thay đổi chạy trên khung xem trước, rồi hàng thu lại trong 240ms và các con số tóm tắt chạy số.
- Nút "Chạy kiểm tra lại" hiện thời điểm lần chạy cuối; khi chạy thì có thanh tiến độ theo số luật đã chạy.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa chạy kiểm tra.
2. Đang tải — đang chạy, thanh tiến độ theo số luật; hàng khung xương.
3. Một phần — chỉ 2/4 tầng đủ dữ liệu; hoặc một nhóm luật không chạy được vì thiếu nhãn phòng: hiện thành **một hàng có liên kết sang S-20**, không phải một lỗi.
4. Lỗi.
5. Xong — không vi phạm: "Không phát hiện vi phạm nào. Mô hình đạt cả 14 luật." kèm badge đã duyệt **điềm đạm** và liên kết sang xuất bản. Không ăn mừng ồn ào.
6. Không có quyền — xem được, không bỏ qua được, hành động sửa **bị gỡ**.
7. Thu gọn — ẩn panel xem trước, bảng thành thẻ.

[CẤM TUYỆT ĐỐI]
- Không tự viết luật, không tự đặt ngưỡng, không viết lại câu mô tả.
- **Đỏ chỉ xuất hiện dưới dạng chip nhỏ và chấm.** Không dải đỏ ngang đầu trang, không khối đỏ lớn, không đèn báo kiểu báo động.
- Sửa tự động luôn xem trước và luôn hoàn tác được.
- Mục đã xử lý phải còn nhìn thấy trong nhóm gấp.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/rules/RuleReport/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Chạy trên bộ dữ liệu mẫu của D-13 → số vi phạm trùng đúng kết quả M-12. **In cả hai số.**
- Đo diện tích lớn nhất của mọi vùng màu vi phạm trên màn → phải dưới 120px.
- In 5 câu mô tả vi phạm và đưa cho người không phải kỹ sư đọc → họ phải hiểu. Ghi lại.
- grep tên luật viết cứng trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-32 — Chi tiết một vi phạm (ViolationDetail)

```
[CONTEXT]
Tấm trượt bên phải 420, mở từ S-31 hoặc từ nhóm Kiểm tra của S-23.
Người dùng: kỹ sư đang quyết định xem cái sofa bị gắn cờ trong gara là **lỗi nhận diện của máy** hay là chuyện lạ có thật trong bản vẽ.
Mục tiêu: hiểu vi phạm và sửa được ngay tại đây. Cho **lựa chọn**, không ép một cách sửa duy nhất.
Giọng: chỉ nói số đo và cách sửa. **Không phán xét.**

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-12 chi tiết luật: mã, tên, ngưỡng, căn cứ, cách sửa đề xuất. M-13 và M-14 số đo thực tế so với ngưỡng.
- S-07 lệnh sửa nhanh theo đề xuất; S-05 điều phối; S-06 lịch sử; D-05 vé hoàn tác.
- R-07 khuôn camera; R-09 tô sáng đối tượng; P-01 định dạng số đo.
- P-04 trạng thái màn; A-01 tokens; I-01 phím tắt.

[ĐỌC FILE NÀO]
- src/domain/rules/**, src/lib/commands/business/**, src/lib/three/{camera,interaction}/**
- src/components/overlay/Drawer.tsx, src/components/ui/{Badge,Button,NumericField,Input,Select,SegmentedControl,Tooltip}.tsx
- src/components/feedback/InlineAlert.tsx

[BỐ CỤC]
Tấm trượt phải 420, **không phải hộp thoại** — mô hình phía sau phải luôn nhìn thấy. Từ trên xuống:
1. Đầu: nhóm luật dạng nhãn mục · tiêu đề vi phạm h2 · Badge mức · mã đối tượng chữ đều.
2. Khối "Luật": luật viết thành **một câu thường**, đặt trong khối --bg-sunken bo 12.
3. Khối "Số đo hiện tại so với ngưỡng": hai con số đặt cạnh nhau bằng chữ đều, để mắt so được ngay.
4. Khối "Phát hiện": cái gì thật sự tìm thấy, các đối tượng là liên kết chữ đều bấm được, kèm độ tin cậy của chúng.
5. Khối hình: canvas nhỏ cao 240 vẽ vi phạm tại chỗ, đối tượng gây lỗi có viền --state-violation, ngữ cảnh để xám trung tính. Có nút đổi 2D/3D phía trên. Kèm một hình minh hoạ SVG 1px mô tả luật.
6. Khối "Nguyên nhân có thể": **hai hoặc ba giả thuyết bằng tiếng thường, xếp theo khả năng**, ví dụ "YOLOv8 nhận nhầm bàn làm việc thành sofa — độ tin cậy chỉ 0,62" và "Phòng được đặt tên sai ở bước gắn nhãn".
7. Khối "Lựa chọn xử lý": ba hàng tràn chiều rộng, mỗi hàng một mô tả — Xoá đối tượng bị phát hiện · Đổi tên phòng · Bỏ qua vi phạm này kèm ô ghi lý do.
8. Chân: caption nhỏ ghi mã luật đã sinh ra vi phạm này, bằng chữ đều, để hỗ trợ tra cứu.

[NỐI LOGIC]
- Nội dung luật, căn cứ và cách sửa lấy từ M-12. **Không tự viết căn cứ, không tự tính lại vi phạm.**
- Mỗi cách sửa là một nút tạo lệnh S-07 rồi S-05 nên hoàn tác được.
- Mở tấm thì khuôn camera R-07 và tô sáng đối tượng qua R-09.
- Sau khi sửa: **tự chạy lại đúng luật đó** qua M-12 và đổi trạng thái sang đạt kèm một dòng xác nhận.
- Bỏ qua bắt buộc có lý do ít nhất vài ký tự, kiểm ngay khi gõ. Vi phạm đã bỏ qua sau đó hiện trong báo cáo với biểu tượng ghi chú và tooltip nêu lý do cùng người ghi — **vì đây là hồ sơ kỹ thuật**.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Mở: trượt vào từ phải trong 240ms trong khi mô hình mờ nhẹ. **Không lớp phủ kiểu hộp thoại.**
- Trỏ vào một hàng lựa chọn: **xem trước hậu quả** trên canvas nhỏ, ví dụ làm mờ đối tượng sẽ bị xoá.
- Chọn một hành động: áp ngay, chạy hoạt cảnh giải quyết, rồi mời hoàn tác 8 giây.
- Có nút sang vi phạm tiếp theo; J và K duyệt qua lại **mà không đóng tấm trượt**.
- Sau khi giải quyết, tự chuyển sang vi phạm kế tiếp sau một nhịp ngắn mà người dùng **huỷ được**.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa chọn vi phạm.
2. Đang tải.
3. Một phần — không có cách sửa tự động, chỉ hướng dẫn tay; hoặc không dựng được ngữ cảnh hình, khi đó **phần chữ đứng một mình** chứ không hiện khung vỡ.
4. Lỗi — sửa thất bại: giải thích và trả giá trị về.
5. Xong — xác nhận điềm đạm rồi sang vi phạm kế tiếp.
6. Không có quyền — ẩn nút sửa, **vẫn xem được căn cứ**.
7. Thu gọn — tấm trượt từ dưới lên, ẩn canvas nhỏ.

[CẤM TUYỆT ĐỐI]
- Không tự tính lại vi phạm, không tự viết căn cứ luật.
- Không hộp thoại; mọi việc trong tấm trượt, và tấm trượt **không bao giờ che khuất mô hình**.
- Phải có **ít nhất hai** nguyên nhân có thể.
- Bỏ qua bắt buộc có lý do viết ra.
- Không giọng điệu phê phán.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/rules/ViolationDetail/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Sửa một vi phạm bằng nút đề xuất → luật đó chuyển sang đạt → Ctrl+Z trả về trạng thái vi phạm. **In kết quả hai lần kiểm tra.**
- Thử bỏ qua mà để trống lý do → phải bị chặn ngay khi gõ.
- Mở tấm trượt → chụp màn hình, mô hình phía sau phải vẫn nhìn thấy được.
- Đếm số nguyên nhân có thể → ≥ 2.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-33 — Cấu hình bộ luật (RuleSettings)

```
[CONTEXT]
Route /du-an/:id/bo-luat. Bật tắt và đổi ngưỡng 14 luật theo tiêu chuẩn dự án.
Người dùng: trưởng dự án đang cấu hình một dự án nhà xưởng, nơi luật về phòng ngủ hoàn toàn không liên quan.
Đổi ở đây ảnh hưởng toàn bộ báo cáo, nên nguyên tắc là **hiện hậu quả trước khi cam kết**.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- M-12 sổ đăng ký luật và kiểu cấu hình ngưỡng; M-13, M-14 giới hạn hợp lệ của từng ngưỡng.
- D-07 tự lưu; D-08 chỉ báo lưu; D-03 làm mới báo cáo sau khi đổi cấu hình; D-05 vé hoàn tác.
- O-02 flags cho bộ luật mặc định theo loại công trình; P-01 định dạng ngưỡng; A-03 chạy số.

[ĐỌC FILE NÀO]
- src/domain/rules/**, src/lib/autosave/**, src/lib/query/**, src/lib/telemetry/flags.ts
- src/components/ui/{Toggle,NumericField,Select,Badge,Button,Tooltip}.tsx
- src/components/feedback/{SaveIndicator,InlineAlert,Toast}.tsx

[BỐ CỤC]
Trang cài đặt hai cột, nội dung tối đa 960.
- Trái: bộ điều hướng mục dính, liệt kê hai nhóm luật cộng mục "Ngưỡng chung".
- Phải: mỗi nhóm là một thẻ có tên nhóm h3, một câu mô tả bằng tiếng thường, một Toggle tổng, và danh sách luật con bên dưới.
  Mỗi luật một dòng cao 56: Toggle bật tắt · **luật viết thành một câu** cùng một dòng mô tả · Select mức (Vi phạm · Cảnh báo · Bỏ qua) · ô ngưỡng dạng NumericField có hậu tố đơn vị · caption ghi **luật này hiện đang ảnh hưởng bao nhiêu đối tượng**, ví dụ "Đang ảnh hưởng 7 đối tượng".
- Thẻ "Ngưỡng chung": dung sai hình học theo mm · độ tin cậy tối thiểu để tự duyệt · Toggle cho phép lần chạy AI mới ghi đè mục chưa duyệt.
- Hàng bộ luật sẵn ở đầu trang: "Nhà ở" · "Văn phòng" · "Nhà xưởng", mỗi nút kèm caption nói rõ nó đổi những gì.
- Chân dính chỉ hiện khi cấu hình khác mặc định của dự án, có nút "Khôi phục mặc định".
Dưới 1024: bộ điều hướng thành Select ở đầu trang, ô ngưỡng xuống dòng dưới tên luật.

[NỐI LOGIC]
- Danh sách luật và giới hạn hợp lệ lấy từ M-12. **Không có bảng luật cứng trong màn.**
- Đổi thì tự lưu qua D-07 và làm mới báo cáo qua D-03.
- Nhập ngoài giới hạn thì chặn ngay tại ô và **nói rõ khoảng hợp lệ**.
- Bộ luật sẵn lấy từ O-02; áp bộ thì **hiện trước số luật sẽ đổi** và có vé hoàn tác 8 giây.
- Caption "đang ảnh hưởng bao nhiêu đối tượng" tính lại trực tiếp qua M-12.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Tắt một nhóm: các luật con thu lại trong 240ms và **mờ xuống 0,4 chứ không bị ẩn** — người dùng cần biết cái gì tồn tại.
- Đổi bất kỳ giá trị nào: caption ảnh hưởng tính lại trực tiếp, con số chạy số trong 240ms.
- Áp một bộ sẵn: từng điều khiển chạy tới giá trị mới lần lượt, so le 60ms, rồi mời hoàn tác.
- Tự lưu sau 800ms, dòng trạng thái đổi thành "Đã lưu lúc 14:32".

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có mô hình nên caption ảnh hưởng ghi "Chưa có dữ liệu để đánh giá".
2. Đang tải.
3. Một phần — đang lưu.
4. Lỗi.
5. Xong.
6. Không có quyền — chỉ đọc, kèm một câu nói rõ **ai được đổi**.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không khai báo lại danh sách luật trong màn.
- Không nút Lưu.
- Không cho tắt toàn bộ luật mà không có một câu cảnh báo về hậu quả.
- Luật đã tắt vẫn phải nhìn thấy được ở độ mờ thấp.
- Mỗi luật phải nói rõ đang ảnh hưởng bao nhiêu đối tượng.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/rules/RuleSettings/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi một ngưỡng → báo cáo S-31 đổi số vi phạm tương ứng. **In số trước và sau.**
- Áp bộ "Nhà xưởng" → phải thấy trước số luật sẽ đổi, rồi hoàn tác được trong một thao tác.
- Nhập ngưỡng ngoài giới hạn → phải thấy câu nêu đúng khoảng hợp lệ.
- Đếm số luật hiển thị → đúng 14, khớp với số mục trong sổ đăng ký M-12. In cả hai số.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-34 — Xuất mô hình (ExportPanel) ⭐

```
[CONTEXT]
Route /du-an/:id/xuat. Đây là bước **giao sản phẩm cho khách**, nên phải rõ ràng và không gây hoảng.
Hai người dùng: kỹ sư bàn giao mô hình cho đội BIM, và quản lý chỉ cần một tệp PDF.
Bốn định dạng, đúng bốn: `.glb` · PDF · Ảnh · Spatial JSON. **Không có IFC, không có OBJ** — tầng logic không có bộ xuất cho hai định dạng đó.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- X-01 xuất .glb bằng worker, có tiến trình thật và huỷ được; X-02 xuất PDF nhiều trang; X-03 chụp ảnh khung nhìn.
- R-02 mức chi tiết khi xuất; R-04 ngân sách để cảnh báo tệp quá nặng.
- P-01 định dạng dung lượng và thời gian còn lại; P-04 trạng thái màn; O-01 ghi sự kiện xuất.
- M-12 trạng thái kiểm tra luật để nhắc trước khi xuất; D-11 nguồn của Spatial JSON.

[ĐỌC FILE NÀO]
- src/lib/export/**, src/lib/three/perf/**, src/lib/format/**, src/lib/telemetry/**, src/domain/rules/**
- src/components/ui/{Table,Toggle,Select,Checkbox,Radio,Button,Badge,SegmentedControl}.tsx
- src/components/feedback/{InlineAlert,ProgressOverlay,Toast}.tsx

[BỐ CỤC]
Hai cột.
- Trái 60%: bốn thẻ định dạng xếp dọc, thẻ trắng có biểu tượng nét 20 — **không phải ô màu lớn**. Mỗi thẻ: phần mở rộng bằng chữ đều · **một câu nói định dạng này dành cho ai** · dung lượng ước tính bằng chữ đều, cập nhật theo các tuỳ chọn bên dưới. Ví dụ: ".glb — Mô hình 3D dùng cho web và Unreal — ước tính 8,4 MB".
- Phải 344: tóm tắt đơn xuất, khối "Kiểm tra trước khi xuất", và danh sách tệp đã xuất kèm thời điểm và dung lượng bằng chữ đều.
- Mục "Phạm vi": chọn nhiều tầng, hiện tầng nào đã duyệt; **tầng chưa duyệt vẫn chọn được** nhưng mang caption cần chú ý.
- Mục "Tuỳ chọn" theo từng định dạng, gấp lại mặc định.
- Khối "Kiểm tra trước khi xuất": danh sách ngắn gồm trạng thái duyệt · vi phạm chưa xử lý · đối tượng chưa duyệt, mỗi mục một chấm trạng thái và một liên kết đi sửa. **Chỉ để thông tin, không bao giờ chặn.**
- Chân: nút chính "Xuất" và caption nói tệp sẽ xuất hiện ở đâu.

[THÀNH PHẦN & DỮ LIỆU]
Tuỳ chọn theo định dạng:
- **.glb** — chọn tầng · mức chi tiết cao hoặc gọn theo R-02 · có kèm nội thất hay không · có kèm lưới trục hay không · Select đơn vị · ước tính dung lượng.
- **PDF** — chọn mục: mặt bằng từng tầng · bảng phòng · báo cáo vi phạm · ảnh 3D. Hiện trước **số trang**.
- **Ảnh** — góc nhìn sẵn, 1440px.
- **Spatial JSON** — có kèm độ tin cậy hay không.
Câu nhắc khi còn vi phạm: "Còn 3 vi phạm chưa xử lý." — **vẫn cho xuất**.

[NỐI LOGIC]
- Mọi việc sinh tệp gọi X-01, X-02, X-03. Spatial JSON lấy thẳng từ D-11. **Màn chỉ vẽ tiến trình thật và nút huỷ.**
- Ước tính dung lượng lấy từ X-01, **không đoán**.
- Trạng thái vi phạm lấy từ M-12.
- Ghi sự kiện xuất qua O-01.
- Không chặn giao diện khi xuất: người dùng đi màn khác được và quay lại vẫn thấy tiến trình.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Chọn một định dạng: bộ tuỳ chọn của nó hoà tan 180ms và dung lượng ước tính chạy số 240ms.
- Đổi bất kỳ tuỳ chọn nào: ước tính tính lại trực tiếp.
- Xuất: chân trang thay bằng thanh tiến độ ngay tại chỗ **kèm tên bước hiện tại**, ví dụ "Đang gộp lưới tầng 2" — người dùng không bao giờ bị bỏ lại với một vòng xoay.
- Xong: toast có nút tải, và tệp cũng xuất hiện trong danh sách lịch sử xuất.
- Huỷ giữa chừng được phép và có hiệu lực ngay.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có gì được duyệt: giải thích kèm liên kết sang duyệt.
2. Đang tải — đang ước tính dung lượng, **chỉ con số ở dạng khung xương**, phần còn lại dùng được.
3. Một phần — 2/4 tầng được chọn, hoặc có tầng chưa duyệt: vẫn xuất kèm caption ghi rõ.
4. Lỗi — hết bộ nhớ: giải thích bằng tiếng thường, mã lỗi nhỏ bằng chữ đều, gợi ý hạ mức chi tiết, và **nút thử lại giữ nguyên mọi thiết lập**.
5. Xong — danh sách tệp kèm dung lượng và nút tải lại.
6. Không có quyền — vai Người xem chỉ tải được ảnh, kèm caption nói ai được xuất.
7. Thu gọn — bốn thẻ xếp dọc hết chiều rộng.

[CẤM TUYỆT ĐỐI]
- Không tự sinh tệp trong màn, không chặn giao diện khi xuất.
- **Không thanh tiến độ giả** — phải lấy tiến trình thật từ worker.
- Không chặn xuất vì còn vi phạm; chỉ nhắc.
- Không thêm định dạng ngoài bốn cái đã liệt kê.
- Mỗi định dạng phải nói rõ dành cho ai, bằng tiếng thường.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/export/ExportPanel/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Xuất .glb 4 tầng → giao diện vẫn mượt (**in fps trong lúc xuất**) → huỷ giữa chừng → không rò worker (in số worker đang sống).
- Đổi mức chi tiết từ cao sang gọn → ước tính dung lượng phải đổi và chạy số. In hai giá trị.
- Trong lúc xuất, đi sang màn 3D rồi quay lại → tiến trình vẫn đúng.
- Đếm số định dạng → đúng 4. grep "\.ifc\|\.obj" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-35 — Chia sẻ và nhúng (ShareDialog)

```
[CONTEXT]
Hộp thoại chia sẻ — **nơi thứ ba và cuối cùng** trong toàn sản phẩm được dùng hộp thoại, vì đây là một việc rời rạc có điểm kết thúc rõ ràng.
Người dùng: trưởng dự án gửi mô hình cho khách hàng, và khách hàng **không được sửa**.
Nguyên tắc: hậu quả của việc mở rộng quyền truy cập phải nói ngay tại chỗ người dùng chọn, không phải trong một hộp thoại thứ hai.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- X-04 tạo liên kết chia sẻ, đặt hạn dùng, mật khẩu, quyền xem, sinh mã nhúng; R-08 mã hoá góc nhìn chia sẻ.
- T-04 schema cấu hình chia sẻ; L-03 câu lỗi; I-02 bẫy tiêu điểm.
- P-02 định dạng ngày hết hạn; D-05 vé hoàn tác; D-07 tự lưu; O-01 ghi sự kiện chia sẻ.

[ĐỌC FILE NÀO]
- src/lib/export/shareLink.ts, src/lib/three/camera/**, src/api/schemas/**, src/lib/input/focusTrap.ts, src/lib/format/**
- src/components/overlay/Modal.tsx
- src/components/ui/{Input,Combobox,Toggle,Select,Button,Badge,Avatar,IconButton,SegmentedControl}.tsx

[BỐ CỤC]
Hộp thoại 640, bo 16, bóng hộp thoại, lớp phủ rgba(43,42,40,0.28). Ba mục dọc:
1. **Mời người** — Combobox email có gợi ý ảnh đại diện từ không gian làm việc, Select vai bên cạnh (Chỉnh sửa · Nhận xét · Chỉ xem), nút "Mời". Dưới là danh sách quyền hiện tại, hàng 40: ảnh đại diện · tên · email dạng caption · Select vai · nút gỡ. **Hàng chủ sở hữu không sửa được và nói rõ vì sao.**
2. **Liên kết** — Select phạm vi (Chỉ người được mời · Bất kỳ ai có liên kết · Công khai) · ô liên kết chữ đều chỉ đọc tràn chiều rộng kèm nút sao chép · các Toggle: cho xem 3D, cho đo, cho tải .glb, yêu cầu mật khẩu, hạn dùng. Khi chọn phạm vi rộng hơn thì **hàng ngay phía trên giải thích hậu quả bằng một câu**. Danh sách liên kết đang hoạt động có nút thu hồi.
3. **Nhúng** — khối mã chữ đều 13 trên --bg-sunken có nút sao chép · SegmentedControl kích thước sẵn · hai ô chiều rộng và chiều cao · các Toggle chọn phần giao diện mà trình xem nhúng hiển thị (thanh công cụ · danh sách tầng · bảng thuộc tính) · **khung xem trước trực tiếp 240 tỷ lệ 16:9 bên cạnh mã**, cập nhật khi đổi khoá.
Chân: nút "Xong" là hành động chính. **Không có nút Huỷ**, vì mọi thứ đã áp ngay.

[NỐI LOGIC]
- Mọi liên kết và mã nhúng do X-04 sinh. **Không tự ghép URL, không tự nối chuỗi mã nhúng trong màn.**
- Góc nhìn được chia sẻ mã hoá bằng R-08.
- Đổi khoá thì sinh lại liên kết qua X-04 và hiện một dòng nhắc rằng liên kết cũ đã hết hiệu lực.
- Đổi phạm vi truy cập là hành động **hoàn tác được** từ toast.
- Tự lưu, đầu hộp thoại hiện "Đã lưu lúc 14:32".
- Bẫy tiêu điểm gọi I-02.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Sao chép liên kết hoặc mã: biểu tượng đổi thành dấu tích trong 1,2 giây kèm một toast ngắn.
- Đổi tuỳ chọn nhúng: khung xem trước cập nhật trong 240ms và mã được viết lại, **thuộc tính vừa đổi được tô nền --bg-selected trong chốc lát**.
- Đổi phạm vi từ riêng tư sang công khai: câu cảnh báo hiện **ngay trong hàng đó**, không phải hộp thoại.
- Thêm một người: hàng của họ trượt vào từ trên trong 240ms kèm nháy --bg-selected.

[BẢY TRẠNG THÁI]
1. Rỗng — chỉ chủ sở hữu có quyền, kèm một câu dạy việc; chưa có liên kết thì có nút tạo.
2. Đang tải — đang tạo liên kết.
3. Một phần — đã có liên kết nhưng hết hạn; hoặc có lời mời đang chờ, hiện chấm cần chú ý và "Đang chờ chấp nhận".
4. Lỗi — email không hợp lệ, kiểm ngay khi gõ.
5. Xong.
6. Không có quyền — chỉ chủ sở hữu đổi được phạm vi liên kết: mục đó thành chỉ đọc kèm giải thích. Vai Kỹ sư không tạo được liên kết công khai.
7. Thu gọn — dưới 1280 ẩn khung xem trước nhúng.

[CẤM TUYỆT ĐỐI]
- Không tự ghép URL chia sẻ, không tự sinh mã nhúng bằng chuỗi.
- **Không hiện mật khẩu dạng rõ sau khi đã lưu.**
- Hậu quả của việc mở rộng quyền phải nói ngay tại hàng chọn.
- Không nút Lưu, không nút Huỷ.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/export/ShareDialog/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Tạo liên kết có mật khẩu và hạn 7 ngày → mở bằng cửa sổ ẩn danh → **phải hỏi mật khẩu**. Báo cáo kết quả.
- Đổi ba khoá nhúng → khung xem trước và mã phải khớp nhau. Chụp cả ba.
- Đổi phạm vi sang Công khai → phải thấy câu cảnh báo trong hàng, và hoàn tác được từ toast.
- grep "https://\|`<iframe" ghép chuỗi trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-36 — Xem Spatial JSON (SpatialJsonViewer)

```
[CONTEXT]
Route /du-an/:id/du-lieu. Spatial JSON là **đầu ra chính thức**: siêu dữ liệu dự án, danh sách tầng, mốc toạ độ toàn cục, đỉnh, tường, cửa đi, cửa sổ, nội thất, phòng.
Người dùng: lập trình viên đang tích hợp đầu ra vào hệ thống phía sau; và kỹ sư muốn xem toạ độ chính xác của đúng một bức tường.
**Chỉ đọc. Không sửa.**

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-11 mô hình Spatial và D-12 chuẩn hoá; **D-13 kiểm toàn vẹn** để hiện cảnh báo dữ liệu thiếu.
- R-09 tô sáng đối tượng tương ứng trong 3D khi chọn một nút; R-07 bay tới nếu đối tượng ở xa.
- P-01 định dạng số và dung lượng; P-04 trạng thái màn.

[ĐỌC FILE NÀO]
- src/domain/spatial/**, src/lib/three/interaction/**, src/lib/format/**
- src/components/ui/{Input,Badge,IconButton,Tooltip,SegmentedControl}.tsx
- src/components/feedback/{Skeleton,InlineAlert}.tsx

[BỐ CỤC]
Chia đôi.
- Trái 400: **cây cấu trúc** gấp mở được — dự án → tầng → tường, lỗ mở, phòng, trục. Thụt 16 mỗi cấp, hàng 24, có tam giác gấp mở. Nút gấp lại hiện số phần tử con dạng caption, ví dụ "walls [48]". Số dòng ở máng trái màu --text-muted. Mặc định mọi khoá gốc gấp lại trừ `project_metadata`.
- Phải: Tabs "JSON / Xem trước".
  - JSON: khối chữ đều 13 dòng cao 20 trên --bg-sunken, gấp mở từng khối, có chế độ thô với khoá ngắt dòng.
  - Xem trước: canvas tô sáng đúng nút đang chọn.
- Thanh trên: ô tìm theo khoá hoặc giá trị, hiện đếm khớp "3 / 12" bằng chữ đều · nút "Mở rộng tất cả" và "Thu gọn tất cả" · SegmentedControl cây / thô · nút sao chép.
- **Dải kiểm tra hợp lệ** ngay dưới thanh trên: một chấm trạng thái và một câu thường, ví dụ "Hợp lệ theo schema v1.2 — 0 lỗi". Nếu không hợp lệ thì mỗi lỗi là một hàng ghi **đường dẫn JSON bằng chữ đều** và **vấn đề bằng tiếng thường**.
- Chân: dung lượng tệp bằng chữ đều, số lượng đối tượng, nút phụ "Tải xuống .json" (dẫn sang S-34, không tự sinh tệp).
Tô cú pháp **đúng ba tông, không hơn**: khoá --text-primary · chuỗi --accent · số --data-dimension.
Dưới 1024: ẩn nửa phải, cây chiếm hết chiều rộng.

[NỐI LOGIC]
- Dữ liệu lấy từ D-11 và D-12.
- Cảnh báo thiếu trường lấy từ **D-13**, hiện ngay cạnh nút liên quan.
- Chọn một nút thì tô sáng đối tượng trong 3D qua R-09, và bay tới bằng R-07 nếu nó ở ngoài khung nhìn.
- **Không nạp toàn bộ tệp lớn một lần** gây treo trình duyệt; nạp theo tầng.
- Không tự sinh tệp — tải xuống là việc của S-34.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Chọn một nút: hình học tương ứng sáng lên trong 180ms.
- Mở một nút: chuyển chiều cao 180ms. **"Mở rộng tất cả" thì tức thì**, để tránh một chuỗi hoạt cảnh dài lê thê.
- Tìm kiếm: kết quả tô nền --bg-selected; phím n và N nhảy giữa các kết quả, mỗi lần cuộn vào tầm nhìn kèm một nháy.
- Bấm một lỗi hợp lệ: cuộn tới đường dẫn đó và mở mọi nút cha của nó.
- Sao chép một nhánh: chép từ nút đang chọn xuống, toast nói rõ đã chép cái gì.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa sinh JSON.
2. Đang tải — hàng cây khung xương.
3. Một phần — tệp lớn, chỉ nạp 2 tầng đầu, có nút nạp tiếp.
4. Lỗi — đầu ra hỏng: hiện vị trí lỗi phân tích và **luôn mở được chế độ thô** để không giấu gì.
5. Xong.
6. Không có quyền.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- **Chỉ đọc**: không ô nhập, không nút sửa.
- Không quá **ba** tông tô cú pháp. Không chủ đề bảy màu.
- Không nạp toàn bộ tệp lớn một lần.
- Lỗi hợp lệ phải nêu **cả** đường dẫn máy lẫn lời giải thích cho người.
- Chế độ thô luôn phải với tới được.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/export/SpatialJsonViewer/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Mở tệp mẫu 4 tầng → **thời gian hiển thị đầu tiên dưới 1 giây**. In số đo.
- Đếm số màu dùng trong khối JSON → đúng 3.
- Chọn nút `walls[13]` → đúng bức tường đó sáng lên trong 3D. Chụp ảnh.
- grep "input\|contentEditable\|onChange" trong thư mục màn → rỗng, trừ ô tìm.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-37 — Lịch sử phiên bản mô hình (VersionHistory)

```
[CONTEXT]
Route /du-an/:id/phien-ban. Mỗi lần chạy AI, sửa hàng loạt hoặc duyệt theo lô đều tạo một phiên bản.
Người dùng: trưởng nhóm muốn biết **chính xác lần chạy AI thứ hai đã đổi những gì so với lần đầu**.
Khác S-27: đây là mốc lưu theo phiên bản, không phải từng thao tác.
Nguyên tắc: **phục hồi không phá huỷ** — nó tạo ra một phiên bản mới chứ không xoá gì.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-10 so sánh và phục hồi phiên bản; D-09 xử lý xung đột 409 khi phục hồi.
- P-02 thời gian; P-03 gộp theo ngày và theo người; P-01 định dạng số thay đổi.
- R-01 dựng xem trước phiên bản cũ ở khung nhỏ; D-05 vé hoàn tác sau khi phục hồi.

[ĐỌC FILE NÀO]
- src/lib/versioning/**, src/lib/mutations/**, src/lib/three/build/**, src/lib/format/**, src/lib/viewmodel/**
- src/components/ui/{Table,Badge,Button,SegmentedControl,Select,Avatar,Checkbox,Tabs}.tsx
- src/components/feedback/{InlineAlert,EmptyState,Toast}.tsx

[BỐ CỤC]
Hai cột.
- Trái 360: danh sách phiên bản, mới nhất trên cùng, hàng 48. Mỗi hàng: nhãn phiên bản chữ đều "v12" · một mô tả thường "Chạy lại nhận diện tường" · ảnh đại diện và tên người · thời gian tương đối · **ba số đếm nhỏ bằng chữ đều dùng màu diff làm chấm**, ví dụ "+14 −3 ~8". Phiên bản hiện tại mang một viên thuốc đã duyệt nhỏ. Có ô tích để chọn hai phiên bản đem so.
- Phải: vùng so sánh. Trên cùng là hai Select phiên bản, mặc định là hai bản gần nhất. Dưới là Tabs ba mục:
  - **"Thay đổi"** — diff có cấu trúc, gộp theo loại thực thể (tường · cửa · phòng · trục). Mỗi đầu nhóm có số đếm, rồi các hàng **nói bằng tiếng thường**: "Tường #W-014: độ dày 110 mm → 220 mm".
  - **"JSON"** — diff theo dòng.
  - **"Trực quan"** — hai mô hình chồng lên nhau, đối tượng đã đổi có viền.
- Chân: nút phụ "Khôi phục phiên bản này" kèm caption giải thích rằng **phục hồi tạo ra một phiên bản mới chứ không xoá gì**, và nút xuất phiên bản cũ dẫn sang S-34.
Nền diff: thêm dùng --state-verified ở **8%**, bớt dùng --state-violation ở **8%**, đổi dùng --state-attention ở **8%**. Đây là những nền tô duy nhất được phép trong màn và **luôn ở 8%, không bao giờ đặc**.
Dưới 1024: danh sách phiên bản thành Select, so sánh xếp dọc.

[NỐI LOGIC]
- Khác biệt lấy từ D-10. **Màn không tự so dữ liệu.**
- Phục hồi gọi D-10, kèm vé hoàn tác D-05.
- Gặp 409 thì đi theo đường xử lý xung đột của D-09 và **giải thích ai đã sửa**, không ghi đè.
- Xem trước phiên bản cũ dựng bằng R-01.
- Gắn nhãn cho một phiên bản, ví dụ "Duyệt với chủ đầu tư".

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Chọn cặp phiên bản: diff tính lại kèm hoà tan 180ms, các số đếm chạy số.
- Trỏ vào một hàng diff: tô sáng đối tượng đó ở tab Trực quan nếu đang mở.
- Đổi tab: **giữ nguyên vị trí cuộn** trong vùng so sánh.
- Phục hồi: có một bước xác nhận, vì nó đổi trạng thái đang làm việc — nhưng câu xác nhận phải nói rõ **trạng thái hiện tại được giữ lại thành một phiên bản riêng**. Sau khi phục hồi, toast mời quay lại.
- Phiên bản mới tới trong lúc đang xem thì trượt vào đầu danh sách **mà không làm dịch vị trí cuộn của người đọc**.

[BẢY TRẠNG THÁI]
1. Rỗng — chỉ có một phiên bản: vùng so sánh hiện một câu dạy việc.
2. Đang tải — hàng diff khung xương.
3. Một phần — đang dựng xem trước phiên bản cũ; hoặc phiên bản cũ đã bị dọn theo chính sách lưu giữ, nêu rõ thời hạn lưu trong caption.
4. Lỗi.
5. Xong.
6. Không có quyền — so sánh được, **ẩn nút phục hồi**.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự tính khác biệt, **không ghi đè khi có xung đột**.
- Nền diff **luôn ở 8%**, không bao giờ đặc.
- Mọi thay đổi phải được mô tả bằng tiếng thường **trước** khi hiện JSON thô.
- Phục hồi phải được giải thích là không phá huỷ, bằng một câu, trước khi bấm.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/export/VersionHistory/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Phục hồi một phiên bản → 3D đổi đúng → hoàn tác trong 8000ms trả về. Báo cáo cả ba bước.
- Sau khi phục hồi, đếm số phiên bản → phải **tăng thêm 1**, không giảm.
- Giả lập 409 khi phục hồi → phải thấy câu nêu tên người đã sửa, và không có ghi đè.
- Đo độ mờ nền của ba loại diff → cả ba đúng 8%.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-38 — Quản lý thư viện model .glb (ModelLibrary)

```
[CONTEXT]
Route /thu-vien. Nơi quản trị viên tải lên, phân loại và ngừng dùng các model .glb chung cho mọi dự án.
Người dùng: quản trị viên đang tải một lô 30 model nội thất văn phòng và kiểm xem có cái nào quá nặng cho trình xem web không.
Khác S-24: **đây là trang quản lý dữ liệu, không phải panel kéo thả.** Bảng là mặc định, lưới là tuỳ chọn — không bao giờ là những ô lớn trang trí.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-02 uploadTask cho tệp .glb; T-03 kiểm tệp (≤ 100 MB, kiểm định dạng); L-03 câu lỗi.
- R-01 nạp xem trước và đếm tam giác; R-04 ngân sách để cảnh báo model quá nặng; R-05 dọn sau khi xem; R-02 tối ưu lưới.
- D-01, D-03 truy vấn và làm mới danh sách; D-05 vé hoàn tác khi xoá.
- P-01 định dạng dung lượng và số tam giác; P-02 ngày.

[ĐỌC FILE NÀO]
- src/lib/upload/**, src/lib/three/{build,perf}/**, src/lib/query/**, src/lib/format/**, src/lib/mutations/undo.ts
- src/components/ui/{Table,Input,Select,Badge,Button,IconButton,Checkbox,SegmentedControl,Avatar}.tsx
- src/components/feedback/{EmptyState,InlineAlert,Skeleton,ProgressOverlay,Toast}.tsx

[BỐ CỤC]
Khung chuẩn, breadcrumb "Quản trị > Thư viện model". Nội dung 1200.
- Thanh công cụ: ô tìm · Select danh mục · SegmentedControl chế độ xem (Bảng · Lưới) · nút chính "Tải lên model".
- Dải tóm tắt thư viện: tổng số model · tổng dung lượng · số model vượt ngưỡng.
- Bảng, hàng 48: ảnh xem trước 32 · Tên model · Danh mục · Kích thước bao (chữ đều) · Số tam giác (chữ đều) · Dung lượng (chữ đều) · Số dự án đang dùng (chữ đều) · Người tải lên · Ngày · Trạng thái. Sắp xếp được. Số tam giác vượt ngưỡng mềm mang **chấm** cần chú ý, vượt ngưỡng cứng mang chấm vi phạm — **là chấm, không phải ô tô màu**.
- Chọn nhiều thì hiện dải hành động lô dính: đổi danh mục · tối ưu lưới · ngừng sử dụng · xoá.
- Panel chi tiết phải 400: khung xem trước 3D cao 240 quay được · siêu dữ liệu dạng FieldRow chữ đều · **danh sách bí danh** ánh xạ tên lớp YOLO sang model này, ví dụ "sofa, couch" · danh sách dự án đang tham chiếu tới nó.
Dưới 1024: bảng thành thẻ, panel chi tiết thành lớp phủ.

[NỐI LOGIC]
- Tải lên qua T-02 và T-03. **Không tự đọc tệp .glb để đếm tam giác** — số liệu lấy từ R-01.
- Xem trước 3D trong panel dùng R-01 và **dọn bằng R-05 khi đóng**.
- **Không nạp xem trước 3D cho mọi hàng cùng lúc**; chỉ nạp khi mở panel chi tiết.
- Model vượt ngưỡng R-04 thì gắn badge "Nặng" và một câu khuyến nghị, **không chặn**.
- Tối ưu lưới gọi R-02, hiện số tam giác trước và sau, có hoàn tác.
- Ngừng sử dụng một model thì **cảnh báo ngay tại chỗ** có bao nhiêu dự án đang dùng và **đề nghị một model thay thế** thay vì chặn.
- Xoá một model đang dùng: đây là hành động **thật sự không hoàn tác được trên tài sản dùng chung**, nên là một trong số ít nơi có hộp thoại xác nhận, và hộp thoại phải **gọi tên các dự án bị ảnh hưởng**.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Thả tệp vào bất kỳ đâu trên màn: vùng tải lên mở ra bằng hoà tan 180ms với viền nét đứt 1px --accent quanh vùng nhận.
- Mỗi tệp tải lên hiện ngay thành một hàng có thanh tiến độ trong dòng và **tên bước hiện tại**, ví dụ "Đang tạo ảnh xem trước".
- Khung xem trước 3D **tự quay chậm khoảng 4 giây rồi tự dừng** để không gây phân tán; người dùng quay tay lúc nào cũng được.
- Tối ưu lưới: số tam giác trước và sau chạy số, kèm hoàn tác.

[BẢY TRẠNG THÁI]
1. Rỗng — "Thư viện chưa có model nào. Kéo thả tệp .glb vào đây để bắt đầu."
2. Đang tải — 10 hàng khung xương.
3. Một phần — đang tải lên 3 tệp, hiện phần trăm từng dòng; hoặc một số ảnh xem trước không dựng được: hiện **biểu tượng thay thế trung tính** và nút thử lại, không phải ảnh vỡ.
4. Lỗi — tệp không hợp lệ hoặc quá lớn: giải thích một câu kèm **dung lượng thật** bằng chữ đều.
5. Xong.
6. Không có quyền — chỉ xem, ẩn tải lên và xoá.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự đọc tệp .glb, không tự đếm tam giác.
- Không nạp xem trước 3D hàng loạt.
- Ngừng sử dụng thì **đề nghị thay thế**, không chặn.
- Xoá model đang dùng phải **gọi tên các dự án** bị ảnh hưởng.
- Số tam giác và dung lượng luôn bằng chữ đều và luôn nhìn thấy.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/admin/ModelLibrary/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Mở và đóng xem trước 10 model → **in dung lượng GPU trước và sau** để chứng minh không rò rỉ.
- Tải lên một tệp 120 MB → phải bị từ chối kèm câu nêu đúng dung lượng thật.
- Ngừng dùng một model đang được 3 dự án dùng → phải thấy số 3 và ô chọn model thay thế.
- Mở panel chi tiết → khung xem trước phải tự dừng quay sau khoảng 4 giây. Bấm giờ và báo cáo.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

> 📦 **Xong nhóm E/F — 38/47 màn.** Đến đây đã đi trọn vòng: tải lên → QC → 3D → kiểm luật → xuất và chia sẻ. Chín màn còn lại là quản trị và trạng thái biên — chúng là thứ quyết định sản phẩm có cảm giác **hoàn thiện** hay chỉ là bản demo.

---

---

# PHẦN 7 — Nhóm G/H: Quản trị và trạng thái biên (9 màn)

> 🛠️ Chín màn này ít được chú ý nhưng **quyết định cảm giác "sản phẩm hoàn thiện" chứ không phải bản demo**. Dựng trên T-09 và T-10 (ngoại tuyến và phát lại), S-11 (đồng bộ nhiều người), I-01 và I-02 (phím tắt, tiêu điểm), O-01 → O-05 (ghi nhận, cờ, kiểm thử, cổng chất lượng).
> **Không màn nào được tự viết lại cơ chế ngoại tuyến hay đồng bộ.**

## 7.1 — Bảng xử lý xung đột (nhóm G/H)

| Màn | Bộ UI/UX nói | Bộ 47 màn nói | Chốt |
| --- | --- | --- | --- |
| S-39 | **3 vai**: Quản trị · Kỹ sư · Người xem | **4 vai**: Quản trị · Kỹ sư QC · Kiến trúc sư · Người xem | **4 vai** — 46 màn kia đã viết trạng thái "không có quyền" theo bốn vai này |
| S-40 | **5 bước**, phần tử được dạy **vẫn bấm được**, làm đúng thao tác thì tự sang bước | **6 bước**, phím tắt đọc từ I-01 | **6 bước** · **giữ cơ chế dạy-bằng-làm** — đó là điểm khác biệt giữa dạy và đọc |
| S-41 | Mở panel **không tự đánh dấu đã đọc** | Có nút đánh dấu đã đọc hết | Cả hai: đọc là **hành động rõ ràng**, có nút đánh dấu tất cả |
| S-45 | Trạng thái kết nối sống ở **thanh trạng thái** dạng chấm và nhãn ngắn, **không bao giờ là dải ngang đầu trang** | **Dải mỏng 32** dính dưới thanh trên | Ba tầng theo mức nghiêm trọng: chấm ở thanh trạng thái (mạng chậm) → dải 32 (có lệnh đang chờ đồng bộ) → tấm giữa màn (**chỉ khi phiên hết hạn**, vì lúc đó không lưu được) |
| S-43 | Nội dung tối đa 480, có mã lỗi nhỏ chọn được | Cột 560 | **560** · giữ mã lỗi nhỏ chọn được |
| S-44 | Có **thẻ chủ sở hữu** và nút đổi tài khoản, vì "đăng nhập nhầm tài khoản" là nguyên nhân thật hay gặp nhất | Ba đường đi tiếp | Giữ cả hai — thẻ chủ sở hữu và đổi tài khoản là hai đường thứ tư và thứ năm |

---

## S-39 — Quản lý người dùng và vai (UserManagement)

```
[CONTEXT]
Route /nguoi-dung. **Bốn vai: Quản trị · Kỹ sư QC · Kiến trúc sư · Người xem.** Vai quyết định trạng thái "không có quyền" của 46 màn kia.
Người dùng: quản trị viên đang thêm bốn kỹ sư mới và gỡ một nhà thầu đã rời đi.
Nguyên tắc: hành động phá huỷ **nhưng đảo được** thì làm ngay kèm hoàn tác; hành động **thật sự không đảo được** thì bắt gõ tay. Hành động bị chặn thì luôn tự giải thích.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- L-02 phiên và vai hiện tại; T-04 schema mời và đổi vai; T-05 gọi API.
- D-01, D-03 truy vấn và làm mới; D-04 cập nhật lạc quan khi đổi vai; D-05 vé hoàn tác.
- P-02 thời gian hoạt động cuối; O-01 ghi sự kiện đổi vai.

[ĐỌC FILE NÀO]
- src/lib/auth/**, src/lib/query/**, src/lib/mutations/**, src/lib/format/**
- src/components/ui/{Table,Select,Input,Textarea,Badge,Avatar,Button,Checkbox,Tooltip}.tsx
- src/components/feedback/{EmptyState,InlineAlert,Toast}.tsx

[BỐ CỤC]
Khung chuẩn, breadcrumb "Quản trị > Người dùng". Nội dung 1080.
- Thanh công cụ: ô tìm · Select vai · Select trạng thái (Đang hoạt động · Chờ chấp nhận · Đã vô hiệu hoá) · nút chính "Mời người dùng".
- Dải tóm tắt: số người dùng · số quản trị · số lời mời đang chờ.
- Bảng hàng 48: ảnh đại diện 28 và họ tên · email · **Vai (Select ngay trong dòng)** · số dự án · lần hoạt động cuối (tương đối, thời điểm chính xác trong tooltip) · trạng thái · hành động.
- Panel chi tiết phải 400: hồ sơ người đó · danh sách dự án họ tham gia kèm vai trong từng dự án dạng Select · danh sách mười thao tác gần nhất có liên kết tới đối tượng.
- **Khối tham chiếu quyền** ở đáy panel và cũng mở được từ đầu trang: ma trận gọn, bốn vai theo cột và các việc theo dòng (tải bản vẽ · sửa hình học · duyệt QC · đổi bộ luật · xuất · chia sẻ · quản lý người dùng). Dấu tích và dấu gạch bằng --text-secondary — **đơn sắc, không dùng màu**.
Dưới 1024: bảng thành thẻ, panel thành lớp phủ.

[NỐI LOGIC]
- **Không tự định nghĩa lại bộ quyền** — lấy từ L-02 và schema T-04.
- Đổi vai dùng D-04 (đổi ngay trên giao diện rồi xác nhận với máy chủ) kèm vé hoàn tác D-05. **Không hộp thoại.**
- Nếu thay đổi **làm giảm quyền** của ai đó thì toast phải nói rõ **họ mất những gì**.
- Không cho tự hạ vai của chính mình; không cho gỡ Quản trị cuối cùng — chặn bằng **một câu giải thích tại chỗ**, không phải một nút vô hiệu không lý do.
- Vô hiệu hoá là đảo được và tức thì. **Xoá hẳn thì bắt gõ đúng email**, vì nó gỡ luôn phần ghi công trong lịch sử.
- Mời: ô nhập nhiều email, nhận dấu phẩy hoặc xuống dòng, kiểm ngay khi gõ; lời mời hiện ngay trong bảng thành hàng chờ.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Đổi vai: lưu ngay, nền hàng nháy 400ms, toast có Hoàn tác.
- Lời mời hết hạn: chấm cần chú ý và nút gửi lại.
- Trỏ vào một dòng hoạt động: hiện mã đối tượng bằng chữ đều.

[BẢY TRẠNG THÁI]
1. Rỗng — chỉ có một người, kèm câu dạy việc về mời đội.
2. Đang tải — 8 hàng khung xương.
3. Một phần — 3 lời mời chờ nhận, có nút gửi lại.
4. Lỗi.
5. Xong.
6. Không có quyền — không phải Quản trị thì **chỉ thấy ma trận quyền**, không thấy danh sách người, kèm giải thích thường và liên kết quay lại — **không phải một trang 403 trơ trọi**.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không tự định nghĩa lại bộ quyền.
- **Vai không bao giờ được truyền đạt chỉ bằng màu.** Không đỏ cho vai Người xem hay trạng thái chờ.
- Không hộp thoại cho đổi vai.
- Hành động bị chặn phải tự giải thích.
- Ma trận quyền phải có ngay trên màn này.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/admin/UserManagement/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi một người sang Người xem → mở S-15 bằng tài khoản đó → mọi nút sửa **ẩn hẳn**. Báo cáo kết quả.
- Hạ quyền một người → toast phải liệt kê đúng những việc họ mất.
- Thử gỡ Quản trị cuối cùng → phải thấy câu giải thích, không phải nút xám.
- Đếm số vai trong ma trận → đúng 4.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-40 — Hướng dẫn trong trình soạn thảo (EditorTour)

```
[CONTEXT]
Lớp dạy việc chạy đè lên màn QC và 3D, chạy một lần.
Người dùng: quản lý toà nhà mở một trình soạn thảo 3D **lần đầu tiên trong đời**.
Ranh giới: S-06 chỉ giới thiệu ba bước đầu của quy trình. **Đây mới là phần dạy công cụ. Không được lặp một câu nào của S-06.**
Nguyên tắc: **dạy bằng cách để người ta làm, không phải để người ta đọc.** Luôn bỏ qua được, luôn quay lại được.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- O-02 flags: cờ đã xem từng bước, lưu theo người và theo màn.
- I-02 tiêu điểm và bẫy tiêu điểm; **I-01 danh sách phím tắt để hiển thị đúng phím thật**.
- A-01 tokens; A-02 chuỗi bước; cờ giảm chuyển động.
- O-01 ghi sự kiện hoàn thành và bỏ qua từng bước.

[ĐỌC FILE NÀO]
- src/lib/telemetry/flags.ts, src/lib/input/**, src/lib/motion/**
- src/components/overlay/Popover.tsx, src/components/ui/{Button,Kbd,Badge}.tsx

[BỐ CỤC]
- Thẻ nhắc trắng 320, bo 12, đệm 20, bóng nổi, có mũi nhọn 8 **neo vào đúng phần tử thật**.
- Nền xung quanh rgba(43,42,40,0.28) với **vùng được dạy khoét thủng ra**, viền 2px --accent bo 6. Nền tối nhất 24%, **không tối đen**.
- Trong thẻ: bộ đếm bước chữ đều "3 / 6" · tiêu đề h3 · một hoặc hai câu · hình minh hoạ lặp 120 nếu cần · chân thẻ có "Bỏ qua" bên trái dạng chìm và "Tiếp theo" bên phải dạng chính.
- Dưới thẻ: hàng sáu chấm 6px thể hiện tiến độ, **bấm được để nhảy**.
Dưới 1280: thành tấm trượt đáy, không khoét thủng.

[THÀNH PHẦN & DỮ LIỆU]
Sáu bước, mỗi bước **một việc và một phím tắt thật**:
1. Đổi lớp ở ray công cụ.
2. Duyệt một bức tường bằng phím duyệt.
3. Sửa độ dày trong panel phải.
4. Hoàn tác bằng Ctrl+Z.
5. Chuyển sang 3D.
6. Xuất kết quả.
Sau khi xong: thẻ tổng kết ngắn liệt kê sáu phím tắt vừa học và nút chính "Bắt đầu làm việc".
Bỏ qua thì thả một chip "Xem hướng dẫn" vào thanh trên, chip đó ở lại suốt phiên.

[NỐI LOGIC]
- **Phím tắt hiển thị phải đọc từ I-01.** Nếu người dùng đổi phím thì thẻ nhắc đổi theo. Tuyệt đối không viết phím tắt bằng chữ cứng.
- Cờ đã xem đọc ghi qua O-02, lưu theo người và theo màn.
- Ghi sự kiện hoàn thành và bỏ qua từng bước qua O-01.
- Bỏ qua bất kỳ lúc nào bằng Esc hoặc bấm ra nền, **không hỏi lại**.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Vùng khoét chạy vị trí và kích thước giữa các bước trong 340ms bằng easing chính, để **mắt người dùng đi theo chứ không nhảy**.
- Thẻ hoà tan và trượt 8px theo hướng đi trong 240ms.
- **Phần tử được tô sáng vẫn tương tác được đầy đủ trong bước của nó.** Khi hệ thống phát hiện người dùng đã làm đúng thao tác thì tự sang bước tiếp kèm một nháy đã duyệt ngắn.
- Giảm chuyển động: thay chuyển động bằng hoà tan 120ms và vùng khoét đứng yên.

[BẢY TRẠNG THÁI]
1. Rỗng — đã xem xong, không hiện gì.
2. Đang tải — chưa nạp mô hình thì hướng dẫn **mời mở dự án mẫu** thay vì chạy trên canvas trống.
3. Một phần — dừng ở bước 3, lần sau tiếp tục đúng bước đó.
4. Lỗi — không tìm thấy phần tử neo: **bỏ bước đó lặng lẽ và điều chỉnh bộ đếm**, không làm vỡ giao diện.
5. Xong — thẻ tổng kết.
6. Không có quyền — vai Người xem chỉ được ba bước xem, bỏ ba bước sửa.
7. Thu gọn — tấm trượt đáy.

[CẤM TUYỆT ĐỐI]
- **Không chặn người dùng làm việc**; luôn bỏ qua được bằng một phím.
- Không viết phím tắt bằng chữ cứng.
- Không dùng lại bất kỳ câu nào của S-06.
- Không bước nào được che khuất chính thứ mà nó đang mô tả.
- Bỏ qua phải để lại một đường quay lại nhìn thấy được.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/EditorTour/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đổi phím duyệt từ A sang Y trong I-01 → thẻ nhắc phải hiện Y. **In cả hai lần chạy.**
- Ở bước 2, thử bấm phím duyệt thật → hướng dẫn phải tự sang bước 3.
- Đối chiếu toàn bộ chuỗi với S-06 → **không trùng câu nào**. In danh sách đã so.
- Xoá một phần tử neo rồi chạy lại → bộ đếm phải thành "x / 5", giao diện không vỡ.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-41 — Trung tâm thông báo (NotificationCenter)

```
[CONTEXT]
Tấm trượt 400 mở từ chuông ở thanh trên.
Người dùng: kỹ sư quay lại sau bữa trưa và thấy hai lần chạy AI đã xong cùng một người nhắc tên mình.
Nguyên tắc: thông báo là **câu**, không phải mã. Thông báo AI xong dẫn thẳng sang màn duyệt, nên nó là **điểm bắt đầu của việc tiếp theo**. **Không bao giờ tự đánh dấu đã đọc.**

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-06 dòng sự kiện SSE cho thông báo thời gian thực; T-07 quay vòng khi mất kết nối.
- D-01, D-03 truy vấn và làm mới; D-04 đánh dấu đã đọc lạc quan.
- P-02 thời gian tương đối; P-03 gộp theo ngày và theo dự án; A-03 chuyển động danh sách.
- O-02 cờ bật tắt từng loại thông báo, **đồng bộ với S-05**.

[ĐỌC FILE NÀO]
- src/lib/realtime/**, src/lib/query/**, src/lib/viewmodel/**, src/lib/format/**, src/lib/telemetry/flags.ts
- src/components/overlay/Drawer.tsx, src/components/ui/{Badge,IconButton,SegmentedControl,Button}.tsx
- src/components/feedback/{EmptyState,Skeleton,InlineAlert}.tsx

[BỐ CỤC]
Tấm trượt 400 neo vào chuông, bo 12, bóng nổi.
- Đầu: "Thông báo" h3 · số chưa đọc bằng chữ đều · nút chìm "Đánh dấu tất cả đã đọc" · IconButton sang cài đặt (S-05).
- SegmentedControl lọc: Tất cả · Chưa đọc · Nhắc đến tôi.
- Danh sách gộp theo ngày. Mỗi mục tối thiểu 64: biểu tượng loại 20 · **một câu mô tả** bằng chữ thân 15 có tên dự án và đối tượng dạng liên kết trong dòng · thời gian tương đối dạng caption · và khi cần thì một hành động ngay trong dòng như "Xem kết quả" hoặc "Chấp nhận". Mục nhắc tên hiện thêm trích đoạn bình luận trong khối --bg-sunken **tối đa hai dòng**.
- **Chưa đọc là một chấm 6px --accent bên trái, không bao giờ là nền hàng tô màu.**
- Chân: "Xem tất cả" dẫn sang bản toàn trang có thêm ô tìm.
Dưới 1024: tấm trượt toàn màn.

[NỐI LOGIC]
- Thông báo mới đến qua **kênh của T-06** — không tự mở kết nối SSE riêng.
- Đánh dấu đã đọc dùng D-04.
- Bấm một thông báo thì đi **đúng màn và đúng đối tượng**.
- Chuông ở thanh trên: số chưa đọc tối đa hiển thị "9+".
- Cờ bật tắt loại thông báo đọc từ O-02, đồng bộ với cài đặt tài khoản.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- **Mở tấm trượt không tự đánh dấu gì là đã đọc** — đọc là hành động rõ ràng, để người dùng không mất dấu.
- Trỏ vào một mục: hiện một nút nhỏ "Đánh dấu đã đọc" bên phải.
- Thông báo mới đến khi tấm đang mở: trượt vào đầu trong 240ms kèm nháy --bg-selected, **không làm dịch vị trí cuộn của người đang đọc**.
- Chuông nghiêng **một lần** 8 độ trong 340ms khi có thông báo tới. Một lần, không lặp.
- Bấm một mục: điều hướng rồi đóng tấm bằng hoà tan 180ms.
- Đánh dấu tất cả đã đọc: các chấm mờ đi so le 24ms.

[BẢY TRẠNG THÁI]
1. Rỗng — "Không có thông báo mới. Chúng tôi sẽ báo khi AI xử lý xong hoặc có người nhắc đến bạn."
2. Đang tải — 5 mục khung xương.
3. Một phần — mất kết nối, hiện "Có thể chưa cập nhật" theo T-07; hoặc thông báo cũ đã quá hạn lưu, nêu trong caption.
4. Lỗi — không tải được: **nút thử lại nằm trong chính tấm trượt**, không phải lỗi cấp trang.
5. Xong.
6. Không có quyền — chỉ thấy thông báo của dự án được chia sẻ.
7. Thu gọn — toàn màn.

[CẤM TUYỆT ĐỐI]
- **Không âm thanh, không nhấp nháy, không huy hiệu đỏ đậm.**
- Không tự mở kết nối SSE riêng.
- Chưa đọc là chấm, không bao giờ là nền hàng tô màu.
- Chuông nghiêng đúng một lần mỗi lần có thông báo.
- Mọi thông báo phải dẫn tới một đối tượng cụ thể.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/NotificationCenter/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Nhận 5 thông báo liên tiếp trong lúc đang cuộn → **vị trí cuộn không nhảy**. Báo cáo.
- Mở tấm trượt rồi đóng → số chưa đọc phải **không đổi**.
- Bấm một thông báo "AI xử lý xong" → phải mở đúng màn duyệt của đúng tầng đó.
- grep "new Audio\|animation.*infinite" trong thư mục màn → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-42 — Lớp cộng tác và bình luận (CollaborationLayer)

```
[CONTEXT]
Nhiều người cùng xem một dự án: hiện ai đang ở đâu, ai đang sửa gì, và bình luận gắn vào đối tượng.
Người dùng: hai kỹ sư cùng duyệt một tầng, một người làm tường, một người làm lỗ mở.
Đây là **một lớp phủ lên trình soạn thảo đã có, không phải một màn riêng.** Phải nhạt, không che việc đang làm.
Luật cốt lõi: **không bao giờ ghi đè im lặng.** Khoá phải nhìn thấy **trước khi** người ta bắt đầu gõ, không phải sau.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- S-11 syncChannel: danh sách người đang xem, vị trí con trỏ, đối tượng đang bị khoá, lệnh từ người khác.
- D-09 xung đột 409 khi hai người sửa cùng đối tượng; D-01 truy vấn bình luận; D-04 bình luận lạc quan.
- P-02 thời gian; R-07 khuôn tới đối tượng được bình luận; A-01 tokens.

[ĐỌC FILE NÀO]
- src/store/syncChannel.ts, src/lib/mutations/**, src/lib/three/camera/**, src/lib/format/**
- src/components/ui/{Avatar,Badge,Input,Textarea,Button,IconButton,Tooltip}.tsx
- src/components/overlay/Popover.tsx, src/components/feedback/{InlineAlert,Toast}.tsx

[BỐ CỤC]
- Thanh trên: nhóm ảnh đại diện 24 xếp đè ở góc phải, tối đa 4 rồi đếm "+2". Mở ra thành danh sách hiện **mỗi người đang ở tầng nào và đang chọn gì**, kèm hành động "Đi đến vị trí của họ".
- Canvas: vùng chọn của người khác vẽ viền 1px nét đứt kèm nhãn tên nhỏ; con trỏ của họ là mũi nhỏ kèm tên.
- Đối tượng đang bị người khác sửa: **gạch chéo 45 độ ở 6% cộng một biểu tượng khoá nhỏ**, tooltip "Nguyên đang chỉnh sửa". **Không bao giờ là lớp phủ màu.**
- Thanh tra: khi đối tượng đang chọn bị khoá thì các ô thành chỉ đọc và đầu panel có một câu nói **ai đang giữ và từ lúc nào**, kèm nút chìm "Yêu cầu quyền chỉnh sửa".
- Ghim bình luận 20 trên canvas hoặc trong 3D; bấm ghim mở bóng 320 có chuỗi trả lời, ô nhập, nhắc tên bằng @, nút đánh dấu đã xử lý. Danh sách bình luận mở được ở panel phải.
- **Panel giải quyết xung đột 400** hiện bên cạnh khi có xung đột thật: tên thuộc tính · hai giá trị đang tranh chấp bằng chữ đều · hai tác giả kèm thời điểm · ba hành động: giữ bản của tôi · lấy bản của họ · nhập thủ công.

[NỐI LOGIC]
- Mọi dữ liệu hiện diện lấy từ S-11. **Màn không tự mở kênh, không tự viết đồng bộ.**
- Xung đột xử lý theo D-09. **Màn không tự giải quyết xung đột.**
- Bình luận qua D-01 và D-04; bấm một dòng bình luận thì khuôn camera qua R-07.
- Khi người khác đổi một đối tượng bạn đang xem: hàng đó nháy --bg-selected 400ms và hiện caption "Nguyên vừa đổi giá trị này" kèm liên kết "Xem thay đổi". **Phần bạn đang sửa dở không bao giờ bị ghi đè.**
- Xin quyền sửa: gửi thông báo và hiện trạng thái đang chờ; khi được cấp thì khoá chuyển giao và panel chuyển mượt từ chỉ đọc sang sửa được.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Ảnh đại diện hiện diện vào bằng phóng từ 0,9 trong 240ms và biến mất bằng mờ dần — **không bật ra đột ngột**.
- Con trỏ người khác di chuyển có nội suy 120ms nên **trôi chứ không nhảy cóc**.
- Panel xung đột **không bao giờ mở dạng hộp thoại** và hoãn lại được.

[BẢY TRẠNG THÁI]
1. Rỗng — chỉ mình đang xem: nhóm ảnh chỉ có bạn, không có khoá nào.
2. Đang tải — đang kết nối, hiện bằng **một caption nhẹ chứ không phải vòng xoay**.
3. Một phần — kênh có nhưng suy giảm: caption "Đang đồng bộ chậm"; hoặc mất đồng bộ hẳn thì "Đang làm việc riêng" và **vẫn sửa được**.
4. Lỗi — mất kết nối thời gian thực: sửa tiếp tại chỗ, có caption thường trực nói rằng thay đổi sẽ đồng bộ khi có mạng lại.
5. Xong.
6. Không có quyền — xem bình luận, không viết.
7. Thu gọn — ẩn con trỏ người khác, **giữ ghim bình luận**; nhóm ảnh thành chip đếm.

[CẤM TUYỆT ĐỐI]
- Không tự viết đồng bộ, không tự giải quyết xung đột.
- **Không bảng màu riêng cho từng người.** Vòng hiện diện là một tông trung tính.
- Màu con trỏ phải rất nhạt và **không trùng thang độ tin cậy của P-06**.
- Không âm thanh, không lời nhắc nổi khi có người vào.
- Khoá phải nhìn thấy trước khi tương tác.
- Xung đột phải hiện **cả hai giá trị và cả hai tác giả**, và cần một lựa chọn của con người.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/CollaborationLayer/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Hai cửa sổ trình duyệt cùng sửa #W-014 → người thứ hai **thấy khoá trước khi gõ** và một câu giải thích; **không mất dữ liệu**. Báo cáo.
- Gây một xung đột thật → panel hiện đủ hai giá trị và hai tác giả, và không có gì bị ghi đè cho tới khi người dùng chọn.
- Đếm số màu dùng cho hiện diện → đúng 1 tông trung tính.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-43 — Không tìm thấy trang (NotFound)

```
[CONTEXT]
Route *. Hay gặp khi một liên kết cũ được chia sẻ lại.
Người dùng: người vừa bấm một liên kết trong email từ ba tháng trước.
Nhiệm vụ: **đưa họ về đúng việc trong một lần bấm.** Không có gì đáng báo động ở đây.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- D-01 truy vấn danh sách dự án gần đây để gợi ý; L-02 biết đã đăng nhập hay chưa.
- O-01 ghi đường dẫn bị lỗi để đội sản phẩm biết; P-02 thời điểm mở gần nhất.
- P-04 trạng thái màn; A-01 tokens.

[ĐỌC FILE NÀO]
- src/lib/query/**, src/lib/auth/**, src/lib/telemetry/**, src/lib/format/**
- src/components/ui/Button.tsx, src/components/feedback/EmptyState.tsx

[BỐ CỤC]
Một cột 560 căn giữa cả ngang lẫn dọc, trên --bg-app.
- Hình minh hoạ nét 120, độ dày 1,5, màu --text-muted: **một mảnh mặt bằng thiếu mất một bức tường**. Không dựng 3D, không chữ số khổng lồ, không màu.
- Tiêu đề h2: "Không tìm thấy trang này."
- Một câu giải thích lý do có thể bằng tiếng thường: mục đã bị xoá, đã chuyển đi, hoặc đường dẫn không đầy đủ.
- Hai nút cạnh nhau: nút chính "Về danh sách dự án" và nút chìm "Quay lại".
- Khối "Có thể bạn đang tìm": tối đa **3 dự án mở gần nhất** dạng hàng — thường hữu ích hơn mọi cái nút.
- Caption chân trang: mã lỗi nhỏ bằng chữ đều, **chọn được để gửi cho hỗ trợ**, ví dụ "Mã lỗi: 404 · /du-an/8f2a/tang/12".

[NỐI LOGIC]
- Gợi ý dự án gần đây lấy từ D-01.
- Nếu **chưa đăng nhập** (L-02) thì đổi nút chính thành đăng nhập và **giữ đường dẫn định đến** để quay lại sau khi vào.
- Nếu nguyên nhân là không có quyền thì **chuyển sang cách xử lý của S-44** thay vì 404.
- Nếu đang mất mạng thì **hiện cách xử lý của S-45** — đoán sai ở đây tệ hơn là không nói gì.
- Ghi đường dẫn lỗi qua O-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Hình minh hoạ **tự vẽ một lần** khi vào màn bằng hoạt cảnh nét 700ms rồi giữ nguyên. **Không lặp.**
- Nội dung hiện ra bằng nâng 8px trong 340ms.
- Trỏ vào một dòng dự án gần đây: nâng 1px và hiện thời điểm mở gần nhất.
- Giảm chuyển động: hình vẽ hiện đủ luôn kèm hoà tan 120ms.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa có dự án gần đây.
2. Đang tải — đang lấy gợi ý.
3. Một phần — có gợi ý; hoặc biết mục đã bị xoá thì **nói rõ khi nào và bởi ai** nếu biết, và có khôi phục từ thùng rác được không.
4. Lỗi — không lấy được gợi ý, vẫn đủ hai nút.
5. Xong.
6. Không có quyền — chưa đăng nhập.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- **Không chữ số "404" khổng lồ.** Không hình minh hoạ nhiều màu.
- Không giọng hài hước quá đà; câu ngắn và lịch sự.
- Mã lỗi có mặt nhưng nhỏ và chọn được.
- Dự án gần đây là đường phục hồi chính, không phải nút.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/NotFound/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Mở một đường dẫn sai khi chưa đăng nhập → đăng nhập → **về đúng đường dẫn đó** nếu hợp lệ. Báo cáo.
- Mở một dự án không có quyền → phải ra S-44, không phải màn này.
- Đếm số màu trên màn → chỉ token nền, chữ và một màu nhấn.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-44 — Không có quyền truy cập (AccessDenied)

```
[CONTEXT]
Hiện khi người đã đăng nhập mở một dự án không được chia sẻ, hoặc liên kết chia sẻ đã bị thu hồi.
Người dùng: kỹ sư nhận liên kết từ đồng nghiệp quên cấp quyền.
**Nguyên nhân thật hay gặp nhất là đăng nhập nhầm tài khoản** — nên phải nêu ra mà không bắt người dùng tự nghĩ tới.
Nói rõ ai cấp được quyền. Không đỏ, không báo động.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- L-02 vai và phiên; L-03 đọc mã lỗi 403 và lý do (thu hồi · hết hạn · sai mật khẩu liên kết).
- X-04 đọc thông tin liên kết chia sẻ để biết tình trạng.
- T-05 gọi API xin quyền; P-02 thời điểm; O-01 ghi sự kiện bị chặn.

[ĐỌC FILE NÀO]
- src/lib/auth/**, src/lib/errors/**, src/lib/export/shareLink.ts, src/lib/telemetry/**
- src/components/ui/{Button,Input,Textarea,Badge,Avatar}.tsx
- src/components/feedback/{EmptyState,InlineAlert}.tsx

[BỐ CỤC]
Một cột 560 căn giữa. Cùng lối trình bày với S-43.
- Hình minh hoạ nét 120: một mặt bằng phía sau một cánh cửa đóng. Điềm đạm, **không bao giờ đỏ**.
- Tiêu đề h2: "Bạn chưa có quyền truy cập".
- Một câu nêu **đúng cái gì bị hạn chế**, dùng tên mục nếu tiết lộ tên là an toàn: "Dự án Toà nhà HQ Renovation chỉ mở cho thành viên được mời."
- Khối "Bạn đang đăng nhập bằng": email hiện tại và nút chìm "Đăng nhập bằng tài khoản khác".
- Khối xin quyền: nút chính "Yêu cầu quyền truy cập" và một Textarea hai dòng với chữ gợi ý "Lý do bạn cần truy cập (không bắt buộc)".
- Khối chủ sở hữu: ảnh đại diện, tên và email của chủ dự án, để người dùng liên hệ thẳng.
- Nếu lý do là thiếu mật khẩu liên kết: một ô nhập mật khẩu liên kết.
- Nút chìm về danh sách dự án của mình.
- Caption chân trang: mã lỗi nhỏ bằng chữ đều.

[NỐI LOGIC]
- Lý do lấy từ L-03 và X-04. **Không tự đoán.**
- Gửi yêu cầu gọi T-05; xong thì đổi sang trạng thái đã gửi kèm thời điểm.
- **Chặn gửi lại quá nhanh**: chỉ một lần mỗi 10 phút, và nêu lý do bằng caption chứ không im lặng bỏ qua.
- Nếu mục **hoàn toàn không được phép nhìn thấy** thì rơi về cách xử lý của S-43, để không lộ tên dự án riêng tư.
- Ghi sự kiện bị chặn qua O-01.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Gửi yêu cầu: khối được thay bằng một xác nhận điềm đạm trong 240ms — "Đã gửi yêu cầu đến Nguyên. Bạn sẽ nhận thông báo khi được chấp nhận." — và nút chuyển sang trạng thái chờ kèm thời điểm gửi.
- Hình minh hoạ tự vẽ một lần khi vào màn.

[BẢY TRẠNG THÁI]
1. Rỗng — chưa gửi yêu cầu.
2. Đang tải — đang kiểm quyền.
3. Một phần — đã gửi yêu cầu, đang chờ, hiện thời điểm.
4. Lỗi — gửi yêu cầu thất bại; hoặc yêu cầu bị từ chối, **nói thẳng kèm lời nhắn tuỳ chọn của chủ dự án**.
5. Xong — được cấp quyền, tự đổi thành nút vào dự án.
6. Không có quyền — trạng thái mặc định của màn này.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- **Không tiết lộ tên dự án hay số liệu khi chưa có quyền** — trừ khi hệ thống xác nhận là an toàn.
- Không giọng chỉ trích, không biểu tượng khoá to màu đỏ. **Không có gì trên màn này màu đỏ.**
- Phải nêu rõ **ai cấp được quyền**.
- Phải có nút đổi tài khoản, nêu email hiện tại.
- Yêu cầu đang chờ hiện trạng thái, **không phải một cái nút lặp lại**.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/AccessDenied/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Ba lý do 403 khác nhau → **ba đoạn giải thích khác nhau**. In cả ba.
- Gửi yêu cầu hai lần trong 1 phút → lần hai bị chặn kèm câu nêu lý do.
- grep "#C0685A\|red" trong thư mục màn → rỗng.
- Mở một dự án hoàn toàn riêng tư → phải ra S-43, tên dự án không lộ.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-45 — Trạng thái kết nối và làm việc ngoại tuyến (ConnectionStates)

```
[CONTEXT]
Lớp dùng chung cho mọi màn: mất mạng · mạng chậm · đang đồng bộ lại · phiên hết hạn.
Người dùng: kỹ sư hiện trường hay mất mạng, và người làm việc hàng giờ trên mô hình lớn.
Luật tuyệt đối: **mất kết nối hay hết phiên không bao giờ được làm mất việc của người dùng.**

[MỨC ĐỘ HIỂN THỊ — BA TẦNG, KHÔNG ĐƯỢC TRỘN]
Đây là điểm quan trọng nhất của màn: mức độ ồn ào phải tương ứng mức độ nghiêm trọng.
1. **Mạng chậm** → chỉ một chấm nhỏ và một nhãn ngắn ở **thanh trạng thái**. Không dải, không lớp phủ.
2. **Ngoại tuyến có lệnh đang chờ** → dải mỏng cao 32 dính ngay dưới thanh trên, chữ căn giữa. Phải **giữ chỗ sẵn** để nội dung không nhảy khi dải xuất hiện. Có nút "Xem chi tiết" mở tấm trượt 360.
3. **Phiên hết hạn** → và **chỉ khi đó** — mới leo lên thành tấm giữa màn, vì lúc này thật sự không lưu được nữa.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- T-09 hàng đợi ngoại tuyến (tối đa 200 lệnh hoặc 5 MB); T-10 dò trạng thái mạng và phát lại khi có mạng.
- L-02 sự kiện phiên hết hạn; D-09 xung đột khi phát lại; D-08 chỉ báo lưu.
- P-01 định dạng số lệnh chờ; P-02 thời điểm đồng bộ cuối; A-01 tokens.

[ĐỌC FILE NÀO]
- src/lib/offline/**, src/lib/auth/**, src/lib/mutations/**, src/lib/format/**
- src/components/feedback/{InlineAlert,Toast}.tsx
- src/components/ui/{Badge,Button,IconButton}.tsx, src/components/overlay/{Drawer,Modal}.tsx

[THÀNH PHẦN & DỮ LIỆU]
Bốn trường hợp, mỗi cái **một câu và một hành động**:
- Mất mạng: "Đang làm việc ngoại tuyến · 12 thay đổi chờ đồng bộ."
- Mạng chậm: "Kết nối chậm, thao tác có thể trễ."
- Đang đồng bộ lại: thanh 2px và số lệnh còn lại.
- Phiên hết hạn: "Đăng nhập lại để lưu 12 thay đổi." — **con số này phải đúng, và không được mất việc.**
Tấm trượt chi tiết 360: danh sách lệnh đang chờ, thời điểm đồng bộ cuối, và nút thử lại.

[NỐI LOGIC]
- Số lệnh chờ và tiến trình phát lại đọc từ T-09 và T-10. **Màn không tự giữ hàng đợi, không tự viết cơ chế phát lại hay giãn cách thử lại.**
- Gặp xung đột khi phát lại thì chuyển sang đường của D-09 và **liệt kê rõ lệnh nào bị bỏ**.
- Phiên hết hạn: bắt được sự kiện của L-02, giữ nguyên hàng đợi, và sau khi đăng nhập lại thì phát lại tiếp.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Dải xuất hiện và biến mất bằng độ mờ, **không đẩy nội dung nhảy**.
- Đồng bộ xong: "Đã đồng bộ xong lúc 14:32" rồi **tự ẩn sau 4 giây**.
- Số lệnh còn lại chạy số khi giảm.

[BẢY TRẠNG THÁI]
1. Rỗng — trực tuyến, **không hiện gì cả**.
2. Đang tải — đang kiểm kết nối.
3. Một phần — đồng bộ xong 8/12.
4. Lỗi — hàng đợi đầy: yêu cầu nối mạng và **nói rõ nguy cơ** nếu tiếp tục.
5. Xong — thông báo rồi tự ẩn.
6. Không có quyền.
7. Thu gọn — dải thành một biểu tượng ở thanh trạng thái.

[CẤM TUYỆT ĐỐI]
- **Không chặn giao diện khi mất mạng**; người dùng vẫn làm việc được.
- **Không bao giờ để mất thay đổi khi phiên hết hạn.**
- Không tự viết cơ chế phát lại hay giãn cách thử lại.
- Không dùng tấm giữa màn cho bất cứ trường hợp nào ngoài phiên hết hạn.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/ConnectionStates/** (6 file), cập nhật src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Tắt mạng, sửa 12 tường, bật mạng → **cả 12 thay đổi đồng bộ đúng thứ tự**. In nhật ký phát lại.
- Cho phiên hết hạn khi đang có 12 lệnh chờ → đăng nhập lại → cả 12 vẫn còn. In số lệnh trước và sau.
- Bật mạng chậm → chỉ được thấy chấm ở thanh trạng thái, **không được có dải**. Chụp ảnh.
- Đo vị trí nội dung trước và sau khi dải xuất hiện → chênh lệch bằng 0.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-46 — Xem trên di động (MobileViewer)

```
[CONTEXT]
Route /m/du-an/:id. Chủ đầu tư và kỹ sư tại công trường mở bằng điện thoại.
**Chỉ xem và đo, không sửa** — đây là một hạn chế có ý thức, không phải thiếu sót.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- R-01, R-02 dựng và ba mức chi tiết; **R-04 ngân sách riêng cho di động, từ 30 fps**; R-05 dọn tài nguyên.
- R-06 camera cảm ứng; R-09 bắn tia theo chạm; M-15 đo.
- P-03 viewmodel gọn cho di động; P-01 định dạng; T-09 ngoại tuyến khi mạng yếu; X-04 chia sẻ liên kết.

[ĐỌC FILE NÀO]
- src/lib/three/**, src/domain/measure/**, src/lib/viewmodel/**, src/lib/offline/**, src/lib/export/shareLink.ts
- src/components/viewer/{ViewportFrame,FloorRail}.tsx
- src/components/ui/{IconButton,SegmentedControl,Badge,Button}.tsx, src/components/overlay/Drawer.tsx

[BỐ CỤC]
Ở 390:
- Khung 3D chiếm hết màn.
- Thanh trên 48: tên dự án và nút chia sẻ.
- Thanh dưới 56 với bốn biểu tượng: tầng · chế độ xem · đo · thông tin. **Mọi vùng bấm từ 44px.**
- Tấm thông tin trượt từ đáy, cao 45%, kéo được, nội dung **chỉ đọc**.
Ở 320: gộp thanh dưới còn ba biểu tượng.

[NỐI LOGIC]
- Một ngón quay · hai ngón thu phóng · hai ngón kéo dịch — **tất cả do R-06**, không tự viết xử lý chạm.
- Chọn đối tượng bằng chạm qua R-09, mở tấm thông tin chỉ đọc.
- Ngân sách và hạ chất lượng do R-04 quyết định, ngưỡng di động là 30 fps.
- Dựng ưu tiên **mức gọn trước** rồi mới nâng dần.
- Đo dùng M-15.
- Mạng yếu thì dùng T-09.

[TƯƠNG TÁC & CHUYỂN ĐỘNG]
- Bấm vào một mục cần sửa: hiện một câu "Sửa trên máy tính để chính xác hơn" kèm nút gửi liên kết qua email — **không phải một nút xám không giải thích**.
- Tấm thông tin kéo lên xuống theo ba nấc như CL-07.

[BẢY TRẠNG THÁI]
1. Rỗng.
2. Đang tải — hiện mức gọn trước.
3. Một phần — mạng yếu, chỉ tải 2 tầng.
4. Lỗi — máy yếu: đề nghị xem bản 2D thay vì cố dựng.
5. Xong.
6. Không có quyền.
7. Thu gọn — màn rất nhỏ 320.

[CẤM TUYỆT ĐỐI]
- **Không bê nguyên bố cục máy tính sang.** Không panel 344 trên di động.
- Không cho sửa dữ liệu.
- Không để fps dưới 30 mà không hạ mức chi tiết theo R-04.
- Vùng bấm không dưới 44px.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/MobileViewer/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU]
- pnpm typecheck, pnpm lint, pnpm test → xanh; expectSevenStates 7/7.
- Đo fps trên thiết bị giả lập tầm trung → **từ 30 fps**. In số đo và mức chi tiết được chọn.
- Đo mọi vùng bấm → không cái nào dưới 44px. In danh sách.
- Thử chạm vào một tường → tấm thông tin phải chỉ đọc, không có ô nhập nào.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

---

## S-47 — Trang trưng bày trạng thái (StateGallery)

```
[CONTEXT]
Route /design-system/states. Trang nội bộ gom đủ bảy trạng thái của 47 màn để duyệt thiết kế một lượt.
**Đây là màn cuối cùng và là cổng chất lượng cuối.** Nếu trang này đếm đủ 329 story và O-05 xanh thì toàn bộ tầng giao diện đã hoàn thành.

[LOGIC ĐÃ CÓ — CHỈ GỌI LẠI]
- O-03 bộ kiểm thử dùng chung: expectSevenStates, expectNoRawColor, expectVietnamese, expectAccessible.
- O-04 bộ dữ liệu mẫu mở rộng và **đồng hồ giả**; O-05 cổng chất lượng trước khi gộp mã.
- P-04 danh sách bảy trạng thái chuẩn; O-02 cờ ẩn trang này trên môi trường thật.
- A-01 tokens để xem lại chuyển động; P-06 và P-07 để xem lại thang màu.

[ĐỌC FILE NÀO]
- src/lib/testing/**, src/lib/screen-state/**, src/lib/telemetry/flags.ts, src/lib/coloring/**, src/lib/motion/**
- src/components/ui/{Table,Badge,Input,SegmentedControl,Toggle,Button}.tsx

[BỐ CỤC]
- Cột trái 280: cây 47 màn theo nhóm A → H, mỗi màn hiện số trạng thái đã có, ví dụ "7/7". Màn thiếu hiện "5/7" và **liệt kê thiếu cái nào**.
- Vùng phải: lưới khung xem trước, mỗi khung một trạng thái, nhãn trạng thái phía trên khung.
- Công cụ duyệt trên đầu: Toggle chủ đề sáng tối · Toggle giảm chuyển động · Toggle hiện lưới đo khoảng cách · nút "Chạy kiểm nhanh" gọi O-03 và hiện bảng kết quả **bốn phép kiểm theo từng màn**.

[NỐI LOGIC]
- Danh sách bảy trạng thái lấy từ P-04.
- Dữ liệu xem trước lấy từ O-04. **Không gọi API thật, không ghi dữ liệu thật.**
- Dùng đồng hồ giả của O-04 để chụp ảnh ổn định giữa các lần chạy.
- Cờ ẩn trang trên môi trường thật qua O-02.

[BẢY TRẠNG THÁI CỦA CHÍNH TRANG NÀY]
1. Rỗng — chưa chọn màn.
2. Đang tải.
3. Một phần — màn thiếu trạng thái, hiện "5/7" và liệt kê thiếu cái nào.
4. Lỗi.
5. Xong — **đủ 329 story**.
6. Không có quyền — ngoài nội bộ thì không vào được.
7. Thu gọn.

[CẤM TUYỆT ĐỐI]
- Không gọi API thật, không ghi dữ liệu thật.
- Không để trang này lọt vào gói sản phẩm thật khi cờ tắt.
- Không tạo component mới.

[DELIVERABLES]
- src/screens/system/StateGallery/** (6 file), cập nhật src/routes.tsx và src/i18n/vi.json

[NGHIỆM THU — ĐÂY LÀ NGHIỆM THU CỦA CẢ DỰ ÁN]
- pnpm typecheck, pnpm lint, pnpm test, pnpm e2e → xanh.
- **Đếm tổng story: phải đủ 329** (47 màn × 7 trạng thái). In con số và danh sách màn thiếu nếu có.
- Chạy O-05 cổng chất lượng → không còn màu thô, không chuỗi cứng trong JSX, tương phản từ 4,5:1.
- Bật chủ đề tối, duyệt hết 329 khung → không khung nào vỡ.
- Bật giảm chuyển động, duyệt hết → không khung nào còn hoạt cảnh.
- Dựng bản production → grep StateGallery trong gói xuất ra → rỗng.

[KHÔNG ĐƯỢC SỬA FILE NÀO]
- src/lib/**, src/api/**, src/domain/**, src/store/**, src/components/**, AGENTS.md, các màn đã xong.
```

> 🎉 **Xong 47/47 màn.** Nếu S-47 đếm đủ 329 story và O-05 xanh thì toàn bộ tầng giao diện đã hoàn thành trên nền 81 prompt logic.

---

# PHẦN 8 — Thứ tự chạy và nghiệm thu

## 8.1 — Thứ tự chạy toàn bộ

| Chặng | Nội dung | Số prompt | Ghi chú |
| --- | --- | --- | --- |
| 0 | ✅ L-01 → L-03, rồi 81 prompt logic | 84 | Đã xong |
| 1 | **DS-01** nền giao diện | 1 | Kiểm `src/theme/tokens.ts` trước tiên |
| 2 | **CL-01 → CL-07** thư viện thành phần | 7 | Một phiên một prompt, đúng thứ tự |
| 2b | *(nếu chọn cách A ở mục 5.0)* bổ sung mốc 700ms vào A-01 | 1 | Phải làm trước S-22 |
| 3 | **12 màn MVP** | 12 | S-01 → S-02 → S-03 → S-08 → S-10 → S-11 → S-15 → S-16 → S-19 → S-22 → S-23 → S-34 |
| 4 | Nhóm C còn lại | 4 | S-17, S-18, S-20, S-21 |
| 5 | Nhóm D còn lại | 7 | S-24 → S-30 |
| 6 | Nhóm luật | 3 | S-31 → S-33 |
| 7 | Xuất bản còn lại | 4 | S-35 → S-38 |
| 8 | Nhóm A còn lại | 4 | S-04 → S-07 |
| 9 | Nhóm B còn lại | 4 | S-09, S-12 → S-14 |
| 10 | Nhóm G/H | 8 | S-39 → S-46 |
| 11 | **S-47 cuối cùng** | 1 | Cổng chất lượng của cả dự án |

**Quy tắc vàng khi chạy: một phiên = một màn.** Chạy xong phải thấy `pnpm typecheck`, `pnpm lint`, `pnpm test` xanh và 7/7 story trước khi sang màn sau.

**Dấu hiệu phải dừng ngay:** nếu agent bắt đầu sửa file trong `src/lib`, `src/domain`, `src/store` hoặc `src/components` — đó là nó đang viết lại thứ đã có. Dừng, đọc lại khối `DS-BIND`, chạy lại prompt.

## 8.2 — Checklist nghiệm thu sau mỗi nhóm

**Về cảm giác mềm**
- [ ] Nửa nhắm mắt nhìn màn hình: thấy **vài tấm trắng trôi trên nền ấm**, hay vẫn thấy một lưới ô?
- [ ] Đếm số đường kẻ trên màn — còn dưới 10 không?
- [ ] Có chỗ nào chữ cách viền dưới 16px không?
- [ ] Còn sót nhãn VIẾT HOA nào không?
- [ ] Rê chuột qua một hàng bảng — cảm giác "êm" hay "giật"?

**Về trải nghiệm**
- [ ] Sửa một giá trị rồi bấm ra ngoài — có tự lưu và báo "Đã lưu" không?
- [ ] Xoá một đối tượng — hệ thống hỏi "Bạn có chắc?" hay xoá ngay kèm Hoàn tác?
- [ ] Làm trọn một quy trình **chỉ bằng bàn phím** — có kẹt ở bước nào không?
- [ ] Rút dây mạng giữa chừng — thông báo có dễ hiểu không, và có mất việc không?
- [ ] Một người vận hành toà nhà **chưa từng dùng CAD** có tự mở được mô hình và tìm được một phòng không?

**Về chuyên môn**
- [ ] Che hết chữ, chỉ còn canvas — có phân biệt được tường 110/220/330 không?
- [ ] Ba màu trạng thái có đủ khác nhau khi in đen trắng không?
- [ ] Mở màn hình cạnh một bản scan bản vẽ giấy — hai thứ có cùng một họ không?

**Về kiến trúc** (mới so với hai bộ cũ)
- [ ] `grep -r "fetch(" src/screens` → rỗng?
- [ ] `grep -r "Math\." src/screens` → không có phép hình học nào?
- [ ] `grep -r "localStorage" src/screens src/components` → rỗng?
- [ ] `grep -r "setTimeout" src/components` → rỗng?
- [ ] Chuỗi tiếng Việt trong `.tsx` → rỗng, tất cả nằm ở `vi.json`?
- [ ] Số thời lượng viết thẳng (`240ms`, `0.3s`) trong `src/screens` và `src/components` → rỗng?

## 8.3 — Tổng kết tài liệu

| Hạng mục | Số lượng |
| --- | --- |
| Prompt nền giao diện (DS-01) | 1 |
| Prompt thư viện thành phần (CL-01 → CL-07) | 7 |
| Prompt màn hình (S-01 → S-47) | 47 |
| **Tổng prompt trong tài liệu này** | **55** |
| Khối dán đầu phiên (DS-00, Known failure modes, DS-BIND) | 3 |
| Khối vỏ dùng chung (QC-SHELL, VIEWER-SHELL) | 2 |
| Bảng xử lý xung đột | 6 |
| Token màu | 38 |
| Luật trải nghiệm | 12 |
| Trạng thái mỗi màn | 7 |
| Story phải có khi xong | 329 |

---

## Khối sửa sai dùng chung

Khi một màn ra kết quả không đúng, **không viết lại prompt gốc** — gửi khối này:

```
[SỬA SAI — MÀN S-NN]
Màn: <tên màn> tại src/screens/<area>/<Name>/
Hiện tượng: <mô tả ngắn, kèm ảnh hoặc số đo nếu có>
Mong đợi: <câu mô tả đúng, trích từ khối [BỐ CỤC] hoặc [NGHIỆM THU] của prompt gốc>

Ràng buộc khi sửa:
- Chỉ được sửa trong thư mục của màn này và src/i18n/vi.json.
- Không sửa src/lib, src/api, src/domain, src/store, src/components.
- Không thêm component mới, không thêm màu ngoài token.
- Nếu nguyên nhân nằm ở tầng logic thì DỪNG LẠI và báo, kèm đúng tên prompt logic
  (ví dụ M-07, R-04) — không tự động sửa.

Kiểm lại sau khi sửa:
- pnpm typecheck, pnpm lint, pnpm test → xanh; 7/7 story vẫn đủ.
- Nói rõ đã đổi những dòng nào và vì sao.
```

---

## Nhật ký hợp nhất

| Phần | Trạng thái |
| --- | --- |
| Phần 0 — luật, khung 12 khối, bảng tra 47 màn, hai bảng xử lý xung đột | ✅ xong |
| Phần 1.1–1.3 — DS-00, Known failure modes, DS-BIND (mới) | ✅ xong |
| **Phần 1.4 — DS-01 nền giao diện** (mới, chạy đầu tiên) | ✅ xong |
| **Phần 1.5 — CL-01 → CL-07** (viết lại để nối vào tầng logic) | ✅ xong (8 prompt) |
| Nhóm A — S-01 → S-07 | ✅ xong (7/47) |
| **Nhóm B — S-08 → S-14** | ✅ xong (14/47) |
| **Nhóm C — S-15 → S-21** | ✅ xong (21/47) |
| **Nhóm D — S-22 → S-30** | ✅ xong (30/47) |
| **Nhóm E/F — S-31 → S-38** | ✅ xong (38/47) |
| **Nhóm G/H — S-39 → S-47** | ✅ xong (47/47) |
| Phần 8 — thứ tự chạy, checklist nghiệm thu, tổng kết | ✅ xong |

**Tài liệu hoàn chỉnh.** 55 prompt · 3 khối dán đầu phiên · 2 khối vỏ dùng chung · 6 bảng xử lý xung đột.
