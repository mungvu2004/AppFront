/**
 * Mode machine for the floating inspector card (`PanelWrapper`).
 *
 * The card is in exactly one of three modes — the two expanded modes are
 * EITHER/OR, never combined:
 *
 * - collapsed: header only;
 * - regular: the node kind's own controls (`children`) — no plugin
 *   inspector-extension sections appended;
 * - extension: ONE plugin inspector-extension's content fills the body
 *   (its own section chrome), the regular controls are hidden.
 *
 * Transitions:
 * - chevron / header press ({@link toggleCard}): collapsed → regular,
 *   regular → collapsed, extension → regular (exit extension mode first,
 *   stay expanded);
 * - extension icon press ({@link toggleExtension}): enters that
 *   extension's mode from anywhere (expanding a folded card); pressing
 *   the ACTIVE extension's icon again returns to regular.
 */
export interface InspectorCardMode {
    /** Card folded to its header. */
    collapsed: boolean;
    /** Extension whose content fills the body; null = regular controls. */
    activeExtensionId: string | null;
}
/** Chevron / header press. */
export declare function toggleCard(mode: InspectorCardMode): InspectorCardMode;
/** Header extension-icon press. */
export declare function toggleExtension(mode: InspectorCardMode, extensionId: string): InspectorCardMode;
/**
 * The extension whose content should fill the card body, or null for the
 * regular controls. A stale `activeExtensionId` (selection changed kind,
 * plugin uninstalled, registry reset) safely falls back to regular mode.
 */
export declare function resolveActiveExtension<E extends {
    id: string;
}>(activeExtensionId: string | null, extensions: readonly E[]): E | null;
//# sourceMappingURL=inspector-card-mode.d.ts.map