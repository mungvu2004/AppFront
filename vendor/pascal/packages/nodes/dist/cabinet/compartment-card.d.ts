import { type CabinetCompartment } from './stack';
export declare function CompartmentCard({ compartment, index, displayIndex, total, carcassHeight, resolvedHeight, width, onReplace, onResizeHeight, onRemove, onMove, allowHood, wallCabinet, }: {
    compartment: CabinetCompartment;
    index: number;
    displayIndex: number;
    total: number;
    carcassHeight: number;
    resolvedHeight: number;
    width: number;
    onReplace: (next: CabinetCompartment) => void;
    onResizeHeight: (height: number) => void;
    onRemove: () => void;
    onMove: (delta: -1 | 1) => void;
    allowHood?: boolean;
    wallCabinet?: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=compartment-card.d.ts.map