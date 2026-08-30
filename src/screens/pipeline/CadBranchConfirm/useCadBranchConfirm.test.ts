/**
 * Nửa "suy nghĩ" của màn "Phát hiện tệp CAD", kiểm không cần DOM của màn.
 *
 * Hook được lái qua `renderHook`, và tầng dữ liệu là
 * `createMockCadBranchConfirmGateway()` của `cadBranchConfirmGateway.ts` — cùng
 * bộ mẫu chín lớp mà story dùng, nên test không dựng một bảng dữ liệu thứ hai
 * bịa tại chỗ (R-70). Mọi con số được khẳng định ở đây đều đọc ra từ bộ mẫu đó,
 * không viết tay lại: `312` là tổng `entityCount` của bốn lớp
 * {@link CAD_SAMPLE_LAYERS_MAPPED} đã gán vai trò, và test tự cộng nó ra.
 */

import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatNumber } from '@/lib/format/number';
import { createTestQueryClient } from '@/lib/testing/render';
import { SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import type { ProjectRole } from '@/types/project';

import {
  CAD_MISSING_ENDPOINTS,
  CAD_SAMPLE_ENTITIES,
  CAD_SAMPLE_FILE_FORMAT_VERSION,
  CAD_SAMPLE_INSPECTION,
  CAD_SAMPLE_LAYERS,
  CAD_SAMPLE_LAYERS_MAPPED,
  CAD_SAMPLE_UNSUPPORTED_ENTITIES,
  CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION,
  clearPersistedBranchChoices,
  createAppCadBranchConfirmGateway,
  createCadBranchConfirmGateway,
  createMockCadBranchConfirmGateway,
  readPersistedBranchChoice,
  unsupported,
  type CadBranchConfirmGateway,
} from './cadBranchConfirmGateway';
import { useCadBranchConfirm } from './useCadBranchConfirm';
import type {
  CadBranchConfirmState,
  CadLayerRole,
  CadPreviewEntity,
  UseCadBranchConfirmResult,
} from './types';
import { createMockApiClient } from '@/api/__mocks__/client';

/* -------------------------------------------------------------------------- */
/* Bộ mẫu — đọc ra, không viết tay lại.                                        */
/* -------------------------------------------------------------------------- */

const PROJECT_ID = 'project-1';
const OTHER_PROJECT_ID = 'project-2';
const FLOOR_ID = 'L1';

/** Bốn lớp bộ mẫu đã gán vai trò, và tổng số thực thể của đúng bốn lớp đó. */
const MAPPED_SAMPLE_LAYERS = CAD_SAMPLE_LAYERS_MAPPED.filter((layer) => layer.role !== 'ignore');

const MAPPED_SAMPLE_OBJECT_COUNT = MAPPED_SAMPLE_LAYERS.reduce(
  (total, layer) => total + layer.entityCount,
  0,
);

/* -------------------------------------------------------------------------- */
/* Môi trường.                                                                 */
/* -------------------------------------------------------------------------- */

/* jsdom không có `matchMedia`; `matches: false` là "không giảm chuyển động". */
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  clearPersistedBranchChoices();
});

afterEach(() => {
  cleanup();
  clearPersistedBranchChoices();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */
/* Dựng hook.                                                                  */
/* -------------------------------------------------------------------------- */

interface MountOptions {
  readonly roles?: readonly ProjectRole[];
  readonly forceMappingPanelCollapsed?: boolean;
  readonly projectId?: string;
  readonly onNavigate?: (path: string) => void;
}

interface Mounted {
  readonly result: { current: UseCadBranchConfirmResult };
  readonly unmount: () => void;
}

function mountHook(gateway: CadBranchConfirmGateway, options: MountOptions = {}): Mounted {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }): ReactNode =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  const rendered = renderHook(
    () =>
      useCadBranchConfirm({
        projectId: options.projectId ?? PROJECT_ID,
        floorId: FLOOR_ID,
        gateway,
        ...(options.roles !== undefined ? { roles: options.roles } : {}),
        ...(options.onNavigate !== undefined ? { onNavigate: options.onNavigate } : {}),
        ...(options.forceMappingPanelCollapsed !== undefined
          ? { forceMappingPanelCollapsed: options.forceMappingPanelCollapsed }
          : {}),
      }),
    { wrapper },
  );

  return { result: rendered.result, unmount: rendered.unmount };
}

/** Chờ lượt đọc đầu tiên về. */
async function settle(mounted: Mounted): Promise<void> {
  await waitFor(() => {
    expect(mounted.result.current.model.state).not.toBe('loading');
  });
}

/** Mở giai đoạn 2 bằng đúng đường người dùng đi: chọn nhánh CAD. */
async function openLayerMapping(mounted: Mounted): Promise<void> {
  await settle(mounted);
  act(() => {
    mounted.result.current.actions.onChooseBranch('cad');
  });
}

/** Gán lại đúng vai trò bộ mẫu đã gán cho bốn lớp của nó. */
function assignSampleRoles(mounted: Mounted): void {
  act(() => {
    for (const layer of MAPPED_SAMPLE_LAYERS) {
      mounted.result.current.actions.onAssignRole(layer.id, layer.role);
    }
  });
}

/** Cổng của một trạng thái cụ thể trong bảy trạng thái. */
function gatewayFor(state: CadBranchConfirmState): CadBranchConfirmGateway {
  if (state === 'empty') {
    return createMockCadBranchConfirmGateway({
      inspection: { ...CAD_SAMPLE_INSPECTION, hasNamedLayers: false, layers: [] },
    });
  }

  if (state === 'error') {
    return createMockCadBranchConfirmGateway({
      inspection: {
        ...CAD_SAMPLE_INSPECTION,
        isFormatSupported: false,
        fileFormatVersion: CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION,
      },
    });
  }

  return createMockCadBranchConfirmGateway();
}

/** Dựng hook ở đúng một trong bảy trạng thái, và chờ nó tới đó. */
async function mountInState(state: CadBranchConfirmState): Promise<Mounted> {
  if (state === 'loading') {
    // Lượt đọc không bao giờ về: đó chính là trạng thái đang đọc.
    const gateway = createMockCadBranchConfirmGateway();
    return mountHook({
      ...gateway,
      readFloorAvailability: () => new Promise(() => undefined),
    });
  }

  const mounted = mountHook(gatewayFor(state), {
    ...(state === 'forbidden' ? { roles: ['viewer'] as readonly ProjectRole[] } : {}),
    ...(state === 'collapsed' ? { forceMappingPanelCollapsed: true } : {}),
  });

  await settle(mounted);

  if (state === 'success') {
    assignSampleRoles(mounted);
    act(() => {
      mounted.result.current.actions.onImportGeometry();
    });
    await waitFor(() => {
      expect(mounted.result.current.model.state).toBe('success');
    });
  }

  return mounted;
}

/* -------------------------------------------------------------------------- */
/* Cổng dữ liệu — trung thực về việc nó KHÔNG làm được.                        */
/* -------------------------------------------------------------------------- */

describe('cadBranchConfirmGateway — khai đúng việc chưa có đường làm', () => {
  it('bản thật chỉ bật hai khả năng có nguồn thật', () => {
    const gateway = createCadBranchConfirmGateway(createMockApiClient());

    expect(gateway.supports).toStrictEqual({
      inspectCadFile: false,
      readFloorAvailability: true,
      setProcessingBranch: false,
      rememberChoice: true,
      saveLayerMapping: false,
    });
  });

  it('mỗi khả năng còn thiếu trả về tên endpoint nguyên văn, không phải giá trị bịa', async () => {
    const gateway = createCadBranchConfirmGateway(createMockApiClient());

    const inspection = await gateway.inspectCadFile({ floorId: FLOOR_ID, projectId: PROJECT_ID });
    const branch = await gateway.setProcessingBranch({
      branch: 'cad',
      floorId: FLOOR_ID,
      projectId: PROJECT_ID,
    });

    expect(inspection).toStrictEqual(unsupported('inspectCadFile'));
    expect(branch).toStrictEqual(unsupported('setProcessingBranch'));
    expect(inspection.supported ? '' : inspection.missing).toBe(
      CAD_MISSING_ENDPOINTS.inspectCadFile,
    );
  });

  it('đọc được danh sách tầng thật, và suy hasCadFile từ đuôi tệp (giả định C-CAD-1)', async () => {
    const gateway = createCadBranchConfirmGateway(createMockApiClient());

    const floors = await gateway.readFloorAvailability({ projectId: PROJECT_ID });

    expect(floors.ok).toBe(true);
    expect(floors.ok ? floors.data.length : 0).toBeGreaterThan(0);
    // Bộ mẫu của `createMockApiClient()` chỉ có bản vẽ `.png`, nên câu trả lời
    // đúng là "không tầng nào có tệp CAD" — không phải một `true` bịa ra.
    expect(floors.ok ? floors.data.every((floor) => !floor.hasCadFile) : false).toBe(true);
  });

  it('cổng thật của ứng dụng dựng được và khai đúng những cờ đó', () => {
    expect(createAppCadBranchConfirmGateway().supports.inspectCadFile).toBe(false);
  });

  it('bộ mẫu có đúng chín lớp CAD, bốn lớp đã gán cộng lại đúng 312 thực thể', () => {
    expect(CAD_SAMPLE_LAYERS).toHaveLength(9);
    expect(CAD_SAMPLE_LAYERS_MAPPED).toHaveLength(9);
    expect(MAPPED_SAMPLE_LAYERS).toHaveLength(4);
    expect(MAPPED_SAMPLE_OBJECT_COUNT).toBe(312);
  });
});

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11 / R-63).                                                */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — bảy trạng thái', () => {
  it.each(SEVEN_STATES)('dựng được trạng thái %s', async (state) => {
    const mounted = await mountInState(state as CadBranchConfirmState);

    expect(mounted.result.current.model.state).toBe(state);
  });

  it('mỗi câu của một trạng thái chỉ có mặt ở đúng trạng thái đó', async () => {
    const empty = await mountInState('empty');
    const forbidden = await mountInState('forbidden');
    const success = await mountInState('success');

    expect(empty.result.current.model.emptyNotice).not.toBeNull();
    expect(empty.result.current.model.forbiddenNotice).toBeNull();
    expect(forbidden.result.current.model.forbiddenNotice).not.toBeNull();
    expect(forbidden.result.current.model.emptyNotice).toBeNull();
    expect(success.result.current.model.successNotice).not.toBeNull();
    expect(success.result.current.model.partialNotice).toBeNull();
  });

  it('trạng thái Lỗi mang số phiên bản tệp và mã máy đọc ra tới view', async () => {
    const mounted = await mountInState('error');
    const { model } = mounted.result.current;

    expect(model.errorFileFormatVersion).toBe(CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION);
    expect(model.errorMessage).toContain(CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION);
    // L-03 đi qua kind `validation` CÓ SẴN của `src/lib/errors`, không kind mới.
    expect(model.errorCode).toBe('VALIDATION');
  });

  it('ngoài trạng thái Lỗi thì không câu lỗi nào và không số phiên bản lỗi nào', async () => {
    const mounted = await mountInState('partial');
    const { model } = mounted.result.current;

    expect(model.errorMessage).toBeNull();
    expect(model.errorCode).toBeNull();
    expect(model.errorFileFormatVersion).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Hai giai đoạn nối tiếp, một route, không lồng hộp thoại.                     */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — hai giai đoạn', () => {
  it('mở màn ở hộp thoại chốt nhánh, chưa có panel ánh xạ nào', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await settle(mounted);
    const { model } = mounted.result.current;

    expect(model.stage).toBe('branchDialog');
    expect(model.dialog.isOpen).toBe(true);
    expect(model.mapping).toBeNull();
    expect(model.preview).toBeNull();
    expect(model.importOptions).toBeNull();
    expect(mounted.result.current.resolvedBranch).toBeNull();
  });

  it('chọn CAD thì hộp thoại ĐÓNG rồi panel ánh xạ mới mở — không lồng hộp thoại', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const { model, resolvedBranch } = mounted.result.current;

    expect(resolvedBranch).toBe('cad');
    expect(model.stage).toBe('layerMapping');
    expect(model.dialog.isOpen).toBe(false);
    expect(model.mapping).not.toBeNull();
    expect(model.preview).not.toBeNull();
    expect(model.importOptions).not.toBeNull();
  });

  it('chọn AI thì hoà tan sang phần cài đặt AI của dự án, không mở panel ánh xạ', async () => {
    const onNavigate = vi.fn();
    const mounted = mountHook(createMockCadBranchConfirmGateway(), { onNavigate });
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.onChooseBranch('ai');
    });

    expect(mounted.result.current.resolvedBranch).toBe('ai');
    expect(mounted.result.current.model.stage).toBe('branchDialog');
    expect(mounted.result.current.model.mapping).toBeNull();
    expect(onNavigate).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/pipeline`);
  });

  it('nút Huỷ đóng hộp thoại mà không chốt nhánh nào', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.onDismiss();
    });

    expect(mounted.result.current.model.dialog.isOpen).toBe(false);
    expect(mounted.result.current.resolvedBranch).toBeNull();
    expect(mounted.result.current.model.stage).toBe('branchDialog');
  });
});

/* -------------------------------------------------------------------------- */
/* Nhánh AI luôn còn đường về (cấm tuyệt đối của đặc tả).                       */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — người dùng luôn quay về nhánh AI được', () => {
  it.each(SEVEN_STATES)('chọn AI vẫn ăn ở trạng thái %s', async (state) => {
    const mounted = await mountInState(state as CadBranchConfirmState);

    act(() => {
      mounted.result.current.actions.onChooseBranch('ai');
    });

    expect(mounted.result.current.resolvedBranch).toBe('ai');
  });

  it('trạng thái Lỗi khoá nhánh CAD và nói rõ vì sao, nhưng vẫn để lại nhánh AI', async () => {
    const mounted = await mountInState('error');

    expect(mounted.result.current.model.dialog.isCadChoiceDisabled).toBe(true);
    expect(mounted.result.current.model.dialog.cadChoiceDisabledReason).toContain(
      CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION,
    );

    act(() => {
      mounted.result.current.actions.onChooseBranch('cad');
    });

    // Nhánh CAD không mở được ở trạng thái Lỗi.
    expect(mounted.result.current.model.stage).toBe('branchDialog');
    expect(mounted.result.current.resolvedBranch).toBeNull();

    act(() => {
      mounted.result.current.actions.onChooseBranch('ai');
    });

    expect(mounted.result.current.resolvedBranch).toBe('ai');
  });

  it('trạng thái đọc được tệp thì nhánh CAD mở được và không có câu khoá nào', async () => {
    const mounted = await mountInState('partial');

    expect(mounted.result.current.model.dialog.isCadChoiceDisabled).toBe(false);
    expect(mounted.result.current.model.dialog.cadChoiceDisabledReason).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* Ánh xạ vai trò — cập nhật ngay, không đợi bấm gửi.                          */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — ánh xạ lớp và dòng tóm tắt', () => {
  it('lớp chưa gán mặc định là "bỏ qua", và tóm tắt mở màn là 0 trên chín lớp', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const { model } = mounted.result.current;

    expect(model.mapping?.layers.every((layer) => layer.role === 'ignore')).toBe(true);
    expect(model.summary?.mappedLayerCount).toBe(0);
    expect(model.summary?.totalLayerCount).toBe(CAD_SAMPLE_LAYERS.length);
    expect(model.summary?.objectCount).toBe(0);
    expect(model.canImportGeometry).toBe(false);
  });

  it('đổi vai trò một lớp cập nhật tóm tắt NGAY, không đợi bấm gửi', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const first = MAPPED_SAMPLE_LAYERS[0];

    if (first === undefined) {
      throw new Error('Bộ mẫu phải có ít nhất một lớp đã gán vai trò.');
    }

    act(() => {
      mounted.result.current.actions.onAssignRole(first.id, first.role);
    });

    expect(mounted.result.current.model.summary?.mappedLayerCount).toBe(1);
    expect(mounted.result.current.model.summary?.objectCount).toBe(first.entityCount);
    expect(mounted.result.current.model.canImportGeometry).toBe(true);
    // Xem trước đọc cùng mảng lớp với bảng, nên nó đổi trong cùng một lượt vẽ.
    expect(
      mounted.result.current.model.preview?.layers.find((layer) => layer.id === first.id)?.role,
    ).toBe(first.role);
  });

  it('gán đủ bốn lớp của bộ mẫu cho ra đúng "4/9 lớp" và "312 đối tượng"', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    assignSampleRoles(mounted);
    const summary = mounted.result.current.model.summary;

    expect(summary?.mappedLayerCount).toBe(MAPPED_SAMPLE_LAYERS.length);
    expect(summary?.objectCount).toBe(MAPPED_SAMPLE_OBJECT_COUNT);
    // A15 — chuỗi đã ghép xong ở hook, view chỉ hiển thị.
    expect(summary?.mappedCountLabel).toBe(
      `Đã ánh xạ ${formatNumber(MAPPED_SAMPLE_LAYERS.length)}/${formatNumber(CAD_SAMPLE_LAYERS.length)} lớp`,
    );
    expect(summary?.objectCountLabel).toBe(
      `${formatNumber(MAPPED_SAMPLE_OBJECT_COUNT)} đối tượng sẽ được nhập`,
    );
  });

  it('bảy vai trò đều chọn được, và bỏ về "bỏ qua" thì lớp rời khỏi tóm tắt', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const roles = mounted.result.current.model.mapping?.roleOptions.map((option) => option.value);
    const first = MAPPED_SAMPLE_LAYERS[0];

    if (first === undefined) {
      throw new Error('Bộ mẫu phải có ít nhất một lớp đã gán vai trò.');
    }

    expect(roles).toHaveLength(7);

    act(() => {
      mounted.result.current.actions.onAssignRole(first.id, first.role);
    });
    act(() => {
      mounted.result.current.actions.onAssignRole(first.id, 'ignore' satisfies CadLayerRole);
    });

    expect(mounted.result.current.model.summary?.mappedLayerCount).toBe(0);
  });

  it('gợi ý lớp nhiều thực thể còn bỏ qua là GỢI Ý — nó không khoá nút nhập', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    assignSampleRoles(mounted);
    const { model } = mounted.result.current;
    const busiestIgnored = CAD_SAMPLE_LAYERS.filter(
      (layer) => !MAPPED_SAMPLE_LAYERS.some((mapped) => mapped.id === layer.id),
    ).sort((left, right) => right.entityCount - left.entityCount)[0];

    if (busiestIgnored === undefined) {
      throw new Error('Bộ mẫu phải còn lớp chưa gán vai trò.');
    }

    expect(model.partialNotice).toContain(busiestIgnored.name);
    expect(model.canImportGeometry).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Thực thể không hỗ trợ — gọi tên, không gộp.                                 */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — thực thể không hỗ trợ', () => {
  it('giữ nguyên từng tên loại và từng số lượng', async () => {
    const mounted = await mountInState('partial');

    expect(mounted.result.current.model.unsupportedEntityKinds).toStrictEqual(
      CAD_SAMPLE_UNSUPPORTED_ENTITIES,
    );
  });

  it('câu của trạng thái nêu đích danh từng loại kèm số, không gộp thành một câu chung', async () => {
    const mounted = await mountInState('partial');
    const notice = mounted.result.current.model.partialNotice ?? '';

    for (const entity of CAD_SAMPLE_UNSUPPORTED_ENTITIES) {
      expect(notice).toContain(entity.kind);
      expect(notice).toContain(formatNumber(entity.count));
    }
  });

  it('tầng không có tệp CAD cũng được gọi tên trong cùng câu đó', async () => {
    const mounted = await mountInState('partial');
    const notice = mounted.result.current.model.partialNotice ?? '';
    const withoutCad = mounted.result.current.model.dialog.floorAvailability.filter(
      (floor) => !floor.hasCadFile,
    );

    expect(withoutCad.length).toBeGreaterThan(0);

    for (const floor of withoutCad) {
      expect(notice).toContain(floor.floorName);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Ghi nhớ lựa chọn theo dự án — và sự thật là nó chỉ sống một phiên.           */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — ghi nhớ lựa chọn theo dự án', () => {
  it('không đánh dấu ô thì không ghi nhớ gì', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.onChooseBranch('cad');
    });

    expect(readPersistedBranchChoice(PROJECT_ID)).toBeUndefined();
  });

  it('đánh dấu ô rồi chốt nhánh thì lựa chọn được giữ theo đúng dự án đó', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.onToggleRemember(true);
    });
    act(() => {
      mounted.result.current.actions.onChooseBranch('cad');
    });

    expect(readPersistedBranchChoice(PROJECT_ID)).toBe('cad');
    expect(readPersistedBranchChoice(OTHER_PROJECT_ID)).toBeUndefined();
  });

  it('dự án khác đọc lại đúng lựa chọn của riêng nó', async () => {
    const other = mountHook(createMockCadBranchConfirmGateway(), {
      projectId: OTHER_PROJECT_ID,
    });
    await settle(other);

    act(() => {
      other.result.current.actions.onToggleRemember(true);
    });
    act(() => {
      other.result.current.actions.onChooseBranch('ai');
    });

    expect(readPersistedBranchChoice(OTHER_PROJECT_ID)).toBe('ai');
    expect(readPersistedBranchChoice(PROJECT_ID)).toBeUndefined();

    const reopened = mountHook(createMockCadBranchConfirmGateway(), {
      projectId: OTHER_PROJECT_ID,
    });
    await settle(reopened);

    expect(reopened.result.current.model.dialog.isRememberChoiceChecked).toBe(true);
  });

  it('bỏ đánh dấu ô xoá lượt ghi nhớ', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await settle(mounted);

    act(() => {
      mounted.result.current.actions.onToggleRemember(true);
    });
    act(() => {
      mounted.result.current.actions.onChooseBranch('cad');
    });
    act(() => {
      mounted.result.current.actions.onToggleRemember(false);
    });

    expect(readPersistedBranchChoice(PROJECT_ID)).toBeUndefined();
  });

  it('cổng nói thẳng rằng lượt ghi nhớ chỉ sống bằng một phiên trình duyệt', () => {
    expect(createAppCadBranchConfirmGateway().isRememberedChoiceSessionOnly).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Tuỳ chọn nhập, thu gọn panel, và lượt nhập hình học.                        */
/* -------------------------------------------------------------------------- */

describe('useCadBranchConfirm — tuỳ chọn nhập và lượt nhập hình học', () => {
  it('đơn vị mở màn theo đơn vị tệp tự nhận, đổi được và giữ nguyên gợi ý', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);

    expect(mounted.result.current.model.importOptions?.unit).toBe(
      CAD_SAMPLE_INSPECTION.detectedUnit,
    );

    act(() => {
      mounted.result.current.actions.onChangeUnit('cm');
    });

    expect(mounted.result.current.model.importOptions?.unit).toBe('cm');
    expect(mounted.result.current.model.importOptions?.detectedUnit).toBe(
      CAD_SAMPLE_INSPECTION.detectedUnit,
    );
  });

  it('thiếu khai báo đơn vị chỉ hiện cảnh báo, KHÔNG khoá nhánh CAD', async () => {
    const mounted = await mountInState('partial');
    const { model } = mounted.result.current;

    expect(model.dialog.diagnostics.hasMissingUnitDeclaration).toBe(true);
    expect(model.dialog.unitWarningMessage).not.toBeNull();
    expect(model.dialog.isCadChoiceDisabled).toBe(false);
  });

  it('chú giải độ dày tường lấy token bảng màu, không mã màu thô', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const legend = mounted.result.current.model.preview?.wallThicknessLegend ?? [];

    expect(legend).toHaveLength(CAD_SAMPLE_INSPECTION.wallThicknessesMm.length);

    for (const entry of legend) {
      expect(entry.colorToken.startsWith('wall-')).toBe(true);
      expect(entry.label).toMatch(/ mm$/u);
    }
  });

  it('nhập hình học xong thì màn sang trạng thái Xong', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    assignSampleRoles(mounted);

    act(() => {
      mounted.result.current.actions.onImportGeometry();
    });

    await waitFor(() => {
      expect(mounted.result.current.model.state).toBe('success');
    });
    expect(mounted.result.current.model.isImporting).toBe(false);
  });

  it('không có endpoint lưu ánh xạ thì nút nhập tắt — không giả vờ nhập được', async () => {
    const mounted = mountHook(
      createMockCadBranchConfirmGateway({ supports: { saveLayerMapping: false } }),
    );
    await openLayerMapping(mounted);
    assignSampleRoles(mounted);

    expect(mounted.result.current.model.canImportGeometry).toBe(false);

    act(() => {
      mounted.result.current.actions.onImportGeometry();
    });

    expect(mounted.result.current.model.state).not.toBe('success');
  });

  it('thu gọn panel ánh xạ là một trạng thái riêng, và mở lại được', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);

    act(() => {
      mounted.result.current.actions.onToggleMappingPanelCollapsed();
    });

    expect(mounted.result.current.model.state).toBe('collapsed');
    expect(mounted.result.current.model.isMappingPanelCollapsed).toBe(true);

    act(() => {
      mounted.result.current.actions.onToggleMappingPanelCollapsed();
    });

    expect(mounted.result.current.model.state).toBe('partial');
  });

  it('rê chuột qua một lớp đồng bộ sang canvas xem trước và ngược lại', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const first = CAD_SAMPLE_LAYERS[0];

    if (first === undefined) {
      throw new Error('Bộ mẫu phải có ít nhất một lớp.');
    }

    act(() => {
      mounted.result.current.actions.onHoverLayer(first.id);
      mounted.result.current.actions.onHoverEntity('cad-entity-1');
    });

    expect(mounted.result.current.model.mapping?.hoveredLayerId).toBe(first.id);
    expect(mounted.result.current.model.preview?.hoveredLayerId).toBe(first.id);
    expect(mounted.result.current.model.preview?.hoveredEntityId).toBe('cad-entity-1');
  });

  it('chẩn đoán tệp đi thẳng ra hộp thoại, kể cả số phiên bản định dạng', async () => {
    const mounted = await mountInState('partial');

    expect(mounted.result.current.model.dialog.diagnostics.fileFormatVersion).toBe(
      CAD_SAMPLE_FILE_FORMAT_VERSION,
    );
    expect(mounted.result.current.model.dialog.diagnostics.hasNamedLayers).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Hình học xem trước — thực thể, khung bao, chú giải độ dày.                  */
/* -------------------------------------------------------------------------- */

/** Mọi điểm của một bộ thực thể, trải phẳng — dùng để tự tính lại khung bao. */
function allPointsOf(entities: readonly CadPreviewEntity[]): readonly (readonly [number, number])[] {
  return entities.flatMap((entity) => entity.points);
}

/** Bộ thực thể chỉ mang đúng những mức dày người gọi liệt kê. */
function entitiesWithThicknesses(
  thicknesses: readonly CadPreviewEntity['thicknessMm'][],
): readonly CadPreviewEntity[] {
  return thicknesses.map((thicknessMm, index) => ({
    id: `cad-entity-test-${index}`,
    layerId: 'cad-layer-a-wall',
    points: [
      [0, index * 100],
      [1000, index * 100],
    ] as const,
    thicknessMm,
  }));
}

describe('useCadBranchConfirm — hình học xem trước', () => {
  it('thực thể của cổng đi thẳng ra canvas, không bị màn dựng lại', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const entities = mounted.result.current.model.preview?.entities ?? [];

    expect(entities).toStrictEqual(CAD_SAMPLE_ENTITIES);
    expect(entities.length).toBeGreaterThan(0);
  });

  it('mọi thực thể trỏ vào một lớp CÓ THẬT trong bảng lớp', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const { preview } = mounted.result.current.model;
    const layerIds = new Set((preview?.layers ?? []).map((layer) => layer.id));

    expect(layerIds.size).toBe(CAD_SAMPLE_LAYERS.length);

    for (const entity of preview?.entities ?? []) {
      expect(layerIds.has(entity.layerId)).toBe(true);
    }
  });

  it('id thực thể ổn định qua hai lượt đọc — nổi bật hai chiều mới khớp được', async () => {
    const first = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(first);
    const idsBefore = (first.result.current.model.preview?.entities ?? []).map(
      (entity) => entity.id,
    );

    act(() => {
      first.result.current.actions.onRetry();
    });
    await settle(first);

    const idsAfterRefetch = (first.result.current.model.preview?.entities ?? []).map(
      (entity) => entity.id,
    );

    const second = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(second);
    const idsSecondMount = (second.result.current.model.preview?.entities ?? []).map(
      (entity) => entity.id,
    );

    expect(idsBefore.length).toBeGreaterThan(0);
    expect(idsAfterRefetch).toStrictEqual(idsBefore);
    expect(idsSecondMount).toStrictEqual(idsBefore);
    // Không id nào trùng nhau: `hoveredEntityId` phải chỉ đúng MỘT nét.
    expect(new Set(idsBefore).size).toBe(idsBefore.length);
  });

  it('khung bao ôm đúng mọi điểm, kể cả trục thò ra ngoài mép nhà', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const extent = mounted.result.current.model.preview?.extentMm;
    const points = allPointsOf(CAD_SAMPLE_ENTITIES);

    expect(extent).toStrictEqual({
      minXMm: Math.min(...points.map(([xMm]) => xMm)),
      minYMm: Math.min(...points.map(([, yMm]) => yMm)),
      maxXMm: Math.max(...points.map(([xMm]) => xMm)),
      maxYMm: Math.max(...points.map(([, yMm]) => yMm)),
    });
    // Bề rộng và bề cao dương thì canvas mới dựng được `viewBox`.
    expect((extent?.maxXMm ?? 0) - (extent?.minXMm ?? 0)).toBeGreaterThan(0);
    expect((extent?.maxYMm ?? 0) - (extent?.minYMm ?? 0)).toBeGreaterThan(0);
  });

  it('không có thực thể nào thì khung bao vẫn là bốn số hữu hạn, không NaN/Infinity', async () => {
    const mounted = mountHook(
      createMockCadBranchConfirmGateway({
        inspection: { ...CAD_SAMPLE_INSPECTION, entities: [] },
      }),
    );
    await openLayerMapping(mounted);
    const { preview } = mounted.result.current.model;

    expect(preview?.entities).toStrictEqual([]);
    expect(preview?.extentMm).toStrictEqual({
      minXMm: 0,
      minYMm: 0,
      maxXMm: 0,
      maxYMm: 0,
    });

    for (const value of Object.values(preview?.extentMm ?? {})) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('đang đọc tệp thì canvas chưa có thực thể nào để vẽ', async () => {
    const mounted = await mountInState('loading');

    expect(mounted.result.current.model.state).toBe('loading');
    // Giai đoạn 2 chưa mở nên `preview` là `null`; canvas không có gì để vẽ và
    // màn không giả vờ đã đọc xong hình học.
    expect(mounted.result.current.model.preview).toBeNull();
  });

  it('chú giải chỉ liệt kê mức độ dày CÓ MẶT trong thực thể', async () => {
    const mounted = mountHook(
      createMockCadBranchConfirmGateway({
        inspection: {
          ...CAD_SAMPLE_INSPECTION,
          // Tệp khai ba mức, nhưng hình học chỉ vẽ đúng một — chú giải theo hình.
          entities: entitiesWithThicknesses([220, 220, null]),
        },
      }),
    );
    await openLayerMapping(mounted);
    const legend = mounted.result.current.model.preview?.wallThicknessLegend ?? [];

    expect(CAD_SAMPLE_INSPECTION.wallThicknessesMm.length).toBeGreaterThan(1);
    expect(legend).toHaveLength(1);
    expect(legend[0]?.label).toBe(`${formatNumber(220)} mm`);
    expect(legend[0]?.colorToken).toBe('wall-220');
  });

  it('chú giải xếp từ mỏng tới dày, mức không đo bằng số đứng cuối và có tên riêng', async () => {
    const mounted = mountHook(
      createMockCadBranchConfirmGateway({
        inspection: {
          ...CAD_SAMPLE_INSPECTION,
          entities: entitiesWithThicknesses(['CONCRETE_COLUMN', 330, 110]),
        },
      }),
    );
    await openLayerMapping(mounted);
    const legend = mounted.result.current.model.preview?.wallThicknessLegend ?? [];

    expect(legend.map((entry) => entry.label)).toStrictEqual([
      `${formatNumber(110)} mm`,
      `${formatNumber(330)} mm`,
      'cột bê tông',
    ]);
    // Không mã màu thô ở bất kỳ mức nào — kể cả mức thứ tư.
    for (const entry of legend) {
      expect(entry.colorToken).not.toMatch(/^#|^rgb|^hsl/u);
    }
  });

  it('bộ mẫu mang đủ ba mức dày, và chú giải nói lại đúng ba mức đó', async () => {
    const mounted = mountHook(createMockCadBranchConfirmGateway());
    await openLayerMapping(mounted);
    const legend = mounted.result.current.model.preview?.wallThicknessLegend ?? [];

    const thicknessesInEntities = [
      ...new Set(
        CAD_SAMPLE_ENTITIES.map((entity) => entity.thicknessMm).filter(
          (thicknessMm) => thicknessMm !== null,
        ),
      ),
    ];

    expect(thicknessesInEntities.length).toBeGreaterThanOrEqual(2);
    expect(legend).toHaveLength(thicknessesInEntities.length);
    expect(legend.map((entry) => entry.id)).toStrictEqual(
      [...thicknessesInEntities]
        .sort((left, right) => Number(left) - Number(right))
        .map((thicknessMm) => `cad-wall-thickness-${thicknessMm}`),
    );
  });

  it('chỉ thực thể của lớp tường mang độ dày; sáu vai trò kia mang null', async () => {
    const wallLayerIds = new Set(
      CAD_SAMPLE_LAYERS.filter((layer) => layer.name.startsWith('A-WALL')).map(
        (layer) => layer.id,
      ),
    );

    expect(wallLayerIds.size).toBeGreaterThan(0);

    for (const entity of CAD_SAMPLE_ENTITIES) {
      expect(entity.thicknessMm === null).toBe(!wallLayerIds.has(entity.layerId));
    }
  });
});
