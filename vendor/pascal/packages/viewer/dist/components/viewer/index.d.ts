import { type AnyNodeId } from '@pascal-app/core';
import { type ThreeElement } from '@react-three/fiber';
import { type ComponentType } from 'react';
import * as THREE from 'three/webgpu';
import type { ColorPreset, RenderShading } from '../../lib/materials';
import { type RenderContext } from '../../store/use-viewer';
import { type HoverStyles } from './post-processing';
declare module '@react-three/fiber' {
    interface ThreeElements {
        lineBasicNodeMaterial: ThreeElement<typeof THREE.LineBasicNodeMaterial>;
    }
}
/**
 * The scene-ready gate's own test as a count — nodes still to build or load
 * (an item holds its mark until its model settles), 1 while the graph has
 * not mounted. A capture waits on it, and reads a count that stops moving
 * as a node no system will ever settle.
 */
export declare function pendingSceneBuildCount(): number;
export interface ViewerImmersiveSession {
    Session: ComponentType<{
        children: React.ReactNode;
    }>;
    Scene: ComponentType<{
        children: React.ReactNode;
    }>;
    onError?: (cause: unknown) => void;
}
interface ViewerProps {
    children?: React.ReactNode;
    hoverStyles?: HoverStyles;
    selectionManager?: 'default' | 'custom';
    perf?: boolean;
    useBvh?: boolean;
    renderContext?: RenderContext;
    transparent?: boolean;
    defaultRender?: {
        shading?: RenderShading;
        textures?: boolean;
        colorPreset?: ColorPreset;
    };
    /**
     * Visibility filter on the live canvas. When non-null, every registered
     * node group whose id is not in `isolate` (or in the isolated set's
     * ancestor / descendant closure) is hidden. Pass `null` (or omit) to
     * clear. Powers the unified preset-capture flow (community modal sets
     * this to the subtree it wants to thumbnail) and is the building block
     * for a future focus-mode UX.
     */
    isolate?: AnyNodeId[] | null;
    /**
     * Host-controlled key for scene readiness. Change it whenever a new scene
     * graph is being loaded; the viewer will report not-ready until the graph is
     * mounted, build systems have had a frame to settle, and one rendered frame
     * has presented the new content.
     */
    sceneReadyKey?: string | number | null;
    onSceneReadyChange?: (ready: boolean) => void;
    /**
     * Called when something in the scene throws while rendering (a node
     * renderer or system, such as a plugin's lazy chunk that failed to load).
     * The scene boundary still renders nothing in its place; this lets a host
     * that must not carry on silently (a bake) fail with its own error.
     */
    onRenderError?: (cause: unknown) => void;
    /**
     * Wall-clock give-up cap for scene readiness, replacing the default
     * frame-count cap. Set it on hosts whose frame cadence is decoupled from
     * real time (the headless bake page's timer-driven loop runs the default
     * 180-frame cap in ~3.6s — shorter than a cold item-model download).
     */
    sceneReadyMaxWaitMs?: number;
    /**
     * Frame cap for the render loop, in frames per second. Defaults to 50, the
     * value the viewer has always used.
     *
     * The viewer runs `frameloop="never"` and advances frames itself through
     * `<FrameLimiter>`, so this cap is the only thing setting the cadence and a
     * host cannot raise it from the outside. Hosts that animate the scene on
     * their own clock — a timeline scrubbing node transforms, a walkthrough
     * camera — are pinned to it and cannot reach display refresh, which reads as
     * judder against a 60Hz+ monitor. Raise it for those; lower it to spare the
     * GPU on a passive or background canvas.
     */
    maxFps?: number;
    /**
     * Skip the TSL post-processing pipeline (SSGI/denoise/ink/outline) and render
     * the scene directly. For headless/capture surfaces (the bake page) where
     * frame quality is irrelevant: on a software-rasterised worker the pipeline
     * consumes the whole CPU budget and bakes time out. Equivalent to the
     * `?disable=postFx` diagnostic URL flag, but host-controlled.
     */
    disablePostFx?: boolean;
    /** Keep the mounted renderer/context warm without advancing scene frames. */
    renderPaused?: boolean;
    /** Host-provided immersive XR session wrappers for the main scene. */
    immersive?: ViewerImmersiveSession;
}
/** Imperative handle exposed via `ref` on `<Viewer>`. */
export type ViewerHandle = {
    /**
     * Apply / clear the same visibility filter as the `isolate` prop. Useful
     * for transient cases (a temporary hover-to-isolate UX) where holding
     * the value in React state would be over-engineering. Passing `null`
     * clears.
     */
    setIsolated(ids: AnyNodeId[] | null): void;
};
declare const Viewer: import("react").ForwardRefExoticComponent<ViewerProps & import("react").RefAttributes<ViewerHandle>>;
export default Viewer;
//# sourceMappingURL=index.d.ts.map