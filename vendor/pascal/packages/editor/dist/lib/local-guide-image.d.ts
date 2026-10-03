import { type AnyNodeId, type GuideNode as GuideNodeType, type ScanNode as ScanNodeType } from '@pascal-app/core';
export declare function getGuideImageName(filename: string): string;
export declare function getScanName(filename: string): string;
export declare function createLocalGuideImage({ createNode, file, levelId, position, }: {
    createNode: (node: GuideNodeType, parentId: AnyNodeId) => void;
    file: File;
    levelId: string;
    position?: [number, number, number];
}): Promise<{
    object: "node";
    parentId: string | null;
    visible: boolean;
    metadata: Record<string, unknown>;
    id: `guide_${string}`;
    type: "guide";
    url: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
    opacity: number;
    scaleReference: {
        start: [number, number];
        end: [number, number];
        realLengthMeters: number;
        measuredLengthUnits: number;
        metersPerUnit: number;
        label: string;
    } | null;
    name?: string | undefined;
    camera?: {
        position: [number, number, number];
        target: [number, number, number];
        mode: "perspective" | "orthographic";
        fov?: number | undefined;
        zoom?: number | undefined;
    } | undefined;
    provenance?: {
        refs: {
            id: string;
            ns?: string | undefined;
            role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
        }[];
        lineage?: {
            op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
            fromIds: string[];
        } | undefined;
    } | undefined;
}>;
export declare function createLocalScan({ createNode, file, levelId, }: {
    createNode: (node: ScanNodeType, parentId: AnyNodeId) => void;
    file: File;
    levelId: string;
}): Promise<{
    scan: {
        object: "node";
        parentId: string | null;
        visible: boolean;
        metadata: Record<string, unknown>;
        id: `scan_${string}`;
        type: "scan";
        url: string | null;
        captureSession: {
            sessionId: string;
            schemaVersion?: number | undefined;
            revisionId?: string | undefined;
            manifestUrl?: string | undefined;
        } | null;
        layers: Record<string, boolean>;
        position: [number, number, number];
        rotation: [number, number, number];
        scale: number;
        opacity: number;
        name?: string | undefined;
        camera?: {
            position: [number, number, number];
            target: [number, number, number];
            mode: "perspective" | "orthographic";
            fov?: number | undefined;
            zoom?: number | undefined;
        } | undefined;
        provenance?: {
            refs: {
                id: string;
                ns?: string | undefined;
                role?: "primary" | "piece" | "absorbed" | "alias" | "derived" | undefined;
            }[];
            lineage?: {
                op: "import" | "split" | "merge" | "duplicate" | "convert" | "promote" | "make-independent" | "attach";
                fromIds: string[];
            } | undefined;
        } | undefined;
    };
    url: string;
}>;
//# sourceMappingURL=local-guide-image.d.ts.map