import { z } from 'zod';
/** Current authoring and decoding ceiling. */
export declare const MAX_TERRAIN_SIDE = 257;
/**
 * The persisted shape of a terrain heightfield.
 *
 * Kept in `schema/` rather than beside the codec because this is the contract
 * the scene graph validates on load, and `lib/terrain-codec.ts` imports the type
 * from here so there is exactly one definition of the wire format.
 *
 * `heights` is base64 of little-endian Int16 — see `lib/terrain-codec.ts` for why
 * that beats a JSON number array, and why it is not compressed. The schema is
 * intentionally loose about the *contents* of that string: validating base64
 * here would duplicate the decoder, and `decodeTerrainField` already returns
 * `null` for anything it cannot read, which is the behaviour a corrupt scene
 * needs (load flat, don't fail the project).
 */
export declare const TerrainData: z.ZodObject<{
    type: z.ZodLiteral<"heightfield">;
    origin: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    spacing: z.ZodNumber;
    cols: z.ZodNumber;
    rows: z.ZodNumber;
    step: z.ZodNumber;
    heights: z.ZodString;
}, z.core.$strip>;
export type TerrainData = z.infer<typeof TerrainData>;
//# sourceMappingURL=terrain.d.ts.map