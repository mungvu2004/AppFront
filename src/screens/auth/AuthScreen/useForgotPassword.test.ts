/**
 * `useForgotPassword` after a 204: no second letter to the same address (BUG-022).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import viMessages from '@/i18n/vi.json';

import { RESEND_COOLDOWN_SECONDS, useForgotPassword, type UseForgotPasswordOptions } from './useForgotPassword';

const EMAIL = 'thu.ha@vidu.vn';

describe('useForgotPassword — after the letter is sent (BUG-022)', () => {
  it('refuses to send again to the same address, and allows it once the address changes', async () => {
    const request = vi.fn<UseForgotPasswordOptions['request']>(async () => ({ ok: true, data: undefined }));
    const { result } = renderHook(() => useForgotPassword({ request }));

    act(() => {
      result.current.actions.setEmail(EMAIL);
    });
    await act(async () => {
      result.current.actions.submit();
    });

    expect(result.current.model.isSent).toBe(true);
    expect(result.current.model.canSubmit).toBe(false);

    await act(async () => {
      result.current.actions.submit();
    });

    expect(request).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.actions.setEmail('khac@vidu.vn');
    });

    expect(result.current.model.isSent).toBe(false);
    expect(result.current.model.canSubmit).toBe(true);

    await act(async () => {
      result.current.actions.submit();
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenLastCalledWith({ email: 'khac@vidu.vn' });
  });
});

describe('useForgotPassword — an address past 254 characters (BUG-010)', () => {
  it('stops it before sending and says it is too long, not malformed', async () => {
    const request = vi.fn<UseForgotPasswordOptions['request']>(async () => ({ ok: true, data: undefined }));
    const { result } = renderHook(() => useForgotPassword({ request }));

    act(() => {
      result.current.actions.setEmail(`${'a'.repeat(64)}@${'b'.repeat(240)}.vn`);
    });
    await act(async () => {
      result.current.actions.submit();
    });

    expect(request).not.toHaveBeenCalled();
    expect(result.current.model.problem).toBe(viMessages.auth.problems.emailTooLong.replace('{{count}}', '254'));
  });
});

describe('useForgotPassword — "Gửi lại thư" waits between letters (RV5#16)', () => {
  it('locks the resend for the cooldown, then sends once more', async () => {
    vi.useFakeTimers();
    try {
      const request = vi.fn<UseForgotPasswordOptions['request']>(async () => ({ ok: true, data: undefined }));
      const { result } = renderHook(() => useForgotPassword({ request }));

      act(() => {
        result.current.actions.setEmail(EMAIL);
      });
      await act(async () => {
        result.current.actions.submit();
      });

      expect(result.current.model.canResend).toBe(false);
      expect(result.current.model.resendLabel).toBe(
        viMessages.auth.forgotPassword.resendWait.replace('{{count}}', String(RESEND_COOLDOWN_SECONDS)),
      );

      await act(async () => {
        result.current.actions.resend();
        result.current.actions.resend();
      });
      expect(request).toHaveBeenCalledTimes(1);

      for (let second = 0; second < RESEND_COOLDOWN_SECONDS; second += 1) {
        act(() => {
          vi.advanceTimersByTime(1000);
        });
      }

      expect(result.current.model.canResend).toBe(true);
      expect(result.current.model.resendLabel).toBe(viMessages.auth.forgotPassword.resend);

      await act(async () => {
        result.current.actions.resend();
      });
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
