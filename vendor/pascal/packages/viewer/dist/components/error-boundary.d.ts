import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
interface ErrorBoundaryProps {
    children: ReactNode;
    fallback: ReactNode;
    /** Tag for log lines so we can tell which boundary swallowed an error. */
    scope?: string;
    /** Notified once per caught error — lets the host schedule a retry. */
    onError?: (error: Error) => void;
    /** Changing this key clears a caught error and re-mounts `children` — the
     * retry half of `onError` (bump it after clearing whatever failed). */
    resetKey?: unknown;
}
export declare class ErrorBoundary extends Component<ErrorBoundaryProps, {
    hasError: boolean;
}> {
    state: {
        hasError: boolean;
    };
    static getDerivedStateFromError(): {
        hasError: boolean;
    };
    componentDidCatch(error: Error, info: ErrorInfo): void;
    componentDidUpdate(prevProps: ErrorBoundaryProps): void;
    render(): ReactNode;
}
export {};
//# sourceMappingURL=error-boundary.d.ts.map