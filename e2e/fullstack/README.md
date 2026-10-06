# e2e FE + BE trên compose (F-14)

Một chuỗi Playwright chạy trên trình duyệt thật, nói chuyện với AppBack thật. Chuỗi không dùng mock và không dùng `page.route`. Nó nằm ngoài `pnpm e2e` và ngoài CI của FE.

```sh
pnpm e2e:fullstack
```

Chuỗi gồm các bước: đăng nhập, CSP/Draco, tạo dự án, thêm tầng, tải bản vẽ, pipeline (SSE), sửa tường có tự lưu, 3D, Pascal, phục hồi phiên bản, registry (N23/N25/N27 và N24 qua nút trên màn).

## Biến môi trường

| Biến | Việc |
|---|---|
| `E2E_FULLSTACK_BASE_URL` | Mặc định `http://localhost:8080`. Phải là **`localhost`**, không phải `127.0.0.1`, và phải trùng `PUBLIC_BASE_URL` của BE |
| `E2E_ADMIN_EMAIL` | Admin do `create-admin` tạo (điều kiện 4) |
| `E2E_ADMIN_PASSWORD` | Mật khẩu của admin ấy. Không bao giờ in ra |
| `E2E_DRAWING_PNG` | Đường tới PNG `render_plan(7)` (điều kiện 5). Đặt tên `drawing.png`: tên không đoán ra tầng, nên tệp vào khay "Tệp chưa gán tầng" và chuỗi tự gán nó cho tầng vừa thêm |

Thiếu biến nào thì `globalSetup` dừng ngay và liệt kê đủ các biến thiếu. Nếu BE không trả lời, hoặc CSP ở `GET /` thiếu `'wasm-unsafe-eval'` hay `worker-src blob:`, nó dừng với câu "chưa có AppBack ở …".

## Bảy điều kiện trước (AppBack lo, chuỗi không dựng)

Các lệnh dưới đây **chưa thử** trên máy thật. Chạy chúng từ gốc repo AppBack (`F:/App/AppBack`), trong **Git Bash**. `>` của PowerShell 5.1 ghi ra UTF-16, nên nó làm hỏng tệp PNG.

1. **Ảnh `web` dựng tay từ sha AppFront có đủ F.** `tools/contract/APPFRONT_SHA` đang ghim một bản cũ (F-00c), nên đừng dựng `web` bằng `tools/ci/job.sh build`. Cũng đừng sửa `APPFRONT_SHA`: nâng sha là một việc riêng, phải hỏi trước.

   ```sh
   SHA=<sha AppFront>   # ví dụ efbda6bd hoặc sha của F-14
   deploy/docker/web-context.sh "$SHA" /tmp/appfront-ctx
   docker build --build-context appfront=/tmp/appfront-ctx --build-arg APPFRONT_SHA="$SHA" \
     -t appback-web:"$IMAGE_TAG" -f deploy/docker/web.Dockerfile .
   ```

2. **Tệp compose đè, đặt ngoài repo** (ví dụ `/tmp/f14-override.yml`). `base.yml` và `ci.yml` không chuyển `ML_BACKEND` cho `ml`, và giá trị mặc định là `onnx`. Cờ `scene.pascal-viewer` cũng phải bật cho bước 8b:

   ```yaml
   services:
     ml:
       environment:
         ML_BACKEND: fake
     api:
       environment:
         FEATURE_FLAGS: '{"scene.pascal-viewer": true}'
   ```

3. **Dựng compose**. `ci.yml` đòi biến `IMAGE_TAG`. `env.example` đặt sẵn `PUBLIC_BASE_URL=http://localhost:8080` và `APP_ENV=dev`; `APP_ENV=dev` là giá trị cho phép bộ giả. Nếu `PUBLIC_BASE_URL` lệch, mọi `POST /api/auth/*` trả 403 `ORIGIN_MISMATCH`.

   ```sh
   export IMAGE_TAG=<tag>
   docker compose -f deploy/compose/ci.yml -f /tmp/f14-override.yml \
     --env-file deploy/compose/env.example --profile ml up -d
   ```

   Trình duyệt phải vào `http://localhost:8080`. Nếu vào `web:8080`, trình duyệt bỏ cookie `Secure`.

4. **Admin đầu tiên**. Lệnh này chỉ tạo admin đầu tiên, nên cơ sở dữ liệu phải trắng:

   ```sh
   printf '%s' "$E2E_ADMIN_PASSWORD" | docker compose -f deploy/compose/ci.yml -f /tmp/f14-override.yml \
     --env-file deploy/compose/env.example exec -T api \
     python -m apps.api.auth.cli create-admin --email "$E2E_ADMIN_EMAIL" --name "E2E" --password-stdin
   ```

5. **Bản vẽ `render_plan(7)`** (seed của e2e B5-07). Bộ giả chỉ trả tường cho đúng ảnh này. Chạy trong Git Bash:

   ```sh
   docker compose -f deploy/compose/ci.yml -f /tmp/f14-override.yml --env-file deploy/compose/env.example \
     exec -T ml python -c "import sys; from packages.ml_contracts.synthetic import render_plan; sys.stdout.buffer.write(render_plan(7).image_png)" \
     > /tmp/drawing.png
   export E2E_DRAWING_PNG=/tmp/drawing.png
   ```

6. **Registry seed**. Migration `r20260928_b6_01_ml_registry.py` (dịch vụ `migrate`) seed "Bản gốc" của từng họ ở trạng thái `pending` và kích hoạt sẵn bản ấy. Với `ML_BACKEND=fake`, `ml_eval` đưa bản về `completed`. Chuỗi cần "Bản gốc" của họ "Nhận diện cửa và đồ đạc" ở `completed`, vì bước 10b kích hoạt lại chính bản ấy.

7. **Bản model thứ hai cho họ "Nhận diện cửa và đồ đạc"**, để bước 10b có bản mà bấm "Kích hoạt". Màn F-12 không tự sinh được bản kích hoạt được: huấn luyện cần bộ dữ liệu dựng bằng công cụ dòng lệnh, và trainer luôn là trainer thật. Nạp bản thứ hai bằng N26 (`POST /api/admin/ml/model-versions`, multipart gồm phần `metadata` rồi phần `weights`). Phần `metadata` là `{"checksumSha256", "family": "openingAndFurnitureDetection", "label", "weightsFormat": "onnx"}`, xem `apps/api/admin_ml_registry/upload.py` và `schemas.py:99-109`. Tệp `.onnx` hợp lệ có thể chép từ trọng số của "Bản gốc". N26 cần access token của admin: lấy bằng `POST /api/auth/login` rồi `POST /api/auth/refresh`, cả hai gửi kèm header `Origin: http://localhost:8080`. Tải lên xong, chờ bản mới tới `completed` (bộ giả) rồi mới chạy chuỗi. Nếu thiếu bản này, bước 10 **hỏng** với câu chỉ về điều kiện này.

Sau bước 10b, "Bản gốc" được kích hoạt lại, nên môi trường trở về như trước lượt chạy.

## Đọc kết quả

- Báo cáo HTML nằm ở `playwright-report/fullstack`, đầu ra nằm ở `test-results/fullstack`. Không commit hai thư mục này.
- **Trace** chỉ bật **sau** bước đăng nhập và chỉ được lưu khi chuỗi hỏng (`trace.zip`, đính trong báo cáo HTML). Dù vậy, trace và báo cáo HTML vẫn chứa cookie phiên và access token. Vì thế chỉ dùng tài khoản e2e riêng, và đừng đính trace vào báo cáo hay vào `FIX.md`. Để mở trace: `pnpm exec playwright show-trace test-results/fullstack/<thư mục>/trace.zip`.
- Lỗi `/api/` được in đủ danh sách trước khi chuỗi ném, mỗi dòng gồm method, đường, status, `code` và `requestId`. Chỉ một trường hợp được bỏ qua: `POST /api/auth/refresh` 401 trước lượt đăng nhập.
