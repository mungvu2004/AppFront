import type {
  CreateHttpClientOptions,
  HttpClient,
  HttpError,
  HttpRequestOptions,
  Result,
} from '@/lib/http';
import type { ProjectRole } from '@/types/project';

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
  roles?: ProjectRole[];
  [key: string]: unknown;
}

export interface SessionSnapshot {
  status: SessionStatus;
  user: AuthUser | null;
  roles: ProjectRole[];
  /**
   * Máy chủ không trả lời lượt gia hạn gần nhất, và lỗi ấy là lỗi TẠM.
   *
   * Cờ này đứng cạnh `status` chứ không phải là một giá trị thứ tư của
   * `SessionStatus`: phiên vẫn đúng là phiên nó đang là — token cũ còn dùng
   * được, vai còn nguyên — chỉ có đường ra máy chủ đang đứt. Gộp hai thứ vào
   * một ô là biến một sự cố mạng thành một lượt đăng xuất.
   *
   * **Tuỳ chọn ở đây, bắt buộc ở `SessionState`** — và đó là một chỗ lệch có
   * lý do, không phải sự lỏng lẻo. `src/lib/autosave/__tests__/createAutosave.test.ts`
   * (file của F-01a, prompt F-01b cấm sửa) dựng bốn `SessionSnapshot` trần;
   * bắt buộc ở đây là `tsc` đỏ ở một file không ai được chạm. Lúc chạy trường
   * này LUÔN có mặt: mọi bản chụp đều do `state.ts` dựng, và nó luôn ghi.
   * Nơi đọc vẫn nên viết `=== true` để khỏi phụ thuộc vào điều đó.
   */
  serverUnreachable?: boolean;
}

export interface SessionState extends SessionSnapshot {
  accessToken: string | null;
  expiresAt: number | null;
  refreshFailed: boolean;
  serverUnreachable: boolean;
}

export interface RefreshSessionPayload {
  accessToken: string;
  expiresAt: number;
  user: AuthUser | null;
  roles: ProjectRole[];
}

export interface AuthEventDetail {
  source: 'local' | 'broadcast';
  reason?: 'sign-out' | 'refresh-failed' | 'auth-error' | 'bootstrap';
}

export type AuthFetch = NonNullable<CreateHttpClientOptions['fetchImpl']>;

export interface AuthConfig {
  baseUrl: string;
  broadcastChannelName: string;
  clearQueryCache: () => void | Promise<void>;
  /** Xoá dữ liệu thuộc về người vừa rời đi. Mặc định không làm gì. */
  clearUserData: () => void | Promise<void>;
  fetchImpl: AuthFetch;
  logoutPath: string;
  now: () => number;
  parseRefreshResponse: (response: Response, now: number) => Promise<RefreshSessionPayload>;
  refreshPath: string;
}

export interface UnauthenticatedHttpError
  extends Omit<HttpError, 'kind' | 'retryable' | 'status'> {
  kind: 'unauthenticated';
  retryable: false;
  status: 401;
}

export type AuthHttpError = HttpError | UnauthenticatedHttpError;

export interface AuthHttpClient {
  delete<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, AuthHttpError>>;
  events: HttpClient['events'];
  get<TRes>(
    path: string,
    options?: Omit<HttpRequestOptions, 'body'>,
  ): Promise<Result<TRes, AuthHttpError>>;
  getRecentRequests: HttpClient['getRecentRequests'];
  patch<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, AuthHttpError>>;
  post<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, AuthHttpError>>;
  put<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, AuthHttpError>>;
}

export type AuthHttpClientOptions = Omit<
  CreateHttpClientOptions,
  'fetchImpl' | 'getToken' | 'onAuthError' | 'onRefreshToken'
>;

export interface ConfigureAuthOptions {
  baseUrl: string;
  broadcastChannelName?: string;
  clearQueryCache?: () => void | Promise<void>;
  clearUserData?: () => void | Promise<void>;
  fetchImpl?: AuthFetch;
  logoutPath?: string;
  now?: () => number;
  parseRefreshResponse?: (response: Response, now: number) => Promise<RefreshSessionPayload>;
  refreshPath?: string;
}
