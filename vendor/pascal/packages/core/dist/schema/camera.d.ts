import { z } from 'zod';
export declare const CameraSchema: z.ZodObject<{
    position: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    target: z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>;
    mode: z.ZodDefault<z.ZodEnum<{
        perspective: "perspective";
        orthographic: "orthographic";
    }>>;
    fov: z.ZodOptional<z.ZodNumber>;
    zoom: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type Camera = z.infer<typeof CameraSchema>;
//# sourceMappingURL=camera.d.ts.map