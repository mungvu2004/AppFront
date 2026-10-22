import { describe, expect, it } from 'vitest';
import { traaEnabledFor } from './traa';

describe('traaEnabledFor', () => {
  it('theo cờ, ?disable=traa tắt', () => {
    expect(traaEnabledFor(true, '')).toBe(true);
    expect(traaEnabledFor(false, '')).toBe(false);
    expect(traaEnabledFor(true, '?disable=ao,traa')).toBe(false);
    expect(traaEnabledFor(true, '?disable=traax')).toBe(true);
  });
});
