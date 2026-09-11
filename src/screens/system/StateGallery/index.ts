/**
 * Màn `ROUTE_PATTERNS.designSystemStates` — duyệt bảy trạng thái của 47 màn
 * (S-47). Đường nhập duy nhất của thư mục này.
 *
 * - {@link StateGalleryRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link StateGalleryContainer} là màn đã nối (ranh giới lỗi + cổng chặn
 *   `isDevelopmentBuild()`), cho một chủ khác muốn nhúng nó.
 * - {@link StateGallery} là markup thuần, cho story và test.
 * - {@link useStateGallery} là tầng logic, cho ai cần tự nối theo cách khác.
 *
 * Mọi kiểu chung sống ở `stateGalleryTypes.ts` — nguồn duy nhất, hợp đồng
 * đóng băng giữa hook/view/test.
 */

export { StateGallery } from './StateGallery';

export { StateGalleryContainer, StateGalleryRoute } from './StateGallery.container';

export { useStateGallery } from './useStateGallery';

export type {
  GalleryCoverage,
  GalleryManifest,
  GalleryScreenEntry,
  QuickCheckCell,
  QuickCheckId,
  QuickCheckRow,
  QuickCheckStatus,
  ReviewToolbarState,
  ScreenCoverage,
  ScreenGroup,
  ScreenGroupId,
  ScreenStateEntry,
  SevenState,
  StateGalleryProps,
} from './stateGalleryTypes';
export { QUICK_CHECK_IDS, SCREEN_GROUP_IDS } from './stateGalleryTypes';
