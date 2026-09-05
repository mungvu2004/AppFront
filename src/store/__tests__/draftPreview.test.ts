/**
 * [U7] Người sản xuất bản nháp — `previewEdit` / `discardPreview` của `commit.ts`.
 *
 * `draftSlice` đã tồn tại từ lâu và chưa ai trong sản phẩm sản xuất một thao tác
 * nháp nào: `stageDraftOperation`/`amendDraftOperation`/`discardDraft` bị
 * `local/no-draft-write-outside-commands` khoá ngoài `src/store`, và không file
 * nào TRONG `src/store` gọi chúng ngoài phần dọn dẹp lúc đổi tầng. Luật ấy
 * không được nới, nên đường hợp lệ là một API của chính `src/store` — và nó ở
 * cạnh `commit`, vì cửa ghi tạm phải biết tự đóng khi cửa ghi thật mở.
 *
 * Ba lời hứa được đo ở đây, mỗi lời một con số:
 *
 * 1. Kéo N bước để lại ĐÚNG MỘT thao tác nháp, không phải N.
 * 2. Bản nháp không tạo một bước hoàn tác nào, và `commit` dọn nó.
 * 3. Bản nháp không đụng `spatial`, nên không gì để tự lưu gửi đi.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { installFakeClock, type FakeClock } from '@/lib/testing/fakeClock';

import { createSampleBuilding } from '../../domain/spatial/__fixtures__/sampleBuilding';
import { readEntity } from '../../domain/spatial/applyPatch';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import type { Wall } from '../../domain/spatial/types';
import { commit, discardPreview, previewEdit, resetCommitRun } from '../commit';
import { draftEntityId } from '../draftSlice';
import { useStore } from '../index';
import { selectDraftEntityIds, selectDraftPreviewGraph, resetSelectorCaches } from '../selectors';

/** Số bước của một lượt kéo — cùng con số mà bài kiểm cảnh 3D dùng. */
const DRAG_STEP_COUNT = 30;

const firstSampleWall = (): Wall => {
  const wall = createSampleBuilding().walls.at(0);

  if (wall === undefined) {
    throw new Error('sample building has no walls');
  }

  return wall;
};

const storedWall = (wallId: Wall['id']): Wall => {
  const { spatial } = useStore.getState();

  if (spatial === null) {
    throw new Error('spatial data is not loaded');
  }

  const wall = readEntity(spatial, 'wall', wallId);

  if (wall === null) {
    throw new Error(`wall ${wallId} is missing from the store`);
  }

  return wall;
};

/** Bức tường như bản nháp nói nó sẽ trông — đọc qua đúng selector mà 3D đọc. */
const previewedWall = (wallId: Wall['id']): Wall | null => {
  const graph = selectDraftPreviewGraph(useStore.getState());

  return graph === null ? null : readEntity(graph, 'wall', wallId);
};

const undoSteps = (): number => useStore.temporal.getState().pastStates.length;

describe('[U7] store/commit.ts — người sản xuất bản nháp', () => {
  let clock: FakeClock;

  beforeEach(() => {
    useStore.setState({
      spatial: normalizeSpatial(createSampleBuilding()),
      versionId: 'v1',
    });
    useStore.getState().discardDraft();
    resetCommitRun();
    resetSelectorCaches();
    useStore.temporal.getState().clear();
    clock = installFakeClock();
  });

  afterEach(() => {
    clock.restore();
    useStore.getState().discardDraft();
  });

  it('ba mươi bước kéo để lại ĐÚNG MỘT thao tác nháp, mang giá trị cuối', () => {
    const wall = firstSampleWall();

    for (let step = 0; step < DRAG_STEP_COUNT; step += 1) {
      previewEdit(wall.id, { ...wall, thicknessMm: wall.thicknessMm + step });
    }

    const staged = useStore.getState().draftOperations;
    const only = staged[0];

    if (only === undefined) {
      throw new Error('một lượt kéo phải để lại một thao tác nháp');
    }

    // Lượt sau SỬA lượt trước (`amendDraftOperation`), không xếp thêm.
    expect(staged).toHaveLength(1);
    expect(draftEntityId(only)).toBe(wall.id);
    expect(previewedWall(wall.id)?.thicknessMm).toBe(wall.thicknessMm + DRAG_STEP_COUNT - 1);
    expect(selectDraftEntityIds(useStore.getState())).toStrictEqual([wall.id]);
  });

  it('bản nháp không đụng mô hình đã lưu và không mở một bước hoàn tác nào', () => {
    const wall = firstSampleWall();
    const savedGraph = useStore.getState().spatial;

    for (let step = 0; step < DRAG_STEP_COUNT; step += 1) {
      previewEdit(wall.id, { ...wall, thicknessMm: wall.thicknessMm + step });
    }

    // Mô hình đã lưu giữ NGUYÊN cả giá trị lẫn danh tính: không lượt vẽ nào
    // phía dưới `state.spatial` bị đánh thức, và tự lưu (đọc `state.spatial`)
    // không có gì để gửi đi.
    expect(useStore.getState().spatial).toBe(savedGraph);
    expect(storedWall(wall.id).thicknessMm).toBe(wall.thicknessMm);
    expect(undoSteps()).toBe(0);
  });

  it('commit() dọn bản nháp: thả tay là lượt ghi thật thay chỗ hình tạm', () => {
    const wall = firstSampleWall();
    const target = wall.thicknessMm + 110;

    previewEdit(wall.id, { ...wall, thicknessMm: target });
    expect(useStore.getState().draftOperations).toHaveLength(1);

    commit(
      { op: 'update', kind: 'wall', id: wall.id, changes: { thicknessMm: target } },
      `Đổi độ dày tường thành ${String(target)} mm.`,
    );

    expect(useStore.getState().draftOperations).toStrictEqual([]);
    expect(selectDraftPreviewGraph(useStore.getState())).toBeNull();
    expect(storedWall(wall.id).thicknessMm).toBe(target);
    expect(undoSteps()).toBe(1);
  });

  it('discardPreview() bỏ bản nháp, và không ghi gì khi không có nháp nào', () => {
    const wall = firstSampleWall();
    const before = useStore.getState().draftOperations;

    discardPreview();
    expect(useStore.getState().draftOperations).toBe(before);

    previewEdit(wall.id, { ...wall, thicknessMm: wall.thicknessMm + 50 });
    expect(selectDraftPreviewGraph(useStore.getState())).not.toBeNull();

    discardPreview();
    expect(useStore.getState().draftOperations).toStrictEqual([]);
    expect(selectDraftPreviewGraph(useStore.getState())).toBeNull();
    expect(selectDraftEntityIds(useStore.getState())).toStrictEqual([]);
  });

  it('hai vật khác nhau là hai thao tác nháp, mỗi vật một cái', () => {
    const walls = createSampleBuilding().walls.slice(0, 2);
    const [first, second] = walls;

    if (first === undefined || second === undefined) {
      throw new Error('sample building needs two walls');
    }

    previewEdit(first.id, { ...first, thicknessMm: first.thicknessMm + 10 });
    previewEdit(second.id, { ...second, thicknessMm: second.thicknessMm + 10 });
    previewEdit(first.id, { ...first, thicknessMm: first.thicknessMm + 20 });

    expect(useStore.getState().draftOperations).toHaveLength(2);
    expect(previewedWall(first.id)?.thicknessMm).toBe(first.thicknessMm + 20);
    expect(previewedWall(second.id)?.thicknessMm).toBe(second.thicknessMm + 10);
  });

  it('đồ thị xem trước giữ nguyên danh tính khi bản nháp không đổi', () => {
    const wall = firstSampleWall();

    previewEdit(wall.id, { ...wall, thicknessMm: wall.thicknessMm + 10 });

    const first = selectDraftPreviewGraph(useStore.getState());
    const second = selectDraftPreviewGraph(useStore.getState());

    // Memo hoá thật: một hook đọc selector này ở mỗi lượt vẽ không được dựng
    // một đồ thị mới mỗi lần, nếu không `useMemo` phía dưới nó vô nghĩa.
    expect(second).toBe(first);
    expect(selectDraftEntityIds(useStore.getState())).toBe(
      selectDraftEntityIds(useStore.getState()),
    );
  });

  it('nháp trỏ vào một vật không có trong đồ thị thì không có đồ thị xem trước', () => {
    const wall = firstSampleWall();

    previewEdit('W-khong-co-that' as Wall['id'], { ...wall, thicknessMm: 999 });

    expect(useStore.getState().draftOperations).toHaveLength(1);
    expect(selectDraftPreviewGraph(useStore.getState())).toBeNull();
  });
});
