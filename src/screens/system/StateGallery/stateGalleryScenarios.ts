/**
 * Bảy kịch bản của chính trang `StateGallery`, cùng khuôn
 * `mobileViewerScenarios.ts`: một `BASE` đầy đủ, một bản ghi theo trạng thái,
 * và một hàm tra cứu. Không gọi mạng, không đọc store — toàn bộ là dữ liệu
 * tĩnh dựng từ {@link STATE_GALLERY_MANIFEST} (R-60 tinh thần).
 *
 * `partial` là kịch bản DUY NHẤT dùng một manifest có màn thiếu trạng thái —
 * sáu kịch bản còn lại đều dùng manifest đầy đủ 329/329 trên 47 màn.
 */

import { galleryCoverage, screenCoverage, STATE_GALLERY_MANIFEST } from './stateGalleryManifest';
import type {
  GalleryManifest,
  GalleryScreenEntry,
  ScreenCoverage,
  SevenState,
  StateGalleryProps,
} from './stateGalleryTypes';

const NO_OP = (): void => undefined;
const NO_OP_STRING = (value: string): void => void value;

/* -------------------------------------------------------------------------- */
/* Manifest "một phần" — kịch bản DUY NHẤT có màn thiếu trạng thái.            */
/* -------------------------------------------------------------------------- */

const PARTIAL_SCREEN_ID = 'admin/ModelLibrary';
const PARTIAL_MISSING_STATES: readonly SevenState[] = ['partial', 'collapsed'];

function toPartialEntry(entry: GalleryScreenEntry): GalleryScreenEntry {
  if (entry.id !== PARTIAL_SCREEN_ID) {
    return entry;
  }

  return {
    ...entry,
    states: entry.states.map((s) =>
      PARTIAL_MISSING_STATES.includes(s.state) ? { ...s, storyExportName: null } : s,
    ),
  };
}

const PARTIAL_MANIFEST: GalleryManifest = {
  screens: STATE_GALLERY_MANIFEST.screens.map(toPartialEntry),
  groups: STATE_GALLERY_MANIFEST.groups,
};

/* -------------------------------------------------------------------------- */
/* Số đếm theo từng màn — tra theo `screenId`, dựng từ manifest tương ứng.     */
/* -------------------------------------------------------------------------- */

function coverageByScreenOf(manifest: GalleryManifest): Readonly<Record<string, ScreenCoverage>> {
  const entries = manifest.screens.map((s): readonly [string, ScreenCoverage] => [s.id, screenCoverage(s)]);
  return Object.fromEntries(entries);
}

const FULL_COVERAGE_BY_SCREEN = coverageByScreenOf(STATE_GALLERY_MANIFEST);
const PARTIAL_COVERAGE_BY_SCREEN = coverageByScreenOf(PARTIAL_MANIFEST);

/* -------------------------------------------------------------------------- */
/* BASE — trạng thái `success`, manifest đầy đủ.                              */
/* -------------------------------------------------------------------------- */

const BASE: StateGalleryProps = {
  state: 'success',
  coverage: galleryCoverage(STATE_GALLERY_MANIFEST),
  groups: STATE_GALLERY_MANIFEST.groups,
  screens: STATE_GALLERY_MANIFEST.screens,
  coverageByScreen: FULL_COVERAGE_BY_SCREEN,
  selectedScreenId: 'system/StateGallery',
  searchText: '',
  toolbar: {
    isDarkTheme: false,
    isReducedMotion: false,
    isSpacingGridVisible: false,
  },
  isCollapsed: false,
  checkRows: [],
  isCheckRunning: false,
  errorMessage: null,
  onSelectScreen: NO_OP,
  onSearchTextChange: NO_OP_STRING,
  onToggleDarkTheme: NO_OP,
  onToggleReducedMotion: NO_OP,
  onToggleSpacingGrid: NO_OP,
  onRunQuickCheck: NO_OP,
  onToggleCollapsed: NO_OP,
  onRetry: NO_OP,
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái, cùng thứ tự A11.                                            */
/* -------------------------------------------------------------------------- */

const PROPS_BY_STATE: Readonly<Record<SevenState, StateGalleryProps>> = {
  // Chưa chọn màn nào.
  empty: {
    ...BASE,
    state: 'empty',
    selectedScreenId: null,
  },

  // Đang chạy phép kiểm nhanh trên toàn bộ cây.
  loading: {
    ...BASE,
    state: 'loading',
    isCheckRunning: true,
  },

  // Manifest có một màn thiếu trạng thái — kịch bản DUY NHẤT dùng manifest một phần.
  partial: {
    ...BASE,
    state: 'partial',
    coverage: galleryCoverage(PARTIAL_MANIFEST),
    screens: PARTIAL_MANIFEST.screens,
    coverageByScreen: PARTIAL_COVERAGE_BY_SCREEN,
    selectedScreenId: PARTIAL_SCREEN_ID,
  },

  // Không tải được manifest.
  error: {
    ...BASE,
    state: 'error',
    selectedScreenId: null,
    errorMessage: `Không tải được danh sách ${String(STATE_GALLERY_MANIFEST.screens.length)} màn. Thử lại sau.`,
  },

  // Manifest đầy đủ 329/329 trên 47 màn.
  success: BASE,

  // Ngoài nội bộ không vào được trang này.
  forbidden: {
    ...BASE,
    state: 'forbidden',
    selectedScreenId: null,
    screens: [],
    coverageByScreen: {},
    coverage: {
      presentCount: 0,
      totalCount: 0,
      screenCount: 0,
      incompleteScreens: [],
    },
  },

  // Thu gọn cây bên trái.
  collapsed: {
    ...BASE,
    state: 'collapsed',
    isCollapsed: true,
  },
};

/** Props đầy đủ của một trạng thái. Dùng chung bởi bài kiểm và story (R-70). */
export function stateGalleryScenarioFor(state: SevenState): StateGalleryProps {
  return PROPS_BY_STATE[state];
}
