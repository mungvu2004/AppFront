/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link FloorUploadScreenView} — không container, không
 * provider, không cổng dữ liệu. Đó là điều mục D mua được: một màn nào cũng xem
 * được ở bảy trạng thái mà không phải dựng nổi một máy chủ.
 *
 * Bộ dựng kịch bản ({@link scenarioFor} và các hàm `…Row`) được **xuất** ra để
 * `FloorUploadScreen.test.tsx` dùng lại đúng một bộ dữ liệu ấy. Hai bộ song song
 * là hai bộ sẽ lệch nhau, và lúc lệch thì story xanh không còn nói gì về test.
 *
 * ## Dữ liệu bám vào bộ mẫu thật
 *
 * Bốn tầng dưới đây là bốn tầng của `MOCK_SPATIAL_PROJECT`: `Tầng hầm` (`L-1`),
 * `Tầng 1` (`L1`), `Tầng 2` (`L2`), `Tầng 3` (`L3`). `Tầng 1` của bộ mẫu đã có
 * sẵn một bản vẽ trên máy chủ, nên nó vào màn ở trạng thái đã gắn kèm mà không
 * qua lượt tải nào.
 *
 * ## Không con số dung lượng nào viết tay
 *
 * `formatsLine` và `sizeLabel` gọi `formatFileSize` với hằng của
 * `src/lib/upload`, đúng như hook làm. Viết trần dung lượng thẳng vào đây là
 * dựng bản thứ hai của một giới hạn mà máy chủ mới là nơi quyết — và đó chính
 * là thứ lượt soát trần dung lượng trên thư mục màn tồn tại để bắt.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { formatFileSize } from '@/lib/format/bytes';
import { formatPercent } from '@/lib/format/number';
import { staggerDelayMs } from '@/lib/motion/stagger';
import { durationMs } from '@/lib/motion/tokens';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from '@/lib/upload';

import { FloorUploadScreenView } from './FloorUploadScreen';
import type {
  FloorUploadFileModel,
  FloorUploadInlineError,
  FloorUploadRowModel,
  FloorUploadScreenViewProps,
} from './types';

/* -------------------------------------------------------------------------- */
/* Bốn tầng thật của bộ mẫu.                                                   */
/* -------------------------------------------------------------------------- */

/** Mã tầng và tên tầng, đúng thứ tự `MOCK_SPATIAL_PROJECT` trả về. */
export const SAMPLE_FLOORS = [
  { id: 'L-1', name: 'Tầng hầm', elevationLabel: '-3,00 m', ceilingElevationLabel: '0 mm' },
  { id: 'L1', name: 'Tầng 1', elevationLabel: '0 mm', ceilingElevationLabel: '3,90 m' },
  { id: 'L2', name: 'Tầng 2', elevationLabel: '3,90 m', ceilingElevationLabel: '7,50 m' },
  { id: 'L3', name: 'Tầng 3', elevationLabel: '7,50 m', ceilingElevationLabel: '11,10 m' },
] as const;

const STOREY_HEIGHT_LABEL = '3,60 m';

/** Dung lượng của các tệp mẫu, tính bằng byte. Nhãn do `formatFileSize` dựng. */
const SAMPLE_FILE_BYTES = 2_400_000;

const REASSIGN_OPTIONS = SAMPLE_FLOORS.map((floor) => ({ label: floor.name, value: floor.id }));

/**
 * Hàm dựng lỗi của môi trường, giữ lại trước khi story `Error` che mất tên ấy.
 *
 * Story bắt buộc tên là `Error` (R-63 đòi bảy story trùng tên bảy trạng thái),
 * và một `export const Error` che `Error` toàn cục trong cả file này.
 */
const RuntimeError = globalThis.Error;

const percentLabelOf = (percent: number): string =>
  formatPercent(percent, { fractionDigits: 0, source: 'percent' });

/* -------------------------------------------------------------------------- */
/* Bộ dựng hàng.                                                               */
/* -------------------------------------------------------------------------- */

function fileOf(name: string, overrides: Partial<FloorUploadFileModel> = {}): FloorUploadFileModel {
  const sizeLabel = formatFileSize(SAMPLE_FILE_BYTES);

  return {
    id: `file-${name}`,
    name,
    sizeLabel,
    pageCountLabel: null,
    isCadBranch: false,
    summaryLine: `${name} · ${sizeLabel}`,
    pageOptions: [],
    selectedPage: null,
    ...overrides,
  };
}

function baseRow(index: number): Omit<FloorUploadRowModel, 'status' | 'statusVariant' | 'statusLabel' | 'statusLabelKey'> {
  const floor = SAMPLE_FLOORS[index] ?? SAMPLE_FLOORS[0];

  return {
    floorId: floor.id,
    name: floor.name,
    elevationLabel: floor.elevationLabel,
    ceilingElevationLabel: floor.ceilingElevationLabel,
    storeyHeightLabel: STOREY_HEIGHT_LABEL,
    file: null,
    isAutoMatched: false,
    autoMatchHint: null,
    percent: 0,
    percentLabel: percentLabelOf(0),
    progressAriaLabel: `Đã tải ${percentLabelOf(0)} của ${floor.name}`,
    error: null,
    reassignOptions: REASSIGN_OPTIONS,
    canCancelUpload: false,
    canRetryUpload: false,
    canRemoveFile: false,
    removeLabel: null,
    revealDelayMs: staggerDelayMs(index),
    revealDurationMs: durationMs('standard'),
  };
}

/** Một tầng chưa có bản vẽ nào. */
export function waitingRow(index: number): FloorUploadRowModel {
  return {
    ...baseRow(index),
    status: 'waiting',
    statusVariant: 'neutral',
    statusLabel: 'chờ xử lý',
    statusLabelKey: 'floorUpload.status.waiting',
  };
}

/** Một tầng đã gắn bản vẽ, người dùng tự gán — nên huy hiệu được xanh (A5). */
export function attachedRow(index: number): FloorUploadRowModel {
  const floor = SAMPLE_FLOORS[index] ?? SAMPLE_FLOORS[0];
  const file = fileOf(`mat-bang-${floor.id}.png`);

  return {
    ...baseRow(index),
    file,
    status: 'attached',
    statusVariant: 'verified',
    statusLabel: 'đã gắn kèm',
    statusLabelKey: 'floorUpload.status.attached',
    percent: 100,
    percentLabel: percentLabelOf(100),
    progressAriaLabel: `Tải xong ${file.name}`,
    canRemoveFile: true,
    removeLabel: `Xoá bản vẽ ${file.name}`,
  };
}

/** Một tầng đang tải, ghép tự động từ tên tệp — máy đoán, nên là vàng chứ không xanh (A5). */
export function uploadingRow(index: number, percent = 45): FloorUploadRowModel {
  const floor = SAMPLE_FLOORS[index] ?? SAMPLE_FLOORS[0];
  const file = fileOf(`mat-bang-${floor.id}.dwg`, { isCadBranch: true });

  return {
    ...baseRow(index),
    file,
    status: 'uploading',
    statusVariant: 'attention',
    statusLabel: 'đang tải lên',
    statusLabelKey: 'floorUpload.status.uploading',
    isAutoMatched: true,
    autoMatchHint: 'Ghép tự động từ tên tệp — kiểm tra lại',
    percent,
    percentLabel: percentLabelOf(percent),
    progressAriaLabel: `Đã tải ${percentLabelOf(percent)} của ${file.name}`,
    canCancelUpload: true,
    canRemoveFile: true,
    removeLabel: `Xoá bản vẽ ${file.name}`,
  };
}

const TOO_LARGE_ERROR: FloorUploadInlineError = {
  kind: 'tooLarge',
  sentence: `Tệp lớn hơn mức nhận được là ${formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES)}.`,
  isRetryable: false,
  titleKey: 'errors.upload.title',
};

const UNREADABLE_ERROR: FloorUploadInlineError = {
  kind: 'unreadable',
  sentence: 'Không đọc được nội dung tệp này. Thử xuất lại bản vẽ rồi tải lên lần nữa.',
  isRetryable: false,
  titleKey: 'errors.validation.title',
};

/** Một tầng có tệp bị từ chối — lỗi ở lại trong thẻ, không leo lên cả màn. */
export function errorRow(index: number, error: FloorUploadInlineError): FloorUploadRowModel {
  const floor = SAMPLE_FLOORS[index] ?? SAMPLE_FLOORS[0];
  const file = fileOf(`mat-bang-${floor.id}.pdf`, { pageCountLabel: '3 trang' });

  return {
    ...baseRow(index),
    file: {
      ...file,
      summaryLine: `${file.name} · ${file.sizeLabel} · 3 trang`,
      pageOptions: [
        { label: 'Trang 1', value: '1' },
        { label: 'Trang 2', value: '2' },
        { label: 'Trang 3', value: '3' },
      ],
      selectedPage: '1',
    },
    status: 'error',
    statusVariant: 'violation',
    statusLabel: 'lỗi',
    statusLabelKey: 'floorUpload.status.error',
    error,
    canRemoveFile: true,
    removeLabel: `Xoá bản vẽ ${file.name}`,
  };
}

/* -------------------------------------------------------------------------- */
/* Bộ dựng màn.                                                                */
/* -------------------------------------------------------------------------- */

const noop = (): void => undefined;

const NO_ACTIONS = {
  onFilesDropped: noop,
  onFilesChosen: noop,
  onDragEnter: noop,
  onDragLeave: noop,
  onReassign: noop,
  onPickPdfPage: noop,
  onCancelUpload: noop,
  onRetryUpload: noop,
  onRemoveFile: noop,
  onSubmit: noop,
  onDismissError: noop,
};

const DROP_ZONE = {
  title: 'Kéo thả bản vẽ vào đây, hoặc chọn tệp',
  titleKey: 'floorUpload.dropZone.title',
  selectFileLabel: 'Chọn tệp',
  formatsLine:
    `Định dạng hỗ trợ: ${ACCEPTED_UPLOAD_EXTENSIONS.join(', ')}. ` +
    `Kích thước tối đa: ${formatFileSize(MAX_UPLOAD_FILE_SIZE_BYTES)}.`,
  acceptAttribute: ACCEPTED_UPLOAD_EXTENSIONS.join(','),
  isEnabled: true,
};

const EMPTY_TRAY = {
  title: 'Tệp chưa gán tầng',
  titleKey: 'floorUpload.unassignedTray',
  items: [],
  countLabel: '0 tệp',
};

function footerOf(rows: readonly FloorUploadRowModel[]) {
  const doneCount = rows.filter((row) => row.status === 'attached').length;
  const blockReasons = rows
    .filter((row) => row.status !== 'attached')
    .map((row) => ({
      floorId: row.floorId,
      floorName: row.name,
      kind: 'missingFile' as const,
      sentence: `Tầng ${row.name} chưa có bản vẽ.`,
    }));

  return {
    doneCount,
    totalCount: rows.length,
    counterLabel: `${String(doneCount)} / ${String(rows.length)} tầng đã có bản vẽ`,
    counterLabelKey: 'floorUpload.footer.counter',
    submitLabel: 'Bắt đầu xử lý',
    submitLabelKey: 'floorUpload.footer.submit',
    canSubmit: blockReasons.length === 0,
    blockReasons,
    isSubmitting: false,
  };
}

function modelOf(
  state: SevenState,
  rows: readonly FloorUploadRowModel[],
  overrides: Partial<FloorUploadScreenViewProps> = {},
): FloorUploadScreenViewProps {
  const canEdit = overrides.canEdit ?? true;

  return {
    state,
    projectId: 'project-1',
    canEdit,
    isReadOnly: !canEdit,
    isCollapsed: false,
    isOffline: false,
    isDragActive: false,
    errorMessage: null,
    offlineNotice: null,
    offlineNoticeKey: 'floorUpload.offlineBanner',
    readOnlyNotice: null,
    readOnlyNoticeKey: 'floorUpload.readOnlyNotice',
    emptyMessage: 'Chưa có tầng nào có bản vẽ. Kéo thả tệp đầu tiên để bắt đầu.',
    emptyMessageKey: 'floorUpload.emptyState',
    dropZone: { ...DROP_ZONE, isEnabled: canEdit },
    floors: rows,
    tray: EMPTY_TRAY,
    footer: footerOf(rows),
    blockNotice: null,
    ...NO_ACTIONS,
    ...overrides,
  };
}

/**
 * Bảy kịch bản, tra bằng `switch` cạn kiệt.
 *
 * `default` gán `state` vào một biến `never`: bớt một `case` thì `pnpm typecheck`
 * đỏ **trước khi** test kịp chạy, nên bảy trạng thái được canh bằng hai lớp độc
 * lập — biên dịch ở đây, và `expectSevenStates` lúc chạy.
 */
export function scenarioFor(state: SevenState): FloorUploadScreenViewProps {
  const allWaiting = SAMPLE_FLOORS.map((_floor, index) => waitingRow(index));
  const allAttached = SAMPLE_FLOORS.map((_floor, index) => attachedRow(index));

  switch (state) {
    case 'empty':
      return modelOf('empty', allWaiting);

    case 'loading':
      return modelOf('loading', []);

    case 'partial':
      return modelOf('partial', [
        attachedRow(0),
        attachedRow(1),
        waitingRow(2),
        uploadingRow(3),
      ]);

    case 'error':
      return modelOf('error', [], {
        errorMessage: 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.',
      });

    case 'success':
      return modelOf('success', allAttached);

    case 'forbidden':
      return modelOf('forbidden', allAttached, {
        canEdit: false,
        readOnlyNotice:
          'Vai hiện tại chỉ được xem danh sách tệp, không tải lên và không sửa.',
      });

    case 'collapsed':
      return modelOf('collapsed', allAttached, { isCollapsed: true });

    default: {
      const exhaustive: never = state;

      throw new RuntimeError(`chưa xử lý trạng thái: ${String(exhaustive)}`);
    }
  }
}

/** Bảy trạng thái theo đúng thứ tự của `SEVEN_STATES`, cho lượt kiểm A11. */
export const SEVEN_SCENARIOS: readonly FloorUploadScreenViewProps[] =
  SEVEN_STATES.map(scenarioFor);

/**
 * Một tầng còn thiếu bản vẽ và lời chặn đã hiện ra.
 *
 * Đây là kịch bản của tiêu chí nghiệm thu (d): nút chính bấm được, danh sách lý
 * do nêu đúng tên tầng, và view cuộn tới đúng thẻ ấy.
 */
export function blockedScenario(missingIndex: number): FloorUploadScreenViewProps {
  const rows = SAMPLE_FLOORS.map((_floor, index) =>
    index === missingIndex ? waitingRow(index) : attachedRow(index),
  );
  const missing = rows[missingIndex] ?? rows[0];

  if (missing === undefined) {
    throw new RuntimeError('kịch bản chặn cần ít nhất một tầng');
  }

  const reasons = [
    {
      floorId: missing.floorId,
      floorName: missing.name,
      kind: 'missingFile' as const,
      sentence: `Tầng ${missing.name} chưa có bản vẽ.`,
    },
  ];

  return modelOf('partial', rows, {
    footer: { ...footerOf(rows), blockReasons: reasons, canSubmit: false },
    blockNotice: {
      title: 'Không thể bắt đầu xử lý',
      titleKey: 'floorUpload.blockedSubmit.title',
      reasons,
      scrollTo: { floorId: missing.floorId, requestId: 1 },
    },
  });
}

/** Kịch bản có khay tệp chưa gán và một tệp bị từ chối vì quá khổ. */
export function trayScenario(): FloorUploadScreenViewProps {
  const rows = [attachedRow(0), attachedRow(1), errorRow(2, TOO_LARGE_ERROR), waitingRow(3)];

  return modelOf('partial', rows, {
    tray: {
      ...EMPTY_TRAY,
      countLabel: '1 tệp',
      items: [
        {
          id: 'tray-1',
          name: 'ban-ve-khong-ro-tang.dwg',
          sizeLabel: formatFileSize(SAMPLE_FILE_BYTES),
          isCadBranch: true,
          summaryLine: `ban-ve-khong-ro-tang.dwg · ${formatFileSize(SAMPLE_FILE_BYTES)}`,
          error: UNREADABLE_ERROR,
          assignOptions: REASSIGN_OPTIONS,
          canRemoveFile: true,
          removeLabel: 'Xoá bản vẽ ban-ve-khong-ro-tang.dwg',
        },
      ],
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Story.                                                                      */
/* -------------------------------------------------------------------------- */

const meta = {
  title: 'Screens/Upload/FloorUploadScreen',
  component: FloorUploadScreenView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof FloorUploadScreenView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: scenarioFor('empty') };
export const Loading: Story = { args: scenarioFor('loading') };
export const Partial: Story = { args: scenarioFor('partial') };
export const Error: Story = { args: scenarioFor('error') };
export const Success: Story = { args: scenarioFor('success') };
export const Forbidden: Story = { args: scenarioFor('forbidden') };
export const Collapsed: Story = { args: scenarioFor('collapsed') };

/** Ngoài bảy trạng thái: khay tệp chưa gán, chip CAD, và một lỗi khoanh trong thẻ. */
export const WithUnassignedTray: Story = { args: trayScenario() };

/** Ngoài bảy trạng thái: đã bấm nút chính lúc còn thiếu một tầng. */
export const BlockedSubmit: Story = { args: blockedScenario(2) };

/** Ngoài bảy trạng thái: có tệp đang lơ lửng trên trang. */
export const DragActive: Story = {
  args: { ...scenarioFor('partial'), isDragActive: true },
};
