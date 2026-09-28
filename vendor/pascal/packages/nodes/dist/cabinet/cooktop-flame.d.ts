import { BufferGeometry } from 'three';
export declare const COOKTOP_FLAME_COUNT = 22;
export declare const COOKTOP_FLAME_SEG = 12;
export declare const COOKTOP_FLAME_RAD = 5;
export type CooktopFlameSeed = {
    phase: number;
    speed: number;
    height: number;
    reach: number;
};
export declare function cooktopFlameSeed(index: number): CooktopFlameSeed;
export declare function createCooktopFlameGeometry(): BufferGeometry;
export declare function updateCooktopFlameTube(positions: Float32Array, t: number, seed: CooktopFlameSeed, burnerR: number): void;
//# sourceMappingURL=cooktop-flame.d.ts.map