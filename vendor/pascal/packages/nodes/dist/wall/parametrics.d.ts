import type { ParametricDescriptor } from '@pascal-app/core';
import type { WallNode } from './schema';
/**
 * Inspector descriptor for wall.
 *
 * Wall has a few "structural" knobs (thickness, height, curve sagitta) and
 * a few "presentation" knobs (front / back / interior / exterior material
 * presets). Phase 4's `<ParametricInspector>` renders these directly.
 *
 * Endpoints (`start`, `end`) and host children are *not* exposed here —
 * those are edited via affordances (endpoint drag handles) and child
 * placement tools, not number inputs. `parametrics` is for "type a value
 * and see it apply"; spatial manipulation belongs to tools/affordances.
 */
export declare const wallParametrics: ParametricDescriptor<WallNode>;
//# sourceMappingURL=parametrics.d.ts.map