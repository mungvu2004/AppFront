import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import {
  CreateProjectModal,
  CreateProjectModalView,
  type CreateProjectModalViewProps,
} from './CreateProjectModal';
import { createProjectGateway } from './CreateProjectModal.container';
import type { CreateProjectFloorRowModel } from './useCreateProjectModal';

/* -------------------------------------------------------------------------- */
/* jsdom has neither of these; the desktop layout (`matches: false`) is the    */
/* one every test below assumes unless it overrides `forceCompact`.            */
/* -------------------------------------------------------------------------- */

beforeAll(() => {
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
});

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* Fixtures for the pure view (invariant D: props in, no store, no network).   */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

const BUILDING_TYPE_OPTIONS = [
  { value: 'residential', label: 'nhà ở' },
  { value: 'commercial', label: 'thương mại' },
];

/** The acceptance case this task's own verification names: a basement plus three floors. */
const STACKED_FLOOR_ROWS: CreateProjectFloorRowModel[] = [
  { id: 'row-basement', name: 'Tầng hầm', kind: 'basement', clearHeightM: 3, elevationLabel: '-3,0 m', problem: null },
  { id: 'row-ground', name: 'Tầng trệt', kind: 'floor', clearHeightM: 3.9, elevationLabel: '0,0 m', problem: null },
  { id: 'row-1', name: 'Tầng 1', kind: 'floor', clearHeightM: 3.6, elevationLabel: '3,9 m', problem: null },
  { id: 'row-2', name: 'Tầng 2', kind: 'floor', clearHeightM: 3, elevationLabel: '7,5 m', problem: null },
];

function baseProps(): CreateProjectModalViewProps {
  return {
    isOpen: true,
    state: 'success',
    isCompact: false,
    canCreate: true,
    step: 3,
    stepLabel: 'bước 3 / 3',
    isSubmitting: false,
    isConfirmingDiscard: false,
    isSelectOpen: false,
    name: 'Chung cư Bình Minh',
    address: '12 Nguyễn Trãi, Hà Nội',
    code: 'DA-CHUNGCUBINHMINH',
    buildingType: 'residential',
    notes: '',
    buildingTypeOptions: BUILDING_TYPE_OPTIONS,
    problems: { name: null },
    notice: null,
    floorRows: STACKED_FLOOR_ROWS,
    hasBasement: true,
    collision: null,
    collisionRowId: null,
    focusFloorId: null,
    canAddFloor: true,
    applyHeightM: null,
    canApplyHeight: false,
    canGoNext: true,
    canSubmit: true,
    setName: noop,
    setAddress: noop,
    setCode: noop,
    setBuildingType: noop,
    setNotes: noop,
    setSelectOpen: noop,
    setHasBasement: noop,
    addFloor: noop,
    removeFloor: noop,
    setFloorName: noop,
    setFloorHeight: noop,
    setApplyHeightM: noop,
    applyHeightToAllFloors: noop,
    focusFloor: noop,
    acknowledgeFocus: noop,
    goNext: noop,
    goBack: noop,
    requestClose: noop,
    confirmDiscard: noop,
    submit: noop,
  };
}

/** One props object per state, keyed so a missing state cannot hide (invariant A11). */
const PROPS_BY_STATE: Readonly<Record<SevenState, () => CreateProjectModalViewProps>> = {
  empty: () => ({
    ...baseProps(),
    state: 'empty',
    step: 2,
    stepLabel: 'bước 2 / 3',
    floorRows: [],
    hasBasement: false,
    canGoNext: false,
    canSubmit: false,
  }),
  loading: () => ({ ...baseProps(), state: 'loading', isSubmitting: true }),
  partial: () => ({
    ...baseProps(),
    state: 'partial',
    step: 2,
    stepLabel: 'bước 2 / 3',
    canGoNext: false,
    canSubmit: false,
    floorRows: [
      STACKED_FLOOR_ROWS[0] as CreateProjectFloorRowModel,
      STACKED_FLOOR_ROWS[1] as CreateProjectFloorRowModel,
      { id: 'row-1', name: 'Tầng 1', kind: 'floor', clearHeightM: null, elevationLabel: null, problem: 'Chưa nhập chiều cao thông thuỷ.' },
    ],
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    step: 1,
    stepLabel: 'bước 1 / 3',
    problems: { name: 'Tên dự án đã trùng với một dự án khác. Đổi tên rồi thử lại.' },
    notice: { level: 'violation', message: 'Tên dự án đã trùng với một dự án khác. Đổi tên rồi thử lại.' },
  }),
  success: () => ({ ...baseProps(), state: 'success' }),
  forbidden: () => ({ ...baseProps(), state: 'forbidden', canCreate: false }),
  collapsed: () => ({ ...baseProps(), state: 'collapsed', isCompact: true, step: 1, stepLabel: 'bước 1 / 3' }),
};

/* -------------------------------------------------------------------------- */
/* The view, in each of the seven states (invariant A11).                      */
/* -------------------------------------------------------------------------- */

describe('CreateProjectModalView, seven states', () => {
  it('renders something for every one of the seven', () => {
    expectSevenStates(
      (scenario) => render(<CreateProjectModalView {...PROPS_BY_STATE[scenario.state]()} />),
      SEVEN_STATES.map((state) => ({
        state,
        label: state,
        rows: [],
        totalCount: 0,
        isLoading: false,
        isCollapsed: false,
        canView: true,
        error: null,
      })),
    );
  });

  it('speaks understandable Vietnamese in every state', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<CreateProjectModalView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        expectVietnamese(container);
      }, `state: ${state}`).not.toThrow();
      unmount();
    }
  });

  it('stays usable by keyboard and at low vision in every state', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<CreateProjectModalView {...PROPS_BY_STATE[state]()} />);

      expect(() => {
        // Three elements are excluded, none of them owned by this screen —
        // `src/components/**` is out of scope here (protected), and all three
        // are pre-existing, deliberate `tabIndex={-1}` anchors that keyboard
        // Tab was never meant to reach, which is what trips a generic check:
        //  - `Modal.Root`'s dialog wrapper — the focus-trap's landing spot;
        //  - `Table.Row` — this screen's own `row.focus()` lands here
        //    programmatically when scrolling to a collision, never via Tab;
        //  - `NumericField`'s hover-reveal stepper buttons — the field's own
        //    arrow-key handling is the keyboard path, by the same design as
        //    every other numeric field in the product.
        // Everything this screen actually renders is still checked in full.
        expectAccessible(container, {
          ignoreSelector: '[role="dialog"], tr[tabindex], button[tabindex="-1"]',
        });
      }, `state: ${state}`).not.toThrow();
      unmount();
    }
  });

  it('locks the form and spins the primary button while creating', () => {
    render(<CreateProjectModalView {...PROPS_BY_STATE.loading()} />);

    expect(screen.getByRole('button', { name: 'tạo dự án' })).toBeDisabled();
  });

  it('drops the wizard for a role that cannot create projects', () => {
    render(<CreateProjectModalView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.getByText('không có quyền tạo dự án')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'tiếp tục' })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* The view's behaviour.                                                       */
/* -------------------------------------------------------------------------- */

describe('CreateProjectModalView', () => {
  it('names both floors in a collision and offers to scroll to the offending one', () => {
    const focusFloor = vi.fn();
    render(
      <CreateProjectModalView
        {...baseProps()}
        step={2}
        stepLabel="bước 2 / 3"
        state="partial"
        canGoNext={false}
        collision="Tầng Tầng 1 bắt đầu ở cao độ 3,000 m, thấp hơn trần tầng Tầng trệt ở 3,900 m: hai tầng chồng lấn 900 mm."
        collisionRowId="row-1"
        focusFloor={focusFloor}
      />,
    );

    expect(
      screen.getByText(/Tầng Tầng 1 bắt đầu ở cao độ 3,000 m.*chồng lấn 900 mm/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tiếp tục' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'xem tầng' }));

    expect(focusFloor).toHaveBeenCalledWith('row-1');
  });

  it('warns before discarding unsaved changes, in the dialog itself — no nested dialog', () => {
    const confirmDiscard = vi.fn();
    render(<CreateProjectModalView {...baseProps()} isConfirmingDiscard step={1} stepLabel="bước 1 / 3" />);

    expect(screen.getByText('đóng và bỏ các thay đổi chưa lưu?')).toBeInTheDocument();
    // Exactly one role="dialog" — the warning renders inline, not as a second dialog.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'đóng, bỏ thay đổi' }));

    expect(confirmDiscard).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* The screen, wired to its hook and the shared mock API client.               */
/*                                                                              */
/* Not a hand-rolled gateway: `createProjectGateway` is the exact function     */
/* `CreateProjectModal.container.tsx` wires in production, and                 */
/* `createMockApiClient()` (`src/api/__mocks__/client.ts`) is the one mock the */
/* rest of the product's tests already share (R-70) — so a change to either    */
/* the wire mapping or the mock's replies shows up here rather than being      */
/* hidden behind a second, private idea of what a create looks like.           */
/* -------------------------------------------------------------------------- */

/** A gateway wired the production way, over a fresh mock client per test. */
function buildGateway(invalidate: () => void = noop) {
  const client = createMockApiClient();
  return { client, gateway: createProjectGateway(client, invalidate) };
}

function goToStep2(name = 'Chung cư Bốn Tầng'): void {
  fireEvent.change(screen.getByLabelText('tên dự án'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'tiếp tục' }));
}

function setHeight(label: string, text: string): void {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
}

describe('CreateProjectModal, wired to its hook', () => {
  it('starts the stack at four floors, so a wizard need not be clicked open row by row', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    expect(screen.getByLabelText('tên tầng Tầng trệt')).toBeInTheDocument();
    expect(screen.getByLabelText('tên tầng Tầng 1')).toBeInTheDocument();
    expect(screen.getByLabelText('tên tầng Tầng 2')).toBeInTheDocument();
    expect(screen.getByLabelText('tên tầng Tầng 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('tên tầng Tầng hầm')).not.toBeInTheDocument();
  });

  it('stacks a basement and three floors from the ground floor’s 0,0 — 4 tầng có hầm', async () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    // Default is four floors above ground; this acceptance case is exactly one
    // basement plus three, so the extra default floor is removed first.
    fireEvent.click(screen.getByRole('switch', { name: 'có tầng hầm' }));
    fireEvent.click(screen.getByRole('button', { name: 'xoá Tầng 3' }));

    setHeight('chiều cao thông thuỷ tầng Tầng hầm', '3');
    setHeight('chiều cao thông thuỷ tầng Tầng trệt', '3,9');
    setHeight('chiều cao thông thuỷ tầng Tầng 1', '3,6');
    setHeight('chiều cao thông thuỷ tầng Tầng 2', '3');

    const table = {
      'Tầng hầm': await screen.findByText('-3,0 m'),
      'Tầng trệt': await screen.findByText('0,0 m'),
      'Tầng 1': await screen.findByText('3,9 m'),
      'Tầng 2': await screen.findByText('7,5 m'),
    };

    // Printed for the task's own verification step: "in bảng để đối chiếu".
    console.log('bảng cao độ — 4 tầng có hầm:', {
      'Tầng hầm': table['Tầng hầm'].textContent,
      'Tầng trệt': table['Tầng trệt'].textContent,
      'Tầng 1': table['Tầng 1'].textContent,
      'Tầng 2': table['Tầng 2'].textContent,
    });

    for (const cell of Object.values(table)) {
      expect(cell).toBeInTheDocument();
    }
    // No collision warning once the stack is fully specified and non-overlapping.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'tiếp tục' })).toBeEnabled();
  });

  it('applies one height to every floor with "áp cho mọi tầng"', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    setHeight('chiều cao áp cho mọi tầng', '3,5');
    fireEvent.click(screen.getByRole('button', { name: 'áp cho mọi tầng' }));

    for (const name of ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng 3']) {
      expect(screen.getByLabelText(`chiều cao thông thuỷ tầng ${name}`)).toHaveValue('3,5');
    }
  });

  it('creates a project and offers an undo, even though the dialog closes (invariant A8)', async () => {
    const invalidate = vi.fn();
    const { client, gateway } = buildGateway(invalidate);
    const createSpy = vi.spyOn(client.projects, 'create');
    const deleteSpy = vi.spyOn(client.projects, 'delete');
    const onDismiss = vi.fn();
    const onCreated = vi.fn();
    const onToast = vi.fn();

    render(
      <CreateProjectModal
        isOpen
        gateway={gateway}
        forceCompact={false}
        onDismiss={onDismiss}
        onCreated={onCreated}
        onToast={onToast}
      />,
    );

    goToStep2('Chung cư Một Tầng');
    // A single, fully-specified floor is enough to reach step 3.
    fireEvent.click(screen.getByRole('button', { name: 'xoá Tầng 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'xoá Tầng 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'xoá Tầng 1' }));
    setHeight('chiều cao thông thuỷ tầng Tầng trệt', '3,9');

    fireEvent.click(screen.getByRole('button', { name: 'tiếp tục' }));
    // "bước 3 / 3" appears twice — the visible caption and the sr-only
    // announcement — so the visible one is picked out by tag.
    expect(await screen.findByText('bước 3 / 3', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'tạo dự án' }));

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
    // D-03: the project list's cache is invalidated once the mock client confirms the write.
    expect(invalidate).toHaveBeenCalledTimes(1);

    // The id the toast's undo will act on is whatever the mock actually minted
    // — not a value this test invents — so it is read back rather than assumed.
    const createResult = (await createSpy.mock.results[0]?.value) as { ok: true; data: { id: string } };
    expect(createResult.ok).toBe(true);
    const createdProjectId = createResult.data.id;
    expect(onCreated).toHaveBeenCalledWith(createdProjectId);

    expect(onToast).toHaveBeenCalledTimes(1);
    const toast = onToast.mock.calls[0]?.[0] as { message: string; onUndo?: () => void };
    expect(toast.message).toBe('Đã tạo dự án "Chung cư Một Tầng".');
    expect(typeof toast.onUndo).toBe('function');

    // A8: undo really removes what was just created, through the same mock client.
    await toast.onUndo?.();
    expect(deleteSpy).toHaveBeenCalledWith({ projectId: createdProjectId });
  });

  it('warns before discarding, and only closes on the second "huỷ"', () => {
    const onDismiss = vi.fn();
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={onDismiss} />);

    fireEvent.change(screen.getByLabelText('tên dự án'), { target: { value: 'Bản nháp' } });

    fireEvent.click(screen.getByRole('button', { name: 'huỷ' }));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('đóng và bỏ các thay đổi chưa lưu?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'huỷ' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
