import { describe, expect, it } from 'vitest';
import { useRealism } from './store';
import { traaEnabled, traaEnabledFor } from './traa';

describe('traaEnabledFor', () => {
  it('theo cờ, ?disable=traa tắt', () => {
    expect(traaEnabledFor(true, '')).toBe(true);
    expect(traaEnabledFor(false, '')).toBe(false);
    expect(traaEnabledFor(true, '?disable=ao,traa')).toBe(false);
    expect(traaEnabledFor(true, '?disable=traax')).toBe(true);
  });

  it('F3: cảnh low dùng MSAA, medium/high theo cờ (chưa initTier: mức cảnh = mức hiện tại)', () => {
    useRealism.setState({ tier: 'low' });
    expect(traaEnabled()).toBe(false);
    useRealism.setState({ tier: 'high' });
    expect(traaEnabled()).toBe(useRealism.getState().flags.traa);
  });
});
