import type { ParametricDescriptor } from '@pascal-app/core';
import type { DoorNode } from './schema';
/**
 * Stage E inspector for door. Mounts the kind-owned panel
 * (`panel.tsx`) via `customPanel` — door has 29+ controls (segments,
 * hardware, hinges, panic bar, opening shape, etc.) that can't fit
 * into the generic auto-inspector. The `groups` entries stay populated
 * so the registry still considers door "parametric" (for tooling that
 * lists kinds with editable schema).
 */
export declare const doorParametrics: ParametricDescriptor<DoorNode>;
//# sourceMappingURL=parametrics.d.ts.map