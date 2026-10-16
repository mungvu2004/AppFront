/** Phase 08 pool access: every slot goes through `repSlot` so `--repeat-each` copies never share a pool user. */
import type { APIRequestContext } from '@playwright/test';
import { poolUser as basePoolUser, type PoolRole, type PoolUser } from '../phase03Seed';
import { repSlot, repSuffix } from '../evidence';

export * from '../phase03Seed';

/** `repSuffix()` that is '' outside a test (test.info() throws there). */
export const safeSuffix = (): string => {
  try { return repSuffix(); } catch { return ''; }
};
const safeSlot = (slot: string): string => {
  try { return repSlot(slot); } catch { return slot; }
};
export const poolUser = (admin: APIRequestContext, role: PoolRole, slot = 'shared'): Promise<PoolUser> => basePoolUser(admin, role, safeSlot(slot));
