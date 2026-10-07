import { BufferGeometry, Vector2 } from 'three';
import type { CurtainWallPiece } from './curtain-wall-layout';
export declare function buildStraightCurtainPiecesWithCutouts(pieces: readonly CurtainWallPiece[], base: number, cutouts: readonly (readonly Vector2[])[]): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
export declare function buildStraightCurtainPieces(pieces: readonly CurtainWallPiece[], base: number, cullSharedFaces?: boolean): BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>;
//# sourceMappingURL=curtain-wall-piece-geometry.d.ts.map