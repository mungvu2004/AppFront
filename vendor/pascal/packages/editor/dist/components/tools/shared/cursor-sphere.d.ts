import type { ThreeElements } from '@react-three/fiber';
import { type Group } from 'three';
interface CursorSphereProps extends Omit<ThreeElements['group'], 'ref'> {
    color?: string;
    depthWrite?: boolean;
    showTooltip?: boolean;
    height?: number;
    /**
     * Put the bright marker dot at the TIP of the vertical line (y = height)
     * instead of on the ground ring. Used when the point being placed hangs
     * above the floor (e.g. duct drawn against the ceiling): the dot rides at
     * the cursor / placement point while the line drops to a floor ring that
     * keeps the plan position readable.
     */
    dotAtTip?: boolean;
    /** Custom tooltip content — overrides the auto-detected build tool icon */
    tooltipContent?: React.ReactNode;
}
export declare const CursorSphere: import("react").ForwardRefExoticComponent<CursorSphereProps & import("react").RefAttributes<Group<import("three").Object3DEventMap>>>;
export {};
//# sourceMappingURL=cursor-sphere.d.ts.map