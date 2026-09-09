/**
 * Phần KHÔNG phải JSX của lớp phủ cộng tác: mẫu gạch chéo cho đối tượng đang bị
 * khoá, hai token màu trung tính, và mấy số bố cục của con trỏ người khác.
 *
 * ## Vì sao gạch chéo phải làm bằng `<pattern>` chứ không bằng class Tailwind
 *
 * Bảng màu của repo gán màu bằng `var(--token)` TRẦN, không đi qua công thức có
 * `<alpha-value>` mà Tailwind cần để hiểu bộ khớp opacity. Nên cả
 * `bg-state-attention/6` lẫn `bg-opacity-6` **biên dịch ra rỗng** — lớp không
 * xuất hiện trong CSS build ra, hover trên nút hành động của
 * `InlineAlert.tsx:71-73` hôm nay không đổi màu gì cả vì đúng lỗi này. Đó là kết
 * quả đo thật trên chính repo này, không phải suy đoán.
 *
 * Tiền lệ đã chạy được nằm ngay trong một thư mục màn khác —
 * `src/screens/qc/WallLayerReview/wallLayerHatch.ts:113-131` — và cách làm được
 * chép nguyên: một `<pattern>` SVG xoay `rotate(45)`, cạnh ô lát 12px, nét 2px,
 * và độ mờ 6% gán bằng **thuộc tính `opacity` inline** trên chính phần tử SVG,
 * một hằng số có tên, không phải một class `opacity-*`.
 *
 * Hằng số ở đây là bản RIÊNG của màn này, cố ý không nhập chéo từ thư mục màn
 * kia: hai màn không được phụ thuộc vào nhau, và hai bộ tham số được phép rời
 * nhau về sau mà không màn nào phải sửa theo.
 *
 * ## Vì sao KHÔNG BAO GIỜ là một lớp phủ màu
 *
 * Gạch chéo nói "người khác đang sửa cái này". Một lớp phủ MÀU thì nói một
 * trạng thái, và ba màu trạng thái của A4 đã có nghĩa khác hẳn: xanh là việc
 * người duyệt (A5), vàng là "cần xem lại" của P-06, đỏ là VI PHẠM. Một đối
 * tượng người khác đang giữ thì không sai, không cần soát, và chưa được ai xác
 * minh — nên nó không mang màu nào trong ba màu ấy. Đây là cấm tuyệt đối của
 * đặc tả gốc, ghi lại ở đây vì đây là file dễ bị "cải tiến" nhất.
 */

/* -------------------------------------------------------------------------- */
/* Gạch chéo.                                                                  */
/* -------------------------------------------------------------------------- */

/** `id` của `<pattern>`; `fill="url(#…)"` trỏ vào đây. Tiền tố theo tên màn. */
export const PRESENCE_HATCH_PATTERN_ID = 'collaboration-layer-lock-hatch';

/** Cạnh một ô lát, đơn vị người dùng của SVG. */
export const PRESENCE_HATCH_TILE_PX = 12;

/** Nét gạch 2px — cùng tham số với tiền lệ ở `WallLayerReview`. */
export const PRESENCE_HATCH_LINE_WIDTH_PX = 2;

/** Độ mờ 6%. Gạch chéo là dấu hiệu, không phải cảnh báo. */
export const PRESENCE_HATCH_OPACITY = 0.06;

/** Phép quay của mẫu lát, chuỗi dựng sẵn cho `patternTransform`. 45 độ. */
export const PRESENCE_HATCH_PATTERN_TRANSFORM = 'rotate(45)';

/* -------------------------------------------------------------------------- */
/* Hai token màu — cả hai TRUNG TÍNH, và vì sao đúng hai token này.            */
/* -------------------------------------------------------------------------- */

/*
 * Danh sách token BỊ LOẠI, kèm lý do, để lần sau không ai phải đo lại:
 *
 * - `--accent`, `--accent-hover`, `--accent-active`, `--accent-wash`: A2 dành
 *   màu nhấn cho thứ tương tác được, và CHỈ nhờ nó là thứ tương tác được. Con
 *   trỏ của người khác thì không bấm được. (`AvatarProps.presence` hiện dùng
 *   `ring-accent` — mã có sẵn, KHÔNG phải khuôn để chép, nên `presence` không
 *   được bật ở màn này.)
 * - `--state-verified` / `--state-attention` / `--state-violation`: ba màu
 *   trạng thái của A4, mỗi màu đã có nghĩa riêng. Xem đầu file.
 * - `--wall-110` / `--wall-220` / `--wall-330` / `--wall-idle` / `--bg-sunken`:
 *   `SEQUENTIAL_RAMP` của P-06, tức là thang độ tin cậy và thang diện tích.
 *   Đặc tả nói màu con trỏ **không được trùng thang độ tin cậy của P-06**.
 * - `--border-default`: chính là `UNPAINTED_TOKEN` của P-06, nghĩa là "không có
 *   giá trị để tô". Một vòng hiện diện vẽ bằng nó sẽ đọc thành "đối tượng chưa
 *   được tô màu".
 *
 * Còn lại và an toàn: `--text-secondary`, `--text-muted`, `--bg-hover`,
 * `--bg-selected`, `--bg-flash`, `--bg-app`, `--bg-surface`.
 */

/**
 * Nét gạch chéo và biểu tượng khoá — MỘT tông trung tính cho mọi người.
 *
 * Đặc tả cấm bảng màu riêng cho từng người: vòng hiện diện là một tông trung
 * tính duy nhất. Nên đây là một hằng, không phải một hàm nhận `collaboratorId`.
 */
export const PRESENCE_HATCH_TOKEN = 'var(--text-secondary)';

/**
 * Con trỏ của người khác — token chữ NHẠT NHẤT của hệ thiết kế.
 *
 * Đặc tả đòi "rất nhạt". `--text-muted` là bậc nhạt nhất trong ba token chữ và
 * không nằm trong thang nào của P-06.
 */
export const PRESENCE_CURSOR_TOKEN = 'var(--text-muted)';

/* -------------------------------------------------------------------------- */
/* Bố cục con trỏ.                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Cỡ mũi con trỏ, px. Nhỏ hơn con trỏ thật của hệ điều hành để không ai nhầm
 * con trỏ người khác là con trỏ của mình.
 */
export const PRESENCE_CURSOR_SIZE_PX = 16;

/** Bề dày nét của mũi con trỏ và biểu tượng khoá. */
export const PRESENCE_ICON_STROKE = 1.5;

/** Cỡ biểu tượng khoá trong dấu khoá nhỏ, px. */
export const PRESENCE_LOCK_ICON_SIZE_PX = 12;
