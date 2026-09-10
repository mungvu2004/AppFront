/**
 * Tầng logic của màn "bạn chưa có quyền truy cập" — mọi quyết định của màn, một chỗ.
 *
 * View chỉ nhận {@link AccessDeniedVm} và vẽ; nó không biết lý do được suy ra từ
 * đâu, không biết nút nào đi đâu, và không định dạng gì (mục D + A15).
 *
 * ## Bốn khối của màn không có dữ liệu, và đó là kết luận đã chốt
 *
 * Hợp đồng (`accessDeniedModel.ts`) đã ghi bốn khoản khảo sát: không endpoint
 * xin quyền, không trường chủ dự án, không đường đọc liên kết chia sẻ, không hàm
 * xác thực mật khẩu. Nên hook này KHÔNG gọi mạng và KHÔNG có một phép ghi nào.
 * Nó đọc {@link AccessDeniedGateway.readCapabilities} rồi để bốn cờ quyết định
 * khối nào có mặt — cùng khuôn `CollaborationLayer`.
 *
 * Hệ quả trực tiếp: {@link AccessDeniedVm.owner} và {@link AccessDeniedVm.request}
 * là `null` ở sản phẩm thật hôm nay, và điều đó ĐÚNG chứ không phải thiếu sót.
 * Story và bài kiểm dựng nhánh đầy đủ bằng props, đúng như hợp đồng đã nói.
 *
 * ## Vì sao phiên đọc qua `@/hooks/useSession` chứ không tự gọi `useSyncExternalStore`
 *
 * `src/hooks/useSession.ts` LÀ đúng ba dòng
 * `useSyncExternalStore(subscribeToSession, getSession, getSession)`, đã có từ
 * lượt dựng tầng xác thực và đang được mười mấy màn dùng (`ProjectDashboard`,
 * `WelcomeScreen`, `VersionHistory`, và màn anh em `NotFound` cùng thư mục này).
 * Chép lại ba dòng ấy vào đây sẽ là bản `useSyncExternalStore` thứ hai cho cùng
 * một store — hai bản sẽ lệch nhau đúng vào ngày một trong hai đổi tham số thứ
 * ba (`getServerSnapshot`), và lệch đó không hiện ra ở bất kỳ kiểu nào. Nên màn
 * này gọi hook đã có, và ranh giới import cho phép: `src/screens` được nhập
 * `src/hooks` (CLAUDE.md mục 0.4).
 *
 * ## `'unknown'` không phải "đã đăng xuất"
 *
 * `SessionStatus` có ba giá trị và `'unknown'` là trạng thái TRƯỚC khi
 * `bootstrapSession()` chạy xong lần đầu, tức "chưa biết". Màn này nói về danh
 * tính của người đang ngồi trước máy — nêu email, mời đổi tài khoản — nên nói
 * bất cứ câu nào khi chưa biết họ là ai đều là đoán. Vì vậy `'unknown'` ánh xạ
 * sang `loading`, không sang `forbidden`.
 *
 * ## Email là TUỲ CHỌN, và màn phải nói được điều đó
 *
 * `AuthUser.email` tuỳ chọn (`src/lib/auth/types.ts`). Hợp đồng có
 * {@link AccessDeniedVm.currentEmail} kiểu `string | null` đúng cho tình huống
 * ấy: phiên không mang email thì khối danh tính nói ra bằng tiếng Việt rằng nó
 * chưa biết, chứ KHÔNG in `undefined` và KHÔNG bịa một địa chỉ.
 *
 * ## Không có `useState` cho `isLoading`/`error` (R-64)
 *
 * Không có lượt đọc máy chủ nào để mà chờ, nên cũng không có hai trường ấy để
 * mà nuôi. Trạng thái của màn suy hoàn toàn từ phiên, từ lỗi 403 người gọi
 * truyền vào, và từ bốn cờ năng lực — cả ba đều là dữ liệu đến từ ngoài.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ENDPOINTS } from '@/api/endpoints';
import { useSession } from '@/hooks/useSession';
import { signOut } from '@/lib/auth';
import { APP_ERROR_KIND_CONFIG, type AppError } from '@/lib/errors';
import { formatDuration, formatTimestamp } from '@/lib/format/datetime';
import { createUuid } from '@/lib/http/ids';
import { toScreenErrorEvent } from '@/lib/telemetry/events';
import {
  createBeaconTransport,
  createTelemetrySender,
  type TelemetrySender,
} from '@/lib/telemetry/sender';
import { ROUTES } from '@/routes/paths';

import {
  DEFAULT_SCREEN_STATE,
  REQUEST_COOLDOWN_MS,
  SCREEN_ID,
  resolveAccessDeniedReason,
  type AccessDeniedAction,
  type AccessDeniedCapabilities,
  type AccessDeniedGateway,
  type AccessDeniedReason,
  type AccessDeniedScreenState,
  type AccessDeniedVm,
  type AccessRequestVm,
  type ProjectOwnerVm,
} from './accessDeniedModel';
import { createAccessDeniedGateway } from './accessDeniedGateway';

/* -------------------------------------------------------------------------- */
/* 1 — Chữ của màn                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mọi chuỗi màn nói ra. Viết thường, kiểu câu (A6), câu ngắn và điềm đạm.
 *
 * Không câu nào giọng chỉ trích, không câu nào đổ lỗi cho người đọc, và không
 * câu nào nêu tên dự án hay số liệu — hai thứ sau là cấm tuyệt đối của đặc tả
 * khi người xem chưa có quyền. Ngoại lệ chữ hoa duy nhất là mã lỗi trong
 * caption chân trang.
 */
export const ACCESS_DENIED_TEXT = {
  title: 'bạn chưa có quyền truy cập',

  /** Người gọi không nói tên dự án, hoặc nói mà `canNameProject` đang tắt. */
  restrictionWithoutName: 'nội dung ở đường dẫn này đang giới hạn người xem, nên nó chưa mở ra cho tài khoản của bạn.',

  whoCanGrant: 'người quản trị dự án là người cấp được quyền này; hãy nhắn cho họ để được thêm vào danh sách xem.',

  identityPrefix: 'bạn đang đăng nhập bằng ',
  identityUnknown: 'phiên đăng nhập hiện tại chưa cho biết địa chỉ thư của bạn.',

  switchAccountLabel: 'đăng nhập bằng tài khoản khác',
  backToProjectsLabel: 'về danh sách dự án',
  enterProjectLabel: 'mở dự án',

  requestSentPrefix: 'đã gửi ',
  throttlePrefix: 'bạn vừa gửi một yêu cầu, nên lượt gửi tiếp theo mở lại sau ',
  throttleSuffix: '.',

  errorCodePrefix: 'mã lỗi: ',
} as const;

/**
 * Câu nêu đúng thứ đang bị hạn chế, khi và chỉ khi được phép nói tên.
 *
 * Tách thành hàm chứ không viết thẳng vào bảng chữ vì nó là chỗ DUY NHẤT tên dự
 * án có thể lọt ra màn: một lối vào thì soát được, hai lối vào thì không.
 */
function restrictionSentenceOf(projectName: string | undefined, canNameProject: boolean): string {
  if (!canNameProject || projectName === undefined || projectName.length === 0) {
    return ACCESS_DENIED_TEXT.restrictionWithoutName;
  }

  return `dự án “${projectName}” đang giới hạn người xem, nên nó chưa mở ra cho tài khoản của bạn.`;
}

/**
 * Một câu cho mỗi lý do — bốn lý do, đúng bốn câu.
 *
 * `unknown` là mặc định và là câu khiến ba câu kia trung thực: màn chỉ gọi tên
 * một lý do khi mã lỗi nói ra, còn lại nói một câu trung tính thay vì đoán.
 * Không câu nào nói người đọc làm sai điều gì.
 */
const REASON_SENTENCE: Readonly<Record<AccessDeniedReason, string>> = {
  revoked: 'quyền xem của tài khoản này đã được thu hồi, nên đường dẫn cũ không còn mở ra nữa.',
  expired: 'đường dẫn bạn đang mở đã hết hạn, nên nó không còn dẫn vào được nữa.',
  password: 'đường dẫn này cần một mật khẩu, và mật khẩu đi kèm chưa mở được nó.',
  unknown: 'hệ thống chưa nói rõ vì sao, nên chưa thể nêu chính xác điều gì đang chặn lượt truy cập này.',
};

/* -------------------------------------------------------------------------- */
/* 2 — Tuỳ chọn                                                                */
/* -------------------------------------------------------------------------- */

export interface UseAccessDeniedOptions {
  /**
   * Lỗi 403 dẫn người dùng tới đây. Người gọi truyền nguyên `AppError` nó nhận
   * được; {@link resolveAccessDeniedReason} đọc `code` của nó để chọn một trong
   * bốn lý do. Bỏ trống thì lý do là `unknown` — trung thực chứ không đoán.
   */
  readonly error?: AppError | null;

  /** Bề ngang hẹp (trạng thái 7). Container đo và truyền xuống. */
  readonly isCompact?: boolean;

  /** Cổng tiêm được; bỏ trống thì dùng cổng thật của màn. */
  readonly gateway?: AccessDeniedGateway;

  /** Bộ gửi đo đạc tiêm được — bài kiểm cắm bản đếm, không đẩy gì lên mạng. */
  readonly telemetry?: TelemetrySender;

  /**
   * Tên dự án. Chỉ được nói ra khi {@link AccessDeniedCapabilities.canNameProject}
   * bật — hôm nay cờ ấy tắt, nên truyền vào cũng không lọt ra màn. Đây là cách
   * cấm "không tiết lộ tên dự án khi chưa có quyền" được ép bằng cấu trúc thay
   * vì bằng lời dặn.
   */
  readonly projectName?: string;

  /**
   * Mã dự án, để dựng nút mở dự án ở trạng thái `success`. Không có mã thì
   * không có nút — không đường dẫn nào được ghép tay (R-65).
   */
  readonly projectId?: string;

  /**
   * Mốc mili-giây của yêu cầu xin quyền gần nhất, do tầng gửi ghi lại.
   *
   * Hôm nay không nơi nào đặt được nó vì không có đường gửi
   * ({@link AccessDeniedCapabilities.canRequestAccess} tắt và
   * {@link AccessDeniedGateway.submitAccessRequest} vắng mặt), nên ở sản phẩm
   * thật nó luôn `undefined` và {@link AccessDeniedVm.request} luôn `null`. Nó
   * là ĐẦU VÀO thật chứ không phải cờ giả: ngày T-05 có thật, tầng gửi ghi mốc
   * vào đây và cả `request` lẫn `throttleSentence` sống dậy mà không dòng nào
   * của view phải sửa.
   */
  readonly lastRequestAtMs?: number;

  /** Lời nhắn của chủ dự án khi từ chối, nếu lượt gửi mang về được một lời. */
  readonly declineMessage?: string;

  /** Đồng hồ, để bài kiểm đo được cửa sổ chặn gửi lại mà không phải chờ thật. */
  readonly now?: () => number;
}

/* -------------------------------------------------------------------------- */
/* 3 — Phụ trợ                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Dựng một `AppError` loại `forbidden` từ bảng cấu hình đã đông cứng.
 *
 * `toAppError` chỉ CHUYỂN ĐỔI một lỗi đã có, và `buildAppError` không được
 * xuất. Màn này cần một `AppError` cho tình huống người gọi không truyền lỗi
 * nào — nó vẫn phải đo được và vẫn phải in được mã lỗi — nên nó chép đúng tám
 * trường từ `APP_ERROR_KIND_CONFIG.forbidden`. Đây là ghép lại thứ đã có, không
 * phải một luật lỗi thứ hai: đổi `severity` của `forbidden` ở `kinds.ts` là số
 * đo ở đây đổi theo. Cùng khuôn `useNotFound.ts`.
 */
function forbiddenAppError(): AppError {
  const config = APP_ERROR_KIND_CONFIG.forbidden;

  return {
    code: config.code,
    kind: 'forbidden',
    messageKey: config.messageKey,
    params: {},
    recovery: config.recovery,
    // Người gọi không truyền lỗi nào, nên không có mã yêu cầu để dẫn lại.
    requestId: '',
    retryable: config.retryable,
    severity: config.severity,
  };
}

/** Bộ gửi thật của ứng dụng. Tự tắt khi `VITE_TELEMETRY_ENABLED` không bật. */
function createAppTelemetrySender(): TelemetrySender {
  return createTelemetrySender({
    transport: createBeaconTransport({ url: ENDPOINTS.telemetry }),
    sessionId: createUuid(),
  });
}

/* -------------------------------------------------------------------------- */
/* 4 — Hook                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Mọi thứ view cần, và không gì hơn.
 *
 * ### Thứ tự quyết định bảy trạng thái, viết ra một lần
 *
 * | # | Trạng thái | Khi nào |
 * |---|---|---|
 * | 2 | `loading` | phiên còn `'unknown'` — chưa biết người này là ai thì chưa nói được câu nào về họ |
 * | 4 | `error` | người gọi truyền một lỗi KHÔNG phải 403 — màn bị mở nhầm cho một sự cố khác, và nói ra thì đúng hơn là im |
 * | 5 | `success` | có mã dự án và không còn lỗi nào chặn — quyền đã mở, nút mở dự án xuất hiện |
 * | 1 | `empty` | xin quyền được nhưng chưa gửi yêu cầu nào |
 * | 3 | `partial` | đã gửi yêu cầu, đang chờ trả lời |
 * | 7 | `collapsed` | bề ngang hẹp |
 * | 6 | `forbidden` | còn lại — {@link DEFAULT_SCREEN_STATE}, và là trạng thái THƯỜNG của màn này |
 *
 * `loading` phải đứng đầu: nêu email hay mời đổi tài khoản trong nhịp trước khi
 * `bootstrapSession()` xong là nói về một người mà hệ thống chưa biết là ai.
 *
 * `collapsed` đứng ngay trước `forbidden` chứ không đứng đầu: một màn hẹp mà
 * đang chờ phiên thì vẫn là `loading`, và một màn hẹp có lỗi lạ thì vẫn là
 * `error` — bề ngang không được nuốt mất một trạng thái nói điều gì đó thật.
 *
 * Với bốn cờ năng lực tắt như hôm nay, `empty` và `partial` không xảy ra, đúng
 * như hợp đồng đã ghi: không có yêu cầu nào để mà rỗng.
 */
export function useAccessDenied(options: UseAccessDeniedOptions = {}): AccessDeniedVm {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();

  const isCompact = options.isCompact ?? false;
  const inputError = options.error ?? null;
  const now = options.now ?? Date.now;

  const [defaultGateway] = useState<AccessDeniedGateway>(() => createAccessDeniedGateway());
  const [defaultTelemetry] = useState<TelemetrySender>(createAppTelemetrySender);
  const gateway = options.gateway ?? defaultGateway;
  const telemetry = options.telemetry ?? defaultTelemetry;

  const capabilities = useMemo<AccessDeniedCapabilities>(
    () => gateway.readCapabilities(),
    [gateway],
  );

  /* ---- Lý do, do hợp đồng quyết định ------------------------------------ */

  const reason = useMemo<AccessDeniedReason>(
    () => resolveAccessDeniedReason(inputError),
    [inputError],
  );

  /* ---- Danh tính --------------------------------------------------------- */

  /**
   * Email của phiên, hoặc `null` khi phiên không mang email.
   *
   * `AuthUser.email` tuỳ chọn, nên `?? null` ở đây là chỗ `undefined` bị chặn
   * lại một lần cho cả màn — không nơi nào phía dưới còn phải nghĩ về nó nữa.
   */
  const currentEmail = session.user?.email ?? null;

  const identityLabel =
    currentEmail === null
      ? ACCESS_DENIED_TEXT.identityUnknown
      : `${ACCESS_DENIED_TEXT.identityPrefix}${currentEmail}`;

  /* ---- Yêu cầu đã gửi và cửa sổ chặn gửi lại ----------------------------- */

  const lastRequestAtMs = options.lastRequestAtMs;

  const request = useMemo<AccessRequestVm | null>(() => {
    if (lastRequestAtMs === undefined) {
      return null;
    }

    const sentAtLabel = `${ACCESS_DENIED_TEXT.requestSentPrefix}${formatTimestamp(lastRequestAtMs, now())}`;

    return options.declineMessage === undefined
      ? { sentAtLabel }
      : { sentAtLabel, declineMessage: options.declineMessage };
  }, [lastRequestAtMs, options.declineMessage, now]);

  /**
   * Một câu, hoặc `null` — không bao giờ im lặng trong lúc đang bị chặn.
   *
   * Hợp đồng nói `null` nghĩa là "không bị chặn", nên trả `null` trong lúc cửa
   * sổ chờ còn mở sẽ là nói dối bằng cách không nói gì: người dùng bấm gửi, không
   * có gì xảy ra, và không câu nào giải thích. Thời gian còn lại đi qua
   * `formatDuration` — định dạng xảy ra ở viewmodel, không ở view (A15).
   */
  const throttleSentence = useMemo<string | null>(() => {
    if (lastRequestAtMs === undefined) {
      return null;
    }

    const remainingMs = lastRequestAtMs + REQUEST_COOLDOWN_MS - now();

    if (remainingMs <= 0) {
      return null;
    }

    return `${ACCESS_DENIED_TEXT.throttlePrefix}${formatDuration(remainingMs)}${ACCESS_DENIED_TEXT.throttleSuffix}`;
  }, [lastRequestAtMs, now]);

  /* ---- Chủ dự án --------------------------------------------------------- */

  /**
   * Luôn `null`, và không có nhánh nào khác — cố ý.
   *
   * `Project` không có trường chủ, và `members` đọc bằng chính token vừa bị từ
   * chối, nên KHÔNG có nguồn nào để dựng một {@link ProjectOwnerVm} thật. Viết
   * một nhánh `capabilities.canShowOwner ? … : null` ở đây sẽ là một nhánh chết
   * giả vờ có dữ liệu (R-69); cờ `canShowOwner` đã làm đúng việc của nó ở view,
   * nơi nó quyết định khối chủ dự án có rời khỏi DOM hay không.
   *
   * Lỗ hổng việc này để lại được câu {@link AccessDeniedVm.whoCanGrantSentence}
   * bịt: đặc tả bắt màn nêu rõ AI cấp được quyền, và câu ấy nêu được điều đó mà
   * không cần biết tên một người cụ thể.
   */
  const owner: ProjectOwnerVm | null = null;

  /* ---- Trạng thái -------------------------------------------------------- */

  const projectId = options.projectId;

  const state = useMemo<AccessDeniedScreenState>(() => {
    if (session.status === 'unknown') {
      return 'loading';
    }

    if (inputError !== null && inputError.kind !== 'forbidden') {
      return 'error';
    }

    if (projectId !== undefined && inputError === null) {
      return 'success';
    }

    if (capabilities.canRequestAccess) {
      return lastRequestAtMs === undefined ? 'empty' : 'partial';
    }

    if (isCompact) {
      return 'collapsed';
    }

    return DEFAULT_SCREEN_STATE;
  }, [
    session.status,
    inputError,
    projectId,
    capabilities.canRequestAccess,
    lastRequestAtMs,
    isCompact,
  ]);

  /* ---- Hành động ra ngoài ------------------------------------------------ */

  /**
   * Đổi tài khoản: đăng xuất rồi đưa về màn đăng nhập, mang theo đường về.
   *
   * Điều hướng nằm trong `finally` chứ không trong `then`: người dùng đã nói họ
   * muốn đổi tài khoản, nên một lượt `POST /auth/logout` hỏng vì mất mạng không
   * được phép giữ họ lại ở màn này mà không có gì xảy ra. `signOut()` đã xoá
   * phiên cục bộ trước khi gọi máy chủ.
   *
   * `from` — cùng tên mà `AuthScreen.container.tsx` đọc; nó tự lọc bằng
   * `safeDestination()` của chính nó, nên ở đây không lọc lần hai.
   */
  const switchAccountActivate = useCallback((): void => {
    const from = `${location.pathname}${location.search}`;

    void signOut().finally(() => {
      navigate(ROUTES.login, { state: { from } });
    });
  }, [navigate, location.pathname, location.search]);

  const switchAccount = useMemo<AccessDeniedAction>(
    () => ({
      label: ACCESS_DENIED_TEXT.switchAccountLabel,
      onActivate: switchAccountActivate,
    }),
    [switchAccountActivate],
  );

  const backToProjectsActivate = useCallback((): void => {
    navigate(ROUTES.dashboard);
  }, [navigate]);

  const backToProjects = useMemo<AccessDeniedAction>(
    () => ({
      label: ACCESS_DENIED_TEXT.backToProjectsLabel,
      onActivate: backToProjectsActivate,
    }),
    [backToProjectsActivate],
  );

  const enterProject = useMemo<AccessDeniedAction | null>(() => {
    if (state !== 'success' || projectId === undefined) {
      return null;
    }

    return {
      label: ACCESS_DENIED_TEXT.enterProjectLabel,
      onActivate: (): void => {
        navigate(ROUTES.project.floors(projectId));
      },
    };
  }, [state, projectId, navigate]);

  /* ---- O-01: một lượt đo khi vào màn ------------------------------------- */

  /**
   * Ghi đúng MỘT lần cho mỗi lần vào màn, không phải mỗi lần vẽ lại.
   *
   * `screen.error` là đường hợp lệ duy nhất cho việc này: không sự kiện nào tên
   * "blocked"/"denied" tồn tại, còn `errorKind` của schema là enum đóng
   * `APP_ERROR_KINDS` và `'forbidden'` nằm trong đó. Nên phép đo nói bằng từ vựng
   * ấy chứ không dựng một sự kiện thứ mười ba.
   *
   * `errorKind` luôn là `'forbidden'` kể cả khi người gọi truyền một lỗi khác:
   * đây là phép đo về việc MÀN NÀY được mở ra, và màn này chỉ được mở ra vì một
   * lượt bị chặn. Lỗi lạ đã hiện ra cho người dùng qua trạng thái `error`.
   */
  const hasReportedRef = useRef(false);

  useEffect(() => {
    if (hasReportedRef.current) {
      return;
    }

    hasReportedRef.current = true;

    const event = toScreenErrorEvent(
      {
        appError:
          inputError !== null && inputError.kind === 'forbidden' ? inputError : forbiddenAppError(),
        context: {},
        timestamp: new Date().toISOString(),
      },
      SCREEN_ID,
    );

    if (event !== null) {
      telemetry.track(event);
    }
  }, [inputError, telemetry]);

  /* ---- Viewmodel --------------------------------------------------------- */

  const errorCodeCaption = `${ACCESS_DENIED_TEXT.errorCodePrefix}${inputError?.code ?? APP_ERROR_KIND_CONFIG.forbidden.code}`;

  return {
    state,
    capabilities,

    title: ACCESS_DENIED_TEXT.title,
    restrictionSentence: restrictionSentenceOf(options.projectName, capabilities.canNameProject),
    reason,
    reasonSentence: REASON_SENTENCE[reason],
    whoCanGrantSentence: ACCESS_DENIED_TEXT.whoCanGrant,

    currentEmail,
    identityLabel,
    switchAccount,

    owner,
    request,
    throttleSentence,

    backToProjects,
    enterProject,

    errorCodeCaption,
    isCompact,
  };
}
