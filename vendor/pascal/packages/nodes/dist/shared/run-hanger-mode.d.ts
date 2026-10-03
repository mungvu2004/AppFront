import type { ToolHint } from '@pascal-app/core';
export type RunHangerTool = 'duct-segment' | 'pipe-segment';
type RunHangerModeState = {
    enabled: Record<RunHangerTool, boolean>;
    setEnabled: (tool: RunHangerTool, enabled: boolean) => void;
    toggle: (tool: RunHangerTool) => void;
};
export declare const useRunHangerMode: import("zustand").UseBoundStore<import("zustand").StoreApi<RunHangerModeState>>;
export declare function createRunHangerToolHint(tool: RunHangerTool): ToolHint;
export {};
//# sourceMappingURL=run-hanger-mode.d.ts.map