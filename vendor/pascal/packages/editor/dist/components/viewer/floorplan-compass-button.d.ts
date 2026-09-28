import type React from 'react';
export type FloorplanCompassButtonProps = {
    northRotationDeg: number;
    onAlignNorth: () => void;
    needleRef?: React.RefObject<SVGSVGElement | null>;
};
export declare function FloorplanCompassButton({ northRotationDeg, onAlignNorth, needleRef, }: FloorplanCompassButtonProps): React.JSX.Element;
//# sourceMappingURL=floorplan-compass-button.d.ts.map