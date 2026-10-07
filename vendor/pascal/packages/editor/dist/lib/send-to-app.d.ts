/**
 * Hand a scene to a desktop app listening on loopback (the Pascal Blender add-on
 * today). The app answers `GET /pascal/health`, accepts a GLB on
 * `POST /pascal/import`, and reports the import on `GET /pascal/import/<id>`.
 * Protocol reference: https://github.com/pascalorg/blender-addon#send-to-blender-from-the-editor
 */
export declare const LOCAL_APP_PORT = 27412;
export declare const LOCAL_APP_PORT_RANGE = 5;
export type LocalAppHealth = {
    app: string;
    version: string;
    addon: string;
    port: number;
    allowed: boolean;
};
export type LocalAppProbe = {
    status: 'listening';
    base: string;
    health: LocalAppHealth;
} | {
    status: 'refused';
    base: string;
    health: LocalAppHealth;
} | {
    status: 'unreachable';
};
export type LocalImportStatus = {
    id: string;
    state: 'queued' | 'done' | 'failed';
    summary?: string;
    error?: string;
};
export declare class LocalAppError extends Error {
    readonly reason: 'refused' | 'rejected' | 'failed' | 'timeout';
    constructor(reason: 'refused' | 'rejected' | 'failed' | 'timeout', message: string);
}
type FetchLike = typeof fetch;
/** Try the app's port and a few after it, one second each. */
export declare function probeLocalApp(fetchImpl?: FetchLike, port?: number, range?: number): Promise<LocalAppProbe>;
export type SendSceneMeta = {
    name?: string;
    projectId?: string;
    version?: string;
};
/** POST the GLB; resolves with the queued import id. */
export declare function sendGlbToLocalApp(base: string, blob: Blob, meta?: SendSceneMeta, fetchImpl?: FetchLike): Promise<LocalImportStatus>;
/** Poll until the app has imported (or failed to import) the queued scene. */
export declare function waitForLocalImport(base: string, id: string, fetchImpl?: FetchLike, { timeoutMs, intervalMs }?: {
    timeoutMs?: number | undefined;
    intervalMs?: number | undefined;
}): Promise<LocalImportStatus>;
export {};
//# sourceMappingURL=send-to-app.d.ts.map