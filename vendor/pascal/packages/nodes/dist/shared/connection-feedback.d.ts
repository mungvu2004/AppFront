import type { AnyNodeId } from '@pascal-app/core';
import { type ConnectionProfile } from './connection-compatibility';
import { type ScenePort } from './ports';
export declare function ConnectionFeedback({ point, profile, levelId, target, }: {
    point: [number, number, number] | null;
    profile: ConnectionProfile;
    levelId: AnyNodeId;
    target?: ScenePort | null;
}): import("react").JSX.Element | null;
//# sourceMappingURL=connection-feedback.d.ts.map