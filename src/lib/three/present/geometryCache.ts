/**
 * The assembled geometry, kept in the browser so a plan is baked once.
 *
 * Building a presentation is cheap except for two steps that are pure,
 * deterministic arithmetic over the same inputs every time: baking the
 * ambient occlusion into vertex colours and folding the static meshes into
 * batches — together about two hundred milliseconds of main thread on a
 * modest machine, spent on the first paint of the sign-in screen. This
 * module keeps their *output*: the finished batch geometries, typed arrays
 * and all, in IndexedDB. The next mount builds the raw graph as usual (that
 * part is twenty milliseconds and keeps every tag and position the tests
 * and reports read), skips the bake, and dresses the cached batches straight
 * onto the scene.
 *
 * ## Staleness is decided by the geometry, not by trust
 *
 * A cache entry answers to two locks:
 *
 * - the **key**: a hash of the plan itself and the light budget — a different
 *   drawing is a different entry;
 * - the **fingerprint**: a hash over every static mesh the raw build just
 *   produced — its material role, shadow flags, vertex count, world matrix
 *   and sampled vertices. Change a builder in `pieces/`, a trim constant, the
 *   light budget's outcome — the fingerprint moves and the entry is recomputed
 *   and rewritten, no version constant to remember to bump.
 *
 * Everything degrades to a normal cold build: no IndexedDB, a failed read, a
 * fingerprint miss — the caller bakes as if this module did not exist.
 */

import type { BufferAttribute, InterleavedBufferAttribute } from 'three';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** One finished batch, as data: everything needed to stand the mesh back up. */
export interface CachedBatch {
  /** The material's role name in `SceneMaterials` — resolved at restore time. */
  readonly role: string;
  readonly castShadow: boolean;
  readonly receiveShadow: boolean;
  readonly renderOrder: number;
  readonly index: Uint16Array | Uint32Array;
  readonly attributes: Readonly<Record<string, { readonly array: Float32Array; readonly itemSize: number }>>;
}

/** A whole assembly's static geometry, with the fingerprint that guards it. */
export interface CachedAssembly {
  readonly fingerprint: number;
  readonly batches: readonly CachedBatch[];
}

export interface GeometryCache {
  /** The entry under `key`, or `null` — absent, unreadable, or no IndexedDB. */
  readonly load: (key: string) => Promise<CachedAssembly | null>;
  /** Write an entry; failures are swallowed — a cache that cannot write is a cache that misses. */
  readonly store: (key: string, assembly: CachedAssembly) => Promise<void>;
}

export interface GeometryCacheOptions {
  readonly factory?: IDBFactory;
  readonly name?: string;
}

/* -------------------------------------------------------------------------- */
/* Hashing.                                                                    */
/* -------------------------------------------------------------------------- */

/** FNV-1a over a string, as an unsigned 32-bit number. */
export function hashString(text: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The same mixing over a stream of numbers, quantised so float noise does not thrash it. */
export function hashNumbers(hash: number, values: ArrayLike<number>): number {
  let mixed = hash >>> 0;
  for (let index = 0; index < values.length; index += 1) {
    // Tenth-of-a-millimetre quanta: coarse enough to be stable, fine enough to notice edits.
    const quantised = Math.round((values[index] ?? 0) * 10000);
    mixed ^= (quantised ^ (quantised >>> 16)) >>> 0;
    mixed = Math.imul(mixed, 0x01000193) >>> 0;
  }
  return mixed;
}

/** The cache key for a plan: the drawing and the light budget are the entry's identity. */
export function planCacheKey(plan: unknown, lightBudget: number): string {
  return `plan-${hashString(`${JSON.stringify(plan)}|${lightBudget}`).toString(16)}`;
}

/**
 * Fold one static mesh's shape into a fingerprint: role, flags, size, where
 * it stands, and a sample of its first and last vertices — enough that any
 * edit to a builder moves the number.
 */
export function fingerprintSource(
  hash: number,
  role: string,
  flags: { readonly castShadow: boolean; readonly receiveShadow: boolean; readonly renderOrder: number },
  position: BufferAttribute | InterleavedBufferAttribute,
  matrixElements: ArrayLike<number>,
): number {
  let mixed = hashString(`${role}|${flags.castShadow ? 'c' : ''}${flags.receiveShadow ? 'r' : ''}|${flags.renderOrder}`, hash);
  mixed = hashNumbers(mixed, [position.count]);
  mixed = hashNumbers(mixed, matrixElements);
  const last = position.count - 1;
  mixed = hashNumbers(mixed, [
    position.getX(0),
    position.getY(0),
    position.getZ(0),
    position.getX(last),
    position.getY(last),
    position.getZ(last),
  ]);
  return mixed;
}

/* -------------------------------------------------------------------------- */
/* The store.                                                                  */
/* -------------------------------------------------------------------------- */

const DB_NAME = 'digitwin-presentation';
const DB_VERSION = 1;
const STORE = 'assembledGeometry';

function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onerror = () => {
      resolve(null);
    };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

/** Whether a stored value has the shape this module writes. */
function isCachedAssembly(value: unknown): value is CachedAssembly {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CachedAssembly).fingerprint === 'number' &&
    Array.isArray((value as CachedAssembly).batches)
  );
}

/**
 * A cache over IndexedDB. Every failure path resolves rather than rejects:
 * the caller treats `null` as a cold start and a failed write as weather.
 */
export function createGeometryCache(options: GeometryCacheOptions = {}): GeometryCache {
  const factory = options.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  const name = options.name ?? DB_NAME;

  const withStore = async <T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
    fallback: T,
    read: (request: IDBRequest) => T,
  ): Promise<T> => {
    if (factory === undefined) {
      return fallback;
    }
    const db = await openDb(factory, name);
    if (db === null) {
      return fallback;
    }
    return new Promise<T>((resolve) => {
      try {
        const request = run(db.transaction(STORE, mode).objectStore(STORE));
        request.onerror = () => {
          db.close();
          resolve(fallback);
        };
        request.onsuccess = () => {
          const value = read(request);
          db.close();
          resolve(value);
        };
      } catch {
        db.close();
        resolve(fallback);
      }
    });
  };

  return {
    load: (key) =>
      withStore<CachedAssembly | null>(
        'readonly',
        (store) => store.get(key),
        null,
        (request) => (isCachedAssembly(request.result) ? (request.result as CachedAssembly) : null),
      ),
    store: (key, assembly) =>
      withStore<void>('readwrite', (store) => store.put(assembly, key), undefined, () => undefined),
  };
}
