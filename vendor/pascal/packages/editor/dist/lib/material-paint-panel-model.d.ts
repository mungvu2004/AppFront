export declare function useMaterialPaintPanelModel(enabled?: boolean): {
    activePaintMaterial: import("./material-paint").ActivePaintMaterial | null;
    activePaintTarget: import("./material-paint").PaintableMaterialTarget;
    setActivePaintMaterial: (material?: import("./material-paint").ActivePaintMaterial) => void;
    paintEraser: boolean;
    setPaintEraser: (eraser: boolean) => void;
    materials: Record<`mat_${string}`, {
        id: string;
        name: string;
        material: {
            id?: string | undefined;
            preset?: "custom" | "white" | "brick" | "concrete" | "wood" | "glass" | "metal" | "plaster" | "tile" | "marble" | undefined;
            properties?: {
                color: string;
                roughness: number;
                metalness: number;
                opacity: number;
                transparent: boolean;
                side: "front" | "back" | "double";
            } | undefined;
            texture?: {
                url: string;
                repeat?: [number, number] | undefined;
                scale?: number | undefined;
            } | undefined;
        };
    }>;
    materialCount: number;
    canResetSelection: boolean;
    resetSelection: () => void;
    createCustomMaterial: () => `mat_${string}`;
    selectMaterial: (materialPreset: string) => void;
};
//# sourceMappingURL=material-paint-panel-model.d.ts.map