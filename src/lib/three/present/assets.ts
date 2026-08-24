/**
 * Real furniture models, fetched late and never waited for.
 *
 * A `.glb` is the one thing that lifts a room from "blocks" to "a home", and it
 * is also the heaviest thing a route can pull — so this service is built around
 * three refusals:
 *
 * - **It is not in the bundle.** `GLTFLoader` and `DRACOLoader` are imported
 *   inside the parser, on the first call, so a plan with no `modelUrl` on it
 *   never downloads a byte of loader code. The size gate measures every chunk
 *   Vite emits, so "lazy" here means *not emitted into the route chunk*, not
 *   "free".
 * - **It does not hold the room up.** The caller places the procedural piece
 *   first and swaps when the promise settles. A rejection — no URL, a 404, a
 *   parse error, a decoder that is not there — is an ordinary outcome and the
 *   procedural piece simply stays. `placement.ts` owns that swap; this file only
 *   promises an `Object3D` or a reason.
 * - **It does not reach the network itself.** The download goes through the
 *   transport `src/lib/http` hands out, with the `file` timeout that module
 *   already defines for large bodies — the `local/no-fetch-outside-http` rule
 *   is kept by construction, and a test injects a `download` that never opens a
 *   socket.
 *
 * Parsed models are cached by URL and handed out as clones: six chairs from one
 * file are one download, one parse and six light `Object3D` trees sharing
 * geometry and materials.
 */

import type { Object3D } from 'three';

import { createManagedAbortSignal, getPlatformFetch, REQUEST_TIMEOUT_MS } from '@/lib/http';

/* -------------------------------------------------------------------------- */
/* Types.                                                                      */
/* -------------------------------------------------------------------------- */

/** Fetches a model's bytes. Injected in tests; the platform transport in the app. */
export type ModelDownloader = (url: string, signal: AbortSignal) => Promise<ArrayBuffer>;

/** Turns bytes into a scene root. Injected in tests; the lazy GLTF parser in the app. */
export type ModelParser = (bytes: ArrayBuffer, url: string) => Promise<Object3D>;

export interface AssetServiceOptions {
  readonly download?: ModelDownloader;
  readonly parse?: ModelParser;
  /**
   * Where the Draco decoder files are served from (`draco_decoder.wasm` and
   * friends). Without it a Draco-compressed file fails to parse and the piece
   * keeps its procedural fallback — reported, not hidden.
   */
  readonly dracoDecoderPath?: string;
  /** Download timeout; defaults to the http layer's `file` budget. */
  readonly timeoutMs?: number;
}

export interface AssetService {
  /**
   * A fresh clone of the model at `url`, or a rejection saying why not.
   *
   * Rejects with a `RangeError` for an empty URL, an `Error` for a transport
   * or parse failure, and whatever the signal carried for an abort.
   */
  readonly load: (url: string, signal?: AbortSignal) => Promise<Object3D>;
  /** Frees every cached model's geometry, materials and textures. */
  readonly dispose: () => void;
}

/* -------------------------------------------------------------------------- */
/* Defaults.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The platform transport, wrapped in the http layer's managed timeout.
 *
 * `getPlatformFetch` is the sanctioned way to reach the browser's transport;
 * a missing one (a worker, a test) is reported as a rejection rather than a
 * crash, which the caller already treats as "keep the fallback".
 */
export function platformDownloader(timeoutMs = REQUEST_TIMEOUT_MS.file): ModelDownloader {
  return async (url, externalSignal) => {
    const transport = getPlatformFetch();

    if (transport === null) {
      throw new Error('Không có transport mạng để tải mô hình.');
    }

    const managed = createManagedAbortSignal({ externalSignal, timeoutMs });

    try {
      const response = await transport(url, { signal: managed.signal });

      if (!response.ok) {
        throw new Error(`Tải mô hình ${url} thất bại: HTTP ${String(response.status)}.`);
      }

      return await response.arrayBuffer();
    } finally {
      managed.cleanup();
    }
  };
}

/** A loaded GLTF parser: the one method this module calls on it. */
interface LoadedGltfLoader {
  parseAsync: (bytes: ArrayBuffer, path: string) => Promise<{ scene: Object3D }>;
}

/**
 * One loader per decoder path, for the life of the app. A `GLTFLoader` holds
 * no per-mount state, and the `DRACOLoader` behind it stands up workers and a
 * wasm decoder that are never torn down — one per mount was a measured leak
 * of about a quarter megabyte on every visit to the screen.
 */
const sharedLoaders = new Map<string, Promise<LoadedGltfLoader>>();

/**
 * The GLTF parser, imported on first use so the loader code stays out of the
 * route chunk. A decoder path attaches Draco; without one, plain glTF only.
 */
export function gltfParser(dracoDecoderPath?: string): ModelParser {
  const key = dracoDecoderPath ?? '';

  const loader = (): Promise<LoadedGltfLoader> => {
    let promise = sharedLoaders.get(key);
    if (promise === undefined) {
      promise = (async () => {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const gltf = new GLTFLoader();

        if (dracoDecoderPath !== undefined) {
          const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
          const draco = new DRACOLoader();
          draco.setDecoderPath(dracoDecoderPath);
          gltf.setDRACOLoader(draco);
        }

        return gltf;
      })();
      sharedLoaders.set(key, promise);
    }

    return promise;
  };

  return async (bytes) => {
    const { scene } = await (await loader()).parseAsync(bytes, '');
    return scene;
  };
}

/* -------------------------------------------------------------------------- */
/* The service.                                                                */
/* -------------------------------------------------------------------------- */

/** Free what a parsed model holds on the GPU. */
function disposeModel(root: Object3D): void {
  root.traverse((object) => {
    const mesh = object as { geometry?: { dispose(): void }; material?: unknown };

    mesh.geometry?.dispose();

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (typeof material !== 'object' || material === null) {
        continue;
      }
      for (const value of Object.values(material as Record<string, unknown>)) {
        if (isDisposableTexture(value)) {
          value.dispose();
        }
      }
      (material as { dispose(): void }).dispose();
    }
  });
}

function isDisposableTexture(value: unknown): value is { dispose(): void } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { isTexture?: boolean }).isTexture === true &&
    typeof (value as { dispose?: unknown }).dispose === 'function'
  );
}

/** Build a service. Without options it downloads through the platform and parses glTF. */
export function createAssetService(options: AssetServiceOptions = {}): AssetService {
  const download = options.download ?? platformDownloader(options.timeoutMs);
  const parse = options.parse ?? gltfParser(options.dracoDecoderPath);
  const cache = new Map<string, Promise<Object3D>>();

  const fetchModel = async (url: string, signal: AbortSignal): Promise<Object3D> => {
    const bytes = await download(url, signal);
    return parse(bytes, url);
  };

  return {
    load: async (url, signal) => {
      if (url.trim() === '') {
        throw new RangeError('Mô hình không có đường dẫn.');
      }

      let pending = cache.get(url);

      if (pending === undefined) {
        pending = fetchModel(url, signal ?? new AbortController().signal);
        cache.set(url, pending);
        // A failed download must not poison the cache: the next caller retries.
        pending.catch(() => {
          cache.delete(url);
        });
      }

      const root = await pending;
      return root.clone();
    },
    dispose: () => {
      for (const pending of cache.values()) {
        void pending.then(disposeModel).catch(() => undefined);
      }
      cache.clear();
    },
  };
}

/** A service that never loads anything: every request rejects at once. */
export function noAssetService(): AssetService {
  return {
    load: () => Promise.reject(new Error('Không có dịch vụ tải mô hình.')),
    dispose: () => undefined,
  };
}
