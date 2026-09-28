type TimerHandle = ReturnType<typeof globalThis.setTimeout>;
export declare function createCameraDraggingLifecycle({ setDragging, fallbackMs, schedule, cancel, }: {
    setDragging: (dragging: boolean) => void;
    fallbackMs?: number;
    schedule?: (callback: () => void, delay: number) => TimerHandle;
    cancel?: (timer: TimerHandle) => void;
}): {
    begin: () => void;
    end: () => void;
    scheduleEnd: () => void;
    setPaused: (value: boolean) => void;
};
export {};
//# sourceMappingURL=camera-dragging-lifecycle.d.ts.map