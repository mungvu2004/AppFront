import type { QuickMeasurementReport } from '@pascal-app/core';
import type { ViewMode } from './use-editor';
export type QuickMeasurementHudSource = '2d' | '3d';
export type QuickMeasurementHudEntry = {
    lensState: 'live' | 'pinned';
    report: QuickMeasurementReport;
};
export type QuickMeasurementHudState = {
    activeSource: QuickMeasurementHudSource | null;
    sources: Record<QuickMeasurementHudSource, QuickMeasurementHudEntry | null>;
    activate(source: QuickMeasurementHudSource): void;
    clear(source: QuickMeasurementHudSource): void;
    publish(source: QuickMeasurementHudSource, entry: QuickMeasurementHudEntry | null): void;
};
export declare const useQuickMeasurementHud: import("zustand").UseBoundStore<import("zustand").StoreApi<QuickMeasurementHudState>>;
export declare function selectQuickMeasurementHudEntry(state: QuickMeasurementHudState, viewMode: ViewMode): QuickMeasurementHudEntry | null;
export declare function activateQuickMeasurementHudSource(source: QuickMeasurementHudSource): void;
export declare function publishQuickMeasurementHudSource(source: QuickMeasurementHudSource, entry: QuickMeasurementHudEntry | null): void;
export declare function clearQuickMeasurementHudSource(source: QuickMeasurementHudSource): void;
//# sourceMappingURL=use-quick-measurement-hud.d.ts.map