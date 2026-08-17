const PROJECTS_ROOT = '/projects';
const FLOORS_ROOT = '/floors';
const DRAWINGS_ROOT = '/drawings';
const FEATURE_FLAGS_ROOT = '/feature-flags';

export const ENDPOINTS = {
  drawings: {
    chunk: (projectId: string, uploadId: string): string =>
      `${PROJECTS_ROOT}/${projectId}${DRAWINGS_ROOT}/uploads/${uploadId}/chunks`,
    complete: (projectId: string, uploadId: string): string =>
      `${PROJECTS_ROOT}/${projectId}${DRAWINGS_ROOT}/uploads/${uploadId}/complete`,
    initUpload: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}${DRAWINGS_ROOT}/uploads`,
    progress: (projectId: string, uploadId: string): string =>
      `${PROJECTS_ROOT}/${projectId}${DRAWINGS_ROOT}/uploads/${uploadId}/progress`,
  },
  featureFlags: {
    read: FEATURE_FLAGS_ROOT,
  },
  floors: {
    create: FLOORS_ROOT,
    delete: (floorId: string): string => `${FLOORS_ROOT}/${floorId}`,
    list: FLOORS_ROOT,
    reorder: `${FLOORS_ROOT}/reorder`,
  },
  projects: {
    create: PROJECTS_ROOT,
    delete: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
    list: PROJECTS_ROOT,
    read: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
    update: (projectId: string): string => `${PROJECTS_ROOT}/${projectId}`,
  },
  spatial: {
    floor: (projectId: string, floorId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/floors/${floorId}/spatial`,
    version: (projectId: string, versionId: string): string =>
      `${PROJECTS_ROOT}/${projectId}/versions/${versionId}`,
  },
} as const;
