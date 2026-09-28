import type { Camera, Raycaster } from 'three';
export type EditorThreeContext = {
    camera: Camera;
    raycaster: Raycaster;
    domElement: HTMLCanvasElement;
};
export declare function setEditorThreeContext(ctx: EditorThreeContext | null): void;
export declare function getEditorThreeContext(): EditorThreeContext | null;
//# sourceMappingURL=three-context-bridge.d.ts.map