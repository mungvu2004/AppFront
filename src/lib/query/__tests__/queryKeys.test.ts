import { describe, expect, it } from 'vitest';
import { queryKeys, type QueryKey, type QueryKeyOf } from '../queryKeys';

interface QueryKeyBranchCase<TKey extends QueryKey> {
  create: () => TKey;
  name: string;
  root: () => QueryKey;
}

const projectId = 'project-48';
const floorId = 'floor-21';
const libraryItemId = 'library-34';

const queryKeyBranchCases = [
  { create: () => queryKeys.project.list(), name: 'project.list', root: queryKeys.project.list.root },
  { create: () => queryKeys.project.detail(projectId), name: 'project.detail', root: queryKeys.project.detail.root },
  { create: () => queryKeys.project.members(projectId), name: 'project.members', root: queryKeys.project.members.root },
  { create: () => queryKeys.floor.list(projectId), name: 'floor.list', root: queryKeys.floor.list.root },
  { create: () => queryKeys.floor.detail(floorId), name: 'floor.detail', root: queryKeys.floor.detail.root },
  { create: () => queryKeys.drawing.byFloor(floorId), name: 'drawing.byFloor', root: queryKeys.drawing.byFloor.root },
  { create: () => queryKeys.progress.byFloor(floorId), name: 'progress.byFloor', root: queryKeys.progress.byFloor.root },
  { create: () => queryKeys.space.byFloor(floorId), name: 'space.byFloor', root: queryKeys.space.byFloor.root },
  { create: () => queryKeys.room.byFloor(floorId), name: 'room.byFloor', root: queryKeys.room.byFloor.root },
  {
    create: () => queryKeys.quality.assessment(floorId),
    name: 'quality.assessment',
    root: queryKeys.quality.assessment.root,
  },
  {
    create: () => queryKeys.violation.byProject(projectId),
    name: 'violation.byProject',
    root: queryKeys.violation.byProject.root,
  },
  { create: () => queryKeys.version.byFloor(floorId), name: 'version.byFloor', root: queryKeys.version.byFloor.root },
  { create: () => queryKeys.library.list(), name: 'library.list', root: queryKeys.library.list.root },
  {
    create: () => queryKeys.library.detail(libraryItemId),
    name: 'library.detail',
    root: queryKeys.library.detail.root,
  },
  { create: () => queryKeys.user.list(), name: 'user.list', root: queryKeys.user.list.root },
  { create: () => queryKeys.user.current(), name: 'user.current', root: queryKeys.user.current.root },
] as const satisfies readonly QueryKeyBranchCase<QueryKey>[];

describe('queryKeys', () => {
  it('defines the expected query key branches', () => {
    expect(queryKeyBranchCases.map((branchCase) => branchCase.name)).toEqual([
      'project.list',
      'project.detail',
      'project.members',
      'floor.list',
      'floor.detail',
      'drawing.byFloor',
      'progress.byFloor',
      'space.byFloor',
      'room.byFloor',
      'quality.assessment',
      'violation.byProject',
      'version.byFloor',
      'library.list',
      'library.detail',
      'user.list',
      'user.current',
    ]);
  });

  it('returns equal key values for equal parameters', () => {
    queryKeyBranchCases.forEach((branchCase) => {
      expect(branchCase.create()).toEqual(branchCase.create());
    });
  });

  it('keeps branch roots as prefixes for invalidation', () => {
    queryKeyBranchCases.forEach((branchCase) => {
      const key = branchCase.create();
      const root = branchCase.root();

      expect(Object.isFrozen(key)).toBe(true);
      expect(Object.isFrozen(root)).toBe(true);
      expect(key.slice(0, root.length)).toEqual(root);
    });
  });

  it('infers query key types from branch functions', () => {
    type ProjectDetailQueryKey = QueryKeyOf<typeof queryKeys.project.detail>;

    const projectDetailKey: ProjectDetailQueryKey = queryKeys.project.detail(projectId);

    expect(projectDetailKey).toEqual(queryKeys.project.detail(projectId));
  });
});
