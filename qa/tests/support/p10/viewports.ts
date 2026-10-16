/** Phase 10 widths: desktop + tablet only (no 375 / mobile). Pass to `verifyUi(page, name, open, DESKTOP_VIEWPORTS)`. */
export const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;
export const DESKTOP = { width: 1440, height: 900 } as const;
