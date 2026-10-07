import { z } from 'zod';
export declare const SurfaceHoleMetadata: z.ZodObject<{
    source: z.ZodDefault<z.ZodEnum<{
        stair: "stair";
        elevator: "elevator";
        manual: "manual";
    }>>;
    stairId: z.ZodOptional<z.ZodString>;
    elevatorId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SurfaceHoleMetadata = z.infer<typeof SurfaceHoleMetadata>;
//# sourceMappingURL=surface-hole-metadata.d.ts.map