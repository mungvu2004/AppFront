/**
 * Bảy story của `Viewer3D` — một story cho mỗi trạng thái của A11 (R-63).
 *
 * `scenarioPropsFor` dựng đúng `Viewer3DProps` cho một trạng thái, dùng chung
 * giữa story và `Viewer3D.test.tsx` (R-70) — không có hai bộ dữ liệu mẫu khác
 * nhau kiểm cùng một màn.
 */

import type { Meta, StoryObj } from '@storybook/react';

import type { ViewerSceneFrame, ViewerScreenState } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { Viewer3D } from './Viewer3D';

const BASE_FRAME: ViewerSceneFrame = {
  azimuthRad: 0.6,
  polarRad: 1.1,
  distanceM: 12,
  isOrthographic: false,
  visibleStoreyIds: ['T01', 'T02', 'T03', 'T04'],
  separation: 0,
  sectionPlane: null,
  selectedEntityIds: [],
  hoveredEntityId: null,
  isolatedEntityIds: null,
  hiddenEntityIds: [],
  reducedMotion: false,
};

/** Đối số dùng chung giữa story và bài kiểm (R-70). */
export function scenarioPropsFor(state: ViewerScreenState) {
  const base = {
    state,
    frame: BASE_FRAME,
    buildProgressLabel: state === 'loading' ? '62%' : null,
    readyStoreyIds: state === 'partial' ? ['T01', 'T02'] : BASE_FRAME.visibleStoreyIds,
    wireframeCaptionOf: (storeyId: string) => `Tầng ${storeyId} — chưa dựng xong`,
    webglUnavailable: false,
    fallback2dHref: '/projects/P-001/2d',
    qcHref: '/projects/P-001/qc',
    onRetryBuild: () => {
      /* Story chỉ minh hoạ, không gọi lệnh thật. */
    },
    canEdit: state !== 'forbidden',
  };

  if (state === 'empty' || state === 'loading') {
    return { ...base, frame: { ...BASE_FRAME, visibleStoreyIds: [] } };
  }

  return base;
}

const meta = {
  title: 'Screens/Viewer/Viewer3D',
  component: Viewer3D,
  parameters: { layout: 'fullscreen' },
  /* `scenarioPropsFor` là hàm dùng chung, không phải một story — xuất khẩu
     thêm một hàm vào file CSF sẽ làm Storybook coi nó là story và bỏ trắng cả
     file. */
  excludeStories: ['scenarioPropsFor'],
  decorators: [
    (Story): JSX.Element => (
      <div className="h-screen w-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Viewer3D>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Dự án chưa dựng được tầng nào. */
export const Rong: Story = { args: scenarioPropsFor('empty') };

/** Đang dựng mô hình, phần trăm thật. */
export const DangTai: Story = { args: scenarioPropsFor('loading') };

/** Hai tầng đã dựng xong, hai tầng còn khung dây kèm caption. */
export const MotPhan: Story = { args: scenarioPropsFor('partial') };

/** Không có WebGL — câu giải thích riêng, nút thử lại, liên kết 2D, không mã lỗi trần. */
export const Loi: Story = { args: { ...scenarioPropsFor('error'), webglUnavailable: true } };

/** Bốn tầng, đủ hình. */
export const Xong: Story = { args: scenarioPropsFor('success') };

/** Vai Người xem: công cụ sửa bị GỠ khỏi DOM, không phải làm mờ. */
export const KhongCoQuyen: Story = { args: scenarioPropsFor('forbidden') };

/** Thu gọn — vỏ ẩn hai ray và panel; nội dung khung nhìn giữ nguyên. */
export const ThuGon: Story = { args: scenarioPropsFor('collapsed') };
