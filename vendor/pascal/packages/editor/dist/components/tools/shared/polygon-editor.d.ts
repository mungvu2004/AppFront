import { type GridEvent } from '@pascal-app/core';
import { type ThreeEvent } from '@react-three/fiber';
type DragState = {
    isDragging: boolean;
    mode: 'vertex' | 'polygon' | 'edge';
    vertexIndex: number | null;
    edgeIndex?: number;
    edgeNormal?: [number, number];
    initialPosition: [number, number];
    initialPolygon: Array<[number, number]>;
    pointerId: number;
};
export type PolygonEditorPlanPointSnapContext = {
    rawPoint: [number, number];
    gridPoint: [number, number];
    mode: DragState['mode'];
    vertexIndex: number | null;
    edgeIndex?: number;
    initialPosition: [number, number];
    initialPolygon: Array<[number, number]>;
    nativeEvent?: GridEvent['nativeEvent'];
};
export interface PolygonEditorProps {
    polygon: Array<[number, number]>;
    color?: string;
    onPolygonChange: (polygon: Array<[number, number]>) => void;
    /**
     * Fires on every drag tick with the in-flight polygon, then once with
     * `null` when the drag commits or is otherwise cleared. Hosts wire
     * this to `useLiveNodeOverrides` so the underlying mesh rebuilds at
     * pointer rate while `onPolygonChange` stays a single store commit
     * on release.
     */
    onPolygonPreview?: (polygon: ReadonlyArray<readonly [number, number]> | null) => void;
    minVertices?: number;
    /** Level ID to mount the editor to. If provided, uses createPortal for automatic level animation following. */
    levelId?: string;
    /** Height of the surface being edited (e.g. slab elevation). Handles adapt to this. */
    surfaceHeight?: number;
    /** Whether to show the center handle that moves the entire polygon. */
    allowPolygonMove?: boolean;
    /** Whether polygon edges can be dragged along their perpendicular normal. */
    allowEdgeMove?: boolean;
    /** Called just before a vertex drag session starts. */
    onBeforeVertexDrag?: (vertexIndex: number, position: [number, number]) => void;
    /** Called when a vertex handle enters or leaves hover. */
    onVertexHoverChange?: (vertexIndex: number | null) => void;
    /** Called when a midpoint add-vertex handle enters or leaves hover. */
    onMidpointHoverChange?: (edgeIndex: number | null) => void;
    /** Called when an edge move handle enters or leaves hover. */
    onEdgeHoverChange?: (edgeIndex: number | null) => void;
    /** Called when any polygon drag starts or ends. */
    onDragStateChange?: (isDragging: boolean) => void;
    /** Called once when a polygon drag starts. */
    onDragStart?: () => void;
    /** Called once when a polygon drag commits on pointer release. */
    onDragCommit?: () => void;
    /** Whether to render the editor-owned polygon outline. */
    showBorderLine?: boolean;
    /** Whether midpoint handles can add new vertices. */
    showMidpointHandles?: boolean;
    /** Whether hovering a handle should also tint its connected edges and endpoint handles. */
    highlightConnectedHandles?: boolean;
    /** Optional host-owned point snapper. Defaults to the existing half-grid snap. */
    resolvePlanPoint?: (context: PolygonEditorPlanPointSnapContext) => [number, number];
    /** Optional vertex handle renderer for host-specific affordances. */
    renderVertexHandle?: PolygonVertexHandleRenderer;
    /** Optional midpoint handle renderer for host-specific add-vertex affordances. */
    renderMidpointHandle?: PolygonMidpointHandleRenderer;
}
type HandleClickHandler = (event: ThreeEvent<MouseEvent>) => void;
type HandlePointerHandler = (event: ThreeEvent<PointerEvent>) => void;
export type PolygonHandleHandlers = {
    onClick?: HandleClickHandler;
    onDoubleClick?: HandleClickHandler;
    onPointerDown?: HandlePointerHandler;
    onPointerEnter?: HandlePointerHandler;
    onPointerLeave?: HandlePointerHandler;
};
export type PolygonVertexHandleRenderProps = {
    canDelete: boolean;
    handleProps: PolygonHandleHandlers;
    height: number;
    index: number;
    isDragging: boolean;
    isHovered: boolean;
    point: [number, number];
    position: [number, number, number];
    radius: number;
};
export type PolygonVertexHandleRenderer = (props: PolygonVertexHandleRenderProps) => React.ReactNode;
export type PolygonMidpointHandleRenderProps = {
    handleProps: PolygonHandleHandlers;
    height: number;
    index: number;
    isHovered: boolean;
    point: [number, number];
    position: [number, number, number];
    radius: number;
};
export type PolygonMidpointHandleRenderer = (props: PolygonMidpointHandleRenderProps) => React.ReactNode;
export declare const PolygonEditor: React.FC<PolygonEditorProps>;
export {};
//# sourceMappingURL=polygon-editor.d.ts.map