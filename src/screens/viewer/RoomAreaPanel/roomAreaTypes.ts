/**
 * Kiểu dùng chung giữa hook `useRoomAreaPanel`, view panel và view bảng.
 *
 * File `.ts` thuần, **không import React**, cùng lý do `viewer3dTypes.ts` của
 * Viewer3D là `.ts`: hook phải test được không cần dựng cây React, và một kiểu
 * mà cả ba phía đọc thì không được kéo theo tầng nào của phía kia.
 *
 * ## Vì sao mọi con số ở đây là CHUỖI ĐÃ ĐỊNH DẠNG
 *
 * Bất biến A15: định dạng số xảy ra ở viewmodel, không ở view; dấu thập phân là
 * dấu phẩy. `local/no-raw-number` chặn `toFixed`/`toLocaleString` ở tầng view,
 * nên view **không thể** tự định dạng kể cả khi muốn. Hook gọi
 * `formatNumber`/`formatArea` một lần rồi truyền chuỗi xuống.
 *
 * ## Vì sao đơn vị là một trường riêng
 *
 * Đặc tả: "đơn vị nằm NGOÀI con số, không nhét vào chuỗi". `formatArea(248.6)`
 * trả `"248,60 m²"` — dính đơn vị vào, nên **không dùng nó** cho ô tổng và cột
 * diện tích; dùng `formatNumber(v, { fractionDigits: AREA_DECIMALS })` rồi đặt
 * `unitLabel` cạnh nó như một phần tử riêng. `formatArea` vẫn đúng chỗ trong
 * câu chú giải, nơi cả cụm là một câu văn.
 *
 * ## Tỷ lệ thì không phải "số cần định dạng"
 *
 * `areaRatio` và `RoomAreaBand.ratio` là 0..1 dùng để tính bề rộng thanh, không
 * bao giờ hiện thành chữ. Chúng là hình học của bố cục, không phải dữ liệu người
 * đọc — nên chúng ở dạng số, và đó không phải ngoại lệ của A15.
 */

import type { LevelId, RoomId, RoomUsage } from '@/domain/spatial/types';

/* -------------------------------------------------------------------------- */
/* Trục điều khiển.                                                            */
/* -------------------------------------------------------------------------- */

/** Hai chế độ hiển thị, đổi bằng nút ở đầu panel. */
export type RoomAreaMode = 'panel' | 'table';

/** Dải đổi cách nhóm: theo tầng · theo công năng. */
export type RoomAreaGrouping = 'level' | 'usage';

/** Select sắp xếp: theo diện tích · theo tên · theo loại. */
export type RoomAreaSort = 'area' | 'name' | 'usage';

/**
 * Chấm trạng thái của một hàng.
 *
 * Đúng ba giá trị, theo bất biến A4 — màu thứ tư là thứ A4 tồn tại để chặn.
 * `reviewed` ứng với xanh "đã xác minh" của A5 và **chỉ** đặt được từ
 * `Room.reviewed` (việc người duyệt), không bao giờ từ đầu ra suy diễn.
 */
export type RoomAreaStatus = 'trusted' | 'suspect' | 'reviewed';

/**
 * Tông của một dải trên thanh xếp chồng.
 *
 * Đúng **ba** tông — đặc tả: "không quá ba màu dữ liệu", dùng ba xám tường cộng
 * tông trung tính. `RoomUsage` có tám giá trị và bảng màu công năng có năm
 * token, nên hook phải gom về ba trước khi dựng dải; kiểu này là chỗ ép điều đó.
 */
export type RoomAreaTone = 'wall-strong' | 'wall-mid' | 'neutral';

/** Bảy trạng thái màn hình của A11. */
export type RoomAreaScreenState =
  | 'empty'
  | 'loading'
  | 'partial'
  | 'error'
  | 'ready'
  | 'forbidden'
  | 'collapsed';

/* -------------------------------------------------------------------------- */
/* Dữ liệu một hàng.                                                           */
/* -------------------------------------------------------------------------- */

/** Một phòng, đã định dạng xong, sẵn sàng vẽ ở cả hai chế độ. */
export interface RoomAreaRow {
  readonly id: RoomId;
  /** Tên hiện ra. Phòng chưa đặt tên đã được thay bằng `UNNAMED_ROOM_LABEL`. */
  readonly name: string;
  /** Đúng khi `name` là nhãn thay thế — trạng thái "một phần" đếm trường này. */
  readonly isUnnamed: boolean;
  readonly usage: RoomUsage;
  /** Nhãn tiếng Việt của công năng, lấy từ `describeUsage`. */
  readonly usageLabel: string;
  readonly levelId: LevelId;
  readonly levelName: string;
  /** Diện tích, hai chữ số thập phân, **không** kèm đơn vị. Ví dụ `"17,00"`. */
  readonly areaText: string;
  /** 0..1 so với phòng lớn nhất trong nhóm — bề rộng thanh tỷ trọng 2px. */
  readonly areaRatio: number;
  /** Chu vi tính bằng mét, không kèm đơn vị. */
  readonly perimeterText: string;
  /** Chiều cao thông thuỷ của tầng, không kèm đơn vị. */
  readonly clearHeightText: string;
  readonly doorCountText: string;
  readonly windowCountText: string;
  readonly status: RoomAreaStatus;
  /** Câu chú giải cách tính, lấy nguyên văn từ `explainRoom` của M-07. */
  readonly explain: string;
}

/** Một nhóm trong danh sách gộp: đầu nhóm mang số lượng và tổng phụ. */
export interface RoomAreaGroup {
  readonly key: string;
  readonly label: string;
  /** Số phòng trong nhóm, đã định dạng. */
  readonly countText: string;
  /** Tổng phụ, hai chữ số thập phân, **không** kèm đơn vị. */
  readonly subtotalText: string;
  readonly rows: readonly RoomAreaRow[];
}

/** Một dải của thanh xếp chồng. Tối đa ba dải tồn tại cùng lúc. */
export interface RoomAreaBand {
  readonly key: string;
  readonly label: string;
  /** 0..1 — phần bề rộng dải này chiếm. */
  readonly ratio: number;
  readonly tone: RoomAreaTone;
}

/** Một tầng trong bộ chọn tầng ở đầu panel. */
export interface RoomAreaLevelOption {
  readonly id: LevelId;
  readonly name: string;
  /** Sai khi tầng đó chưa có diện tích — trạng thái "một phần" gọi tên nó. */
  readonly hasArea: boolean;
}

/** Ô tổng ở đầu panel và hàng tổng ghim đáy bảng. */
export interface RoomAreaTotals {
  /**
   * Giá trị thô để `useCountUp` chạy số. Đây là con số duy nhất ở dạng số trong
   * nhóm này, và nó tồn tại vì chuyển động cần đích đến, không vì view cần định
   * dạng lại.
   */
  readonly totalM2: number;
  /** `"248,60"` — đã định dạng, **không** kèm đơn vị. */
  readonly totalText: string;
  /** `"m²"` — đặt cạnh con số như một phần tử riêng, không nối chuỗi. */
  readonly unitLabel: string;
  /** `"Tổng diện tích sàn Tầng 01 — 14 phòng"`. */
  readonly caption: string;
}

/* -------------------------------------------------------------------------- */
/* Props của hai view.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Những gì cả hai view dùng chung.
 *
 * Không view nào nhận `Room`, `RootState`, hay một hàm của `src/domain` — R-60
 * cấm view chạm tầng dữ liệu, và `local/no-data-layer-in-view` ép điều đó.
 */
export interface RoomAreaCommonProps {
  readonly state: RoomAreaScreenState;
  readonly groups: readonly RoomAreaGroup[];
  readonly totals: RoomAreaTotals;
  readonly sort: RoomAreaSort;
  readonly onSortChange: (sort: RoomAreaSort) => void;
  readonly mode: RoomAreaMode;
  readonly onModeChange: (mode: RoomAreaMode) => void;
  /** Hàng đang được trỏ vào, dù trỏ từ panel hay từ mô hình 3D. */
  readonly hoveredRoomId: RoomId | null;
  readonly onRoomHover: (roomId: RoomId | null) => void;
  /** Bấm một dòng: khuôn camera vào phòng đó và tô sáng trong 3D. */
  readonly onRoomActivate: (roomId: RoomId) => void;
  /** Sửa tên ngay trong dòng; tự lưu do hook lo, view chỉ báo có thay đổi. */
  readonly onRoomRename: (roomId: RoomId, name: string) => void;
  /** Phòng vừa lưu xong — dòng nháy một nhịp. */
  readonly flashedRoomId: RoomId | null;
  /** Câu tiếng Việt của trạng thái lỗi. Rỗng khi `state` khác `'error'`. */
  readonly errorMessage: string;
  readonly onRetry: () => void;
  /**
   * Trạng thái rỗng: sang chỗ kiểm tra khe hở tường của bản vẽ.
   *
   * KHÁC `onRetry`. "Đo lại" chạy lại chính phép đo vừa hỏng; "kiểm tra khe hở
   * tường" đưa người dùng sang một việc khác — soát chỗ các đoạn tường chưa
   * khép vòng, thứ khiến bảng rỗng ngay từ đầu. Nối cả hai vào một hàm là gộp
   * hai hành động khác nhau, và R-73 đòi mỗi hành động một sợi dây thật.
   *
   * Nằm ở props CHUNG chứ không riêng panel: cả hai chế độ đều vẽ nút này ở
   * trạng thái rỗng (`RoomAreaPanel.tsx` và `RoomAreaTable.tsx`), nên đặt riêng
   * cho panel sẽ để bảng toàn trang tiếp tục gọi nhầm `onRetry`.
   */
  readonly onCheckWallGaps: () => void;
}

/** Chế độ panel 344. */
export interface RoomAreaPanelProps extends RoomAreaCommonProps {
  readonly levels: readonly RoomAreaLevelOption[];
  readonly activeLevelId: LevelId | null;
  readonly onLevelChange: (levelId: LevelId) => void;
  readonly grouping: RoomAreaGrouping;
  readonly onGroupingChange: (grouping: RoomAreaGrouping) => void;
  /** Tối đa ba dải — thanh xếp chồng phân bố diện tích theo loại phòng. */
  readonly bands: readonly RoomAreaBand[];
  /** Tên các tầng còn thiếu diện tích, để trạng thái "một phần" gọi tên. */
  readonly missingLevelNames: readonly string[];
  readonly onCopyAsText: () => void;
  /** Sang S-34. Màn này **không** tự sinh tệp. */
  readonly onOpenExport: () => void;
}

/** Chế độ bảng toàn trang. */
export interface RoomAreaTableProps extends RoomAreaCommonProps {
  readonly onOpenExport: () => void;
}
