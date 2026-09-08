/**
 * `S-33` — lịch sử phiên bản. Đường nhập duy nhất của thư mục này.
 *
 * - {@link VersionHistoryContainer} là màn ĐÃ NỐI: một màn khác chỉ cần
 *   `<VersionHistoryContainer projectId floorId />` là mở được, không phải viết thêm một
 *   dòng logic phiên bản nào (R-73).
 * - {@link VersionHistoryRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link VersionHistory} là markup thuần, cho story và test (mục D, R-60).
 * - {@link useVersionHistory} là toàn bộ logic, cho ai muốn dựng một vỏ khác.
 * - {@link createVersionHistoryGateway} là cửa vào DUY NHẤT tới dữ liệu phiên bản.
 *
 * Kiểu công khai có đúng **một** nơi định nghĩa — `./types`, hợp đồng đông cứng của bốn
 * worker viết song song — mà container, view, hook và bộ test cùng nhập; barrel này chỉ tái
 * xuất, không chép lại hình dạng.
 *
 * Ba file anh em của vùng so sánh (`VersionList`, `VersionCompare`, `VersionDiffGroups`,
 * `VersionJsonDiff`, `VersionVisualDiff`) **không** ra khỏi thư mục: chúng là phần con của
 * một màn, không phải component dùng chung, và R-68 cấm màn này dựng component mới cho cả
 * repo dùng.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { VersionHistory } from './VersionHistory';

export { VersionHistoryContainer, VersionHistoryRoute } from './VersionHistory.container';

export { useVersionHistory } from './useVersionHistory';

export { createVersionHistoryGateway, versionsQueryKey } from './versionHistoryGateway';
export type { CreateVersionHistoryGatewayOptions } from './versionHistoryGateway';

export { DIFF_TINT_OPACITY, DIFF_TONE_TOKENS } from './types';
export type {
  CompareModel,
  CompareTabId,
  ConflictNoticeModel,
  DiffCountsModel,
  DiffGroupModel,
  DiffRowModel,
  DiffTone,
  JsonDiffLineModel,
  RestoreConfirmModel,
  RestoreOutcome,
  UseVersionHistoryOptions,
  VersionGroupModel,
  VersionHistoryActions,
  VersionHistoryCapabilities,
  VersionHistoryContainerProps,
  VersionHistoryGateway,
  VersionHistoryModel,
  VersionHistoryOption,
  VersionHistoryProps,
  VersionHistoryResult,
  VersionHistoryToast,
  VersionRowModel,
  VisualDiffModel,
} from './types';
