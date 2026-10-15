/**
 * Pure (no Playwright) parts of the shared user-pool file, so `tools/check-pool-file.mjs` can run them without a stack.
 * Several Playwright workers (= processes) share ONE pool file: writes are read-merge-write under a lock file, and the
 * rename retries on Windows EPERM/EBUSY/EACCES (a reader holding the target open blocks rename over it).
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const sleepSync = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

export function readJsonFile<T extends object>(file: string): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : ({} as T);
}

/** `renameSync` with up to 10 tries, 50-200 ms apart, on EPERM/EBUSY/EACCES; removes `from` before the final throw. */
export function renameWithRetry(from: string, to: string, tries = 10): void {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= tries || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) {
        rmSync(from, { force: true });
        throw error;
      }
      sleepSync(50 + Math.floor(Math.random() * 150));
    }
  }
}

/** Runs `fn` holding `<file>.lock` (O_EXCL); a lock older than 15 s is stale (dead holder) and removed. */
function withLock<R>(file: string, fn: () => R): R {
  const lock = `${file}.lock`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx'));
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' && (error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > 15_000) rmSync(lock, { force: true });
      } catch {
        /* lock vanished between exists and stat: retry */
      }
      if (Date.now() > deadline) throw new Error(`pool file lock ${lock} busy for 30 s`);
      sleepSync(10 + Math.floor(Math.random() * 30));
    }
  }
  try {
    return fn();
  } finally {
    rmSync(lock, { force: true });
  }
}

/** Merges `changes` into the CURRENT file content (not the copy read earlier in this process) and writes it atomically. */
export function mergeWriteJsonFile<T extends object>(file: string, changes: T): void {
  mkdirSync(dirname(file), { recursive: true });
  withLock(file, () => {
    const tmp = `${file}.${String(process.pid)}.tmp`;
    writeFileSync(tmp, `${JSON.stringify({ ...readJsonFile<T>(file), ...changes }, null, 2)}\n`, 'utf8');
    renameWithRetry(tmp, file);
  });
}

/**
 * `login(user)` once; a 401 means the cached pool password is stale (a password flow changed it and its restore failed),
 * so `refresh()` makes a fresh user for the slot and `login` runs again with it. Any other status is returned as is.
 * `refresh` is `null` when the user has no pool slot (nothing to replace): the 401 is returned unchanged.
 */
export async function loginOrRefresh<U>(
  user: U,
  login: (who: U) => Promise<number>,
  refresh: (() => Promise<U>) | null,
): Promise<{ status: number; user: U }> {
  const status = await login(user);
  if (status !== 401 || refresh === null) return { status, user };
  const fresh = await refresh();
  return { status: await login(fresh), user: fresh };
}

export interface Answer {
  readonly status: number;
  readonly text: string;
}

/**
 * `send()` once; while the answer is 429 RATE_LIMITED, try the next of at most `max` `alternatives` (a thunk returns
 * `null` to skip an unusable inviter). Returns the first answer that is not 429, else the last 429 answer.
 */
export async function inviteWithFallback(
  send: () => Promise<Answer>,
  alternatives: ReadonlyArray<() => Promise<Answer | null>>,
  max = 5,
): Promise<Answer> {
  let answer = await send();
  for (const alternative of alternatives.slice(0, max)) {
    if (answer.status !== 429 || !answer.text.includes('RATE_LIMITED')) break;
    answer = (await alternative()) ?? answer;
  }
  return answer;
}
