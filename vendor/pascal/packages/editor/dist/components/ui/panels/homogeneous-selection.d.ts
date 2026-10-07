import { type AnyNode, type AnyNodeId } from '@pascal-app/core';
/**
 * Resolve selection proxies and drop duplicates / missing ids. Session groups
 * are just selections — mixed-type groups stay mixed after this pass, and a
 * pair of children that both proxy to the same parent collapse to one id.
 */
export declare function resolveUniqueSelectionIds(ids: readonly string[], nodes: Readonly<Record<string, AnyNode | undefined>>): AnyNodeId[];
/**
 * Shared type when every resolved id is the same kind and at least two nodes
 * remain. Otherwise null — including mixed session groups and proxy-collapsed
 * selections that shrink below two distinct nodes.
 */
export declare function resolveHomogeneousSelection(ids: readonly string[], nodes: Readonly<Record<string, AnyNode | undefined>>): AnyNode['type'] | null;
//# sourceMappingURL=homogeneous-selection.d.ts.map