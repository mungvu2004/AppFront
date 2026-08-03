import viMessages from '@/i18n/vi.json';
import { describe, expect, it } from 'vitest';

import { APP_ERROR_KINDS, APP_ERROR_KIND_CONFIG } from '../kinds';

const expectVietnamese = (value: string): void => {
  expect(value).toMatch(/[À-ỹĐđ]/u);
  expect(value).not.toMatch(/\b(Error|Failed|Invalid)\b/i);
};

const readPath = (value: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value);

describe('errors/kinds.ts', () => {
  it('exposes all 13 error kinds with localized keys', () => {
    expect(APP_ERROR_KINDS).toHaveLength(13);

    for (const kind of APP_ERROR_KINDS) {
      const config = APP_ERROR_KIND_CONFIG[kind];

      expect(config.messageKey).toBe(`errors.${kind}.description`);
      expect(readPath(viMessages, config.titleKey)).toBeTypeOf('string');
      expect(readPath(viMessages, config.messageKey)).toBeTypeOf('string');
      expectVietnamese(String(readPath(viMessages, config.titleKey)));
      expectVietnamese(String(readPath(viMessages, config.messageKey)));
    }

    expectVietnamese(String(readPath(viMessages, 'common.close')));
    expectVietnamese(String(readPath(viMessages, 'common.retry')));
    expectVietnamese(String(readPath(viMessages, 'common.reload')));
    expectVietnamese(String(readPath(viMessages, 'common.contact_admin')));
  });
});
