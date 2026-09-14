# BỘ PROMPT BACKEND HỢP NHẤT v1.0 — 1 năng lực = 1 prompt · khung 10 khối

### Dựng phần sau của "Hệ thống số hoá tự động bản vẽ kỹ thuật 2D đa tầng thành mô hình 3D tương tác"

Bộ này là bản song sinh của `BO-PROMPT-FE-HOP-NHAT-v2.3` cho phía backend, và nó dựng
backend **từ đầu**.

Nó không được viết chỉ từ đặc tả. Nó viết sau khi đo ba thứ: đặc tả nghiên cứu, hợp đồng mà
frontend **thật sự gọi** (43 endpoint, đã chạy, đã có test), và những gì đã nằm sẵn trên máy
mà bạn có thể mượn nếu muốn.

---

# PHẦN 0 — Luật, hợp đồng, và bảng tra

## 0.1 — Bộ này dựng backend MỚI, và vì sao nó vẫn phải bắt đầu bằng việc đo

Backend chưa được làm. Bộ này dựng nó từ đầu.

Nhưng "dựng mới" không có nghĩa là "viết từ tờ giấy trắng", vì **một nửa hợp đồng đã bị
frontend chốt xong rồi**: `F:\AppFront` đang chạy, có 5.900 bài kiểm, và nó gọi 43 endpoint trong 12 nhóm,
với những hình dạng dữ liệu cụ thể. Backend mới không được tự chọn đường dẫn và tên trường —
nó phải phục vụ đúng những gì frontend đã gọi, nếu không việc sửa sẽ rơi vào phía có nhiều
test hơn.

Bộ FE v2.3 mắc đúng một lỗi mà bộ này tồn tại để tránh: mục 0.2 của nó mô tả dự án đang ở
chặng "chưa dựng màn nào", trong khi thực tế 45/47 màn đã có mã. Nó lên kế hoạch cho việc đã
làm gần xong. Bài học: **đo trước khi viết prompt**, kể cả khi tin chắc là chưa có gì.

---

## 0.2 — Thứ đã có trên máy: mượn được, không bắt buộc

Đo ngày **2026-09-14**. Ba thư mục cạnh `AppFront` đụng cùng miền nghiệp vụ. **Không cái nào
được bộ này coi là backend của dự án** — chúng là tiền lệ để tham khảo, và bạn quyết mượn gì.

| Thư mục | Là gì | Đáng mượn |
|---|---|---|
| `F:\DraftVision.AI` | Monorepo đã dựng khung `digitizer/{api,services,pipeline,adapters,schema}`, commit cuối **2026-07-20**. Năm trong sáu gói **chỉ có `__init__.py`**; `spatial/transform.py` đúng **15 dòng** bọc `json.dumps`/`json.loads` | ⭐ **Hai quyết định**: `.importlinter` ép chiều phụ thuộc, và `packages/schema/spatial.schema.json` sinh ra cả pydantic lẫn zod qua `make codegen` với `check_schema_parity.py` canh trôi |
| `F:\3d-drawing-system` | Kho **tiêu chuẩn**: `docs/coordinate-system-v1.0.md`, `docs/taxonomy`, gói `coord_utils` hai ngôn ngữ. Commit cuối **2026-07-21** | ⭐ Quy ước hệ toạ độ — thứ ba tài liệu hiện đang nói khác nhau |
| `F:\ArchiScan3D` | Kho **dữ liệu và kế hoạch**: scraper bản vẽ, `backlog-jira-final.md`, `tasks.json`. Không phải git repo | Bộ dữ liệu huấn luyện, và bản đặc tả nghiên cứu gốc |

Hai thứ đầu bảng đáng mượn **không phải vì chúng là mã**, mà vì chúng là **quyết định kiến
trúc đã được suy nghĩ**: một chiều phụ thuộc ép bằng máy, và một nguồn schema duy nhất sinh
ra cả hai ngôn ngữ. Viết lại chúng từ đầu là trả lại một bài toán đã có lời giải.

> **Cần bạn chốt trước khi chạy BE-01:**
> 1. Backend mới nằm ở đâu — thư mục mới cạnh `AppFront`, hay một repo riêng?
> 2. Có mượn hai quyết định của `DraftVision.AI` không, hay dựng lại theo cách khác?
>
> Đặc tả nghiên cứu đã chốt **FastAPI** (Phần VII, Tháng 2), nên phần ngôn ngữ và khung web
> không phải câu hỏi.

---

## 0.3 — Ba hợp đồng Spatial JSON, không cái nào khớp cái nào

Đây là **việc phải làm trước mọi việc khác**, và là lý do một prompt riêng (BE-01) dành cho nó.

| | Đặc tả nghiên cứu (Phần IV) | FE `domain/spatial/types.ts` — **đang chạy** | `DraftVision.AI/packages/schema/pydantic/spatial.py` — tiền lệ |
|---|---|---|---|
| Gốc | `project_metadata` + `geometry` theo tầng | `SpatialGraph` tám danh sách có kiểu | `entities: list[SpatialEntity]` **phẳng** |
| Mã | `w1`, `d1`, `win1`, `r1`, `v0` | `W-…`, `D-…`, `R-…`, `F-…` có tiền tố | `UUID` v7 |
| Tường | `from`/`to` trỏ đỉnh, `thickness_mm` | `centreline: Segment`, `thicknessMm` | không có khái niệm tường — chỉ `bbox_2d` |
| Đơn vị | mm cho hình học, **m** cho cao độ | **mm nguyên** cho mọi chiều dài | `float` mm |
| Gốc toạ độ | giao trục A-1 | ngầm định theo bản vẽ | "bottom-left of drawing sheet" |
| Độ tin cậy | `confidence` | `ReviewMetadata{confidence, source, reviewed}` | `confidence` + `source_pipeline` |
| Tự nhận | "cấu trúc dữ liệu đầu ra chuẩn" | mô hình chạy thật của FE | *"placeholder until EP-08 full codegen runs"* |

Ba hình dạng, ba hệ mã, hai gốc toạ độ, hai quy ước đơn vị cao độ.

Cột thứ hai là **ràng buộc cứng**: frontend đang chạy trên nó và giải mã lượt trả về bằng
`src/api/schemas/spatial.ts`. Cột một là đặc tả gốc. Cột ba là một tiền lệ đã bị chính tác
giả của nó đánh dấu *"placeholder until EP-08 full codegen runs"*.

Backend mới phải chọn **một** hình dạng và sống với nó. Đó là việc của BE-01, và nó chặn mọi
việc khác.

Một điểm đáng giữ của phía BE mà hai bên kia **không** có: `source_pipeline`
(`segformer | yolo | paddleocr | manual`). Nó trả lời câu "con số này do mô hình nào sinh
ra", và đó đúng là câu mà màn QC cần để giải thích cho người duyệt.

---

## 0.4 — Bảng nghĩa vụ: 43 endpoint, 12 nhóm, mà frontend ĐANG gọi

Đây không phải đề xuất. Đây là `src/api/endpoints.ts` của frontend, đã chạy, đã có test.
Backend nào không phục vụ đúng những đường này thì frontend không chạy.

Tiền tố chung: `API_BASE_PATH = /api`.

| Nhóm | Đường | Ghi chú |
|---|---|---|
| **auth** | `POST /auth/login` · `POST /auth/register` | hai đường duy nhất người chưa đăng nhập gọi |
| **projects** | `GET/POST /projects` · `GET/PATCH/DELETE /projects/{id}` | |
| **floors** | `GET/POST /floors` · `DELETE /floors/{id}` · `POST /floors/reorder` | |
| **drawings** | `POST /projects/{p}/floors/{f}/drawings/uploads` · `PUT …/uploads/{u}/chunks` · `POST …/complete` · `GET …/progress` | tải lên theo mảnh |
| **quality** | `…/quality/assess` · `…/corners` · `…/straighten` | **Bước 1 của pipeline** |
| **spatial** | `…/spatial/floor` · `…/layer` · `…/version` | **đầu ra của cả pipeline** |
| **measurements** | `GET/POST /projects/{p}/measurements` · `DELETE …/{id}` | |
| **library** | `GET /library` · `GET /library/{id}` | thư viện `.glb` |
| **propertyTemplates** | `GET/POST /projects/{p}/property-templates` | |
| **users** | `GET /users` · `…/{id}/role` · `/disable` · `/enable` · `/activity` · `/memberships` · `DELETE …/{id}` · `POST /users/invitations` · `…/{id}/resend` | |
| **notifications** | `GET /notifications` · `/read` · `/read-all` · `…/{id}/accept-invite` · **`GET /notifications/stream`** | `stream` là kênh đẩy |
| **featureFlags** | `GET /feature-flags` | |

**Bốn nhóm đầu là đường sống của sản phẩm** — không có chúng thì không tải được bản vẽ nào
lên. Bảy nhóm sau là quản trị và tiện ích.

---

## 0.5 — Luật vàng của cả bộ (vi phạm là dừng phiên)

Bốn luật đầu là kiến trúc — chúng **mượn** từ `DraftVision.AI` nếu bạn chốt mượn ở mục 0.2,
và nên được giữ kể cả khi dựng lại từ đầu. Phần còn lại là ràng buộc đo được từ frontend
đang chạy.

**Kiến trúc**

1. **Chiều phụ thuộc một chiều:** `api → services → pipeline → adapters → schema`. Ép bằng
   `uv run lint-imports`. Nhập ngược là lint đỏ, không phải chuyện phong cách.
2. **`schema` không nhập gì từ tầng trên.** Hợp đồng thứ hai của `.importlinter`.
3. **Một nguồn schema duy nhất.** Sửa hình dạng dữ liệu nghĩa là sửa
   `packages/schema/spatial.schema.json` rồi chạy `make codegen`. **Cấm sửa tay**
   `pydantic/spatial.py` hoặc `zod/spatial.ts` — `check_schema_parity.py` sẽ bắt.
4. **Mô hình AI nằm sau `adapters`.** `pipeline` gọi một giao diện, không gọi thẳng
   `ultralytics`, `paddleocr` hay `transformers`. Đổi mô hình không được làm đổi `services`.
5. **Không tầng nào nhập `apps.frontend`.** `.importlinter` không diễn đạt được ràng buộc
   này (nó không phải gói Python) — nên nó là luật đọc bằng mắt, và phải được nêu trong mọi
   phiên.

**Dữ liệu**

6. **Đơn vị là milimét nguyên** cho mọi chiều dài hình học. Quy đổi mm ↔ m chỉ xảy ra ở
   biên trình bày, một chỗ, có tên.
7. **Độ tin cậy luôn đi kèm nguồn.** Mọi thực thể mang `confidence` và `source_pipeline`.
8. **Máy không bao giờ tự nhận là đã có người duyệt.** Đầu ra AI không được đặt cờ duyệt —
   bất biến A5 của frontend, và frontend **đã ép nó ở biên** (`src/api/schemas/spatial.ts`
   từ chối payload nói `{source:'ai', reviewed:true}`). Backend phải không bao giờ gửi thứ ấy.
9. **Độ dày tường sau chuẩn hoá chỉ nhận bốn giá trị:** 110, 220, 330 mm, hoặc cột BTCT.
10. **Ngưỡng tin cậy 0,75.** Dưới ngưỡng là "cần chú ý", không phải "bỏ đi".

**Quy trình**

11. **Thiếu thông tin thì DỪNG và hỏi.** Không stub, không `TODO`, không bịa một hằng số.
12. **Không báo "đạt" cho bước chưa chạy.** Dán kết quả nguyên văn, kể cả khi đỏ.

---

## 0.6 — Khung 10 khối của mỗi prompt

```
[1  BỐI CẢNH]        — năng lực này phục vụ ai, đứng ở tầng nào
[2  ĐÃ CÓ GÌ]        — module, hàm, schema được phép gọi lại, kèm đường dẫn thật
[3  ĐỌC FILE NÀO]    — danh sách file phải đọc trước khi viết
[4  HỢP ĐỒNG]        — chữ ký hàm, hình dạng dữ liệu vào/ra, mã lỗi
[5  THUẬT TOÁN]      — các bước, kèm công thức và ngưỡng có số
[6  ĐƯỜNG HỎNG]      — đầu vào xấu nào phải xử lý, và xử lý ra sao
[7  CẤM TUYỆT ĐỐI]   — hợp của cấm kiến trúc và cấm dữ liệu
[8  DELIVERABLES]    — file sinh ra, test đi kèm
[9  NGHIỆM THU]      — lệnh chạy + số để đối chiếu
[10 KHÔNG ĐƯỢC SỬA]  — khoá cứng phần đã có
```

Khối 2 chống viết lại thứ đã có. Khối 6 là khối quan trọng nhất của một hệ AI: đầu vào của
nó là ảnh chụp bằng điện thoại, và **đường hỏng là đường thường**. Khối 9 chống "xanh mà sai".

---

## 0.7 — Cấu trúc thư mục: clean architecture, bốn vòng

Bộ này dựng backend **từ số 0**, nên cấu trúc thư mục là thứ phải chốt trước prompt đầu tiên.
Bốn vòng, phụ thuộc chỉ đi từ ngoài vào trong — không bao giờ ngược lại.

```
apps/backend/
├── pyproject.toml            uv · ruff · mypy strict · pytest · hypothesis · mutmut
├── alembic.ini
├── .importlinter             bốn hợp đồng ép chiều phụ thuộc bằng máy
└── src/digitizer/
    ├── domain/               VÒNG 1 — không nhập gì, kể cả pydantic
    │   ├── units/            Millimetres, Metres, SquareMetres, Degrees, Pixels
    │   ├── geometry/         Point, Segment, BoundingBox, Polygon
    │   ├── spatial/          Building, Level, Wall, Opening, Room, Furniture, Axis,
    │   │                     Dimension, SpatialGraph, EntityId, ReviewMetadata
    │   └── rules/            sổ đăng ký luật không gian + bộ chạy luật
    │
    ├── application/          VÒNG 2 — nhập domain và ports, không nhập adapter
    │   ├── ports/            giao diện: repository, lưu trữ, mô hình AI, hàng đợi
    │   └── usecases/         một lớp = một việc nghiệp vụ
    │
    ├── adapters/             VÒNG 3 — hiện thực ports
    │   ├── persistence/      SQLAlchemy model + migration
    │   ├── storage/          S3/MinIO
    │   ├── vision/           OpenCV: canny, contours, warp, distanceTransform, skeleton
    │   ├── models/           SegFormer · YOLOv8 · PaddleOCR
    │   └── messaging/        hàng đợi việc nền, kênh sự kiện
    │
    ├── api/                  VÒNG 4 — FastAPI router, DTO, xử lý lỗi
    │   ├── routers/          một tệp một nhóm endpoint
    │   ├── dto/              hình dạng đi trên dây
    │   └── errors.py
    │
    └── config/               pydantic-settings, nhật ký, request-id
```

**Chiều phụ thuộc, ép bằng `uv run lint-imports`:**

```
api → adapters → application → domain
domain → (không gì cả)
```

Bốn hợp đồng của `.importlinter`:

1. **Tầng:** `api → adapters → application → domain`.
2. **`domain` không nhập gì ngoài thư viện chuẩn.** Không pydantic, không SQLAlchemy, không
   OpenCV. Đây là luật đắt nhất và cũng đáng nhất: nó làm mọi luật nghiệp vụ test được mà
   không cần cơ sở dữ liệu, không cần GPU, không cần một tấm ảnh nào.
3. **`application` không nhập `adapters`.** Nó nhập `ports`. Đổi Postgres sang thứ khác, đổi
   YOLOv8 sang YOLOv11, không được làm đổi một dòng nào trong `usecases`.
4. **Không tầng nào nhập `apps.frontend`.**

> **Vì sao `domain` cấm cả pydantic.** Pydantic là thư viện *hợp đồng dây* — nó tồn tại để
> kiểm dữ liệu đi vào và đi ra khỏi tiến trình. Một `Wall` trong `domain` không đi ra khỏi
> tiến trình; nó là một khái niệm. Trộn hai thứ ấy thì mỗi lần đổi hình dạng JSON sẽ kéo theo
> một lần đổi luật nghiệp vụ, và đó đúng là thứ clean architecture tồn tại để chặn.

---

## 0.8 — Bảng 60 prompt, bảy chặng, xây từ entity ra controller

| Mã | Tên | Vòng |
|---|---|---|
| **Chặng 0 — nền dự án (8 prompt)** | | |
| BE-01 | Khởi tạo repo: uv, `pyproject.toml`, Python 3.12, cây thư mục bốn vòng | — |
| BE-02 | Bốn hợp đồng `.importlinter`, kèm bài kiểm âm chứng minh từng hợp đồng cắn | — |
| BE-03 | Cổng chất lượng: ruff, mypy strict, pytest, hypothesis, mutmut, ngưỡng phủ theo tầng | — |
| BE-04 | Cấu hình và bí mật: `pydantic-settings`, `.env.example`, 12-factor | config |
| BE-05 | Nhật ký có cấu trúc, `request-id`, và **phân loại lỗi khớp frontend** | config |
| BE-06 | Hạ tầng cục bộ: `docker-compose` (Postgres, Redis, MinIO), `justfile` | — |
| BE-07 | CI: năm job độc lập, một lượt cho năm phán quyết | — |
| BE-08 | Bộ mẫu chuẩn dùng chung và dữ liệu gieo | — |
| **Chặng 1 — entity và value object (9 prompt)** | | |
| BE-09 | Value object đơn vị, kiểu có nhãn, quy đổi một chiều | domain |
| BE-10 | Value object hình học: `Point`, `Segment`, `BoundingBox`, `Polygon` | domain |
| BE-11 | Nhận dạng và soát duyệt: `EntityId` có tiền tố, `ReviewMetadata`, `SourcePipeline` | domain |
| BE-12 | `Building`, `Level`: cao độ, thứ tự tầng, tỷ lệ theo tầng | domain |
| BE-13 | `Wall`: trục tường, độ dày, loại kết cấu | domain |
| BE-14 | `Opening`: cửa đi, cửa sổ, chiều mở, ngưỡng cửa | domain |
| BE-15 | `Room` và `Furniture`: đường bao, công năng, hộp bao, góc xoay | domain |
| BE-16 | `Axis` và `Dimension`: lưới trục, chuỗi kích thước | domain |
| BE-17 | Tập hợp `SpatialGraph` và bất biến của nó | domain |
| **Chặng 2 — luật miền (5 prompt)** | | |
| BE-18 | Quy đổi đơn vị, bắt điểm, so sánh gần đúng | domain |
| BE-19 | Dò phòng từ chu trình khép kín, tính diện tích, phân loại công năng | domain |
| BE-20 | Chuẩn hoá độ dày: bộ lọc làm tròn 110 / 220 / 330 / cột BTCT | domain |
| BE-21 | Sổ đăng ký luật không gian và bộ chạy luật | domain |
| BE-22 | Kiểm toàn vẹn đồ thị: tham chiếu mồ côi, đường bao hỏng, trùng mã | domain |
| **Chặng 3 — hợp đồng dây (3 prompt)** | | |
| BE-23 | `spatial.schema.json` — **chọn một trong ba hình dạng ở mục 0.3** | schema |
| BE-24 | Sinh mã pydantic + zod từ một nguồn, canh trôi trong CI | schema |
| BE-25 | Ánh xạ hai chiều entity ↔ DTO, và chỗ duy nhất được quy đổi đơn vị | api/dto |
| **Chặng 4 — cổng ra và bộ nối (9 prompt)** | | |
| BE-26 | Giao diện `ports`: repository, lưu trữ, mô hình, hàng đợi | application |
| BE-27 | Bộ nối Postgres: SQLAlchemy model, migration, giao dịch | adapters |
| BE-28 | Bộ nối lưu trữ đối tượng: bản vẽ gốc, ảnh đã nắn, mặt nạ | adapters |
| BE-29 | Giao diện mô hình AI: `segment`, `detect`, `read_text` — và vì sao chỉ ba | application |
| BE-30 | Bộ nối SegFormer MIT-B3 | adapters |
| BE-31 | Bộ nối YOLOv8m, tám lớp nhãn | adapters |
| BE-32 | Bộ nối PaddleOCR + Otsu, cắt vùng quan tâm | adapters |
| BE-33 | Bộ nối OpenCV: Canny, contours, warp, `distanceTransform`, Zhang-Suen, Douglas-Peucker | adapters |
| BE-34 | Bộ nối hàng đợi việc nền và kênh sự kiện đẩy | adapters |
| **Chặng 5 — use case (12 prompt)** | | |
| BE-35 | Xác thực, phiên, làm mới, ba vai | application |
| BE-36 | Dự án: tạo, đọc, sửa, xoá, danh sách | application |
| BE-37 | Tầng: tạo, xoá, sắp lại thứ tự | application |
| BE-38 | Tải bản vẽ theo mảnh: khởi tạo, mảnh, hoàn tất, tiến trình | application |
| BE-39 | **Bước 1** — tiền xử lý và nắn phối cảnh | application |
| BE-40 | **Bước 2** — nhận diện tường, rút xương, đo độ dày cục bộ | application |
| BE-41 | **Bước 3** — nhận diện cửa và nội thất | application |
| BE-42 | **Bước 4** — đọc kích thước và định chuẩn tỷ lệ | application |
| BE-43 | **Bước 5** — chuẩn hoá độ dày tường | application |
| BE-44 | **Bước 6** — dựng Spatial JSON, mỏ neo đa tầng | application |
| BE-45 | Điều phối pipeline: sáu bước, tiến trình, thử lại, bù trừ | application |
| BE-46 | Phiên bản, đo, thư viện, khuôn mẫu, người dùng, thông báo | application |
| **Chặng 6 — controller (10 prompt)** | | |
| BE-47 | Ứng dụng FastAPI: prefix `/api`, middleware, xử lý lỗi thống nhất | api |
| BE-48 | `auth` — 2 đường | api |
| BE-49 | `projects` + `floors` — 9 đường | api |
| BE-50 | `drawings` — 4 đường | api |
| BE-51 | `quality` — 3 đường | api |
| BE-52 | `spatial` — 3 đường | api |
| BE-53 | `measurements` + `propertyTemplates` — 5 đường | api |
| BE-54 | `library` + `featureFlags` — 3 đường | api |
| BE-55 | `users` — 9 đường | api |
| BE-56 | `notifications` + `stream` — 5 đường | api |
| **Chặng 7 — nghiệm thu (4 prompt)** | | |
| BE-57 | Bài kiểm hợp đồng: 43 endpoint đối chiếu với frontend thật | — |
| BE-58 | Đi hết một lượt đầu-cuối, không bước nào dùng dữ liệu giả | — |
| BE-59 | Hiệu năng và quan sát được: thời gian mỗi bước, hàng đợi, GPU | — |
| BE-60 | Bàn giao: README, runbook, sổ nợ kỹ thuật | — |

**Vì sao thứ tự này chứ không phải theo tính năng.** Bản nháp đầu của bảng này chia theo tính
năng — "tải lên", "pipeline", "API" — và nó sai ở một chỗ căn bản: **một tính năng cắt ngang
cả bốn vòng**, nên mỗi prompt sẽ phải chạm `domain`, `application`, `adapters` và `api` cùng
lúc. Làm vậy thì không prompt nào kiểm được riêng, và ranh giới mà `.importlinter` ép sẽ bị
phá ngay ở prompt thứ ba.

Đi từ trong ra ngoài thì mỗi prompt chỉ chạm **một vòng**, kiểm được bằng bài kiểm của chính
vòng ấy, và vòng ngoài luôn có sẵn thứ nó cần.

**Đường sống ngắn nhất** — bỏ chặng 7 và vài nhóm API phụ, còn **41 prompt**:
BE-01…08 · 09…17 · 18…22 · 23…25 · 26…28 và 33 · 35…40, 42…45 · 47…52.
Hết đường ấy là frontend chạy được với dữ liệu thật.

---

## 0.9 — Bộ dữ liệu mẫu chuẩn, dùng chung mọi prompt

Cùng bộ số mà frontend đang dùng, để một người kiểm đi từ BE sang FE thấy **cùng một công
trình**. Số lấy từ `createSampleBuilding()` của frontend, đã **đo** chứ không chép:

| Hạng mục | Giá trị |
|---|---|
| Dự án mẫu | Toà nhà HQ Renovation |
| Tầng | 4 — cao độ −3,0 / 0,0 / 3,9 / 7,5 m |
| Tường | 48 |
| Ô mở | **16** — 9 cửa đi, 7 cửa sổ |
| Đồ đạc | **21** |
| Phòng | 14 |
| Trục | 4 |
| Chuỗi kích thước OCR | 34 |
| Tỷ lệ | 12 mm/px (4800 mm ÷ 400 px) |
| Ảnh sau nắn | 3000 × 3000 px |
| Mã lỗi mẫu | SEG-2041 · yêu cầu 8f2a-41 |

> **Đính chính so với đặc tả nghiên cứu và bộ FE v2.3.** Cả hai ghi "21 đối tượng — 9 cửa
> đi, 7 cửa sổ, 5 nội thất". Tổng 9+7+5 đúng bằng 21 nên con số **tổng** thì trùng, nhưng
> trùng do số học: trong fixture, 21 là số **đồ đạc**, còn 9 cửa + 7 cửa sổ là **16 ô mở** —
> một đại lượng thứ ba mà cả hai tài liệu không nhắc. Đừng dùng "5 nội thất".
>
> Về tổng diện tích: hằng số khai `248,60 m²`, nhưng đo bằng công thức dây giày trên 14
> đường bao thật ra **238,00 m²** (một phòng khai `areaM2` 27,60 nhưng đường bao của nó là
> 4000×4250 mm, tức 17,00). **Chưa chốt cái nào đúng** — xem `CLAUDE.md` mục A14 của
> frontend. Prompt nào cần con số này phải hỏi, không được chọn bừa.

---

## 0.10 — Sáu tên bước pipeline, đúng nguyên văn

Frontend hiện đúng sáu chuỗi này trên màn tiến trình. Backend phát ra tên bước nào thì
frontend hiện tên ấy — lệch một chữ là lệch trên màn:

```
1. Tiền xử lý ảnh
2. Nhận diện tường (SegFormer)
3. Nhận diện cửa và nội thất (YOLOv8)
4. Đọc kích thước (PaddleOCR)
5. Chuẩn hoá độ dày tường
6. Dựng Spatial JSON
```

---

# PHẦN 1 — Ba khối dán đầu mỗi phiên

Cách dùng giống bộ FE: mở phiên mới → dán `BE-ARCH` → dán `BE-FAIL` → dán `BE-CONTRACT`
→ dán đúng **một** prompt `BE-xx`. Một phiên = một prompt.

Giống cách bộ FE dùng DS-00 / KNOWN FAILURE MODES / DS-BIND.

### Khối 1 — BE-ARCH: ràng buộc kiến trúc

```
ARCHITECTURE BINDING — backend đã có khung, chưa có thịt.

Chiều phụ thuộc, ép bằng `uv run lint-imports` từ apps/backend/:
    digitizer.api → digitizer.services → digitizer.pipeline
                  → digitizer.adapters → digitizer.schema

- `schema` là tầng đáy, không nhập gì từ trên.
- Mô hình AI nằm sau `adapters`. `pipeline` gọi giao diện, không gọi thẳng
  ultralytics / paddleocr / transformers.
- Không tầng nào nhập `apps.frontend`.
- Hình dạng dữ liệu sửa ở `packages/schema/spatial.schema.json` rồi `make codegen`.
  CẤM sửa tay pydantic/spatial.py hay zod/spatial.ts.

Đã có và KHÔNG được dựng lại:
  .importlinter · packages/schema/{spatial.schema.json,pydantic,zod}
  qa/scripts/{check_complexity,check_ci_duration,check_version_parity}.py
  hạ tầng test: pytest, hypothesis (property-based), mutmut (mutation)

Xác nhận đã hiểu bằng đúng dòng này trước khi viết mã:
Architecture binding acknowledged — adapters hide the models, schema has one source
```

### Khối 2 — BE-FAIL: những cách hệ này hỏng

```
KNOWN FAILURE MODES — đầu vào là ảnh chụp bằng điện thoại. Đường hỏng là đường thường.

1. Ảnh nghiêng, méo, chụp xiên → Bước 1 phải nắn; không nắn được thì TỪ CHỐI, không đoán.
2. Không tìm được khung giấy 4 góc → không có gì để nắn. Nói ra, đừng dùng cả khung ảnh.
3. SegFormer trả mặt nạ đứt nét → tường rách. Rút xương trước khi kết luận.
4. YOLO nhận nhầm ô tô thành giường (cùng là chữ nhật bo góc) → luật ngữ cảnh BE-19.
5. OCR đọc "4800" thành "48OO" → mọi chuỗi số phải kiểm được là số trước khi dùng.
6. Không đọc được đường gióng nào → KHÔNG có tỷ lệ. Trả về "cần hiệu chỉnh tay",
   đừng mặc định 12 mm/px. Frontend có màn S-11 cho đúng việc này.
7. Độ dày tính ra 113,5 mm → làm tròn theo bảng, và GIỮ cả giá trị thô để người duyệt xem.
8. Ảnh không phải bản vẽ (ảnh phòng thật, phối cảnh render, sổ đỏ) → từ chối ở Bước 1.
9. Tầng 2 không có trục A-1 → không căn được. Nói ra, đừng đặt bừa gốc toạ độ.
10. Mô hình chạy 40 giây → không được chặn request. Việc nền + tiến trình là BE-20.
```

### Khối 3 — BE-CONTRACT: hợp đồng với frontend

```
Frontend ĐÃ TỒN TẠI và đang chạy. Nó không đợi backend để được sửa.

- 43 endpoint trong 12 nhóm nó gọi nằm ở AppFront/src/api/endpoints.ts. Đó là danh sách nghĩa vụ.
- Hình dạng nó mong đợi nằm ở AppFront/src/api/schemas/. Lượt trả về KHÔNG khớp
  sẽ bị `decode()` từ chối và hiện thành câu lỗi tiếng Việt, không phải màn vỡ.
- Sáu tên bước pipeline phải đúng nguyên văn (mục 0.9).
- Mọi thực thể mang confidence + source_pipeline.
- KHÔNG BAO GIỜ gửi một thực thể nói vừa do AI sinh vừa đã được người duyệt.
  Frontend từ chối payload ấy ở biên, và nó đúng khi làm vậy.

Backend nào không phục vụ đúng những đường này thì frontend không chạy — và sửa
frontend cho khớp backend là đi ngược, vì frontend đã có 5.900 bài kiểm.
```

---

---

# PHẦN 2 → PHẦN 8 — Thân 60 prompt

Bảy chặng của bảng 0.8, mỗi chặng một phần:

| Phần | Chặng | Prompt |
|---|---|---|
| PHẦN 2 | Chặng 0 — nền dự án | BE-01 → BE-08 |
| PHẦN 3 | Chặng 1 — entity và value object | BE-09 → BE-17 |
| PHẦN 4 | Chặng 2 — luật miền · Chặng 3 — hợp đồng dây | BE-18 → BE-25 |
| PHẦN 5 | Chặng 4 — cổng ra và bộ nối | BE-26 → BE-34 |
| PHẦN 6 | Chặng 5 — use case | BE-35 → BE-46 |
| PHẦN 7 | Chặng 6 — controller | BE-47 → BE-56 |
| PHẦN 8 | Chặng 7 — nghiệm thu | BE-57 → BE-60 |

<!-- THÂN PROMPT ĐƯỢC GHÉP VÀO ĐÂY -->
