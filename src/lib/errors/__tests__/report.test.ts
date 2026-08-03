import { afterEach, describe, expect, it, vi } from 'vitest';

import { ERROR_REPORTED_EVENT, reportError } from '../report';

describe('errors/report.ts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches sanitized telemetry with requestId', () => {
    const listener = vi.fn();
    window.addEventListener(ERROR_REPORTED_EVENT, listener as EventListener);

    reportError(
      {
        kind: 'http',
        raw: {},
        requestId: 'req-telemetry',
        retryable: false,
        status: 403,
      },
      {
        email: 'engineer@example.com',
        floor: '3',
        name: 'Nguyễn An',
        screen: 'canvas',
        step: 'Dựng hình',
        token: 'secret',
      },
    );

    expect(listener).toHaveBeenCalledTimes(1);

    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail.appError.requestId).toBe('req-telemetry');
    expect(event.detail.appError.kind).toBe('forbidden');
    expect(event.detail.context).toEqual({
      floor: '3',
      screen: 'canvas',
      step: 'Dựng hình',
    });

    window.removeEventListener(ERROR_REPORTED_EVENT, listener as EventListener);
  });
});
