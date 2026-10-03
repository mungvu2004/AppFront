import type { Color, Node, Vector3 } from 'three/webgpu';
export type SceneAtmosphereSource = {
    skyRadiance(direction: Node<'vec3'>): Node<'vec3'>;
    reflectionRadiance(direction: Node<'vec3'>): Node<'vec3'>;
    fogRadiance(direction: Node<'vec3'>): Node<'vec3'>;
    environmentNode: Node<'vec3'>;
    sunDirection: Vector3;
    sunColor: Color;
    sunIntensity: number;
    moonDirection: Vector3;
    moonColor: Color;
    moonIntensity: number;
    skyColor: Color;
    groundColor: Color;
    hemisphereIntensity: number;
    ambientIntensity: number;
    exposure: number;
    fogStart: number;
    fogEnd: number;
};
/** Returns the atmosphere currently owning this React Three Fiber scene. */
export declare function useSceneAtmosphere(): SceneAtmosphereSource | null;
/**
 * Installs a generic radiance source into the current scene. The source object is
 * expected to remain stable while its colors, vectors, and numbers mutate.
 */
export declare function SceneAtmosphere({ source }: {
    source: SceneAtmosphereSource;
}): null;
//# sourceMappingURL=scene-atmosphere.d.ts.map