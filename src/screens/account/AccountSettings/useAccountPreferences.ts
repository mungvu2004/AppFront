/**
 * Hai khối của T4: hồ sơ và giao diện.
 *
 * Cả hai đều có thứ để lưu, nên hook nhận `AccountDraftPort` và báo lên bằng
 * `port.stage('profile', …)` / `port.stage('appearance', …)`. **Không** dựng
 * `createAutosave` riêng: bộ đếm 800 ms của A7 nằm đúng một chỗ, ở
 * `useAccountSettings.ts`. Hai bộ đếm song song thì `SaveIndicator` không còn
 * câu nào nói đúng cho cả trang.
 *
 * Hai trạng thái màn hình thuộc về T4: **1 rỗng** (chưa có ảnh đại diện thì vẽ
 * chữ cái đầu trên `--bg-sunken`; chưa có chức danh thì hàng ấy chỉ có chữ mờ)
 * và **nửa của 3 một phần** (ảnh đại diện đang tải lên).
 *
 * ## Nơi từng cài đặt được lưu, và vì sao — R2, đọc trước khi thêm cài đặt mới
 *
 * O-02 (`useFeatureFlag` / `setFeatureFlagOverride`) chỉ nhận **năm** khoá có
 * sẵn — `scene.instanced-walls`, `scene.soft-shadows`, `rules.parallel-run`,
 * `export.pdf-vector`, `qc.live-collaboration` — và `src/lib/**` là thư mục màn
 * này không được sửa, nên không thêm khoá nào vào đó được. Không cài đặt nào của
 * màn này trùng một trong năm khoá ấy. Kết luận, ghi ra từng dòng:
 *
 * | cài đặt | lưu ở đâu | vì sao |
 * |---|---|---|
 * | họ tên, chức danh, điện thoại, ngôn ngữ | `port.stage('profile', …)` | dữ liệu tài khoản, chưa bao giờ là cờ tính năng |
 * | ảnh đại diện | N14 qua `avatar` (hộp thoại A9) | hành động chủ động, không phải cài đặt: ảnh không vào bản nháp, chỉ là trạng thái cục bộ |
 * | chủ đề | `port.stage('appearance', …)` **và** action `setTheme` | bản ghi nhớ đi qua bản nháp; hiệu lực tức thì đi qua store, vì `<html class="dark">` phải đổi ngay chứ không đợi 800 ms |
 * | nền tối cho khung nhìn 3D | `port.stage('appearance', …)` | `scene.soft-shadows` nói về bóng đổ, không về màu nền; ghép hai thứ vào một khoá là bịa |
 * | giảm chuyển động | `port.stage('appearance', …)` + thuộc tính trên `<html>` | không có khoá O-02 nào cho nó |
 * | hiện lưới 100 mm | `port.stage('appearance', …)` | không có khoá O-02 nào cho nó |
 * | mật độ hiển thị | `port.stage('appearance', …)` | không có khoá O-02 nào cho nó |
 *
 * **Không ghi thẳng `localStorage` từ màn này.** Một đường lưu thứ hai mà
 * `SaveIndicator` không nhìn thấy là A7 nói dối. Ngoại lệ duy nhất là chủ đề, và
 * nó không phải của màn này: `useTheme` đã tự giữ `localStorage['app-theme-mode']`
 * từ trước, và đó là việc của store.
 *
 * ## Chủ đề: ba lựa chọn trên một store chỉ có hai
 *
 * `useTheme()` cho đúng `{theme, toggle}`, và `toggle` không diễn đạt nổi một
 * điều khiển ba nhánh. `ThemeMode` cũng chỉ có `'light' | 'dark'`. Nên theo R5:
 * lựa chọn ba nhánh sống ở MÀN, `'system'` giải ra bằng `matchMedia` ngay tại
 * đây, rồi kết quả hai nhánh hạ xuống store bằng **action** `setTheme` — một
 * action không phải `set()`, nên `local/no-direct-set` không cản. `useTheme()`
 * vẫn được gọi, vì chính effect của nó là thứ gắn lớp `dark` lên `<html>` và
 * ghi `localStorage`.
 *
 * ## Giảm chuyển động: nó với tới đâu, nói thẳng
 *
 * Công tắc này đặt `data-reduced-motion="true"` trên `<html>` để phần còn lại
 * của ứng dụng đọc được, và nó tắt mọi hoạt cảnh **trong màn này** ngay lập tức
 * (xem `AppearanceSection.tsx`). Nó KHÔNG với tới `MotionProvider`, nơi đặt
 * `reducedMotion="user"` cho framer-motion: chỗ ấy là `src/components/motion`,
 * thư mục màn này không được sửa. Nói cách khác, framer-motion vẫn nghe hệ điều
 * hành chứ chưa nghe công tắc này ở những màn khác. Đó là một khoản nợ có thật,
 * không phải một lời hứa đã giữ.
 *
 * ## Mối nối, và vì sao nó chỉ có một chiều
 *
 * `useAccountSettings.ts` (T2) gọi hook này đúng một lần và cắm kết quả thẳng
 * vào view. Hook này **không** nhập ngược lại `useAccountSettings`: làm thế là
 * khép một vòng import mà `pnpm cycles` từ chối. Thứ dùng chung nằm ở
 * `accountDraft.ts`, module thấp nhất của thư mục màn. Hai file khối là lá:
 * hook nhập kiểu và hằng từ chúng, chúng không nhập gì từ hook.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import type { SelectOption } from '@/components/ui/Select';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useTheme } from '@/hooks/useTheme';
import type { ApiResult } from '@/api/client';
import { AVATAR_MIME_TYPES, type Me, type UploadAvatar } from '@/api/schemas/me';
import { getSession, subscribeToSession } from '@/lib/auth';
import { describeError, toAppError } from '@/lib/errors';
import { readWireError } from '@/lib/errors/wireError';
import { MISSING_VALUE } from '@/lib/format/number';
import { durationMs } from '@/lib/motion';
import { useStore } from '@/store';
import type { ThemeMode } from '@/store/uiSlice';

import type {
  AppearanceFieldKey,
  AppearanceSectionProps,
  DensityChoice,
  ThemeChoice,
} from './AppearanceSection';
import type { AvatarReplaceDialogProps } from './AvatarReplaceDialog';
import type { ProfileFieldKey, ProfileSectionProps } from './ProfileSection';
import type { AccountDraftPort } from './accountDraft';

/** N14: đẩy ảnh lên máy chủ. Nơi gọi (`useAccountSettings`) cũng cập nhật cache hồ sơ. */
export type AvatarPort = (input: UploadAvatar) => Promise<ApiResult<Me>>;

export interface AccountPreferencesModel {
  readonly profile: ProfileSectionProps;
  readonly appearance: AppearanceSectionProps;
}

/* -------------------------------------------------------------------------- */
/* Từ vựng và hằng số.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Thuộc tính trên `<html>` mà công tắc "giảm chuyển động" đặt.
 *
 * Cố ý KHÔNG dọn khi màn rời đi: đây là một lựa chọn của người dùng cho cả ứng
 * dụng, không phải trạng thái của một màn. Dọn nó lúc unmount thì công tắc chỉ
 * có tác dụng khi người ta còn đang nhìn vào nó.
 */
export const REDUCED_MOTION_ATTRIBUTE = 'data-reduced-motion';

/** Truy vấn chủ đề của hệ điều hành, cho nhánh "theo hệ thống". */
export const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** Hai ngôn ngữ đang có. Định danh tiếng Anh theo BCP-47, nhãn tiếng Việt. */
export const LANGUAGE_OPTIONS: readonly SelectOption[] = [
  { label: 'Tiếng Việt', value: 'vi' },
  { label: 'Tiếng Anh', value: 'en' },
];

const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];
const DENSITY_CHOICES: readonly DensityChoice[] = ['comfortable', 'compact'];

/**
 * Hai con số nghiệm thu của mật độ hiển thị, viết ra thành tên.
 *
 * Đây là KÍCH THƯỚC chứ không phải thời lượng, nên `local/no-raw-duration`
 * không nói gì tới chúng. Chúng ở hook chứ không ở view vì A15: quyết định — kể
 * cả quyết định về một con số — xảy ra ở viewmodel, còn view chỉ nhận chuỗi đã
 * xong (`rowClassName`).
 */
export const DENSITY_ROW_HEIGHT_PX: Readonly<Record<DensityChoice, number>> = {
  comfortable: 40,
  compact: 36,
};

/**
 * Lớp Tailwind tương ứng, viết thẳng thành chuỗi tĩnh.
 *
 * Bộ quét của Tailwind đọc mã nguồn như văn bản chứ không chạy nó, nên một lớp
 * dựng bằng phép nối chuỗi sẽ không bao giờ được sinh ra. Hai bảng này phải khớp
 * nhau; `AppearanceSection.test.tsx` soát đúng điều đó nên chúng không lệch được.
 */
export const DENSITY_ROW_CLASS: Readonly<Record<DensityChoice, string>> = {
  comfortable: 'min-h-[40px]',
  compact: 'min-h-[36px]',
};

const EMAIL_REASON_SHORT = 'Thư điện tử là tên đăng nhập nên chỉ đọc ở đây.';
const EMAIL_REASON_LONG =
  'Thư điện tử là tên đăng nhập nên đổi nó phải qua một bước xác minh. ' +
  'Liên hệ quản trị viên của công ty để đổi.';

const JOB_TITLE_PLACEHOLDER = 'chưa đặt';
const AVATAR_UPLOADING_LABEL = 'Đang tải ảnh lên…';
const AVATAR_FALLBACK_ALT = 'Ảnh đại diện';

/** Trần của tệp ảnh (512 KB) — kiểm tại chỗ, trước khi đọc tệp. */
export const AVATAR_MAX_FILE_BYTES = 524_288;

/** Trần độ dài base64 của N14 (`UploadAvatarSchema`). */
export const AVATAR_MAX_BASE64_LENGTH = 699_052;

/** Giây khoá ô chọn ảnh sau 429, tối thiểu — Retry-After của máy chủ bị kẹp ≤ 10 s. */
export const AVATAR_LOCK_MIN_SECONDS = 60;

const MS_PER_SECOND = 1000;

const AVATAR_MESSAGES = {
  typeUnsupported: 'Chỉ nhận ảnh PNG hoặc JPEG.',
  fileTooBig: 'Ảnh tối đa 512 KB. Hãy chọn ảnh nhỏ hơn.',
  tooLarge: 'Ảnh quá lớn, hãy chọn ảnh nhỏ hơn.',
  typeMismatch: 'Nội dung tệp không khớp loại ảnh. Chọn lại tệp PNG hoặc JPEG.',
  dimensions: 'Ảnh rộng hoặc cao quá 4096 điểm ảnh.',
  corrupt: 'Không đọc được ảnh này, tệp có thể đã hỏng.',
  rateLimited: 'Đã thử nhiều lần. Hãy đợi vài phút rồi thử lại.',
} as const;

/** Chỉ báo của người dùng cho một ảnh bị từ chối; `lockSeconds` có khi cần khoá ô chọn ảnh. */
export interface AvatarFailure {
  readonly message: string;
  readonly lockSeconds?: number;
}

/**
 * Lỗi của N14 thành câu cho người dùng (bảng mã cục bộ). Mã lạ, mạng, 503 rơi về
 * `describeError` — không bao giờ in mã trần.
 */
export function avatarFailureOf(error: unknown): AvatarFailure {
  const wire = readWireError(error);

  switch (wire?.code) {
    case 'AVATAR_TYPE_UNSUPPORTED':
      return { message: AVATAR_MESSAGES.typeUnsupported };
    case 'FILE_TYPE_MISMATCH':
      return { message: AVATAR_MESSAGES.typeMismatch };
    case 'AVATAR_DIMENSIONS_EXCEEDED':
      return { message: AVATAR_MESSAGES.dimensions };
    case 'IMAGE_TOO_LARGE':
      return { message: AVATAR_MESSAGES.tooLarge };
    case 'FILE_CORRUPT':
      return { message: AVATAR_MESSAGES.corrupt };
    case 'VALIDATION':
      if (wire.field === 'contentBase64') {
        return { message: AVATAR_MESSAGES.corrupt };
      }
      break;
    default:
      break;
  }

  if (wire?.code === 'RATE_LIMITED' || wire?.status === 429) {
    return {
      message: AVATAR_MESSAGES.rateLimited,
      lockSeconds: Math.max(wire.retryAfterSeconds ?? 0, AVATAR_LOCK_MIN_SECONDS),
    };
  }

  return { message: describeError(toAppError(error)).description };
}

function isAvatarMimeType(type: string): type is UploadAvatar['mimeType'] {
  return (AVATAR_MIME_TYPES as readonly string[]).includes(type);
}

/** Đọc tệp ra `data:` URL. Chỉ dùng cho xem trước và để cắt lấy base64 — không vào bản nháp. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('avatar-unreadable'));
      }
    };
    reader.onerror = () => reject(new Error('avatar-unreadable'));
    reader.readAsDataURL(file);
  });
}

/** Ảnh đã qua kiểm tại chỗ, đang chờ người dùng xác nhận (A9). Trạng thái cục bộ, không vào bản nháp. */
interface PendingAvatar {
  readonly mimeType: UploadAvatar['mimeType'];
  readonly contentBase64: string;
  readonly previewUrl: string;
}

const NO_PROBLEMS: Readonly<Partial<Record<ProfileFieldKey, string>>> = Object.freeze({});

/* -------------------------------------------------------------------------- */
/* Đọc bản nháp.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Một khối của bản nháp là `Record<string, unknown>` — cổng lưu chuyển tiếp chứ
 * không đọc, nên hình dạng chặt được ép xuống đúng một lần, ở đây.
 */
type DraftFields = Readonly<Record<string, unknown>> | undefined;

function readText(fields: DraftFields, key: string, fallback: string): string {
  const value = fields?.[key];

  return typeof value === 'string' ? value : fallback;
}

function readFlag(fields: DraftFields, key: string, fallback: boolean): boolean {
  const value = fields?.[key];

  return typeof value === 'boolean' ? value : fallback;
}

function readChoice<T extends string>(
  fields: DraftFields,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = fields?.[key];

  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/**
 * Chữ cái đầu cho `Avatar` khi chưa có ảnh — trạng thái 1.
 *
 * Không viết hoa: `Avatar` ghi rõ trong mã rằng chữ cái đầu giữ nguyên như người
 * ta viết tên mình. Tên Việt đặt họ trước tên sau, nên lấy chữ đầu của từ đầu và
 * chữ đầu của từ cuối: "Nguyễn Thu Hà" ra "NH".
 */
export function initialsOf(fullName: string, email: string): string {
  const words = fullName.split(/\s+/).filter((word) => word.length > 0);
  const first = words[0];
  const last = words[words.length - 1];

  if (first !== undefined && last !== undefined) {
    return words.length === 1 ? first.slice(0, 1) : `${first.slice(0, 1)}${last.slice(0, 1)}`;
  }

  // Chưa có tên: chữ đầu của phần trước dấu a còng còn nói được điều gì đó.
  const localPart = email.split('@')[0] ?? '';

  return localPart.slice(0, 1);
}

/* -------------------------------------------------------------------------- */
/* Chủ đề của hệ điều hành.                                                    */
/* -------------------------------------------------------------------------- */

function matchColorScheme(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia(COLOR_SCHEME_QUERY);
}

/**
 * Đăng ký nghe chủ đề hệ điều hành.
 *
 * `useSyncExternalStore` chứ không phải `useState` cộng effect: nhánh "theo hệ
 * thống" đọc giá trị NGAY trong lượt render đầu, còn effect thì để lọt đúng một
 * khung hình vẽ sai chủ đề — chính khung hình mà lựa chọn này tồn tại để tránh.
 */
function subscribeColorScheme(onChange: () => void): () => void {
  const query = matchColorScheme();

  if (query === null) {
    return () => undefined;
  }

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

function readColorScheme(): boolean {
  return matchColorScheme()?.matches ?? false;
}

/** Ba nhánh về hai — `'system'` giải ra tại đây, không ở store (R5). */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): ThemeMode {
  if (choice === 'system') {
    return systemPrefersDark ? 'dark' : 'light';
  }

  return choice;
}

/* -------------------------------------------------------------------------- */
/* Giá trị của cả hai khối.                                                    */
/* -------------------------------------------------------------------------- */

interface PreferenceValues {
  readonly fullName: string;
  readonly jobTitle: string;
  readonly phone: string;
  readonly language: string;
  readonly avatarUrl: string | null;
  readonly theme: ThemeChoice;
  readonly viewportDark: boolean;
  readonly reducedMotion: boolean;
  readonly showGrid: boolean;
  readonly density: DensityChoice;
}

export function useAccountPreferences(
  port: AccountDraftPort,
  avatar: AvatarPort,
  profileProblems: Readonly<Partial<Record<ProfileFieldKey, string>>> = NO_PROBLEMS,
): AccountPreferencesModel {
  // Phiên đăng nhập là nguồn mặc định của họ tên và thư điện tử: bản nháp chỉ
  // giữ những gì người dùng đã tự sửa. `getSessionSnapshot` trả về một tham
  // chiếu ổn định, nên `useSyncExternalStore` không quay vòng.
  const session = useSyncExternalStore(subscribeToSession, getSession, getSession);
  const systemPrefersDark = useSyncExternalStore(
    subscribeColorScheme,
    readColorScheme,
    () => false,
  );
  const osReducedMotion = useReducedMotion();

  const savedProfile = port.saved?.profile;
  const savedAppearance = port.saved?.appearance;
  const sessionUser = session.user;
  // Chủ đề mặc định là của store (đã đọc từ `localStorage['app-theme-mode']`), không phải 'light':
  // bộ nhớ trống mà mặc định 'light' thì vào màn là ghi đè chủ đề người dùng đang dùng.
  const storeTheme = useStore((state) => state.theme);

  const base = useMemo<PreferenceValues>(() => {
    const avatarUrl = savedProfile?.['avatarUrl'];

    return {
      fullName: readText(savedProfile, 'fullName', sessionUser?.name ?? ''),
      jobTitle: readText(savedProfile, 'jobTitle', ''),
      phone: readText(savedProfile, 'phone', ''),
      language: readText(savedProfile, 'language', 'vi'),
      avatarUrl: typeof avatarUrl === 'string' && avatarUrl !== '' ? avatarUrl : null,
      theme: readChoice(savedAppearance, 'theme', THEME_CHOICES, storeTheme),
      viewportDark: readFlag(savedAppearance, 'viewportDark', false),
      reducedMotion: readFlag(savedAppearance, 'reducedMotion', false),
      showGrid: readFlag(savedAppearance, 'showGrid', true),
      density: readChoice(savedAppearance, 'density', DENSITY_CHOICES, 'comfortable'),
    };
  }, [savedAppearance, savedProfile, sessionUser, storeTheme]);

  // `null` nghĩa là người dùng chưa sửa gì trong lượt này, nên bản đã lưu vẫn là
  // sự thật. Sửa lần đầu thì lấy `base` làm điểm xuất phát — không dùng
  // `Partial` chồng lên nhau, vì `exactOptionalPropertyTypes` biến mỗi trường
  // tuỳ chọn thành `T | undefined` và cả mười trường phải kiểm lại một lần nữa.
  const [edits, setEdits] = useState<PreferenceValues | null>(null);

  // Nạp lại ngay trong lượt render khi bản đã lưu đổi — khuôn `useAccountTables`.
  // Chỉ lượt đọc và nút "Hoàn tác" của `useAccountSettings` được đổi `port.saved`
  // (B-V12b-03): ai đổi nó sau MỖI lượt lưu (`setQueryData`, làm mới truy vấn) thì
  // chữ đang gõ dở sẽ mất.
  const [syncedSaved, setSyncedSaved] = useState(port.saved);

  if (port.saved !== syncedSaved) {
    setSyncedSaved(port.saved);
    setEdits(null);
  }

  const values = edits ?? base;

  const [flashedField, setFlashedField] = useState<string | null>(null);
  /** Đang đọc tệp hoặc đang gửi N14 — trạng thái 3. */
  const [isAvatarUploading, setAvatarUploading] = useState(false);
  const [avatarUrlOverride, setAvatarUrlOverride] = useState<string | null>(null);
  const [avatarProblem, setAvatarProblem] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  const [isAvatarLocked, setAvatarLocked] = useState(false);
  const avatarLockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [emailReason, setEmailReason] = useState(EMAIL_REASON_SHORT);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (flashTimer.current !== undefined) {
        clearTimeout(flashTimer.current);
      }

      if (avatarLockTimer.current !== undefined) {
        clearTimeout(avatarLockTimer.current);
      }
    },
    [],
  );

  /**
   * Một lượt sửa: nhớ tại chỗ, báo lên cổng lưu, rồi nháy hàng.
   *
   * Nháy NGAY lúc ghi chứ không đợi máy chủ trả lời, đúng như `useCommitFlash`
   * làm: `port.saved` là ảnh chụp của lượt đọc và nó không đổi sau khi lưu, nên
   * không có tín hiệu "đã lưu xong" nào để bắt. Dựng một bộ đếm 800 ms thứ hai ở
   * đây để đợi tín hiệu ấy chính là thứ `accountDraft.ts` cấm.
   *
   * Thời lượng lấy từ `durationMs('slow')` = 340 ms: đặc tả ghi 400 ms, con số
   * đó không nằm trên thang của mục B, và R1 chỉ đúng vào nấc này —
   * `useCommitFlash.ts` đã đi trước cùng lối.
   */
  const commit = useCallback(
    (
      section: 'appearance' | 'profile',
      key: keyof PreferenceValues,
      value: PreferenceValues[keyof PreferenceValues],
      flashKey: AppearanceFieldKey | ProfileFieldKey | null,
    ): void => {
      setEdits((current) => ({ ...(current ?? base), [key]: value }));
      port.stage(section, { [key]: value });

      if (flashKey === null) {
        return;
      }

      if (flashTimer.current !== undefined) {
        clearTimeout(flashTimer.current);
      }

      setFlashedField(flashKey);
      flashTimer.current = setTimeout(() => setFlashedField(null), durationMs('slow'));
    },
    [base, port],
  );

  /* ---- Chủ đề ---------------------------------------------------------- */

  // Gọi để MOUNT effect của nó: chính effect ấy gắn `<html class="dark">` và ghi
  // `localStorage['app-theme-mode']`. Giá trị trả về không dùng — `toggle` chỉ
  // lật hai nhánh, mà điều khiển ở đây có ba.
  useTheme();
  const setTheme = useStore((state) => state.setTheme);
  const resolvedTheme = resolveTheme(values.theme, systemPrefersDark);

  // Chưa sửa gì và bộ nhớ chưa có chủ đề nào thì store vẫn là sự thật: không ghi đè nó.
  const hasThemeChoice = edits !== null || savedAppearance?.['theme'] !== undefined;

  useEffect(() => {
    if (hasThemeChoice) {
      setTheme(resolvedTheme);
    }
  }, [hasThemeChoice, resolvedTheme, setTheme]);

  /* ---- Giảm chuyển động ------------------------------------------------ */

  const motionOff = values.reducedMotion || osReducedMotion;

  useEffect(() => {
    const root = document.documentElement;

    if (motionOff) {
      root.setAttribute(REDUCED_MOTION_ATTRIBUTE, 'true');
    } else {
      root.removeAttribute(REDUCED_MOTION_ATTRIBUTE);
    }
  }, [motionOff]);

  /* ---- Ảnh đại diện ---------------------------------------------------- */

  const lockAvatar = useCallback((seconds: number) => {
    setAvatarLocked(true);

    if (avatarLockTimer.current !== undefined) {
      clearTimeout(avatarLockTimer.current);
    }

    avatarLockTimer.current = setTimeout(() => setAvatarLocked(false), seconds * MS_PER_SECOND);
  }, []);

  /**
   * Chọn tệp: kiểm tại chỗ (loại, cỡ, độ dài base64), rồi mở hộp thoại A9. Cả ba
   * lần từ chối đều KHÔNG gọi mạng; tệp quá cỡ còn không được đọc.
   */
  const onAvatarFileSelected = useCallback(
    (file: File): void => {
      if (isAvatarLocked) {
        return;
      }

      setAvatarProblem(null);

      if (!isAvatarMimeType(file.type)) {
        setAvatarProblem(AVATAR_MESSAGES.typeUnsupported);

        return;
      }

      if (file.size > AVATAR_MAX_FILE_BYTES) {
        setAvatarProblem(AVATAR_MESSAGES.fileTooBig);

        return;
      }

      const mimeType = file.type;

      setAvatarUploading(true);

      readAsDataUrl(file)
        .then((dataUrl) => {
          const contentBase64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

          if (contentBase64.length > AVATAR_MAX_BASE64_LENGTH) {
            setAvatarProblem(AVATAR_MESSAGES.tooLarge);

            return;
          }

          setPendingAvatar({ mimeType, contentBase64, previewUrl: dataUrl });
        })
        .catch(() => setAvatarProblem(AVATAR_MESSAGES.corrupt))
        .finally(() => setAvatarUploading(false));
    },
    [isAvatarLocked],
  );

  const cancelAvatar = useCallback(() => {
    if (!isAvatarUploading) {
      setPendingAvatar(null);
    }
  }, [isAvatarUploading]);

  const confirmAvatar = useCallback(async (): Promise<void> => {
    if (pendingAvatar === null || isAvatarUploading) {
      return;
    }

    setAvatarUploading(true);

    try {
      const result = await avatar({
        mimeType: pendingAvatar.mimeType,
        contentBase64: pendingAvatar.contentBase64,
      });

      if (result.ok) {
        // Ảnh KHÔNG đi vào bản nháp: nó là trạng thái cục bộ đè lên `values.avatarUrl`.
        setAvatarUrlOverride(result.data.avatarUrl ?? null);
      } else {
        const failure = avatarFailureOf(result.error);

        setAvatarProblem(failure.message);

        if (failure.lockSeconds !== undefined) {
          lockAvatar(failure.lockSeconds);
        }
      }
    } catch (error) {
      setAvatarProblem(avatarFailureOf(error).message);
    } finally {
      setAvatarUploading(false);
      setPendingAvatar(null);
    }
  }, [avatar, isAvatarUploading, lockAvatar, pendingAvatar]);

  /* ---- Ghép mô hình ---------------------------------------------------- */

  const email = sessionUser?.email ?? '';
  const rowClassName = DENSITY_ROW_CLASS[values.density];

  const profile: ProfileSectionProps = {
    avatarUrl: avatarUrlOverride ?? values.avatarUrl,
    avatarInitials: initialsOf(values.fullName, email),
    avatarAlt: values.fullName === '' ? AVATAR_FALLBACK_ALT : `Ảnh đại diện của ${values.fullName}`,
    isAvatarUploading,
    isAvatarLocked,
    avatarStatusLabel: AVATAR_UPLOADING_LABEL,
    onAvatarFileSelected,
    avatarProblem,
    avatarReplace: {
      isOpen: pendingAvatar !== null,
      previewUrl: pendingAvatar?.previewUrl ?? '',
      hasExistingAvatar: (avatarUrlOverride ?? values.avatarUrl) !== null,
      isSending: isAvatarUploading,
      onConfirm: () => void confirmAvatar(),
      onCancel: cancelAvatar,
    } satisfies AvatarReplaceDialogProps,
    problems: profileProblems,
    fullName: values.fullName,
    onFullNameChange: (value) => commit('profile', 'fullName', value, 'fullName'),
    jobTitle: values.jobTitle,
    onJobTitleChange: (value) => commit('profile', 'jobTitle', value, 'jobTitle'),
    jobTitlePlaceholder: JOB_TITLE_PLACEHOLDER,
    email: email === '' ? MISSING_VALUE : email,
    emailReadOnlyReason: emailReason,
    onChangeEmail: () => setEmailReason(EMAIL_REASON_LONG),
    phone: values.phone,
    onPhoneChange: (value) => commit('profile', 'phone', value, 'phone'),
    language: values.language,
    languageOptions: LANGUAGE_OPTIONS,
    onLanguageChange: (value) => commit('profile', 'language', value, 'language'),
    flashedField: isProfileField(flashedField) ? flashedField : null,
    rowClassName,
    motionOff,
  };

  const appearance: AppearanceSectionProps = {
    theme: values.theme,
    onThemeChange: (value) => commit('appearance', 'theme', value, 'theme'),
    viewportDark: values.viewportDark,
    onViewportDarkChange: (value) => commit('appearance', 'viewportDark', value, 'viewportDark'),
    reducedMotion: values.reducedMotion,
    onReducedMotionChange: (value) => commit('appearance', 'reducedMotion', value, 'reducedMotion'),
    showGrid: values.showGrid,
    onShowGridChange: (value) => commit('appearance', 'showGrid', value, 'showGrid'),
    density: values.density,
    onDensityChange: (value) => commit('appearance', 'density', value, 'density'),
    flashedField: isAppearanceField(flashedField) ? flashedField : null,
    rowClassName,
    motionOff,
  };

  return { profile, appearance };
}

/**
 * Một khoá nháy, hai khối.
 *
 * Chỉ một hàng nháy tại một thời điểm trong cả hai khối, nên trạng thái là MỘT
 * chuỗi; hai hàm dưới đây chia nó về đúng khối. Chia bằng danh sách chứ không
 * bằng ép kiểu, để thêm một hàng mà quên khai báo thì hàng đó lặng lẽ không nháy
 * chứ không nháy nhầm ở khối bên kia.
 */
const PROFILE_FIELDS: readonly ProfileFieldKey[] = ['fullName', 'jobTitle', 'language', 'phone'];

const APPEARANCE_FIELDS: readonly AppearanceFieldKey[] = [
  'density',
  'reducedMotion',
  'showGrid',
  'theme',
  'viewportDark',
];

function isProfileField(key: string | null): key is ProfileFieldKey {
  return key !== null && (PROFILE_FIELDS as readonly string[]).includes(key);
}

function isAppearanceField(key: string | null): key is AppearanceFieldKey {
  return key !== null && (APPEARANCE_FIELDS as readonly string[]).includes(key);
}
