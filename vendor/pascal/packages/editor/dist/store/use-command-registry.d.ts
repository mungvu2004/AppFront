import type { ReactNode } from 'react';
export type CommandAction = {
    id: string;
    /** Static string or a function evaluated at render time (for reactive labels). */
    label: string | (() => string);
    group: string;
    icon?: ReactNode;
    keywords?: string[];
    shortcut?: string[];
    /** Static string or a function evaluated at render time (for reactive badges). */
    badge?: string | (() => string);
    /** Show a chevron to indicate this action navigates to a sub-page. */
    navigate?: boolean;
    /** Called at render time — returning false disables the item. */
    when?: () => boolean;
    execute: () => void;
};
interface CommandRegistryStore {
    actions: CommandAction[];
    /** Register actions and return an unsubscribe function. */
    register: (actions: CommandAction[]) => () => void;
}
export declare const useCommandRegistry: import("zustand").UseBoundStore<import("zustand").StoreApi<CommandRegistryStore>>;
export {};
//# sourceMappingURL=use-command-registry.d.ts.map