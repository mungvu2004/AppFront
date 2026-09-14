/**
 * S-36 — hợp đồng công khai của màn xem Spatial JSON.
 *
 * Một nơi định nghĩa kiểu, view / hook / container / test cùng nhập; barrel chỉ
 * tái xuất. Cùng khuôn `export/VersionHistory/types.ts`.
 *
 * ## Màn này CHỈ ĐỌC
 *
 * Không có `onChange`, không `onSave`, không một hành động nào sửa dữ liệu.
 * Hành động duy nhất chạm ra ngoài là {@link SpatialJsonViewerActions.onDownload},
 * và nó **điều hướng sang S-34** chứ không tự sinh tệp — đặc tả nói rõ việc sinh
 * tệp là của nhóm X, không của màn này.
 *
 * ## Ba tông tô cú pháp, và vì sao không phải ba tông mà đặc tả ghi
 *
 * Đặc tả S-36 ghi: khoá `--text-primary`, chuỗi `--accent`, số `--data-dimension`.
 * Đo tương phản trên nền `--bg-sunken` (#F1EEE8) thì hai trong ba trượt ngưỡng
 * 4,5:1 cho chữ 13px:
 *
 * | Token | Tương phản | |
 * |---|---:|---|
 * | `--text-primary` #33322F | 11,07:1 | đạt |
 * | `--accent` #567A96 | 3,93:1 | **trượt** — và chính DS-00 đã cấm dùng `--accent` cho chữ 13px |
 * | `--data-dimension` #A99B76 | 2,37:1 | **trượt** — nó là màu TÔ lớp dữ liệu trên canvas, không phải màu chữ |
 * | `--accent-active` #3F5D74 | 5,99:1 | đạt |
 * | `--text-secondary` #6B6862 | 4,80:1 | đạt |
 *
 * Nên ba tông ở đây là `--text-primary` · `--accent-active` · `--text-secondary`.
 * Vẫn **đúng ba**, vẫn đúng tinh thần "không chủ đề bảy màu", và đọc được. Đây
 * là chỗ luật thắng prompt (`LUAT_MAN_HINH.md:10`), và nó được báo lại thay vì
 * chọn im lặng.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/** Tông chữ của một giá trị trong cây. Đúng ba, cộng `none` cho hàng không có giá trị. */
export type SpatialJsonTone = 'key' | 'string' | 'number' | 'none';

/** Hai tấm của nửa phải. */
export type SpatialJsonTabId = 'json' | 'preview';

/** Cây gấp mở, hay chữ thô có ngắt dòng. Chế độ thô LUÔN phải với tới được. */
export type SpatialJsonViewMode = 'tree' | 'raw';

/**
 * Một hàng của cây cấu trúc, đã dàn phẳng.
 *
 * Dàn phẳng ở tầng model chứ không để view đệ quy: view chỉ `map` một mảng, nên
 * nó test được từ props và không giữ trạng thái gấp mở nào.
 */
export interface SpatialJsonNode {
  /** Đường dẫn JSON, cũng là khoá React ổn định — `geometry.L-LEVEL01.walls[3]`. */
  readonly id: string;
  /** Tên khoá hiện trên hàng. */
  readonly label: string;
  /** Bậc thụt, nhân với 16px ở view. */
  readonly depth: number;
  /** Số phần tử con khi hàng gấp lại; `null` với hàng lá. */
  readonly childCount: number | null;
  /** Giá trị đã định dạng sẵn (A15: định dạng ở model, không ở view). */
  readonly valueText: string | null;
  /** Tông của `valueText`. */
  readonly tone: SpatialJsonTone;
  readonly isExpandable: boolean;
  readonly isExpanded: boolean;
  /** Hàng khớp với ô tìm kiếm hiện tại. */
  readonly isMatch: boolean;
  /** Mã thực thể để tô sáng trong 3D; `null` khi hàng không ứng với thực thể nào. */
  readonly entityId: string | null;
}

/** Một lỗi toàn vẹn, hiện thành một hàng dưới dải kiểm tra. */
export interface SpatialJsonIssue {
  readonly id: string;
  /** Đường dẫn máy đọc, chữ đều. */
  readonly path: string;
  /** Câu tiếng thường cho người đọc. Đặc tả đòi **cả hai**, không chỉ một. */
  readonly problem: string;
  readonly severity: 'critical' | 'warning';
}

/** Dải kiểm tra hợp lệ ngay dưới thanh trên. */
export interface SpatialJsonValidity {
  readonly isValid: boolean;
  readonly criticalCount: number;
  readonly warningCount: number;
  /** Câu tóm tắt đã dựng sẵn, ví dụ "Hợp lệ — 0 lỗi". */
  readonly summary: string;
  readonly issues: readonly SpatialJsonIssue[];
}

/** Số đối tượng ở chân màn, đã định dạng thành một câu. */
export interface SpatialJsonCounts {
  readonly levels: number;
  readonly walls: number;
  readonly openings: number;
  readonly rooms: number;
  readonly furniture: number;
  readonly axes: number;
  readonly dimensions: number;
}

/** Toàn bộ thứ view cần để vẽ. Không hàm, không đối tượng miền. */
export interface SpatialJsonViewerModel {
  readonly state: SevenState;
  /** Hàng đang nhìn thấy, đã dàn phẳng theo trạng thái gấp mở. */
  readonly nodes: readonly SpatialJsonNode[];
  /** Chữ thô, đã thụt lề. Rỗng khi chưa có dữ liệu. */
  readonly rawText: string;
  readonly validity: SpatialJsonValidity;
  readonly counts: SpatialJsonCounts;
  /** "12,4 KB" — dựng bằng `lib/format/bytes`. */
  readonly sizeLabel: string;
  /** "48 tường · 16 ô mở · 14 phòng" — dựng bằng `lib/format/number`. */
  readonly countsLabel: string;
  readonly searchQuery: string;
  /** "3 / 12", hoặc `null` khi chưa tìm gì. */
  readonly matchLabel: string | null;
  readonly selectedNodeId: string | null;
  readonly activeTabId: SpatialJsonTabId;
  readonly viewMode: SpatialJsonViewMode;
  /** Dưới 1024: ẩn nửa phải, cây chiếm hết chiều rộng. */
  readonly isNarrow: boolean;
  /**
   * Trạng thái 3 của A11 — đã có dữ liệu trên màn và vẫn còn lượt tải đang chạy.
   *
   * Đặc tả S-36 mô tả "một phần" là "tệp lớn, chỉ nạp 2 tầng đầu, có nút nạp
   * tiếp". Tầng dữ liệu **không làm được điều đó**: kho giữ đúng một tầng
   * (`spatialSlice.spatial`), và không API nào chở JSON theo trang. Nên màn
   * không dựng nút "nạp tiếp" giả; nó nói ra đúng trạng thái có thật — dữ liệu
   * đang được làm mới. Khi tầng dữ liệu có phân trang, trường này đổi thành
   * bộ đếm và nút kia mới có thứ để gọi.
   */
  readonly isRefreshing: boolean;
  /** Trạng thái 4 — câu lỗi đọc được, không phải mã lỗi thô. */
  readonly errorMessage: string | null;
  /** Trạng thái 6 — không có quyền. */
  readonly forbiddenMessage: string | null;
  /** Nút "Tải xuống .json" chỉ hiện khi nơi gọi cấp đường sang S-34. */
  readonly canDownload: boolean;
}

/** Mọi thứ người dùng bấm được. Không hành động nào sửa dữ liệu. */
export interface SpatialJsonViewerActions {
  readonly onToggleNode: (nodeId: string) => void;
  readonly onExpandAll: () => void;
  readonly onCollapseAll: () => void;
  readonly onSelectNode: (nodeId: string) => void;
  readonly onSearchChange: (query: string) => void;
  readonly onNextMatch: () => void;
  readonly onPreviousMatch: () => void;
  readonly onChangeTab: (tabId: SpatialJsonTabId) => void;
  readonly onChangeViewMode: (mode: SpatialJsonViewMode) => void;
  readonly onCopyBranch: () => void;
  /**
   * Đường ra khi dữ liệu trong phiên hỏng: quay về màn quản lý tầng để mở lại
   * bản vẽ.
   *
   * Không phải "thử lại". Phép dựng cây là thuần và chỉ đọc kho, nên chạy lại
   * nó trên cùng dữ liệu hỏng cho ra đúng lỗi cũ — một nút như vậy chỉ làm người
   * dùng bấm hai lần rồi tin rằng hệ thống hỏng. Điều có ích thật là đi lấy lại
   * dữ liệu, và đó là việc của màn quản lý tầng.
   */
  readonly onReopenFloors: () => void;
  readonly onDownload: (() => void) | null;
}

/** Props của view thuần. */
export interface SpatialJsonViewerProps {
  readonly model: SpatialJsonViewerModel;
  readonly actions: SpatialJsonViewerActions;
}

/** Props của màn đã nối — R-73: đúng một thẻ là mở được. */
export interface SpatialJsonViewerContainerProps {
  readonly projectId: string;
  /** Đường sang S-34. Vắng thì nút tải xuống không hiện, không phải hiện rồi vô hiệu. */
  readonly onDownload?: () => void;
  /** Đường tiêm cho story và test. */
  readonly onCopy?: (text: string) => void;
}

export type { SevenState };
