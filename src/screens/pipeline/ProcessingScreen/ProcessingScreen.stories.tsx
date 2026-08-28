/**
 * Story khung tối thiểu của màn Xử lý (S4).
 *
 * Chỉ MỘT story, dựng thẳng {@link ProcessingScreen} từ một `ProcessingScreenProps`
 * viết tay tối thiểu — đủ để chứng minh khung biên dịch và view vẽ được, không hơn.
 * Bộ bảy story đầy đủ theo A11 (cùng khuôn `InputQualityGate.stories.tsx`) thuộc
 * nhiệm vụ kế tiếp (V6), khi `ProcessingPreviewPanel`/`ProcessingLogPanel` đã có
 * ruột thật để mô phỏng cho từng trạng thái.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { ProcessingScreen } from './ProcessingScreen';
import type { ProcessingScreenProps } from './types';

const NO_OP = (): void => undefined;

/**
 * Dữ liệu tối thiểu hợp lệ theo `ProcessingScreenProps` — KHÔNG đại diện cho một
 * dự án thật, chỉ đủ để mọi trường bắt buộc có mặt. Dùng chung cho story và test.
 */
export function minimalProcessingScreenProps(): ProcessingScreenProps {
  return {
    state: 'success',
    floors: [
      {
        id: 'floor-1',
        label: 'Tầng 1',
        status: 'done',
        statusLabel: 'đã xong',
        isActive: false,
        objectCountLabel: '48 đối tượng',
      },
    ],
    steps: [
      {
        id: 'step-1',
        name: 'tách lớp tường',
        status: 'done',
        percent: 100,
        isScanning: false,
        detailLabels: ['Đã tìm thấy 48 đoạn tường'],
        isDetailOpen: false,
        onToggleDetail: NO_OP,
      },
    ],
    previewPanel: {
      altText: 'Bản vẽ tầng 1 đang xử lý',
      isScanning: false,
      detectedGeometryPaths: [],
      activeFloorId: 'floor-1',
    },
    logLines: [{ id: 'log-1', timeLabel: '14:32:07', text: 'Bắt đầu xử lý.' }],
    overallSummaryLine: 'Đã xong 1/1 tầng.',
    activeTab: 'preview',
    onTabChange: NO_OP,
    isLogAutoScrollLocked: false,
    onToggleLogAutoScroll: NO_OP,
    onCopyLog: NO_OP,
    canCancel: false,
    isCancelConfirming: false,
    onRequestCancel: NO_OP,
    onConfirmCancel: NO_OP,
    onDismissCancel: NO_OP,
    onRunInBackground: NO_OP,
    isCompact: false,
    prefersReducedMotion: false,
  };
}

const meta = {
  title: 'Screens/Pipeline/ProcessingScreen',
  component: ProcessingScreen,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ProcessingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Khung tối thiểu (S4). Bộ bảy trạng thái đầy đủ của A11 là việc của V6. */
export const KhungToiThieu: Story = { args: minimalProcessingScreenProps() };
