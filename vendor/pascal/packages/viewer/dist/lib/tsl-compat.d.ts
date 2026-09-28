/**
 * three runs at 0.185 but @types/three is pinned at 0.184: the 0.185 typings
 * make tsgo's type inference allocate unboundedly (microsoft/typescript-go
 * #2125 class) and OOM the machine. r185 renamed directionToColor /
 * colorToDirection to packNormalToRGB / unpackRGBToNormal — re-export the new
 * runtime names under the old names' signatures. Delete this file (and the
 * @types/three pin) once tsgo handles the 0.185 types; the `typeof` references
 * to the removed old names will fail the build as a reminder.
 */
export declare const packNormalToRGB: (node: import("three/webgpu").Node) => import("three/webgpu").Node<"vec3">;
export declare const unpackRGBToNormal: (node: import("three/webgpu").Node) => import("three/webgpu").Node<"vec3">;
//# sourceMappingURL=tsl-compat.d.ts.map