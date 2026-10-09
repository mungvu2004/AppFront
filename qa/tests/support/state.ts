import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Shared state between phases: `tests/.state/runtime-session.json`.
 *
 * Phase 1 calls {@link resetState} (start of a run), and each phase writes only the fields it owns.
 * The later phases read state through {@link requireState}. When a value is missing they FAIL with a
 * clear message: never invent an id and never fall back to a hard-coded one.
 */
export const STATE_FILE = fileURLToPath(new URL('../.state/runtime-session.json', import.meta.url));
export const ADMIN_STORAGE_STATE_FILE = fileURLToPath(new URL('../.state/admin.storage.json', import.meta.url));

/** A cookie as the browser actually holds it, recorded by Phase 1 from `context.cookies()`. */
export interface SessionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export interface RuntimeState {
  session: {
    cookie: SessionCookie | null;
    /** Only when the app persists a token somewhere readable. If it lives in memory, Phase 1 leaves null and says so. */
    token: string | null;
    storageStatePath: string | null;
  };
  project: { projectId: string | null; projectName: string | null };
  floors: {
    workFloorId: string | null;
    scratchFloorId: string | null;
    workFloorName: string | null;
    scratchFloorName: string | null;
  };
  checkpoints: {
    /** CP-4: `uploadId` from the upload `complete` flow (Phase 3). */
    uploadId: string | null;
    /** CP-5: pipeline finished, "Đã xong N/N tầng" (Phase 3). */
    pipelineComplete: boolean;
    /** CP-6: at least one layer PUT after CP-5, so the AI version row is restorable (Phase 4). */
    restorableVersion: boolean;
  };
  registry: {
    family: string | null;
    /** Recorded by Phase 8 BEFORE activating, so a crashed run can restore it (rule R2). `null` = no active version. */
    originalActiveVersionId: string | null;
    /** true between activate and the verified restore. */
    pendingRestore: boolean;
  };
  updatedAt: string | null;
}

export function emptyState(): RuntimeState {
  return {
    session: { cookie: null, token: null, storageStatePath: null },
    project: { projectId: null, projectName: null },
    floors: { workFloorId: null, scratchFloorId: null, workFloorName: null, scratchFloorName: null },
    checkpoints: { uploadId: null, pipelineComplete: false, restorableVersion: false },
    registry: { family: null, originalActiveVersionId: null, pendingRestore: false },
    updatedAt: null,
  };
}

export function readState(): RuntimeState {
  if (!existsSync(STATE_FILE)) return emptyState();
  const parsed = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Partial<RuntimeState>;
  const base = emptyState();

  return {
    session: { ...base.session, ...parsed.session },
    project: { ...base.project, ...parsed.project },
    floors: { ...base.floors, ...parsed.floors },
    checkpoints: { ...base.checkpoints, ...parsed.checkpoints },
    registry: { ...base.registry, ...parsed.registry },
    updatedAt: parsed.updatedAt ?? null,
  };
}

function writeState(state: RuntimeState): void {
  mkdirSync(dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  renameSync(tmp, STATE_FILE);
}

/** Start of a run (Phase 1 only): drops ids left by an earlier run. Keeps nothing. */
export function resetState(): RuntimeState {
  const fresh = emptyState();
  writeState(fresh);
  return fresh;
}

/** Read, change, write. `mutate` changes the draft in place. */
export function updateState(mutate: (draft: RuntimeState) => void): RuntimeState {
  const draft = readState();
  mutate(draft);
  writeState(draft);
  return readState();
}

/**
 * The value, or a clear FAIL naming what is missing and which phase produces it.
 * Example: `const projectId = requireState((s) => s.project.projectId, 'project.projectId', 'Phase 2');`
 */
export function requireState<T>(
  pick: (state: RuntimeState) => T | null | undefined | false,
  label: string,
  producedBy: string,
): T {
  const value = pick(readState());

  if (value === null || value === undefined || value === false || value === '') {
    throw new Error(
      `Missing required state "${label}" in ${STATE_FILE}. It is produced by ${producedBy}; run that phase first. ` +
        'No fallback id is used.',
    );
  }

  return value;
}
