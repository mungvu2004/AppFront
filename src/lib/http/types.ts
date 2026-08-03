export type MaybePromise<T> = T | Promise<T>;

export type Result<T, E> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: E;
    };

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type HttpErrorKind = 'network' | 'timeout' | 'aborted' | 'auth' | 'http' | 'parse';

export interface HttpError {
  kind: HttpErrorKind;
  status?: number;
  code?: string;
  requestId: string;
  retryable: boolean;
  raw: unknown;
}

export type HttpFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean | null | undefined)[];

export type HttpTimeoutMode = 'default' | 'file' | 'stream';

export type HttpResponseType = 'auto' | 'json' | 'text' | 'blob' | 'arrayBuffer' | 'response';

export interface HttpRequestOptions<TBody = undefined> {
  body?: TBody;
  headers?: HeadersInit;
  idempotencyKey?: string;
  idempotent?: boolean;
  disableSingleFlight?: boolean;
  query?: Record<string, QueryParamValue>;
  responseType?: HttpResponseType;
  signal?: AbortSignal;
  singleFlightKey?: string;
  timeoutMode?: HttpTimeoutMode;
  timeoutMs?: number;
}

export interface HttpDoneEvent {
  durationMs: number;
  endedAt: number;
  errorKind?: HttpErrorKind;
  method: HttpMethod;
  ok: boolean;
  requestId: string;
  retryCount: number;
  startedAt: number;
  status?: number;
  url: string;
}

export interface HttpEventMap {
  'http:done': HttpDoneEvent;
}

export interface HttpEventEmitter {
  emit<K extends keyof HttpEventMap>(eventName: K, payload: HttpEventMap[K]): void;
  on<K extends keyof HttpEventMap>(
    eventName: K,
    listener: (payload: HttpEventMap[K]) => void,
  ): () => void;
}

export interface RequestLogEntry {
  requestId: string;
  url: string;
}

export interface HttpClient {
  delete<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, HttpError>>;
  events: HttpEventEmitter;
  get<TRes>(path: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<Result<TRes, HttpError>>;
  getRecentRequests(): readonly RequestLogEntry[];
  patch<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, HttpError>>;
  post<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, HttpError>>;
  put<TRes, TBody = undefined>(
    path: string,
    options?: HttpRequestOptions<TBody>,
  ): Promise<Result<TRes, HttpError>>;
}

export interface CreateHttpClientOptions {
  baseUrl: string;
  fetchImpl?: HttpFetch;
  getToken?: () => MaybePromise<string | null | undefined>;
  onAuthError?: (error: HttpError) => MaybePromise<void>;
  onRefreshToken?: () => MaybePromise<boolean>;
}

export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
