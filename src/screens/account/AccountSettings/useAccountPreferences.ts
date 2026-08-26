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
 * | họ tên, chức danh, điện thoại, ngôn ngữ, ảnh đại diện | `port.stage('profile', …)` | dữ liệu tài khoản, chưa bao giờ là cờ tính năng |
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
import { getSession, subscribeToSession } from '@/lib/auth';
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
import type { ProfileFieldKey, ProfileSectionProps } from './ProfileSection';
import type { AccountDraftPort } from './accountDraft';

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

export function useAccountPreferences(port: AccountDraftPort): AccountPreferencesModel {
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

  const base = useMemo<PreferenceValues>(() => {
    const avatarUrl = savedProfile?.['avatarUrl'];

    return {
      fullName: readText(savedProfile, 'fullName', sessionUser?.name ?? ''),
      jobTitle: readText(savedProfile, 'jobTitle', ''),
      phone: readText(savedProfile, 'phone', ''),
      language: readText(savedProfile, 'language', 'vi'),
      avatarUrl: typeof avatarUrl === 'string' && avatarUrl !== '' ? avatarUrl : null,
      theme: readChoice(savedAppearance, 'theme', THEME_CHOICES, 'light'),
      viewportDark: readFlag(savedAppearance, 'viewportDark', false),
      reducedMotion: readFlag(savedAppearance, 'reducedMotion', false),
      showGrid: readFlag(savedAppearance, 'showGrid', true),
      density: readChoice(savedAppearance, 'density', DENSITY_CHOICES, 'comfortable'),
    };
  }, [savedAppearance, savedProfile, sessionUser]);

  // `null` nghĩa là người dùng chưa sửa gì trong lượt này, nên bản đã lưu vẫn là
  // sự thật. Sửa lần đầu thì lấy `base` làm điểm xuất phát — không dùng
  // `Partial` chồng lên nhau, vì `exactOptionalPropertyTypes` biến mỗi trường
  // tuỳ chọn thành `T | undefined` và cả mười trường phải kiểm lại một lần nữa.
  const [edits, setEdits] = useState<PreferenceValues | null>(null);
  const values = edits ?? base;

  const [flashedField, setFlashedField] = useState<string | null>(null);
  const [isAvatarUploading, setAvatarUploading] = useState(false);
  const [emailReason, setEmailReason] = useState(EMAIL_REASON_SHORT);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (flashTimer.current !== undefined) {
        clearTimeout(flashTimer.current);
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

  useEffect(() => {
    setTheme(resolvedTheme);
  }, [resolvedTheme, setTheme]);

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

  /**
   * Trạng thái 3 của khối này, và nó là một lượt đọc THẬT.
   *
   * `ENDPOINTS` không có nhóm nào cho ảnh đại diện và `src/api/**` là thư mục
   * màn này không sửa, nên không có đường mạng nào để gọi. `FileReader` đọc tệp
   * ngay tại máy, ra một `data:` URL đi vừa vào bản nháp — cùng khuôn "bộ nhớ
   * trong" mà `accountSettingsGateway.ts` đã ghi là khoản nợ T-08. Lượt đọc ấy
   * mất thời gian thật, nên "một phần" ở đây không phải một trạng thái diễn.
   */
  const onAvatarFileSelected = useCallback(
    (file: File): void => {
      setAvatarUploading(true);

      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result;

        setAvatarUploading(false);

        if (typeof result === 'string') {
          commit('profile', 'avatarUrl', result, null);
        }
      };

      reader.onerror = () => setAvatarUploading(false);
      reader.readAsDataURL(file);
    },
    [commit],
  );

  /* ---- Ghép mô hình ---------------------------------------------------- */

  const email = sessionUser?.email ?? '';
  const rowClassName = DENSITY_ROW_CLASS[values.density];

  const profile: ProfileSectionProps = {
    avatarUrl: values.avatarUrl,
    avatarInitials: initialsOf(values.fullName, email),
    avatarAlt: values.fullName === '' ? AVATAR_FALLBACK_ALT : `Ảnh đại diện của ${values.fullName}`,
    isAvatarUploading,
    avatarStatusLabel: AVATAR_UPLOADING_LABEL,
    onAvatarFileSelected,
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
    onReducedMotionChange: (value) =>
      commit('appearance', 'reducedMotion', value, 'reducedMotion'),
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
