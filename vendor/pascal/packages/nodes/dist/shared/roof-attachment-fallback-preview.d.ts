import { type RoofEvent } from '@pascal-app/core';
import { type ReactNode } from 'react';
type ValidTarget = 'roof' | 'gutter';
export declare function RoofAttachmentFallbackPreview({ activeBuildingId, ghost, isValidRoofTarget, lift, onInvalidTarget, size, validTarget, }: {
    activeBuildingId: string | null | undefined;
    ghost?: ReactNode;
    isValidRoofTarget?: (event: RoofEvent) => boolean;
    lift?: number;
    onInvalidTarget?: () => void;
    size?: [number, number, number];
    validTarget?: ValidTarget;
}): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=roof-attachment-fallback-preview.d.ts.map