import { getPlatformFetch } from '@/lib/http';

export interface NetworkMonitorStatus {
  browserOnline: boolean;
  checkedAt: number;
  online: boolean;
  pingOnline: boolean;
}

export type NetworkPing = (signal: AbortSignal) => Promise<boolean>;

export type NetworkStatusListener = (status: NetworkMonitorStatus) => void;

export interface NetworkMonitor {
  checkNow(): Promise<NetworkMonitorStatus>;
  getStatus(): NetworkMonitorStatus;
  start(): void;
  stop(): void;
  subscribe(listener: NetworkStatusListener): () => void;
}

export interface CreateNetworkMonitorOptions {
  intervalMs?: number;
  navigatorObject?: Pick<Navigator, 'onLine'>;
  now?: () => number;
  ping?: NetworkPing;
  pingTimeoutMs?: number;
  pingUrl?: string;
  windowObject?: Pick<
    Window,
    | 'addEventListener'
    | 'clearInterval'
    | 'clearTimeout'
    | 'removeEventListener'
    | 'setInterval'
    | 'setTimeout'
  >;
}

const DEFAULT_PING_INTERVAL_MS = 20_000;
const DEFAULT_PING_TIMEOUT_MS = 5_000;

const resolveBrowserOnline = (navigatorObject: Pick<Navigator, 'onLine'> | undefined): boolean =>
  navigatorObject?.onLine ?? true;

/**
 * Ping mặc định: một HEAD với `signal`, KHÔNG qua client của `src/lib/http`.
 *
 * Cố ý không qua đó: client có retry, mà retry đúng là thứ làm hỏng phép đo này
 * — thử lại ba lần rồi báo "online" thì đã trả lời sai câu hỏi đang hỏi. Nơi gọi
 * muốn thay hẳn cách đo thì truyền `ping`, đó mới là chỗ nối.
 */
const createDefaultPing =
  (pingUrl: string): NetworkPing =>
  async (signal) => {
    const platformFetch = getPlatformFetch();

    if (platformFetch === null) {
      return false;
    }

    const response = await platformFetch(pingUrl, {
      cache: 'no-store',
      method: 'HEAD',
      signal,
    });

    return response.ok;
  };

export const createNetworkMonitor = (options: CreateNetworkMonitorOptions = {}): NetworkMonitor => {
  const intervalMs = options.intervalMs ?? DEFAULT_PING_INTERVAL_MS;
  const navigatorObject = options.navigatorObject ?? globalThis.navigator;
  const now = options.now ?? Date.now;
  const pingTimeoutMs = options.pingTimeoutMs ?? DEFAULT_PING_TIMEOUT_MS;
  const windowObject = options.windowObject ?? globalThis.window;
  const ping = options.ping ?? createDefaultPing(options.pingUrl ?? '/');
  const listeners = new Set<NetworkStatusListener>();

  let intervalId: ReturnType<typeof setInterval> | number | null = null;
  let browserOnline = resolveBrowserOnline(navigatorObject);
  let pingOnline = false;
  let checkedAt = now();

  const getStatus = (): NetworkMonitorStatus => ({
    browserOnline,
    checkedAt,
    online: browserOnline && pingOnline,
    pingOnline,
  });

  const emit = (): void => {
    const status = getStatus();
    listeners.forEach((listener) => listener(status));
  };

  const updateBrowserOnline = (): void => {
    browserOnline = resolveBrowserOnline(navigatorObject);
    checkedAt = now();
    emit();
  };

  const checkNow = async (): Promise<NetworkMonitorStatus> => {
    browserOnline = resolveBrowserOnline(navigatorObject);

    const controller = new AbortController();
    const timeoutId = windowObject?.setTimeout
      ? windowObject.setTimeout(() => controller.abort(), pingTimeoutMs)
      : setTimeout(() => controller.abort(), pingTimeoutMs);

    try {
      pingOnline = await ping(controller.signal);
    } catch {
      pingOnline = false;
    } finally {
      if (windowObject?.clearTimeout && typeof timeoutId === 'number') {
        windowObject.clearTimeout(timeoutId);
      } else {
        clearTimeout(timeoutId as ReturnType<typeof setTimeout>);
      }
    }

    checkedAt = now();
    emit();

    return getStatus();
  };

  const start = (): void => {
    if (intervalId !== null) {
      return;
    }

    windowObject?.addEventListener('online', updateBrowserOnline);
    windowObject?.addEventListener('offline', updateBrowserOnline);
    void checkNow();
    intervalId = windowObject?.setInterval
      ? windowObject.setInterval(() => {
          void checkNow();
        }, intervalMs)
      : setInterval(() => {
          void checkNow();
        }, intervalMs);
  };

  const stop = (): void => {
    if (intervalId === null) {
      return;
    }

    if (windowObject?.clearInterval && typeof intervalId === 'number') {
      windowObject.clearInterval(intervalId);
    } else {
      clearInterval(intervalId as ReturnType<typeof setInterval>);
    }

    intervalId = null;
    windowObject?.removeEventListener('online', updateBrowserOnline);
    windowObject?.removeEventListener('offline', updateBrowserOnline);
  };

  return {
    checkNow,
    getStatus,
    start,
    stop,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
};
