/**
 * Bộ kiểm của W3 cho tấm trượt `ViolationDetail` (S-34).
 *
 * ## Vì sao import `./ViolationDetail` đi qua biến, không qua chuỗi tĩnh
 *
 * `./ViolationDetail` (view) và `./useViolationDetail`/`./ViolationDetail.container`
 * (hook, container) là việc của hai worker khác, và tại thời điểm viết file này
 * CHƯA tồn tại trong worktree của W3 — mỗi worker lớp 2 dựng trên nhánh riêng của
 * mình rồi lớp gộp mới ghép lại. Một `import` TĨNH của một chuỗi không tồn tại làm
 * Vite sập lúc transform và KHÔNG MỘT test nào trong cả file chạy được. Cách duy
 * nhất hoãn việc phân giải sang đúng lúc CHẠY (để một import hỏng chỉ làm hỏng
 * ĐÚNG một `it`) là giấu chuỗi đường dẫn sau một biến, kèm `/* @vite-ignore *\/` —
 * xem {@link importFromScreen}. Nhờ vậy các test không cần view thật (đếm nguyên
 * nhân trên dữ liệu mẫu, kiểm mã màu thô trên cả thư mục…) chạy XANH ngay hôm nay;
 * các test cần view thật thì HỎNG RIÊNG LẺ với "Failed to resolve" — đúng kết quả
 * mà lớp này phải có, không cần sửa gì khi lớp gộp đã có đủ `ViolationDetail.tsx`.
 *
 * `import type` (xoá hẳn lúc biên dịch) từ `./types` thì an toàn dùng thẳng — file
 * đó đã đóng băng trên nhánh hợp đồng.
 *
 * ## Dữ liệu mẫu
 *
 * Không mảng viết tay: `SUCCESS_ARGS` dựng từ một lượt `runRules()` THẬT trên
 * `CLEAN_BUILDING_SCENARIO` (bộ mẫu chuẩn A14), lọc lấy một vi phạm
 * `FURNITURE-CLASH` thật (đồ đạc chồng tường/nhau) — hợp lý cho hành động
 * "xoá đối tượng". `PARTIAL_ARGS` dùng vi phạm `WALL-THICKNESS` thật trên
 * `VIOLATED_BUILDING_SCENARIO` — tường mỏng không có hành động tự động nào sửa
 * được (không phải xoá, không phải đổi tên phòng), nên đúng nghĩa trạng thái 3
 * "một phần" của màn này (types.ts: "không có cách sửa tự động nào bật được").
 * Độ tin cậy (`confidenceLabel`) lấy THẬT từ `ReviewMetadata.confidence` của
 * chính thực thể đó, định dạng qua `formatNumber` (dấu phẩy, A15) — không bịa số.
 *
 * Nội dung câu chữ của `causes`/`actions` là dữ liệu KIỂM THỬ tự viết (giống
 * `RuleReport.test.tsx` tự viết `toRow`/`toGroups` để có props hợp lệ): hook (W1)
 * chưa tồn tại nên không có "logic sinh nguyên nhân" nào để gọi lại — đây không
 * phải viết lại logic của hook, chỉ là props hợp lệ theo đúng hình dạng
 * `ViolationCause`/`ViolationAction` mà `types.ts` mô tả, bám sát ví dụ minh hoạ ở
 * phán quyết G2 của CONTRACT.md ("nhận diện tự động có thể sai — độ tin cậy chỉ…").
 */

import type { ComponentType } from 'react';

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultRuleRegistry } from '@/domain/rules/defaults';
import { RULE_GROUP_LABELS, RULE_SEVERITY_LABELS } from '@/domain/rules/registry';
import type { Rule, Violation } from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import { isEntityOfKind, normalizeSpatial } from '@/domain/spatial/normalize';
import { formatNumber } from '@/lib/format/number';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { CLEAN_BUILDING_SCENARIO, VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { renderWithProviders } from '@/lib/testing/render';
import {
  SEVEN_STATES,
  createSevenStateScenarios,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';

import type {
  ViolationAction,
  ViolationCause,
  ViolationDetailCapabilities,
  ViolationDetailViewProps,
  ViolationObject,
} from './types';

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập `./ViolationDetail` qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */
async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadView(): Promise<ComponentType<ViolationDetailViewProps>> {
  const mod = await importFromScreen<{ ViolationDetail: ComponentType<ViolationDetailViewProps> }>(
    './ViolationDetail',
  );

  return mod.ViolationDetail;
}

function renderView(
  View: ComponentType<ViolationDetailViewProps>,
  props: ViolationDetailViewProps,
) {
  return renderWithProviders(<View {...props} />);
}

/* ==========================================================================
 * A. Dữ liệu mẫu — vi phạm THẬT từ runRules(), không phải mảng viết tay.
 * ========================================================================== */

const REGISTRY = createDefaultRuleRegistry();

function ruleOf(code: string): Rule {
  const rule = REGISTRY.get(code);

  if (rule === null) {
    throw new Error(`không tìm thấy luật "${code}" trong sổ đăng ký`);
  }

  return rule;
}

/** Nhóm 1 — `FURNITURE-CLASH` thật trên bộ mẫu "sạch": đồ đạc chồng tường/nhau. */
const NORMALIZED_CLEAN = normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph);
const CLEAN_RESULT = runRules(NORMALIZED_CLEAN, { registry: REGISTRY });

const SUCCESS_VIOLATION = CLEAN_RESULT.violations.find(
  (violation) => violation.ruleCode === 'FURNITURE-CLASH',
);

if (SUCCESS_VIOLATION === undefined) {
  throw new Error('CLEAN_BUILDING_SCENARIO không còn vi phạm FURNITURE-CLASH nào — cập nhật lại mẫu');
}

const SUCCESS_RULE = ruleOf(SUCCESS_VIOLATION.ruleCode);
const SUCCESS_ENTITY = NORMALIZED_CLEAN.byId[SUCCESS_VIOLATION.entityId];

if (SUCCESS_ENTITY === undefined || !isEntityOfKind('furniture', SUCCESS_ENTITY)) {
  throw new Error(`entityId "${SUCCESS_VIOLATION.entityId}" không phải một đồ đạc thật`);
}

const SUCCESS_CONFIDENCE_LABEL = formatNumber(SUCCESS_ENTITY.confidence, { fractionDigits: 2 });

const SUCCESS_CAUSES: readonly ViolationCause[] = [
  {
    id: 'confidence',
    text: `nhận diện tự động có thể sai — độ tin cậy chỉ ${SUCCESS_CONFIDENCE_LABEL}`,
  },
  {
    id: 'rule-group',
    text: `đồ đạc có thể đã được đặt sai vị trí trong bước dựng mô hình, vì đây là luật thuộc nhóm ${RULE_GROUP_LABELS[SUCCESS_RULE.group]}`,
  },
];

const SUCCESS_OBJECTS: readonly ViolationObject[] = [
  {
    entityId: SUCCESS_ENTITY.id,
    kindLabel: 'đồ đạc',
    confidenceLabel: SUCCESS_CONFIDENCE_LABEL,
    isSubject: true,
  },
];

const SUCCESS_ACTIONS: readonly ViolationAction[] = [
  {
    kind: 'deleteObject',
    label: 'xoá đối tượng',
    description: 'gỡ đồ đạc khỏi mô hình; hoàn tác được trong 8 giây.',
    affectedEntityIds: [SUCCESS_ENTITY.id],
  },
];

/** Nhóm 2 — `WALL-THICKNESS` thật: không hành động tự động nào sửa được (trạng thái 3). */
const NORMALIZED_VIOLATED = normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph);
const VIOLATED_RESULT = runRules(NORMALIZED_VIOLATED, { registry: REGISTRY });

const PARTIAL_VIOLATION = VIOLATED_RESULT.violations.find(
  (violation) => violation.ruleCode === 'WALL-THICKNESS',
);

if (PARTIAL_VIOLATION === undefined) {
  throw new Error('VIOLATED_BUILDING_SCENARIO không còn vi phạm WALL-THICKNESS nào — cập nhật lại mẫu');
}

const PARTIAL_RULE = ruleOf(PARTIAL_VIOLATION.ruleCode);
const PARTIAL_ENTITY = NORMALIZED_VIOLATED.byId[PARTIAL_VIOLATION.entityId];

if (PARTIAL_ENTITY === undefined || !isEntityOfKind('wall', PARTIAL_ENTITY)) {
  throw new Error(`entityId "${PARTIAL_VIOLATION.entityId}" không phải một bức tường thật`);
}

const PARTIAL_CONFIDENCE_LABEL = formatNumber(PARTIAL_ENTITY.confidence, { fractionDigits: 2 });

const PARTIAL_CAUSES: readonly ViolationCause[] = [
  {
    id: 'confidence',
    text: `nhận diện tự động có thể sai — độ tin cậy chỉ ${PARTIAL_CONFIDENCE_LABEL}`,
  },
  {
    id: 'rule-group',
    text: `bản vẽ gốc có thể đã ghi sai kích thước tường, vì đây là luật thuộc nhóm ${RULE_GROUP_LABELS[PARTIAL_RULE.group]}`,
  },
];

const PARTIAL_OBJECTS: readonly ViolationObject[] = [
  {
    entityId: PARTIAL_ENTITY.id,
    kindLabel: 'tường',
    confidenceLabel: PARTIAL_CONFIDENCE_LABEL,
    isSubject: true,
  },
];

/** Hàng "bỏ qua" — KHÔNG bao giờ có trong `SUCCESS_ACTIONS` thật (G3, canDismiss=false); dùng để thử độ vững của cổng năng lực. */
const DISMISS_ACTION: ViolationAction = {
  kind: 'dismiss',
  label: 'bỏ qua vi phạm này',
  description: 'đánh dấu đã xem xét và không cần sửa; ghi lại lý do.',
  affectedEntityIds: [SUCCESS_ENTITY.id],
};

const SAMPLE_ERROR_MESSAGE =
  'không xoá được: đối tượng đang được một hàng khác tham chiếu, thử lại sau ít phút.';

/** Bảng năng lực đã chốt ở CONTRACT.md mục 1. */
const BASE_CAPABILITIES: ViolationDetailCapabilities = {
  canEdit: true,
  canDeleteObject: true,
  canRenameRoom: true,
  canDismiss: false,
  canCompareMeasure: false,
  canPreview2d: true,
  canPreview3d: true,
  canShowConfidence: true,
};

/* ==========================================================================
 * B. Dựng props THẬT cho view thuần, theo bảy trạng thái chung.
 * ========================================================================== */

function emptyProps(): ViolationDetailViewProps {
  return {
    state: 'empty',
    capabilities: BASE_CAPABILITIES,
    groupLabel: '',
    group: null,
    title: '',
    severity: null,
    severityLabel: '',
    subjectEntityId: '',
    ruleSentence: '',
    measureLabel: null,
    thresholdLabel: null,
    objects: [],
    onSelectObject: vi.fn(),
    figureMode: '2d',
    onFigureModeChange: vi.fn(),
    previewEntityIds: null,
    causes: [],
    actions: [],
    onAction: vi.fn(),
    onActionHover: vi.fn(),
    dismissReason: '',
    onDismissReasonChange: vi.fn(),
    dismissReasonError: null,
    ruleCode: null,
    levelId: null,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    hasPrevious: false,
    hasNext: false,
    isAdvancing: false,
    onCancelAdvance: vi.fn(),
    errorMessage: null,
    resolvedMessage: null,
    onClose: vi.fn(),
  };
}

interface LoadedArgs {
  readonly violation: Violation;
  readonly rule: Rule;
  readonly objects: readonly ViolationObject[];
  readonly causes: readonly ViolationCause[];
  readonly actions: readonly ViolationAction[];
}

const SUCCESS_ARGS: LoadedArgs = {
  violation: SUCCESS_VIOLATION,
  rule: SUCCESS_RULE,
  objects: SUCCESS_OBJECTS,
  causes: SUCCESS_CAUSES,
  actions: SUCCESS_ACTIONS,
};

const PARTIAL_ARGS: LoadedArgs = {
  violation: PARTIAL_VIOLATION,
  rule: PARTIAL_RULE,
  objects: PARTIAL_OBJECTS,
  causes: PARTIAL_CAUSES,
  actions: [],
};

function loadedProps(args: LoadedArgs): ViolationDetailViewProps {
  return {
    state: 'success',
    capabilities: BASE_CAPABILITIES,
    groupLabel: RULE_GROUP_LABELS[args.rule.group],
    group: args.rule.group,
    title: args.violation.message,
    severity: args.rule.severity,
    severityLabel: RULE_SEVERITY_LABELS[args.rule.severity],
    subjectEntityId: args.violation.entityId,
    ruleSentence: args.rule.name,
    measureLabel: null,
    thresholdLabel: null,
    objects: args.objects,
    onSelectObject: vi.fn(),
    figureMode: '2d',
    onFigureModeChange: vi.fn(),
    previewEntityIds: null,
    causes: args.causes,
    actions: args.actions,
    onAction: vi.fn(),
    onActionHover: vi.fn(),
    dismissReason: '',
    onDismissReasonChange: vi.fn(),
    dismissReasonError: null,
    ruleCode: args.violation.ruleCode,
    levelId: args.violation.levelId,
    onPrevious: vi.fn(),
    onNext: vi.fn(),
    hasPrevious: true,
    hasNext: true,
    isAdvancing: false,
    onCancelAdvance: vi.fn(),
    errorMessage: null,
    resolvedMessage: null,
    onClose: vi.fn(),
  };
}

/**
 * Một `ViolationDetailViewProps` hợp lệ cho mỗi kịch bản trong bảy trạng thái
 * chung (A11 / R-63).
 *
 * `partial` dùng nguồn "không có cách sửa tự động nào bật được" (types.ts) —
 * `WALL-THICKNESS` không xoá được, không đổi tên phòng được.
 */
function propsFor(scenario: SevenStateScenario): ViolationDetailViewProps {
  if (scenario.state === 'empty') {
    return emptyProps();
  }

  if (scenario.state === 'loading') {
    return { ...emptyProps(), state: 'loading' };
  }

  if (scenario.state === 'partial') {
    return { ...loadedProps(PARTIAL_ARGS), state: 'partial' };
  }

  if (scenario.state === 'error') {
    return { ...loadedProps(SUCCESS_ARGS), state: 'error', errorMessage: SAMPLE_ERROR_MESSAGE };
  }

  if (scenario.state === 'forbidden') {
    return {
      ...loadedProps(SUCCESS_ARGS),
      state: 'forbidden',
      capabilities: { ...BASE_CAPABILITIES, canEdit: false },
    };
  }

  if (scenario.state === 'collapsed') {
    return { ...loadedProps(SUCCESS_ARGS), state: 'collapsed' };
  }

  return loadedProps(SUCCESS_ARGS);
}

function scenarioOf(state: SevenStateScenario['state']): SevenStateScenario {
  const found = createSevenStateScenarios().find((candidate) => candidate.state === state);

  if (found === undefined) {
    throw new Error(`bộ kịch bản không có trạng thái "${state}"`);
  }

  return found;
}

/* ==========================================================================
 * C. A11 — bảy trạng thái, không trạng thái nào ra màn trắng.
 * ========================================================================== */

describe('A11 — bảy trạng thái của ViolationDetail', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const View = await loadView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderView(View, propsFor(scenario));
    }, createSevenStateScenarios());

    console.log(
      `[W3] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* ==========================================================================
 * D. R-72 — expectAccessible, expectVietnamese. A1 — expectNoRawColor.
 * ========================================================================== */

describe('R-72 — expectAccessible và expectVietnamese trên cây render thật', () => {
  it('trạng thái "success" tiếp cận được và toàn chữ tiếng Việt có dấu', async () => {
    const View = await loadView();
    const { container } = renderView(View, propsFor(scenarioOf('success')));

    expectAccessible(container);
    expectVietnamese(container);
  });
});

describe('A1 — không mã màu thô trong cả thư mục màn', () => {
  it('expectNoRawColor không ném lỗi trên src/screens/rules/ViolationDetail', () => {
    expect(() => {
      expectNoRawColor('src/screens/rules/ViolationDetail');
    }).not.toThrow();
  });
});

/* ==========================================================================
 * E. G2 — luôn ít nhất hai nguyên nhân có thể (CẤM TUYỆT ĐỐI).
 * ========================================================================== */

describe('G2 — luôn ít nhất hai nguyên nhân có thể', () => {
  it('dữ liệu mẫu của cả hai vi phạm thật đều có >= 2 nguyên nhân', () => {
    console.log(
      `[W3] số nguyên nhân — success=${String(SUCCESS_CAUSES.length)}, partial=${String(PARTIAL_CAUSES.length)}`,
    );

    expect(SUCCESS_CAUSES.length).toBeGreaterThanOrEqual(2);
    expect(PARTIAL_CAUSES.length).toBeGreaterThanOrEqual(2);
  });

  it('view hiện đủ mọi nguyên nhân trong DOM', async () => {
    const View = await loadView();
    const props = propsFor(scenarioOf('success'));
    renderView(View, props);

    for (const cause of props.causes) {
      expect(screen.getByText(cause.text)).toBeTruthy();
    }
  });
});

/* ==========================================================================
 * F. G1/G3 — năng lực false thì phần giao diện bị gỡ khỏi DOM, không phải
 *    nút vô hiệu hoá. Xác nhận cổng năng lực bằng cách CỐ Ý đưa vào dữ liệu mà
 *    nếu view chỉ gác trên "measureLabel !== null" hoặc "actions không rỗng"
 *    thay vì gác trên `capabilities`, phép kiểm này sẽ bắt được lỗi đó.
 * ========================================================================== */

describe('năng lực false thì phần giao diện bị gỡ khỏi DOM', () => {
  it('canCompareMeasure=false: khối "số đo so với ngưỡng" không hiện dù có nhãn', async () => {
    const View = await loadView();
    const probeMeasureLabel = '9,99 m';
    const probeThresholdLabel = '1,00 m';
    const props: ViolationDetailViewProps = {
      ...propsFor(scenarioOf('success')),
      measureLabel: probeMeasureLabel,
      thresholdLabel: probeThresholdLabel,
    };

    expect(props.capabilities.canCompareMeasure).toBe(false);

    renderView(View, props);

    expect(screen.queryByText(probeMeasureLabel)).toBeNull();
    expect(screen.queryByText(probeThresholdLabel)).toBeNull();
  });

  it('canDismiss=false: hàng "bỏ qua" không hiện dù `actions` có mang nó', async () => {
    const View = await loadView();
    const base = propsFor(scenarioOf('success'));
    const props: ViolationDetailViewProps = {
      ...base,
      actions: [...base.actions, DISMISS_ACTION],
      dismissReason: 'đã kiểm tra thực địa, sai số nằm trong ngưỡng cho phép',
    };

    expect(props.capabilities.canDismiss).toBe(false);

    renderView(View, props);

    expect(screen.queryByRole('button', { name: DISMISS_ACTION.label })).toBeNull();
    expect(screen.queryByDisplayValue(props.dismissReason)).toBeNull();
  });
});

/* ==========================================================================
 * G. Trạng thái 6 (forbidden) — nút sửa vắng mặt, căn cứ vẫn xem được.
 * ========================================================================== */

describe('trạng thái 6 "không có quyền": nút sửa vắng mặt, căn cứ vẫn xem được', () => {
  it('canEdit=false thì không nút hành động nào, nhưng ruleSentence vẫn hiện', async () => {
    const View = await loadView();
    const props = propsFor(scenarioOf('forbidden'));

    expect(props.capabilities.canEdit).toBe(false);
    expect(props.actions.length).toBeGreaterThan(0);

    renderView(View, props);

    for (const action of props.actions) {
      expect(screen.queryByRole('button', { name: action.label })).toBeNull();
    }

    expect(screen.getByText(props.ruleSentence)).toBeTruthy();
  });
});

/* ==========================================================================
 * H. Trạng thái 7 (collapsed) — canvas nhỏ vắng mặt.
 * ========================================================================== */

describe('trạng thái 7 "thu gọn": canvas nhỏ vắng mặt', () => {
  it('state=collapsed thì không canvas nào trong DOM dù canPreview3d=true', async () => {
    const View = await loadView();
    const props = propsFor(scenarioOf('collapsed'));

    expect(props.capabilities.canPreview3d).toBe(true);

    const { container } = renderView(View, props);

    expect(container.querySelector('canvas')).toBeNull();
  });
});

/* ==========================================================================
 * I. Tấm trượt không phải hộp thoại (CẤM TUYỆT ĐỐI — mục 3 CONTRACT.md).
 * ========================================================================== */

describe('tấm trượt không phải hộp thoại', () => {
  it('không aria-modal="true", không lớp phủ che mô hình', async () => {
    const View = await loadView();
    const { container } = renderView(View, propsFor(scenarioOf('success')));

    expect(container.querySelector('[aria-modal="true"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.querySelector('[class*="overlay"]')).toBeNull();
  });
});

/* ==========================================================================
 * J. A12 — J/K duyệt qua lại không đóng tấm; Esc đóng tấm.
 * ========================================================================== */

describe('A12 — J/K duyệt qua lại không đóng tấm, Esc đóng tấm', () => {
  it('J gọi onNext, K gọi onPrevious, không gọi onClose', async () => {
    const View = await loadView();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onClose = vi.fn();

    renderView(View, {
      ...propsFor(scenarioOf('success')),
      onNext,
      onPrevious,
      onClose,
    });

    fireEvent.keyDown(window, { key: 'j' });
    fireEvent.keyDown(window, { key: 'k' });

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Esc gọi onClose', async () => {
    const View = await loadView();
    const onClose = vi.fn();

    renderView(View, { ...propsFor(scenarioOf('success')), onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/* ==========================================================================
 * K. Trỏ vào một hàng lựa chọn → xem trước hậu quả (onActionHover).
 * ========================================================================== */

describe('trỏ vào một hàng lựa chọn → xem trước hậu quả', () => {
  it('trỏ vào báo onActionHover(kind), rời khỏi báo lại null', async () => {
    const View = await loadView();
    const onActionHover = vi.fn();
    const props: ViolationDetailViewProps = {
      ...propsFor(scenarioOf('success')),
      onActionHover,
    };
    const action = props.actions[0];

    if (action === undefined) {
      throw new Error('propsFor("success") phải có ít nhất một hành động để trỏ vào');
    }

    renderView(View, props);

    const trigger = screen.getByRole('button', { name: action.label });
    const row = trigger.closest('li') ?? trigger.closest('[role="listitem"]') ?? trigger;

    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);

    expect(onActionHover).toHaveBeenNthCalledWith(1, action.kind);
    expect(onActionHover).toHaveBeenNthCalledWith(2, null);
  });
});
