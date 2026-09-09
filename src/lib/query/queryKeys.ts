export type QueryKey = readonly unknown[];

type QueryDomain =
  | 'drawing'
  | 'floor'
  | 'library'
  | 'measurement'
  | 'notification'
  | 'progress'
  | 'project'
  | 'quality'
  | 'room'
  | 'space'
  | 'template'
  | 'user'
  | 'version'
  | 'violation';

type QueryBranch = string;
type QueryBranchRoot = readonly [QueryDomain, QueryBranch];

type QueryKeyFactory<
  TArgs extends readonly unknown[],
  TKey extends QueryKey,
  TRoot extends QueryBranchRoot,
> = ((...args: TArgs) => TKey) & {
  root: () => TRoot;
};

export type QueryKeyOf<TFactory> = TFactory extends (...args: infer TArgs) => infer TKey
  ? TArgs extends readonly unknown[]
    ? TKey extends QueryKey
      ? TKey
      : never
    : never
  : never;

const freezeKey = <const TKey extends QueryKey>(key: TKey): TKey => Object.freeze(key) as TKey;

const createQueryKeyFactory = <
  const TRoot extends QueryBranchRoot,
  const TArgs extends readonly unknown[],
  const TKey extends QueryKey,
>(
  root: TRoot,
  createKey: (...args: TArgs) => TKey,
): QueryKeyFactory<TArgs, TKey, TRoot> =>
  Object.assign((...args: TArgs) => freezeKey(createKey(...args)), {
    root: () => root,
  });

const projectListRoot = freezeKey(['project', 'list'] as const);
const projectDetailRoot = freezeKey(['project', 'detail'] as const);
const projectMembersRoot = freezeKey(['project', 'members'] as const);
const floorListRoot = freezeKey(['floor', 'list'] as const);
const floorDetailRoot = freezeKey(['floor', 'detail'] as const);
const drawingByFloorRoot = freezeKey(['drawing', 'byFloor'] as const);
const progressByFloorRoot = freezeKey(['progress', 'byFloor'] as const);
const spaceByFloorRoot = freezeKey(['space', 'byFloor'] as const);
const qualityAssessmentRoot = freezeKey(['quality', 'assessment'] as const);
const roomByFloorRoot = freezeKey(['room', 'byFloor'] as const);
const templateByProjectRoot = freezeKey(['template', 'byProject'] as const);
const violationByProjectRoot = freezeKey(['violation', 'byProject'] as const);
const versionByFloorRoot = freezeKey(['version', 'byFloor'] as const);
const libraryListRoot = freezeKey(['library', 'list'] as const);
const libraryDetailRoot = freezeKey(['library', 'detail'] as const);
const measurementAllRoot = freezeKey(['measurement', 'all'] as const);
const notificationListRoot = freezeKey(['notification', 'list'] as const);
const userListRoot = freezeKey(['user', 'list'] as const);
const userCurrentRoot = freezeKey(['user', 'current'] as const);
const userMembershipsRoot = freezeKey(['user', 'memberships'] as const);
const userActivityRoot = freezeKey(['user', 'activity'] as const);

export const queryKeys = {
  drawing: {
    byFloor: createQueryKeyFactory(drawingByFloorRoot, (floorId: string) => [...drawingByFloorRoot, floorId] as const),
  },
  floor: {
    detail: createQueryKeyFactory(floorDetailRoot, (floorId: string) => [...floorDetailRoot, floorId] as const),
    list: createQueryKeyFactory(floorListRoot, (projectId: string) => [...floorListRoot, projectId] as const),
  },
  library: {
    detail: createQueryKeyFactory(libraryDetailRoot, (libraryItemId: string) => [
      ...libraryDetailRoot,
      libraryItemId,
    ] as const),
    list: createQueryKeyFactory(libraryListRoot, () => libraryListRoot),
  },
  /**
   * Thông báo của người đang đăng nhập — T-09.
   *
   * Một nhánh duy nhất: `NotificationCenterGateway` (T09-CONTRACT.md mục 0,
   * `notificationModel.ts`) chỉ có một lượt ĐỌC (`list`) — đánh dấu đã đọc và
   * chấp nhận lời mời là hai lượt GHI, khai ở `invalidation.ts`, không phải
   * khoá truy vấn. Không lồng dưới `user`: đây là danh sách của PHIÊN đăng
   * nhập hiện tại chứ không phải hồ sơ một người dùng bất kỳ, và nó đổi theo
   * sự kiện thời gian thực chứ không theo tuần như bảng người dùng — xem bậc
   * `notification` riêng trong `cachePolicy.ts`.
   */
  notification: {
    list: createQueryKeyFactory(notificationListRoot, () => notificationListRoot),
  },
  progress: {
    byFloor: createQueryKeyFactory(progressByFloorRoot, (floorId: string) => [
      ...progressByFloorRoot,
      floorId,
    ] as const),
  },
  project: {
    detail: createQueryKeyFactory(projectDetailRoot, (projectId: string) => [...projectDetailRoot, projectId] as const),
    list: createQueryKeyFactory(projectListRoot, () => projectListRoot),
    members: createQueryKeyFactory(projectMembersRoot, (projectId: string) => [
      ...projectMembersRoot,
      projectId,
    ] as const),
  },
  /**
   * Phép đo chất lượng ảnh của một tầng.
   *
   * Khoá theo `floorId` chứ không theo `uploadId`: câu hỏi là "bản vẽ đang dùng
   * của tầng này tốt tới đâu", và nó vẫn là cùng câu hỏi sau khi người dùng tải
   * lên một lượt khác — xem `ENDPOINTS.quality.assess`. Lượt đọc trả về trạng
   * thái của mọi tầng trong dự án, nên hai tầng khác nhau vẫn là hai khoá khác
   * nhau: mỗi khoá giữ một lượt đọc, và tầng đang xem là thứ phân biệt chúng.
   */
  quality: {
    assessment: createQueryKeyFactory(qualityAssessmentRoot, (floorId: string) => [
      ...qualityAssessmentRoot,
      floorId,
    ] as const),
  },
  room: {
    byFloor: createQueryKeyFactory(roomByFloorRoot, (floorId: string) => [...roomByFloorRoot, floorId] as const),
  },
  space: {
    byFloor: createQueryKeyFactory(spaceByFloorRoot, (floorId: string) => [...spaceByFloorRoot, floorId] as const),
  },
  /**
   * Khuôn mẫu thuộc tính — U4 gap #5. Khoá theo `projectId`, không theo
   * `floorId`: một khuôn mẫu (ví dụ "tường 220 chịu lực") dùng lại được ở MỌI
   * tầng của cùng dự án, đúng phạm vi `scope: 'project'` của
   * `PropertyTemplate` (`src/api/client.ts`).
   */
  template: {
    byProject: createQueryKeyFactory(templateByProjectRoot, (projectId: string) => [
      ...templateByProjectRoot,
      projectId,
    ] as const),
  },
  /**
   * Người dùng — T-04/T-05.
   *
   * `list` và `current` đã nằm ở đây từ trước; `memberships` và `activity` là
   * hai nhánh MỚI của cùng miền `'user'`, không phải một miền `'users'` thứ hai.
   * Lý do cụ thể: `TIER_BY_DOMAIN` (`./cachePolicy.ts`) xếp bậc theo ĐOẠN ĐẦU
   * của khoá, và nó đã có `user: 'static'`. Một miền `'users'` riêng sẽ rơi về
   * bậc `'default'` 30 giây trong im lặng — cùng một bảng người dùng, hai chính
   * sách cache khác nhau, không ai thấy cho tới lúc một màn refetch nhiều gấp
   * mười màn kia. R-71 nói không dựng nguồn thứ hai cho một quyết định đã có
   * chủ; đây là hình dạng cụ thể của luật ấy ở tầng khoá.
   *
   * Cả hai nhánh mới đều khoá theo `userId`: chúng trả lời "người NÀY thuộc
   * những dự án nào" và "người NÀY vừa làm gì", nên hai người dùng là hai lượt
   * đọc tách biệt và làm mất hiệu lực một người không đụng người kia.
   */
  user: {
    activity: createQueryKeyFactory(userActivityRoot, (userId: string) => [...userActivityRoot, userId] as const),
    current: createQueryKeyFactory(userCurrentRoot, () => userCurrentRoot),
    list: createQueryKeyFactory(userListRoot, () => userListRoot),
    memberships: createQueryKeyFactory(userMembershipsRoot, (userId: string) => [
      ...userMembershipsRoot,
      userId,
    ] as const),
  },
  version: {
    byFloor: createQueryKeyFactory(versionByFloorRoot, (floorId: string) => [
      ...versionByFloorRoot,
      floorId,
    ] as const),
  },
  violation: {
    byProject: createQueryKeyFactory(violationByProjectRoot, (projectId: string) => [
      ...violationByProjectRoot,
      projectId,
    ] as const),
  },
} as const;

/**
 * Khoá của danh sách phép đo đã ghim trong một dự án — LG-3 ("lưu số đo kèm
 * dự án làm hồ sơ").
 *
 * Xuất RIÊNG thay vì lồng vào `queryKeys` phía trên: hợp đồng màn đo
 * (CONTRACT.md mục 3, LG-3) chốt đúng chữ ký phẳng `measurementKeys.all(...)`
 * cho `src/lib/mutations` tiêu thụ, và phép đo là thực thể MỚI — không có
 * lượt đọc nào khác của nó cần lồng chung gốc với một nhánh có sẵn. Dùng
 * cùng `createQueryKeyFactory` mà mọi nhánh trong `queryKeys` dùng, nên khoá
 * vẫn đông lạnh và có `root()` cho việc làm mất hiệu lực theo tiền tố.
 */
export const measurementKeys = {
  all: createQueryKeyFactory(measurementAllRoot, (projectId: string) => [
    ...measurementAllRoot,
    projectId,
  ] as const),
};
