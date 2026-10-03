/**
 * The wire format for a `TerrainField`.
 *
 * The scene graph is persisted as JSON (`projects_models.scene_graph`, a jsonb
 * column), so an `Int16Array` cannot be stored directly — `JSON.stringify` turns
 * a typed array into an object with numeric string keys, which round-trips
 * lossily and costs ~7 bytes per sample. This module is the one place the field
 * crosses that boundary.
 *
 * Base64 of little-endian `Int16` was chosen over the alternatives:
 *
 * - **A plain number array** costs 4-6× the bytes and, worse, re-parses into a
 *   `number[]` that every consumer would then have to copy into an `Int16Array`.
 * - **`Array.from(heights)`** has the same problem and silently drops the
 *   quantization invariant: nothing stops a hand-edited scene from putting
 *   `2.5` in the array, and then `isFlatOver`'s integer equality is meaningless.
 * - **Compression** (RLE, deflate) is deliberately *not* here. Imported DEMs are
 *   noisy and compress worst, so a compressed format would fail only on the
 *   messiest scenes — the ones most likely to be real. Chunking (`diffToPatches`)
 *   is the size mitigation, not compression.
 *
 * Byte order is written explicitly via `DataView` rather than relying on
 * `Int16Array`'s platform order. Every realistic platform is little-endian, but
 * the wire format must not depend on that being true of the machine that saved
 * the scene.
 */
import { type TerrainData } from '../schema/terrain.js';
import type { HeightPatch, TerrainField } from './terrain-field.js';
export type EncodedHeightPatch = Omit<HeightPatch, 'heights'> & {
    heights: string;
};
export declare function encodeHeightPatch(patch: HeightPatch): EncodedHeightPatch;
export declare function decodeHeightPatch(value: unknown): HeightPatch | null;
export declare function encodeTerrainField(field: TerrainField): TerrainData;
/**
 * Rebuild a field from persisted data, or `null` if the data is unusable.
 *
 * Returns `null` rather than throwing, and rather than repairing: a scene whose
 * terrain fails to decode must still load (with flat ground) instead of taking
 * the whole project down, and silently substituting a *different* terrain would
 * be worse than showing none. The caller treats `null` as "this site has no
 * terrain".
 *
 * Metadata and payload length are strict. Repairing a truncated payload or
 * inventing missing metadata would silently substitute a different surface.
 */
export declare function decodeTerrainField(data: unknown): TerrainField | null;
/**
 * True when every sample is at the datum — the test for "this field is not worth
 * persisting".
 *
 * Called before writing to the node so an untouched site keeps `terrain:
 * undefined` instead of carrying ~11 KB of base64 zeroes in every saved scene.
 */
export declare function isDatumField(field: TerrainField): boolean;
//# sourceMappingURL=terrain-codec.d.ts.map