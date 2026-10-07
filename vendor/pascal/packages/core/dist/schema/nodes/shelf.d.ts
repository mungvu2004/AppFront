import { z } from 'zod';
/**
 * Parametric shelf — a configurable furniture unit with one or more
 * horizontal boards that host other items.
 *
 * Four styles share the same dimensional schema:
 *
 *   - `wall-shelf` — open boards held by end brackets. `rows > 1` stacks
 *     evenly-spaced boards. Brackets style: `minimal | industrial | hidden`.
 *     The v1 archetype.
 *   - `bookshelf` — full-height cabinet: side panels + multiple shelf
 *     boards. `columns > 1` adds vertical dividers between sections.
 *     `withBack` toggles a back panel. `withSides` toggles the side
 *     panels (`false` = open silhouette held by cross-brace posts).
 *   - `open-rack` — industrial wire-rack style: four corner posts, no
 *     side panels, slim boards. `withBack` adds an X-brace.
 *   - `cubby` — grid of pigeonhole cubicles: `rows × columns` cells
 *     formed by full back + sides + inner dividers. Each cubicle hosts
 *     items on its own bottom surface.
 *
 * `height` is the distance from floor to the underside of the topmost
 * board (legacy v1 semantic, preserved so v1 scenes load with identical
 * top-board placement). For `rows > 1`, boards are evenly spaced from
 * `height / rows` up to `height`. For `cubby`, the height divides into
 * `rows` equal-height cubicles.
 *
 * Items host on each row's top surface via `capabilities.surfaces.custom`.
 */
export declare const ShelfNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`shelf_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"shelf">>;
    children: z.ZodDefault<z.ZodArray<z.ZodString>>;
    position: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    rotation: z.ZodDefault<z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    width: z.ZodDefault<z.ZodNumber>;
    depth: z.ZodDefault<z.ZodNumber>;
    thickness: z.ZodDefault<z.ZodNumber>;
    height: z.ZodDefault<z.ZodNumber>;
    style: z.ZodDefault<z.ZodEnum<{
        "wall-shelf": "wall-shelf";
        bookshelf: "bookshelf";
        "open-rack": "open-rack";
        cubby: "cubby";
    }>>;
    rows: z.ZodDefault<z.ZodNumber>;
    columns: z.ZodDefault<z.ZodNumber>;
    withBack: z.ZodDefault<z.ZodBoolean>;
    withSides: z.ZodDefault<z.ZodBoolean>;
    withBottom: z.ZodDefault<z.ZodBoolean>;
    bracketStyle: z.ZodDefault<z.ZodEnum<{
        hidden: "hidden";
        minimal: "minimal";
        industrial: "industrial";
    }>>;
    material: z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        preset: z.ZodOptional<z.ZodCatch<z.ZodEnum<{
            custom: "custom";
            white: "white";
            brick: "brick";
            concrete: "concrete";
            wood: "wood";
            glass: "glass";
            metal: "metal";
            plaster: "plaster";
            tile: "tile";
            marble: "marble";
        }>>>;
        properties: z.ZodOptional<z.ZodObject<{
            color: z.ZodDefault<z.ZodString>;
            roughness: z.ZodDefault<z.ZodNumber>;
            metalness: z.ZodDefault<z.ZodNumber>;
            opacity: z.ZodDefault<z.ZodNumber>;
            transparent: z.ZodDefault<z.ZodBoolean>;
            side: z.ZodDefault<z.ZodEnum<{
                front: "front";
                back: "back";
                double: "double";
            }>>;
        }, z.core.$strip>>;
        texture: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            repeat: z.ZodOptional<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
            scale: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    materialPreset: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strip>;
export type ShelfNode = z.infer<typeof ShelfNode>;
//# sourceMappingURL=shelf.d.ts.map