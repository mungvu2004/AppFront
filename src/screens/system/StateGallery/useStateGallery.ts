/**
 * Toàn bộ logic của màn duyệt bảy trạng thái (S-47).
 *
 * Hook này NỐI LẠI dữ liệu đã có (R-61), không tự chế công thức:
 *
 * - **Manifest** — `stateGalleryManifest` (W1) khai 47 màn, mỗi màn 7 trạng
 *   thái. Số đếm (`ScreenCoverage`, `GalleryCoverage`) suy thẳng từ
 *   `storyExportName === null` của từng trạng thái — không viết tay 329.
 * - **Ba công tắc của thanh công cụ** — chủ đề tối đi thẳng qua
 *   `useTheme()` (toàn cục, `src/hooks/useTheme.ts`), vì trang này KHÔNG có
 *   chủ đề riêng. Giảm chuyển động đọc/ghi đúng thuộc tính
 *   `REDUCED_MOTION_ATTRIBUTE` mà `useAccountPreferences.ts` đã đặt tên, và
 *   trả thuộc tính cũ lại lúc rời trang để không đè lên tuỳ chọn thật của
 *   người dùng. Lưới canh chỉ là một cờ hiển thị cục bộ, không thuộc tính DOM
 *   nào cả.
 * - **Bốn phép kiểm nhanh (O-03)** — chạy THẬT, không bịa:
 *   - `sevenStates`: suy từ chính manifest, có dữ liệu thật cho cả 47 màn.
 *   - `vietnamese` / `accessible`: gọi thẳng `findNonVietnamese` /
 *     `inspectAccessibility` của `src/lib/testing` trên phần tử DOM của khung
 *     xem trước (`[data-state-gallery-preview]`, do view của màn ĐANG CHỌN
 *     dựng). Chỉ hàng của màn đang chọn có khung đó trong DOM, nên 46 hàng
 *     còn lại đứng ở `pending` kèm lý do — không phải "hỏng", là "chưa chạy
 *     được" (mục E.10).
 *   - `noRawColor`: `expectNoRawColor` đọc tệp qua `node:fs`
 *     (`expectNoRawColor.ts:287-292`), không chạy được trong trình duyệt.
 *     Đứng `pending` vĩnh viễn kèm lý do kỹ thuật, không viết `fail` bịa và
 *     không viết `pass` bịa.
 *
 * ## Trạng thái tải: không một `useState` rời rạc kiểu máy chủ (R-64)
 *
 * Trang không có dữ liệu máy chủ nào — mọi thứ tĩnh, cục bộ. `isCheckRunning`
 * là cờ của MỘT thao tác cục bộ (bốn phép kiểm chạy giả lập có độ trễ để
 * người dùng thấy "đang chạy" thật), không phải trạng thái máy chủ, nên
 * `useState` thường là đúng chỗ — không có gì để cắm vào `src/lib/query`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { REDUCED_MOTION_ATTRIBUTE } from '@/screens/account/AccountSettings/useAccountPreferences';
import { useTheme } from '@/hooks/useTheme';
import { inspectAccessibility } from '@/lib/testing/expectAccessible';
import { findNonVietnamese } from '@/lib/testing/expectVietnamese';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { isDevelopmentBuild } from '@/lib/telemetry/flags';

import { STATE_GALLERY_MANIFEST } from './stateGalleryManifest';
import type {
  GalleryCoverage,
  GalleryManifest,
  GalleryScreenEntry,
  QuickCheckCell,
  QuickCheckId,
  QuickCheckRow,
  ReviewToolbarState,
  ScreenCoverage,
  ScreenGroup,
  SevenState,
  StateGalleryProps,
} from './stateGalleryTypes';
import { QUICK_CHECK_IDS } from './stateGalleryTypes';

/* -------------------------------------------------------------------------- */
/* Hằng.                                                                       */
/* -------------------------------------------------------------------------- */

/** Chọn phần tử DOM của khung xem trước — do view của màn đang chọn dựng. */
const PREVIEW_FRAME_SELECTOR = '[data-state-gallery-preview]';

/** Cùng khuyến nghị của bộ khẳng định dùng chung — bỏ qua backdrop dialog. */
const A11Y_IGNORE_SELECTOR = '[role=dialog]';

const MANIFEST_ERROR_MESSAGE =
  'không đọc được danh sách bốn mươi bảy màn; thử tải lại.';

const NO_RAW_COLOR_PENDING_DETAIL =
  'phép kiểm màu thô đọc thẳng tệp mã nguồn qua node:fs; trình duyệt không chạy được node:fs nên phép kiểm này chạy ở pnpm verify, không chạy được ở đây.';

const PREVIEW_NOT_SELECTED_DETAIL =
  'chỉ màn đang chọn mới có khung xem trước đã dựng trong trang; chọn màn này rồi chạy lại kiểm nhanh để có kết quả thật.';

const PREVIEW_FRAME_MISSING_DETAIL =
  'chưa tìm thấy khung xem trước đã dựng trong trang; khung xem trước có thể chưa gắn xong.';

const EMPTY_GROUPS: readonly ScreenGroup[] = Object.freeze([]);
const EMPTY_SCREENS: readonly GalleryScreenEntry[] = Object.freeze([]);
const EMPTY_CHECK_ROWS: readonly QuickCheckRow[] = Object.freeze([]);
const EMPTY_COVERAGE_BY_SCREEN: Readonly<Record<string, ScreenCoverage>> = Object.freeze({});
const EMPTY_COVERAGE: GalleryCoverage = Object.freeze({
  presentCount: 0,
  totalCount: 0,
  screenCount: 0,
  incompleteScreens: [],
});

/* -------------------------------------------------------------------------- */
/* Manifest — nạp có phòng lỗi.                                                */
/* -------------------------------------------------------------------------- */

type ManifestResult =
  | { readonly ok: true; readonly groups: readonly ScreenGroup[]; readonly screens: readonly GalleryScreenEntry[] }
  | { readonly ok: false; readonly message: string };

/** Coi mọi hình dạng lạ (kể cả `undefined` lúc lớp gộp chưa nối xong) là lỗi. */
const readManifest = (manifest: GalleryManifest): ManifestResult => {
  try {
    if (!Array.isArray(manifest.screens) || !Array.isArray(manifest.groups)) {
      throw new Error(MANIFEST_ERROR_MESSAGE);
    }

    return { ok: true, groups: manifest.groups, screens: manifest.screens };
  } catch {
    return { ok: false, message: MANIFEST_ERROR_MESSAGE };
  }
};

/* -------------------------------------------------------------------------- */
/* Số đếm — suy từ manifest, không viết tay (A14/329).                         */
/* -------------------------------------------------------------------------- */

const coverageOfScreen = (screen: GalleryScreenEntry): ScreenCoverage => {
  const missing = screen.states.filter((entry) => entry.storyExportName === null);

  return {
    screenId: screen.id,
    presentCount: screen.states.length - missing.length,
    totalCount: screen.states.length,
    missingLabels: missing.map((entry) => entry.label),
  };
};

interface DerivedCoverage {
  readonly coverage: GalleryCoverage;
  readonly coverageByScreen: Readonly<Record<string, ScreenCoverage>>;
}

const deriveCoverage = (screens: readonly GalleryScreenEntry[]): DerivedCoverage => {
  const perScreen = screens.map(coverageOfScreen);
  const coverageByScreen: Record<string, ScreenCoverage> = {};

  let presentCount = 0;
  let totalCount = 0;
  const incompleteScreens: ScreenCoverage[] = [];

  for (const entry of perScreen) {
    coverageByScreen[entry.screenId] = entry;
    presentCount += entry.presentCount;
    totalCount += entry.totalCount;

    if (entry.missingLabels.length > 0) {
      incompleteScreens.push(entry);
    }
  }

  return {
    coverage: { presentCount, totalCount, screenCount: screens.length, incompleteScreens },
    coverageByScreen,
  };
};

/* -------------------------------------------------------------------------- */
/* Bốn phép kiểm nhanh — một ô.                                                */
/* -------------------------------------------------------------------------- */

const passCell = (checkId: QuickCheckId): QuickCheckCell => ({ checkId, status: 'pass', detail: null });

const failCell = (checkId: QuickCheckId, detail: string): QuickCheckCell => ({
  checkId,
  status: 'fail',
  detail,
});

const pendingCell = (checkId: QuickCheckId, detail: string): QuickCheckCell => ({
  checkId,
  status: 'pending',
  detail,
});

const sevenStatesCell = (coverage: ScreenCoverage): QuickCheckCell => {
  if (coverage.missingLabels.length === 0) {
    return passCell('sevenStates');
  }

  return failCell('sevenStates', `còn thiếu trạng thái: ${coverage.missingLabels.join(', ')}.`);
};

/** `vietnamese` / `accessible` chỉ chạy thật khi có khung xem trước của ĐÚNG màn này. */
const domCheckCell = (
  checkId: 'vietnamese' | 'accessible',
  screen: GalleryScreenEntry,
  selectedScreenId: string | null,
  previewFrame: HTMLElement | null,
): QuickCheckCell => {
  if (screen.id !== selectedScreenId) {
    return pendingCell(checkId, PREVIEW_NOT_SELECTED_DETAIL);
  }

  if (previewFrame === null) {
    return pendingCell(checkId, PREVIEW_FRAME_MISSING_DETAIL);
  }

  try {
    if (checkId === 'vietnamese') {
      const issues = findNonVietnamese(previewFrame);

      return issues.length === 0
        ? passCell(checkId)
        : failCell(checkId, issues.map((issue) => issue.reason).join('; '));
    }

    const report = inspectAccessibility(previewFrame, { ignoreSelector: A11Y_IGNORE_SELECTOR });

    return report.issues.length === 0
      ? passCell(checkId)
      : failCell(checkId, report.issues.map((issue) => issue.reason).join('; '));
  } catch (caught) {
    return failCell(checkId, caught instanceof Error ? caught.message : String(caught));
  }
};

const buildCheckRow = (
  screen: GalleryScreenEntry,
  coverage: ScreenCoverage,
  selectedScreenId: string | null,
  previewFrame: HTMLElement | null,
): QuickCheckRow => ({
  screenId: screen.id,
  screenLabel: screen.label,
  cells: QUICK_CHECK_IDS.map((checkId): QuickCheckCell => {
    switch (checkId) {
      case 'sevenStates':
        return sevenStatesCell(coverage);
      case 'noRawColor':
        return pendingCell('noRawColor', NO_RAW_COLOR_PENDING_DETAIL);
      case 'vietnamese':
      case 'accessible':
        return domCheckCell(checkId, screen, selectedScreenId, previewFrame);
    }
  }),
});

const runningRow = (screen: GalleryScreenEntry): QuickCheckRow => ({
  screenId: screen.id,
  screenLabel: screen.label,
  cells: QUICK_CHECK_IDS.map((checkId): QuickCheckCell => ({ checkId, status: 'running', detail: null })),
});

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useStateGallery(): StateGalleryProps {
  const { theme, toggle: onToggleDarkTheme } = useTheme();

  const [retryToken, setRetryToken] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(
    () => document.documentElement.hasAttribute(REDUCED_MOTION_ATTRIBUTE),
  );
  const [isSpacingGridVisible, setIsSpacingGridVisible] = useState(false);
  const [checkRows, setCheckRows] = useState<readonly QuickCheckRow[]>(EMPTY_CHECK_ROWS);
  const [isCheckRunning, setIsCheckRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Đồng bộ giảm chuyển động ra thuộc tính toàn cục, và trả lại giá trị cũ lúc
  // rời trang — công cụ nội bộ không được đè vĩnh viễn lên tuỳ chọn thật.
  useEffect(() => {
    const root = document.documentElement;
    const hadAttribute = root.hasAttribute(REDUCED_MOTION_ATTRIBUTE);

    if (isReducedMotion) {
      root.setAttribute(REDUCED_MOTION_ATTRIBUTE, 'true');
    } else {
      root.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    }

    return () => {
      if (hadAttribute) {
        root.setAttribute(REDUCED_MOTION_ATTRIBUTE, 'true');
      } else {
        root.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
      }
    };
  }, [isReducedMotion]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );

  // Đổi màn đang chọn thì kết quả kiểm cũ hết còn đúng — khung xem trước của
  // màn khác không tồn tại trong DOM nữa.
  useEffect(() => {
    setCheckRows(EMPTY_CHECK_ROWS);
  }, [selectedScreenId]);

  const manifestResult = useMemo<ManifestResult>(
    () => readManifest(STATE_GALLERY_MANIFEST),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retryToken chỉ để buộc tính lại.
    [retryToken],
  );

  const groups = manifestResult.ok ? manifestResult.groups : EMPTY_GROUPS;
  const allScreens = manifestResult.ok ? manifestResult.screens : EMPTY_SCREENS;

  const { coverage, coverageByScreen } = useMemo(
    () => (manifestResult.ok ? deriveCoverage(allScreens) : { coverage: EMPTY_COVERAGE, coverageByScreen: EMPTY_COVERAGE_BY_SCREEN }),
    [allScreens, manifestResult.ok],
  );

  const screens = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (query.length === 0) {
      return allScreens;
    }

    return allScreens.filter(
      (screen) =>
        screen.label.toLowerCase().includes(query) ||
        screen.name.toLowerCase().includes(query) ||
        screen.area.toLowerCase().includes(query),
    );
  }, [allScreens, searchText]);

  const isDev = isDevelopmentBuild();

  const state = useMemo<SevenState>(() => {
    if (!isDev) {
      return 'forbidden';
    }

    if (!manifestResult.ok) {
      return 'error';
    }

    if (isCheckRunning) {
      return 'loading';
    }

    if (selectedScreenId === null) {
      return 'empty';
    }

    if (isCollapsed) {
      return 'collapsed';
    }

    return coverage.incompleteScreens.length > 0 ? 'partial' : 'success';
  }, [coverage.incompleteScreens.length, isCheckRunning, isCollapsed, isDev, manifestResult.ok, selectedScreenId]);

  const onSelectScreen = useCallback((screenId: string): void => {
    setSelectedScreenId(screenId);
  }, []);

  const onSearchTextChange = useCallback((value: string): void => {
    setSearchText(value);
  }, []);

  const onToggleReducedMotion = useCallback((): void => {
    setIsReducedMotion((current) => !current);
  }, []);

  const onToggleSpacingGrid = useCallback((): void => {
    setIsSpacingGridVisible((current) => !current);
  }, []);

  const onToggleCollapsed = useCallback((): void => {
    setIsCollapsed((current) => !current);
  }, []);

  const onRetry = useCallback((): void => {
    setRetryToken((current) => current + 1);
  }, []);

  const onRunQuickCheck = useCallback((): void => {
    if (isCheckRunning || allScreens.length === 0) {
      return;
    }

    setIsCheckRunning(true);
    setCheckRows(allScreens.map(runningRow));

    timerRef.current = setTimeout(() => {
      const previewFrame = document.querySelector<HTMLElement>(PREVIEW_FRAME_SELECTOR);

      setCheckRows(
        allScreens.map((screen) =>
          buildCheckRow(screen, coverageByScreen[screen.id] ?? coverageOfScreen(screen), selectedScreenId, previewFrame),
        ),
      );
      setIsCheckRunning(false);
      timerRef.current = null;
    }, MOTION_DURATIONS_MS.standard);
  }, [allScreens, coverageByScreen, isCheckRunning, selectedScreenId]);

  const toolbar: ReviewToolbarState = {
    isDarkTheme: theme === 'dark',
    isReducedMotion,
    isSpacingGridVisible,
  };

  return {
    state,
    coverage,
    groups,
    screens,
    coverageByScreen,
    selectedScreenId,
    searchText,
    toolbar,
    isCollapsed,
    checkRows,
    isCheckRunning,
    errorMessage: manifestResult.ok ? null : manifestResult.message,
    onSelectScreen,
    onSearchTextChange,
    onToggleDarkTheme,
    onToggleReducedMotion,
    onToggleSpacingGrid,
    onRunQuickCheck,
    onToggleCollapsed,
    onRetry,
  };
}
