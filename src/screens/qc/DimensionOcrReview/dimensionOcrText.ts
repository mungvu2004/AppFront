/**
 * Mọi chuỗi cố định người dùng đọc của màn "Đọc kích thước OCR", đúng một chỗ.
 *
 * Chuỗi ghép theo số thì ở những hàm dưới. Khoá i18n tương ứng nằm ở
 * `.orca-notes/S14-T4-i18n.fragment.json` để T8 đưa vào `src/i18n/vi.json`.
 */

/**
 * Bộ đếm duyệt thành câu — "18/34 kích thước đã duyệt".
 * Mọi con số đã được định dạng theo A15 bên ngoài.
 */
export const reviewProgressLabel = (reviewed: string, total: string): string =>
  `${reviewed}/${total} kích thước đã duyệt`;

/**
 * Câu liên kết suy ra — "Gắn với #W-014".
 * Mã tường là mã hiển thị dạng #W-NNN.
 */
export const wallReferenceLabel = (wallCode: string): string => `Gắn với ${wallCode}`;

/**
 * Mô tả ảnh cắt vùng gốc cho trình đọc màn hình.
 * Mã kích thước là mã hiển thị của chuỗi kích thước.
 */
export const dimensionImageAlt = (dimensionCode: string): string =>
  `Cắt vùng gốc của chuỗi kích thước ${dimensionCode}`;

/**
 * Dải so sánh dính đáy, ba giá trị đã định dạng sẵn.
 * Hàm chỉ ghép chữ quanh ba chuỗi, không tính lệch hay quy đổi.
 */
export const comparisonLine = (
  readValue: string,
  measuredValue: string,
  deviationPercent: string,
): string =>
  `So sánh với hình học: chuỗi đọc được ${readValue} · đo từ bản vẽ ${measuredValue} · lệch ${deviationPercent}`;

/**
 * Mô tả hành động khi nhận giá trị bất thường.
 * Con số mô tả đã được định dạng sẵn; hàm không tính toán gì.
 */
export const outlierHint = (description: string): string =>
  `Giá trị này hàm ý phòng dài bất thường: ${description}. Kiểm tra lại sao cho phù hợp với bản vẽ.`;

/** Nhãn nút duyệt — "Duyệt kích thước này". */
export const approveActionLabel = 'Duyệt kích thước này';

/** Nhãn nút bỏ qua — "Bỏ qua". */
export const skipActionLabel = 'Bỏ qua';

/** Nhãn trên nút mở chế độ duyệt bàn phím. */
export const keyboardModeToggleLabel = 'Bật chế độ duyệt bàn phím';

/** Nhãn trên nút đóng chế độ duyệt bàn phím. */
export const keyboardModeToggleClosedLabel = 'Tắt chế độ duyệt bàn phím';

/** Gợi ý cho người dùng biết R bật chế độ duyệt. */
export const keyboardModeShortcutHint = 'Hoặc bấm R để bật';

/** Caption chỉ ra chế độ duyệt bàn phím là đường nhanh nhất. */
export const keyboardModeCaption =
  'Chế độ duyệt bàn phím — đường nhanh nhất để đi qua danh sách kích thước';

/** Nhãn phím Enter. */
export const keyEnterLabel = 'Enter';

/** Mô tả hành động Enter: lưu và nhảy dòng sau. */
export const keyEnterDescription = 'lưu và nhảy dòng sau';

/** Nhãn phím Tab. */
export const keyTabLabel = 'Tab';

/** Mô tả hành động Tab: sang cột sau. */
export const keyTabDescription = 'sang cột sau';

/** Nhãn phím Esc. */
export const keyEscLabel = 'Esc';

/** Mô tả hành động Esc: bỏ sửa. */
export const keyEscDescription = 'bỏ sửa';

/** Nhãn phím R. */
export const keyRLabel = 'R';

/** Mô tả hành động R: bật chế độ duyệt bàn phím. */
export const keyRDescription = 'bật chế độ duyệt bàn phím';

/** Nhãn của đơn vị cố định: "mm". */
export const unitLabel = 'mm';

/** Nhãn bộ lọc: "tất cả". */
export const filterAllLabel = 'tất cả';

/** Nhãn bộ lọc: "độ tin cậy thấp". */
export const filterLowConfidenceLabel = 'độ tin cậy thấp';

/** Nhãn bộ lọc: "chưa duyệt". */
export const filterUnreviewedLabel = 'chưa duyệt';

/**
 * Câu lọc cho trạng thái một phần, khi OCR mới xong một phần bản vẽ.
 * Số mục đã được định dạng sẵn.
 */
export const lowConfidencePartialNotice = (count: string): string =>
  `${count} mục dưới ngưỡng tin cậy, đã lọc sẵn`;

/** Nhãn aria của canvas: "Bản vẽ lớp kích thước OCR". */
export const canvasAriaLabel = 'Bản vẽ lớp kích thước OCR';

/** Nhãn aria của danh sách kích thước. */
export const dimensionListAriaLabel = 'Danh sách kích thước đọc được';

/** Nhãn aria của ô nhập từng hàng. */
export const dimensionRowInputAriaLabel = (dimensionCode: string): string =>
  `Giá trị kích thước ${dimensionCode}`;

/** Nhãn aria của thanh so sánh. */
export const comparisonBarAriaLabel = 'Thanh so sánh với hình học';

/** Nhãn aria của nút duyệt. */
export const approveButtonAriaLabel = (dimensionCode: string): string =>
  `Duyệt kích thước ${dimensionCode}`;

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái của màn.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Trạng thái 1: Rỗng — OCR không đọc được kích thước nào.
 *
 * Tiêu đề + mô tả phải GIẢI THÍCH và DẪN người dùng sang hiệu chỉnh tỷ lệ thủ công.
 * Kèm nhãn nút dẫn sang đó.
 */
export const DIMENSION_OCR_EMPTY_STATE = {
  title: 'chưa đọc được chuỗi kích thước nào',
  description:
    'Chuỗi kích thước trên bản vẽ có nét mảnh hoặc không rõ, nên OCR không tách được số. Hiệu chỉnh tỷ lệ bằng tay để đo độ dài từ bản vẽ.',
  actionLabel: 'Hiệu chỉnh tỷ lệ',
} as const;

/**
 * Trạng thái 2: Đang tải.
 */
export const DIMENSION_OCR_LOADING_STATE = {
  title: 'đang đọc kích thước',
  description: 'Hệ thống đang nhận diện chuỗi kích thước trên bản vẽ. Đợi một lát…',
} as const;

/**
 * Trạng thái 3: Một phần — 9 mục dưới ngưỡng.
 *
 * Kèm nhãn bộ lọc "chỉ hiện mục cần xem".
 * Biến thể câu cho trường hợp OCR mới xong một phần bản vẽ.
 */
export const DIMENSION_OCR_PARTIAL_STATE = {
  title: 'một phần kích thước đã duyệt',
  descriptionComplete: (count: string): string =>
    `${count} chuỗi dưới ngưỡng tin cậy. Bấm "Chỉ hiện mục cần xem" để xem những chuỗi đó.`,
  descriptionPartialOcr: (count: string): string =>
    `Vừa đọc xong một phần bản vẽ. ${count} chuỗi dưới ngưỡng tin cậy, bộ lọc đã chỉnh sẵn.`,
  filterHintLabel: 'Chỉ hiện mục cần xem',
} as const;

/**
 * Trạng thái 4: Lỗi.
 * Kèm nhãn nút thử lại.
 */
export const DIMENSION_OCR_ERROR_STATE = {
  title: 'không đọc được kích thước',
  description: 'Hệ thống gặp lỗi khi xử lý bản vẽ. Thử lại để chạy lại bước này.',
  actionLabel: 'Thử lại',
} as const;

/**
 * Trạng thái 5: Xong — 34/34 kích thước.
 */
export const DIMENSION_OCR_DONE_STATE = {
  title: 'tất cả kích thước đã duyệt',
  description: 'Mọi chuỗi kích thước trên bản vẽ đã kiểm tra xong.',
} as const;

/**
 * Trạng thái 6: Không có quyền.
 */
export const DIMENSION_OCR_FORBIDDEN_STATE = {
  title: 'không có quyền duyệt kích thước',
  description:
    'Vai trò hiện tại chỉ được xem, không được chỉnh sửa lớp kích thước OCR. Liên hệ quản trị dự án nếu cần.',
} as const;

/**
 * Trạng thái 7: Thu gọn.
 */
export const DIMENSION_OCR_COLLAPSED_STATE = {
  title: 'bảng duyệt đang thu gọn',
  description: 'Bung bảng để xem danh sách kích thước và chỉnh sửa giá trị.',
} as const;

/**
 * Mọi chuỗi cố định người dùng đọc (không sử dụng i18n động).
 */
export const DIMENSION_OCR_TEXT = {
  screen: {
    title: 'đọc kích thước OCR',
    canvasAriaLabel,
    dimensionListAriaLabel,
    comparisonBarAriaLabel,
  },
  panel: {
    title: 'Kích thước đọc được',
    unitLabel,
  },
  filter: {
    ariaLabel: 'Lọc theo trạng thái duyệt',
    allLabel: filterAllLabel,
    lowConfidenceLabel: filterLowConfidenceLabel,
    unreviewedLabel: filterUnreviewedLabel,
  },
  row: {
    approveLabel: approveActionLabel,
    skipLabel: skipActionLabel,
    imageAltPrefix: 'Cắt vùng gốc của chuỗi kích thước ',
    inputAriaLabelPrefix: 'Giá trị kích thước ',
    approveButtonAriaLabelPrefix: 'Duyệt kích thước ',
  },
  comparisonBar: {
    ariaLabel: comparisonBarAriaLabel,
  },
  keyboard: {
    caption: keyboardModeCaption,
    toggleOnLabel: keyboardModeToggleLabel,
    toggleOffLabel: keyboardModeToggleClosedLabel,
    shortcutHint: keyboardModeShortcutHint,
    keys: {
      enter: { label: keyEnterLabel, description: keyEnterDescription },
      tab: { label: keyTabLabel, description: keyTabDescription },
      esc: { label: keyEscLabel, description: keyEscDescription },
      r: { label: keyRLabel, description: keyRDescription },
    },
  },
  states: {
    empty: DIMENSION_OCR_EMPTY_STATE,
    loading: DIMENSION_OCR_LOADING_STATE,
    partial: DIMENSION_OCR_PARTIAL_STATE,
    error: DIMENSION_OCR_ERROR_STATE,
    done: DIMENSION_OCR_DONE_STATE,
    forbidden: DIMENSION_OCR_FORBIDDEN_STATE,
    collapsed: DIMENSION_OCR_COLLAPSED_STATE,
  },
} as const;
