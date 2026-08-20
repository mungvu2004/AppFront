import { createSingleFlight } from '@/lib/http';
import { z } from 'zod';
import { broadcastAuthIntent, emitAuthSignedIn, emitAuthSignedOut } from './events';
import { endAnonymousSession } from './transitions';
import {
  getAuthConfig,
  getRequestAbortSignal,
  getSessionState,
  setAuthenticatedSession,
} from './state';
import type { AuthUser, RefreshSessionPayload } from './types';

export const REFRESH_LEAD_TIME_MS = 60_000;

type RefreshSource = 'broadcast' | 'local';

interface RefreshOptions {
  reason?: 'bootstrap' | 'proactive';
  source?: RefreshSource;
}

const refreshSingleFlightRunner = createSingleFlight();
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;
let removeVisibilityHandler: (() => void) | null = null;

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
  const remainingMs = sessionState.expiresAt - now;

  if (remainingMs <= REFRESH_LEAD_TIME_MS) {
    refreshTimerId = setTimeout(() => {
      void refreshSingleFlight({ reason: 'proactive', source: 'local' });
    }, 0);
    return;
  }

  refreshTimerId = setTimeout(() => {
    void refreshSingleFlight({ reason: 'proactive', source: 'local' });
  }, remainingMs - REFRESH_LEAD_TIME_MS);
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

const createRefreshFailure = (): void => {
  const { broadcastChannelName } = getAuthConfig();

  endAnonymousSession({
    clearTimer: clearRefreshTimer,
    emitSignedOut: emitAuthSignedOut,
    reason: 'refresh-failed',
    refreshFailed: true,
    source: 'local',
  });
  broadcastAuthIntent('signed-out', broadcastChannelName);
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
    if (getSessionState().refreshFailed && options.source !== 'broadcast') {
      return false;
    }

    ensureVisibilityHandler();

    const config = getAuthConfig();
    const previousStatus = getSessionState().status;

    try {
      const response = await config.fetchImpl(new URL(config.refreshPath, config.baseUrl), {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
        method: 'POST',
        signal: getRequestAbortSignal(),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed with status ${response.status}`);
      }

      const payload = await readRefreshPayload(response);
      setAuthenticatedSession(payload);
      scheduleRefreshFromSession();

      if (previousStatus !== 'authenticated') {
        const reason = options.reason === 'bootstrap' ? options.reason : 'bootstrap';
        emitAuthSignedIn({
          reason,
          source: options.source ?? 'local',
        });

        if ((options.source ?? 'local') === 'local') {
          broadcastAuthIntent('signed-in', config.broadcastChannelName);
        }
      }

      return true;
    } catch {
      createRefreshFailure();
      return false;
    }
  });

export const bootstrapSession = async (): Promise<boolean> =>
  refreshSingleFlight({ reason: 'bootstrap', source: 'local' });

export const clearRefreshScheduling = (): void => {
  clearRefreshTimer();
};

export const resetRefreshState = (): void => {
  clearRefreshTimer();
  removeVisibilityHandler?.();
};





