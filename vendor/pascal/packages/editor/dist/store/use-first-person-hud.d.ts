export type WalkthroughInteract = {
    label: string;
    verb: string;
} | null;
export type FirstPersonHudState = {
    floorLabel: string | null;
    zoneLabel: string | null;
    interact: WalkthroughInteract;
    setHud: (hud: Partial<Pick<FirstPersonHudState, 'floorLabel' | 'zoneLabel' | 'interact'>>) => void;
    reset: () => void;
};
export declare const useFirstPersonHud: import("zustand").UseBoundStore<import("zustand").StoreApi<FirstPersonHudState>>;
//# sourceMappingURL=use-first-person-hud.d.ts.map