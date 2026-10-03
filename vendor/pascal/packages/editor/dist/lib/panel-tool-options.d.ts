import { type ToolHint } from '@pascal-app/core';
export type PanelToolOption = {
    id: string;
    label: string;
    value: string;
    choices: readonly {
        value: string;
        label: string;
        description?: string;
    }[];
    set: (value: string) => void;
};
export declare function createToolHintsStore(hints: readonly ToolHint[]): {
    subscribe(listener: () => void): () => void;
    getSnapshot: () => string;
};
export declare function useVisibleToolHints(hints?: readonly ToolHint[]): ToolHint[];
export declare function usePanelToolHints(kind: string | null | undefined): ToolHint[];
//# sourceMappingURL=panel-tool-options.d.ts.map