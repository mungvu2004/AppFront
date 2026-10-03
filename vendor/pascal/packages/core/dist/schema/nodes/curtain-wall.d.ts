import { z } from 'zod';
export declare const CurtainGrid: z.ZodObject<{
    layout: z.ZodDefault<z.ZodEnum<{
        count: "count";
        "maximum-spacing": "maximum-spacing";
        "fixed-spacing": "fixed-spacing";
    }>>;
    count: z.ZodDefault<z.ZodNumber>;
    spacing: z.ZodDefault<z.ZodNumber>;
    alignment: z.ZodDefault<z.ZodEnum<{
        center: "center";
        start: "start";
        end: "end";
    }>>;
}, z.core.$strip>;
export type CurtainGrid = z.infer<typeof CurtainGrid>;
export declare const CurtainPanelType: z.ZodEnum<{
    glass: "glass";
    solid: "solid";
    empty: "empty";
}>;
export type CurtainPanelType = z.infer<typeof CurtainPanelType>;
export declare const CurtainWallConfig: z.ZodObject<{
    construction: z.ZodDefault<z.ZodEnum<{
        stick: "stick";
        unitized: "unitized";
    }>>;
    framing: z.ZodDefault<z.ZodEnum<{
        capped: "capped";
        "vertical-caps": "vertical-caps";
        "horizontal-caps": "horizontal-caps";
        "structural-glazing": "structural-glazing";
    }>>;
    columns: z.ZodPrefault<z.ZodObject<{
        layout: z.ZodDefault<z.ZodEnum<{
            count: "count";
            "maximum-spacing": "maximum-spacing";
            "fixed-spacing": "fixed-spacing";
        }>>;
        count: z.ZodDefault<z.ZodNumber>;
        spacing: z.ZodDefault<z.ZodNumber>;
        alignment: z.ZodDefault<z.ZodEnum<{
            center: "center";
            start: "start";
            end: "end";
        }>>;
    }, z.core.$strip>>;
    rows: z.ZodPrefault<z.ZodObject<{
        layout: z.ZodDefault<z.ZodEnum<{
            count: "count";
            "maximum-spacing": "maximum-spacing";
            "fixed-spacing": "fixed-spacing";
        }>>;
        count: z.ZodDefault<z.ZodNumber>;
        spacing: z.ZodDefault<z.ZodNumber>;
        alignment: z.ZodDefault<z.ZodEnum<{
            center: "center";
            start: "start";
            end: "end";
        }>>;
    }, z.core.$strip>>;
    mullionWidth: z.ZodDefault<z.ZodNumber>;
    transomWidth: z.ZodDefault<z.ZodNumber>;
    perimeterWidth: z.ZodDefault<z.ZodNumber>;
    jointWidth: z.ZodDefault<z.ZodNumber>;
    glassThickness: z.ZodDefault<z.ZodNumber>;
    panelType: z.ZodDefault<z.ZodEnum<{
        glass: "glass";
        solid: "solid";
        empty: "empty";
    }>>;
    spandrel: z.ZodDefault<z.ZodEnum<{
        top: "top";
        none: "none";
        bottom: "bottom";
    }>>;
    frameColor: z.ZodDefault<z.ZodString>;
    glassColor: z.ZodDefault<z.ZodString>;
    solidColor: z.ZodDefault<z.ZodString>;
    glassOpacity: z.ZodDefault<z.ZodNumber>;
    glassRoughness: z.ZodDefault<z.ZodNumber>;
    panels: z.ZodDefault<z.ZodArray<z.ZodObject<{
        column: z.ZodNumber;
        row: z.ZodNumber;
        type: z.ZodEnum<{
            glass: "glass";
            solid: "solid";
            empty: "empty";
        }>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CurtainWallConfig = z.infer<typeof CurtainWallConfig>;
export declare const DEFAULT_CURTAIN_WALL: {
    construction: "stick" | "unitized";
    framing: "capped" | "vertical-caps" | "horizontal-caps" | "structural-glazing";
    columns: {
        layout: "count" | "maximum-spacing" | "fixed-spacing";
        count: number;
        spacing: number;
        alignment: "center" | "start" | "end";
    };
    rows: {
        layout: "count" | "maximum-spacing" | "fixed-spacing";
        count: number;
        spacing: number;
        alignment: "center" | "start" | "end";
    };
    mullionWidth: number;
    transomWidth: number;
    perimeterWidth: number;
    jointWidth: number;
    glassThickness: number;
    panelType: "glass" | "solid" | "empty";
    spandrel: "top" | "none" | "bottom";
    frameColor: string;
    glassColor: string;
    solidColor: string;
    glassOpacity: number;
    glassRoughness: number;
    panels: {
        column: number;
        row: number;
        type: "glass" | "solid" | "empty";
    }[];
};
export declare function getCurtainWallConfig(wall: {
    curtainWall?: CurtainWallConfig;
}): CurtainWallConfig;
//# sourceMappingURL=curtain-wall.d.ts.map