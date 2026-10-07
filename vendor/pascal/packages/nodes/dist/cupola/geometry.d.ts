import type { CupolaNode } from '@pascal-app/core';
import * as THREE from 'three';
export declare const CUPOLA_MATERIAL_INDEX: {
    readonly base: 0;
    readonly body: 1;
    readonly roof: 2;
    readonly louvers: 3;
};
/**
 * Pure builder for the cupola mesh — a small louvered roof lantern:
 *
 *        ✦            ← finial (post + ball)
 *       /\
 *      /  \           ← roof (dome or pyramid)
 *     /____\
 *    |‖‖‖‖‖‖|          ← louvered body (angled slats on 4 faces)
 *    |‖‖‖‖‖‖|
 *   _|______|_
 *  |__________|        ← base plinth, seats on the roof
 *
 * Built bottom → top from primitive revolves / boxes. Every face is placed
 * through a winding-safe oriented quad/tri, so the whole thing is lit
 * correctly from outside without hand-traced winding.
 *
 * Pure: no React, no scene access, no store mutation. Safe for unit tests,
 * the placement preview, and the move-tool ghost.
 */
export declare function buildCupolaGeometry(node: CupolaNode): THREE.BufferGeometry;
//# sourceMappingURL=geometry.d.ts.map