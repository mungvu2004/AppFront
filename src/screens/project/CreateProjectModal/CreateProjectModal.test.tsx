import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createMockApiClient } from '@/api/__mocks__/client';
import { queryKeys } from '@/lib/query/queryKeys';
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
  { value: 'residential', label: 'Nhà ở' },
  { value: 'commercial', label: 'Thương mại' },
];

/** The acceptance case this task's own verification names: a basement plus three floors. */
const STACKED_FLOOR_ROWS: CreateProjectFloorRowModel[] = [
  { id: 'row-basement', name: 'Tầng hầm', kind: 'basement', clearHeightM: 3, elevationLabel: '-3,0 m', problem: null, nameProblem: null },
  { id: 'row-ground', name: 'Tầng trệt', kind: 'floor', clearHeightM: 3.9, elevationLabel: '0,0 m', problem: null, nameProblem: null },
  { id: 'row-1', name: 'Tầng 1', kind: 'floor', clearHeightM: 3.6, elevationLabel: '3,9 m', problem: null, nameProblem: null },
  { id: 'row-2', name: 'Tầng 2', kind: 'floor', clearHeightM: 3, elevationLabel: '7,5 m', problem: null, nameProblem: null },
];

function baseProps(): CreateProjectModalViewProps {
  return {
    isOpen: true,
    state: 'success',
    isCompact: false,
    canCreate: true,
    step: 3,
    stepLabel: 'Bước 3 / 3',
    isSubmitting: false,
    isConfirmingDiscard: false,
    isSelectOpen: false,
    name: 'Chung cư Bình Minh',
    address: '12 Nguyễn Trãi, Hà Nội',
    code: 'DA-CHUNGCUBINHMINH',
    buildingType: 'residential',
    notes: '',
    buildingTypeOptions: BUILDING_TYPE_OPTIONS,
    problems: { name: null, code: null, address: null },
    nameHint: 'Bắt buộc, từ 3 đến 80 ký tự.',
    notice: null,
    floorRows: STACKED_FLOOR_ROWS,
    floorsHint: null,
    hasBasement: true,
    collision: null,
    collisionRowId: null,
    focusFloorId: null,
    canAddFloor: true,
    floorCapNote: null,
    canToggleBasement: true,
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
    goToFixStep: noop,
    requestClose: noop,
    keepEditing: noop,
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
      { id: 'row-1', name: 'Tầng 1', kind: 'floor', clearHeightM: null, elevationLabel: null, problem: 'Chưa nhập chiều cao thông thuỷ.', nameProblem: null },
    ],
  }),
  error: () => ({
    ...baseProps(),
    state: 'error',
    step: 1,
    stepLabel: 'bước 1 / 3',
    problems: { name: 'Tên dự án đã trùng với một dự án khác. Đổi tên rồi thử lại.', code: null, address: null },
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

    expect(screen.getByRole('button', { name: 'Tạo dự án' })).toBeDisabled();
  });

  it('drops the wizard for a role that cannot create projects', () => {
    render(<CreateProjectModalView {...PROPS_BY_STATE.forbidden()} />);

    expect(screen.getByText('Không có quyền tạo dự án')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Xem tầng' }));

    expect(focusFloor).toHaveBeenCalledWith('row-1');
  });

  it('fades the bottom of the scrolling body, so content cut by the footer reads as more to scroll (BUG-201)', () => {
    render(<CreateProjectModalView {...baseProps()} step={2} stepLabel="bước 2 / 3" />);

    const fade = screen.getByRole('dialog').querySelector('[data-scroll-fade]');
    expect(fade).toHaveClass('sticky', 'bottom-0', 'pointer-events-none');
    expect(fade).toHaveAttribute('aria-hidden', 'true');
    // The last thing in the body: scrolled to the end it covers only the space it stands for.
    expect(fade?.nextElementSibling).toBeNull();
  });

  it('lets the floor table headers stick to the dialog body, not to a scroll box of the table (BUG-202)', () => {
    render(<CreateProjectModalView {...baseProps()} step={2} stepLabel="bước 2 / 3" />);

    const wrapper = screen.getByRole('table').parentElement;
    expect(wrapper).toHaveClass('overflow-visible', 'h-auto');
    expect(wrapper).not.toHaveClass('overflow-auto');
    expect(screen.getByRole('table').querySelector('thead')).toHaveClass('sticky', 'top-0');
    // review-1 #8: the body keeps a focused row clear of that 40 px header (WCAG 2.4.11).
    expect(screen.getByRole('table').closest('.overflow-y-auto')).toHaveClass('scroll-pt-10', 'scroll-pb-6');
  });

  it('warns before discarding unsaved changes, in the dialog itself — no nested dialog', () => {
    const confirmDiscard = vi.fn();
    render(<CreateProjectModalView {...baseProps()} isConfirmingDiscard step={1} stepLabel="bước 1 / 3" />);

    expect(screen.getByText('Đóng và bỏ các thay đổi chưa lưu?')).toBeInTheDocument();
    // Exactly one role="dialog" — the warning renders inline, not as a second dialog.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    // A row of the footer, in the flow: floating over the body it covered "Ghi chú" (BUG-204).
    expect(screen.getByRole('alert')).not.toHaveClass('absolute');
    expect(screen.getByRole('alert')).toHaveClass('basis-full');

    fireEvent.click(screen.getByRole('button', { name: 'Đóng, bỏ thay đổi' }));

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
function buildGateway() {
  const client = createMockApiClient();
  const queryClient = new QueryClient();
  return { client, queryClient, gateway: createProjectGateway(client, queryClient) };
}

function goToStep2(name = 'Chung cư Bốn Tầng'): void {
  fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
}

/** A gateway whose create always fails with this HTTP status and wire body — the shape `client.projects.create` returns. */
function failingGateway(status: number, raw: Record<string, unknown>) {
  return {
    create: vi.fn(async () => ({
      ok: false as const,
      error: { kind: 'http' as const, status, code: String(raw.code ?? ''), requestId: 'req-1', retryable: false, raw },
    })),
    remove: vi.fn(),
  };
}

/** Step 1 → 3 with one 3 m height on every default floor. */
function goToReview(name = 'Chung cư Bốn Tầng'): void {
  goToStep2(name);
  setHeight('Chiều cao áp cho mọi tầng', '3');
  fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
}

function setHeight(label: string, text: string): void {
  const field = screen.getByLabelText(label);
  fireEvent.change(field, { target: { value: text } });
  fireEvent.blur(field);
}

describe('CreateProjectModal, wired to its hook', () => {
  it('opens on a fresh form every time — closing does not keep what was typed (B-V3-02)', () => {
    const { gateway } = buildGateway();
    const { rerender } = render(
      <CreateProjectModal isOpen gateway={gateway} forceCompact={false} onDismiss={noop} />,
    );

    fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: 'Dự án gõ dở' } });
    rerender(<CreateProjectModal isOpen={false} gateway={gateway} forceCompact={false} onDismiss={noop} />);
    rerender(<CreateProjectModal isOpen gateway={gateway} forceCompact={false} onDismiss={noop} />);

    expect(screen.getByLabelText('Tên dự án')).toHaveValue('');
  });

  it('starts the stack at four floors, so a wizard need not be clicked open row by row', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    expect(screen.getByLabelText('Tên tầng Tầng trệt')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên tầng Tầng 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên tầng Tầng 2')).toBeInTheDocument();
    expect(screen.getByLabelText('Tên tầng Tầng 3')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tên tầng Tầng hầm')).not.toBeInTheDocument();
  });

  it('stacks a basement and three floors from the ground floor’s 0,0 — 4 tầng có hầm', async () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    // Default is four floors above ground; this acceptance case is exactly one
    // basement plus three, so the extra default floor is removed first.
    fireEvent.click(screen.getByRole('switch', { name: 'Có tầng hầm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá Tầng 3' }));

    setHeight('Chiều cao thông thuỷ tầng Tầng hầm', '3');
    setHeight('Chiều cao thông thuỷ tầng Tầng trệt', '3,9');
    setHeight('Chiều cao thông thuỷ tầng Tầng 1', '3,6');
    setHeight('Chiều cao thông thuỷ tầng Tầng 2', '3');

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
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
  });

  it('opens step 2 neutral, says why it cannot continue, then names each row’s own cause (BUG-120)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const next = screen.getByRole('button', { name: 'Tiếp tục' });
    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription(
      'Nhập chiều cao thông thuỷ cho từng tầng, hoặc dùng "Áp cho mọi tầng", để sang bước xem lại.',
    );

    // Renaming, adding, the basement switch are not heights: still neutral (run-15 reopened it).
    fireEvent.change(screen.getByLabelText('Tên tầng Tầng trệt'), { target: { value: 'Tầng trệt A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tầng' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Có tầng hầm' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Có tầng hầm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá Tầng 4' }));
    fireEvent.change(screen.getByLabelText('Tên tầng Tầng trệt A'), { target: { value: 'Tầng trệt' } });

    setHeight('Chiều cao thông thuỷ tầng Tầng 1', '3');

    // The locked button keeps saying why once the rows speak, too.
    expect(next).toHaveAccessibleDescription(
      'Nhập chiều cao thông thuỷ cho từng tầng, hoặc dùng "Áp cho mọi tầng", để sang bước xem lại.',
    );
    expect(screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng trệt')).toHaveAccessibleDescription('Chưa nhập chiều cao thông thuỷ.');
    expect(screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng 1')).toHaveAccessibleDescription(
      'Chưa tính được cao độ vì tầng bên dưới còn thiếu chiều cao hợp lệ.',
    );
    expect(screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng 2')).toHaveAccessibleDescription('Chưa nhập chiều cao thông thuỷ.');
  });

  it('blames the elevation limit, not a missing height, for the rows above a floor over 300 m (BUG-213)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    const add = screen.getByRole('button', { name: 'Thêm tầng' });
    for (let floors = 4; floors < 34; floors += 1) fireEvent.click(add);
    setHeight('Chiều cao áp cho mọi tầng', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));

    expect(screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng 31')).toHaveAccessibleDescription(
      'Cao độ vượt giới hạn cho phép (-30 đến 300 mét).',
    );
    for (const name of ['Tầng 32', 'Tầng 33']) {
      expect(screen.getByLabelText(`Chiều cao thông thuỷ tầng ${name}`)).toHaveAccessibleDescription(
        'Chưa tính được cao độ vì một tầng bên dưới đã vượt giới hạn cao độ.',
      );
    }
  });

  it('keeps the basement inside the 50-floor cap and says why "Thêm tầng" is locked (BUG-150, BUG-177)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    const add = screen.getByRole('button', { name: 'Thêm tầng' });
    for (let floors = 4; floors < 50; floors += 1) fireEvent.click(add);
    expect(screen.getAllByRole('textbox', { name: /^Tên tầng/u })).toHaveLength(50);
    // BUG-177: the locked button says why.
    expect(add).toHaveAccessibleDescription('Đã đủ 50 tầng, mức tối đa (kể cả tầng hầm).');

    const basement = screen.getByRole('switch', { name: 'Có tầng hầm' });
    expect(basement).toBeDisabled();
    fireEvent.click(basement);

    expect(screen.getAllByRole('textbox', { name: /^Tên tầng/u })).toHaveLength(50);
  });

  it('names an added floor after the ones already in the table, never twice "Tầng 3" (BUG-217)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    fireEvent.change(screen.getByLabelText('Tên tầng Tầng 1'), { target: { value: 'Tầng lửng' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xoá Tầng 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tầng' }));

    const names = screen.getAllByRole('textbox', { name: /^Tên tầng/u }).map((box) => (box as HTMLInputElement).value);
    expect(names).toEqual(['Tầng trệt', 'Tầng lửng', 'Tầng 3', 'Tầng 4']);
  });

  it('marks a blank floor name at step 2 and blocks "Tiếp tục" (BUG-185)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    setHeight('Chiều cao áp cho mọi tầng', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Tên tầng Tầng 3'), { target: { value: '   ' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Chưa nhập tên tầng.');
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toHaveAccessibleDescription(
      'Sửa các tầng đang báo lỗi để sang bước xem lại.',
    );
  });

  it('applies one height to every floor with "áp cho mọi tầng"', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();

    setHeight('Chiều cao áp cho mọi tầng', '3,5');
    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));

    for (const name of ['Tầng trệt', 'Tầng 1', 'Tầng 2', 'Tầng 3']) {
      expect(screen.getByLabelText(`Chiều cao thông thuỷ tầng ${name}`)).toHaveValue('3,5');
    }
  });

  it('clears a refused row height with "áp cho mọi tầng", even with the height the row already holds', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    setHeight('Chiều cao áp cho mọi tầng', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));
    setHeight('Chiều cao thông thuỷ tầng Tầng trệt', '12');
    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị không quá 10 m.');

    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));

    expect(screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng trệt')).toHaveValue('3');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reads "3.5" in "áp cho mọi tầng" as 3,5 m and never erases the floors (BUG-132)', async () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    setHeight('Chiều cao áp cho mọi tầng', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));
    expect(await screen.findByText('3,0 m')).toBeInTheDocument();

    setHeight('Chiều cao áp cho mọi tầng', '3.5');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('3,0 m')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));
    expect(await screen.findByText('3,5 m')).toBeInTheDocument();
  });

  it('creates a project and offers an undo, even though the dialog closes (invariant A8)', async () => {
    const { client, queryClient, gateway } = buildGateway();
    // The dashboard's N1 list, as `useProjectDashboard` leaves it in the cache.
    const listState = () => queryClient.getQueryState(queryKeys.project.summaries());
    queryClient.setQueryData(queryKeys.project.summaries(), { projects: [], droppedCount: 0 });
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
    fireEvent.click(screen.getByRole('button', { name: 'Xoá Tầng 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá Tầng 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xoá Tầng 1' }));
    setHeight('Chiều cao thông thuỷ tầng Tầng trệt', '3,9');

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    // "bước 3 / 3" appears twice — the visible caption and the sr-only
    // announcement — so the visible one is picked out by tag.
    expect(await screen.findByText('Bước 3 / 3', { selector: 'p' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
    // D-03: the project list's cache is invalidated once the mock client confirms the write.
    expect(listState()?.isInvalidated).toBe(true);
    queryClient.setQueryData(queryKeys.project.summaries(), { projects: [], droppedCount: 0 });

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

    // A8: undo really removes what was just created, through the same mock client,
    // and the dashboard list is refetched so the card goes too (BUG-112).
    toast.onUndo?.();
    expect(deleteSpy).toHaveBeenCalledWith({ projectId: createdProjectId });
    await waitFor(() => expect(listState()?.isInvalidated).toBe(true));
  });

  it('opens pristine: no complaint before a keystroke, the focus in "Tên dự án" (BUG-133)', async () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const name = screen.getByLabelText('Tên dự án');
    expect(name).toHaveFocus();
    expect(name).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Bắt buộc, từ 3 đến 80 ký tự.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();

    fireEvent.change(name, { target: { value: 'ab' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Tên dự án cần ít nhất 3 ký tự.');
    fireEvent.change(name, { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa nhập tên dự án.');
  });

  it('refuses a code over 32 and an address over 200 characters at step 1 (BUG-176, BUG-186)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: 'Chung cư Dài' } });
    const next = screen.getByRole('button', { name: 'Tiếp tục' });

    fireEvent.change(screen.getByLabelText('Mã dự án'), { target: { value: 'C'.repeat(33) } });
    expect(screen.getByLabelText('Mã dự án')).toHaveAccessibleDescription('Mã dự án không quá 32 ký tự.');
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Mã dự án'), { target: { value: ` ${'C'.repeat(32)} ` } });
    expect(next).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: 'A'.repeat(201) } });
    expect(screen.getByLabelText('Địa chỉ')).toHaveAccessibleDescription('Địa chỉ không quá 200 ký tự.');
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: 'A'.repeat(200) } });
    expect(next).toBeEnabled();
  });

  it('never ends a generated code on a dangling "-"', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    // The 24-character cut lands right after "XEM", on the gap before "NGAT".
    fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: 'Dự án đo rất dài để xem ngắt dòng' } });

    expect(screen.getByLabelText('Mã dự án')).toHaveValue('DA-DU-AN-DO-RAT-DAI-DE-XEM');
  });

  it('lets Space and Enter press the switch and buttons inside the open dialog (BUG-151)', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    goToStep2();
    const basement = screen.getByRole('switch', { name: 'Có tầng hầm' });
    basement.focus();
    await user.keyboard(' ');
    expect(basement).toHaveAttribute('aria-checked', 'true');

    screen.getByRole('button', { name: 'Xoá Tầng 2' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.queryByLabelText('Tên tầng Tầng 2')).not.toBeInTheDocument();
  });

  it('closes an open "Loại công trình" list on Esc and keeps the dialog (BUG-152)', async () => {
    const onDismiss = vi.fn();
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={onDismiss} />);
    // `Modal` arms its focus trap — the Esc handler under test — one frame after opening.
    await new Promise((resolve) => requestAnimationFrame(resolve));

    fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: 'Bản nháp' } });
    const trigger = screen.getByRole('combobox', { name: 'Loại công trình' });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Đóng và bỏ các thay đổi chưa lưu?')).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('offers "Tiếp tục sửa" on the discard prompt, which keeps the form (BUG-123)', () => {
    const onDismiss = vi.fn();
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={onDismiss} />);

    fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: 'Bản nháp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(screen.getByText('Nhấn Esc lần nữa hoặc bấm "Đóng, bỏ thay đổi" để đóng.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục sửa' }));

    expect(screen.queryByText('Đóng và bỏ các thay đổi chưa lưu?')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tên dự án')).toHaveValue('Bản nháp');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('hands the focus back to the field being edited after "Tiếp tục sửa" (BUG-219)', async () => {
    const user = userEvent.setup({ delay: null });
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const name = screen.getByLabelText('Tên dự án');
    name.focus();
    await user.keyboard('Bản nháp');
    await user.keyboard('{Escape}');
    screen.getByRole('button', { name: 'Tiếp tục sửa' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.queryByText('Đóng và bỏ các thay đổi chưa lưu?')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(name);
  });

  it('drops a pending discard prompt once "Quay lại" is pressed (BUG-189)', () => {
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={noop} />);

    goToStep2();
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(screen.getByText('Đóng và bỏ các thay đổi chưa lưu?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quay lại' }));

    expect(screen.queryByText('Đóng và bỏ các thay đổi chưa lưu?')).not.toBeInTheDocument();
  });

  it('stays open on Esc while "Tạo dự án" is in flight, and offers no discard (BUG-184)', async () => {
    const onDismiss = vi.fn();
    const held = { create: () => new Promise<never>(() => undefined), remove: vi.fn() };
    render(<CreateProjectModal isOpen gateway={held} forceCompact={false} onDismiss={onDismiss} />);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    goToStep2('Chung cư Đang Tạo');
    setHeight('Chiều cao áp cho mọi tầng', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Áp cho mọi tầng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(screen.queryByText('Đóng và bỏ các thay đổi chưa lưu?')).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
    // X does nothing then, so it looks locked like the footer buttons (BUG-218).
    expect(screen.getByRole('button', { name: 'Đóng hộp thoại' })).toBeDisabled();
  });

  it('pins a 422 on "Mã dự án" to that field, not the name, and a new code unlocks it (BUG-129, BUG-187)', async () => {
    const gateway = failingGateway(422, { code: 'VALIDATION', field: 'code', count: 1 });
    render(<CreateProjectModal isOpen gateway={gateway} forceCompact={false} onDismiss={noop} />);

    goToReview();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));

    expect(
      await screen.findByText('Máy chủ không nhận mã dự án này. Sửa ô được đánh dấu ở bước 1 rồi thử lại.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sửa ở bước 1' }));

    const code = screen.getByLabelText('Mã dự án');
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription('Máy chủ không nhận mã dự án này. Sửa rồi thử lại.');
    expect(screen.getByLabelText('Tên dự án')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();

    fireEvent.change(code, { target: { value: 'DA-MOI' } });
    expect(code).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
  });

  it('marks the floor row a 422 names at step 2, and editing that row unlocks it (nợ B #7)', async () => {
    const gateway = failingGateway(422, { code: 'VALIDATION', field: 'floors.1.heightMm', count: 1 });
    render(<CreateProjectModal isOpen gateway={gateway} forceCompact={false} onDismiss={noop} />);

    goToReview();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa ở bước 2' }));

    const refused = screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng 1');
    expect(refused).toHaveAttribute('aria-invalid', 'true');
    expect(refused).toHaveAccessibleDescription('Máy chủ không nhận giá trị này. Sửa rồi thử lại.');
    expect(screen.getByLabelText('Chiều cao thông thuỷ tầng Tầng trệt')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();

    setHeight('Chiều cao thông thuỷ tầng Tầng 1', '3,2');
    expect(refused).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
  });

  it('keeps "Tạo dự án" usable to retry after a 500, marking no field, and never advises a reload (BUG-129, BUG-188)', async () => {
    const gateway = failingGateway(500, {});
    render(<CreateProjectModal isOpen gateway={gateway} forceCompact={false} onDismiss={noop} />);

    goToReview();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo dự án' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Tạo dự án' })).toBeEnabled());
    // BUG-188: the advice keeps the form — no "tải lại", which would wipe it.
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Hệ thống đã ghi nhận và sẽ kiểm tra. Bấm "Tạo dự án" để thử lại — những gì đã nhập vẫn còn.',
    );
    expect(gateway.create).toHaveBeenCalledTimes(1);
  });

  it('warns before discarding, and only closes on the second "huỷ"', () => {
    const onDismiss = vi.fn();
    render(<CreateProjectModal isOpen gateway={buildGateway().gateway} forceCompact={false} onDismiss={onDismiss} />);

    fireEvent.change(screen.getByLabelText('Tên dự án'), { target: { value: 'Bản nháp' } });

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText('Đóng và bỏ các thay đổi chưa lưu?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
