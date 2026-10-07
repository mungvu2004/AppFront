import type { TerrainVerb } from '@pascal-app/core';
/**
 * SFX-specific events that tools can trigger
 */
type SFXEvents = {
    'sfx:grid-snap': undefined;
    'sfx:item-delete': undefined;
    'sfx:item-pick': undefined;
    'sfx:item-place': undefined;
    'sfx:item-rotate': undefined;
    'sfx:resize': undefined;
    'sfx:structure-build-start': undefined;
    'sfx:structure-build': undefined;
    'sfx:structure-delete': undefined;
    'sfx:snapshot-capture': undefined;
    'sfx:menu-hover': undefined;
    'sfx:menu-click': undefined;
    'sfx:paint-apply': undefined;
    'sfx:success': undefined;
    'sfx:terrain-sculpt-start': TerrainVerb;
    'sfx:terrain-sculpt-stop': undefined;
};
type TriggerSFXEvent = {
    [Event in keyof SFXEvents]: SFXEvents[Event] extends undefined ? Event : never;
}[keyof SFXEvents];
/**
 * Dedicated event emitter for SFX
 * Tools should use this to trigger sound effects
 */
export declare const sfxEmitter: import("mitt").Emitter<SFXEvents>;
/**
 * Initialize SFX Bus - connects SFX events to actual sound playback.
 * Safe to call multiple times; re-registration is a no-op once initialized.
 */
export declare function initSFXBus(): void;
export declare function disposeSFXBus(): void;
/**
 * Helper function to trigger SFX events from tools
 * @example
 * triggerSFX('sfx:item-place')
 */
export declare function triggerSFX(event: TriggerSFXEvent): void;
/**
 * Emit the delete SFX appropriate for a deleted node's type.
 */
export declare function emitDeleteSFX(nodeType: string | undefined): void;
export {};
//# sourceMappingURL=sfx-bus.d.ts.map