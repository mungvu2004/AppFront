import type { AuthEventDetail } from './types';

export const AUTH_SIGNED_IN_EVENT = 'auth:signed-in';
export const AUTH_SIGNED_OUT_EVENT = 'auth:signed-out';

type AuthBroadcastIntent = 'signed-in' | 'signed-out';

interface BroadcastCallbacks {
  onSignedIn: (detail: AuthEventDetail) => void;
  onSignedOut: (detail: AuthEventDetail) => void;
}

let fallbackEventTarget: EventTarget | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let broadcastChannelName: string | null = null;
let removeBroadcastListener: (() => void) | null = null;

const getEventTarget = (): EventTarget => {
  if (typeof window !== 'undefined') {
    return window;
  }

  fallbackEventTarget ??= new EventTarget();

  return fallbackEventTarget;
};

const createAuthEvent = <TDetail>(eventName: string, detail: TDetail): Event => {
  if (typeof CustomEvent !== 'undefined') {
    return new CustomEvent<TDetail>(eventName, { detail });
  }

  const event = new Event(eventName) as Event & { detail?: TDetail };
  event.detail = detail;

  return event;
};

const ensureBroadcastChannel = (channelName: string): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }

  if (!broadcastChannel || broadcastChannelName !== channelName) {
    broadcastChannel?.close();
    broadcastChannel = new BroadcastChannel(channelName);
    broadcastChannelName = channelName;
  }

  return broadcastChannel;
};

const subscribeToEvent = (
  eventName: string,
  listener: (detail: AuthEventDetail) => void,
): (() => void) => {
  const eventTarget = getEventTarget();
  const handler = (event: Event): void => {
    const detail = (event as CustomEvent<AuthEventDetail>).detail;
    listener(detail);
  };

  eventTarget.addEventListener(eventName, handler);

  return () => {
    eventTarget.removeEventListener(eventName, handler);
  };
};

export const emitAuthSignedIn = (detail: AuthEventDetail): void => {
  getEventTarget().dispatchEvent(createAuthEvent(AUTH_SIGNED_IN_EVENT, detail));
};

export const emitAuthSignedOut = (detail: AuthEventDetail): void => {
  getEventTarget().dispatchEvent(createAuthEvent(AUTH_SIGNED_OUT_EVENT, detail));
};

export const onAuthSignedIn = (
  listener: (detail: AuthEventDetail) => void,
): (() => void) => subscribeToEvent(AUTH_SIGNED_IN_EVENT, listener);

export const onAuthSignedOut = (
  listener: (detail: AuthEventDetail) => void,
): (() => void) => subscribeToEvent(AUTH_SIGNED_OUT_EVENT, listener);

export const configureAuthBroadcast = (
  channelName: string,
  callbacks: BroadcastCallbacks,
): (() => void) => {
  removeBroadcastListener?.();
  removeBroadcastListener = null;

  const channel = ensureBroadcastChannel(channelName);

  if (!channel) {
    return () => {};
  }

  const onMessage = (event: MessageEvent<unknown>): void => {
    const payload = event.data;
    if (!payload || typeof payload !== 'object') {
      return;
    }

    const type = (payload as { type?: unknown }).type;
    if (type === 'signed-in') {
      callbacks.onSignedIn({ source: 'broadcast' });
    }

    if (type === 'signed-out') {
      callbacks.onSignedOut({ source: 'broadcast' });
    }
  };

  channel.addEventListener('message', onMessage);
  removeBroadcastListener = () => {
    channel.removeEventListener('message', onMessage);
    if (removeBroadcastListener) {
      removeBroadcastListener = null;
    }
  };

  return () => {
    removeBroadcastListener?.();
  };
};

export const broadcastAuthIntent = (
  intent: AuthBroadcastIntent,
  channelName: string,
): void => {
  ensureBroadcastChannel(channelName)?.postMessage({ type: intent });
};

export const resetAuthEvents = (): void => {
  removeBroadcastListener?.();
  removeBroadcastListener = null;
  broadcastChannel?.close();
  broadcastChannel = null;
  broadcastChannelName = null;
  fallbackEventTarget = null;
};
