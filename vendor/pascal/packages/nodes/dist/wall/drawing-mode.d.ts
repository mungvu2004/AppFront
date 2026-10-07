export declare const useWallDrawingMode: import("zustand").UseBoundStore<import("zustand").StoreApi<{
    mode: "line" | "rectangle";
    toggle: () => void;
}>>;
/**
 * R toggles line / rectangle drawing (the HUD's Shape chip cycles the same
 * store). Both wall tools mount this: the 3D tool only exists once the canvas
 * does, and split view mounts both, so one listener serves whichever is up.
 * The mode outlives the tool: re-arming walls resumes the last shape used.
 */
export declare function useWallDrawingModeKeys(): void;
//# sourceMappingURL=drawing-mode.d.ts.map