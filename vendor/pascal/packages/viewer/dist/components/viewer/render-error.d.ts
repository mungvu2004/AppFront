import type { ReactNode } from 'react';
type RenderErrorHandler = ((cause: unknown) => void) | undefined;
/**
 * One handler that notifies every given handler (the immersive session's and
 * the host's), or undefined when there is none. A handler that throws is
 * logged and does not stop the others.
 */
export declare function composeRenderErrorHandlers(...handlers: RenderErrorHandler[]): RenderErrorHandler;
/**
 * The viewer-scene error boundary: a node renderer or system that throws while
 * rendering renders nothing in its place, and every handler hears about it.
 */
export declare function SceneErrorBoundary({ handlers, children, }: {
    handlers: RenderErrorHandler[];
    children: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=render-error.d.ts.map