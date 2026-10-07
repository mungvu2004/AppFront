import type { ReactNode } from 'react';
interface CommandPaletteStore {
    open: boolean;
    setOpen: (open: boolean) => void;
    /** Current rendering mode. 'command' = normal palette; anything else = registered mode view. */
    mode: string;
    setMode: (mode: string) => void;
    pages: string[];
    inputValue: string;
    setInputValue: (value: string) => void;
    navigateTo: (page: string) => void;
    goBack: () => void;
}
export declare const useCommandPalette: import("zustand").UseBoundStore<import("zustand").StoreApi<CommandPaletteStore>>;
export interface CommandPaletteEmptyAction {
    icon: ReactNode;
    label: (query: string) => string;
    onSelect: (query: string) => void;
}
export declare function CommandPalette({ emptyAction }: {
    emptyAction?: CommandPaletteEmptyAction;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=index.d.ts.map