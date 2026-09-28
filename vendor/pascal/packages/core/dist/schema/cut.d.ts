import { z } from 'zod';
export declare const CutShape: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"polygon">;
    ring: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
}, z.core.$strip>, z.ZodObject<{
    kind: z.ZodLiteral<"circle">;
    center: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
    radius: z.ZodNumber;
}, z.core.$strip>], "kind">;
export type CutShape = z.infer<typeof CutShape>;
export declare const CutIntent: z.ZodObject<{
    host: z.ZodObject<{
        nodeId: z.ZodString;
        surfaceId: z.ZodString;
        partKey: z.ZodOptional<z.ZodTemplateLiteral<`${string}/${string}/${string}`>>;
    }, z.core.$strip>;
    shape: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"polygon">;
        ring: z.ZodArray<z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>>;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"circle">;
        center: z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;
        radius: z.ZodNumber;
    }, z.core.$strip>], "kind">;
    depth: z.ZodUnion<readonly [z.ZodLiteral<"through">, z.ZodNumber]>;
    taper: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type CutIntent = z.infer<typeof CutIntent>;
//# sourceMappingURL=cut.d.ts.map