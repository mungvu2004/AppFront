/**
 * Bộ kiểm cho tấm trượt `ViolationDetail` (S-34).
 *
 * Bản gốc của file này nhập `./ViolationDetail` qua một biến kèm `@vite-ignore`, vì
 * lúc viết nó view còn nằm trên một nhánh khác và một `import` tĩnh trỏ vào file
 * chưa có sẽ làm Vite sập lúc transform — cả file không chạy được một `it` nào. Lớp
 * gộp đã ghép ba nhánh lại nên lý do ấy hết hiệu lực, và cách nhập đã trở về tĩnh:
 * giữ lại một mẹo mà điều kiện sinh ra nó đã biến mất chỉ để lại một câu đố cho
 * người đọc sau.
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
 * `RuleReport.test.tsx` tự viết `toRow`/`toGroups` để có props hợp lệ). Đây là bài
 * kiểm của VIEW THUẦN: nó phải chạy được chỉ từ props, không gọi hook và không chạm
 * store (mục D), nên props ở đây là props hợp lệ theo đúng hình dạng
 * `ViolationCause`/`ViolationAction` mà `types.ts` mô tả — không phải viết lại logic
 * sinh nguyên nhân của hook. Số nguyên nhân THẬT mà hook sinh ra được `G2` bảo vệ ở
 * phía hook; ở đây bám sát ví dụ minh hoạ của phán quyết G2 trong CONTRACT.md
 * ("nhận diện tự động có thể sai — độ tin cậy chỉ…").
 */

import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDefaultRuleRegistry } from '@/domain/rules/defaults';
import { RULE_GROUP_LABELS, RULE_SEVERITY_LABELS } from '@/domain/rules/registry';
import type { Rule, Violation } from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import {
  idsOnLevel,
  isEntityOfKind,
  normalizeSpatial,
  type NormalizedSpatial,
} from '@/domain/spatial/normalize';
import type { Wall } from '@/domain/spatial/types';
import { resolveWallShapes } from '@/domain/walls/joints';
import { toSolidWall } from '@/lib/commands/business/shared';
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

import { ViolationDetail } from './ViolationDetail';
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
 * 0. Hạ tầng.
 * ========================================================================== */

function renderView(props: ViolationDetailViewProps) {
  return renderWithProviders(<ViolationDetail {...props} />);
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

/**
 * `figure2d` THẬT của một bộ mẫu, dựng bằng chính hai hàm domain mà hook dùng.
 *
 * Không mảng toạ độ viết tay: props của khối hình phải là một mặt bằng dựng được
 * thì cây render mới đi qua nhánh `<polygon>`, và `expectAccessible` / bảy trạng
 * thái mới soát đúng thứ người dùng nhìn thấy. Đây là dựng DỮ LIỆU VÀO cho một
 * view thuần, không phải gọi lại hook (view test chỉ nhận props — mục D).
 */
function figureOf(
  graph: NormalizedSpatial,
  subjectEntityId: string,
): ViolationDetailViewProps['figure2d'] {
  const level = Object.values(graph.byId).find((entity) => isEntityOfKind('level', entity));

  if (level === undefined || !isEntityOfKind('level', level)) {
    throw new Error('bộ mẫu không có tầng nào — không dựng được mặt bằng 2D');
  }

  const walls: Wall[] = [];

  for (const id of idsOnLevel(graph, level.id)) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('wall', entity)) {
      walls.push(entity);
    }
  }

  let shapes;

  try {
    shapes = resolveWallShapes(walls.map((wall) => toSolidWall(wall, level))).shapes;
  } catch {
    // Đúng như hook: một tầng có tường không dùng được (dày 40 mm, ngoài khoảng
    // 60–600) là tầng KHÔNG vẽ được, không phải một sự cố. `figureUnavailable`
    // bật lên và phần chữ đứng một mình — `VIOLATED_BUILDING_SCENARIO` rơi vào
    // đúng trường hợp này, và đó là lý do trạng thái "một phần" không có hình.
    return null;
  }

  const points = shapes.flatMap((shape) => [...shape.outline]);

  if (points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);

  return {
    viewBox: `${String(minX)} ${String(minY)} ${String(Math.max(...xs) - minX)} ${String(Math.max(...ys) - minY)}`,
    shapes: shapes.map((shape) => ({
      id: shape.wallId,
      points: shape.outline.map((point) => `${String(point.x)},${String(point.y)}`).join(' '),
      isSubject: shape.wallId === subjectEntityId,
      isDimmed: false,
    })),
  };
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
    // Chưa có vi phạm nào để dựng ngữ cảnh hình: khối 5 biến khỏi DOM, phần chữ
    // đứng một mình — không khung vỡ (types.ts, `figureUnavailable`).
    figure2d: null,
    figureRef: vi.fn(),
    figureUnavailable: true,
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
  readonly figure2d: ViolationDetailViewProps['figure2d'];
  readonly objects: readonly ViolationObject[];
  readonly causes: readonly ViolationCause[];
  readonly actions: readonly ViolationAction[];
}

const SUCCESS_ARGS: LoadedArgs = {
  violation: SUCCESS_VIOLATION,
  rule: SUCCESS_RULE,
  figure2d: figureOf(NORMALIZED_CLEAN, SUCCESS_VIOLATION.entityId),
  objects: SUCCESS_OBJECTS,
  causes: SUCCESS_CAUSES,
  actions: SUCCESS_ACTIONS,
};

const PARTIAL_ARGS: LoadedArgs = {
  violation: PARTIAL_VIOLATION,
  rule: PARTIAL_RULE,
  figure2d: figureOf(NORMALIZED_VIOLATED, PARTIAL_VIOLATION.entityId),
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
    // Hook đặt `figureUnavailable = figure2d === null` — props ở đây theo đúng
    // luật đó, không tự đặt một cặp giá trị mà hook không bao giờ phát ra.
    figure2d: args.figure2d,
    figureRef: vi.fn(),
    figureUnavailable: args.figure2d === null,
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
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderView(propsFor(scenario));
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
  it('trạng thái "success" tiếp cận được và toàn chữ tiếng Việt có dấu', () => {
    const { container } = renderView(propsFor(scenarioOf('success')));

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

  it('view hiện đủ mọi nguyên nhân trong DOM', () => {
    const props = propsFor(scenarioOf('success'));
    renderView(props);

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
  it('canCompareMeasure=false: khối "số đo so với ngưỡng" không hiện dù có nhãn', () => {
    const probeMeasureLabel = '9,99 m';
    const probeThresholdLabel = '1,00 m';
    const props: ViolationDetailViewProps = {
      ...propsFor(scenarioOf('success')),
      measureLabel: probeMeasureLabel,
      thresholdLabel: probeThresholdLabel,
    };

    expect(props.capabilities.canCompareMeasure).toBe(false);

    renderView(props);

    expect(screen.queryByText(probeMeasureLabel)).toBeNull();
    expect(screen.queryByText(probeThresholdLabel)).toBeNull();
  });

  it('canDismiss=false: hàng "bỏ qua" không hiện dù `actions` có mang nó', () => {
    const base = propsFor(scenarioOf('success'));
    const props: ViolationDetailViewProps = {
      ...base,
      actions: [...base.actions, DISMISS_ACTION],
      dismissReason: 'đã kiểm tra thực địa, sai số nằm trong ngưỡng cho phép',
    };

    expect(props.capabilities.canDismiss).toBe(false);

    renderView(props);

    expect(screen.queryByRole('button', { name: DISMISS_ACTION.label })).toBeNull();
    expect(screen.queryByDisplayValue(props.dismissReason)).toBeNull();
  });
});

/* ==========================================================================
 * G. Trạng thái 6 (forbidden) — nút sửa vắng mặt, căn cứ vẫn xem được.
 * ========================================================================== */

describe('trạng thái 6 "không có quyền": nút sửa vắng mặt, căn cứ vẫn xem được', () => {
  it('canEdit=false thì không nút hành động nào, nhưng ruleSentence vẫn hiện', () => {
    const props = propsFor(scenarioOf('forbidden'));

    expect(props.capabilities.canEdit).toBe(false);
    expect(props.actions.length).toBeGreaterThan(0);

    renderView(props);

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
  it('state=collapsed thì không canvas nào trong DOM dù canPreview3d=true', () => {
    const props = propsFor(scenarioOf('collapsed'));

    expect(props.capabilities.canPreview3d).toBe(true);

    const { container } = renderView(props);

    expect(container.querySelector('canvas')).toBeNull();
  });
});

/* ==========================================================================
 * I. Tấm trượt không phải hộp thoại (CẤM TUYỆT ĐỐI — mục 3 CONTRACT.md).
 * ========================================================================== */

describe('tấm trượt không phải hộp thoại', () => {
  it('không aria-modal="true", không lớp phủ che mô hình', () => {
    const { container } = renderView(propsFor(scenarioOf('success')));

    expect(container.querySelector('[aria-modal="true"]')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    // Thứ phải vắng mặt là một phần tử TRẢI KÍN và TÔ NỀN — đúng hai thứ mà
    // `Drawer.Root` làm (`absolute inset-0 bg-bg-overlay`, Drawer.tsx:132) và
    // `ProgressOverlay` làm (`absolute inset-0 … bg-bg-app/88 backdrop-blur-sm`).
    //
    // Bắt theo chuỗi con "overlay" thì `shadow-overlay` — token ĐỔ BÓNG mà chín tấm
    // nổi khác trong repo cùng dùng — dính oan; bắt theo `inset-0` một mình thì con
    // trượt bên trong `SegmentedControl` (`absolute inset-0 … bg-bg-surface`, rộng
    // đúng một ô của chính nó) cũng dính oan. Cặp "trải kín + tô nền phủ" mới là lớp
    // phủ thật.
    expect(container.querySelector('[class*="bg-bg-overlay"]')).toBeNull();

    const covering = [...container.querySelectorAll('[class~="inset-0"]')].filter((element) =>
      /(^| )bg-bg-(overlay|app)($| |\/)|backdrop-blur/.test(element.getAttribute('class') ?? ''),
    );

    expect(covering).toHaveLength(0);
  });
});

/* ==========================================================================
 * J. A12 — J/K duyệt qua lại không đóng tấm; Esc đóng tấm.
 * ========================================================================== */

describe('A12 — J/K duyệt qua lại không đóng tấm, Esc đóng tấm', () => {
  it('J gọi onNext, K gọi onPrevious, không gọi onClose', () => {
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const onClose = vi.fn();

    renderView({
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

  it('Esc gọi onClose', () => {
    const onClose = vi.fn();

    renderView({ ...propsFor(scenarioOf('success')), onClose });

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/* ==========================================================================
 * K. Trỏ vào một hàng lựa chọn → xem trước hậu quả (onActionHover).
 * ========================================================================== */

describe('trỏ vào một hàng lựa chọn → xem trước hậu quả', () => {
  it('trỏ vào báo onActionHover(kind), rời khỏi báo lại null', () => {
    const onActionHover = vi.fn();
    const props: ViolationDetailViewProps = {
      ...propsFor(scenarioOf('success')),
      onActionHover,
    };
    const action = props.actions[0];

    if (action === undefined) {
      throw new Error('propsFor("success") phải có ít nhất một hành động để trỏ vào');
    }

    renderView(props);

    const trigger = screen.getByRole('button', { name: action.label });
    const row = trigger.closest('li') ?? trigger.closest('[role="listitem"]') ?? trigger;

    fireEvent.mouseEnter(row);
    fireEvent.mouseLeave(row);

    expect(onActionHover).toHaveBeenNthCalledWith(1, action.kind);
    expect(onActionHover).toHaveBeenNthCalledWith(2, null);
  });
});
