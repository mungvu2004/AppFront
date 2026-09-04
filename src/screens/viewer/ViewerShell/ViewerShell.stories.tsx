/**
 * Bảy story của VỎ CHUNG chín màn 3D — một story cho mỗi trạng thái của A11
 * (R-63).
 *
 * Story dựng CONTAINER, không dựng view bằng props viết tay. Cùng lý lẽ
 * `ThicknessStandardization.stories.tsx`: kịch bản mang NGUYÊN LIỆU đồ thị, và
 * mọi con số hiển thị ("4 tầng · 14 phòng · 248,60 m²") là KẾT QUẢ của
 * `useViewerShell` cộng `src/domain/rooms/area`. Dựng props bằng tay ở đây
 * nghĩa là tự gõ lại đúng những con số đang cần chứng minh — một story như vậy
 * trông đúng kể cả khi màn đã hỏng.
 *
 * `addon-a11y` của Storybook soát từng story; `ViewerShell.test.tsx` chạy
 * `expectAccessible` trên cùng bảy kịch bản này.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

import { createTestQueryClient } from '@/lib/testing/render';
import { createShortcutRegistry } from '@/lib/input/shortcutRegistry';

import { ViewerShellContainer } from './ViewerShell.container';
import {
  createViewerShellFixtureGateway,
  VIEWER_FIXTURE_SPATIAL,
} from './viewerShellGateway';
import { VIEWER_SHELL_SCENARIOS } from './viewerShellScenarios';
import type { ViewerScreenState } from './viewerShellTypes';

/**
 * Cổng hỏng, để trạng thái `error` là một lượt đọc THẤT BẠI thật chứ không phải
 * một cờ bật tay.
 *
 * `useViewerShell` suy ra `state` từ `projectQuery.isError`, nên story này đi
 * đúng nhánh mà người dùng gặp: `useQuery` nhận một promise bị từ chối.
 */
const failingGateway = {
  ...createViewerShellFixtureGateway(VIEWER_FIXTURE_SPATIAL),
  readProjectName: (): Promise<string | null> =>
    Promise.reject(new Error('network: fetch failed')),
};

/**
 * Đối số của một kịch bản, dùng chung giữa story và bài kiểm (R-70).
 *
 * Mỗi lượt dựng lấy một `ShortcutRegistry` RIÊNG: bảy story cùng đăng ký mười
 * ba phím vào một sổ chung sẽ làm `reportOverlaps()` kêu trùng bảy lần, mà đó
 * là bảy bản sao của cùng một màn chứ không phải bảy tính năng giành phím.
 */
export function scenarioArgsFor(state: ViewerScreenState) {
  const scenario = VIEWER_SHELL_SCENARIOS[state];

  return {
    projectId: 'P-001',
    roles: scenario.roles,
    spatial: scenario.spatial,
    perf: scenario.perf,
    forceState: state,
    isDev: state === 'success',
    registry: createShortcutRegistry({ isDev: false }),
    gateway: state === 'error' ? failingGateway : createViewerShellFixtureGateway(scenario.spatial),
  };
}

const meta = {
  title: 'Screens/Viewer/ViewerShell',
  component: ViewerShellContainer,
  parameters: { layout: 'fullscreen' },
  /* `scenarioArgsFor` là hàm dùng chung, không phải một story — xuất khẩu thêm
     một hàm vào file CSF sẽ làm Storybook coi nó là story và bỏ trắng cả file. */
  excludeStories: ['scenarioArgsFor'],
  decorators: [
    (Story): JSX.Element => (
      <QueryClientProvider client={createTestQueryClient()}>
        <MemoryRouter>
          <div className="h-screen w-screen">
            <Story />
          </div>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ViewerShellContainer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Dự án chưa dựng được tầng nào — khung nhìn vẫn đúng nền, đúng chân trời. */
export const Rong: Story = { args: scenarioArgsFor('empty') };

/** Đang dựng mô hình. */
export const DangTai: Story = { args: scenarioArgsFor('loading') };

/** Đủ bốn tầng, mới có phòng của tầng dưới cùng. */
export const MotPhan: Story = { args: scenarioArgsFor('partial') };

/** Lượt đọc hỏng; khung nhìn VẪN xem được. */
export const Loi: Story = { args: scenarioArgsFor('error') };

/** 4 tầng · 14 phòng · 248,60 m² · 58 fps, kèm chip hiệu năng của nhà phát triển. */
export const Xong: Story = { args: scenarioArgsFor('success') };

/** Vai Người xem: công cụ "đo" bị GỠ khỏi ray, không phải làm mờ. */
export const KhongCoQuyen: Story = { args: scenarioArgsFor('forbidden') };

/** Hai ray và panel phải ẩn; ray công cụ nổi lên khung nhìn. */
export const ThuGon: Story = { args: scenarioArgsFor('collapsed') };
