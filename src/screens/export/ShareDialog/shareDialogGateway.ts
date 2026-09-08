/**
 * Cổng dữ liệu của hộp thoại chia sẻ: mọi thứ hook cần mà không phải React.
 *
 * Chép khuôn `ExportPanel/exportPanelGateway.ts` — một file thuần, không hook,
 * không JSX — nên nó test được và tính toán được ngoài một cây React. Ba việc:
 *
 *  1. **Dựng `ShareLinkGateway` thật.** `createHttpShareLinkGateway(http)` là
 *     bộ chuyển đổi duy nhất của `src/lib/export/shareLink.ts`; `http` đến từ
 *     `createHttpClient` của `src/lib/http`, với đúng base URL mà
 *     `src/api/appClient.ts` đã chốt cho cả ứng dụng. File này **không** gọi
 *     `fetch` và **không** ghép một đường dẫn nào — `SHARE_LINK_ENDPOINTS` nằm
 *     bên trong bộ chuyển đổi kia, và luật `local/no-fetch-outside-http` canh
 *     phần còn lại.
 *  2. **Đường đọc danh sách thành viên.** `ProjectSchema.members` là
 *     `z.array(UserSchema)`, nên `client.projects.read(projectId)` đã mang đủ
 *     id · name · email · role · avatarUrl?. Không có endpoint mời (mã prompt
 *     dữ liệu còn thiếu: **T-01**), nên danh sách này **chỉ để xem** — xem
 *     {@link MEMBERS_READ_ONLY_REASON}.
 *  3. **Bảng tra và phép chuyển thuần** mà hook nối vào: nhãn vai, chữ cái đầu,
 *     hạn dùng, cỡ khung nhúng, khoá bộ nhớ đệm.
 *
 * ## Vì sao không dùng `useShareLinkGateway` của `src/hooks`
 *
 * Hook đó dựng cổng trên `AuthHttpClient` và **trả `null`** khi `configureAuth()`
 * chưa chạy. Hợp đồng `UseShareDialogOptions.gateway` là `ShareLinkGateway`
 * không nhận `null`, và một hộp thoại không phải chỗ để quyết định ứng dụng có
 * phiên đăng nhập hay chưa. Ngày vỏ ứng dụng gọi `configureAuth()` ở điểm khởi
 * động, nơi gắn hộp thoại chỉ cần truyền cổng của mình xuống qua
 * `ShareDialogContainerProps.gateway` — đó là lý do prop ấy tồn tại.
 */

import { createAppApiClient, resolveApiBaseUrl } from '@/api/appClient';
import type { ApiClient, User } from '@/api/client';
import type { Level, LevelId } from '@/domain/spatial/types';
import {
  SHARE_EXPIRY_CHOICES,
  SHARE_EXPIRY_LABELS,
  type ShareExpiryChoice,
} from '@/hooks/useShareLinks';
import { can } from '@/lib/auth/permissions';
import { COLORING_MODE_IDS, COLORING_MODE_LABELS, type ColoringModeId } from '@/lib/coloring/modes';
import {
  DEFAULT_EMBED_HEIGHT_PX,
  DEFAULT_EMBED_WIDTH_PX,
  DEFAULT_TOOLBAR_VISIBLE,
  type EmbedParams,
} from '@/lib/export/embedParams';
import {
  createHttpShareLinkGateway,
  SHARE_PERMISSION_LABELS,
  SHARE_PERMISSIONS,
  type SharePermission,
  type ShareLinkGateway,
} from '@/lib/export/shareLink';
import { createHttpClient } from '@/lib/http';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ProjectRole } from '@/types/project';

import type { EmbedSizePreset, MemberRowModel, ShareDialogOption } from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Cổng mạng                                                              */
/* -------------------------------------------------------------------------- */

/**
 * `ShareLinkGateway` thật, trên `HttpClient` của ứng dụng.
 *
 * Dựng một lần cho mỗi lần gắn hộp thoại (container bọc trong `useMemo`): cổng
 * này không giữ trạng thái, nhưng `createHttpClient` thì có — hàng đợi
 * single-flight và bộ đếm thử lại của nó chỉ có nghĩa khi cùng một client sống
 * qua nhiều lượt vẽ.
 */
export function createShareDialogGateway(): ShareLinkGateway {
  return createHttpShareLinkGateway(createHttpClient({ baseUrl: resolveApiBaseUrl() }));
}

/** `ApiClient` cho lượt đọc thành viên. Cùng một quyết định thật/giả với cả ứng dụng. */
export function createShareDialogApiClient(): ApiClient {
  return createAppApiClient();
}

/* -------------------------------------------------------------------------- */
/* 2 — Khoá bộ nhớ đệm (R-64)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Khoá của lượt đọc danh sách liên kết.
 *
 * `queryKeys` không có nhánh `shareLinks` và `src/lib/query` nằm ngoài phạm vi
 * sửa của lượt này (R-68), nên khoá nối thêm một nhánh vào khoá chi tiết dự án
 * có sẵn — đúng cách `exportRunQueryKey` (`useExportPanel.ts:119`) đã làm. Nhờ
 * nằm dưới `project.detail(id)`, một lần vô hiệu hoá khoá cha kéo theo cả nó.
 */
export const shareLinksQueryKey = (projectId: string) =>
  [...queryKeys.project.detail(projectId), 'shareLinks'] as const;

/** Khoá của lượt đọc thành viên — nhánh này `queryKeys` đã có sẵn. */
export const shareMembersQueryKey = (projectId: string) => queryKeys.project.members(projectId);

/* -------------------------------------------------------------------------- */
/* 3 — Quyền                                                                  */
/* -------------------------------------------------------------------------- */

/** `can('create', 'share', { roles })` — một khoá gác cả mục liên kết. */
export function readShareLinkPermission(roles: readonly ProjectRole[]): boolean {
  return can('create', 'share', { roles });
}

/**
 * Câu hiện ngay tại mục bị khoá khi {@link readShareLinkPermission} trả `false`.
 *
 * Nói ra ma trận quyền thật (`src/lib/auth/permissions.ts`: `share.create` bật
 * cho `admin` và `engineer`), không nói "bạn không có quyền" rồi để người đọc
 * tự đoán phải hỏi ai.
 */
export const SHARE_FORBIDDEN_REASON =
  'chỉ quản trị viên và kỹ sư của dự án tạo được liên kết chia sẻ; hãy nhờ một người trong hai vai đó tạo giúp';

/* -------------------------------------------------------------------------- */
/* 4 — Thành viên (CHỈ ĐỌC)                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Vì sao danh sách người có quyền không sửa được ở bản này.
 *
 * Không phải một lời hứa suông: `src/api/endpoints.ts` không có đường mời, gỡ
 * hay đổi vai, nên một nút "mời" ở đây sẽ gọi vào chỗ trống. Tiền lệ là
 * `ProjectSettings/MembersTab.tsx`.
 */
export const MEMBERS_READ_ONLY_REASON =
  'bản này chỉ hiển thị những người đã có quyền; việc mời thêm và đổi vai làm ở phần cài đặt dự án';

/** Nhãn vai tiếng Việt, viết thường kiểu câu (A6). */
export const SHARE_ROLE_LABELS: Readonly<Record<ProjectRole, string>> = Object.freeze({
  admin: 'quản trị viên',
  engineer: 'kỹ sư',
  viewer: 'người xem',
});

/** Số chữ cái một `Avatar` không ảnh hiện được. */
const INITIALS_LENGTH = 2;

/**
 * Chữ cái đầu cho `Avatar` khi không có ảnh.
 *
 * Chữ đầu của từ đầu và của từ cuối — với "Nguyễn Thị Mai" là "NM". Một từ duy
 * nhất thì lấy chữ đầu của nó. Không có chữ nào đọc được thì trả chuỗi rỗng, và
 * view vẽ ô trống thay vì một dấu hỏi giả vờ là tên.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0) {
    return '';
  }

  const first = words[0] ?? '';
  const last = words[words.length - 1] ?? '';
  const letters = words.length === 1 ? first.slice(0, 1) : `${first.slice(0, 1)}${last.slice(0, 1)}`;

  return letters.slice(0, INITIALS_LENGTH).toLocaleUpperCase('vi-VN');
}

/**
 * `User[]` của máy chủ → `MemberRowModel[]` của màn.
 *
 * **`isOwner` đọc từ vai, vì hồ sơ dự án không có trường chủ sở hữu.**
 * `ProjectSchema` (`src/api/schemas/index.ts:212-225`) có `members`, không có
 * `ownerId`; thứ gần sự thật nhất trong dữ liệu đang có là vai `admin` — vai
 * duy nhất mà ma trận quyền cho sửa cài đặt dự án. Hàng đó vì thế được đánh dấu
 * là không sửa được, và `roleLabel` vẫn nói đúng cái nó đọc được ("quản trị
 * viên"), không tự phong ai làm chủ sở hữu.
 */
export function toMemberRows(users: readonly User[]): readonly MemberRowModel[] {
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    initials: initialsOf(user.name),
    avatarUrl: user.avatarUrl ?? null,
    roleLabel: SHARE_ROLE_LABELS[user.role],
    isOwner: user.role === 'admin',
  }));
}

/**
 * Danh sách thành viên của một dự án.
 *
 * Trả mảng rỗng khi lượt đọc hỏng thay vì ném: danh sách người có quyền là
 * phần phụ của hộp thoại, và một hồ sơ dự án đọc không được vẫn phải tạo được
 * liên kết. Lỗi của phần liên kết mới là lỗi hộp thoại nói ra.
 */
export async function readProjectMembers(
  client: ApiClient,
  projectId: string,
  signal?: AbortSignal,
): Promise<readonly User[]> {
  const result = await client.projects.read({
    projectId,
    ...(signal !== undefined ? { signal } : {}),
  });

  return result.ok ? result.data.members : [];
}

/* -------------------------------------------------------------------------- */
/* 5 — Hạn dùng                                                               */
/* -------------------------------------------------------------------------- */

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Số ngày của từng mức hạn dùng.
 *
 * `SHARE_EXPIRY_CHOICES` và `SHARE_EXPIRY_LABELS` nhập thẳng từ
 * `src/hooks/useShareLinks.ts:79,85` — năm mức và năm nhãn chỉ có một nguồn.
 * Bảng ngày thì phải dựng lại: `EXPIRY_DAYS` và `expiryDateFor` ở đó là hằng
 * riêng của module ấy, không được xuất. `Record<ShareExpiryChoice, …>` bắt
 * trình biên dịch đòi **đủ** khoá, nên một mức thứ sáu thêm vào bộ chọn kia là
 * hỏng biên dịch ở đây chứ không phải một mức im lặng không có hạn.
 *
 * Mốc trần là `MAX_SHARE_WINDOW_DAYS = 90` của `src/lib/export/shareLink.ts`, và
 * `validateShareLinkRequest` mới là thứ nói ra câu lỗi khi một mức vượt trần.
 */
export const SHARE_EXPIRY_DAYS: Readonly<Record<ShareExpiryChoice, number | null>> = Object.freeze({
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  never: null,
});

/** Mức mặc định: bảy ngày — đủ cho một lượt góp ý mà không để liên kết sống mãi. */
export const DEFAULT_SHARE_EXPIRY_CHOICE: ShareExpiryChoice = '7d';

/** Danh mục hạn dùng đã sẵn sàng để vẽ. */
export const SHARE_EXPIRY_OPTIONS: readonly ShareDialogOption<string>[] = Object.freeze(
  SHARE_EXPIRY_CHOICES.map((id) => ({ id, label: SHARE_EXPIRY_LABELS[id] })),
);

/** Danh mục quyền: hai mức của `SHARE_PERMISSIONS`, nhãn của `SHARE_PERMISSION_LABELS`. */
export const SHARE_PERMISSION_OPTIONS: readonly ShareDialogOption<SharePermission>[] =
  Object.freeze(SHARE_PERMISSIONS.map((id) => ({ id, label: SHARE_PERMISSION_LABELS[id] })));

/** Danh mục chế độ tô màu: `COLORING_MODE_IDS` + `COLORING_MODE_LABELS`. */
export const COLORING_OPTIONS: readonly ShareDialogOption<ColoringModeId>[] = Object.freeze(
  COLORING_MODE_IDS.map((id) => ({ id, label: COLORING_MODE_LABELS[id] })),
);

/**
 * Danh mục tầng, dựng từ `Level[]` của store.
 *
 * Nhãn là `level.name` chứ không phải mã tầng: mã là thứ đi vào liên kết,
 * tên là thứ người đọc nhận ra. Thứ tự theo `order` từ dưới lên, đúng cách
 * người ta đọc một chồng tầng.
 */
export function toLevelOptions(levels: readonly Level[]): readonly ShareDialogOption<LevelId>[] {
  return [...levels]
    .sort((left, right) => left.order - right.order)
    .map((level) => ({ id: level.id, label: level.name }));
}

/** Mức đã chọn thành một thời điểm, hoặc `null` cho "không đặt hạn". */
export function expiryDateFor(choice: ShareExpiryChoice, now: Date): Date | null {
  const days = SHARE_EXPIRY_DAYS[choice];

  return days === null ? null : new Date(now.getTime() + days * MS_PER_DAY);
}

/** Một id bất kỳ từ view về lại một mức hợp lệ — bộ chọn không nhận giá trị lạ. */
export function toExpiryChoice(id: string): ShareExpiryChoice {
  return (SHARE_EXPIRY_CHOICES as readonly string[]).includes(id)
    ? (id as ShareExpiryChoice)
    : DEFAULT_SHARE_EXPIRY_CHOICE;
}

/* -------------------------------------------------------------------------- */
/* 6 — Khung nhúng                                                            */
/* -------------------------------------------------------------------------- */

const COMPACT_EMBED_WIDTH_PX = 640;
const COMPACT_EMBED_HEIGHT_PX = 400;
const WIDE_EMBED_WIDTH_PX = 1280;
const WIDE_EMBED_HEIGHT_PX = 720;

/**
 * Ba cỡ khung dựng sẵn.
 *
 * Cỡ giữa là `DEFAULT_EMBED_WIDTH_PX` × `DEFAULT_EMBED_HEIGHT_PX` của
 * `src/lib/export/embedParams.ts` chứ không phải một con số viết tay: đó là cỡ
 * `buildEmbedCode` dùng khi người chép không nói gì, nên hai nơi không được lệch.
 */
export const EMBED_SIZE_PRESETS: readonly EmbedSizePreset[] = Object.freeze([
  {
    id: 'compact',
    label: 'gọn',
    widthPx: COMPACT_EMBED_WIDTH_PX,
    heightPx: COMPACT_EMBED_HEIGHT_PX,
  },
  {
    id: 'standard',
    label: 'vừa',
    widthPx: DEFAULT_EMBED_WIDTH_PX,
    heightPx: DEFAULT_EMBED_HEIGHT_PX,
  },
  {
    id: 'wide',
    label: 'rộng',
    widthPx: WIDE_EMBED_WIDTH_PX,
    heightPx: WIDE_EMBED_HEIGHT_PX,
  },
]);

/** Cỡ hộp thoại mở ra ở. */
export const DEFAULT_EMBED_SIZE_PRESET_ID = 'standard';

/** Cỡ nào trong {@link EMBED_SIZE_PRESETS} khớp đúng hai số hiện tại, nếu có. */
export function matchEmbedSizePreset(widthPx: number, heightPx: number): string | null {
  const preset = EMBED_SIZE_PRESETS.find(
    (candidate) => candidate.widthPx === widthPx && candidate.heightPx === heightPx,
  );

  return preset?.id ?? null;
}

/** Bốn khoá nhúng lúc hộp thoại vừa mở: đúng `DEFAULT_EMBED_PARAMS` của `embedParams`. */
export const INITIAL_EMBED_PARAMS: EmbedParams = Object.freeze({
  levelId: null,
  coloring: null,
  toolbar: DEFAULT_TOOLBAR_VISIBLE,
  viewpointCode: null,
});
