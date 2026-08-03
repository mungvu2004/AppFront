import type { AuthConfig, RefreshSessionPayload, SessionSnapshot, SessionState } from './types';

const initialState = (): SessionState => ({
  accessToken: null,
  expiresAt: null,
  refreshFailed: false,
  roles: [],
  status: 'unknown',
  user: null,
});

let authConfig: AuthConfig | null = null;
let sessionState = initialState();
let sessionSnapshot: SessionSnapshot = {
  roles: sessionState.roles,
  status: sessionState.status,
  user: sessionState.user,
};
let requestAbortController = new AbortController();
const listeners = new Set<() => void>();

const createAbortReason = (message: string): Error => {
  try {
    return new DOMException(message, 'AbortError');
  } catch {
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
  }
};

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

const hasSessionStateChanged = (nextState: SessionState, currentState: SessionState): boolean => {
  if (
    nextState.accessToken !== currentState.accessToken ||
    nextState.expiresAt !== currentState.expiresAt ||
    nextState.refreshFailed !== currentState.refreshFailed ||
    nextState.status !== currentState.status ||
    nextState.user !== currentState.user ||
    nextState.roles.length !== currentState.roles.length
  ) {
    return true;
  }

  return nextState.roles.some((role, index) => role !== currentState.roles[index]);
};

const updateSessionState = (nextState: SessionState): void => {
  if (!hasSessionStateChanged(nextState, sessionState)) {
    return;
  }

  sessionState = nextState;
  sessionSnapshot = {
    roles: nextState.roles,
    status: nextState.status,
    user: nextState.user,
  };
  notify();
};

export const setAuthConfig = (config: AuthConfig): void => {
  authConfig = config;
};

export const getAuthConfig = (): AuthConfig => {
  if (!authConfig) {
    throw new Error('Auth is not configured. Call configureAuth() before using auth helpers.');
  }

  return authConfig;
};

export const getOptionalAuthConfig = (): AuthConfig | null => authConfig;

export const subscribeSession = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const getSessionState = (): SessionState => sessionState;

export const getSessionSnapshot = (): SessionSnapshot => sessionSnapshot;

export const setAuthenticatedSession = (payload: RefreshSessionPayload): void => {
  updateSessionState({
    accessToken: payload.accessToken,
    expiresAt: payload.expiresAt,
    refreshFailed: false,
    roles: payload.roles,
    status: 'authenticated',
    user: payload.user,
  });
};

export const setAnonymousSession = ({ refreshFailed }: { refreshFailed: boolean }): void => {
  updateSessionState({
    accessToken: null,
    expiresAt: null,
    refreshFailed,
    roles: [],
    status: 'anonymous',
    user: null,
  });
};

export const setUnknownSession = (): void => {
  updateSessionState(initialState());
};

export const hasRefreshFailure = (): boolean => sessionState.refreshFailed;

export const getAccessTokenValue = (): string | null => sessionState.accessToken;

export const getRequestAbortSignal = (): AbortSignal => requestAbortController.signal;

export const cancelActiveRequests = (message: string): void => {
  const activeController = requestAbortController;
  requestAbortController = new AbortController();
  activeController.abort(createAbortReason(message));
};

export const resetAuthState = (): void => {
  authConfig = null;
  listeners.clear();
  sessionState = initialState();
  sessionSnapshot = {
    roles: sessionState.roles,
    status: sessionState.status,
    user: sessionState.user,
  };
  requestAbortController.abort(createAbortReason('Auth state reset'));
  requestAbortController = new AbortController();
};

