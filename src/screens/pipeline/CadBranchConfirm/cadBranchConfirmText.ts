/**
 * Mọi câu tiếng Việt của màn xác nhận nhánh CAD, gom về một chỗ.
 *
 * Không phải bảng dịch lúc chạy — `src/i18n/vi.json` cũng không phải (xem CLAUDE.md).
 * Đây là chỗ hook lấy chuỗi để ghép vào view model, và là bản đối chiếu một-một với
 * khoá `cadBranchConfirm` của `vi.json` mà `expectVietnamese` dùng làm từ điển (R-67).
 */

/** Các thành phần của bảng so sánh hai nhánh. */
export interface ComparisonRowText {
  readonly aspect: string;
  readonly cadBranch: string;
  readonly aiBranch: string;
}

/** Thông tin về các nhãn vai trò lớp trong giai đoạn 2. */
export interface LayerRoleText {
  readonly id: string;
  readonly label: string;
}

/**
 * GIAI ĐOẠN 1 — Hộp thoại lựa chọn nhánh
 */

/** Câu của hộp thoại giai đoạn 1 — màn chỉ đọc trạng thái `normal`. */
export const PHASE_1_DIALOG_STATES = {
  /** Trạng thái bình thường: hộp thoại đầy đủ với lựa chọn hai nhánh. */
  normal: {
    title: 'Phát hiện tệp CAD',
    description:
      'Hồ sơ này có tệp bản vẽ gốc từ AutoCAD hoặc các phần mềm thiết kế khác. Bạn có thể sử dụng đường hình học chính xác từ tệp, hoặc tiếp tục dùng nhánh nhận dạng ảnh để kiểm soát từng bước.',
  },
} as const;

/**
 * Bảng so sánh hai nhánh xử lý — ba khía cạnh chính.
 * Người dùng luôn phải quay về nhánh AI được (A8: mọi thay đổi hoàn tác được).
 */
export const COMPARISON_TABLE: readonly ComparisonRowText[] = [
  {
    aspect: 'Độ chính xác',
    cadBranch: 'Lấy thẳng từ tệp CAD gốc, độ chính xác tuyệt đối.',
    aiBranch:
      'Dựa trên nhận dạng ảnh; cần hiệu chỉnh tỷ lệ và kiểm tra từng chi tiết. Không nhỏ hơn CAD nhưng yêu cầu xác minh.',
  },
  {
    aspect: 'Công việc QC',
    cadBranch:
      'Kiểm tra lớp tường và đối tượng, ánh xạ vào vai trò (tường, cửa, cửa sổ). Nhanh nếu tệp sạch.',
    aiBranch:
      'Kiểm tra tường, cửa, cửa sổ, trục, kích thước. Phạm vi rộng hơn nhưng chi tiết hơn. Thích hợp nếu bạn có thời gian.',
  },
  {
    aspect: 'Thời gian',
    cadBranch: 'Tổng cộng 5–15 phút (phụ thuộc tệp sạch hay không).',
    aiBranch: 'Tổng cộng 20–40 phút (gồm xử lý AI và kiểm tra từng tầng).',
  },
];

/** Tiêu đề bảng tầng trong giai đoạn 1 — nêu rõ tầng nào có CAD, tầng nào không. */
export const FLOOR_TABLE_CAPTION =
  'Các tầng có sẵn tệp CAD sẽ dùng nhánh CAD; các tầng chỉ có ảnh sẽ chạy qua nhận dạng AI.';

/** Nhãn cột "Tầng" trong bảng tầng. */
export const FLOOR_COLUMN_LABEL = 'Tầng';

/** Nhãn cột "Trạng thái CAD" — nêu tầng đó có hay không có tệp CAD. */
export const CAD_STATUS_COLUMN_LABEL = 'Trạng thái CAD';

/** Nhãn khi tầng có tệp CAD. */
export const CAD_STATUS_AVAILABLE = 'Có tệp CAD';

/** Nhãn khi tầng chỉ có ảnh. */
export const CAD_STATUS_IMAGE_ONLY = 'Chỉ có ảnh';

/** Dải cảnh báo khi tệp CAD thiếu khai báo đơn vị. */
export const UNIT_DECLARATION_WARNING_TITLE = 'Tệp CAD thiếu khai báo đơn vị';

export const UNIT_DECLARATION_WARNING_MESSAGE =
  'Tệp bản vẽ không ghi rõ đơn vị (mm, cm, m, inch). Bạn sẽ cần chọn đơn vị thủ công ở bước tiếp theo. Nếu chọn sai, toàn bộ hình học sẽ bị sai tỷ lệ.';

/** Nút chính: dùng đường từ CAD. */
export const PRIMARY_BUTTON_LABEL = 'Dùng đường từ CAD';

/** Nút phụ: tiếp tục với nhánh AI. */
export const SECONDARY_BUTTON_LABEL = 'Vẫn dùng AI';

/** Nút mờ: huỷ bỏ hộp thoại. */
export const DISMISS_BUTTON_LABEL = 'Huỷ';

/** Ô tích: ghi nhớ lựa chọn cho dự án này. */
export const REMEMBER_CHOICE_LABEL = 'Ghi nhớ lựa chọn cho dự án này';

/** Chú thích nhỏ dưới ô tích: nói rõ lựa chọn chỉ sống trong phiên (chưa có API lưu). */
export const REMEMBER_CHOICE_SESSION_NOTE =
  'Lựa chọn chỉ được giữ trong phiên làm việc này, tải lại trang sẽ hỏi lại';

/**
 * GIAI ĐOẠN 2 — Panel ánh xạ lớp
 */

/** Tiêu đề panel ánh xạ lớp. */
export const PHASE_2_PANEL_TITLE = 'Ánh xạ lớp từ tệp CAD';

/** Tiêu đề cột "Tên lớp" trong bảng ánh xạ. */
export const LAYER_NAME_COLUMN = 'Tên lớp';

/** Tiêu đề cột "Số thực thể" — đếm bao nhiêu đối tượng trong lớp. */
export const ENTITY_COUNT_COLUMN = 'Số thực thể';

/** Tiêu đề cột "Màu gốc" — màu của lớp trong tệp CAD. */
export const ORIGINAL_COLOR_COLUMN = 'Màu gốc';

/** Tiêu đề cột "Vai trò" — gán vai trò để xử lý. */
export const LAYER_ROLE_COLUMN = 'Vai trò';

/**
 * Bảy nhãn vai trò lớp, ánh xạ theo định danh tiếng Anh.
 * Bốn vai trò chính + Kích thước + Trục + Bỏ qua.
 */
export const LAYER_ROLES: Readonly<Record<string, LayerRoleText>> = {
  wall: { id: 'wall', label: 'Tường' },
  door: { id: 'door', label: 'Cửa đi' },
  window: { id: 'window', label: 'Cửa sổ' },
  dimension: { id: 'dimension', label: 'Kích thước' },
  grid: { id: 'grid', label: 'Trục' },
  furniture: { id: 'furniture', label: 'Nội thất' },
  ignore: { id: 'ignore', label: 'Bỏ qua' },
};

/** Nhãn khối gấp "Tuỳ chọn nhập" — giúp người dùng điều chỉnh các tham số. */
export const ADVANCED_OPTIONS_LABEL = 'Tuỳ chọn nhập';

/** Nhãn select "Đơn vị bản vẽ" trong phần tuỳ chọn. */
export const DRAWING_UNIT_LABEL = 'Đơn vị bản vẽ';

/** Các tuỳ chọn đơn vị. */
export const DRAWING_UNITS: Readonly<Record<string, string>> = {
  mm: 'Milimét (mm)',
  cm: 'Centimét (cm)',
  m: 'Mét (m)',
  inch: 'Inch',
};

/** Nhãn select "Gốc toạ độ" — chọn vị trí điểm gốc. */
export const COORDINATE_ORIGIN_LABEL = 'Gốc toạ độ';

/** Lựa chọn: giữ nguyên gốc CAD. */
export const ORIGIN_KEEP_CAD = 'Giữ nguyên gốc CAD';

/** Lựa chọn: đặt gốc tại giao trục A-1. */
export const ORIGIN_GRID_A1 = 'Đặt tại giao trục A-1';

/** Nút chính: bắt đầu nhập hình học. */
export const IMPORT_BUTTON_LABEL = 'Nhập hình học';

/** Gợi ý nhẹ khi một lớp chưa gán mà chứa nhiều thực thể — GỢI Ý, KHÔNG PHẢI LỖI CHẶN. */
export const UNASSIGNED_LAYER_HINT =
  'Lớp này chưa gán vai trò nhưng chứa nhiều đối tượng. Nếu bỏ qua, những đối tượng đó sẽ không được nhập.';

/** Caption mức cần chú ý khi người dùng chọn nhánh AI. */
export const AI_BRANCH_NOTICE =
  'Nếu bạn chọn nhánh AI, sẽ cần hiệu chỉnh tỷ lệ sau khi nhập hình học.';

/**
 * Xuất toàn bộ cấu trúc dưới dạng một module duy nhất cho dễ nhập vào view model.
 * Pattern này tuân theo mục B của CLAUDE.md: định danh tiếng Anh, chuỗi tiếng Việt có dấu.
 */
export const CAD_BRANCH_CONFIRM_TEXT = {
  phase1: {
    dialogStates: PHASE_1_DIALOG_STATES,
    comparisonTable: COMPARISON_TABLE,
    floorTableCaption: FLOOR_TABLE_CAPTION,
    floorColumnLabel: FLOOR_COLUMN_LABEL,
    cadStatusColumnLabel: CAD_STATUS_COLUMN_LABEL,
    cadStatusAvailable: CAD_STATUS_AVAILABLE,
    cadStatusImageOnly: CAD_STATUS_IMAGE_ONLY,
    unitDeclarationWarning: {
      title: UNIT_DECLARATION_WARNING_TITLE,
      message: UNIT_DECLARATION_WARNING_MESSAGE,
    },
    buttons: {
      primary: PRIMARY_BUTTON_LABEL,
      secondary: SECONDARY_BUTTON_LABEL,
      dismiss: DISMISS_BUTTON_LABEL,
    },
    rememberChoice: REMEMBER_CHOICE_LABEL,
    rememberChoiceSessionNote: REMEMBER_CHOICE_SESSION_NOTE,
  },
  phase2: {
    panelTitle: PHASE_2_PANEL_TITLE,
    tableColumns: {
      layerName: LAYER_NAME_COLUMN,
      entityCount: ENTITY_COUNT_COLUMN,
      originalColor: ORIGINAL_COLOR_COLUMN,
      layerRole: LAYER_ROLE_COLUMN,
    },
    layerRoles: LAYER_ROLES,
    advancedOptions: {
      label: ADVANCED_OPTIONS_LABEL,
      drawingUnit: DRAWING_UNIT_LABEL,
      units: DRAWING_UNITS,
      coordinateOrigin: COORDINATE_ORIGIN_LABEL,
      originOptions: {
        keepCAD: ORIGIN_KEEP_CAD,
        gridA1: ORIGIN_GRID_A1,
      },
    },
    buttons: {
      import: IMPORT_BUTTON_LABEL,
    },
    hints: {
      unassignedLayer: UNASSIGNED_LAYER_HINT,
      aiBranchNotice: AI_BRANCH_NOTICE,
    },
  },
} as const;

/* -------------------------------------------------------------------------- */
/* -- bổ sung cho canvas + bảng lớp (L2-C) --                                  */
/*                                                                            */
/* Bốn hằng dưới đây do điều phối viên duyệt và chỉ định nguyên văn. Chúng     */
/* nằm ở CUỐI FILE để không đụng phần L2-B đang thêm cạnh                      */
/* REMEMBER_CHOICE_LABEL. Tên lớp CAD viết hoa (A-WALL) là ngoại lệ chữ hoa    */
/* hợp lệ của A6 — nó là mã, không phải câu.                                   */
/* -------------------------------------------------------------------------- */

/** Ghi chú cạnh Select "Đơn vị bản vẽ": giá trị hệ thống tự nhận là GỢI Ý, không phải quyết định. */
export const DETECTED_UNIT_HINT_LABEL = 'Gợi ý đọc được từ tệp';

/** Nhãn trình đọc màn hình của khung canvas xem trước giai đoạn 2. */
export const PREVIEW_CANVAS_ARIA_LABEL =
  'Xem trước hình học sẽ được nhập, tô màu theo vai trò lớp đã gán';

/** Nhãn trình đọc màn hình cho Select vai trò của TỪNG hàng — bảy Select giống hệt nhau thì phải phân biệt được bằng tên lớp. */
export const layerRoleSelectAriaLabel = (layerName: string): string =>
  `Vai trò của lớp ${layerName}`;

/** Nhãn trình đọc màn hình cho ô màu CAD gốc của từng hàng. */
export const layerSourceColorAriaLabel = (layerName: string): string =>
  `Màu gốc của lớp ${layerName}`;
