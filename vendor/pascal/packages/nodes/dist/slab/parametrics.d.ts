import { type ParametricDescriptor } from '@pascal-app/core';
import type { SlabNode } from './schema';
/**
 * Inspector descriptor for slab.
 *
 * Mounts the kind-owned `<SlabPanel>` via `customPanel` — the slab
 * editor has shape-specific concerns (elevation presets, area display,
 * holes list with auto-vs-manual provenance) that don't fit the
 * auto-derived field model. `groups` retained as a placeholder for the
 * future when `list` / `computed` / `action` field kinds let this
 * collapse into pure parametrics.
 */
export declare const slabParametrics: ParametricDescriptor<SlabNode>;
//# sourceMappingURL=parametrics.d.ts.map