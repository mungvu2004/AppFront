import { type AnyNodeId, type SkylightNode } from '@pascal-app/core';
export declare const SKYLIGHT_TOGGLE_ANIMATION_MS = 520;
type SkylightOpenAnimationOptions = {
    persist?: boolean;
};
export declare function isOperableSkylightType(skylightType: string | undefined): skylightType is "opening" | "sliding";
export declare function isOperableSkylightNode(node: SkylightNode): boolean;
export declare function toggleSkylightOpenState(skylightId: AnyNodeId, options?: SkylightOpenAnimationOptions): void;
export declare function closeSkylightOpenState(skylightId: AnyNodeId, options?: SkylightOpenAnimationOptions): void;
export {};
//# sourceMappingURL=interaction.d.ts.map