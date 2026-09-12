/**
 * Hình dạng dữ liệu của màn duyệt bảy trạng thái — `/design-system/states`.
 *
 * File này là HỢP ĐỒNG, đóng băng trước khi bốn worker lớp viết chạy song song.
 * Manifest, view, hook và test đều chỉ biết các kiểu ở đây; không worker nào
 * được tự bịa lại hình dạng.
 *
 * `SevenState` nhập KIỂU từ `@/lib/testing/sevenStateScenarios`. Import kiểu bị
 * xoá lúc biên dịch nên không dòng nào của `@testing-library` vào gói sản phẩm —
 * đúng tiền lệ đã chạy ở `screens/admin/ModelLibrary/types.ts:39` và
 * `screens/admin/UserManagement/types.ts:47`.
 */

import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* ── Nhóm màn ─────────────────────────────────────────────────────────────── */

/** Tám nhóm của cây bên trái, A → H. */
export const SCREEN_GROUP_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export type ScreenGroupId = (typeof SCREEN_GROUP_IDS)[number];

/** Một nhóm: mã, nhãn tiếng Việt (chữ thường, kiểu câu — A6). */
export interface ScreenGroup {
  readonly id: ScreenGroupId;
  readonly label: string;
}

/* ── Một ô trạng thái ─────────────────────────────────────────────────────── */

/**
 * Một trạng thái của một màn.
 *
 * `storyExportName` là `null` khi màn đó KHÔNG có story cho trạng thái này —
 * đấy là thứ duy nhất làm nên con số "5/7" và danh sách thiếu. Tên story không
 * suy ra được từ trạng thái: repo dùng ba bộ từ vựng (`Rong`/`Empty`) và cả từ
 * đồng nghĩa riêng (`Sending`, `Ready`, `DangDo`), nên nó phải được ghi thẳng.
 */
export interface ScreenStateEntry {
  readonly state: SevenState;
  /** Nhãn tiếng Việt của trạng thái (rỗng, đang tải, …). */
  readonly label: string;
  /** Tên export thật trong `<Name>.stories.tsx`, hoặc `null` nếu thiếu. */
  readonly storyExportName: string | null;
}

/* ── Một màn ──────────────────────────────────────────────────────────────── */

/** Một màn trong cây bên trái. */
export interface GalleryScreenEntry {
  /** Khoá ổn định, duy nhất. Dùng `<area>/<Name>`, ví dụ `qc/FloorManager`. */
  readonly id: string;
  /** Định danh tiếng Anh của thư mục màn, ví dụ `FloorManager` (mục B / E.11). */
  readonly name: string;
  readonly area: string;
  readonly group: ScreenGroupId;
  /** Nhãn người đọc thấy: tiếng Việt có dấu, chữ thường, kiểu câu (A6). */
  readonly label: string;
  /** Đúng bảy phần tử, theo thứ tự `SEVEN_STATES`. */
  readonly states: readonly ScreenStateEntry[];
}

/* ── Toàn bộ manifest ─────────────────────────────────────────────────────── */

/**
 * Bảng 47 màn.
 *
 * `presentCount` / `totalCount` do hàm dẫn xuất tính, KHÔNG viết tay — một con
 * số viết tay sẽ lệch với dữ liệu ngay lần sửa đầu tiên.
 */
export interface GalleryManifest {
  readonly screens: readonly GalleryScreenEntry[];
  readonly groups: readonly ScreenGroup[];
}

/** Số đếm của một màn: đã có bao nhiêu trên bảy, và thiếu những trạng thái nào. */
export interface ScreenCoverage {
  readonly screenId: string;
  readonly presentCount: number;
  readonly totalCount: number;
  /** Nhãn tiếng Việt của các trạng thái còn thiếu; rỗng khi đủ bảy. */
  readonly missingLabels: readonly string[];
}

/** Số đếm của cả trang. `presentCount` phải ra 329 khi đủ. */
export interface GalleryCoverage {
  readonly presentCount: number;
  readonly totalCount: number;
  readonly screenCount: number;
  /** Các màn chưa đủ bảy. Rỗng ⇒ trạng thái `success` của chính trang này. */
  readonly incompleteScreens: readonly ScreenCoverage[];
}

/* ── Bốn phép kiểm nhanh ──────────────────────────────────────────────────── */

/** Bốn phép kiểm của O-03, đúng thứ tự cột trong bảng kết quả. */
export const QUICK_CHECK_IDS = [
  'sevenStates',
  'noRawColor',
  'vietnamese',
  'accessible',
] as const;

export type QuickCheckId = (typeof QUICK_CHECK_IDS)[number];

export type QuickCheckStatus = 'pending' | 'running' | 'pass' | 'fail';

/** Một ô trong bảng kết quả: một màn × một phép kiểm. */
export interface QuickCheckCell {
  readonly checkId: QuickCheckId;
  readonly status: QuickCheckStatus;
  /** Câu tiếng Việt nói vì sao hỏng; `null` khi không hỏng. */
  readonly detail: string | null;
}

/** Một hàng trong bảng kết quả: một màn, bốn ô. */
export interface QuickCheckRow {
  readonly screenId: string;
  readonly screenLabel: string;
  readonly cells: readonly QuickCheckCell[];
}

/* ── Công cụ duyệt trên đầu ───────────────────────────────────────────────── */

/** Ba công tắc của thanh công cụ. */
export interface ReviewToolbarState {
  readonly isDarkTheme: boolean;
  readonly isReducedMotion: boolean;
  readonly isSpacingGridVisible: boolean;
}

/* ── Props của view thuần ─────────────────────────────────────────────────── */

/**
 * Tất cả những gì `StateGallery.tsx` nhận.
 *
 * View KHÔNG chạm store, mạng, `src/api`, `src/domain` (R-60). Mọi thứ dưới đây
 * do `useStateGallery.ts` dựng và truyền vào — nên story và test dựng được màn
 * chỉ từ object này, không cần provider nào.
 */
export interface StateGalleryProps {
  /** Trạng thái của CHÍNH trang này, một trong bảy (A11). */
  readonly state: SevenState;
  readonly coverage: GalleryCoverage;
  readonly groups: readonly ScreenGroup[];
  /** Các màn đã lọc/sắp sẵn để dựng cây; view không tự lọc. */
  readonly screens: readonly GalleryScreenEntry[];
  /** Số đếm theo từng màn, tra theo `screenId`. */
  readonly coverageByScreen: Readonly<Record<string, ScreenCoverage>>;
  /** `null` ⇒ chưa chọn màn nào ⇒ trạng thái `empty`. */
  readonly selectedScreenId: string | null;
  readonly searchText: string;
  readonly toolbar: ReviewToolbarState;
  readonly isCollapsed: boolean;
  /** Bảng kết quả bốn phép kiểm; rỗng khi chưa bấm "chạy kiểm nhanh". */
  readonly checkRows: readonly QuickCheckRow[];
  readonly isCheckRunning: boolean;
  /** Câu lỗi tiếng Việt; chỉ khác `null` ở trạng thái `error`. */
  readonly errorMessage: string | null;

  readonly onSelectScreen: (screenId: string) => void;
  readonly onSearchTextChange: (value: string) => void;
  readonly onToggleDarkTheme: () => void;
  readonly onToggleReducedMotion: () => void;
  readonly onToggleSpacingGrid: () => void;
  readonly onRunQuickCheck: () => void;
  readonly onToggleCollapsed: () => void;
  readonly onRetry: () => void;
}

export type { SevenState };
