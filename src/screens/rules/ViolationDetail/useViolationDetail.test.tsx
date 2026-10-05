import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetMockLayerState, createMockApiClient, simulateRemoteLayerEdit } from '@/api/__mocks__/client';
import { createDefaultRuleRegistry } from '@/domain/rules/defaults';
import { runRules } from '@/domain/rules/runner';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { __resetFloorLayerSavers, flushAutosaves } from '@/hooks/useAutosave';
import { createHistoryStack } from '@/lib/commands/history';
import { getAppAnnouncer } from '@/lib/input/announcer';
import { LAYER_SAVE_MESSAGES } from '@/lib/autosave/spatialLayerSave';
import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { renderWithProviders } from '@/lib/testing/render';
import { useStore } from '@/store';

import { ViolationDetail } from './ViolationDetail';
import { useViolationDetail } from './useViolationDetail';
import type { ViolationDetailGatewaySeed } from './violationDetailGateway';

const PROJECT = 'project-violation-save';
const GRAPH = normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph);
const VIOLATION = runRules(GRAPH, { registry: createDefaultRuleRegistry() }).violations.find(
  (candidate) => candidate.ruleCode === 'FURNITURE-CLASH',
);

if (VIOLATION === undefined) {
  throw new Error('CLEAN_BUILDING_SCENARIO không còn vi phạm FURNITURE-CLASH nào');
}

const FLOOR_ID = VIOLATION.levelId ?? GRAPH.byKind.level[0] ?? '';

function Wired({ seed }: { readonly seed: ViolationDetailGatewaySeed }) {
  const props = useViolationDetail({
    floorId: FLOOR_ID,
    initialIndex: 0,
    onClose: () => undefined,
    projectId: PROJECT,
    seed,
    violations: [VIOLATION as NonNullable<typeof VIOLATION>],
  });

  return <ViolationDetail {...props} />;
}

const mount = async (seed: ViolationDetailGatewaySeed): Promise<void> => {
  renderWithProviders(<Wired seed={seed} />);
  await act(async () => {
    useStore.getState().setSpatial(GRAPH, 'v-1', {
      floorRevisions: Object.fromEntries(GRAPH.byKind.level.map((id) => [id, 0])),
      projectId: PROJECT,
    });
    await vi.dynamicImportSettled();
  });
};

/** Chính tấm trượt — announcer cũng in câu vào vùng sống của nó ở `document.body`. */
const panel = (): HTMLElement => screen.getByRole('complementary', { name: 'chi tiết vi phạm' });

const quickFix = async (): Promise<void> => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'xoá đối tượng này' }));
  });
  await waitFor(() => {
    expect(useStore.getState().spatial?.byId[VIOLATION.entityId]).toBeUndefined();
  });
};

describe('useViolationDetail — sửa nhanh đi qua saver lớp tầng (F-04x-1)', () => {
  beforeEach(() => {
    __resetFloorLayerSavers();
    __resetMockLayerState();
  });

  afterEach(() => {
    cleanup();
    __resetFloorLayerSavers();
    vi.restoreAllMocks();
  });

  it('sửa nhanh → đúng một PUT vào tầng của vi phạm, base là revision của lượt đọc', async () => {
    const apiClient = createMockApiClient();
    const writeLayer = vi.spyOn(apiClient.spatial, 'writeLayer');

    await mount({ apiClient });
    await quickFix();
    await act(async () => {
      await flushAutosaves();
    });

    expect(writeLayer).toHaveBeenCalledTimes(1);
    expect(writeLayer.mock.calls[0]?.[0]).toMatchObject({ baseVersion: 0, floorId: FLOOR_ID, projectId: PROJECT });
    expect(within(panel()).getByText(/^Đã lưu lúc \d{2}:\d{2}$/)).toBeInTheDocument();
  });

  it('409 → câu của ống đọc qua announcer; máy chủ thay tầng → ngăn xếp tấm trượt trống', async () => {
    const apiClient = createMockApiClient();
    const history = createHistoryStack();
    const clear = vi.spyOn(history, 'clear');
    const announce = vi.spyOn(getAppAnnouncer(), 'announce');

    await mount({ apiClient, history });
    simulateRemoteLayerEdit(FLOOR_ID);
    await quickFix();
    await act(async () => {
      await flushAutosaves().catch(() => undefined);
    });

    expect(announce).toHaveBeenCalledWith(LAYER_SAVE_MESSAGES.reload, 'assertive');
    expect(within(panel()).getByText(/^Lưu thất bại/u)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tải lại' })).toBeNull();
    expect(clear).not.toHaveBeenCalled();

    await act(async () => {
      /* eslint-disable-next-line local/no-direct-set -- dựng cảnh: giả lượt `replaceFloorLayer(…, { external: true })`. */
      useStore.setState((state) => ({ serverReplaceSeq: state.serverReplaceSeq + 1 }));
    });

    expect(clear).toHaveBeenCalledTimes(1);
  });
});
