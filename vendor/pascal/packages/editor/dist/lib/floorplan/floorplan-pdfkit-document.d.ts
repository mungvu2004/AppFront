import type PdfKitDocument from 'pdfkit';
type PdfKitDocumentInstance = InstanceType<typeof PdfKitDocument>;
type PdfTextOptions = {
    align?: 'left' | 'center' | 'right';
    maxWidth?: number;
};
type PdfShapeStyle = 'F' | 'S';
/**
 * The faces every exported PDF embeds. pdfkit's standard 14 fonts are
 * WinAnsi-only: the ≤ ≥ ≈ → △ Δ ⅛ ′ ″ the sheets print came out as byte
 * pairs of the code point ("≤ 195 mph" printed as `"d 195 mph`), and the
 * fonts were not embedded at all. Liberation Sans is metric-compatible with
 * Helvetica, so every width the sheets were laid out against is unchanged;
 * Geist Mono keeps Courier's 0.6 em advance. Both are SIL OFL 1.1 — the
 * licences sit beside the files.
 */
declare const PDF_FONT_FILES: {
    readonly sans: URL;
    readonly 'sans-bold': URL;
    readonly mono: URL;
    readonly 'mono-bold': URL;
};
export type FloorplanPdfFace = keyof typeof PDF_FONT_FILES;
export type FloorplanPdfFonts = Record<FloorplanPdfFace, ArrayBuffer>;
/** The SVG `dominant-baseline` values the floor-plan geometry uses. */
export type FloorplanPdfBaseline = 'auto' | 'alphabetic' | 'middle' | 'central' | 'hanging';
export type FloorplanPdfTextStyle = {
    fontFamily?: string;
    fontWeight?: number | string;
    fontSize: number;
};
/** The embedded faces' bytes, fetched once and shared by every export. */
export declare function loadFloorplanPdfFonts(): Promise<FloorplanPdfFonts>;
/** SVG font-family / font-weight → the embedded face that sets it. */
export declare function resolveFloorplanPdfFace(fontFamily: string | undefined, fontWeight: number | string | undefined): FloorplanPdfFace;
export declare class FloorplanPdfDocument {
    readonly raw: PdfKitDocumentInstance;
    readonly internal: {
        pageSize: {
            getWidth: () => number;
            getHeight: () => number;
        };
    };
    private currentFontSize;
    private currentFace;
    private readonly defaultPageSize;
    private readonly faces;
    private readonly embedded;
    /** `fonts` null sets every face in pdfkit's standard fonts (WinAnsi only). */
    constructor(raw: PdfKitDocumentInstance, defaultPageSize: readonly [number, number], fonts: FloorplanPdfFonts | null);
    addPage(size?: readonly [number, number], _orientation?: 'portrait' | 'landscape'): this;
    setTextColor(color: string): this;
    setDrawColor(color: string): this;
    setFillColor(color: string): this;
    setLineWidth(width: number): this;
    setFont(family: string, weight?: string): this;
    setFontSize(size: number): this;
    getTextWidth(value: string): number;
    splitTextToSize(value: string, maxWidth: number): string[];
    text(value: string | readonly string[], x: number, baselineY: number, options?: PdfTextOptions): this;
    /** The width `drawText` sets `text` at — the same runs, face by face. */
    measureText(text: string, style: FloorplanPdfTextStyle): number;
    /**
     * Native (selectable, searchable) text in the current fill colour, anchored
     * at (x, y) the way SVG anchors it: `anchor` is `text-anchor`, `baseline`
     * is `dominant-baseline`, resolved against the embedded face's metrics.
     */
    drawText(text: string, x: number, y: number, style: FloorplanPdfTextStyle, placement: {
        anchor: 'start' | 'middle' | 'end';
        baseline: FloorplanPdfBaseline;
    }): void;
    line(x1: number, y1: number, x2: number, y2: number): this;
    rect(x: number, y: number, width: number, height: number, style?: PdfShapeStyle): this;
    roundedRect(x: number, y: number, width: number, height: number, radiusX: number, _radiusY: number, style?: PdfShapeStyle): this;
    circle(x: number, y: number, radius: number, style?: PdfShapeStyle): this;
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, style?: PdfShapeStyle): this;
    private setFace;
    private face;
    /** Splits `text` into runs each face can set, plus the symbols drawn as linework. */
    private textRuns;
    private measureRuns;
    private drawRuns;
    private drawSymbol;
}
export declare function createFloorplanPdfDocument(defaultPageSize: readonly [number, number], options?: {
    title?: string;
}): Promise<{
    doc: FloorplanPdfDocument;
    save: (filename: string) => Promise<void>;
}>;
export {};
//# sourceMappingURL=floorplan-pdfkit-document.d.ts.map