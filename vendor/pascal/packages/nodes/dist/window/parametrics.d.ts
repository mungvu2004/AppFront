import type { ParametricDescriptor } from '@pascal-app/core';
import type { WindowNode } from './schema';
/**
 * Minimal inspector descriptor for window. Like door, the legacy
 * `<WindowPanel>` has 15+ SliderControls covering sashes, dividers,
 * sill, frame, opening shape — too elaborate for the auto-inspector
 * at Stage A. Legacy panel keeps rendering via panel-manager's
 * `case 'window':`.
 */
export declare const windowParametrics: ParametricDescriptor<WindowNode>;
//# sourceMappingURL=parametrics.d.ts.map