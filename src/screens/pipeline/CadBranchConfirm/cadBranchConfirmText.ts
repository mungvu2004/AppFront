/**
 * Mọi câu tiếng Việt của màn xác nhận nhánh CAD, gom về một chỗ.
 *
 * Không phải bảng dịch lúc chạy — `src/i18n/vi.json` cũng không phải (xem CLAUDE.md).
 * Đây là chỗ hook lấy chuỗi để ghép vào view model, và là bản đối chiếu một-một với
 * khoá `cadBranchConfirm` của `vi.json` mà `expectVietnamese` dùng làm từ điển (R-67).
 *
 * Lưu ý: Các câu lỗi CAD được tự viết dựa trên ngữ cảnh sử dụng (chưa có L-03 trong
 * src/lib/errors/**), được tích hợp vào màn này để thông báo cho người dùng về
 * những vấn đề khi đọc tệp CAD.
 */

/** Tiêu đề và mô tả để kích hoạt mỗi trạng thái của hộp thoại. */
export interface DialogStateText {
  readonly title: string;
  readonly description: string;
  readonly buttonLabel?: string;
}

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

/** Hàm tạo state "error" với tham số phiên bản AutoCAD nếu có. */
export const phase1ErrorState = (version?: string): DialogStateText => ({
  title: 'Không thể đọc tệp CAD',
  description: version
    ? `Tệp được lưu bằng AutoCAD phiên bản ${version}, mà hệ thống chỉ hỗ trợ đến AutoCAD 2023. Vui lòng mở tệp lại trong AutoCAD 2023 hoặc phiên bản cũ hơn, lưu lại, rồi tải lên. Bạn vẫn có thể tiếp tục dùng nhánh nhận dạng ảnh.`
    : 'Tệp bản vẽ bị hỏng hoặc dùng phiên bản AutoCAD mới hơn mức mà hệ thống hỗ trợ (hỗ trợ đến AutoCAD 2023). Vui lòng thiết lập lại tệp rồi tải lên. Bạn vẫn có thể tiếp tục dùng nhánh nhận dạng ảnh.',
  buttonLabel: 'Tiếp tục với ảnh',
});

/** Hàm tạo state "partial" với tham số danh sách loại không hỗ trợ nếu có. */
export const phase1PartialState = (unsupportedTypes?: string[]): DialogStateText => ({
  title: 'Chỉ một số tầng có CAD',
  description: unsupportedTypes && unsupportedTypes.length > 0
    ? `Tệp bản vẽ chỉ có dữ liệu cho một số tầng của hồ sơ, hoặc chứa các loại đối tượng không hỗ trợ: ${unsupportedTypes.join(', ')}. Các tầng và loại này sẽ bị bỏ qua hoặc xử lý qua nhánh nhận dạng ảnh.`
    : 'Tệp bản vẽ chỉ có dữ liệu cho một số tầng của hồ sơ. Các tầng khác sẽ chạy qua nhánh nhận dạng ảnh. Bạn có thể lựa chọn cách xử lý từng loại dữ liệu riêng biệt ở bước tiếp theo.',
});

/** Các state tĩnh của giai đoạn 1. */
export const PHASE_1_DIALOG_STATES = {
  /** Trạng thái bình thường: hộp thoại đầy đủ với lựa chọn hai nhánh. */
  normal: {
    title: 'Phát hiện tệp CAD',
    description:
      'Hồ sơ này có tệp bản vẽ gốc từ AutoCAD hoặc các phần mềm thiết kế khác. Bạn có thể sử dụng đường hình học chính xác từ tệp, hoặc tiếp tục dùng nhánh nhận dạng ảnh để kiểm soát từng bước.',
  },

  /** Trạng thái đang tải: tệp đang được đọc. */
  loading: {
    title: 'Đang đọc tệp CAD…',
    description: 'Hệ thống đang phân tích tệp bản vẽ. Vui lòng đợi.',
  },

  /** Trạng thái thành công: hộp thoại sẵn sàng. */
  ready: {
    title: 'Phát hiện tệp CAD',
    description:
      'Hồ sơ này có tệp bản vẽ gốc từ AutoCAD hoặc các phần mềm thiết kế khác. Bạn có thể sử dụng đường hình học chính xác từ tệp, hoặc tiếp tục dùng nhánh nhận dạng ảnh để kiểm soát từng bước.',
  },

  /** Trạng thái không có quyền: người dùng không được phép xử lý tệp CAD. */
  forbidden: {
    title: 'Không có quyền xử lý CAD',
    description:
      'Tài khoản hiện tại không được phép sử dụng tính năng xử lý tệp CAD. Bạn chỉ có thể tiếp tục với nhánh nhận dạng ảnh. Liên hệ quản trị dự án để nâng cấp quyền truy cập.',
  },

  /** Trạng thái thu gọn: hộp thoại đã đóng/thu gọn. */
  collapsed: {
    title: 'Phát hiện tệp CAD',
    description:
      'Hộp thoại đã được đóng. Mở lại để lựa chọn nhánh xử lý hoặc tiếp tục với các cài đặt hiện tại.',
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
  'lựa chọn chỉ được giữ trong phiên làm việc này, tải lại trang sẽ hỏi lại';

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

/** Các tùy chọn đơn vị. */
export const DRAWING_UNITS: Readonly<Record<string, string>> = {
  mm: 'milimét (mm)',
  cm: 'centimét (cm)',
  m: 'mét (m)',
  inch: 'inch',
};

/** Nhãn select "Gốc toạ độ" — chọn vị trí điểm gốc. */
export const COORDINATE_ORIGIN_LABEL = 'Gốc toạ độ';

/** Lựa chọn: giữ nguyên gốc CAD. */
export const ORIGIN_KEEP_CAD = 'Giữ nguyên gốc CAD';

/** Lựa chọn: đặt gốc tại giao trục A-1. */
export const ORIGIN_GRID_A1 = 'Đặt tại giao trục A-1';

/**
 * Dòng tóm tắt chân màn — hàm nhận các số ĐÃ ĐỊNH DẠNG SẴN.
 * A15: view/text không tự định dạng số, không gọi toFixed/toLocaleString.
 *
 * @param mappedCount số lớp đã ánh xạ (định dạng sẵn, ví dụ "12")
 * @param totalCount tổng số lớp (định dạng sẵn, ví dụ "18")
 * @param objectCount số đối tượng sẽ được nhập (định dạng sẵn, ví dụ "245")
 * @returns dòng tóm tắt
 */
export const formatSummaryLine = (
  mappedCount: string,
  totalCount: string,
  objectCount: string,
): string => `Đã ánh xạ ${mappedCount}/${totalCount} lớp · ${objectCount} đối tượng sẽ được nhập`;

/** Nút chính: bắt đầu nhập hình học. */
export const IMPORT_BUTTON_LABEL = 'Nhập hình học';

/** Gợi ý nhẹ khi một lớp chưa gán mà chứa nhiều thực thể — GỢI Ý, KHÔNG PHẢI LỖI CHẶN. */
export const UNASSIGNED_LAYER_HINT =
  'Lớp này chưa gán vai trò nhưng chứa nhiều đối tượng. Nếu bỏ qua, những đối tượng đó sẽ không được nhập.';

/** Caption mức cần chú ý khi người dùng chọn nhánh AI. */
export const AI_BRANCH_NOTICE =
  'Nếu bạn chọn nhánh AI, sẽ cần hiệu chỉnh tỷ lệ sau khi nhập hình học.';

/**
 * BẢY TRẠNG THÁI của giai đoạn 2 — mỗi trạng thái một tiêu đề + một câu mô tả.
 */

/** Hàm tạo state "partial" với tham số danh sách loại không hỗ trợ nếu có. */
export const phase2PartialState = (unsupportedTypes?: string[]): DialogStateText => ({
  title: 'Một số loại đối tượng không hỗ trợ',
  description: unsupportedTypes && unsupportedTypes.length > 0
    ? `Tệp CAD chứa các loại đối tượng không được hỗ trợ: ${unsupportedTypes.join(', ')}. Các loại này sẽ bị bỏ qua. Chỉ polyline, đường tròn, arc, text, và các loại hình học cơ bản khác được nhập.`
    : 'Tệu CAD chứa các loại đối tượng mà hệ thống chưa hỗ trợ. Các loại này sẽ bị bỏ qua. Chỉ polyline, đường tròn, arc, và text được nhập.',
});

/** Hàm tạo state "error" với tham số phiên bản AutoCAD nếu có. */
export const phase2ErrorState = (version?: string): DialogStateText => ({
  title: 'Không thể phân tích tệp CAD',
  description: version
    ? `Tệp bản vẽ được lưu bằng AutoCAD phiên bản ${version}, mà hệ thống chỉ hỗ trợ đến AutoCAD 2023. Vui lòng mở tệp lại trong AutoCAD 2023 hoặc phiên bản cũ hơn, lưu lại, rồi tải lên.`
    : 'Tệp bản vẽ bị hỏng hoặc dùng phiên bản AutoCAD mới hơn mức mà hệ thống hỗ trợ (hỗ trợ đến AutoCAD 2023). Vui lòng thiết lập lại tệp trong AutoCAD (Lưu thành phiên bản 2023 hoặc cũ hơn) rồi tải lên lại.',
});

/** Các state tĩnh của giai đoạn 2. */
export const PHASE_2_DIALOG_STATES = {
  /** Trạng thái rỗng: tệp không có lớp đặt tên, hệ thống chuyển sang ánh xạ theo loại hình học. */
  empty: {
    title: 'Tệp CAD không có lớp được đặt tên',
    description:
      'Hệ thống sẽ tự động ánh xạ các đối tượng dựa trên loại hình học (polyline cho tường, circle/arc cho cửa sổ, v.v.). Bạn có thể điều chỉnh kết quả này ở bước tiếp theo.',
  },

  /** Trạng thái đang tải: đang đọc tệp .dwg. */
  loading: {
    title: 'Đang phân tích tệp…',
    description: 'Hệ thống đang trích xuất danh sách lớp và đối tượng. Vui lòng đợi.',
  },

  /** Trạng thái thành công: bảng lớp sẵn sàng. */
  ready: {
    title: 'Ánh xạ lớp từ tệp CAD',
    description: 'Gán mỗi lớp một vai trò để xác định cách xử lý hình học. Bạn có thể bỏ qua lớp không cần thiết.',
  },

  /** Trạng thái không có quyền: người dùng không được phép xử lý tệp CAD. */
  forbidden: {
    title: 'Không có quyền xử lý CAD',
    description:
      'Tài khoản hiện tại không được phép sử dụng tính năng xử lý tệp CAD. Liên hệ quản trị dự án để nâng cấp quyền truy cập.',
  },

  /** Trạng thái thu gọn: bảng đã đóng/thu gọn. */
  collapsed: {
    title: 'Ánh xạ lớp từ tệp CAD',
    description: 'Bảng đã được đóng. Mở lại để điều chỉnh ánh xạ lớp hoặc tiếp tục nhập hình học.',
  },
} as const;

/**
 * Các câu lỗi cụ thể khi tệp CAD gặp vấn đề (tự viết, chưa có L-03 trong src/lib/errors/**).
 * Những câu này được tích hợp vào màn để thông báo tình trạng chi tiết cho người dùng.
 */
export const CAD_SPECIFIC_ERRORS = {
  /**
   * Khi tệp có phiên bản AutoCAD mới hơn mức hỗ trợ.
   * Hàm nhận số phiên bản, nêu rõ số đó, và gợi ý thiết lập khi xuất lại.
   */
  unsupportedVersion: (version: string): string =>
    `Tệp được lưu bằng AutoCAD phiên bản ${version}, mà hệ thống chỉ hỗ trợ đến 2023. Vui lòng mở tệp lại trong AutoCAD 2023 hoặc phiên bản cũ hơn, lưu lại, rồi tải lên.`,

  /** Khi tệp bị hỏng hoặc không đọc được. */
  corruptedFile:
    'Tệp bản vẽ bị hỏng hoặc định dạng không hợp lệ. Hãy kiểm tra tệp trong AutoCAD rồi lưu lại dưới tên khác.',

  /** Khi tệp rỗng hoặc không có dữ liệu hình học. */
  emptyFile:
    'Tệp bản vẽ không chứa bất kỳ đối tượng hình học nào. Kiểm tra lại file được tải lên có đúng không.',

  /** Khi tệp quá lớn để xử lý. */
  fileTooLarge: (sizeMb: string): string =>
    `Tệp bản vẽ quá lớn (${sizeMb} MB). Vui lòng tải lên tệp dưới 100 MB hoặc tách tệp thành các phần nhỏ hơn.`,

  /** Khi tệp chứa mã hóa không được hỗ trợ. */
  encodingNotSupported:
    'Tệp bản vẽ chứa mã hóa không được hỗ trợ. Vui lòng kiểm tra tệp trong AutoCAD và lưu dưới dạng UTF-8 hoặc mã hóa tiêu chuẩn.',
} as const;

/**
 * Xuất toàn bộ cấu trúc dưới dạng một module duy nhất cho dễ nhập vào view model.
 * Pattern này tuân theo mục B của CLAUDE.md: định danh tiếng Anh, chuỗi tiếng Việt có dấu.
 */
export const CAD_BRANCH_CONFIRM_TEXT = {
  phase1: {
    dialogStates: PHASE_1_DIALOG_STATES,
    dialogStateError: phase1ErrorState,
    dialogStatePartial: phase1PartialState,
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
    summaryLine: {
      format: formatSummaryLine,
    },
    buttons: {
      import: IMPORT_BUTTON_LABEL,
    },
    hints: {
      unassignedLayer: UNASSIGNED_LAYER_HINT,
      aiBranchNotice: AI_BRANCH_NOTICE,
    },
    dialogStates: PHASE_2_DIALOG_STATES,
    dialogStateError: phase2ErrorState,
    dialogStatePartial: phase2PartialState,
  },
  errors: CAD_SPECIFIC_ERRORS,
} as const;
