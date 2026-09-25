import { describe, expect, it } from 'vitest';

import { HUMAN_TEXT_MAX_LENGTH, normalizeHumanText } from '../humanText';

describe('normalizeHumanText', () => {
  it('composes to NFC and trims both ends', () => {
    expect(normalizeHumanText('  Tâng 1  ')).toEqual({ ok: true, value: 'Tâng 1' });
    expect(normalizeHumanText('é')).toEqual({ ok: true, value: 'é' });
  });

  it('rejects whitespace-only input as empty', () => {
    expect(normalizeHumanText('   \n ')).toEqual({ ok: false, reason: 'empty' });
    expect(normalizeHumanText('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('accepts 120 code points and rejects 121', () => {
    expect(HUMAN_TEXT_MAX_LENGTH).toBe(120);
    expect(normalizeHumanText('a'.repeat(120)).ok).toBe(true);
    expect(normalizeHumanText('a'.repeat(121))).toEqual({ ok: false, reason: 'tooLong' });
  });

  it('counts a non-BMP character as one code point', () => {
    expect(normalizeHumanText('\u{1F600}'.repeat(120)).ok).toBe(true);
    expect(normalizeHumanText('\u{1F600}'.repeat(121))).toEqual({ ok: false, reason: 'tooLong' });
  });

  it.each(['\u0007', '\u0085', '‮', '⁦', 'a\tb', '\u007F', '⁩'])(
    'rejects forbidden character %j',
    (ch) => {
      expect(normalizeHumanText(`a${ch}b`)).toEqual({ ok: false, reason: 'forbiddenCharacter' });
    },
  );
});
