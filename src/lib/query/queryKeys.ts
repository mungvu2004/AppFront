export type QueryKey = readonly unknown[];

type QueryDomain =
  | 'drawing'
  | 'floor'
  | 'library'
  | 'progress'
  | 'project'
  | 'room'
  | 'space'
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
const roomByFloorRoot = freezeKey(['room', 'byFloor'] as const);
const violationByProjectRoot = freezeKey(['violation', 'byProject'] as const);
const versionByFloorRoot = freezeKey(['version', 'byFloor'] as const);
const libraryListRoot = freezeKey(['library', 'list'] as const);
const libraryDetailRoot = freezeKey(['library', 'detail'] as const);
const userListRoot = freezeKey(['user', 'list'] as const);
const userCurrentRoot = freezeKey(['user', 'current'] as const);

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
  room: {
    byFloor: createQueryKeyFactory(roomByFloorRoot, (floorId: string) => [...roomByFloorRoot, floorId] as const),
  },
  space: {
    byFloor: createQueryKeyFactory(spaceByFloorRoot, (floorId: string) => [...spaceByFloorRoot, floorId] as const),
  },
  user: {
    current: createQueryKeyFactory(userCurrentRoot, () => userCurrentRoot),
    list: createQueryKeyFactory(userListRoot, () => userListRoot),
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
