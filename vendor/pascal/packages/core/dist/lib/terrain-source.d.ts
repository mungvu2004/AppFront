/**
 * Scene → `TerrainField`, cached.
 *
 * Every consumer that needs the ground — the mesh builder, the raycast, the
 * placement predicate, the collider, the 2D view — starts here. It exists to
 * solve one problem: the scene stores terrain as base64 (`site.terrain`), and
 * decoding that per frame, or per pointer-move, would be absurd.
 *
 * The cache is a `WeakMap` keyed on the **`TerrainData` object identity**, which
 * is a correct version key because the scene store is immutable-by-convention:
 * `updateNode` produces a new node object with a new `terrain` object, so a
 * changed terrain necessarily misses the cache and a stale entry is unreachable.
 * No invalidation call, no version counter, nothing to forget to bump.
 *
 * `commitTerrainField` closes the loop: it encodes a field *and* primes the cache
 * with the field it just encoded. That is what makes a sculpt stroke free — after
 * the commit, the next read is a cache hit, so a stroke never decodes base64 even
 * once, let alone per dab.
 */
import type { SiteNode } from '../schema/nodes/site.js';
import type { TerrainData } from '../schema/terrain.js';
import { createTerrainField, type TerrainField } from './terrain-field.js';
/**
 * The terrain field for a site, or `null` when the site has no sculpted terrain.
 *
 * `null` means flat ground at the datum. It is deliberately not "a flat field":
 * callers use `null` to take their existing flat-ground fast path, which keeps
 * every scene that has never touched terrain — the overwhelming majority —
 * running exactly the code it ran before terrain existed. That property is worth
 * more than the uniformity of always having a field.
 *
 * An in-flight sculpt stroke wins over the persisted data. Resolving that *here*
 * rather than per caller is what makes a stroke consistent: the mesh, the pointer
 * raycast, the placement predicate, the collider, and the 2D view all see the
 * same ground mid-drag without any of them knowing a stroke exists. The
 * alternative — each consumer checking the live store — is how a drag ends up
 * showing a hill the raycast cannot hit.
 */
export declare function terrainFieldOf(site: (Pick<SiteNode, 'terrain'> & {
    id?: string;
}) | null | undefined): TerrainField | null;
export declare function persistedTerrainFieldOf(site: Pick<SiteNode, 'terrain'> | null | undefined): TerrainField | null;
/**
 * The field a site *would* sculpt into: its existing terrain, or a fresh flat
 * field sized to `options`.
 *
 * Separate from `terrainFieldOf` because the read path wants `null` for "no
 * terrain" and the write path wants something to write into. Collapsing them
 * would force every reader to allocate a field it does not need.
 */
export declare function terrainFieldForEdit(site: Pick<SiteNode, 'terrain'> | null | undefined, options?: Parameters<typeof createTerrainField>[0]): TerrainField;
/**
 * Encode a field for persistence and prime the read cache with it.
 *
 * Call this instead of `encodeTerrainField` whenever the result is going into the
 * scene. The returned data is what to write to `site.terrain`; the cache priming
 * means the very next `terrainFieldOf` on the updated node returns this exact
 * field object without decoding.
 */
export declare function commitTerrainField(field: TerrainField): TerrainData;
//# sourceMappingURL=terrain-source.d.ts.map