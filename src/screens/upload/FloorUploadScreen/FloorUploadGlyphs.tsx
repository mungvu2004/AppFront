/**
 * Hai hình vẽ tay của màn tải bản vẽ.
 *
 * Cả hai là SVG viết thẳng trong mã, không phải tệp ảnh: đặc tả đòi biểu tượng
 * 32px "tự vẽ lúc gắn vào", và một `<img>` thì phải đợi mạng trước khi vùng thả
 * trông ra hình gì. Nét được vẽ dần bằng `animate-empty-icon-draw` — hoạt ảnh
 * đã khai trong `tailwind.config.ts`, nên không có thời lượng nào viết ở đây.
 *
 * Cả hai đều `aria-hidden`: chúng lặp lại điều dòng chữ bên cạnh đã nói, và một
 * hình trang trí có tên riêng chỉ làm trình đọc màn hình đọc thừa (A12).
 */

/** Độ dài nét dùng cho hiệu ứng vẽ dần; khớp `empty-icon-draw` trong cấu hình Tailwind. */
const STROKE_DASH = 100;

/** Mũi tên vào khay — biểu tượng 32px của vùng kéo thả. */
export function UploadGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8 text-text-secondary"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path
        className="animate-empty-icon-draw"
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
        style={{ strokeDasharray: STROKE_DASH }}
      />
      <path
        className="animate-empty-icon-draw"
        d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
        style={{ strokeDasharray: STROKE_DASH }}
      />
    </svg>
  );
}

/**
 * Ô xem trước 96×72 của một thẻ tầng.
 *
 * Máy chủ chưa trả ảnh xem trước của bản vẽ (`Drawing` không có trường ảnh), nên
 * ô này vẽ một tờ giấy có nếp gấp thay vì để trống — chỗ giữ hình có hình dạng,
 * không phải một khoảng xám không nói gì.
 */
export function SheetGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7 text-text-muted"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 24 24"
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
