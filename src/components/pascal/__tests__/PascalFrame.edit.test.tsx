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

vi.mock('@pascal-app/editor', () => ({
  Editor: (props: Record<string, unknown>) => {
    editorProps.current = props;
    return null;
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
      {...overrides}
    />,
  );

beforeEach(() => {
  editorProps.current = null;
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

  it('không truyền phán quyết thì không dựng prop rỗng cho editor', () => {
    renderEdit();

    expect(editorProps.current).not.toHaveProperty('validateCommit');
    expect(editorProps.current).not.toHaveProperty('onCommitRejected');
  });
});
