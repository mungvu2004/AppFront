import { z } from 'zod';
export declare const DEFAULT_LEVEL_BASE_ELEVATION = 0;
export declare function normalizeLevelBaseElevation(value: unknown): number;
export declare const LevelNode: z.ZodObject<{
    object: z.ZodDefault<z.ZodLiteral<"node">>;
    name: z.ZodOptional<z.ZodString>;
    parentId: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    visible: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    camera: z.ZodOptional<z.ZodObject<{
        position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
        mode: z.ZodDefault<z.ZodEnum<{
            perspective: "perspective";
            orthographic: "orthographic";
        }>>;
        fov: z.ZodOptional<z.ZodNumber>;
        zoom: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    metadata: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
    provenance: z.ZodOptional<z.ZodObject<{
        refs: z.ZodArray<z.ZodObject<{
            ns: z.ZodOptional<z.ZodString>;
            id: z.ZodString;
            role: z.ZodOptional<z.ZodEnum<{
                primary: "primary";
                piece: "piece";
                absorbed: "absorbed";
                alias: "alias";
                derived: "derived";
            }>>;
        }, z.core.$strip>>;
        lineage: z.ZodOptional<z.ZodObject<{
            op: z.ZodEnum<{
                import: "import";
                split: "split";
                merge: "merge";
                duplicate: "duplicate";
                convert: "convert";
                promote: "promote";
                "make-independent": "make-independent";
                attach: "attach";
            }>;
            fromIds: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    id: z.ZodDefault<z.ZodTemplateLiteral<`level_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"level">>;
    children: z.ZodDefault<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<`block_${string}` | `ceiling_${string}` | `item_${string}` | `procedural-item_${string}` | `column_${string}` | `construction-dimension_${string}` | `wall_${string}` | `roof_${string}` | `slab_${string}` | `fence_${string}` | `structural-grid_${string}` | `imesh_${string}` | `zone_${string}` | `stair_${string}` | `scan_${string}` | `guide_${string}` | `measurement_${string}` | `spawn_${string}` | `shelf_${string}` | `duct-segment_${string}` | `duct-fitting_${string}` | `duct-terminal_${string}` | `hvac-equipment_${string}` | `lineset_${string}` | `liquid-line_${string}` | `pipe-segment_${string}` | `pipe-fitting_${string}` | `pipe-trap_${string}`, string>>>>;
    level: z.ZodDefault<z.ZodNumber>;
    baseElevation: z.ZodDefault<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type LevelNode = z.infer<typeof LevelNode>;
//# sourceMappingURL=level.d.ts.map