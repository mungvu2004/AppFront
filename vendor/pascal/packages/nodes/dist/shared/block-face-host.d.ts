import { type BlockNode, type BlockTopology } from '@pascal-app/core';
import type { ReactNode } from 'react';
import { Quaternion } from 'three';
type BlockFaceHostTransform = {
    position: [number, number, number];
    quaternion: Quaternion;
};
export declare function resolveBlockFaceHostTransform(host: BlockNode | undefined, liveTopology: BlockTopology | undefined, faceId: string): BlockFaceHostTransform | null;
export declare function BlockFaceHostFrame({ children, blockId, faceId, }: {
    children: ReactNode;
    blockId: string;
    faceId: string;
}): string | number | bigint | boolean | import("react").JSX.Element | Iterable<ReactNode> | Promise<string | number | bigint | boolean | import("react").ReactPortal | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | null | undefined;
export {};
//# sourceMappingURL=block-face-host.d.ts.map