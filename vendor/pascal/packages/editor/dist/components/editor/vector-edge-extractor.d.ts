export type ExtractEdgesRequest = {
    /** Echoed on the `pascal:edges` event so a caller matches its own answer. */
    requestId: string;
    ortho: {
        position: [number, number, number];
        target: [number, number, number];
        viewWidth: number;
    };
    /** width / height of the picture the edges go over. */
    aspect: number;
    hideTypes?: readonly string[];
    /** The depth pass' width in pixels (default 2048). */
    width?: number;
    thresholdDeg?: number;
};
export type ExtractEdgesResult = {
    requestId: string;
    ok: boolean;
    segments?: Float32Array;
    count?: number;
    tested?: number;
    ms?: number;
};
export declare function VectorEdgeExtractor(): null;
//# sourceMappingURL=vector-edge-extractor.d.ts.map