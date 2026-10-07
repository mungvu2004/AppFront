import { ProceduralItemNode } from '@pascal-app/core/procedural-items';
export declare function ProceduralInspector({ nodeId, partId, onPartChange, }: {
    nodeId: string;
    partId: string | null;
    onPartChange: (id: string | null) => void;
}): import("react").JSX.Element | null;
export default function ProceduralItemPanel({ node }: {
    node: ProceduralItemNode;
}): import("react").JSX.Element;
//# sourceMappingURL=inspector.d.ts.map