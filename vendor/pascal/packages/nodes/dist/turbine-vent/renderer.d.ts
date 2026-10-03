import { type TurbineVentNode } from '@pascal-app/core';
/**
 * Turbine vent renderer. Reproduces the box-vent transform stack
 * (segment → slope tilt → yaw) so the vent rides whatever roof face it
 * sits on, then adds the one thing no other vent has: the head spins.
 *
 * The mesh is split into a static base (flange + throat) and a head
 * (finned crown + cap + knob) mounted in an inner `<group>` that
 * `useFrame` rotates about its own vertical axis at `node.spinSpeed`
 * rad/s (0 = static). The spin lives entirely below the registered ref
 * group, so the handle frame — read off the registered group — is
 * untouched.
 */
declare const TurbineVentRenderer: ({ node: storeNode }: {
    node: TurbineVentNode;
}) => import("react").JSX.Element | null;
export default TurbineVentRenderer;
//# sourceMappingURL=renderer.d.ts.map