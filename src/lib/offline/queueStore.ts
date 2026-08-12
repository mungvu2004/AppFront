import { DEAD_LETTER_STORE, openOfflineDb, PENDING_COMMANDS_STORE, type OpenOfflineDbOptions } from './db';
import type { Result } from '@/lib/http/types';

const MAX_PENDING_COMMANDS = 200;
const MAX_PENDING_BYTES = 5 * 1024 * 1024;

export interface PendingCommandInput {
  command: unknown;
  createdAt?: number;
  projectId: string;
}

export interface PendingCommand {
  command: unknown;
  createdAt: number;
  id: number;
  isVolatile: boolean;
  projectId: string;
  sizeBytes: number;
}

export interface DeadLetterCommand extends PendingCommand {
  deadLetterId?: number;
  movedAt: number;
  originalId: number;
  reason: string;
}

export interface QueueMetrics {
  maxPendingBytes: number;
  maxPendingCommands: number;
  pendingBytes: number;
  pendingCommands: number;
}

export interface QueueFullError extends QueueMetrics {
  attemptedBytes: number;
  isVolatile: boolean;
  kind: 'queue-full';
}

export interface QueueStorageError {
  isVolatile: boolean;
  kind: 'queue-storage';
  message: string;
  raw?: unknown;
}

export type QueueStoreError = QueueFullError | QueueStorageError;

export interface QueueStore {
  addPendingCommand(input: PendingCommandInput): Promise<Result<PendingCommand, QueueStoreError>>;
  close(): void;
  deletePendingCommand(id: number): Promise<Result<void, QueueStoreError>>;
  isVolatile: boolean;
  listPendingCommands(projectId: string): Promise<Result<PendingCommand[], QueueStoreError>>;
  moveToDeadLetter(id: number, reason: string): Promise<Result<DeadLetterCommand, QueueStoreError>>;
}

export interface QueueStoreOptions extends OpenOfflineDbOptions {
  now?: () => number;
}

const encoder = new TextEncoder();

const ok = <T>(data: T): Result<T, never> => ({ data, ok: true });

const err = <E>(error: E): Result<never, E> => ({ error, ok: false });

const estimateSizeBytes = (value: unknown): number => encoder.encode(JSON.stringify(value)).byteLength;

const createMetrics = (commands: readonly PendingCommand[]): QueueMetrics => ({
  maxPendingBytes: MAX_PENDING_BYTES,
  maxPendingCommands: MAX_PENDING_COMMANDS,
  pendingBytes: commands.reduce((total, command) => total + command.sizeBytes, 0),
  pendingCommands: commands.length,
});

const createQueueFullError = (
  commands: readonly PendingCommand[],
  attemptedBytes: number,
  isVolatile: boolean,
): QueueFullError => ({
  ...createMetrics(commands),
  attemptedBytes,
  isVolatile,
  kind: 'queue-full',
});

const canAddCommand = (commands: readonly PendingCommand[], attemptedBytes: number): boolean => {
  const metrics = createMetrics(commands);

  return metrics.pendingCommands < MAX_PENDING_COMMANDS && metrics.pendingBytes + attemptedBytes <= MAX_PENDING_BYTES;
};

const toStorageError = (message: string, raw: unknown, isVolatile: boolean): QueueStorageError => ({
  isVolatile,
  kind: 'queue-storage',
  message,
  raw,
});

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });

const getAllCommands = (database: IDBDatabase): Promise<PendingCommand[]> => {
  const transaction = database.transaction(PENDING_COMMANDS_STORE, 'readonly');
  const store = transaction.objectStore(PENDING_COMMANDS_STORE);

  return requestToPromise<PendingCommand[]>(store.getAll());
};

const createIndexedDbQueueStore = (options: QueueStoreOptions): QueueStore => {
  let databasePromise: Promise<Result<IDBDatabase, QueueStorageError>> | null = null;
  let closedDatabase: IDBDatabase | null = null;
  const now = options.now ?? Date.now;

  const openDatabase = async (): Promise<Result<IDBDatabase, QueueStorageError>> => {
    if (!databasePromise) {
      databasePromise = openOfflineDb(options).then((result) => {
        if (!result.ok) {
          return err(toStorageError(result.error.message, result.error.raw, false));
        }

        closedDatabase = result.data;
        return ok(result.data);
      });
    }

    return databasePromise;
  };

  return {
    addPendingCommand: async (input) => {
      try {
        const databaseResult = await openDatabase();

        if (!databaseResult.ok) {
          return databaseResult;
        }

        const currentCommands = await getAllCommands(databaseResult.data);
        const commandWithoutId = {
          command: input.command,
          createdAt: input.createdAt ?? now(),
          isVolatile: false,
          projectId: input.projectId,
        };
        const sizeBytes = estimateSizeBytes(commandWithoutId);

        if (!canAddCommand(currentCommands, sizeBytes)) {
          return err(createQueueFullError(currentCommands, sizeBytes, false));
        }

        const transaction = databaseResult.data.transaction(PENDING_COMMANDS_STORE, 'readwrite');
        const store = transaction.objectStore(PENDING_COMMANDS_STORE);
        const command: Omit<PendingCommand, 'id'> = {
          ...commandWithoutId,
          sizeBytes,
        };
        const id = await requestToPromise<IDBValidKey>(store.add(command));
        await transactionDone(transaction);

        return ok({ ...command, id: Number(id) });
      } catch (error) {
        return err(toStorageError('Unable to add the pending command.', error, false));
      }
    },
    close: () => {
      closedDatabase?.close();
      closedDatabase = null;
      databasePromise = null;
    },
    deletePendingCommand: async (id) => {
      try {
        const databaseResult = await openDatabase();

        if (!databaseResult.ok) {
          return databaseResult;
        }

        const transaction = databaseResult.data.transaction(PENDING_COMMANDS_STORE, 'readwrite');
        const store = transaction.objectStore(PENDING_COMMANDS_STORE);
        await requestToPromise(store.delete(id));
        await transactionDone(transaction);

        return ok(undefined);
      } catch (error) {
        return err(toStorageError('Unable to delete the pending command.', error, false));
      }
    },
    isVolatile: false,
    listPendingCommands: async (projectId) => {
      try {
        const databaseResult = await openDatabase();

        if (!databaseResult.ok) {
          return databaseResult;
        }

        const transaction = databaseResult.data.transaction(PENDING_COMMANDS_STORE, 'readonly');
        const index = transaction.objectStore(PENDING_COMMANDS_STORE).index('projectId');
        const commands = await requestToPromise<PendingCommand[]>(index.getAll(projectId));
        await transactionDone(transaction);

        return ok(commands.sort((first, second) => first.createdAt - second.createdAt));
      } catch (error) {
        return err(toStorageError('Unable to read pending commands.', error, false));
      }
    },
    moveToDeadLetter: async (id, reason) => {
      try {
        const databaseResult = await openDatabase();

        if (!databaseResult.ok) {
          return databaseResult;
        }

        const transaction = databaseResult.data.transaction([PENDING_COMMANDS_STORE, DEAD_LETTER_STORE], 'readwrite');
        const pendingStore = transaction.objectStore(PENDING_COMMANDS_STORE);
        const deadLetterStore = transaction.objectStore(DEAD_LETTER_STORE);
        const command = await requestToPromise<PendingCommand | undefined>(pendingStore.get(id));

        if (!command) {
          return err(toStorageError(`Pending command ${id} was not found.`, undefined, false));
        }

        const deadLetterCommand: DeadLetterCommand = {
          ...command,
          movedAt: now(),
          originalId: command.id,
          reason,
        };

        await requestToPromise(deadLetterStore.add(deadLetterCommand));
        await requestToPromise(pendingStore.delete(id));
        await transactionDone(transaction);

        return ok(deadLetterCommand);
      } catch (error) {
        return err(toStorageError('Unable to move the pending command to dead letter.', error, false));
      }
    },
  };
};

const createMemoryQueueStore = (options: QueueStoreOptions): QueueStore => {
  const now = options.now ?? Date.now;
  let nextId = 1;
  let pendingCommands: PendingCommand[] = [];
  const deadLetterCommands: DeadLetterCommand[] = [];

  return {
    addPendingCommand: async (input) => {
      try {
        const commandWithoutId = {
          command: input.command,
          createdAt: input.createdAt ?? now(),
          isVolatile: true,
          projectId: input.projectId,
        };
        const sizeBytes = estimateSizeBytes(commandWithoutId);

        if (!canAddCommand(pendingCommands, sizeBytes)) {
          return err(createQueueFullError(pendingCommands, sizeBytes, true));
        }

        const command: PendingCommand = {
          ...commandWithoutId,
          id: nextId,
          sizeBytes,
        };

        nextId += 1;
        pendingCommands = [...pendingCommands, command];

        return ok(command);
      } catch (error) {
        return err(toStorageError('Unable to add the pending command.', error, true));
      }
    },
    close: () => undefined,
    deletePendingCommand: async (id) => {
      try {
        pendingCommands = pendingCommands.filter((command) => command.id !== id);

        return ok(undefined);
      } catch (error) {
        return err(toStorageError('Unable to delete the pending command.', error, true));
      }
    },
    isVolatile: true,
    listPendingCommands: async (projectId) => {
      try {
        return ok(
          pendingCommands
            .filter((command) => command.projectId === projectId)
            .sort((first, second) => first.createdAt - second.createdAt),
        );
      } catch (error) {
        return err(toStorageError('Unable to read pending commands.', error, true));
      }
    },
    moveToDeadLetter: async (id, reason) => {
      try {
        const command = pendingCommands.find((pendingCommand) => pendingCommand.id === id);

        if (!command) {
          return err(toStorageError(`Pending command ${id} was not found.`, undefined, true));
        }

        const deadLetterCommand: DeadLetterCommand = {
          ...command,
          deadLetterId: deadLetterCommands.length + 1,
          movedAt: now(),
          originalId: command.id,
          reason,
        };

        deadLetterCommands.push(deadLetterCommand);
        pendingCommands = pendingCommands.filter((pendingCommand) => pendingCommand.id !== id);

        return ok(deadLetterCommand);
      } catch (error) {
        return err(toStorageError('Unable to move the pending command to dead letter.', error, true));
      }
    },
  };
};

export const createQueueStore = (options: QueueStoreOptions = {}): QueueStore => {
  const factory = options.factory ?? globalThis.indexedDB;

  if (!factory) {
    return createMemoryQueueStore(options);
  }

  return createIndexedDbQueueStore(options);
};

const defaultQueueStore = createQueueStore();

export const addPendingCommand = (input: PendingCommandInput): Promise<Result<PendingCommand, QueueStoreError>> =>
  defaultQueueStore.addPendingCommand(input);

export const listPendingCommands = (projectId: string): Promise<Result<PendingCommand[], QueueStoreError>> =>
  defaultQueueStore.listPendingCommands(projectId);

export const deletePendingCommand = (id: number): Promise<Result<void, QueueStoreError>> =>
  defaultQueueStore.deletePendingCommand(id);

export const moveToDeadLetter = (
  id: number,
  reason: string,
): Promise<Result<DeadLetterCommand, QueueStoreError>> => defaultQueueStore.moveToDeadLetter(id, reason);
