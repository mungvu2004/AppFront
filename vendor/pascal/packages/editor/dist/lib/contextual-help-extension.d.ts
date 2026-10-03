import type { NodeDefinition } from '@pascal-app/core';
import type { ContextualShortcutHint } from './contextual-help';
export declare const CONTEXTUAL_HELP_NODE_EXTENSION_KEY = "pascal:editor/contextual-help";
export type ContextualHelpNodeExtension = {
    subscribe: (onChange: () => void) => () => void;
    getHints: (nodeId: string) => ContextualShortcutHint[];
};
export declare function getContextualHelpNodeExtension(definition: NodeDefinition<any> | undefined): ContextualHelpNodeExtension | undefined;
//# sourceMappingURL=contextual-help-extension.d.ts.map