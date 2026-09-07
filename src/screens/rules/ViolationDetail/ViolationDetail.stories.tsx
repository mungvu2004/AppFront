/**
 * Bảy trạng thái của {@link ViolationDetail} (A11 / R-63): rỗng, đang tải, một
 * phần, lỗi, xong, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args`
 * tĩnh, đúng khuôn `RuleReport.stories.tsx`.
 *
 * Dữ liệu mẫu tính từ hai lượt `runRules()` thật (không mảng viết tay):
 * `FURNITURE-CLASH` trên `CLEAN_BUILDING_SCENARIO` cho các trạng thái có hành
 * động xử lý (xoá đối tượng áp dụng được), `WALL-THICKNESS` trên
 * `VIOLATED_BUILDING_SCENARIO` cho trạng thái "một phần" (không hành động tự
 * động nào sửa được tường mỏng). `ViolationDetail.test.tsx` CỐ Ý KHÔNG nhập lại
 * file này (và ngược lại): mỗi file tự tính dữ liệu mẫu của nó từ cùng một
 * nguồn thật, đúng quy ước đã có của `RuleReport`.
 *
 * `figure2d` của các story đã tải là mặt bằng THẬT của bộ mẫu, dựng bằng đúng
 * hai hàm domain mà hook dùng (`resolveWallShapes` + `toSolidWall`) — xem
 * {@link figureOf}. Story vẫn là view thuần: đây là dữ liệu vào, không phải hook.
 */

import type { Meta, StoryObj } from '@storybook/react';

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
import { CLEAN_BUILDING_SCENARIO, VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';

import { ViolationDetail } from './ViolationDetail';
import type {
  ViolationAction,
  ViolationCause,
  ViolationDetailCapabilities,
  ViolationDetailViewProps,
  ViolationObject,
} from './types';

const meta = {
  title: 'Screens/Rules/ViolationDetail',
  component: ViolationDetail,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ViolationDetail>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — hai lượt runRules() thật, không mảng .violations viết tay.    */
/* -------------------------------------------------------------------------- */

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
 * Không mảng toạ độ viết tay: story phải cho thấy khối hình như người dùng thấy,
 * nên mặt bằng phải là mặt bằng dựng được từ bộ mẫu chuẩn. Đây là dựng DỮ LIỆU
 * VÀO cho một view thuần, không phải gọi hook trong story.
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

/** `FURNITURE-CLASH` thật trên bộ mẫu "sạch" — đồ đạc chồng tường/nhau, xoá được. */
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

/** `WALL-THICKNESS` thật — không hành động tự động nào sửa được (trạng thái 3). */
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

/** Props nền — mọi story ghi đè từ đây, giống hệt props rỗng thật của trạng thái 1. */
const EMPTY_PROPS: ViolationDetailViewProps = {
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
  onSelectObject: noop,
  figureMode: '2d',
  onFigureModeChange: noop,
  previewEntityIds: null,
  // Chưa có vi phạm nào để dựng ngữ cảnh hình: khối 5 biến khỏi DOM, phần chữ
  // đứng một mình — không khung vỡ (types.ts, `figureUnavailable`).
  figure2d: null,
  figureRef: noop,
  figureUnavailable: true,
  causes: [],
  actions: [],
  onAction: noop,
  onActionHover: noop,
  dismissReason: '',
  onDismissReasonChange: noop,
  dismissReasonError: null,
  ruleCode: null,
  levelId: null,
  onPrevious: noop,
  onNext: noop,
  hasPrevious: false,
  hasNext: false,
  isAdvancing: false,
  onCancelAdvance: noop,
  errorMessage: null,
  resolvedMessage: null,
  onClose: noop,
};

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
    ...EMPTY_PROPS,
    state: 'success',
    groupLabel: RULE_GROUP_LABELS[args.rule.group],
    group: args.rule.group,
    title: args.violation.message,
    severity: args.rule.severity,
    severityLabel: RULE_SEVERITY_LABELS[args.rule.severity],
    subjectEntityId: args.violation.entityId,
    ruleSentence: args.rule.name,
    objects: args.objects,
    // Hook đặt `figureUnavailable = figure2d === null` — story theo đúng luật đó.
    figure2d: args.figure2d,
    figureUnavailable: args.figure2d === null,
    causes: args.causes,
    actions: args.actions,
    ruleCode: args.violation.ruleCode,
    levelId: args.violation.levelId,
    hasPrevious: true,
    hasNext: true,
  };
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (tên export ASCII — mục B/E.11; nhãn tiếng Việt trong chú     */
/* thích, đúng khuôn RuleReport.stories.tsx).                                  */
/* -------------------------------------------------------------------------- */

/** 1 · rỗng — vi phạm này không còn tìm thấy (đã được xử lý ở nơi khác). */
export const Empty: Story = {
  args: EMPTY_PROPS,
};

/** 2 · đang tải — đang tải chi tiết vi phạm. */
export const Loading: Story = {
  args: { ...EMPTY_PROPS, state: 'loading' },
};

/** 3 · một phần — tường mỏng, không hành động tự động nào sửa được; phần chữ đứng một mình. */
export const Partial: Story = {
  args: { ...loadedProps(PARTIAL_ARGS), state: 'partial' },
};

/** 4 · lỗi — vừa thử xoá đối tượng nhưng thất bại. */
export const ErrorState: Story = {
  args: {
    ...loadedProps(SUCCESS_ARGS),
    state: 'error',
    errorMessage: 'không xoá được: đối tượng đang được một hàng khác tham chiếu, thử lại sau ít phút.',
  },
};

/** 5 · xong — đồ đạc chồng tường, xoá được, hai nguyên nhân khả dĩ. */
export const Success: Story = {
  args: loadedProps(SUCCESS_ARGS),
};

/** 6 · không có quyền — người xem không có quyền sửa; căn cứ vẫn xem được. */
export const Forbidden: Story = {
  args: {
    ...loadedProps(SUCCESS_ARGS),
    state: 'forbidden',
    capabilities: { ...BASE_CAPABILITIES, canEdit: false },
  },
};

/** 7 · thu gọn — vỏ ứng dụng báo tấm đang hẹp: ẩn canvas nhỏ. */
export const Collapsed: Story = {
  args: { ...loadedProps(SUCCESS_ARGS), state: 'collapsed' },
};
