import { createSingleFlight } from '@/lib/http';
import { z } from 'zod';
import {
  RETRY_MIN_DELAY_MS,
  getLastKnownUserId,
  resolveAuthUrl,
  resolveRetryDelayMs,
  resolveServerOffsetMs,
  setLastKnownUserId,
} from './bootstrap';
import { broadcastAuthIntent, emitAuthSignedIn, emitAuthSignedOut } from './events';
import { endAnonymousSession } from './transitions';
import {
  getAuthConfig,
  getRequestAbortSignal,
  getSessionState,
  setAuthenticatedSession,
  setServerUnreachable,
} from './state';
import type { AuthUser, RefreshSessionPayload } from './types';

export const REFRESH_LEAD_TIME_MS = 60_000;

/** Sàn giữa hai lượt gia hạn CHỦ ĐỘNG — lượt do lịch hẹn trước hạn. */
export const REFRESH_MIN_INTERVAL_MS = 30_000;

/** Quá ngần này mà máy chủ chưa trả lời thì coi như đường đứt, không phải phiên chết. */
export const REFRESH_TIMEOUT_MS = 15_000;

/**
 * Thử lại lỗi tạm tối đa bấy nhiêu lượt, rồi ĐỨNG IM.
 *
 * Thang lùi là 1, 2, 4, 8, 16, 32, 60, 60 giây — tám lượt trải ra khoảng ba
 * phút. Đó đã là quá đủ cho một cú chập chờn; dài hơn nữa thì không còn là
 * "thử lại" mà là một thẻ trình duyệt đập vào chính máy chủ đang hồi phục, và
 * nhân với số người đang mở trang thì chuỗi ấy tự nó thành một sự cố thứ hai.
 *
 * Đứng im không phải bỏ cuộc: còn HAI đường khởi động lại, và cả hai đều do
 * người dùng hoặc trình duyệt chủ động — `visibilitychange` (quay lại thẻ thì
 * `scheduleRefreshFromSession` chạy lại) và nút "thử lại" của `SessionGate`
 * (`retryAppSession()` → `bootstrapSession()`). Cả hai đặt `transientAttempt`
 * về 0, nên chúng cho một THANG MỚI đầy đủ chứ không phải đúng một lượt lẻ —
 * một người quay lại thẻ sau bữa trưa xứng đáng được thử lại tử tế.
 */
export const REFRESH_MAX_TRANSIENT_ATTEMPTS = 8;

/** Mã trạng thái nói "phiên đã chết" — khác hẳn mọi mã nói "máy chủ đang ốm". */
const UNAUTHENTICATED_STATUS = 401;
const REQUEST_TIMEOUT_STATUS = 408;
const RATE_LIMITED_STATUS = 429;
const SERVER_ERROR_STATUS = 500;

/**
 * Lỗi TẠM: máy chủ không nói được, chứ không nói rằng phiên này hết giá trị.
 *
 * Một cú 502 chớp nhoáng không phải bằng chứng để đá người dùng ra khỏi mọi
 * thẻ đang mở — nó là bằng chứng để thử lại.
 */
const isTransientStatus = (status: number): boolean =>
  status === REQUEST_TIMEOUT_STATUS ||
  status === RATE_LIMITED_STATUS ||
  status >= SERVER_ERROR_STATUS;

type RefreshSource = 'broadcast' | 'local';

interface RefreshOptions {
  reason?: 'bootstrap' | 'proactive';
  source?: RefreshSource;
}

const refreshSingleFlightRunner = createSingleFlight();
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;
let removeVisibilityHandler: (() => void) | null = null;
let serverOffsetMs = 0;
let lastRefreshAttemptAt: number | null = null;
let transientAttempt = 0;

const roleSchema = z.union([
  z.literal('admin'),
  z.literal('engineer'),
  z.literal('viewer'),
]);

const refreshUserSchema = z
  .object({
    email: z.string().optional(),
    id: z.string().min(1),
    name: z.string().optional(),
    roles: z.array(roleSchema).optional(),
  })
  .passthrough();

const refreshPayloadSchema = z
  .object({
    accessToken: z.string().min(1).optional(),
    access_token: z.string().min(1).optional(),
    expiresAt: z.union([z.number(), z.string()]).optional(),
    expiresIn: z.number().optional(),
    expires_at: z.union([z.number(), z.string()]).optional(),
    expires_in: z.number().optional(),
    roles: z.array(roleSchema).optional(),
    user: refreshUserSchema.nullable().optional(),
  })
  .passthrough();

const refreshResponseSchema = z.union([
  z.object({ data: refreshPayloadSchema }).passthrough(),
  refreshPayloadSchema,
]);

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const normalizeUser = (value: unknown): AuthUser | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = readString(record.id);
  if (!id) {
    return null;
  }

  const user: AuthUser = {
    id,
  };

  if (typeof record.name === 'string') {
    user.name = record.name;
  }

  if (typeof record.email === 'string') {
    user.email = record.email;
  }

  if (Array.isArray(record.roles)) {
    user.roles = record.roles.filter((role): role is 'admin' | 'engineer' | 'viewer' =>
      role === 'admin' || role === 'engineer' || role === 'viewer',
    );
  }

  return user;
};

const resolveExpiresAt = (payload: Record<string, unknown>, now: number): number => {
  const expiresAtValue = payload.expiresAt ?? payload.expires_at;
  if (typeof expiresAtValue === 'number' && Number.isFinite(expiresAtValue)) {
    return expiresAtValue > 10_000_000_000 ? expiresAtValue : expiresAtValue * 1000;
  }

  if (typeof expiresAtValue === 'string') {
    const parsed = Date.parse(expiresAtValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  const expiresInValue = payload.expiresIn ?? payload.expires_in;
  if (typeof expiresInValue === 'number' && Number.isFinite(expiresInValue)) {
    return now + expiresInValue * 1000;
  }

  throw new Error('Refresh response is missing expiresAt or expiresIn.');
};

const clearRefreshTimer = (): void => {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
};

const isDocumentHidden = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.visibilityState === 'hidden';
};

const scheduleRefreshFromSession = (): void => {
  clearRefreshTimer();

  const sessionState = getSessionState();
  if (sessionState.status !== 'authenticated' || sessionState.expiresAt === null) {
    return;
  }

  if (isDocumentHidden()) {
    return;
  }

  const now = getAuthConfig().now();
  const remainingMs = sessionState.expiresAt - (now + serverOffsetMs);
  // Sàn `REFRESH_MIN_INTERVAL_MS` sống ở ĐÂY, không ở trong `refreshSingleFlight`:
  // chỗ này hoãn được lượt chủ động, còn chỗ kia chỉ bỏ được nó. Và vì chỉ lịch
  // hẹn mới đọc sàn, lượt do 401, do dựng phiên, do thẻ khác hay do SSE gọi đều
  // đi thẳng, đúng như hợp đồng.
  const floorMs =
    lastRefreshAttemptAt === null ? 0 : REFRESH_MIN_INTERVAL_MS - (now - lastRefreshAttemptAt);

  const idealMs = Math.max(remainingMs - REFRESH_LEAD_TIME_MS, 0);

  /*
   * Sàn được hoãn lượt gia hạn, nhưng KHÔNG được hoãn nó qua lúc token chết.
   *
   * Với TTL ngắn hơn thời gian đón đầu — token sống 30 giây chẳng hạn —
   * `remainingMs - REFRESH_LEAD_TIME_MS` âm nên sàn 30 giây thắng, và lượt gia
   * hạn nổ ĐÚNG lúc token hết hạn. Lượt ấy thường vẫn đi được vì nó dựa vào
   * cookie chứ không vào token; nhưng nếu máy chủ trả 401 thì
   * `createRefreshFailure()` phát `signed-out` sang MỌI thẻ — đúng cái F-01b
   * tồn tại để tránh.
   *
   * Khi TTL ngắn hơn sàn thì hai thứ MÂU THUẪN thật: không thể vừa gia hạn
   * trước lúc token chết, vừa chờ đủ 30 giây giữa hai lượt. Đời token thắng —
   * nhưng sàn không bị vứt đi, nó chỉ bị kẹp lại ở **nửa quãng đời còn lại**.
   * Nửa quãng đời là một TỈ LỆ chứ không phải một hằng thời lượng thứ năm: nó
   * co giãn theo TTL thật của máy chủ và luôn để lại đúng bấy nhiêu dự phòng.
   *
   * ## Vì sao còn phải kẹp SÀN DƯỚI ở `RETRY_MIN_DELAY_MS`
   *
   * Vì "co giãn theo quãng đời còn lại" tự nó **không** chặn được vòng lặp —
   * nó mất hiệu lực ở đúng chỗ cần nhất. Khi `remainingMs` tiến về 0 thì
   * `latestSafeMs` cũng tiến về 0, và `Math.min` kéo sàn xuống theo: một lượt
   * gia hạn **THÀNH CÔNG** trả về token đã chết (`expiresAt` bằng hoặc trước
   * tiêu đề `Date` của chính phản hồi) sẽ hẹn lượt kế ở độ trễ 0, rồi lặp mãi.
   * Đo được: 18 lượt trong một giây giả.
   *
   * Trần `REFRESH_MAX_TRANSIENT_ATTEMPTS` KHÔNG cứu được chỗ này — nó canh
   * đường LỖI, còn đây là đường THÀNH CÔNG, mà mỗi lượt thành công lại đặt
   * `transientAttempt` về 0. Nên sàn dưới phải là một hằng thật, không phải
   * một tỉ lệ. Dùng lại `RETRY_MIN_DELAY_MS` chứ không sinh hằng thời lượng
   * mới: TTL dài không đổi (`idealMs` thắng), TTL 30 giây không đổi (15 000
   * thắng), chỉ `remainingMs ≲ 0` mới chạm tới nó.
   */
  const latestSafeMs = Math.max(Math.floor(remainingMs / 2), 0);
  const delayMs = Math.max(idealMs, Math.min(floorMs, latestSafeMs), RETRY_MIN_DELAY_MS);

  /*
   * Tới được đây là có một lượt chủ động đang được hẹn — nên thang lùi của lần
   * hỏng trước hết hiệu lực. Không có dòng này thì một người quay lại thẻ sau
   * bữa trưa chỉ được ĐÚNG MỘT lượt: `transientAttempt` vẫn đứng ở trần, nên
   * lượt ấy hỏng là `handleTransientFailure` chạm trần ngay và im trở lại.
   */
  transientAttempt = 0;

  refreshTimerId = setTimeout(() => {
    void refreshSingleFlight({ reason: 'proactive', source: 'local' });
  }, delayMs);
};

const ensureVisibilityHandler = (): void => {
  if (removeVisibilityHandler || typeof document === 'undefined') {
    return;
  }

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      clearRefreshTimer();
      return;
    }

    scheduleRefreshFromSession();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  removeVisibilityHandler = () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    removeVisibilityHandler = null;
  };
};

/**
 * Phiên này hỏng, nhưng chỉ ở thẻ này.
 *
 * Dùng cho mọi lỗi mà máy chủ nói rõ là lỗi của LƯỢT GỌI — 403 `ORIGIN_MISMATCH`,
 * 4xx khác, thân W16 đọc không ra. Thẻ khác có thể vẫn còn một phiên tốt, và ta
 * không có bằng chứng nào để đá nó ra.
 */
const endSessionLocally = (): void => {
  transientAttempt = 0;
  endAnonymousSession({
    clearTimer: clearRefreshTimer,
    emitSignedOut: emitAuthSignedOut,
    reason: 'refresh-failed',
    refreshFailed: true,
    source: 'local',
  });
};

/** Phiên đã chết ở phía máy chủ (401) — mọi thẻ đều phải biết. */
const createRefreshFailure = (): void => {
  const { broadcastChannelName } = getAuthConfig();

  endSessionLocally();
  broadcastAuthIntent('signed-out', broadcastChannelName);
};

/**
 * Máy chủ không với tới được: giữ nguyên phiên, bật cờ, và hẹn thử lại.
 *
 * Không đặt `refreshFailed`, không phát gì — một chuỗi lỗi mạng không được
 * biến thành một lượt đăng xuất.
 */
const handleTransientFailure = (retryAfterHeader: string | null): void => {
  clearRefreshTimer();
  setServerUnreachable(true);
  transientAttempt += 1;

  /*
   * Hai lý do để KHÔNG hẹn lượt sau, và chúng canh hai kịch bản KHÁC nhau.
   *
   * `status === 'anonymous'`: không có phiên nào để gia hạn cả. Tới được đây
   * là đã có một lượt **401** đặt phiên về ẩn danh trước đó, rồi một lượt sau
   * gặp lỗi tạm.
   *
   * Trần `REFRESH_MAX_TRANSIENT_ATTEMPTS`: đây mới là thứ canh kịch bản khách
   * chưa đăng nhập đứng ở `/login` lúc máy chủ chết. Trên đường ấy trạng thái
   * là `unknown`, **không** phải `anonymous` — một cú 502 là lỗi tạm, nó không
   * đặt phiên về ẩn danh — nên nhánh trên không chạm tới, và nếu không có trần
   * thì thẻ của họ bắn `POST /auth/refresh` mỗi 60 giây, vô hạn, cho một phiên
   * không tồn tại.
   */
  if (
    getSessionState().status === 'anonymous' ||
    transientAttempt >= REFRESH_MAX_TRANSIENT_ATTEMPTS
  ) {
    return;
  }

  refreshTimerId = setTimeout(() => {
    void refreshSingleFlight({ source: 'local' });
  }, resolveRetryDelayMs(retryAfterHeader, transientAttempt));
};

/** Nối một tín hiệu huỷ có sẵn vào bộ huỷ của lượt gọi này. */
const linkAbort = (target: AbortController, source: AbortSignal): (() => void) => {
  if (source.aborted) {
    target.abort(source.reason);

    return () => undefined;
  }

  const onAbort = (): void => target.abort(source.reason);
  source.addEventListener('abort', onAbort, { once: true });

  return () => source.removeEventListener('abort', onAbort);
};

const runQuietly = async (task: () => void | Promise<void>): Promise<void> => {
  try {
    await task();
  } catch {
    // Best effort: dọn dẹp hỏng không được làm hỏng lượt đăng nhập.
  }
};

const readRefreshPayload = async (response: Response): Promise<RefreshSessionPayload> => {
  const config = getAuthConfig();
  return config.parseRefreshResponse(response, config.now());
};

export const defaultParseRefreshResponse = async (
  response: Response,
  now: number,
): Promise<RefreshSessionPayload> => {
  const payload = await response.json();
  const parsed = refreshResponseSchema.parse(payload);
  const root = ('data' in parsed ? parsed.data : parsed) as z.infer<typeof refreshPayloadSchema>;
  const accessToken = root.accessToken ?? root.access_token;

  if (!accessToken) {
    throw new Error('Refresh response is missing accessToken.');
  }

  const user = normalizeUser(root.user);
  const roles = root.roles ?? user?.roles ?? [];

  return {
    accessToken,
    expiresAt: resolveExpiresAt(root, now),
    roles,
    user,
  };
};

export const refreshSingleFlight = async (
  options: RefreshOptions = {},
): Promise<boolean> =>
  refreshSingleFlightRunner('auth-refresh', async () => {
    // `bootstrap` đi xuyên cổng này: sau một lượt 401, người dùng đăng nhập
    // lại và lượt dựng phiên phải được gửi đi thật, chứ không trả `false` ngay.
    if (
      getSessionState().refreshFailed &&
      options.source !== 'broadcast' &&
      options.reason !== 'bootstrap'
    ) {
      return false;
    }

    ensureVisibilityHandler();

    // Lượt dựng phiên là một lượt do NGƯỜI dùng chủ động — nút "thử lại" của
    // `SessionGate` đi qua đây — nên nó cũng xoá thang lùi của lần hỏng trước.
    if (options.reason === 'bootstrap') {
      transientAttempt = 0;
    }

    const config = getAuthConfig();
    lastRefreshAttemptAt = config.now();
    const previousStatus = getSessionState().status;

    // Mỗi lượt một bộ huỷ RIÊNG: hết giờ chỉ giết lượt này, còn tín hiệu huỷ
    // chung (người dùng đăng xuất) vẫn dừng được nó. Hai ca cùng ném
    // `AbortError`, nên phân biệt bằng cờ cục bộ chứ không bằng `error.name`.
    const attemptController = new AbortController();
    const unlinkGlobalAbort = linkAbort(attemptController, getRequestAbortSignal());
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      attemptController.abort(new Error('Refresh timed out.'));
    }, REFRESH_TIMEOUT_MS);

    try {
      const response = await config.fetchImpl(resolveAuthUrl(config.baseUrl, config.refreshPath), {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
        method: 'POST',
        signal: attemptController.signal,
      });

      if (!response.ok) {
        if (isTransientStatus(response.status)) {
          handleTransientFailure(response.headers.get('Retry-After'));
          return false;
        }

        if (response.status === UNAUTHENTICATED_STATUS) {
          createRefreshFailure();
          return false;
        }

        endSessionLocally();
        return false;
      }

      serverOffsetMs = resolveServerOffsetMs(response.headers.get('Date'), config.now());
      const payload = await readRefreshPayload(response);
      transientAttempt = 0;

      // Đổi người: dọn sạch dấu vết người trước TRƯỚC khi phiên mới lên màn.
      const nextUserId = payload.user?.id ?? null;
      const previousUserId = getLastKnownUserId();
      const userChanged =
        nextUserId !== null && previousUserId !== null && nextUserId !== previousUserId;

      if (userChanged) {
        await runQuietly(config.clearQueryCache);
        await runQuietly(config.clearUserData);
      }

      setAuthenticatedSession(payload);
      if (nextUserId !== null) {
        setLastKnownUserId(nextUserId);
      }
      scheduleRefreshFromSession();

      if (previousStatus !== 'authenticated' || userChanged) {
        emitAuthSignedIn({
          reason: 'bootstrap',
          source: options.source ?? 'local',
        });

        if ((options.source ?? 'local') === 'local') {
          broadcastAuthIntent('signed-in', config.broadcastChannelName);
        }
      }

      return true;
    } catch (error) {
      if (timedOut || error instanceof TypeError) {
        handleTransientFailure(null);
        return false;
      }

      // Người dùng đã đăng xuất giữa chừng: không đổi trạng thái, không hẹn lượt sau.
      if (attemptController.signal.aborted) {
        return false;
      }

      endSessionLocally();
      return false;
    } finally {
      clearTimeout(timeoutId);
      unlinkGlobalAbort();
    }
  });

export const bootstrapSession = async (): Promise<boolean> =>
  refreshSingleFlight({ reason: 'bootstrap', source: 'local' });

export const clearRefreshScheduling = (): void => {
  clearRefreshTimer();
  transientAttempt = 0;
};

export const resetRefreshState = (): void => {
  clearRefreshTimer();
  removeVisibilityHandler?.();
  serverOffsetMs = 0;
  lastRefreshAttemptAt = null;
  transientAttempt = 0;
};
