import { z } from 'zod';
import { MaterialSchema } from '../material.js';
export declare const WallTreatmentSide: z.ZodEnum<{
    interior: "interior";
    exterior: "exterior";
    both: "both";
}>;
export type WallTreatmentSide = z.infer<typeof WallTreatmentSide>;
export declare const WallTrimProfile: z.ZodEnum<{
    flat: "flat";
    bevel: "bevel";
    triangle: "triangle";
    cove: "cove";
    bullnose: "bullnose";
    "base-modern": "base-modern";
    "base-colonial": "base-colonial";
    "base-shoe": "base-shoe";
    "base-ogee": "base-ogee";
    "crown-cove": "crown-cove";
    "crown-ogee": "crown-ogee";
    "crown-craftsman": "crown-craftsman";
    "crown-layered": "crown-layered";
    "rail-rounded": "rail-rounded";
    "rail-ogee": "rail-ogee";
    "rail-picture": "rail-picture";
    "rail-stepped": "rail-stepped";
}>;
export type WallTrimProfile = z.infer<typeof WallTrimProfile>;
export declare const WallTrimConfig: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    sides: z.ZodDefault<z.ZodEnum<{
        interior: "interior";
        exterior: "exterior";
        both: "both";
    }>>;
    height: z.ZodDefault<z.ZodNumber>;
    proud: z.ZodDefault<z.ZodNumber>;
    profile: z.ZodDefault<z.ZodEnum<{
        flat: "flat";
        bevel: "bevel";
        triangle: "triangle";
        cove: "cove";
        bullnose: "bullnose";
        "base-modern": "base-modern";
        "base-colonial": "base-colonial";
        "base-shoe": "base-shoe";
        "base-ogee": "base-ogee";
        "crown-cove": "crown-cove";
        "crown-ogee": "crown-ogee";
        "crown-craftsman": "crown-craftsman";
        "crown-layered": "crown-layered";
        "rail-rounded": "rail-rounded";
        "rail-ogee": "rail-ogee";
        "rail-picture": "rail-picture";
        "rail-stepped": "rail-stepped";
    }>>;
    offsetY: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type WallTrimConfig = z.infer<typeof WallTrimConfig>;
export declare const WALL_SKIRTING_DEFAULT: WallTrimConfig;
export declare const WALL_CROWN_DEFAULT: WallTrimConfig;
export declare const WALL_CHAIR_RAIL_DEFAULT: WallTrimConfig;
export declare const WALL_TRIM_DEFAULTS: {
    readonly skirting: {
        enabled: boolean;
        sides: "interior" | "exterior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    };
    readonly crown: {
        enabled: boolean;
        sides: "interior" | "exterior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    };
    readonly chairRail: {
        enabled: boolean;
        sides: "interior" | "exterior" | "both";
        height: number;
        proud: number;
        profile: "flat" | "bevel" | "triangle" | "cove" | "bullnose" | "base-modern" | "base-colonial" | "base-shoe" | "base-ogee" | "crown-cove" | "crown-ogee" | "crown-craftsman" | "crown-layered" | "rail-rounded" | "rail-ogee" | "rail-picture" | "rail-stepped";
        offsetY?: number | undefined;
    };
};
export declare const WallFaceBandConfig: z.ZodPreprocess<z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    count: z.ZodDefault<z.ZodNumber>;
    lowerHeight: z.ZodDefault<z.ZodNumber>;
    middleHeight: z.ZodDefault<z.ZodNumber>;
    upperHeight: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>, unknown>;
export type WallFaceBandConfig = z.infer<typeof WallFaceBandConfig>;
export declare const WALL_FACE_BAND_DEFAULT: WallFaceBandConfig;
export declare const WALL_SKIRTING_SLOT_DEFAULT = "library:preset-softwhite";
export declare const WALL_CROWN_SLOT_DEFAULT = "library:preset-white";
export declare const WALL_CHAIR_RAIL_SLOT_DEFAULT = "library:preset-cream";
export declare const WALL_FACE_BAND_SOLID_SLOT_DEFAULTS: {
    readonly lower: "library:preset-white";
    readonly middle: "library:preset-lightgrey";
    readonly upper: "library:preset-greige";
    readonly top: "library:preset-softwhite";
};
export declare const WALL_SURFACE_SLOT_DEFAULTS: {
    readonly interior: "library:concrete-drywall";
    readonly exterior: "library:concrete-drywall";
    readonly lowerInterior: "library:concrete-drywall";
    readonly middleInterior: "library:concrete-drywall";
    readonly upperInterior: "library:concrete-drywall";
    readonly topInterior: "library:concrete-drywall";
    readonly lowerExterior: "library:concrete-drywall";
    readonly middleExterior: "library:concrete-drywall";
    readonly upperExterior: "library:concrete-drywall";
    readonly topExterior: "library:concrete-drywall";
    readonly skirtingInterior: "library:preset-softwhite";
    readonly skirtingExterior: "library:preset-softwhite";
    readonly crownInterior: "library:preset-white";
    readonly crownExterior: "library:preset-white";
    readonly chairRailInterior: "library:preset-cream";
    readonly chairRailExterior: "library:preset-cream";
    readonly foundation: "library:concrete-raw";
};
export type WallSurfaceSlotId = keyof typeof WALL_SURFACE_SLOT_DEFAULTS;
/**
 * What a wall carries BELOW its base on a house standing above the ground:
 * `rim` metres of its exterior finish continued down over the floor
 * platform's edge (subfloor, rim joist, mudsill), then the foundation —
 * the concrete stemwall, painted through the `foundation` slot — `stem`
 * metres more to the ground (with `fillToTerrain`, to the terrain wherever
 * that is lower). The wall body, its top and its openings are unchanged,
 * and the framers ignore it (a framing plugin pours its own stemwall
 * from the building's foundation record). `openings` are the holes through the
 * stem — a crawl space's vents and its access (IRC R408) — `u` metres
 * along the wall from its start (the opening's centre), `top` and `bottom`
 * in metres below the wall base.
 */
export declare const WallUnderpinningOpening: z.ZodObject<{
    u: z.ZodNumber;
    width: z.ZodNumber;
    top: z.ZodNumber;
    bottom: z.ZodNumber;
}, z.core.$strip>;
export type WallUnderpinningOpening = z.infer<typeof WallUnderpinningOpening>;
export declare const WallUnderpinning: z.ZodObject<{
    rim: z.ZodNumber;
    stem: z.ZodNumber;
    openings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        u: z.ZodNumber;
        width: z.ZodNumber;
        top: z.ZodNumber;
        bottom: z.ZodNumber;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type WallUnderpinning = z.infer<typeof WallUnderpinning>;
export declare const WallAssemblyExteriorFinish: z.ZodEnum<{
    brick: "brick";
    none: "none";
    siding: "siding";
    stucco: "stucco";
    stone: "stone";
    "fiber-cement": "fiber-cement";
}>;
export type WallAssemblyExteriorFinish = z.infer<typeof WallAssemblyExteriorFinish>;
export declare const WallAssemblySheathingMaterial: z.ZodEnum<{
    none: "none";
    osb: "osb";
    plywood: "plywood";
    gypsum: "gypsum";
}>;
export type WallAssemblySheathingMaterial = z.infer<typeof WallAssemblySheathingMaterial>;
export declare const WallAssemblyFramingKind: z.ZodEnum<{
    wood: "wood";
    lgs: "lgs";
    cmu: "cmu";
    icf: "icf";
}>;
export type WallAssemblyFramingKind = z.infer<typeof WallAssemblyFramingKind>;
export declare const WallAssemblyInteriorFinish: z.ZodEnum<{
    plaster: "plaster";
    none: "none";
    drywall: "drywall";
}>;
export type WallAssemblyInteriorFinish = z.infer<typeof WallAssemblyInteriorFinish>;
export declare const WallAssembly: z.ZodObject<{
    preset: z.ZodOptional<z.ZodString>;
    exterior: z.ZodOptional<z.ZodObject<{
        finish: z.ZodEnum<{
            brick: "brick";
            none: "none";
            siding: "siding";
            stucco: "stucco";
            stone: "stone";
            "fiber-cement": "fiber-cement";
        }>;
        thickness: z.ZodNumber;
    }, z.core.$strip>>;
    sheathing: z.ZodOptional<z.ZodObject<{
        material: z.ZodEnum<{
            none: "none";
            osb: "osb";
            plywood: "plywood";
            gypsum: "gypsum";
        }>;
        thickness: z.ZodNumber;
    }, z.core.$strip>>;
    framing: z.ZodObject<{
        kind: z.ZodEnum<{
            wood: "wood";
            lgs: "lgs";
            cmu: "cmu";
            icf: "icf";
        }>;
        depth: z.ZodNumber;
    }, z.core.$strip>;
    interior: z.ZodOptional<z.ZodObject<{
        finish: z.ZodEnum<{
            plaster: "plaster";
            none: "none";
            drywall: "drywall";
        }>;
        thickness: z.ZodNumber;
    }, z.core.$strip>>;
    cavityInsulation: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type WallAssembly = z.infer<typeof WallAssembly>;
export declare const WallNode: z.ZodObject<{
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
    id: z.ZodDefault<z.ZodTemplateLiteral<`wall_${string}`>>;
    type: z.ZodDefault<z.ZodLiteral<"wall">>;
    wallType: z.ZodOptional<z.ZodEnum<{
        standard: "standard";
        curtain: "curtain";
    }>>;
    curtainWall: z.ZodOptional<z.ZodObject<{
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
    }, z.core.$strip>>;
    children: z.ZodDefault<z.ZodArray<z.ZodUnion<readonly [z.ZodDefault<z.ZodTemplateLiteral<`item_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`procedural-item_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`door_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`window_${string}`>>, z.ZodDefault<z.ZodTemplateLiteral<`leanto_${string}`>>]>>>;
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
    interiorMaterial: z.ZodOptional<z.ZodObject<{
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
    interiorMaterialPreset: z.ZodOptional<z.ZodString>;
    exteriorMaterial: z.ZodOptional<z.ZodObject<{
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
    exteriorMaterialPreset: z.ZodOptional<z.ZodString>;
    slots: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    thickness: z.ZodOptional<z.ZodNumber>;
    assembly: z.ZodOptional<z.ZodObject<{
        preset: z.ZodOptional<z.ZodString>;
        exterior: z.ZodOptional<z.ZodObject<{
            finish: z.ZodEnum<{
                brick: "brick";
                none: "none";
                siding: "siding";
                stucco: "stucco";
                stone: "stone";
                "fiber-cement": "fiber-cement";
            }>;
            thickness: z.ZodNumber;
        }, z.core.$strip>>;
        sheathing: z.ZodOptional<z.ZodObject<{
            material: z.ZodEnum<{
                none: "none";
                osb: "osb";
                plywood: "plywood";
                gypsum: "gypsum";
            }>;
            thickness: z.ZodNumber;
        }, z.core.$strip>>;
        framing: z.ZodObject<{
            kind: z.ZodEnum<{
                wood: "wood";
                lgs: "lgs";
                cmu: "cmu";
                icf: "icf";
            }>;
            depth: z.ZodNumber;
        }, z.core.$strip>;
        interior: z.ZodOptional<z.ZodObject<{
            finish: z.ZodEnum<{
                plaster: "plaster";
                none: "none";
                drywall: "drywall";
            }>;
            thickness: z.ZodNumber;
        }, z.core.$strip>>;
        cavityInsulation: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    height: z.ZodOptional<z.ZodNumber>;
    curveOffset: z.ZodOptional<z.ZodNumber>;
    supportSlabId: z.ZodOptional<z.ZodString>;
    supportOffset: z.ZodOptional<z.ZodNumber>;
    fillToTerrain: z.ZodOptional<z.ZodBoolean>;
    underpinning: z.ZodOptional<z.ZodObject<{
        rim: z.ZodNumber;
        stem: z.ZodNumber;
        openings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            u: z.ZodNumber;
            width: z.ZodNumber;
            top: z.ZodNumber;
            bottom: z.ZodNumber;
        }, z.core.$strip>>>;
    }, z.core.$strip>>;
    faceBands: z.ZodOptional<z.ZodPreprocess<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        count: z.ZodDefault<z.ZodNumber>;
        lowerHeight: z.ZodDefault<z.ZodNumber>;
        middleHeight: z.ZodDefault<z.ZodNumber>;
        upperHeight: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, unknown>>;
    skirting: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sides: z.ZodDefault<z.ZodEnum<{
            interior: "interior";
            exterior: "exterior";
            both: "both";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        proud: z.ZodDefault<z.ZodNumber>;
        profile: z.ZodDefault<z.ZodEnum<{
            flat: "flat";
            bevel: "bevel";
            triangle: "triangle";
            cove: "cove";
            bullnose: "bullnose";
            "base-modern": "base-modern";
            "base-colonial": "base-colonial";
            "base-shoe": "base-shoe";
            "base-ogee": "base-ogee";
            "crown-cove": "crown-cove";
            "crown-ogee": "crown-ogee";
            "crown-craftsman": "crown-craftsman";
            "crown-layered": "crown-layered";
            "rail-rounded": "rail-rounded";
            "rail-ogee": "rail-ogee";
            "rail-picture": "rail-picture";
            "rail-stepped": "rail-stepped";
        }>>;
        offsetY: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    crown: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sides: z.ZodDefault<z.ZodEnum<{
            interior: "interior";
            exterior: "exterior";
            both: "both";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        proud: z.ZodDefault<z.ZodNumber>;
        profile: z.ZodDefault<z.ZodEnum<{
            flat: "flat";
            bevel: "bevel";
            triangle: "triangle";
            cove: "cove";
            bullnose: "bullnose";
            "base-modern": "base-modern";
            "base-colonial": "base-colonial";
            "base-shoe": "base-shoe";
            "base-ogee": "base-ogee";
            "crown-cove": "crown-cove";
            "crown-ogee": "crown-ogee";
            "crown-craftsman": "crown-craftsman";
            "crown-layered": "crown-layered";
            "rail-rounded": "rail-rounded";
            "rail-ogee": "rail-ogee";
            "rail-picture": "rail-picture";
            "rail-stepped": "rail-stepped";
        }>>;
        offsetY: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    chairRail: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        sides: z.ZodDefault<z.ZodEnum<{
            interior: "interior";
            exterior: "exterior";
            both: "both";
        }>>;
        height: z.ZodDefault<z.ZodNumber>;
        proud: z.ZodDefault<z.ZodNumber>;
        profile: z.ZodDefault<z.ZodEnum<{
            flat: "flat";
            bevel: "bevel";
            triangle: "triangle";
            cove: "cove";
            bullnose: "bullnose";
            "base-modern": "base-modern";
            "base-colonial": "base-colonial";
            "base-shoe": "base-shoe";
            "base-ogee": "base-ogee";
            "crown-cove": "crown-cove";
            "crown-ogee": "crown-ogee";
            "crown-craftsman": "crown-craftsman";
            "crown-layered": "crown-layered";
            "rail-rounded": "rail-rounded";
            "rail-ogee": "rail-ogee";
            "rail-picture": "rail-picture";
            "rail-stepped": "rail-stepped";
        }>>;
        offsetY: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    start: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    end: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    frontSide: z.ZodDefault<z.ZodEnum<{
        unknown: "unknown";
        interior: "interior";
        exterior: "exterior";
    }>>;
    backSide: z.ZodDefault<z.ZodEnum<{
        unknown: "unknown";
        interior: "interior";
        exterior: "exterior";
    }>>;
}, z.core.$strip>;
export type WallNode = z.infer<typeof WallNode>;
export type WallSurfaceSide = 'interior' | 'exterior';
export type WallFaceBand = 'lower' | 'middle' | 'upper' | 'top';
export type WallBandSurfaceSlotId = 'lowerInterior' | 'middleInterior' | 'upperInterior' | 'topInterior' | 'lowerExterior' | 'middleExterior' | 'upperExterior' | 'topExterior';
export declare const WALL_SLOT_DEFAULT: Record<WallSurfaceSide, string>;
export declare function getWallFaceBandConfig(wall: Pick<WallNode, 'height' | 'faceBands'>, effectiveWallHeight: number): {
    enabled: boolean;
    count: number;
    lowerHeight: number;
    middleHeight: number;
    upperHeight: number;
    lowerTop: number;
    middleTop: number;
    upperTop: number;
};
export declare function getWallFaceBandForHeight(wall: Pick<WallNode, 'height' | 'faceBands'>, y: number, effectiveWallHeight: number): WallFaceBand;
export declare function getWallBandSlotId(side: WallSurfaceSide, band: WallFaceBand): WallBandSurfaceSlotId;
export declare function buildWallFaceBandCountPatch(wall: Pick<WallNode, 'faceBands' | 'slots'>, count: number): Pick<WallNode, 'faceBands' | 'slots'>;
export declare function buildEnabledWallFaceBandPatch(wall: Pick<WallNode, 'faceBands' | 'slots'>): Pick<WallNode, 'faceBands' | 'slots'>;
export declare function getWallSurfaceSideFromBandSlot(slotId: string): WallSurfaceSide | null;
export type WallSurfaceMaterialSpec = {
    material?: z.infer<typeof MaterialSchema>;
    materialPreset?: string;
};
type WallSurfaceMaterialSource = {
    material?: z.infer<typeof MaterialSchema>;
    materialPreset?: string;
    interiorMaterial?: z.infer<typeof MaterialSchema>;
    interiorMaterialPreset?: string;
    exteriorMaterial?: z.infer<typeof MaterialSchema>;
    exteriorMaterialPreset?: string;
};
export declare function getEffectiveWallSurfaceMaterial(wall: WallSurfaceMaterialSource, side: WallSurfaceSide): WallSurfaceMaterialSpec;
export declare function getWallSurfaceMaterialSignature(spec: WallSurfaceMaterialSpec): string;
export {};
//# sourceMappingURL=wall.d.ts.map