/**
 * Hai khối của T5: thông báo và phím tắt.
 *
 * Thông báo có thứ để lưu (`port.stage('notifications', …)`); phím tắt
 * thì không — nó chỉ đọc.
 *
 * **Không viết tay danh sách phím tắt.** `ShortcutRegistry` không có API
 * liệt kê: nó chỉ có `findOverlaps()`/`reportOverlaps()`, và hai hàm
 * đó báo trùng lặp chứ không báo toàn bộ. Nguồn đếm được duy nhất là
 * `buildGlobalShortcuts(handlers)`, mỗi mục đã có sẵn `description`
 * tiếng Việt; chuỗi hiển thị của tổ hợp lấy bằng
 * `formatCombo(parseCombo(combo))`.
 *
 * Một trạng thái màn hình thuộc về T5: **7 thu gọn** — hẹp lại thì ma trận
 * thành danh sách sự việc, mỗi mục hai `Toggle`. Và [CẤM TUYỆT ĐỐI]:
 * không tô màu ô nào trong ma trận.
 *
 * ## Mối nối, và vì sao nó chỉ có một chiều
 *
 * `useAccountSettings.ts` (T2) gọi hook này đúng một lần và cắm kết quả
 * thẳng vào view. Hook này **không** nhập ngược lại `useAccountSettings`:
 * làm thế là khép một vòng import mà `pnpm cycles` từ chối. Thứ dùng chung
 * nằm ở `accountDraft.ts`, module thấp nhất của thư mục màn.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `AccountTablesModel` và `useAccountTables` — cùng các khoá của
 *   `AccountTablesModel` đã có nơi nhập theo. **Không đổi tên, không đổi khoá.**
 *   Mọi thứ bên dưới các khoá đó là của T5.
 *
 * ## Bốn quyết định của T5, viết ra để không ai phải đoán lại
 *
 * 1. **Danh sách phím tắt là dẫn xuất, không phải hằng.** {@link buildShortcutRows}
 *    đọc `buildGlobalShortcuts` với sáu hàm rỗng — không đăng ký gì, chỉ để
 *    *đếm được* — rồi in mỗi tổ hợp qua `formatCombo(parseCombo(…))`. Một
 *    mảng phím tắt viết tay ở bất cứ đâu trong thư mục này là một nguồn thứ
 *    hai, và nguồn thứ hai thì lệch.
 * 2. **Ma trận thông báo không đi qua O-02.** `FEATURE_FLAG_KEYS` là danh sách
 *    đóng gồm đúng năm khoá scene/rules/export/qc và `src/lib/**` bị đóng băng,
 *    nên không khoá cờ nào tồn tại cho năm sự việc dưới đây. Ma trận lưu qua
 *    mối nối tự lưu D-07 (`port.stage`), **không** ghi thẳng `localStorage`
 *    (phán quyết R2).
 * 3. **Trạng thái hiện tại của ma trận là state cục bộ, seed từ `port.saved`.**
 *    `port.saved` là ảnh chụp máy chủ, và nó *không* đổi khi `stage` chạy —
 *    nên đọc thẳng từ nó thì ô vừa bấm sẽ bật lại về giá trị cũ trong 800 ms
 *    chờ lưu. State cục bộ giữ điều người dùng vừa làm; ảnh chụp nạp lại nó
 *    ngay trong lượt render (R-27) mỗi khi lượt đọc trả về bản mới.
 * 4. **Giảm chuyển động là một boolean chảy xuống view.** `MotionProvider` đã
 *    đặt `reducedMotion="user"` cho cả ứng dụng, nhưng mục D nói view phải
 *    test được chỉ từ props — nên quyết định "không hoạt cảnh" hiện ra thành
 *    một prop mà test đọc được, chứ không nằm trong một provider.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatNumber } from '@/lib/format/number';
import {
  buildGlobalShortcuts,
  formatCombo,
  parseCombo,
  type GlobalShortcutHandlers,
} from '@/lib/input/shortcutRegistry';
import { durationSeconds, MOTION_EASINGS } from '@/lib/motion';

import type {
  NotificationChannelModel,
  NotificationEventModel,
  NotificationsSectionProps,
} from './NotificationsSection';
import type {
  ShortcutRowMotion,
  ShortcutRowModel,
  ShortcutsSectionProps,
} from './ShortcutsSection';
import type { AccountDraftFields, AccountDraftPort } from './accountDraft';

export interface AccountTablesModel {
  readonly notifications: NotificationsSectionProps;
  readonly shortcuts: ShortcutsSectionProps;
}

/* -------------------------------------------------------------------------- */
/* Thông báo — hai kênh, năm sự việc.                                          */
/* -------------------------------------------------------------------------- */

/**
 * Hai cột của ma trận.
 *
 * "Thư điện tử" chứ không phải "Email": `src/i18n/vi.json` đã đặt tên tiếng
 * Việt cho kênh này (`auth.email`), và câu mô tả khối mà T2 vẽ sẵn cũng nói
 * "báo qua thư điện tử". Một màn hình dùng hai tên cho cùng một kênh là một
 * màn hình người đọc phải tự ghép lại.
 */
export const NOTIFICATION_CHANNELS: readonly NotificationChannelModel[] = Object.freeze([
  Object.freeze({ id: 'inApp', label: 'Trong ứng dụng' }),
  Object.freeze({ id: 'email', label: 'Thư điện tử' }),
]);

/** Một hàng của ma trận: mã tiếng Anh (mục E.11), nhãn tiếng Việt. */
interface NotificationEventSpec {
  readonly id: string;
  readonly label: string;
  /** Kênh nào bật sẵn khi máy chủ chưa nói gì. */
  readonly fallback: Readonly<Record<string, boolean>>;
}

/**
 * Năm sự việc, và mặc định của từng kênh.
 *
 * Mặc định không phải "bật hết": một hộp thư nhận năm loại thư mỗi ngày là
 * một hộp thư người ta lọc bỏ, và khi ấy cái thứ sáu — thứ thật sự khẩn —
 * cũng bị lọc theo. Báo trong ứng dụng thì rẻ hơn, nên nó bật nhiều hơn.
 */
const NOTIFICATION_EVENTS: readonly NotificationEventSpec[] = Object.freeze([
  Object.freeze({
    id: 'aiCompleted',
    label: 'AI xử lý xong',
    fallback: Object.freeze({ inApp: true, email: false }),
  }),
  Object.freeze({
    id: 'violationFound',
    label: 'Phát hiện vi phạm mới',
    fallback: Object.freeze({ inApp: true, email: true }),
  }),
  Object.freeze({
    id: 'projectInvite',
    label: 'Được mời vào dự án',
    fallback: Object.freeze({ inApp: true, email: true }),
  }),
  Object.freeze({
    id: 'commentMention',
    label: 'Bình luận nhắc đến tôi',
    fallback: Object.freeze({ inApp: true, email: false }),
  }),
  Object.freeze({
    id: 'morningDigest',
    label: 'Tổng hợp mỗi sáng',
    fallback: Object.freeze({ inApp: false, email: true }),
  }),
]);

/** Ma trận đã giải: `matrix[eventId][channelId]`. */
type NotificationMatrix = Readonly<Record<string, Readonly<Record<string, boolean>>>>;

/**
 * Đọc ma trận ra khỏi bản nháp, ô nào máy chủ không nói thì lấy mặc định.
 *
 * `AccountDraftFields` là `Record<string, unknown>` — cổng lưu chuyển tiếp chứ
 * không đọc, nên hình dạng chỉ được biết ở đây. Mọi giá trị không phải boolean
 * bị bỏ qua thay vì ép kiểu: một cài đặt hỏng nên hiện ra bằng mặc định an
 * toàn, không bằng một ô tích nửa vời.
 */
function readMatrix(fields: AccountDraftFields | undefined): NotificationMatrix {
  const matrix: Record<string, Record<string, boolean>> = {};

  for (const event of NOTIFICATION_EVENTS) {
    const stored: unknown = fields?.[event.id];
    const storedRecord =
      typeof stored === 'object' && stored !== null ? (stored as Record<string, unknown>) : {};
    const row: Record<string, boolean> = {};

    for (const channel of NOTIFICATION_CHANNELS) {
      const value: unknown = storedRecord[channel.id];

      row[channel.id] = typeof value === 'boolean' ? value : (event.fallback[channel.id] ?? false);
    }

    matrix[event.id] = row;
  }

  return matrix;
}

/* -------------------------------------------------------------------------- */
/* Phím tắt — dẫn xuất, không viết tay.                                        */
/* -------------------------------------------------------------------------- */

/**
 * Sáu hàm rỗng, chỉ để `buildGlobalShortcuts` chịu trả ra bảng.
 *
 * Khối này **vẽ một bảng tra cứu**, nó không đăng ký phím tắt nào: `register`
 * không được gọi ở đâu trong thư mục màn. Handler thật thuộc về vỏ ứng dụng,
 * và nếu khối này cũng đăng ký thì `findOverlaps()` sẽ báo sáu tổ hợp trùng —
 * đúng thứ hàm đó tồn tại để tố cáo.
 */
const NO_OP_SHORTCUT_HANDLERS: GlobalShortcutHandlers = Object.freeze({
  undo: (): void => undefined,
  redo: (): void => undefined,
  save: (): void => undefined,
  openSearch: (): void => undefined,
  openShortcutHelp: (): void => undefined,
  closeTopLayer: (): void => undefined,
});

/** Câu thay chỗ khi một mục quên `description`. Không mục nào của I-01 quên. */
const MISSING_DESCRIPTION = 'chưa có mô tả';

/**
 * Đường cong của một lượt xếp lại. Bốn điểm điều khiển lấy từ token, không viết tay.
 *
 * `MOTION_EASINGS.enter.points` là tuple chỉ-đọc, còn framer-motion đòi tuple
 * ghi được — nên nó được rải ra thành bốn tên rồi ghép lại một lần, ở đây.
 */
const [EASE_X1, EASE_Y1, EASE_X2, EASE_Y2] = MOTION_EASINGS.enter.points;
const ROW_EASE: [number, number, number, number] = [EASE_X1, EASE_Y1, EASE_X2, EASE_Y2];

/**
 * Hai cách một hàng xếp lại: có hoạt cảnh, và không có gì cả.
 *
 * `duration: 0` cùng `layout: false` là câu "không hoạt cảnh" viết ra thành
 * dữ liệu — bộ kiểm đọc thẳng được nó, và luật `no-raw-duration` cho phép đúng
 * số 0 vì lý do ấy.
 */
const STILL_ROW_MOTION: ShortcutRowMotion = Object.freeze({
  layout: false,
  transition: Object.freeze({ duration: 0 }),
});

const ANIMATED_ROW_MOTION: ShortcutRowMotion = Object.freeze({
  layout: 'position',
  transition: Object.freeze({ duration: durationSeconds('standard'), ease: ROW_EASE }),
});

/** Dấu thanh và dấu mũ tổ hợp, thứ `NFD` tách ra được. */
const COMBINING_MARKS = /[\u0300-\u036f]/gu;

/**
 * Bảng phím tắt, sinh ra từ I-01.
 *
 * Xuất ra để bộ kiểm đối chiếu được **số hàng vẽ ra** với
 * `buildGlobalShortcuts(...).length` mà không phải viết con số nào vào test —
 * một con số viết tay trong test là chính cái nguồn sai lệch mà luật "không
 * viết tay danh sách phím tắt" cấm, chỉ dịch sang chỗ khác.
 */
export function buildShortcutRows(): readonly ShortcutRowModel[] {
  return buildGlobalShortcuts(NO_OP_SHORTCUT_HANDLERS).map((definition) => {
    const combo = formatCombo(parseCombo(definition.combo));

    return {
      id: definition.id,
      combo,
      // `formatCombo` in ra đúng một cách: các phần nối bằng dấu cộng. Tách ở
      // đây chứ không ở view, vì view không được biết cách một tổ hợp được
      // đánh vần (mục D).
      keys: combo.split('+'),
      description: definition.description ?? MISSING_DESCRIPTION,
    };
  });
}

/**
 * Bỏ dấu để ô tìm khớp được cả khi người ta gõ vội.
 *
 * `NFD` tách dấu thanh và dấu mũ ra thành ký tự tổ hợp, xoá được bằng một dải
 * Unicode; `đ` thì không phân tách được nên nó đi riêng một dòng. Không có
 * bước này thì gõ "hoan tac" không tìm ra "hoàn tác", và một ô tìm không tìm
 * ra thứ đang hiện trên màn hình là một ô tìm người ta thôi dùng.
 */
function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* Thu gọn — trạng thái 7.                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Dưới `sm` của Tailwind. Cùng khuôn `useProjectDashboard.useNarrowViewport`.
 *
 * Ma trận hai cột cần chỗ cho nhãn hàng cộng hai cột ô tích; dưới 640 px thì
 * nhãn hàng bị bóp thành ba dòng và bảng thành thứ phải cuộn ngang mới đọc
 * được. Danh sách `Toggle` không có cột nào để bóp.
 */
const NARROW_VIEWPORT_QUERY = '(max-width: 639px)';

function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);

    setIsNarrow(media.matches);

    const listener = (event: MediaQueryListEvent): void => setIsNarrow(event.matches);

    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useAccountTables(port: AccountDraftPort): AccountTablesModel {
  const savedFields = port.saved?.notifications;

  const [matrix, setMatrix] = useState<NotificationMatrix>(() => readMatrix(savedFields));
  const [syncedFields, setSyncedFields] = useState<AccountDraftFields | undefined>(savedFields);
  const [query, setQuery] = useState('');

  const isCollapsed = useNarrowViewport();
  const reducedMotion = useReducedMotion();

  // Nạp lại ngay trong lượt render chứ không qua effect (R-27, cùng lý do
  // `useAccountSettings` nạp bản nháp như vậy): một effect đẩy dữ liệu sang
  // lượt sau, tức có một khung hình mà ô tích vẽ giá trị mặc định trong khi
  // giá trị thật đã về.
  if (savedFields !== syncedFields) {
    setSyncedFields(savedFields);
    setMatrix(readMatrix(savedFields));
  }

  const handleChange = useCallback(
    (eventId: string, channelId: string, isOn: boolean): void => {
      const next: NotificationMatrix = {
        ...matrix,
        [eventId]: { ...matrix[eventId], [channelId]: isOn },
      };

      setMatrix(next);

      // Gửi trọn ma trận chứ không gửi một ô: `mergeAccountDraft` gộp NÔNG,
      // nên thứ một khối con gửi lên phải là khối con hoàn chỉnh.
      //
      // Gọi `stage` ở ĐÂY chứ không trong hàm cập nhật của `setMatrix`: hàm
      // cập nhật phải thuần, và React gọi nó hai lần trong StrictMode — một
      // lượt lưu gửi đi hai lần là một lượt lưu khó đọc lại.
      port.stage('notifications', next);
    },
    [matrix, port],
  );

  const events = useMemo<readonly NotificationEventModel[]>(
    () =>
      NOTIFICATION_EVENTS.map((event) => ({
        id: event.id,
        label: event.label,
        cells: NOTIFICATION_CHANNELS.map((channel) => ({
          channelId: channel.id,
          // Tên cho trình đọc màn hình. Một ô tích trong ma trận không có chữ
          // nào cạnh nó, nên nếu không ghép hai nhãn lại thì cả mười ô đọc lên
          // giống hệt nhau.
          label: `${event.label} — ${channel.label}`,
          isOn: matrix[event.id]?.[channel.id] ?? false,
        })),
      })),
    [matrix],
  );

  const allRows = useMemo(() => buildShortcutRows(), []);

  const rows = useMemo(() => {
    const needle = foldForSearch(query.trim());

    if (needle === '') {
      return allRows;
    }

    return allRows.filter(
      (row) =>
        foldForSearch(row.description).includes(needle) || foldForSearch(row.combo).includes(needle),
    );
  }, [allRows, query]);

  // A15: con số thành chuỗi ở đây, không ở view.
  const total = formatNumber(allRows.length, { grouping: false });
  const shown = formatNumber(rows.length, { grouping: false });
  const countLabel =
    rows.length === allRows.length
      ? `${total} phím tắt đang có hiệu lực.`
      : `Đang hiện ${shown} trong ${total} phím tắt.`;

  return {
    notifications: {
      channels: NOTIFICATION_CHANNELS,
      events,
      isCollapsed,
      onChange: handleChange,
    },
    shortcuts: {
      query,
      onQueryChange: setQuery,
      rows,
      countLabel,
      emptyMessage: 'Không có phím tắt nào khớp với ô tìm.',
      rowMotion: reducedMotion ? STILL_ROW_MOTION : ANIMATED_ROW_MOTION,
    },
  };
}
