import { z } from 'zod';
/**
 * Assembly layers (F2, `editor-fidelity-foundations.md` §2.3), frozen by plan
 * item WL-01. A host kind that declares `capabilities.assembly` stores one
 * optional `assembly` field. Roofs take it here; walls move onto it from the
 * WS5 `WallAssembly` in the follow-up migration. Nothing renders it yet, and a
 * node without it keeps today's geometry byte for byte.
 *
 * The stack sets the body (owner ruling 2026-09-27, WS5's rule): a host's
 * thickness is the sum of its body layers, and a writer that edits the layers
 * writes that sum to the host's thickness field in the same patch. Body
 * layers run from the host's reference face inward (walls: the front face, +n,
 * or the exterior face with `face: 'exterior'`; roofs: the covering-top
 * plane). Thickness is measured along the host's `measure` axis. The
 * generators of §2.4 (F3) join this object when F3 lands.
 */
export declare const LayerRole: z.ZodEnum<{
    fill: "fill";
    finish: "finish";
    lining: "lining";
    substrate: "substrate";
    sheathing: "sheathing";
    membrane: "membrane";
    underlay: "underlay";
    insulation: "insulation";
    air: "air";
    furring: "furring";
    structure: "structure";
    deck: "deck";
    covering: "covering";
    shell: "shell";
    glazing: "glazing";
}>;
export type LayerRole = z.infer<typeof LayerRole>;
/**
 * Unique within its host (layers and backing together) and stable across
 * edits: parts, claddings, quantities and the `#layer:<id>` address refer to
 * it. The character set keeps the address grammar unambiguous.
 */
export declare const AssemblyLayerId: z.ZodString;
export declare const AssemblyLayer: z.ZodObject<{
    id: z.ZodString;
    role: z.ZodEnum<{
        fill: "fill";
        finish: "finish";
        lining: "lining";
        substrate: "substrate";
        sheathing: "sheathing";
        membrane: "membrane";
        underlay: "underlay";
        insulation: "insulation";
        air: "air";
        furring: "furring";
        structure: "structure";
        deck: "deck";
        covering: "covering";
        shell: "shell";
        glazing: "glazing";
    }>;
    thickness: z.ZodNumber;
    core: z.ZodOptional<z.ZodLiteral<true>>;
    material: z.ZodOptional<z.ZodString>;
    slot: z.ZodOptional<z.ZodString>;
    returns: z.ZodOptional<z.ZodBoolean>;
    display: z.ZodOptional<z.ZodEnum<{
        construction: "construction";
        finished: "finished";
    }>>;
    inset: z.ZodOptional<z.ZodNumber>;
    bottom: z.ZodOptional<z.ZodNumber>;
    lift: z.ZodOptional<z.ZodNumber>;
    src: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AssemblyLayer = z.infer<typeof AssemblyLayer>;
export declare const Assembly: z.ZodObject<{
    layers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            fill: "fill";
            finish: "finish";
            lining: "lining";
            substrate: "substrate";
            sheathing: "sheathing";
            membrane: "membrane";
            underlay: "underlay";
            insulation: "insulation";
            air: "air";
            furring: "furring";
            structure: "structure";
            deck: "deck";
            covering: "covering";
            shell: "shell";
            glazing: "glazing";
        }>;
        thickness: z.ZodNumber;
        core: z.ZodOptional<z.ZodLiteral<true>>;
        material: z.ZodOptional<z.ZodString>;
        slot: z.ZodOptional<z.ZodString>;
        returns: z.ZodOptional<z.ZodBoolean>;
        display: z.ZodOptional<z.ZodEnum<{
            construction: "construction";
            finished: "finished";
        }>>;
        inset: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        lift: z.ZodOptional<z.ZodNumber>;
        src: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    backing: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        role: z.ZodEnum<{
            fill: "fill";
            finish: "finish";
            lining: "lining";
            substrate: "substrate";
            sheathing: "sheathing";
            membrane: "membrane";
            underlay: "underlay";
            insulation: "insulation";
            air: "air";
            furring: "furring";
            structure: "structure";
            deck: "deck";
            covering: "covering";
            shell: "shell";
            glazing: "glazing";
        }>;
        thickness: z.ZodNumber;
        core: z.ZodOptional<z.ZodLiteral<true>>;
        material: z.ZodOptional<z.ZodString>;
        slot: z.ZodOptional<z.ZodString>;
        returns: z.ZodOptional<z.ZodBoolean>;
        display: z.ZodOptional<z.ZodEnum<{
            construction: "construction";
            finished: "finished";
        }>>;
        inset: z.ZodOptional<z.ZodNumber>;
        bottom: z.ZodOptional<z.ZodNumber>;
        lift: z.ZodOptional<z.ZodNumber>;
        src: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    face: z.ZodOptional<z.ZodEnum<{
        front: "front";
        exterior: "exterior";
    }>>;
    presetId: z.ZodOptional<z.ZodString>;
    cavityInsulation: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Assembly = z.infer<typeof Assembly>;
/** 1 µm, the planar kernel's snap. */
export declare const ASSEMBLY_TOLERANCE = 0.000001;
//# sourceMappingURL=assembly.d.ts.map