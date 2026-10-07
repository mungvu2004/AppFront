import { type WallNode } from '@pascal-app/core';
import { ExtrudeGeometry } from 'three';
export declare function buildWallPreviewGeometry(node: Pick<WallNode, 'start' | 'end' | 'curveOffset' | 'height' | 'thickness'>): ExtrudeGeometry;
declare const WallPreview: ({ node }: {
    node: WallNode;
}) => import("react").JSX.Element;
export default WallPreview;
//# sourceMappingURL=preview.d.ts.map