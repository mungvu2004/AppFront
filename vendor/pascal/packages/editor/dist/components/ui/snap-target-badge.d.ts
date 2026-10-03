import type { AnyNode, AssetInput } from '@pascal-app/core';
import type { ReactNode } from 'react';
export type SnapTarget = 'wall' | 'ceiling' | 'roof';
export type SnapTargetBadgeSize = 'tile' | 'tree';
export declare function resolveAssetSnapTarget(attachTo: AssetInput['attachTo']): SnapTarget | null;
export declare function resolveNodeSnapTarget(node: AnyNode | null | undefined): SnapTarget | null;
export declare function SnapTargetBadge({ className, size, target, }: {
    className?: string;
    size?: SnapTargetBadgeSize;
    target: SnapTarget;
}): import("react").JSX.Element;
export declare function SnapTargetIcon({ children, target, }: {
    children: ReactNode;
    target: SnapTarget;
}): import("react").JSX.Element;
//# sourceMappingURL=snap-target-badge.d.ts.map