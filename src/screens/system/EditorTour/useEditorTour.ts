/**
 * Lớp dạy việc sáu bước chạy đè lên màn QC tường và màn 3D.
 *
 * Nguyên tắc chi phối mọi quyết định trong file này: **dạy bằng cách để người ta
 * làm**. Lớp này không bao giờ chặn — phần tử đang được tô sáng vẫn bấm được, vẫn
 * nhận được phím của chính nó, và Esc hay một cú bấm ra nền là thoát ngay, không
 * hỏi lại. Vì vậy hook KHÔNG dựng bẫy tiêu điểm (`createFocusTrap` kéo tiêu điểm
 * vào trong lớp phủ và chặn Tab thoát ra — đúng thứ lớp dạy việc không được làm)
 * và KHÔNG claim phạm vi `dialog` (phạm vi modal nuốt mọi phím nó không bind).
 *
 * Hook chỉ NỐI LẠI logic đã có (R-61): phím đọc từ `appShortcutRegistry`, neo đọc
 * từ DOM thật, giảm chuyển động đọc từ `useReducedMotion`. Không công thức nào
 * được chế ra ở đây.
 *
 * ## Không có telemetry theo bước — đã kiểm, không phải bỏ quên
 *
 * Đặc tả gốc đòi ghi một sự kiện cho mỗi bước qua O-01. Việc đó KHÔNG làm được và
 * cũng không được giả vờ là làm được: `TELEMETRY_EVENT_SCHEMA`
 * (`src/lib/telemetry/events.ts`) là một union ĐÓNG gồm đúng mười hai tên sự kiện,
 * và `parseTelemetryEvent` (`events.ts:511`) từ chối thẳng mọi tên nằm ngoài danh
 * sách đó. Thêm `tour.*` nghĩa là sửa `src/lib/telemetry/events.ts` — một file mà
 * R-68 và mục 10 của hợp đồng cấm lượt này chạm vào. Nên chỗ sửa là BỎ HẲN phần
 * ghi sự kiện, không phải dựng một `sendEvent` cụt gọi vào chỗ trống rồi để người
 * đọc sau tưởng lớp này có đo đạc. Khi nào union được mở, chỗ phải sửa là hook này
 * và không chỗ nào khác. (Cùng khuôn với ghi chú `shortcutApprove` ở
 * `src/screens/qc/WallLayerReview/useWallLayerReview.ts:232`.)
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useShortcut } from '@/hooks/useShortcut';
import {
  appShortcutRegistry,
  type RegisteredShortcut,
  type ShortcutDefinition,
  type ShortcutKeyEvent,
  type ShortcutRegistry,
  type ShortcutScope,
} from '@/lib/input/shortcutRegistry';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* -------------------------------------------------------------------------- */
/* Kiểu — nguồn duy nhất cho cả bốn worker của màn này.                        */
/* -------------------------------------------------------------------------- */

/** Sáu bước, theo thứ tự dạy. Mã tiếng Anh (mục B / E.11). */
export const TOUR_STEP_IDS = [
  'switchTool',
  'reviewWall',
  'editThickness',
  'undo',
  'view3d',
  'exportResult',
] as const;

export type TourStepId = (typeof TOUR_STEP_IDS)[number];

/** Hình chữ nhật của điểm neo, toạ độ khung nhìn, đơn vị px. */
export interface TourRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

/** Thẻ đứng phía nào so với neo. Mũi nhọn 8px chỉ ngược lại. */
export type TourPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * Một bước ĐÃ SỐNG SÓT, sẵn sàng để vẽ.
 *
 * Bước không có CẢ phím lẫn neo thì không có mặt trong mảng — bị bỏ lặng lẽ và
 * bộ đếm rút theo. `steps.length` LÀ mẫu số của bộ đếm "3 / 6".
 */
export interface TourStepView {
  readonly id: TourStepId;
  /** Tiêu đề h3, tiếng Việt viết thường kiểu câu (A6). */
  readonly title: string;
  /** Một hoặc hai câu. Không trùng câu nào của S-06. */
  readonly body: string;
  /**
   * Combo THẬT, đọc từ registry lúc chạy — KHÔNG BAO GIỜ là chữ cứng.
   * `null` khi bước này không có phím nào được đăng ký (bước 5 và 6 hôm nay):
   * lúc đó thẻ KHÔNG vẽ `<Kbd>` mà chỉ trỏ vào điều khiển thật.
   */
  readonly combo: string | null;
  /** Câu mô tả phím, từ `RegisteredShortcut.description`. */
  readonly comboDescription: string | null;
  /** Ô của phần tử thật. `null` khi không dò được, hoặc khi thu gọn. */
  readonly anchorRect: TourRect | null;
  readonly placement: TourPlacement;
}

/** Một dòng của thẻ tổng kết: phím vừa học. */
export interface TourSummaryRow {
  readonly id: TourStepId;
  readonly label: string;
  readonly combo: string;
}

/**
 * Props của view. View THUẦN: không chạm store, mạng, `@/api`, `@/domain`
 * (R-60, luật `local/no-data-layer-in-view`). Mọi thứ nó cần nằm ở đây.
 */
export interface EditorTourProps {
  readonly screenState: SevenState;
  /** Chỉ các bước sống sót. `steps.length` là mẫu số bộ đếm. */
  readonly steps: readonly TourStepView[];
  /** Chỉ số 0-based vào `steps`. `-1` khi không bước nào đang mở. */
  readonly activeIndex: number;
  /** Ô để khoét thủng. `null` thì không khoét. */
  readonly cutout: TourRect | null;
  /** Dưới 1280: tấm trượt đáy, không khoét thủng. */
  readonly isCollapsed: boolean;
  /** Giảm chuyển động: hoà tan 120ms, vùng khoét đứng yên. */
  readonly isReducedMotion: boolean;
  /** Thẻ tổng kết ở `success`; rỗng ở mọi trạng thái khác. */
  readonly summary: readonly TourSummaryRow[];
  /** Chip "xem hướng dẫn" — ở lại suốt phiên sau khi bỏ qua. */
  readonly isSkipChipVisible: boolean;
  /** Câu cho trình đọc màn hình khi sang bước (vùng lịch sự). */
  readonly liveMessage: string;
  onNext(): void;
  onSkip(): void;
  /** Bấm một chấm để nhảy. `index` là chỉ số vào `steps`. */
  onJump(index: number): void;
  /** Nút chính của thẻ tổng kết. */
  onFinish(): void;
  /** Chip "xem hướng dẫn" — đường quay lại nhìn thấy được. */
  onReopen(): void;
  /** Trạng thái `loading`: mời mở dự án mẫu. */
  onOpenSampleProject(): void;
}

/** Hook trả về ĐÚNG props của view. Container chỉ việc rải ra. */
export type UseEditorTourResult = EditorTourProps;

export interface UseEditorTourOptions {
  /** Ai đang xem. `null` = chưa đăng nhập: không đọc ghi cờ nào. */
  readonly userId?: string | null;
  /**
   * Màn chủ đang cõng lớp dạy việc này — `'wall-layer-review'`, `'viewer-shell'`,
   * `'export-panel'`.
   *
   * Sáu bước KHÔNG nằm trên một màn: bốn bước đầu neo vào màn Duyệt lớp tường,
   * bước `view3d` neo vào thanh trên của vỏ 3D, bước `exportResult` neo vào nút
   * xuất. Nên lớp này được mount ở BA chỗ, và mỗi chỗ chỉ dạy được phần bước mà
   * nó có neo hoặc có phím — luật sống sót ở {@link buildSteps} tự lọc phần còn
   * lại, đúng thứ trạng thái `error` của đặc tả đã lường trước.
   *
   * Vì thế cờ đã xem phải tách theo host. Không có nó thì host nào chạy trước sẽ
   * ghi `'true'` và HAI host kia vĩnh viễn không hiện — người dùng học xong bốn
   * bước ở màn QC rồi không bao giờ được chỉ nút chuyển 3D. Đó là lỗi im lặng,
   * nên `hostId` không có giá trị mặc định "đoán được": thiếu nó là thiếu thật.
   */
  readonly hostId?: string;
  /** Vai; vai người xem chỉ được ba bước xem. */
  readonly role?: string | undefined;
  /** Test tiêm registry giả; mặc định `appShortcutRegistry`. */
  readonly registry?: ShortcutRegistry;
  /** Test tiêm hàm dò neo; mặc định đọc DOM thật. */
  readonly resolveAnchor?: (id: TourStepId) => TourRect | null;
  /** Test ép trạng thái để dựng bảy trạng thái. */
  readonly forcedState?: SevenState;
  /** Chưa nạp mô hình → trạng thái `loading`. */
  readonly hasModel?: boolean;
  onOpenSampleProject?: (() => void) | undefined;
}

/* -------------------------------------------------------------------------- */
/* Bảng sáu bước.                                                              */
/* -------------------------------------------------------------------------- */

/** Một bước như nó được KHAI; `TourStepView` là bước đã dò xong và sống sót. */
interface TourStepDefinition {
  readonly id: TourStepId;
  /** Chọn lọc DOM ổn định của màn chủ. `null` khi bước không dò bằng chọn lọc. */
  readonly anchorSelector: string | null;
  /** `id` để tra `RegisteredShortcut`. `null` khi hôm nay chưa có phím nào. */
  readonly shortcutId: string | null;
  readonly title: string;
  readonly body: string;
  readonly placement: TourPlacement;
}

/**
 * Sáu bước, theo thứ tự dạy.
 *
 * Bước 4 không có neo (`HistoryPanel` mồ côi, không màn nào dựng) và sống nhờ có
 * phím; bước 5 và 6 không có phím nào được đăng ký và sống nhờ có neo. Không bịa
 * combo cho hai bước cuối: `3` trong `components/overlay/CommandPalette.tsx:28` và
 * `components/shell/ShortcutHelp.tsx:43` là dữ liệu chết của vỏ demo, `onSelect`
 * rỗng và danh sách viết tay, không đi qua registry nào.
 */
const TOUR_STEPS: readonly TourStepDefinition[] = [
  {
    id: 'switchTool',
    anchorSelector: '[role="toolbar"][aria-label="Công cụ lớp tường"]',
    shortcutId: 'wallLayerReview.tool.drawWall',
    title: 'chọn công cụ ở ray bên trái',
    body: 'mỗi công cụ ứng một phím; bấm phím là ray đổi ngay, tay bạn không phải rời khỏi mặt bằng.',
    placement: 'right',
  },
  {
    id: 'reviewWall',
    anchorSelector: '[role="listbox"][aria-label="Danh sách đoạn tường"]',
    shortcutId: 'wallLayerReview.next',
    title: 'đi dọc từng đoạn tường',
    body: 'một phím đưa bạn xuống đoạn kế tiếp, và hàng đang đứng luôn được kéo vào tầm mắt.',
    placement: 'right',
  },
  {
    id: 'editThickness',
    anchorSelector: '[aria-label="Độ dày tường"]',
    shortcutId: 'wallLayerReview.thickness.1',
    title: 'đặt lại độ dày cho đoạn đang chọn',
    body: 'ô độ dày chỉ hiện ra sau khi bạn chọn một đoạn; những nấc hay dùng nằm sẵn trên phím số.',
    placement: 'left',
  },
  {
    id: 'undo',
    anchorSelector: null,
    shortcutId: 'wallLayerReview.undo',
    title: 'lùi lại khi lỡ tay',
    body: 'ở đây không có nút lưu, nên cứ thử thoải mái: mọi thao tác đều lùi lại được bằng một phím.',
    placement: 'bottom',
  },
  {
    id: 'view3d',
    anchorSelector: '[role="radiogroup"][aria-label="Chế độ xem"]',
    shortcutId: null,
    title: 'đổi sang khung nhìn khối',
    body: 'nhóm nút trên thanh trên lật qua lại giữa mặt bằng phẳng và khối dựng; chỗ này chưa gắn phím nào.',
    placement: 'bottom',
  },
  {
    id: 'exportResult',
    /*
     * Nút xuất (`export/ExportPanel/ExportPanelFooter.tsx`) không có `aria-label`,
     * `id` hay lớp css nào ổn định — tên khẳng định của nó CHÍNH LÀ chữ "xuất"
     * hiện trên nút, mà `querySelector` không chọn được theo tên khẳng định. Nên
     * nút đó mang một `data-tour-anchor` thuần bổ sung: không đổi hành vi, không
     * đụng khả năng tiếp cận, và không vỡ khi ai đó sửa lại chữ trên nút.
     */
    anchorSelector: '[data-tour-anchor="exportResult"]',
    shortcutId: null,
    title: 'lấy tệp mang đi',
    body: 'nút ở chân bảng chỉ sáng lên khi đã có thứ để lấy, và cũng chưa gắn phím nào.',
    placement: 'top',
  },
];

/**
 * Bước 6 dò neo bằng vai trò và NHÃN, không bằng chọn lọc thuộc tính.
 *
 * Nút xuất được nhận ra bằng câu khẳng định "xuất" trong nhãn của nó
 * (`ExportPanelFooter.tsx:65-67`), thứ `document.querySelector` không diễn đạt
 * được — nên riêng bước này dò bằng một vòng lọc trên `role="button"`.
 */
const EXPORT_BUTTON_SELECTOR = 'button, [role="button"]';
const EXPORT_BUTTON_LABEL = 'xuất';

/** Vai người xem chỉ được ba bước XEM; ba bước sửa không có phím nào cho vai này. */
const VIEWER_STEP_IDS: readonly TourStepId[] = ['reviewWall', 'view3d', 'exportResult'];

/** Vai người xem, đúng chữ `ProjectRole` dùng (`src/types/project.ts:1`). */
const VIEWER_ROLE = 'viewer';

/** `id` của hai binding lớp phủ này tự đăng ký. */
const TOUR_ADVANCE_SHORTCUT_ID = 'editorTour.advance';
const TOUR_SKIP_SHORTCUT_ID = 'editorTour.skip';

const EMPTY_SUMMARY: readonly TourSummaryRow[] = Object.freeze([]);

/* -------------------------------------------------------------------------- */
/* Cờ "đã xem lớp dạy việc".                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Tên khoá `localStorage` này VIẾT TAY, ngay trong một màn.
 *
 * Nói thẳng ra vì R-71 bình thường cấm đúng việc này: hằng số — thời lượng,
 * ngưỡng, tên khoá lưu trữ — không được sinh ra trong một màn hình. Gate G1
 * (`gate_daac5b385955`, quyết định 1) vẫn chấp nhận ngoại lệ này, lý do là repo
 * KHÔNG có kho tuỳ chọn theo từng người dùng nào để cắm vào: `flags.ts` là cờ
 * tính năng của cả ứng dụng chứ không phải trạng thái riêng của một người, và
 * `src/store` không giữ gì bền theo `user.id`. Kỹ thuật đọc/ghi bên dưới chép từ
 * `src/hooks/useTheme.ts:12-27`, cùng khuôn ba hàm của S-06
 * (`useWelcomeScreen.ts:147-193`). Khi nào có kho tuỳ chọn thật, chỗ phải sửa là
 * ba hàm ngay dưới đây và không chỗ nào khác.
 *
 * Khoá gồm BA phần: tiền tố (là "màn" — lớp này, tách khỏi cờ của màn chào),
 * `userId` (hai người trên cùng một máy không cướp cờ của nhau), và `hostId`.
 *
 * Phần thứ ba là phần dễ quên nhất và hỏng im lặng nhất: lớp này mount ở ba màn
 * chủ, mỗi chỗ dạy một phần sáu bước. Gộp chung một cờ thì học xong ở màn QC là
 * hai màn kia tắt vĩnh viễn. Xem {@link UseEditorTourOptions.hostId}.
 */
const TOUR_SEEN_KEY_PREFIX = 'appfront:system-editor-tour-seen:';

/**
 * Host dùng khi nơi gọi quên truyền `hostId`.
 *
 * Vẫn là một khoá riêng chứ không phải rỗng: gộp vào khoá của một host thật sẽ
 * làm host đó tắt hướng dẫn vì lý do không liên quan. Tên có chữ `unknown` để
 * ai đọc `localStorage` lúc gỡ lỗi thấy ngay là có chỗ gọi thiếu tham số.
 */
const UNKNOWN_HOST_ID = 'unknown-host';

/**
 * Giá trị ghi vào khoá trên. Chỉ có ba khả năng nên không cần dấu ngăn nào:
 * thiếu khoá là "chưa xem"; `'true'` là "đã xem xong"; còn lại là mã bước đang
 * dừng, để trạng thái `partial` mở lại đúng chỗ.
 */
const TOUR_SEEN_VALUE = 'true';

/** Người này đã xem tới đâu. */
interface TourProgress {
  readonly isFinished: boolean;
  readonly stoppedStepId: TourStepId | null;
}

const NO_PROGRESS: TourProgress = Object.freeze({
  isFinished: false,
  stoppedStepId: null,
});

function tourSeenKey(userId: string, hostId: string): string {
  return `${TOUR_SEEN_KEY_PREFIX}${userId}:${hostId}`;
}

const isTourStepId = (value: string): value is TourStepId =>
  (TOUR_STEP_IDS as readonly string[]).includes(value);

/**
 * Đọc cờ. Cửa sổ ẩn danh ném ngay ở `localStorage.getItem`, nên mọi lần đọc đều
 * nằm trong try/catch và "không đọc được" quy về "chưa xem".
 */
function readTourProgress(userId: string | null, hostId: string): TourProgress {
  if (userId === null) return NO_PROGRESS;
  try {
    const raw = window.localStorage.getItem(tourSeenKey(userId, hostId));
    if (raw === null) return NO_PROGRESS;
    if (raw === TOUR_SEEN_VALUE) return { isFinished: true, stoppedStepId: null };
    if (isTourStepId(raw)) return { isFinished: false, stoppedStepId: raw };
    return NO_PROGRESS;
  } catch {
    return NO_PROGRESS;
  }
}

/** Ghi cờ. Ẩn danh ném ở `setItem`; hỏng cũng không được làm hỏng màn chủ. */
function writeTourProgress(userId: string | null, hostId: string, value: string): void {
  if (userId === null) return;
  try {
    window.localStorage.setItem(tourSeenKey(userId, hostId), value);
  } catch {
    // Không có chỗ lưu thì lớp dạy việc hiện lại lần sau — phiền, không hỏng.
  }
}

/* -------------------------------------------------------------------------- */
/* Dò neo và bề ngang màn.                                                     */
/* -------------------------------------------------------------------------- */

function rectOf(element: Element): TourRect | null {
  const box = element.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  return { top: box.top, left: box.left, width: box.width, height: box.height };
}

/** Nút xuất: `role="button"` mang câu khẳng định "xuất" trong nhãn của nó. */
function findExportButton(): Element | null {
  const candidates = Array.from(document.querySelectorAll(EXPORT_BUTTON_SELECTOR));
  return (
    candidates.find((element) => {
      const label = element.getAttribute('aria-label') ?? element.textContent ?? '';
      return label.toLocaleLowerCase('vi').includes(EXPORT_BUTTON_LABEL);
    }) ?? null
  );
}

/** Mặc định: đọc DOM thật. Test tiêm `options.resolveAnchor` để khỏi dựng màn chủ. */
function resolveAnchorFromDom(id: TourStepId): TourRect | null {
  if (typeof document === 'undefined') return null;
  try {
    if (id === 'exportResult') {
      const button = findExportButton();
      return button === null ? null : rectOf(button);
    }
    const selector = TOUR_STEPS.find((step) => step.id === id)?.anchorSelector ?? null;
    if (selector === null) return null;
    const element = document.querySelector(selector);
    return element === null ? null : rectOf(element);
  } catch {
    return null;
  }
}

/**
 * Bề ngang màn, đúng mức `useAppShell.ts:73` đang dùng.
 *
 * Dựng riêng thay vì gọi `useAppShell()`: hook đó đọc và ghi `localStorage` cho
 * hai bảng bên của vỏ ứng dụng, thứ một lớp phủ không có việc gì phải chạm — cùng
 * lý do `useShareDialog.ts:154` đã ghi.
 */
const COLLAPSED_MEDIA_QUERY = '(max-width: 1279px)';

function subscribeCollapsed(onStoreChange: () => void): () => void {
  const media = globalThis.matchMedia?.(COLLAPSED_MEDIA_QUERY);
  media?.addEventListener('change', onStoreChange);
  return (): void => {
    media?.removeEventListener('change', onStoreChange);
  };
}

function readCollapsed(): boolean {
  return globalThis.matchMedia?.(COLLAPSED_MEDIA_QUERY).matches ?? false;
}

/** Ô của neo đổi theo cuộn và theo cỡ cửa sổ, nên hai sự kiện đó bắt hook đo lại. */
function subscribeViewport(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return (): void => {};
  window.addEventListener('resize', onStoreChange);
  window.addEventListener('scroll', onStoreChange, true);
  return (): void => {
    window.removeEventListener('resize', onStoreChange);
    window.removeEventListener('scroll', onStoreChange, true);
  };
}

function readViewportKey(): string {
  if (typeof window === 'undefined') return '';
  return `${window.innerWidth}:${window.innerHeight}:${window.scrollX}:${window.scrollY}`;
}

const SERVER_VIEWPORT_KEY = (): string => '';
const SERVER_COLLAPSED = (): boolean => false;

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Lớp phủ đang chạy tới đâu trong phiên này. */
type TourPhase = 'running' | 'finished' | 'dismissed';

export function useEditorTour(options: UseEditorTourOptions = {}): UseEditorTourResult {
  const userId = options.userId ?? null;
  // Không đoán host: một mặc định im lặng gộp cờ của ba màn chủ làm một, và
  // triệu chứng là hai màn "tự nhiên không hiện hướng dẫn" — rất khó lần ra.
  const hostId = options.hostId ?? UNKNOWN_HOST_ID;
  const registry = options.registry ?? appShortcutRegistry;
  const resolveAnchor = options.resolveAnchor ?? resolveAnchorFromDom;
  const isViewer = options.role === VIEWER_ROLE;

  const [progress] = useState<TourProgress>(() => readTourProgress(userId, hostId));
  const [phase, setPhase] = useState<TourPhase>(progress.isFinished ? 'dismissed' : 'running');
  const [activeStepId, setActiveStepId] = useState<TourStepId | null>(progress.stoppedStepId);
  const [hasSkipped, setHasSkipped] = useState(false);

  const isReducedMotion = useReducedMotion();
  const isNarrow = useSyncExternalStore(subscribeCollapsed, readCollapsed, SERVER_COLLAPSED);

  // Buộc đo lại neo khi cửa sổ đổi cỡ hoặc màn chủ cuộn.
  useSyncExternalStore(subscribeViewport, readViewportKey, SERVER_VIEWPORT_KEY);

  // Đọc lại mỗi lượt render, KHÔNG giữ bản chép nào: người dùng đổi phím thì thẻ
  // đổi theo trong cùng một lượt render. Đây là khuôn `GlobalShortcutHelp.tsx:77`.
  const shortcutById = new Map<string, RegisteredShortcut>(
    registry.listShortcuts().map((entry) => [entry.id, entry]),
  );

  const allowed = TOUR_STEPS.filter((step) => !isViewer || VIEWER_STEP_IDS.includes(step.id));

  const steps: readonly TourStepView[] = allowed
    .map((step): TourStepView | null => {
      const binding = step.shortcutId === null ? undefined : shortcutById.get(step.shortcutId);
      const anchorRect = resolveAnchor(step.id);

      // Luật sống sót: có phím THẬT *hoặc* neo THẬT. Không có cả hai thì bước
      // biến mất LẶNG LẼ và bộ đếm rút theo — không báo lỗi, không ô trống.
      if (binding === undefined && anchorRect === null) return null;

      return {
        id: step.id,
        title: step.title,
        body: step.body,
        combo: binding?.combo ?? null,
        comboDescription: binding?.description ?? null,
        anchorRect,
        placement: step.placement,
      };
    })
    .filter((step): step is TourStepView => step !== null);

  const droppedCount = allowed.length - steps.length;

  const storedIndex =
    activeStepId === null ? 0 : steps.findIndex((step) => step.id === activeStepId);
  const runningIndex = steps.length === 0 ? -1 : Math.max(0, storedIndex);

  const screenState: SevenState = options.forcedState ?? deriveState();

  function deriveState(): SevenState {
    if (options.hasModel === false) return 'loading';
    if (phase === 'dismissed') return 'empty';
    if (phase === 'finished') return 'success';
    if (steps.length === 0) return 'empty';
    if (isViewer) return 'forbidden';
    if (droppedCount > 0) return 'error';
    if (isNarrow) return 'collapsed';
    return 'partial';
  }

  const isTourVisible =
    screenState !== 'empty' && screenState !== 'success' && screenState !== 'loading';
  const activeIndex = isTourVisible ? runningIndex : -1;
  const activeStep = activeIndex < 0 ? undefined : steps[activeIndex];
  const isCollapsed = isNarrow || screenState === 'collapsed';

  const summary: readonly TourSummaryRow[] =
    screenState === 'success'
      ? steps.flatMap((step) =>
          step.combo === null ? [] : [{ id: step.id, label: step.title, combo: step.combo }],
        )
      : EMPTY_SUMMARY;

  const liveMessage =
    activeStep === undefined
      ? ''
      : `bước ${activeIndex + 1} trên ${steps.length}: ${activeStep.title}`;

  const goToStep = (index: number): void => {
    const next = steps[index];
    if (next === undefined) return;
    setActiveStepId(next.id);
    writeTourProgress(userId, hostId, next.id);
  };

  const closeTour = (nextPhase: TourPhase): void => {
    setPhase(nextPhase);
    writeTourProgress(userId, hostId, TOUR_SEEN_VALUE);
  };

  const handleNext = (): void => {
    if (activeIndex < 0) return;
    if (activeIndex + 1 >= steps.length) {
      closeTour('finished');
      return;
    }
    goToStep(activeIndex + 1);
  };

  const handleSkip = (): void => {
    // Esc và bấm ra nền đều BỎ QUA, không hỏi lại — chip "xem hướng dẫn" ở lại
    // suốt phiên nên đường quay lại vẫn nhìn thấy được.
    setHasSkipped(true);
    closeTour('dismissed');
  };

  /* -- Bàn phím ----------------------------------------------------------- */

  const nextRef = useRef(handleNext);
  const skipRef = useRef(handleSkip);

  useEffect(() => {
    nextRef.current = handleNext;
    skipRef.current = handleSkip;
  });

  // Esc đi qua registry, không qua `addEventListener` tự chế (A12, R-54/R-72).
  // Phạm vi `canvas` chứ không `dialog`: `dialog` là phạm vi MODAL, nó nuốt mọi
  // phím nó không bind, và như thế là chặn người dùng làm việc.
  useShortcut(
    {
      id: TOUR_SKIP_SHORTCUT_ID,
      combo: 'Escape',
      scope: 'canvas',
      preventDefault: false,
      description: 'bỏ qua lớp hướng dẫn đang mở',
      onTrigger: (): void => {
        skipRef.current();
      },
    },
    { registry, enabled: isTourVisible },
  );

  const activeDefinition =
    activeStep === undefined
      ? undefined
      : TOUR_STEPS.find((step) => step.id === activeStep.id);
  const activeBinding =
    activeDefinition?.shortcutId === undefined || activeDefinition.shortcutId === null
      ? undefined
      : shortcutById.get(activeDefinition.shortcutId);
  const activeCombo = activeBinding?.combo ?? null;
  const activeScope: ShortcutScope | null = activeBinding?.scope ?? null;

  useEffect(() => {
    if (activeCombo === null || activeScope === null) return undefined;

    let dispose: (() => void) | null = null;

    const definition: ShortcutDefinition = {
      id: TOUR_ADVANCE_SHORTCUT_ID,
      combo: activeCombo,
      scope: activeScope,
      // Không tự `preventDefault`: quyền đó thuộc binding của màn chủ bên dưới.
      preventDefault: false,
      onTrigger: (event: ShortcutKeyEvent): void => {
        // Registry dừng ở binding khớp ĐẦU TIÊN và duyệt NGƯỢC theo thứ tự đăng
        // ký (`shortcutRegistry.ts:380-383`), nên binding này — đăng ký sau màn
        // chủ — luôn khớp trước. Muốn không NUỐT MẤT phím của màn chủ thì chỉ có
        // một cách: gỡ mình ra, đưa lại đúng phím đó cho registry phân xử, rồi
        // gắn lại. Phần tử được tô sáng nhờ thế vẫn hoạt động đầy đủ.
        dispose?.();
        dispose = null;
        registry.handleKeyDown(event, null);
        dispose = registry.register(definition);
        nextRef.current();
      },
    };

    dispose = registry.register(definition);

    return (): void => {
      dispose?.();
    };
  }, [registry, activeCombo, activeScope]);

  /* -- Props của view ------------------------------------------------------ */

  return {
    screenState,
    steps,
    activeIndex,
    cutout: isCollapsed ? null : (activeStep?.anchorRect ?? null),
    isCollapsed,
    isReducedMotion,
    summary,
    isSkipChipVisible: hasSkipped,
    liveMessage,
    onNext: handleNext,
    onSkip: handleSkip,
    onJump: goToStep,
    onFinish: (): void => {
      closeTour('dismissed');
    },
    onReopen: (): void => {
      setHasSkipped(false);
      setActiveStepId(null);
      setPhase('running');
    },
    onOpenSampleProject: (): void => {
      options.onOpenSampleProject?.();
    },
  };
}
