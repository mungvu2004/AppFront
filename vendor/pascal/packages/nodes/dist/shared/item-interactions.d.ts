import { type AnyNode, useInteractive } from '@pascal-app/core';
type InteractiveState = ReturnType<typeof useInteractive.getState>;
export declare function itemHasMechanisms(node: AnyNode | undefined): boolean;
export declare function itemHasLights(node: AnyNode | undefined): boolean;
export declare function itemMechanismsOn(node: AnyNode, state: InteractiveState): boolean;
export declare function itemLightsOn(node: AnyNode, state: InteractiveState): boolean;
/** Any mechanism running → stop them all, else start them all. */
export declare function toggleItemMechanisms(node: AnyNode): void;
export declare function toggleItemLights(node: AnyNode): void;
export {};
//# sourceMappingURL=item-interactions.d.ts.map