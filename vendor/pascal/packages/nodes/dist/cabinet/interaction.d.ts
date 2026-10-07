import { type AnyNodeId } from '@pascal-app/core';
/** Subscribe to animation start/stop, e.g. for the panel's Play/Stop button. */
export declare function onCabinetAnimationChange(listener: (nodeId: string, running: boolean) => void): () => void;
export declare function isCabinetAnimationRunning(nodeId: AnyNodeId): boolean;
/** Cancel an in-flight animation, committing the current live frame once. */
export declare function stopCabinetAnimation(nodeId: AnyNodeId): void;
export declare function animateCabinetOperationState(nodeId: AnyNodeId, target: 0 | 1): void;
/**
 * E-key interaction: animate toward open when mostly closed, toward closed
 * when mostly open. Pressing E mid-animation reverses from the live frame.
 * On a run, every child module swings together (the run's own
 * `operationState` doesn't pose module doors — each module owns its own).
 */
export declare function toggleCabinetOperationState(nodeId: AnyNodeId): void;
//# sourceMappingURL=interaction.d.ts.map