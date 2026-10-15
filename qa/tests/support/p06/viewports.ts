import { verifyUi as baseVerifyUi } from '../ui-verify';

/** Phase 6 runs desktop + tablet only (no phone widths); 1440 first because specs read element 0. */
export const P06_VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
] as const;

/** `verifyUi` whose default widths are `P06_VIEWPORTS`. */
export const verifyUi = (
  page: Parameters<typeof baseVerifyUi>[0],
  name: string,
  open: Parameters<typeof baseVerifyUi>[2],
  viewports: Parameters<typeof baseVerifyUi>[3] = P06_VIEWPORTS,
  shot?: Parameters<typeof baseVerifyUi>[4],
): ReturnType<typeof baseVerifyUi> => baseVerifyUi(page, name, open, viewports, shot);
