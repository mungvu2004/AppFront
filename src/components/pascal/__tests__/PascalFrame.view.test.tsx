/** Nhánh `view` của `PascalFrame` — cờ `cameraControls` phải tới `<Viewer>`. */

import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { toPascalScene } from '@/lib/pascal/toPascal';

const viewerProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('@pascal-app/viewer', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Viewer: (props: Record<string, unknown>) => {
    viewerProps.current = props;
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

const frame = (cameraControls?: boolean) => (
  <PascalFrame
    scene={scene}
    sceneKey={1}
    mode="view"
    readOnly={false}
    {...(cameraControls === undefined ? {} : { cameraControls })}
    onSceneCommit={undefined}
    onSaveStatus={undefined}
    validateCommit={undefined}
    onCommitRejected={undefined}
    onReadyChange={undefined}
    onFatal={undefined}
    onHistoryJump={undefined}
    onSceneLoaded={undefined}
    onRendererUnavailable={undefined}
  />
);

describe('PascalFrame · view · cameraControls', () => {
  beforeEach(() => {
    viewerProps.current = null;
  });

  it('mặc định tắt', async () => {
    render(frame());
    await waitFor(() => expect(viewerProps.current).not.toBeNull());
    expect(viewerProps.current?.cameraControls).toBe(false);
  });

  it('bật thì truyền xuống Viewer', async () => {
    render(frame(true));
    await waitFor(() => expect(viewerProps.current).not.toBeNull());
    expect(viewerProps.current?.cameraControls).toBe(true);
  });
});
