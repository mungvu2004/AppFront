interface AudioState {
    masterVolume: number;
    sfxVolume: number;
    radioVolume: number;
    isRadioPlaying: boolean;
    muted: boolean;
    autoplay: boolean;
    setMasterVolume: (v: number) => void;
    setSfxVolume: (v: number) => void;
    setRadioVolume: (v: number) => void;
    setRadioPlaying: (v: boolean) => void;
    toggleRadioPlaying: () => void;
    toggleMute: () => void;
    setAutoplay: (v: boolean) => void;
}
declare const useAudio: import("zustand").UseBoundStore<Omit<import("zustand").StoreApi<AudioState>, "setState" | "persist"> & {
    setState(partial: AudioState | Partial<AudioState> | ((state: AudioState) => AudioState | Partial<AudioState>), replace?: false | undefined): unknown;
    setState(state: AudioState | ((state: AudioState) => AudioState), replace: true): unknown;
    persist: {
        setOptions: (options: Partial<import("zustand/middleware").PersistOptions<AudioState, AudioState, unknown>>) => void;
        clearStorage: () => void;
        rehydrate: () => Promise<void> | void;
        hasHydrated: () => boolean;
        onHydrate: (fn: (state: AudioState) => void) => () => void;
        onFinishHydration: (fn: (state: AudioState) => void) => () => void;
        getOptions: () => Partial<import("zustand/middleware").PersistOptions<AudioState, AudioState, unknown>>;
    };
}>;
export default useAudio;
//# sourceMappingURL=use-audio.d.ts.map