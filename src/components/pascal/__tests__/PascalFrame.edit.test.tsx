/**
 * Nhánh `edit` của `PascalFrame` — cửa nạp, cửa lưu và cửa phán quyết.
 *
 * `<Editor>` thật dựng WebGL nên jsdom không chạy nó; ở đây nó bị giả bằng
 * `vi.mock` để thấy ĐÚNG những gì khung truyền xuống. Cái bài này canh là bốn
 * lời hứa mà một lỗi im lặng sẽ lấy mất: `onSave` phải có mặt (không có nó thì
 * `useAutoSave` của Pascal lưu vào `localStorage`, tức bản vẽ của người dùng
 * không rời khỏi trình duyệt — A7), `guardAgainstSceneWipe` phải bật,
 * `onLoad` trả đúng cảnh đang xem kèm plugin dựng sẵn, và `onLoaderChange`
 * phải là thứ nuôi `ready` (thiếu nó thì màn kẹt "đang nạp" vĩnh viễn).
 */

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { toPascalScene } from '@/lib/pascal/toPascal';

const editorProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
const historyJumps = vi.hoisted(() => ({
  listeners: new Set<(kind: 'undo' | 'redo') => void>(),
}));

vi.mock('@pascal-app/editor', () => ({
  Editor: (props: Record<string, unknown>) => {
    editorProps.current = props;
    return null;
  },
  appFrontEditorPanels: [],
  subscribeHistoryJumps: (listener: (kind: 'undo' | 'redo') => void) => {
    historyJumps.listeners.add(listener);
    return () => historyJumps.listeners.delete(listener);
  },
}));

vi.mock('../pascalScene', () => ({
  BUILTIN_PLUGIN_ID: 'pascal.builtin',
  loadPascalPlugins: vi.fn(async () => undefined),
  loadSceneIntoPascal: vi.fn(async () => ({ nodeCount: 0, droppedIds: [] })),
}));

const { PascalFrame } = await import('../PascalFrame');

const scene = toPascalScene(createSampleBuilding()).scene;

const renderEdit = (overrides: Record<string, unknown> = {}) =>
  render(
    <PascalFrame
      mode="edit"
      readOnly={false}
      scene={scene}
      sceneKey={1}
      onSceneCommit={async () => undefined}
      onSaveStatus={undefined}
      validateCommit={undefined}
      onCommitRejected={undefined}
      onReadyChange={undefined}
      onFatal={undefined}
      onSceneLoaded={undefined}
      onRendererUnavailable={undefined}
      onHistoryJump={undefined}
      {...overrides}
    />,
  );

beforeEach(() => {
  editorProps.current = null;
  historyJumps.listeners.clear();
});

describe('PascalFrame ở chế độ sửa', () => {
  it('dựng Editor với hàng rào chống xoá sạch và một cửa lưu về máy chủ', () => {
    const onSceneCommit = vi.fn(async () => undefined);
    renderEdit({ onSceneCommit });

    const props = editorProps.current;
    expect(props).not.toBeNull();
    expect(props?.guardAgainstSceneWipe).toBe(true);
    expect(props?.readOnly).toBe(false);
    expect(typeof props?.onSave).toBe('function');
    expect(typeof props?.onLoad).toBe('function');
  });

  it('cửa nạp trả cảnh đang xem kèm plugin dựng sẵn', async () => {
    const onSceneLoaded = vi.fn();
    renderEdit({ onSceneLoaded });

    const onLoad = editorProps.current?.onLoad as () => Promise<{
      nodes: Record<string, unknown>;
      rootNodeIds: readonly string[];
      installedPlugins: readonly string[];
    }>;
    const loaded = await onLoad();

    expect(Object.keys(loaded.nodes)).toHaveLength(Object.keys(scene.nodes).length);
    expect(loaded.rootNodeIds).toEqual([...scene.rootNodeIds]);
    expect(loaded.installedPlugins).toEqual(['pascal.builtin']);
    expect(onSceneLoaded).toHaveBeenCalledWith({
      nodeCount: Object.keys(scene.nodes).length,
      droppedIds: [],
    });
  });

  it('cửa lưu chuyển cảnh mới cho màn hình', async () => {
    const onSceneCommit = vi.fn(async () => undefined);
    renderEdit({ onSceneCommit });

    await (editorProps.current?.onSave as (next: unknown) => Promise<void>)(scene);

    expect(onSceneCommit).toHaveBeenCalledWith(scene);
  });

  it('onLoaderChange là tín hiệu "xong nạp" của khung', () => {
    const onReadyChange = vi.fn();
    renderEdit({ onReadyChange });

    const onLoaderChange = editorProps.current?.onLoaderChange as (visible: boolean) => void;
    act(() => onLoaderChange(true));
    act(() => onLoaderChange(false));

    expect(onReadyChange).toHaveBeenNthCalledWith(1, false);
    expect(onReadyChange).toHaveBeenNthCalledWith(2, true);
  });

  it('phán quyết của host được bọc lại và chuyển xuống editor', async () => {
    const validateCommit = vi.fn(() => ({ ok: true }) as never);
    const onCommitRejected = vi.fn();
    renderEdit({ validateCommit, onCommitRejected });

    const forward = editorProps.current?.validateCommit as (next: unknown) => unknown;
    expect(typeof forward).toBe('function');
    forward(scene);

    expect(validateCommit).toHaveBeenCalledWith(scene);
    expect(editorProps.current?.onCommitRejected).toBe(onCommitRejected);
  });

  it('23-B-016 — máy không GPU ở chế độ sửa: editor báo lên màn để ra PASCAL-03', () => {
    const onRendererUnavailable = vi.fn();
    renderEdit({ onRendererUnavailable });

    expect(editorProps.current?.onRendererUnavailable).toBe(onRendererUnavailable);
  });

  it('không truyền phán quyết thì không dựng prop rỗng cho editor', () => {
    renderEdit();

    expect(editorProps.current).not.toHaveProperty('validateCommit');
    expect(editorProps.current).not.toHaveProperty('onCommitRejected');
  });
});

/*
 * A8 — mọi thay đổi hoàn tác được, KÈM TOAST.
 *
 * Khung đăng ký ở gốc thứ hai vì `subscribeHistoryJumps` là một ô chứa ở mức
 * module của gói Pascal; bài này canh đúng hai việc: nó có đăng ký, và nó gỡ
 * đăng ký khi rời màn — một listener sống sót một lượt gắn lại là một toast
 * nhân đôi sau mỗi lần đổi bản vẽ.
 */
describe('[A8] cú nhảy lịch sử đi ra ngoài', () => {
  it('đăng ký khi có nơi nghe, và báo đúng chiều', () => {
    const onHistoryJump = vi.fn();
    renderEdit({ onHistoryJump });

    expect(historyJumps.listeners.size).toBe(1);
    for (const listener of historyJumps.listeners) listener('undo');
    expect(onHistoryJump).toHaveBeenCalledWith('undo');
  });

  it('gỡ đăng ký khi rời màn', () => {
    const { unmount } = renderEdit({ onHistoryJump: vi.fn() });
    expect(historyJumps.listeners.size).toBe(1);

    unmount();
    expect(historyJumps.listeners.size).toBe(0);
  });

  it('không nơi nào nghe thì không đăng ký gì', () => {
    renderEdit();
    expect(historyJumps.listeners.size).toBe(0);
  });
});

describe('PascalFrame — `/3d?view=exploded` (F-15 W2-C2)', () => {
  it('bật tách tầng hết cỡ khi được yêu cầu', async () => {
    const { useLevelExplode, useViewer } = await import('@pascal-app/viewer');
    useViewer.getState().setLevelMode('stacked');
    useLevelExplode.getState().setAmount(0.2);

    renderEdit({ explodeLevels: true });

    expect(useViewer.getState().levelMode).toBe('exploded');
    expect(useLevelExplode.getState().amount).toBe(1);
  });

  it('không đụng chế độ tầng khi không yêu cầu', async () => {
    const { useViewer } = await import('@pascal-app/viewer');
    useViewer.getState().setLevelMode('stacked');

    renderEdit();

    expect(useViewer.getState().levelMode).toBe('stacked');
  });
});
