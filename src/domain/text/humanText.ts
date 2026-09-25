export const HUMAN_TEXT_MAX_LENGTH = 120;

export type HumanTextFailureReason = 'empty' | 'tooLong' | 'forbiddenCharacter';

export interface HumanTextOk {
  ok: true;
  value: string;
}

export interface HumanTextFailure {
  ok: false;
  reason: HumanTextFailureReason;
}

export type NormalizeHumanTextResult = HumanTextOk | HumanTextFailure;

// C0, DEL, C1, bidi embeddings/overrides (202A–202E) and isolates (2066–2069).
// eslint-disable-next-line no-control-regex -- control characters are the point
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/;

export function normalizeHumanText(raw: string): NormalizeHumanTextResult {
  const value = raw.trim().normalize('NFC');
  const length = [...value].length;

  if (length < 1) {
    return { ok: false, reason: 'empty' };
  }
  if (length > HUMAN_TEXT_MAX_LENGTH) {
    return { ok: false, reason: 'tooLong' };
  }
  if (FORBIDDEN.test(value)) {
    return { ok: false, reason: 'forbiddenCharacter' };
  }
  return { ok: true, value };
}
