/**
 * Chế độ `lite` của khung xem (màn di động): post-FX tắt cho tới khi cảnh sẵn sàng lần đầu.
 * `<Viewer>` thật dựng WebGL nên bị giả để thấy đúng prop khung truyền xuống.
 */
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { toPascalScene } from '@/lib/pascal/toPascal';

const viewerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('@pascal-app/editor', () => ({
  Editor: () => null,
  appFrontEditorPanels: [],
  subscribeHistoryJumps: () => () => undefined,
}));
vi.mock('@pascal-app/viewer', () => ({
  computeHeroFraming: () => null,
  heroCameraPose: vi.fn(),
  useLevelExplode: { getState: () => ({ setAmount: vi.fn() }) },
  useViewer: { getState: () => ({ setLevelMode: vi.fn() }) },
  Viewer: (props: Record<string, unknown>) => {
    viewerProps.current = props;
    return null;
  },
}));
vi.mock('@react-three/fiber', () => ({ useThree: vi.fn() }));
vi.mock('../pascalScene', () => ({
  BUILTIN_PLUGIN_ID: 'pascal.builtin',
  loadPascalPlugins: vi.fn(async () => undefined),
  loadSceneIntoPascal: vi.fn(async () => ({ nodeCount: 0, droppedIds: [] })),
}));

const { PascalFrame } = await import('../PascalFrame');
const scene = toPascalScene(createSampleBuilding()).scene;

const renderView = (lite: boolean) =>
  render(
    <PascalFrame
      mode="view"
      lite={lite}
      readOnly={false}
      scene={scene}
      sceneKey={1}
      onSceneCommit={undefined}
      onSaveStatus={undefined}
      validateCommit={undefined}
      onCommitRejected={undefined}
      onReadyChange={undefined}
      onFatal={undefined}
      onSceneLoaded={undefined}
      onRendererUnavailable={undefined}
      onHistoryJump={undefined}
    />,
  );

const ready = (value: boolean) =>
  act(() => {
    (viewerProps.current?.onSceneReadyChange as (v: boolean) => void)(value);
  });

beforeEach(() => {
  viewerProps.current = null;
});

describe('PascalFrame lite', () => {
  it('lite tắt post-FX lúc đầu, bật lại sau khi nạp xong', async () => {
    renderView(true);
    await vi.waitFor(() => expect(viewerProps.current).not.toBeNull());
    expect(viewerProps.current?.disablePostFx).toBe(true);

    ready(true);
    expect(viewerProps.current?.disablePostFx).toBe(false);

    ready(false);
    expect(viewerProps.current?.disablePostFx).toBe(false);
  });

  it('không lite thì post-FX không bao giờ bị tắt', async () => {
    renderView(false);
    await vi.waitFor(() => expect(viewerProps.current).not.toBeNull());
    expect(viewerProps.current?.disablePostFx).toBe(false);
  });
});
