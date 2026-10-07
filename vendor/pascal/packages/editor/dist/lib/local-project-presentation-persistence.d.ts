import { type ViewerPresentationContribution } from '@pascal-app/viewer';
export declare const LOCAL_PROJECT_PRESENTATION_STORAGE_KEY_PREFIX = "pascal:project-presentation:v1:";
type PresentationRegistry = {
    getSnapshot: () => readonly ViewerPresentationContribution[];
    subscribe: (onChange: () => void) => () => void;
};
type PresentationStorage = {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
};
type PageHideTarget = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;
export type LocalProjectPresentationPersistence = {
    switchProject: (projectId: string | null) => void;
    flush: () => void;
    dispose: () => void;
};
export type LocalProjectPresentationPersistenceOptions = {
    registry?: PresentationRegistry;
    storage?: PresentationStorage | null;
    pageHideTarget?: PageHideTarget | null;
    flushDelayMs?: number;
};
export declare function getLocalProjectPresentationStorageKey(projectId: string): string;
export declare function createLocalProjectPresentationPersistence(options?: LocalProjectPresentationPersistenceOptions): LocalProjectPresentationPersistence;
export {};
//# sourceMappingURL=local-project-presentation-persistence.d.ts.map