import type { ParametricDescriptor } from '@pascal-app/core';
import type { ColumnNode } from './schema';
/**
 * Stage A inspector — minimal. Column has 60+ schema fields (cross-
 * section, shaft profile, capital style, base style, carvings, ring
 * placement, etc.); the legacy `<ColumnPanel>` renders these via
 * panel-manager's hardcoded switch. The descriptor below registers
 * the kind as "has parametric data" without trying to express the
 * full legacy panel — Stage E will replace it via `customPanel`.
 */
export declare const columnParametrics: ParametricDescriptor<ColumnNode>;
//# sourceMappingURL=parametrics.d.ts.map