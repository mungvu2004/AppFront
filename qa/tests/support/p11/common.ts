/**
 * Phase 11 shared constants (read-only for pack authors; pack helpers go in `support/p11/P<n>.ts`).
 * Web is desktop + tablet only: 1920/1440/1024/768, never 375 or `/m/`.
 */
export const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

export const DESKTOP = { width: 1440, height: 900 } as const;

/** Pool slot for phase 11: unique per spec FILE (`--workers 4` runs files in parallel), e.g. `p11Slot('floors-b')`. */
export const p11Slot = (fileSlug: string): string => `p11-${fileSlug}`;
