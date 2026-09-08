/**
 * Dữ liệu mẫu dùng chung cho `ShareDialog.test.tsx` và `ShareDialog.stories.tsx`.
 *
 * Khuôn theo `exportPanelFixtures.ts`: số liệu KHÔNG viết tay tại chỗ khi repo đã có
 * nguồn (R-70). Cụ thể, mọi chuỗi người đọc dưới đây đi ra từ chính các hàm mà
 * `useShareDialog` (do worker khác viết) sẽ gọi:
 *
 *  - địa chỉ liên kết  ← `shareLinkUrl(link)`                (`lib/export/shareLink.ts:853`)
 *  - mã nhúng          ← `buildEmbedCode({ … })`             (`lib/export/embedParams.ts:779`)
 *  - khung xem trước   ← `resolveEmbedView(params)`          (`lib/export/embedParams.ts:527`)
 *  - câu hạn dùng      ← `describeShareLinkExpiry(link, now)` (`shareLink.ts:798`)
 *  - câu lỗi biểu mẫu  ← `validateShareLinkRequest(req)`     (`shareLink.ts:440`)
 *  - nhãn quyền/trạng thái ← `SHARE_PERMISSION_LABELS` · `SHARE_LINK_STATUS_LABELS`
 *  - nhãn hạn dùng     ← `SHARE_EXPIRY_LABELS`               (`hooks/useShareLinks.ts:85`)
 *  - "Đã lưu lúc 14:32" ← `formatClockTime(FAKE_CLOCK_START)` (A7, A15)
 *
 * ## Hai chỗ buộc phải viết tay, và vì sao
 *
 *  1. **`ShareLink.url`** — một `ShareLink` là bản ghi CỦA MÁY CHỦ; địa chỉ của nó do
 *     máy chủ cấp và repo không có nguồn nào sinh ra nó (không có mock share-link trong
 *     `src/api/__mocks__/client.ts`). Đây đúng là việc một fixture tồn tại để làm: đóng
 *     vai câu trả lời của máy chủ. Host `example.com` theo đúng lệ sẵn có của mock
 *     client (`client.ts:34,137,386`). Bài kiểm chống-ghép-chuỗi trong
 *     `ShareDialog.test.tsx` vì thế BỎ QUA file này và soát các file CHẠY ĐƯỢC của màn —
 *     nơi lệnh cấm thật sự áp dụng: view và hook không được tự ghép URL hay thẻ `<iframe`.
 *  2. **Tên thành viên tiếng Việt** — `src/api/__mocks__/client.ts:106-112` có ba thành
 *     viên thật nhưng tên họ là `Admin`/`Engineer`/`Viewer`, tức chữ tiếng Anh trên màn
 *     và `expectVietnamese` sẽ đỏ. Tiền lệ đang chạy trong repo là
 *     `ProjectSettings.stories.tsx:26-28`, tự đặt tên tiếng Việt cho đúng ba vai đó.
 *     Nhãn vai thì lấy đúng ba chữ `ProjectSettings` đang dùng, không nghĩ ra chữ mới.
 *
 * ## Mật khẩu
 *
 * `ShareLinkFormModel.password` chỉ sống TRƯỚC khi lưu. Sau khi lưu, một `ShareLink`
 * chỉ mang `passwordProtected: boolean` — `ShareLinkWireSchema` strip mọi khoá nó không
 * kể tên, nên bản ghi trả về **không thể** mang mật khẩu. Fixture giữ đúng ranh giới đó:
 * chuỗi mật khẩu chỉ xuất hiện ở `form.password` của trạng thái đang soạn, và không bao
 * giờ ở một `ShareLinkRowModel`.
 */

import { SAMPLE_BUILDING, sampleLevelId } from '@/domain/spatial/__fixtures__/sampleBuilding';
import type { LevelId } from '@/domain/spatial/types';
import { SHARE_EXPIRY_CHOICES, SHARE_EXPIRY_LABELS } from '@/hooks/useShareLinks';
import { COLORING_MODE_IDS, COLORING_MODE_LABELS } from '@/lib/coloring/modes';
import type { ColoringModeId } from '@/lib/coloring/modes';
import {
  buildEmbedCode,
  DEFAULT_EMBED_HEIGHT_PX,
  DEFAULT_EMBED_WIDTH_PX,
  resolveEmbedView,
} from '@/lib/export/embedParams';
import type { EmbedParams } from '@/lib/export/embedParams';
import {
  describeShareLinkExpiry,
  MIN_SHARE_PASSWORD_LENGTH,
  SHARE_LINK_STATUS_LABELS,
  SHARE_PERMISSION_LABELS,
  SHARE_PERMISSIONS,
  shareLinkUrl,
  validateShareLinkRequest,
} from '@/lib/export/shareLink';
import type { ShareLink, ShareLinkRequestField, SharePermission } from '@/lib/export/shareLink';
import { formatClockTime } from '@/lib/format/datetime';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import type {
  EmbedEditableKey,
  EmbedSectionModel,
  EmbedSizePreset,
  MemberRowModel,
  ShareDialogActions,
  ShareDialogModel,
  ShareDialogOption,
  ShareDialogProps,
  ShareLinkFormModel,
  ShareLinkRowModel,
} from './types';

/* ==========================================================================
 * 0. Hằng số chung.
 * ========================================================================== */

/** Mã dự án mẫu — cùng một mã cho cả bảy trạng thái, khớp `client.ts:105`. */
export const SAMPLE_PROJECT_ID = 'project-1';

/** `id` của tiêu đề hộp thoại — view gắn `aria-labelledby` vào đây. */
export const SAMPLE_TITLE_ID = 'share-dialog-title';

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

const SEVEN_DAYS = 7;

/** Bảy ngày — đúng một lựa chọn CÓ THẬT của `SHARE_EXPIRY_CHOICES`, không tự nghĩ ra. */
const SEVEN_DAY_CHOICE = SHARE_EXPIRY_CHOICES[1];

const sevenDaysAfterStart = new Date(FAKE_CLOCK_START.getTime() + SEVEN_DAYS * MS_PER_DAY);
const oneDayBeforeStart = new Date(FAKE_CLOCK_START.getTime() - MS_PER_DAY);

/* ==========================================================================
 * 1. Bản ghi máy chủ: ba `ShareLink`.
 * ========================================================================== */

/**
 * Địa chỉ máy chủ cấp cho liên kết mẫu. Xem ghi chú (1) ở đầu file: repo không có
 * nguồn nào sinh ra chuỗi này, và đó chính là chỗ một fixture tồn tại để lấp.
 */
const SAMPLE_SHARE_HREF = 'https://example.com/s/8f2c7a10ab';
const SAMPLE_EXPIRED_HREF = 'https://example.com/s/4d19be0077';

function buildShareLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: 'share-1',
    projectId: SAMPLE_PROJECT_ID,
    url: SAMPLE_SHARE_HREF,
    permission: 'view',
    status: 'active',
    createdAt: FAKE_CLOCK_START.toISOString(),
    expiresAt: sevenDaysAfterStart.toISOString(),
    revokedAt: null,
    passwordProtected: false,
    viewpointCode: null,
    label: null,
    ...overrides,
  };
}

/** Liên kết còn dùng được — nền của trạng thái "thành công". */
export const SAMPLE_ACTIVE_LINK: ShareLink = buildShareLink();

/** Liên kết đã hết hạn — nền của trạng thái "một phần". */
export const SAMPLE_EXPIRED_LINK: ShareLink = buildShareLink({
  id: 'share-2',
  url: SAMPLE_EXPIRED_HREF,
  status: 'expired',
  expiresAt: oneDayBeforeStart.toISOString(),
  permission: 'comment',
});

/** Liên kết có mật khẩu — chỉ mang cờ `passwordProtected`, không mang mật khẩu. */
export const SAMPLE_PROTECTED_LINK: ShareLink = buildShareLink({
  id: 'share-3',
  passwordProtected: true,
});

/* ==========================================================================
 * 2. Hàng liên kết — mọi chuỗi do `lib/export/shareLink` sinh.
 * ========================================================================== */

/**
 * Đúng ba màu trạng thái (A4). `verified` KHÔNG dùng ở đây: xanh "đã xác minh" chỉ
 * đánh dấu việc người duyệt (A5), còn một liên kết đang sống thì không phải một lượt
 * duyệt. Nên còn hai màu: `attention` cho liên kết hết hiệu lực, `neutral` cho phần
 * còn lại.
 */
function toneOf(link: ShareLink): ShareLinkRowModel['tone'] {
  return link.status === 'active' ? 'neutral' : 'attention';
}

/** Một hàng liên kết, dựng từ bản ghi máy chủ và mốc đồng hồ giả. */
export function buildShareLinkRow(
  link: ShareLink,
  now: Date = FAKE_CLOCK_START,
): ShareLinkRowModel {
  return {
    id: link.id,
    url: shareLinkUrl(link),
    permissionLabel: SHARE_PERMISSION_LABELS[link.permission],
    statusLabel: SHARE_LINK_STATUS_LABELS[link.status],
    tone: toneOf(link),
    expiryText: describeShareLinkExpiry(link, now).text,
    passwordProtected: link.passwordProtected,
    canRevoke: link.status === 'active',
  };
}

/* ==========================================================================
 * 3. Nhúng — `params` → `view` + `code`, cả hai đều do lib sinh.
 * ========================================================================== */

const ARTICLE_WIDTH_PX = 640;
const ARTICLE_HEIGHT_PX = 400;
const WIDE_WIDTH_PX = 1280;
const WIDE_HEIGHT_PX = 720;

/** Ba khổ nhúng, nhãn tiếng Việt viết thường kiểu câu (A6). */
export const SAMPLE_SIZE_PRESETS: readonly EmbedSizePreset[] = [
  {
    id: 'article',
    label: 'vừa cột bài viết',
    widthPx: ARTICLE_WIDTH_PX,
    heightPx: ARTICLE_HEIGHT_PX,
  },
  {
    id: 'default',
    label: 'khổ mặc định',
    widthPx: DEFAULT_EMBED_WIDTH_PX,
    heightPx: DEFAULT_EMBED_HEIGHT_PX,
  },
  { id: 'wide', label: 'tràn chiều ngang', widthPx: WIDE_WIDTH_PX, heightPx: WIDE_HEIGHT_PX },
];

/** Bộ tham số nhúng mặc định: tầng đầu của `SAMPLE_BUILDING`, tô theo công năng phòng. */
export const SAMPLE_EMBED_PARAMS: EmbedParams = {
  levelId: sampleLevelId(0),
  coloring: 'roomUsage',
  toolbar: true,
  viewpointCode: null,
};

/**
 * Danh mục tầng, đọc thẳng từ bốn tầng của bộ mẫu chuẩn A14 (`SAMPLE_BUILDING.levels`),
 * đúng tiền lệ `exportPanelGateway.ts:276` — không tự đặt lại tên tầng.
 *
 * Tên tầng của bộ mẫu là `Level 0`…`Level 3` (`sampleBuilding.ts:85`), tức chữ tiếng Anh
 * trong dữ liệu chứ không phải trong chữ của màn; `ShareDialog.test.tsx` neo đúng dạng đó
 * qua `ignore`, cùng cách `ExportPanel.test.tsx:110` làm.
 */
export const SAMPLE_LEVEL_OPTIONS: readonly ShareDialogOption<LevelId>[] = SAMPLE_BUILDING.levels.map(
  (level) => ({ id: level.id, label: level.name }),
);

/** Bảy chế độ tô màu, nhãn tiếng Việt từ `COLORING_MODE_LABELS` — không viết tay. */
export const SAMPLE_COLORING_OPTIONS: readonly ShareDialogOption<ColoringModeId>[] =
  COLORING_MODE_IDS.map((id) => ({ id, label: COLORING_MODE_LABELS[id] }));

export interface EmbedSectionOverrides {
  readonly params?: EmbedParams;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly activeSizePresetId?: string | null;
  readonly recentlyChangedKey?: EmbedEditableKey | null;
  readonly previewHidden?: boolean;
}

/**
 * Một `EmbedSectionModel` mà `view` và `code` LUÔN được tính lại từ `params`.
 *
 * Đây là điểm tựa của bài "khoá nhúng và khung xem trước phải khớp nhau": đổi một khoá
 * trong `params` rồi gọi lại hàm này thì cả hai đầu ra cùng đổi theo, vì cả hai đều đi
 * ra từ `lib/export/embedParams`, không từ một chuỗi ghép tay.
 */
export function buildEmbedSection(overrides: EmbedSectionOverrides = {}): EmbedSectionModel {
  const params = overrides.params ?? SAMPLE_EMBED_PARAMS;
  const widthPx = overrides.widthPx ?? DEFAULT_EMBED_WIDTH_PX;
  const heightPx = overrides.heightPx ?? DEFAULT_EMBED_HEIGHT_PX;
  const matching = SAMPLE_SIZE_PRESETS.find(
    (preset) => preset.widthPx === widthPx && preset.heightPx === heightPx,
  );

  return {
    params,
    view: resolveEmbedView(params),
    code: buildEmbedCode({ url: SAMPLE_ACTIVE_LINK.url, params, widthPx, heightPx }),
    widthPx,
    heightPx,
    levelOptions: SAMPLE_LEVEL_OPTIONS,
    coloringOptions: SAMPLE_COLORING_OPTIONS,
    sizePresets: SAMPLE_SIZE_PRESETS,
    activeSizePresetId: overrides.activeSizePresetId ?? matching?.id ?? null,
    recentlyChangedKey: overrides.recentlyChangedKey ?? null,
    previewHidden: overrides.previewHidden ?? false,
  };
}

/* ==========================================================================
 * 4. Thành viên — CHỈ ĐỌC trong bản này.
 * ========================================================================== */

/**
 * Ba vai của bộ mẫu (`client.ts:106-112`), tên tiếng Việt và nhãn vai đúng ba chữ
 * `ProjectSettings` đang dùng (`useProjectSettings.ts:397-401`). Xem ghi chú (2).
 */
export const SAMPLE_MEMBERS: readonly MemberRowModel[] = [
  {
    id: 'user-1',
    name: 'Phạm An',
    email: 'admin@example.com',
    initials: 'PA',
    avatarUrl: null,
    roleLabel: 'quản trị',
    isOwner: true,
  },
  {
    id: 'user-2',
    name: 'Nguyễn Bình',
    email: 'engineer@example.com',
    initials: 'NB',
    avatarUrl: null,
    roleLabel: 'kỹ sư',
    isOwner: false,
  },
  {
    id: 'user-3',
    name: 'Trần Chi',
    email: 'viewer@example.com',
    initials: 'TC',
    avatarUrl: null,
    roleLabel: 'người xem',
    isOwner: false,
  },
];

/** Một câu nói vì sao danh sách này chỉ để xem — cùng lý do `MembersTab.tsx:1-10` ghi. */
export const MEMBERS_READ_ONLY_REASON =
  'Danh sách thành viên chỉ để xem trong bản này; mời thêm người cần một cửa dữ liệu chưa có.';

/** Một câu nói vì sao không đổi được, hiện ngay tại mục bị khoá (trạng thái "không có quyền"). */
export const NO_PERMISSION_REASON =
  'Chỉ quản trị viên và kỹ sư của dự án mới tạo được liên kết chia sẻ.';

/** Đổi khoá nhúng thì liên kết cũ hết hiệu lực — một dòng nhắc, không phải hộp thoại. */
export const STALE_LINK_NOTICE =
  'Bạn vừa đổi thiết lập nhúng; mã nhúng đã sao chép trước đó không còn khớp.';

/* ==========================================================================
 * 5. Biểu mẫu — câu lỗi do `validateShareLinkRequest` sinh (L-03).
 * ========================================================================== */

/** Mật khẩu ngắn hơn ngưỡng THẬT của lib, để lib tự sinh câu lỗi thay vì ta nghĩ ra. */
export const TOO_SHORT_PASSWORD = 'a'.repeat(MIN_SHARE_PASSWORD_LENGTH - 1);

/** Mật khẩu hợp lệ, chỉ sống ở `form.password` của trạng thái đang soạn. */
export const SAMPLE_DRAFT_PASSWORD = 'mo-khoa-2026';

function problemsFor(password: string): Partial<Record<ShareLinkRequestField, string>> {
  const found: Partial<Record<ShareLinkRequestField, string>> = {};

  for (const problem of validateShareLinkRequest({
    projectId: SAMPLE_PROJECT_ID,
    permission: 'view',
    expiresAt: sevenDaysAfterStart,
    now: FAKE_CLOCK_START,
    password,
  })) {
    found[problem.field] = problem.message;
  }

  return found;
}

/** Câu lỗi THẬT cho một mật khẩu quá ngắn — không viết tay (L-03, R-70). */
export const SAMPLE_FORM_PROBLEMS = problemsFor(TOO_SHORT_PASSWORD);

/** Hai mức quyền, nhãn từ `SHARE_PERMISSION_LABELS` — đúng thứ tự bộ chọn liệt kê. */
export const SAMPLE_PERMISSION_OPTIONS: readonly ShareDialogOption<SharePermission>[] =
  SHARE_PERMISSIONS.map((permission) => ({
    id: permission,
    label: SHARE_PERMISSION_LABELS[permission],
  }));

/** Năm lựa chọn hạn dùng, nhãn từ `SHARE_EXPIRY_LABELS` — không viết tay. */
export const SAMPLE_EXPIRY_CHOICES: readonly ShareDialogOption<string>[] = SHARE_EXPIRY_CHOICES.map(
  (choice) => ({ id: choice, label: SHARE_EXPIRY_LABELS[choice] }),
);

export function buildShareLinkForm(overrides: Partial<ShareLinkFormModel> = {}): ShareLinkFormModel {
  const problems = overrides.problems ?? {};

  return {
    permission: 'view',
    permissionOptions: SAMPLE_PERMISSION_OPTIONS,
    expiryChoiceId: SEVEN_DAY_CHOICE,
    expiryChoices: SAMPLE_EXPIRY_CHOICES,
    passwordEnabled: false,
    password: '',
    includeViewpoint: false,
    canSubmit: Object.keys(problems).length === 0,
    ...overrides,
    problems,
  };
}

/** Nhãn tiếng Việt của lựa chọn hạn dùng đang chọn — dùng cho story và cho khẳng định. */
export const SEVEN_DAY_EXPIRY_LABEL = SHARE_EXPIRY_LABELS[SEVEN_DAY_CHOICE];

/* ==========================================================================
 * 6. Mười sáu hành động — không làm gì; test tự ghi đè bằng `vi.fn()`.
 * ========================================================================== */

export const NOOP_SHARE_DIALOG_ACTIONS: ShareDialogActions = {
  setPermission: () => undefined,
  setExpiryChoice: () => undefined,
  setPasswordEnabled: () => undefined,
  setPassword: () => undefined,
  setIncludeViewpoint: () => undefined,
  createLink: () => undefined,
  revokeLink: () => undefined,
  copyLink: () => undefined,
  copyEmbedCode: () => undefined,
  setEmbedLevel: () => undefined,
  setEmbedColoring: () => undefined,
  setEmbedToolbar: () => undefined,
  setEmbedSizePreset: () => undefined,
  setEmbedWidth: () => undefined,
  setEmbedHeight: () => undefined,
  dismiss: () => undefined,
};

/* ==========================================================================
 * 7. Bảy trạng thái (A11).
 * ========================================================================== */

/** "Đã lưu lúc 14:32" — mốc tự lưu của sản phẩm, do `formatClockTime` sinh (A7). */
export const SAMPLE_SAVED_AT_LABEL = `Đã lưu lúc ${formatClockTime(FAKE_CLOCK_START)}`;

/** Câu lỗi của trạng thái "lỗi": lượt gọi mạng hỏng, nói ra bằng tiếng Việt. */
export const SAMPLE_ERROR_MESSAGE =
  'Không tạo được liên kết chia sẻ. Kiểm tra kết nối rồi thử lại.';

function modelForState(state: SevenState): ShareDialogModel {
  const base: ShareDialogModel = {
    state,
    savedAtLabel: SAMPLE_SAVED_AT_LABEL,
    canCreateLink: true,
    noPermissionReason: null,
    members: SAMPLE_MEMBERS,
    membersReadOnlyReason: MEMBERS_READ_ONLY_REASON,
    form: buildShareLinkForm(),
    rows: [],
    embed: buildEmbedSection(),
    copiedTargetId: null,
    errorMessage: null,
    staleLinkNotice: null,
  };

  switch (state) {
    case 'empty':
      // Chưa có liên kết nào: biểu mẫu sẵn sàng, danh sách rỗng, chưa từng lưu.
      return { ...base, rows: [], savedAtLabel: null };
    case 'loading':
      // Đang tạo: biểu mẫu khoá lại, chưa có hàng nào để hiện.
      return { ...base, rows: [], form: buildShareLinkForm({ canSubmit: false }) };
    case 'partial':
      // Có liên kết nhưng đã hết hạn — một phần việc đã xong, phần còn lại thì không.
      return { ...base, rows: [buildShareLinkRow(SAMPLE_EXPIRED_LINK)] };
    case 'error':
      // Biểu mẫu sai (mật khẩu quá ngắn) CỘNG lời báo hỏng của lượt gọi mạng.
      return {
        ...base,
        rows: [],
        errorMessage: SAMPLE_ERROR_MESSAGE,
        form: buildShareLinkForm({
          passwordEnabled: true,
          password: TOO_SHORT_PASSWORD,
          problems: SAMPLE_FORM_PROBLEMS,
          canSubmit: false,
        }),
      };
    case 'success':
      // Có liên kết dùng được, cộng một liên kết CÓ mật khẩu — để chứng minh rằng sau
      // khi lưu chỉ còn dấu hiệu `passwordProtected`, không còn chuỗi mật khẩu nào.
      return {
        ...base,
        rows: [buildShareLinkRow(SAMPLE_ACTIVE_LINK), buildShareLinkRow(SAMPLE_PROTECTED_LINK)],
      };
    case 'forbidden':
      return {
        ...base,
        rows: [],
        canCreateLink: false,
        noPermissionReason: NO_PERMISSION_REASON,
        form: buildShareLinkForm({ canSubmit: false }),
      };
    case 'collapsed':
      // Dưới 1280: khung xem trước ẩn, mọi thứ khác vẫn ở đó.
      return {
        ...base,
        rows: [buildShareLinkRow(SAMPLE_ACTIVE_LINK)],
        embed: buildEmbedSection({ previewHidden: true }),
      };
    default:
      return base;
  }
}

/**
 * Một `ShareDialogProps` hợp lệ cho một trong bảy trạng thái.
 *
 * @param state một trong bảy trạng thái của A11.
 * @param overrides vá từng phần vào `model`.
 * @param actionOverrides vá từng phần vào `actions` — nơi `vi.fn()` đi vào.
 */
export function buildShareDialogProps(
  state: SevenState,
  overrides: Partial<ShareDialogModel> = {},
  actionOverrides: Partial<ShareDialogActions> = {},
): ShareDialogProps {
  return {
    isOpen: true,
    titleId: SAMPLE_TITLE_ID,
    model: { ...modelForState(state), ...overrides },
    actions: { ...NOOP_SHARE_DIALOG_ACTIONS, ...actionOverrides },
  };
}
