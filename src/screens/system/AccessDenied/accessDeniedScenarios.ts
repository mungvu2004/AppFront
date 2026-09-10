/**
 * Bộ dựng `AccessDeniedVm` cho bảy trạng thái — viết chỉ từ hợp đồng đông lạnh
 * `accessDeniedModel.ts`, chạy được ngay, không phụ thuộc view lẫn hook.
 *
 * File này KHÔNG nhập `./AccessDenied` hay `./useAccessDenied` — cả hai chưa
 * tồn tại lúc file này được viết (W3 chạy song song với W1/W2, đúng khuôn S-43
 * đã dùng cho `notFoundScenarios.ts`). Mỗi kịch bản dưới đây trả về một
 * `AccessDeniedVm` đầy đủ, sẵn sàng truyền thẳng vào `<AccessDenied {...vm} />`
 * một khi view xong — không cần sửa gì ở đây khi lớp ghép chạy.
 *
 * ## Vì sao có bốn lỗi mẫu, không phải ba
 *
 * `accessDeniedModel.ts` nói `resolveAccessDeniedReason` chỉ nhận ra một TỪ
 * trong `error.code` (`REVOK`/`EXPIR`/`PASSWORD`), còn lại rơi về `'unknown'`.
 * Ba lỗi đầu ({@link REVOKED_ACCESS_ERROR}, {@link EXPIRED_ACCESS_ERROR},
 * {@link PASSWORD_ACCESS_ERROR}) sinh ba `reasonSentence` khác nhau — bài
 * nghiệm thu 1 của `AccessDenied.test.tsx` khẳng định điều đó. Lỗi thứ tư
 * ({@link UNRECOGNIZED_ACCESS_ERROR}, mã `'FORBIDDEN'` — không chứa từ nào
 * trong ba từ khoá) chứng minh nhánh `'unknown'` không phải tử code chết.
 *
 * ## `throttleSentence` là dữ liệu đưa vào, không phải logic tính ở đây
 *
 * Hợp đồng đặt `throttleSentence` là một trường ĐÃ TÍNH SẴN của `AccessDeniedVm`
 * — ai gọi `resolveAccessDeniedReason` (hook, chưa tồn tại) chịu trách nhiệm
 * quyết định khi nào chặn gửi lại theo `REQUEST_COOLDOWN_MS`. File này chỉ
 * nhận giá trị đó qua `options.throttleSentence` và gắn thẳng vào vm — đúng
 * tinh thần "dữ liệu thuần khớp hợp đồng". Phép tính thời gian chờ nằm trong
 * `AccessDenied.test.tsx` (bài nghiệm thu 2), nơi nó là một phép kiểm, không
 * phải một phần dữ liệu dùng lại cho story.
 *
 * ## Cờ năng lực: hai bộ, đúng khuôn "cổng bật/cổng tắt" của I4
 *
 * {@link ACCESS_DENIED_CAPABILITIES_TODAY} (tái xuất từ `accessDeniedModel.ts`)
 * là cổng thật hôm nay — bốn `false`. {@link ACCESS_DENIED_CAPABILITIES_FULL}
 * là bộ cổng bật dùng để chứng minh bố cục đầy đủ đã có test phủ, dù cổng thật
 * đang tắt (docblock `accessDeniedModel.ts` mục "Hệ quả: cờ năng lực").
 */

import type { AppError } from '@/lib/errors/kinds';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  ACCESS_DENIED_CAPABILITIES_TODAY,
  resolveAccessDeniedReason,
  type AccessDeniedAction,
  type AccessDeniedCapabilities,
  type AccessDeniedReason,
  type AccessDeniedVm,
  type AccessRequestVm,
  type ProjectOwnerVm,
} from './accessDeniedModel';

const noop = (): void => undefined;

/** Email mẫu của người đang xem màn — tiếng Việt có dấu ở phần tên, đúng khuôn dữ liệu người dùng của repo. */
export const SAMPLE_EMAIL = 'an.nguyen@congty.vn';

/** Tên dự án mẫu — CHỈ được phép xuất hiện trong DOM khi `capabilities.canNameProject` bật (bài nghiệm thu 4). */
export const SAMPLE_PROJECT_NAME = 'Nhà kho Thủ Đức';

/** Chủ dự án mẫu — dùng khi `capabilities.canShowOwner` bật. */
export const SAMPLE_PROJECT_OWNER: ProjectOwnerVm = {
  name: 'Trần Thị Mai',
  email: 'mai.tran@chuduan.vn',
};

/** Một yêu cầu đã gửi thành công — dùng khi `capabilities.canRequestAccess` bật. */
export const SAMPLE_ACCESS_REQUEST: AccessRequestVm = {
  sentAtLabel: 'đã gửi lúc 14:32',
};

/** Câu nêu lý do gửi lại bị chặn — một câu tiếng Việt hoàn chỉnh, không im lặng (bài nghiệm thu 2). */
export const ACCESS_REQUEST_THROTTLE_SENTENCE =
  'Bạn vừa gửi yêu cầu, hãy đợi một lát trước khi gửi lại.';

/** Bốn cổng đều bật — bố cục đầy đủ, dùng cho story/test chứng minh cổng thật tắt không xoá mất phần đã dựng. */
export const ACCESS_DENIED_CAPABILITIES_FULL: AccessDeniedCapabilities = {
  canRequestAccess: true,
  canShowOwner: true,
  canSubmitLinkPassword: true,
  canNameProject: false,
};

function forbiddenError(code: string, requestId: string): AppError {
  return {
    kind: 'forbidden',
    code,
    messageKey: 'errors.forbidden.description',
    params: {},
    requestId,
    retryable: false,
    severity: 'lỗi',
    recovery: 'liên hệ quản trị',
  };
}

/** Mã chứa `REVOK` — sinh `reason: 'revoked'`. */
export const REVOKED_ACCESS_ERROR: AppError = forbiddenError('SHARE_LINK_REVOKED', 'req-ad-revoked');
/** Mã chứa `EXPIR` — sinh `reason: 'expired'`. */
export const EXPIRED_ACCESS_ERROR: AppError = forbiddenError('SHARE_LINK_EXPIRED', 'req-ad-expired');
/** Mã chứa `PASSWORD` — sinh `reason: 'password'`. */
export const PASSWORD_ACCESS_ERROR: AppError = forbiddenError('SHARE_LINK_PASSWORD_REQUIRED', 'req-ad-password');
/** Mã không chứa từ nào trong ba từ khoá trên — rơi về `reason: 'unknown'`. */
export const UNRECOGNIZED_ACCESS_ERROR: AppError = forbiddenError('FORBIDDEN', 'req-ad-unknown');

const REASON_SENTENCE: Readonly<Record<AccessDeniedReason, string>> = {
  revoked: 'Liên kết chia sẻ tới mục này đã bị thu hồi.',
  expired: 'Liên kết chia sẻ tới mục này đã hết hạn.',
  password: 'Liên kết này cần đúng mật khẩu mới mở được.',
  unknown: 'Hệ thống không xác định được vì sao bạn chưa xem được mục này.',
};

function titleFor(state: SevenState): string {
  return state === 'success' ? 'Bạn đã được cấp quyền xem mục này' : 'Bạn chưa có quyền xem mục này';
}

/** `projectName` chỉ được ghép vào câu khi `canNameProject` bật — bài nghiệm thu 4 khẳng định điều ngược lại. */
function restrictionSentenceFor(capabilities: AccessDeniedCapabilities, projectName: string): string {
  if (capabilities.canNameProject) {
    return `Bạn chưa có quyền xem dự án “${projectName}”.`;
  }

  return 'Bạn chưa có quyền xem mục này.';
}

function whoCanGrantSentenceFor(capabilities: AccessDeniedCapabilities, owner: ProjectOwnerVm | null): string {
  if (capabilities.canShowOwner && owner !== null) {
    return `Chỉ ${owner.name}, chủ dự án, mới cấp được quyền xem cho bạn.`;
  }

  return 'Chỉ chủ dự án mới cấp được quyền xem cho bạn.';
}

/** Luôn trả một câu — `currentEmail === null` không được để lộ chữ "undefined"/"null" (bài nghiệm thu 5). */
function identityLabelFor(email: string | null): string {
  return email === null
    ? 'Không xác định được bạn đang đăng nhập bằng tài khoản nào.'
    : `Bạn đang đăng nhập bằng ${email}.`;
}

function actionFor(label: string, onActivate: (() => void) | undefined): AccessDeniedAction {
  return { label, onActivate: onActivate ?? noop };
}

export interface CreateAccessDeniedVmOptions {
  /** Mặc định {@link ACCESS_DENIED_CAPABILITIES_TODAY} — bốn cổng tắt, đúng cổng thật hôm nay. */
  readonly capabilities?: AccessDeniedCapabilities;
  /** Lỗi 403 nguồn — đi qua `resolveAccessDeniedReason` để suy ra `reason`. `null`/vắng mặt → `'unknown'`. */
  readonly error?: AppError | null;
  /** `undefined` → dùng {@link SAMPLE_EMAIL}. Truyền thẳng `null` để mô phỏng phiên không mang email. */
  readonly currentEmail?: string | null;
  readonly projectName?: string;
  /** Chỉ có hiệu lực khi `capabilities.canShowOwner` bật. */
  readonly owner?: ProjectOwnerVm | null;
  /** Chỉ có hiệu lực khi `capabilities.canRequestAccess` bật. */
  readonly request?: AccessRequestVm | null;
  readonly throttleSentence?: string | null;
  readonly onSwitchAccount?: () => void;
  readonly onBackToProjects?: () => void;
  readonly onEnterProject?: () => void;
}

/**
 * Dựng đầy đủ một `AccessDeniedVm` cho một trong bảy trạng thái của A11.
 *
 * @example
 * expectSevenStates(
 *   (scenario) => renderWithProviders(<AccessDenied {...createAccessDeniedVm(scenario.state)} />),
 *   createSevenStateScenarios(),
 * );
 */
export function createAccessDeniedVm(
  state: SevenState,
  options: CreateAccessDeniedVmOptions = {},
): AccessDeniedVm {
  const capabilities = options.capabilities ?? ACCESS_DENIED_CAPABILITIES_TODAY;
  const reason = resolveAccessDeniedReason(options.error ?? null);
  const currentEmail = options.currentEmail === undefined ? SAMPLE_EMAIL : options.currentEmail;
  const projectName = options.projectName ?? SAMPLE_PROJECT_NAME;
  const owner = capabilities.canShowOwner ? (options.owner ?? SAMPLE_PROJECT_OWNER) : null;
  const request = capabilities.canRequestAccess ? (options.request ?? null) : null;

  return {
    state,
    capabilities,
    title: titleFor(state),
    restrictionSentence: restrictionSentenceFor(capabilities, projectName),
    reason,
    reasonSentence: REASON_SENTENCE[reason],
    whoCanGrantSentence: whoCanGrantSentenceFor(capabilities, owner),
    currentEmail,
    identityLabel: identityLabelFor(currentEmail),
    switchAccount: actionFor('Đổi tài khoản', options.onSwitchAccount),
    owner,
    request,
    throttleSentence: options.throttleSentence ?? null,
    backToProjects: actionFor('Về danh sách dự án', options.onBackToProjects),
    enterProject: state === 'success' ? actionFor('Vào dự án', options.onEnterProject) : null,
    errorCodeCaption: `Mã lỗi: ${options.error?.code ?? 'FORBIDDEN'}`,
    isCompact: state === 'collapsed',
  };
}
