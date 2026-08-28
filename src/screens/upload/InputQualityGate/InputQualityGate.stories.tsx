/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link InputQualityGateView} — không container, không
 * provider, không cổng dữ liệu. Đó là điều mục D mua được: xem được màn ở cả
 * bảy trạng thái mà không phải dựng nổi một máy chủ. Cùng khuôn
 * `FloorUploadScreen.stories.tsx`.
 *
 * ## Dữ liệu không bịa tại chỗ (R-70)
 *
 * Bốn tầng và mọi **số đo thô** dưới đây là bốn tầng của `createMockApiClient()`
 * (`src/api/__mocks__/client.ts`): `L-1` chưa đo, `L1` đo xong và mang đúng ba
 * phát hiện, `L2` đo xong và sạch, `L3` chưa đo. Không con số nào ở đây được
 * nghĩ ra cho story; `InputQualityGate.test.tsx` gọi chính cổng dữ liệu giả ấy
 * và **so từng số** với bảng dưới, nên mock đổi mà story quên đổi thì test đỏ.
 *
 * Ba thứ story tuyệt đối không tự quyết, vì tự quyết là dựng bản thứ hai của
 * một luật đã có chủ:
 *
 * - **Mức ba bậc** — `classifyResolution`/`classifySkew`/`classifyContrast`/
 *   `classifyNoise` của `@/domain/quality`. Đặc tả cấm màn tự đặt ngưỡng.
 * - **Mọi chuỗi số** — `formatNumber`/`formatAngle`/`describeConfidence`, đúng
 *   những hàm hook gọi (A15: định dạng ở viewmodel, dấu thập phân là dấu phẩy).
 * - **Mã trạng thái màu** — `'good'` đi ra `'neutral'`, KHÔNG bao giờ
 *   `'verified'`: xanh "đã xác minh" chỉ đánh dấu việc người duyệt (A5).
 */

import type { Meta, StoryObj } from '@storybook/react';

import {
  classifyContrast,
  classifyNoise,
  classifyResolution,
  classifySkew,
  RESOLUTION_GOOD_SHORT_EDGE_PX,
} from '@/domain/quality';
import { formatAngle } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { describeConfidence } from '@/lib/format/semantic';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import type { ViewStatusCode } from '@/lib/viewmodel/types';

import { InputQualityGateView } from './InputQualityGate';
import type {
  InputQualityFindingModel,
  InputQualityFloorRow,
  InputQualityGateActions,
  InputQualityGateStatus,
  InputQualityGateViewProps,
  InputQualityImageModel,
  InputQualityMetricModel,
  InputQualityRegion,
  QualityLevel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Bốn tầng thật của cổng dữ liệu giả.                                         */
/* -------------------------------------------------------------------------- */

/** Số đo thô của một tầng — cùng hình dạng `ImageQualityMeasurement` trên dây. */
export interface SampleMeasurement {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly skewDeg: number;
  readonly contrastScore: number;
  readonly noiseScore: number;
}

/** Một tầng của bộ mẫu, đúng thứ tự `createMockApiClient()` trả về. */
export interface SampleFloor {
  readonly id: string;
  readonly name: string;
  readonly isMeasured: boolean;
  readonly measurement: SampleMeasurement | null;
  readonly expectedConfidence: number | null;
}

/** Một tầng đã đo — `measurement` chắc chắn có mặt. */
type MeasuredFloor = SampleFloor & { readonly measurement: SampleMeasurement };

/**
 * Bốn tầng của `src/api/__mocks__/client.ts`, chép nguyên số đo thô.
 *
 * Hai tầng đo xong trên bốn là thứ cho `'partial'` có gì để nói ("2/4 tầng đo
 * xong"); `L1` mang ba phát hiện nên `'ready'` có nội dung thật; `L2` sạch nên
 * `'empty'` dựng được mà không phải thêm dữ liệu nào.
 */
export const SAMPLE_FLOORS: readonly SampleFloor[] = [
  { id: 'L-1', name: 'Tầng hầm', isMeasured: false, measurement: null, expectedConfidence: null },
  {
    id: 'L1',
    name: 'Tầng 1',
    isMeasured: true,
    measurement: {
      widthPx: 1240,
      heightPx: 900,
      skewDeg: 3.4,
      contrastScore: 0.81,
      noiseScore: 0.14,
    },
    expectedConfidence: 0.82,
  },
  {
    id: 'L2',
    name: 'Tầng 2',
    isMeasured: true,
    measurement: {
      widthPx: 3200,
      heightPx: 2400,
      skewDeg: 0.2,
      contrastScore: 0.88,
      noiseScore: 0.07,
    },
    expectedConfidence: 0.94,
  },
  { id: 'L3', name: 'Tầng 3', isMeasured: false, measurement: null, expectedConfidence: null },
];

/** Ba phát hiện của `L1`, đúng mã và đúng vùng của cổng dữ liệu giả. */
export const SAMPLE_FINDINGS = [
  {
    id: 'finding-resolution',
    code: 'RESOLUTION_TOO_LOW',
    severity: 'poor' as const,
    region: { xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1 },
  },
  {
    id: 'finding-skew',
    code: 'SKEW_DETECTED',
    severity: 'attention' as const,
    region: { xRatio: 0.08, yRatio: 0.12, widthRatio: 0.84, heightRatio: 0.72 },
  },
  {
    id: 'finding-frame',
    code: 'FRAME_NOT_FOUND',
    severity: 'attention' as const,
    region: { xRatio: 0.02, yRatio: 0.02, widthRatio: 0.96, heightRatio: 0.96 },
  },
] as const;

const MOCK_IMAGE_ROOT = 'https://example.com/quality';

/**
 * Hàm dựng lỗi của môi trường, giữ trước khi story `Loi` che tên `Error`.
 *
 * Cùng lý do như `FloorUploadScreen.stories.tsx`: bảy story mang tên bảy trạng
 * thái, và một `export const Error` che `Error` toàn cục trong cả file này.
 */
const RuntimeError = globalThis.Error;

function measuredFloor(id: string): MeasuredFloor {
  const floor = SAMPLE_FLOORS.find((item) => item.id === id);

  if (floor === undefined || floor.measurement === null) {
    throw new RuntimeError(`bộ mẫu không có tầng đã đo mang mã ${id}`);
  }

  return { ...floor, measurement: floor.measurement };
}

/** Tầng đang xem trong hầu hết story — tầng duy nhất có phát hiện để vẽ. */
const ACTIVE = measuredFloor('L1');
/** Tầng sạch, cho story `Rỗng`. */
const CLEAN = measuredFloor('L2');

/* -------------------------------------------------------------------------- */
/* Chữ và số — mượn đúng hàm hook dùng, không viết tay chuỗi nào có số.        */
/* -------------------------------------------------------------------------- */

const pixels = (value: number): string => formatNumber(value, { fractionDigits: 0 });
const score = (value: number): string => formatNumber(value, { fractionDigits: 2 });
const count = (value: number): string => formatNumber(value, { grouping: false });
const shortEdgeOf = (m: SampleMeasurement): number => Math.min(m.widthPx, m.heightPx);
const resolutionText = (m: SampleMeasurement): string =>
  `${pixels(m.widthPx)} × ${pixels(m.heightPx)} px`;

/** `'good'` đi ra `'neutral'` — không bao giờ `'verified'` cho phán quyết của máy (A5). */
const STATUS_CODE_BY_LEVEL: Readonly<Record<QualityLevel, ViewStatusCode>> = {
  attention: 'attention',
  good: 'neutral',
  poor: 'violation',
};

const REGION_ID_PREFIX = 'region-';
const REGION_LABEL_PREFIX = 'Vùng ảnh có vấn đề:';

/** Mã vùng của một phát hiện — cùng phép ghép hook dùng. */
export const regionIdOf = (findingId: string): string => `${REGION_ID_PREFIX}${findingId}`;

/* -------------------------------------------------------------------------- */
/* Bốn chỉ số — mức do `@/domain/quality` quyết, không do story quyết.         */
/* -------------------------------------------------------------------------- */

function metricsOf(m: SampleMeasurement): readonly InputQualityMetricModel[] {
  const rows = [
    {
      id: 'resolution' as const,
      label: 'độ phân giải',
      valueText: resolutionText(m),
      level: classifyResolution(shortEdgeOf(m)),
      recommendation: `Nên dùng ảnh có cạnh ngắn từ ${pixels(RESOLUTION_GOOD_SHORT_EDGE_PX)} px trở lên.`,
      regionId: null,
    },
    {
      id: 'skew' as const,
      label: 'độ nghiêng',
      valueText: formatAngle(m.skewDeg),
      level: classifySkew(m.skewDeg),
      recommendation: 'Bấm nút tự động nắn để hệ thống xoay ảnh về phương ngang.',
      regionId: regionIdOf('finding-skew'),
    },
    {
      id: 'contrast' as const,
      label: 'độ tương phản',
      valueText: score(m.contrastScore),
      level: classifyContrast(m.contrastScore),
      recommendation: 'Quét lại với nền sáng đều hơn để nét mảnh không rụng khỏi ảnh.',
      regionId: null,
    },
    {
      id: 'noise' as const,
      label: 'nhiễu',
      valueText: score(m.noiseScore),
      level: classifyNoise(m.noiseScore),
      recommendation: 'Quét lại ở chế độ ảnh nét và không nén mạnh để bớt đốm giả.',
      regionId: null,
    },
  ];

  return rows.map((row) => ({
    ...row,
    statusCode: STATUS_CODE_BY_LEVEL[row.level],
    recommendation: row.level === 'good' ? null : row.recommendation,
  }));
}

/* -------------------------------------------------------------------------- */
/* Ba phát hiện — mỗi câu nêu hậu quả, không mã lỗi nào đứng một mình.         */
/* -------------------------------------------------------------------------- */

interface FindingCopy {
  readonly title: string;
  readonly consequence: string;
}

const FINDING_COPY: Readonly<Record<string, FindingCopy>> = {
  FRAME_NOT_FOUND: {
    title: 'Không tìm thấy khung bản vẽ',
    consequence:
      'Không tìm thấy khung bản vẽ. Không có khung thì hệ thống không biết đâu là mép bản vẽ, nên ' +
      'tỉ lệ quy đổi ra kích thước thật lệch theo và mọi kích thước đọc được đều sai. ' +
      'Bạn có thể tự chọn 4 góc.',
  },
  RESOLUTION_TOO_LOW: {
    title: 'Độ phân giải thấp',
    consequence:
      `Độ phân giải thấp — ${resolutionText(ACTIVE.measurement)}. ` +
      `Cạnh ngắn chỉ ${pixels(shortEdgeOf(ACTIVE.measurement))} px, nên tường ngăn mỏng nhất chỉ ` +
      'còn vài pixel bề dày và bước dò có thể bỏ sót nó. ' +
      `Nên dùng ảnh có cạnh ngắn từ ${pixels(RESOLUTION_GOOD_SHORT_EDGE_PX)} px trở lên.`,
  },
  SKEW_DETECTED: {
    title: 'Ảnh bị nghiêng',
    consequence:
      `Ảnh bị nghiêng ${formatAngle(ACTIVE.measurement.skewDeg)}. Ở góc này hai đầu một bức tường ` +
      'dài lệch nhau đủ để bước bắt trục vuông góc đọc chúng thành hai bức khác nhau. ' +
      'Hệ thống có thể tự nắn.',
  },
};

interface SampleAction {
  readonly kind: 'straighten' | 'pickCorners';
  readonly label: string;
}

const ACTION_BY_CODE: Readonly<Record<string, SampleAction | null>> = {
  FRAME_NOT_FOUND: { kind: 'pickCorners', label: 'Chọn góc thủ công' },
  RESOLUTION_TOO_LOW: null,
  SKEW_DETECTED: { kind: 'straighten', label: 'Tự động nắn' },
};

function copyFor(code: string): FindingCopy {
  const copy = FINDING_COPY[code];

  if (copy === undefined) {
    throw new RuntimeError(`thiếu câu giải thích cho mã ${code}`);
  }

  return copy;
}

function findingsOf(canEdit: boolean): readonly InputQualityFindingModel[] {
  return SAMPLE_FINDINGS.map((finding) => {
    const copy = copyFor(finding.code);

    return {
      id: finding.id,
      level: finding.severity,
      statusCode: STATUS_CODE_BY_LEVEL[finding.severity],
      title: copy.title,
      consequence: copy.consequence,
      action: canEdit ? (ACTION_BY_CODE[finding.code] ?? null) : null,
      regionId: regionIdOf(finding.id),
      isResolved: false,
    };
  });
}

function regionsOf(): readonly InputQualityRegion[] {
  return SAMPLE_FINDINGS.map((finding) => ({
    id: regionIdOf(finding.id),
    ...finding.region,
    level: finding.severity,
    label: `${REGION_LABEL_PREFIX} ${copyFor(finding.code).title.toLowerCase()}`,
  }));
}

/* -------------------------------------------------------------------------- */
/* Bảng tầng và ảnh.                                                          */
/* -------------------------------------------------------------------------- */

function floorRowsOf(activeId: string): readonly InputQualityFloorRow[] {
  return SAMPLE_FLOORS.map((floor) => {
    const findingCount = floor.id === ACTIVE.id ? SAMPLE_FINDINGS.length : 0;
    const summaryText = !floor.isMeasured
      ? 'chưa đo'
      : findingCount === 0
        ? 'không có phát hiện'
        : `${count(findingCount)} phát hiện cần chú ý`;

    return {
      id: floor.id,
      label: floor.name,
      isActive: floor.id === activeId,
      isMeasured: floor.isMeasured,
      level: floor.measurement === null ? null : worstOf(floor.measurement),
      summaryText,
    };
  });
}

/** Mức tệ nhất trong bốn phép kiểm — thứ tự do `@/domain/quality` quyết. */
function worstOf(m: SampleMeasurement): QualityLevel {
  const levels: readonly QualityLevel[] = [
    classifyResolution(shortEdgeOf(m)),
    classifySkew(m.skewDeg),
    classifyContrast(m.contrastScore),
    classifyNoise(m.noiseScore),
  ];

  return levels.includes('poor') ? 'poor' : levels.includes('attention') ? 'attention' : 'good';
}

function imageOf(floor: MeasuredFloor, withRegions: boolean): InputQualityImageModel {
  return {
    src: `${MOCK_IMAGE_ROOT}/${floor.id}.png`,
    altText: `Bản vẽ tầng ${floor.name}, đang xem để kiểm tra chất lượng đầu vào`,
    skewLine: {
      startXRatio: 0.1,
      startYRatio: 0.5,
      endXRatio: 0.9,
      endYRatio: 0.5,
      angleLabel: formatAngle(floor.measurement.skewDeg),
    },
    regions: withRegions ? regionsOf() : [],
    highlightedRegionId: null,
    rotationDeg: 0,
    corners: null,
    comparison: null,
  };
}

const NO_ACTIONS: InputQualityGateActions = {
  onHoverRegion: () => undefined,
  onHoverFinding: () => undefined,
  onSelectFloor: () => undefined,
  onStraighten: () => undefined,
  onPickCorners: () => undefined,
  onDragCorner: () => undefined,
  onChangeReveal: () => undefined,
  onToggleAcknowledgement: () => undefined,
  onContinue: () => undefined,
  onUploadAnother: () => undefined,
};

/* -------------------------------------------------------------------------- */
/* Bộ dựng model.                                                             */
/* -------------------------------------------------------------------------- */

interface ModelOptions {
  readonly floor?: MeasuredFloor;
  readonly metrics?: readonly InputQualityMetricModel[];
  readonly findings?: readonly InputQualityFindingModel[];
  readonly floors?: readonly InputQualityFloorRow[];
  readonly errorMessage?: string | null;
  readonly partialNotice?: string | null;
  readonly passNotice?: string | null;
  readonly isAcknowledged?: boolean;
  readonly areActionsHidden?: boolean;
}

function modelOf(
  status: InputQualityGateStatus,
  options: ModelOptions = {},
): InputQualityGateViewProps {
  const floor = options.floor ?? ACTIVE;
  const metrics = options.metrics ?? metricsOf(floor.measurement);
  const findings = options.findings ?? [];
  const isAcknowledged = options.isAcknowledged ?? false;
  const requiresAcknowledgement = metrics.some((metric) => metric.level === 'poor');
  const confidence = floor.expectedConfidence;

  return {
    model: {
      status,
      image: imageOf(floor, findings.length > 0),
      metrics,
      forecast: {
        text:
          confidence === null
            ? 'Chưa dự kiến được độ tin cậy vì bản vẽ chưa đo xong.'
            : `Dự kiến độ tin cậy trung bình ${score(confidence)} — ${describeConfidence(confidence).label}`,
      },
      findings,
      floors: options.floors ?? floorRowsOf(floor.id),
      footer: {
        canContinue: !(requiresAcknowledgement && !isAcknowledged),
        requiresAcknowledgement,
        isAcknowledged,
        acknowledgementLabel: 'Tôi đã đọc cảnh báo và vẫn muốn xử lý bản vẽ này',
        primaryLabel: 'Tiếp tục xử lý',
        secondaryLabel: 'Tải bản vẽ khác',
        areActionsHidden: options.areActionsHidden ?? false,
      },
      errorMessage: options.errorMessage ?? null,
      partialNotice: options.partialNotice ?? null,
      remainingFindingCount: findings.filter((finding) => !finding.isResolved).length,
      passNotice: options.passNotice ?? null,
    },
    actions: NO_ACTIONS,
  };
}

/**
 * Bảy kịch bản, tra bằng `switch` cạn kiệt.
 *
 * `default` gán `state` vào một biến `never`: bớt một `case` thì `pnpm typecheck`
 * đỏ **trước khi** test kịp chạy, nên bảy trạng thái được canh bằng hai lớp độc
 * lập — biên dịch ở đây, và `expectSevenStates` lúc chạy.
 *
 * `SevenState` gọi trạng thái thành công là `'success'`; màn này gọi nó là
 * `'ready'` (`InputQualityGateStatus`). Ánh xạ nằm gọn ở `case 'success'`.
 */
export function scenarioFor(state: SevenState): InputQualityGateViewProps {
  const pendingNames = SAMPLE_FLOORS.filter((floor) => !floor.isMeasured)
    .map((floor) => floor.name)
    .join(', ');
  const measuredCount = SAMPLE_FLOORS.filter((floor) => floor.isMeasured).length;

  switch (state) {
    case 'empty':
      return modelOf('empty', {
        floor: CLEAN,
        passNotice:
          `Bản vẽ đạt yêu cầu. Độ phân giải ${resolutionText(CLEAN.measurement)}, ` +
          `độ nghiêng ${formatAngle(CLEAN.measurement.skewDeg)}.`,
      });

    case 'loading':
      return modelOf('loading', { metrics: [], findings: [], floors: [] });

    case 'partial':
      return modelOf('partial', {
        findings: findingsOf(true),
        metrics: metricsOf(ACTIVE.measurement).slice(0, 2),
        partialNotice:
          `Mới có ${count(measuredCount)}/${count(SAMPLE_FLOORS.length)} tầng đo xong.` +
          ` Bản vẽ tầng ${ACTIVE.name} chưa chạy đủ bốn phép kiểm nên chưa có mức để nói.` +
          ` Còn chờ: ${pendingNames}.`,
      });

    case 'error':
      return modelOf('error', {
        metrics: [],
        findings: [],
        floors: [],
        errorMessage: 'Không đọc được kết quả kiểm tra chất lượng của bản vẽ này.',
      });

    case 'success':
      return modelOf('ready', { findings: findingsOf(true) });

    case 'forbidden':
      return modelOf('forbidden', { findings: findingsOf(false), areActionsHidden: true });

    case 'collapsed':
      return modelOf('collapsed', { findings: findingsOf(true) });

    default: {
      const exhaustive: never = state;

      throw new RuntimeError(`chưa xử lý trạng thái: ${String(exhaustive)}`);
    }
  }
}

/** Bảy trạng thái theo đúng thứ tự `SEVEN_STATES`, cho lượt kiểm A11. */
export const SEVEN_SCENARIOS: readonly InputQualityGateViewProps[] = SEVEN_STATES.map(scenarioFor);

/**
 * Cổng xác nhận đã tích ô — phía "sau" của tiêu chí nghiệm thu (e).
 *
 * Cùng dữ liệu story `Xong`: vẫn có một chỉ số mức Kém nên ô xác nhận vẫn hiện,
 * nhưng lời chặn đã biến mất và `canContinue` là `true`.
 */
export function acknowledgedScenario(): InputQualityGateViewProps {
  return modelOf('ready', { findings: findingsOf(true), isAcknowledged: true });
}

/** Một vùng ảnh đang được tô sáng — phía hình của liên kết hai chiều. */
export function highlightedScenario(regionId: string): InputQualityGateViewProps {
  const base = scenarioFor('success');

  return {
    ...base,
    model: { ...base.model, image: { ...base.model.image, highlightedRegionId: regionId } },
  };
}

/* -------------------------------------------------------------------------- */
/* Story.                                                                     */
/* -------------------------------------------------------------------------- */

const meta = {
  title: 'Screens/Upload/InputQualityGate',
  component: InputQualityGateView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof InputQualityGateView>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Rỗng — bản vẽ sạch, đúng một thẻ đạt, không phát hiện nào. */
export const Rong: Story = { args: scenarioFor('empty') };

/** Đang tải — khung xương bốn dòng, chưa gọi tới ba phần con. */
export const DangTai: Story = { args: scenarioFor('loading') };

/** Một phần — mới hai trên bốn tầng đo xong, báo cáo tự nói còn chờ ai. */
export const MotPhan: Story = { args: scenarioFor('partial') };

/** Lỗi — lượt đo hỏng; câu giải thích đứng cạnh, không mã lỗi nào đứng một mình. */
export const Loi: Story = { args: scenarioFor('error') };

/** Xong — bốn chỉ số và ba phát hiện đầy đủ, có lối sửa nhanh. */
export const Xong: Story = { args: scenarioFor('success') };

/** Không có quyền — hai cột vẫn đọc được, hai nút hành động biến mất hẳn. */
export const KhongCoQuyen: Story = { args: scenarioFor('forbidden') };

/** Thu gọn — cột phải thành tấm trượt đáy, bất kể bề rộng khung nhìn. */
export const ThuGon: Story = { args: scenarioFor('collapsed') };

/** Ngoài bảy trạng thái: đã tích ô xác nhận, lời chặn biến mất. */
export const DaXacNhan: Story = { args: acknowledgedScenario() };

/** Ngoài bảy trạng thái: rê chuột qua phát hiện nghiêng, vùng ảnh của nó sáng lên. */
export const VungAnhDangSang: Story = { args: highlightedScenario(regionIdOf('finding-skew')) };
