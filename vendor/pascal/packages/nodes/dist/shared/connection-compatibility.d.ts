import type { NodePort } from '@pascal-app/core';
export type ConnectionProfile = Pick<NodePort, 'system' | 'diameter' | 'shape' | 'width' | 'height'>;
export type ConnectionCompatibility = {
    status: 'match' | 'adapter' | 'incompatible' | 'unknown';
    label: string;
};
export declare function connectionCompatibility(source: ConnectionProfile, target: ConnectionProfile): ConnectionCompatibility;
//# sourceMappingURL=connection-compatibility.d.ts.map