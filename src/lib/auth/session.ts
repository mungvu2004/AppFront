import {
  createHttpClient,
  type CreateHttpClientOptions,
  type HttpError,
  type HttpRequestOptions,
  type Result,
} from '@/lib/http';
import { broadcastAuthIntent, configureAuthBroadcast, emitAuthSignedOut, resetAuthEvents } from './events';
import {
  bootstrapSession as bootstrapFromRefresh,
  clearRefreshScheduling,
  defaultParseRefreshResponse,
  refreshSingleFlight,
  resetRefreshState,
} from './refresh';
import { endAnonymousSession } from './transitions';
import {
  cancelActiveRequests,
  getAccessTokenValue,
  getAuthConfig,
  getOptionalAuthConfig,
  getRequestAbortSignal,
  getSessionSnapshot,
  getSessionState,
  resetAuthState,
  setAuthConfig,
  subscribeSession,
} from './state';
import type {
  AuthConfig,
  AuthFetch,
  AuthHttpClient,
  AuthHttpClientOptions,
  AuthHttpError,
  ConfigureAuthOptions,
  UnauthenticatedHttpError,
} from './types';

const DEFAULT_BROADCAST_CHANNEL_NAME = 'auth';
const DEFAULT_LOGOUT_PATH = '/auth/logout';
const DEFAULT_REFRESH_PATH = '/auth/refresh';

const getDefaultFetch = (): AuthFetch => {
  if (!globalThis.fetch) {
    throw new Error('globalThis.fetch is required to configure auth.');
  }

  return globalThis.fetch.bind(globalThis) as AuthFetch;
};

const isConfigured = (): boolean => getOptionalAuthConfig() !== null;

type CombinedSignal = {
  cleanup: () => void;
  signal?: AbortSignal;
};

const isAbortSignal = (signal: AbortSignal | null | undefined): signal is AbortSignal =>
  signal instanceof AbortSignal;

const createCombinedSignal = (signals: readonly (AbortSignal | null | undefined)[]): CombinedSignal => {
  const activeSignals = signals.filter(isAbortSignal);
  if (activeSignals.length === 0) {
    return {
      cleanup: () => undefined,
    };
  }

  const controller = new AbortController();
  const cleanupCallbacks: Array<() => void> = [];
  let cleanedUp = false;

  const cleanup = (): void => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    cleanupCallbacks.forEach((callback) => callback());
    cleanupCallbacks.length = 0;
  };

  const abortFromSignal = (signal: AbortSignal): void => {
    if (controller.signal.aborted) {
      return;
    }

    controller.abort(signal.reason);
    cleanup();
  };

  activeSignals.forEach((signal) => {
    if (signal.aborted) {
      abortFromSignal(signal);
      return;
    }

    const onAbort = (): void => abortFromSignal(signal);
    signal.addEventListener('abort', onAbort, { once: true });
    cleanupCallbacks.push(() => signal.removeEventListener('abort', onAbort));
  });

  return {
    cleanup,
    signal: controller.signal,
  };
};

const createAuthFetch = (): AuthFetch => {
  const configuredFetch = getAuthConfig().fetchImpl;

  return async (input, init) => {
    const combinedSignal = createCombinedSignal([init?.signal, getRequestAbortSignal()]);

    try {
      return await configuredFetch(input, {
        ...init,
        ...(combinedSignal.signal ? { signal: combinedSignal.signal } : {}),
      });
    } finally {
      combinedSignal.cleanup();
    }
  };
};

const toUnauthenticatedError = (error: HttpError): UnauthenticatedHttpError => ({
  code: error.code ?? 'UNAUTHENTICATED',
  kind: 'unauthenticated',
  raw: error.raw,
  requestId: error.requestId,
  retryable: false,
  status: 401,
});

const mapResult = <TRes>(result: Result<TRes, HttpError>): Result<TRes, AuthHttpError> => {
  if (!result.ok && result.error.kind === 'auth' && getSessionState().refreshFailed) {
    return {
      error: toUnauthenticatedError(result.error),
      ok: false,
    };
  }

  return result;
};

const createConfig = (options: ConfigureAuthOptions): AuthConfig => ({
  baseUrl: options.baseUrl,
  broadcastChannelName: options.broadcastChannelName ?? DEFAULT_BROADCAST_CHANNEL_NAME,
  clearQueryCache: options.clearQueryCache ?? (() => undefined),
  fetchImpl: options.fetchImpl ?? getDefaultFetch(),
  logoutPath: options.logoutPath ?? DEFAULT_LOGOUT_PATH,
  now: options.now ?? (() => Date.now()),
  parseRefreshResponse: options.parseRefreshResponse ?? defaultParseRefreshResponse,
  refreshPath: options.refreshPath ?? DEFAULT_REFRESH_PATH,
});

const clearSession = async ({
  broadcast,
  cancelRequests,
  revoke,
}: {
  broadcast: boolean;
  cancelRequests: boolean;
  revoke: boolean;
}): Promise<void> => {
  const config = getAuthConfig();

  if (cancelRequests) {
    cancelActiveRequests('Auth session ended.');
  }

  endAnonymousSession({
    clearTimer: clearRefreshScheduling,
    emitSignedOut: emitAuthSignedOut,
    reason: 'sign-out',
    refreshFailed: false,
    source: 'local',
  });

  try {
    await config.clearQueryCache();
  } catch {
    // Best effort.
  }

  if (broadcast) {
    broadcastAuthIntent('signed-out', config.broadcastChannelName);
  }

  if (!revoke) {
    return;
  }

  try {
    await config.fetchImpl(new URL(config.logoutPath, config.baseUrl), {
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      method: 'POST',
    });
  } catch {
    // Local sign-out already completed; the caller only needs best-effort revocation.
  }
};

const handleAuthError = async (_error: HttpError): Promise<void> => {
  const sessionState = getSessionState();
  if (sessionState.refreshFailed || sessionState.status === 'anonymous') {
    return;
  }

  await clearSession({
    broadcast: true,
    cancelRequests: false,
    revoke: false,
  });
};

export const configureAuth = (options: ConfigureAuthOptions): void => {
  const config = createConfig(options);
  setAuthConfig(config);

  configureAuthBroadcast(config.broadcastChannelName, {
    onSignedIn: () => {
      void refreshSingleFlight({ source: 'broadcast' });
    },
    onSignedOut: () => {
      cancelActiveRequests('Auth session ended.');
      endAnonymousSession({
        clearTimer: clearRefreshScheduling,
        emitSignedOut: emitAuthSignedOut,
        reason: 'sign-out',
        refreshFailed: false,
        source: 'broadcast',
      });
      void Promise.resolve(config.clearQueryCache()).catch(() => undefined);
    },
  });
};

export const createAuthHttpClientOptions = (): Pick<
  CreateHttpClientOptions,
  'fetchImpl' | 'getToken' | 'onAuthError' | 'onRefreshToken'
> => {
  if (!isConfigured()) {
    throw new Error('Auth is not configured. Call configureAuth() before creating auth HTTP options.');
  }

  return {
    fetchImpl: createAuthFetch(),
    getToken: getAccessToken,
    onAuthError: handleAuthError,
    onRefreshToken: () => refreshSingleFlight({ source: 'local' }),
  };
};

export const createAuthHttpClient = (options: AuthHttpClientOptions): AuthHttpClient => {
  const client = createHttpClient({
    ...options,
    ...createAuthHttpClientOptions(),
  });

  return {
    delete: async <TRes, TBody = undefined>(
      path: string,
      requestOptions?: HttpRequestOptions<TBody>,
    ): Promise<Result<TRes, AuthHttpError>> => mapResult(await client.delete<TRes, TBody>(path, requestOptions)),
    events: client.events,
    get: async <TRes>(path: string, requestOptions?: Omit<HttpRequestOptions, 'body'>): Promise<Result<TRes, AuthHttpError>> =>
      mapResult(await client.get<TRes>(path, requestOptions)),
    getRecentRequests: client.getRecentRequests,
    patch: async <TRes, TBody = undefined>(
      path: string,
      requestOptions?: HttpRequestOptions<TBody>,
    ): Promise<Result<TRes, AuthHttpError>> => mapResult(await client.patch<TRes, TBody>(path, requestOptions)),
    post: async <TRes, TBody = undefined>(
      path: string,
      requestOptions?: HttpRequestOptions<TBody>,
    ): Promise<Result<TRes, AuthHttpError>> => mapResult(await client.post<TRes, TBody>(path, requestOptions)),
    put: async <TRes, TBody = undefined>(
      path: string,
      requestOptions?: HttpRequestOptions<TBody>,
    ): Promise<Result<TRes, AuthHttpError>> => mapResult(await client.put<TRes, TBody>(path, requestOptions)),
  };
};

export const bootstrapSession = async (): Promise<boolean> => bootstrapFromRefresh();

export const signOut = async (): Promise<void> => {
  await clearSession({
    broadcast: true,
    cancelRequests: true,
    revoke: true,
  });
};

export const getAccessToken = (): string | null => getAccessTokenValue();

export const getSession = (): ReturnType<typeof getSessionSnapshot> => getSessionSnapshot();

export const subscribeToSession = (listener: () => void): (() => void) => subscribeSession(listener);

export const __resetAuthForTests = (): void => {
  resetAuthEvents();
  resetRefreshState();
  resetAuthState();
};
