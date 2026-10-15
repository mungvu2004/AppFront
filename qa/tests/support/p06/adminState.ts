import { ADMIN_STORAGE_STATE_FILE } from '../state';

/**
 * Admin storage state for THIS Playwright worker. The refresh cookie rotates on every refresh and the BE revokes the
 * whole session when a rotated token is replayed after its grace window (AppBack auth sessions.py:426-460), so four
 * workers sharing one `admin.storage.json` kill each other's session. One file per parallel slot keeps each chain
 * sequential; a missing file just means `ensureAdminSession` signs in once for that slot.
 */
export const ADMIN_STATE_FILE = ADMIN_STORAGE_STATE_FILE.replace(
  /\.json$/u,
  `.w${process.env.TEST_PARALLEL_INDEX ?? '0'}.json`,
);
