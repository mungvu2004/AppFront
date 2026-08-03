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
}

export interface SessionState extends SessionSnapshot {
  accessToken: string | null;
  expiresAt: number | null;
  refreshFailed: boolean;
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
  fetchImpl?: AuthFetch;
  logoutPath?: string;
  now?: () => number;
  parseRefreshResponse?: (response: Response, now: number) => Promise<RefreshSessionPayload>;
  refreshPath?: string;
}
