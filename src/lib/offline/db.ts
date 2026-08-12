import type { Result } from '@/lib/http/types';

export const OFFLINE_DB_NAME = 'digitwin-offline';
export const OFFLINE_DB_VERSION = 1;
export const PENDING_COMMANDS_STORE = 'pendingCommands';
export const DEAD_LETTER_STORE = 'deadLetter';

export type OfflineDbErrorKind = 'indexeddb-unavailable' | 'indexeddb-open-failed';

export interface OfflineDbError {
  kind: OfflineDbErrorKind;
  message: string;
  raw?: unknown;
}

export interface OpenOfflineDbOptions {
  factory?: IDBFactory;
  name?: string;
  version?: number;
}

export function migrate(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    if (!db.objectStoreNames.contains(PENDING_COMMANDS_STORE)) {
      const pendingCommands = db.createObjectStore(PENDING_COMMANDS_STORE, {
        autoIncrement: true,
        keyPath: 'id',
      });

      pendingCommands.createIndex('projectId', 'projectId', { unique: false });
      pendingCommands.createIndex('createdAt', 'createdAt', { unique: false });
    }

    if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
      db.createObjectStore(DEAD_LETTER_STORE, {
        autoIncrement: true,
        keyPath: 'deadLetterId',
      });
    }
  }
}

export function openOfflineDb(options: OpenOfflineDbOptions = {}): Promise<Result<IDBDatabase, OfflineDbError>> {
  const factory = options.factory ?? globalThis.indexedDB;

  if (!factory) {
    return Promise.resolve({
      error: {
        kind: 'indexeddb-unavailable',
        message: 'IndexedDB is not available in this runtime.',
      },
      ok: false,
    });
  }

  return new Promise((resolve) => {
    const request = factory.open(options.name ?? OFFLINE_DB_NAME, options.version ?? OFFLINE_DB_VERSION);

    request.onerror = () => {
      resolve({
        error: {
          kind: 'indexeddb-open-failed',
          message: 'Unable to open the offline command database.',
          raw: request.error,
        },
        ok: false,
      });
    };

    request.onupgradeneeded = (event) => {
      migrate(request.result, event.oldVersion);
    };

    request.onsuccess = () => {
      resolve({ data: request.result, ok: true });
    };
  });
}
