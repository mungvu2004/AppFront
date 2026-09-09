/**
 * Tầng logic của màn "không tìm thấy trang" — mọi quyết định của màn, một chỗ.
 *
 * View chỉ nhận {@link NotFoundVm} và vẽ; nó không biết mình đang ở nguyên nhân
 * nào, không biết nút chính đi đâu, và không định dạng gì (mục D + A15).
 *
 * ## Ba nguyên nhân, và vì sao `offline` khó được đặt
 *
 * `missing` là mặc định. `forbidden` khi phiên nói `'anonymous'`. `offline`
 * CHỈ khi cổng ném đúng một lỗi mạng — `toAppError(err).kind === 'network'` —
 * chứ không suy từ "đọc hỏng". Bảo một người đang mất mạng rằng trang của họ đã
 * bị xoá là một câu sai khiến họ bỏ cuộc thay vì bật lại wifi; bảo một người
 * đang xem một đường dẫn chết rằng họ mất mạng cũng sai y như vậy. Nên chỉ có
 * `kind` của một `HttpError` nguyên bản mới đủ tư cách làm bằng chứng — lý do
 * `notFoundGateway.unwrap` ném lỗi NGUYÊN VẸN thay vì bọc lại.
 *
 * ## `'unknown'` không phải "đã đăng xuất"
 *
 * `SessionStatus` có ba giá trị: `'unknown'` là trạng thái trước khi
 * `bootstrapSession()` chạy xong lần đầu, tức "chưa biết". Đối xử với nó như đã
 * đăng xuất sẽ nháy nút "đăng nhập" vào mặt người đang đăng nhập, ngay trong
 * nhịp đầu tiên của mỗi lần tải trang. Nên chỉ `'anonymous'` mới là chưa đăng
 * nhập.
 *
 * ## Cơ chế quay lại sau đăng nhập đã có sẵn, tên là `from`
 *
 * `AuthScreen.container.tsx:243-254` đọc `location.state.from` trước, rồi mới
 * `?next=`, và cả hai đi qua `safeDestination()` của chính nó. Nên ở đây chỉ
 * cần `navigate(ROUTES.login, { state: { from: <đường dẫn hiện tại> } })`:
 * KHÔNG nhập `safeDestination` từ thư mục màn khác, và không tự lọc lần hai —
 * hai bộ lọc cho cùng một giá trị là hai bộ lọc sẽ lệch nhau.
 *
 * ## `isCompact` là tuỳ chọn, không phải một phép đo thứ sáu
 *
 * Năm hook trong repo tự chép một `useNarrowViewport` với chuỗi
 * `'(max-width: 1023px)'` gõ tay. Bản thứ sáu sẽ là con số thứ sáu không có tên
 * (R-71), nên màn này nhận `isCompact` qua tuỳ chọn — đúng khuôn
 * `NotificationCenterRoute`, nơi route toàn màn tự nói mình thu gọn. Người dựng
 * container quyết định, hook chỉ đặt tên cho quyết định ấy.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';

import { ENDPOINTS } from '@/api/endpoints';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSession } from '@/hooks/useSession';
import { APP_ERROR_KIND_CONFIG, toAppError, type AppError, type AppErrorKind } from '@/lib/errors';
import { createUuid } from '@/lib/http/ids';
import { toScreenErrorEvent } from '@/lib/telemetry/events';
import {
  createBeaconTransport,
  createTelemetrySender,
  type TelemetrySender,
} from '@/lib/telemetry/sender';
import { ROUTES } from '@/routes/paths';

import {
  NOT_FOUND_ERROR_CODE,
  NOT_FOUND_SCREEN_CODE,
  RECENT_PROJECT_LIMIT,
  type NotFoundAction,
  type NotFoundGateway,
  type NotFoundReason,
  type NotFoundScreenState,
  type NotFoundVm,
  type RecentProjectVm,
} from './notFoundModel';
import {
  createNotFoundGateway,
  NOT_FOUND_RECENT_CACHE_POLICY,
  NOT_FOUND_RECENT_QUERY_KEY,
} from './notFoundGateway';

/* -------------------------------------------------------------------------- */
/* 1 — Chữ của màn                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Mọi chuỗi màn nói ra. Viết thường, kiểu câu (A6), câu ngắn và lịch sự.
 *
 * Không có giọng hài hước, và không có chữ số "404" nào ngoài
 * {@link NOT_FOUND_ERROR_CODE} trong caption — mã lỗi có mặt nhưng nhỏ, đúng
 * cấm tuyệt đối của đặc tả.
 */
export const NOT_FOUND_TEXT = {
  recentHeading: 'dự án gần đây',
  backLabel: 'quay lại',
  signInLabel: 'đăng nhập',
  dashboardLabel: 'về danh sách dự án',
  errorCodePrefix: 'mã lỗi: ',
  captionSeparator: ' · ',
} as const;

/** Tiêu đề h2, một câu cho mỗi nguyên nhân. */
const TITLE_BY_REASON: Readonly<Record<NotFoundReason, string>> = {
  missing: 'không tìm thấy trang này',
  forbidden: 'cần đăng nhập để xem trang này',
  offline: 'chưa kết nối được máy chủ',
};

/** Một câu giải thích cho mỗi nguyên nhân. Nói đúng thứ đang biết, không hơn. */
const DESCRIPTION_BY_REASON: Readonly<Record<NotFoundReason, string>> = {
  missing: 'trang bạn tìm đã bị xoá hoặc đã chuyển đi nơi khác.',
  forbidden: 'đăng nhập xong bạn sẽ được đưa lại đúng trang vừa mở.',
  offline: 'đường truyền đang gián đoạn, nên chưa xác nhận được trang này còn hay không.',
};

/**
 * Loại lỗi ghi vào `screen.error` cho mỗi nguyên nhân.
 *
 * `errorKind` của schema là enum đóng `APP_ERROR_KINDS`, nên ba nguyên nhân của
 * màn phải nói bằng từ vựng ấy chứ không bằng từ vựng của riêng mình.
 */
const ERROR_KIND_BY_REASON: Readonly<Record<NotFoundReason, AppErrorKind>> = {
  missing: 'notFound',
  forbidden: 'unauthenticated',
  offline: 'network',
};

const EMPTY_PROJECTS: readonly RecentProjectVm[] = [];

/* -------------------------------------------------------------------------- */
/* 2 — Tuỳ chọn                                                                */
/* -------------------------------------------------------------------------- */

export interface UseNotFoundOptions {
  /** Cổng tiêm được; bỏ trống thì dùng cổng thật của ứng dụng. */
  readonly gateway?: NotFoundGateway;
  /** Bộ gửi đo đạc tiêm được — bài kiểm cắm bản đếm, không đẩy gì lên mạng. */
  readonly telemetry?: TelemetrySender;
  /** Bề ngang hẹp: bỏ hình minh hoạ, thu khoảng cách. Xem docblock đầu file. */
  readonly isCompact?: boolean;
}

/* -------------------------------------------------------------------------- */
/* 3 — Phụ trợ                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Dựng một `AppError` từ bảng cấu hình đã đông cứng của `src/lib/errors`.
 *
 * `toAppError` chỉ CHUYỂN ĐỔI một lỗi đã có, và `buildAppError` — thứ dựng một
 * `AppError` từ `kind` — không được xuất. Màn này cần một `AppError` cho một
 * tình huống KHÔNG có ngoại lệ nào (một đường dẫn không khớp route nào chẳng
 * ném gì cả), nên nó chép đúng tám trường từ `APP_ERROR_KIND_CONFIG[kind]`. Đây
 * là ghép lại thứ đã có, không phải một luật lỗi thứ hai: đổi `severity` của
 * `notFound` ở `kinds.ts` là số đo ở đây đổi theo.
 */
function appErrorOfKind(kind: AppErrorKind): AppError {
  const config = APP_ERROR_KIND_CONFIG[kind];

  return {
    code: config.code,
    kind,
    messageKey: config.messageKey,
    params: {},
    recovery: config.recovery,
    // Không có lượt gọi mạng nào sinh ra tình huống này, nên không có mã yêu cầu.
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
 * | 6 | `forbidden` | phiên nói `'anonymous'` — chưa đăng nhập, lượt đọc gợi ý còn không chạy |
 * | 2 | `loading` | đang lấy gợi ý |
 * | 4 | `error` | không lấy được gợi ý — **vẫn đủ hai nút** |
 * | 1 | `empty` | chưa có dự án gần đây nào |
 * | 3 | `partial` | gợi ý đã về nhưng chưa đủ {@link RECENT_PROJECT_LIMIT} |
 * | 7 | `collapsed` | bề ngang hẹp |
 * | 5 | `success` | còn lại |
 *
 * `forbidden` phải đứng TRƯỚC `loading`: lượt đọc bị tắt (`enabled: false`) vẫn
 * mang `isPending === true` mãi mãi, nên xét `loading` trước sẽ khoá màn của
 * người chưa đăng nhập ở một vòng quay không bao giờ dừng.
 */
export function useNotFound(options: UseNotFoundOptions = {}): NotFoundVm {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSession();
  const prefersReducedMotion = useReducedMotion();

  const isCompact = options.isCompact ?? false;
  // `'unknown'` là "chưa biết", không phải "đã đăng xuất" — xem docblock đầu file.
  const isSignedOut = session.status === 'anonymous';

  const [defaultGateway] = useState<NotFoundGateway>(() => createNotFoundGateway());
  const [defaultTelemetry] = useState<TelemetrySender>(createAppTelemetrySender);
  const gateway = options.gateway ?? defaultGateway;
  const telemetry = options.telemetry ?? defaultTelemetry;

  const listQuery = useQuery({
    queryKey: NOT_FOUND_RECENT_QUERY_KEY,
    queryFn: () => gateway.listRecentProjects(),
    // Một người chưa đăng nhập không có dự án nào để gợi ý, và một lượt đọc chắc
    // chắn trả 401 chỉ làm màn nháy một trạng thái lỗi không nói thêm điều gì.
    enabled: !isSignedOut,
    gcTime: NOT_FOUND_RECENT_CACHE_POLICY.gcTime,
    staleTime: NOT_FOUND_RECENT_CACHE_POLICY.staleTime,
  });

  const queryError = listQuery.error;
  const appError = useMemo<AppError | null>(
    () => (queryError === null || queryError === undefined ? null : toAppError(queryError)),
    [queryError],
  );

  const recentProjects = useMemo<readonly RecentProjectVm[]>(
    () => listQuery.data ?? EMPTY_PROJECTS,
    [listQuery.data],
  );

  const reason = useMemo<NotFoundReason>(() => {
    if (isSignedOut) {
      return 'forbidden';
    }

    // Bằng chứng thật, không phải suy đoán: chỉ một lỗi mạng nguyên bản mới đủ.
    if (appError !== null && appError.kind === 'network') {
      return 'offline';
    }

    return 'missing';
  }, [isSignedOut, appError]);

  const state = useMemo<NotFoundScreenState>(() => {
    if (isSignedOut) {
      return 'forbidden';
    }

    if (listQuery.isPending) {
      return 'loading';
    }

    if (appError !== null) {
      return 'error';
    }

    if (recentProjects.length === 0) {
      return 'empty';
    }

    if (recentProjects.length < RECENT_PROJECT_LIMIT) {
      return 'partial';
    }

    if (isCompact) {
      return 'collapsed';
    }

    return 'success';
  }, [isSignedOut, listQuery.isPending, appError, recentProjects, isCompact]);

  /* ---- Hai nút, luôn có mặt, kể cả ở trạng thái lỗi --------------------- */

  const goToDashboard = useCallback((): void => {
    navigate(ROUTES.dashboard);
  }, [navigate]);

  const goToSignIn = useCallback((): void => {
    // `from` — cùng tên mà `AuthScreen.container.tsx` đọc; nó tự lọc bằng
    // `safeDestination()`, nên ở đây không lọc lần hai.
    navigate(ROUTES.login, { state: { from: `${location.pathname}${location.search}` } });
  }, [navigate, location.pathname, location.search]);

  const goBack = useCallback((): void => {
    navigate(-1);
  }, [navigate]);

  const primaryAction = useMemo<NotFoundAction>(
    () =>
      isSignedOut
        ? { label: NOT_FOUND_TEXT.signInLabel, onActivate: goToSignIn }
        : { label: NOT_FOUND_TEXT.dashboardLabel, onActivate: goToDashboard },
    [isSignedOut, goToSignIn, goToDashboard],
  );

  const secondaryAction = useMemo<NotFoundAction>(
    () => ({ label: NOT_FOUND_TEXT.backLabel, onActivate: goBack }),
    [goBack],
  );

  /* ---- O-01: một lượt đo khi vào màn ------------------------------------ */

  /**
   * Đường dẫn KHÔNG đi cùng phép đo, và đó là chủ ý của schema.
   *
   * `screen.error` có đúng bốn trường và không trường nào nhận chuỗi tự do —
   * `codeSchema` ép `/^[a-z0-9][a-z0-9._-]*$/`. Nhét đường dẫn vào thì
   * `toScreenErrorEvent` trả `null` và phép đo MẤT HẲN thay vì báo lỗi. Đường
   * dẫn vẫn hiện trên màn cho người dùng gửi hỗ trợ (`errorCaption`); chỗ nó
   * mất là đường về đội sản phẩm, và thiếu sót ấy đã được báo cáo thành prompt
   * logic (khoản 3 của hợp đồng), không vá bằng cách sửa `src/lib/telemetry`.
   */
  const hasReportedRef = useRef(false);

  useEffect(() => {
    if (hasReportedRef.current) {
      return;
    }

    hasReportedRef.current = true;

    const event = toScreenErrorEvent(
      {
        appError: appErrorOfKind(ERROR_KIND_BY_REASON[reason]),
        context: {},
        timestamp: new Date().toISOString(),
      },
      NOT_FOUND_SCREEN_CODE,
    );

    if (event !== null) {
      telemetry.track(event);
    }
  }, [reason, telemetry]);

  /* ---- Viewmodel -------------------------------------------------------- */

  const errorCaption = `${NOT_FOUND_TEXT.errorCodePrefix}${NOT_FOUND_ERROR_CODE}${NOT_FOUND_TEXT.captionSeparator}${location.pathname}`;

  return {
    state,
    reason,
    title: TITLE_BY_REASON[reason],
    description: DESCRIPTION_BY_REASON[reason],
    errorCaption,
    primaryAction,
    secondaryAction,
    recentProjects,
    recentHeading: NOT_FOUND_TEXT.recentHeading,
    isCompact,
    prefersReducedMotion,
  };
}
