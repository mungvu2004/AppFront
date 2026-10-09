/** BUG-084 â€” dÃ²ng "Hoáº¡t Ä‘á»™ng gáº§n Ä‘Ã¢y": khÃ´ng mÃ£ ná»™i bá»™, má»‘c cÃ³ cáº£ ngÃ y láº«n giá». */
import { describe, expect, it } from 'vitest';

import { formatCalendarDate, formatClockTime } from '@/lib/format/datetime';

import { toActivityRow } from './useUserManagement';

describe('toActivityRow (BUG-084)', () => {
  const at = '2026-09-08T03:57:00.000Z';
  const row = toActivityRow({
    at,
    id: 'act-1',
    kind: 'user.delete',
    objectCode: 'usr_01M4FC7Q8ZK3V9X2T6B5N1R0YD',
    objectLabel: 'e2e-admin@example.test',
  });

  it('hiá»‡n nhÃ£n Ä‘á»c Ä‘Æ°á»£c (email), khÃ´ng hiá»‡n mÃ£ ULID', () => {
    expect(row.objectLabel).toBe('e2e-admin@example.test');
    expect(JSON.stringify(row)).not.toContain('usr_01M4FC');
  });

  it('má»‘c thá»i gian cÃ³ ngÃ y vÃ  giá»', () => {
    expect(row.atLabel).toBe(`${formatCalendarDate(new Date(at))} ${formatClockTime(new Date(at))}`);
    expect(row.atLabel).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/u);
  });
});
