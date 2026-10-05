/**
 * Toàn bộ phần suy nghĩ của màn `/tai-khoan`, và **chỉ** phần thuộc về cả trang.
 *
 * Mục D chia đôi: file này giữ trạng thái cấp trang và làm mọi phép tính cấp
 * trang; `AccountSettings.tsx` chỉ vẽ. Bảy khối bên trong lại chia tiếp cho ba
 * người dựng, mỗi người một hook con — xem bảng chủ sở hữu ở `index.ts`. Hook
 * này biết đúng ba thứ về chúng: gọi chúng, ghép mô hình chúng trả về, và cầm
 * hộ chúng một bộ tự lưu.
 *
 * ## Bốn việc file này làm, không hơn
 *
 * 1. **Đọc** cài đặt tài khoản qua `useQuery` (R-64) với khoá
 *    {@link accountSettingsQueryKey}. Lượt đọc đó là **trạng thái 2 của A11**,
 *    và nó thuộc về T2: `isLoading` khiến cả trang thành khung xương một lần,
 *    nên không khối nào phải tự vẽ khung xương của riêng nó.
 * 2. **Tự lưu** (D-07) bằng `createAutosave`. Đúng một bộ đếm cho cả trang. Hai
 *    bộ đếm song song thì `SaveIndicator` không còn câu nào nói đúng cho cả
 *    trang, mà A7 buộc nó phải nói ra được.
 * 3. **Dịch** `AutosaveState` sang `SaveState` — xem {@link toSaveState}. Hai
 *    union khác nhau, và chỗ nối chúng là đây, đúng một lần.
 * 4. **Ghép** ba mô hình con thành {@link AccountSettingsViewModel}.
 *
 * ## Mật khẩu không đi qua đây
 *
 * `useAccountAuth()` không nhận `AccountDraftPort`. [CẤM TUYỆT ĐỐI] nói không
 * tự lưu mật khẩu, và cách giữ lời hứa đó bằng cấu trúc — thay vì bằng trí nhớ
 * của người sửa tiếp theo — là không đưa cho khối mật khẩu cái cửa dẫn tới bộ
 * tự lưu. Xem `accountDraft.ts`.
 *
 * ## Bảy trạng thái, chia cho bốn người
 *
 * Ghi ở đây một lần để không ai dựng trùng:
 *
 * | # | Trạng thái | Chủ | Cách nó hiện ra |
 * |---|---|---|---|
 * | 1 | rỗng | T4 | chưa có ảnh đại diện → chữ cái đầu trên `--bg-sunken`; chưa có chức danh → không vẽ dòng đó |
 * | 2 | đang tải | **T2** | `isLoading` → cả bảy thẻ thành khung xương |
 * | 3 | một phần | T4 + T3 | T4: ảnh đại diện đang tải lên. T3: đọc phiên hỏng → dải cảnh báo **trong khối phiên**, không bao giờ trên đầu trang |
 * | 4 | lỗi | T3 | mật khẩu cũ sai, lỗi buộc vào đúng ô đó |
 * | 5 | thành công | tất cả | |
 * | 6 | không có quyền | T3 | tài khoản SSO → khối mật khẩu chỉ đọc, kèm câu "Do quản trị viên công ty quản lý." |
 * | 7 | thu gọn | T5 | ma trận thông báo → danh sách sự việc, mỗi mục hai `Toggle` |
 *
 * Lỗi **đọc** cấp trang cũng là của T2, và nó đi qua `errorMessage`: một
 * `InlineAlert` thay chỗ bảy khối, vì khi ấy không khối nào có dữ liệu để vẽ.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { SaveState } from '@/components/feedback/SaveIndicator';
import { appNotificationBus } from '@/hooks/useNotifications';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import type { AutosaveState } from '@/lib/autosave/createAutosave';
import { createAutosave } from '@/lib/autosave/createAutosave';
import { describeError, toAppError } from '@/lib/errors';
import { readWireError } from '@/lib/errors/wireError';
import { getAppAnnouncer, type Announcer } from '@/lib/input/announcer';
import type { NotificationBus } from '@/lib/mutations/notificationBus';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import { queryKeys } from '@/lib/query/queryKeys';

import {
  EMPTY_ACCOUNT_DRAFT,
  isSameAccountDraft,
  mergeAccountDraft,
  type AccountDraft,
  type AccountDraftFields,
  type AccountDraftPort,
  type AccountDraftSection,
} from './accountDraft';
import type { AccountAuthGateway } from './accountAuthGateway';
import {
  createAccountSettingsGateway,
  profileDraftOf,
  type AccountSettingsGateway,
} from './accountSettingsGateway';
import type { ProfileFieldKey } from './ProfileSection';
import { useAccountAuth, type AccountAuthModel } from './useAccountAuth';
import {
  useAccountPreferences,
  type AccountPreferencesModel,
  type AvatarPort,
} from './useAccountPreferences';
import { useAccountTables, type AccountTablesModel } from './useAccountTables';

/**
 * Khoá bộ đệm của lượt đọc cài đặt tài khoản — nhánh `me.profile` của `queryKeys`.
 * Giá trị trong bộ đệm là bản nháp đã ánh xạ (`AccountDraft`), không phải `Me` thô.
 */
export const accountSettingsQueryKey = queryKeys.me.profile();

/**
 * 800 ms của bất biến A7, viết ra thành một cái tên.
 *
 * `createAutosave` có sẵn 800 ms làm mặc định, và `useProjectSettings` cố ý
 * không truyền lại (R-71: viết lại là tạo một bản sao sẽ lệch). Ở đây thì
 * truyền, vì con số này là **lời hứa của màn** chứ không phải mặc định của thư
 * viện: A7 nói 800 ms, nên màn nói 800 ms, và test đọc được đúng hằng số mà màn
 * dùng. Đây cũng là cách giữ luật R1 — không một số mili-giây thô nào nằm rải
 * trong `src/`.
 */
export const ACCOUNT_AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Câu của chỉ báo lưu khi lượt vừa lưu chỉ chạm giao diện hoặc thông báo: hai khối
 * ấy chưa có dây ở v1 (AC1), nên nói "đã lưu" là nói dối.
 */
export const ACCOUNT_LOCAL_ONLY_LABEL = 'Chỉ giữ trong phiên này';

/** Câu lỗi của ô hồ sơ khi máy chủ trả 422 kèm `field`. */
const PROFILE_FIELD_PROBLEMS: Readonly<Partial<Record<string, string>>> = {
  fullName: 'Họ tên cần từ 1 đến 120 ký tự, không chứa ký tự điều khiển.',
  jobTitle: 'Chức danh tối đa 120 ký tự, không chứa ký tự điều khiển.',
  phone: 'Số điện thoại tối đa 32 ký tự.',
};

type ProfileProblems = Readonly<Partial<Record<ProfileFieldKey, string>>>;

/** Câu của toast hoàn tác sau một lượt tự lưu (A8). */
export const ACCOUNT_SAVED_UNDO_TITLE = 'Đã lưu cài đặt tài khoản.';

/** Cách gọi hook trong test và story. Sản phẩm gọi `useAccountSettings()` không tham số. */
export interface UseAccountSettingsOptions {
  /** Nguồn dữ liệu. Mặc định là cổng thật của ứng dụng. */
  readonly gateway?: AccountSettingsGateway;
  /** Nguồn dữ liệu của khối mật khẩu, phiên, vùng nguy hiểm. Mặc định là cổng thật. */
  readonly authGateway?: AccountAuthGateway;
  /** Đồng hồ tiêm vào, cho `fakeClock`. */
  readonly now?: () => number;
  /** Có mạng hay không, tiêm vào để dựng lại nhánh ngoại tuyến. */
  readonly isOnline?: () => boolean;
  /** Bộ đọc màn hình, tiêm vào để soát rằng A7 nói ra được. */
  readonly announcer?: Announcer;
  /** Kênh của toast hoàn tác. Mặc định kênh chung của ứng dụng; test tiêm kênh riêng. */
  readonly notifications?: NotificationBus;
}

/**
 * Thứ view nhận. Một đối tượng, một prop, không có prop lẻ nào khác.
 *
 * `auth`, `preferences` và `tables` là ba ô mà ba người dựng đổ đầy. T2 không
 * đọc vào bên trong ba ô đó, nên một khối mọc thêm trường không làm file nào
 * của T2 phải sửa theo.
 */
export interface AccountSettingsViewModel {
  /** Trạng thái 2, cho cả trang. */
  readonly isLoading: boolean;
  /** Lỗi đọc cấp trang; `null` khi đọc được. */
  readonly errorMessage: string | null;
  /** Đọc lại sau khi lỗi. */
  readonly retryLoad: () => void;
  readonly saveState: SaveState;
  readonly saveLabel: string | null;
  readonly auth: AccountAuthModel;
  readonly preferences: AccountPreferencesModel;
  readonly tables: AccountTablesModel;
}

/**
 * `AutosaveState` sang `SaveState` — hai union khác nhau, nối đúng một lần.
 *
 * `offline` gộp vào `'error'` vì `SaveState` không có nhánh ngoại tuyến, và với
 * người dùng hai thứ nói cùng một điều: thay đổi CHƯA nằm trên máy chủ. Lý do
 * cụ thể không mất đi — `useSaveIndicator` trả về nhãn riêng cho ngoại tuyến, và
 * view vẽ nhãn đó cạnh biểu tượng.
 */
export function toSaveState(autosaveState: AutosaveState): SaveState {
  switch (autosaveState) {
    case 'dirty':
      return 'pending';
    case 'saving':
      return 'saving';
    case 'saved':
      return 'saved';
    case 'failed':
      return 'error';
    case 'offline':
      return 'error';
  }
}

/** Hai bản nháp giống nhau ở khối hồ sơ — nghĩa là lượt lưu chỉ chạm giao diện hoặc thông báo. */
function isSameProfile(left: AccountDraft, right: AccountDraft): boolean {
  return JSON.stringify(left.profile) === JSON.stringify(right.profile);
}

/** Thứ `createAutosave` gọi tới, luôn là bản mới nhất. */
interface AutosaveBridge {
  getChanges: () => AccountDraft | undefined;
  save: (changes: AccountDraft) => Promise<void>;
}

export function useAccountSettings(
  options: UseAccountSettingsOptions = {},
): AccountSettingsViewModel {
  const [gateway] = useState(() => options.gateway ?? createAccountSettingsGateway());
  const notifications = options.notifications ?? appNotificationBus;
  /** Bản nháp mà nút "Hoàn tác" vừa dựng lại — lượt lưu của nó không sinh vé mới. */
  const restoringRef = useRef<AccountDraft | null>(null);
  /**
   * Bản đã lưu mà nút "Hoàn tác" trả về, đứng thay ảnh chụp truy vấn trong `port.saved`
   * để hai hook con nạp lại ô nhập. Không đi qua `setQueryData`: chia sẻ cấu trúc của
   * TanStack giữ nguyên tham chiếu cũ khi giá trị cũ bằng ảnh chụp đang giữ — đúng
   * trường hợp hay gặp nhất (hoàn tác lượt sửa đầu tiên) — và hook con không thấy gì đổi.
   */
  const [restoredDraft, setRestoredDraft] = useState<AccountDraft | null>(null);

  const [draft, setDraft] = useState<AccountDraft | null>(null);
  const [saved, setSaved] = useState<AccountDraft | null>(null);
  const [syncedToken, setSyncedToken] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  /**
   * Bản đọc được ở lượt đọc gần nhất — thứ `port.saved` đưa cho hook con. Không đọc
   * thẳng từ ảnh chụp truy vấn: lượt lưu cập nhật bộ đệm (`setQueryData`) mà đổi
   * `port.saved` thì chữ đang gõ dở trong hook con bị nạp lại và mất (B-V12b-03).
   */
  const [loaded, setLoaded] = useState<AccountDraft | null>(null);
  const [profileProblems, setProfileProblems] = useState<ProfileProblems>({});
  /** Lượt lưu gần nhất chỉ chạm giao diện/thông báo: chỉ báo lưu nói "chỉ giữ trong phiên này". */
  const [isLocalOnlySave, setLocalOnlySave] = useState(false);
  const localOnlyRef = useRef(false);
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: accountSettingsQueryKey,
    queryFn: () => gateway.read(),
  });

  const snapshot = settingsQuery.data ?? null;

  // Nạp bản nháp từ ảnh chụp NGAY TRONG lúc render, không qua effect (R-27):
  // effect đẩy dữ liệu sang lượt render sau, tức có một khung hình mà dữ liệu đã
  // về còn màn hình vẫn vẽ khung xương.
  if (snapshot !== null && syncedToken !== reloadToken) {
    setSyncedToken(reloadToken);
    setDraft(snapshot);
    setSaved(snapshot);
    setLoaded(snapshot);
    setRestoredDraft(null);
  }

  // Khuôn "ref mới nhất" (`src/hooks/useShortcut.ts:180-182`): bộ tự lưu dựng
  // đúng một lần, nhưng thứ nó gọi 800 ms sau phải là bản nháp mới nhất chứ
  // không phải bản của lượt render đã tạo ra nó.
  const bridgeRef = useRef<AutosaveBridge>({
    getChanges: () => undefined,
    save: () => Promise.resolve(),
  });

  const [autosave] = useState(() =>
    createAutosave<AccountDraft>({
      debounceMs: ACCOUNT_AUTOSAVE_DEBOUNCE_MS,
      getChanges: () => bridgeRef.current.getChanges(),
      save: (changes) => bridgeRef.current.save(changes),
      ...(options.now !== undefined ? { now: options.now } : {}),
      ...(options.isOnline !== undefined ? { isOnline: options.isOnline } : {}),
    }),
  );

  // Bọc bộ đọc màn hình: câu "đã lưu" của lượt chỉ-giữ-trong-phiên thành câu thật. Câu lỗi
  // (`assertive`) đi qua nguyên vẹn.
  const [announcer] = useState<Announcer>(() => {
    const target = (): Announcer => options.announcer ?? getAppAnnouncer();

    return {
      announce: (message, urgency) =>
        target().announce(
          localOnlyRef.current && urgency !== 'assertive' ? ACCOUNT_LOCAL_ONLY_LABEL : message,
          urgency,
        ),
      destroy: () => target().destroy(),
    };
  });

  const indicator = useSaveIndicator(autosave, {
    ...(options.now !== undefined ? { now: options.now } : {}),
    announcer,
  });

  bridgeRef.current = {
    getChanges: () => {
      if (draft === null || saved === null || isSameAccountDraft(draft, saved)) {
        return undefined;
      }

      return draft;
    },
    // A8: mỗi lượt tự lưu kèm toast hoàn tác. Lệnh ngược là chính `PATCH /me` với
    // giá trị cũ, và nó đi qua đúng đường tự lưu để chỉ báo A7 vẫn nói thật.
    // Gõ liên tục không thành toast liên tục: kênh chung gộp cùng loại trong 5 giây.
    save: async (changes) => {
      const previous = saved;
      const isRestore = changes === restoringRef.current;
      restoringRef.current = null;

      let serverProfile: Awaited<ReturnType<AccountSettingsGateway['save']>>;

      try {
        serverProfile = await gateway.save(changes);
      } catch (error) {
        const wire = readWireError(error);
        const field = wire?.field;
        const problem = field === undefined ? undefined : PROFILE_FIELD_PROBLEMS[field];

        // 422 của một ô hồ sơ: lỗi buộc vào đúng ô, rồi ném lại để chỉ báo lưu báo lỗi.
        // `createAutosave` không thử lại 4xx, nên lỗi ô không bị lịch tự lưu gõ lại.
        if (wire?.status === 422 && field !== undefined && problem !== undefined) {
          setProfileProblems((current) => ({ ...current, [field]: problem }));
        }

        throw error;
      }

      const isLocalOnly = previous !== null && isSameProfile(previous, changes);

      localOnlyRef.current = isLocalOnly;
      setLocalOnlySave(isLocalOnly);
      setProfileProblems({});
      setSaved(changes);

      if (serverProfile !== null) {
        queryClient.setQueryData<AccountDraft>(accountSettingsQueryKey, {
          ...changes,
          profile: profileDraftOf(serverProfile),
        });
      }

      if (isRestore || previous === null) {
        return;
      }

      const undoTicket = createUndoTicket({
        description: ACCOUNT_SAVED_UNDO_TITLE,
        ...(options.now !== undefined ? { now: options.now } : {}),
        undo: () => {
          restoringRef.current = previous;
          // Bản sao mới mỗi lượt: `port.saved` đổi tham chiếu thì hai hook con nạp lại.
          setRestoredDraft(structuredClone(previous));
          setDraft(previous);
          autosave.notifyChange();
        },
      });

      notifications.publish({
        type: 'account-settings',
        title: ACCOUNT_SAVED_UNDO_TITLE,
        description: '',
        undoTicket,
      });
    },
  };

  // Cổng của ba hook con — mối nối duy nhất theo chiều từ khối lên trang. Xem
  // `accountDraft.ts` để biết cách một hook con dùng nó. `useMemo` giữ tham
  // chiếu ổn định, nên hook con đặt `port` vào mảng phụ thuộc cũng không bị
  // đánh thức mỗi khung hình.
  const port = useMemo<AccountDraftPort>(
    () => ({
      saved: restoredDraft ?? loaded ?? undefined,
      stage: (section: AccountDraftSection, fields: AccountDraftFields): void => {
        if (section === 'profile') {
          // Sửa lại ô nào thì lỗi của ô đó hết hiệu lực.
          setProfileProblems((current) => {
            const next: Partial<Record<ProfileFieldKey, string>> = { ...current };

            for (const key of Object.keys(fields)) {
              delete next[key as ProfileFieldKey];
            }

            return next;
          });
        }

        setDraft((current) => mergeAccountDraft(current ?? EMPTY_ACCOUNT_DRAFT, section, fields));
        autosave.notifyChange();
      },
    }),
    [autosave, loaded, restoredDraft],
  );

  const auth = useAccountAuth({
    ...(options.authGateway !== undefined ? { gateway: options.authGateway } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });

  // N14 xong thì bộ đệm hồ sơ cũng mang ảnh mới, cùng hình với lượt đọc.
  const replaceAvatar = useCallback<AvatarPort>(
    async (input) => {
      const result = await gateway.replaceAvatar(input);

      if (result.ok) {
        queryClient.setQueryData<AccountDraft>(accountSettingsQueryKey, (current) =>
          current === undefined ? current : { ...current, profile: profileDraftOf(result.data) },
        );
      }

      return result;
    },
    [gateway, queryClient],
  );
  const preferences = useAccountPreferences(port, replaceAvatar, profileProblems);
  const tables = useAccountTables(port);

  const queryError: unknown = settingsQuery.error;
  const errorMessage =
    queryError === null || queryError === undefined
      ? null
      : describeError(toAppError(queryError)).description;

  return {
    isLoading: settingsQuery.isPending,
    errorMessage,
    retryLoad: () => {
      setReloadToken((token) => token + 1);
      void settingsQuery.refetch();
    },
    saveState: toSaveState(indicator.state),
    saveLabel:
      indicator.state === 'saved' && isLocalOnlySave ? ACCOUNT_LOCAL_ONLY_LABEL : indicator.label,
    auth,
    preferences,
    tables,
  };
}
