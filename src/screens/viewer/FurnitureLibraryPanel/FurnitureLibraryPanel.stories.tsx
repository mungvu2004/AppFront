/**
 * Bảy story của panel thư viện nội thất — một story cho mỗi trạng thái của A11
 * (R-63).
 *
 * Story dựng THẲNG TỪ PROPS: `FurnitureLibraryPanel` là view thuần, hợp đồng
 * của nó (`furnitureLibraryPanelTypes.ts`) chỉ có đúng một trường `state`, nên
 * ở đây không có provider, không store, không cổng và không mạng. Bảy kịch bản
 * xuất ra dưới tên `FURNITURE_LIBRARY_PANEL_STORY_SCENARIOS` để bài kiểm dùng
 * chung đúng bộ dữ liệu này — hai nơi kể một câu chuyện thì phải kể từ cùng một
 * nguồn (R-70), khuôn đã chốt ở `CadBranchConfirm.stories.tsx`.
 *
 * BẪY ĐÃ TRÁNH: một export KHÔNG-PHẢI-STORY trong file CSF làm Storybook coi nó
 * là story và bỏ TRẮNG cả file. `meta.excludeStories` liệt đúng bốn export như
 * vậy.
 *
 * Ảnh xem trước là SVG đơn sắc nhúng thẳng bằng `data:` — không tệp thật, không
 * ảnh nhiều màu, không nền ca rô (CẤM TUYỆT ĐỐI), và không chuỗi nào bắt đầu
 * bằng `/` hay `http` (R-65).
 */

import type { Meta, StoryObj } from '@storybook/react';

import { staggerSchedule } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import { FurnitureLibraryPanel } from './FurnitureLibraryPanel';
import {
  FURNITURE_CATEGORY_LABELS,
  type FurnitureCategoryChip,
  type FurnitureLibraryPanelContent,
  type FurnitureLibraryPanelProps,
  type FurnitureLibraryPanelState,
  type FurnitureModelCardMotion,
} from './furnitureLibraryPanelTypes';

/** Khung nền của story: nền chìm, đủ cao để thấy tấm trượt đáy của `collapsed`. */
export const PANEL_FRAME_CLASS = 'flex min-h-[720px] items-start bg-bg-sunken p-6';

const noop = (): void => undefined;

const THUMBNAIL_DATA_URI =
  'data:image/svg+xml;utf8,' +
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48">' +
  '<rect x="6" y="18" width="52" height="18" rx="4"/>' +
  '<rect x="10" y="36" width="6" height="8"/>' +
  '<rect x="48" y="36" width="6" height="8"/>' +
  '</svg>';

interface CardSeed {
  readonly id: string;
  readonly name: string;
  readonly dimensionsLabel: string;
  readonly fileSizeCaption: string;
  readonly thumbnailAltText: string;
  readonly isUsedInProject?: boolean;
  readonly isHeavy?: boolean;
}

const CARD_SEEDS: readonly CardSeed[] = [
  {
    id: 'sofa-l',
    name: 'Sofa góc chữ L',
    dimensionsLabel: '2.400 × 1.600 × 850 mm',
    fileSizeCaption: '4,2 MB',
    thumbnailAltText: 'Ảnh xem trước sofa góc chữ L',
    isUsedInProject: true,
  },
  {
    id: 'ban-an-6',
    name: 'Bàn ăn sáu chỗ',
    dimensionsLabel: '1.800 × 900 × 750 mm',
    fileSizeCaption: '2,8 MB',
    thumbnailAltText: 'Ảnh xem trước bàn ăn sáu chỗ',
  },
  {
    id: 'giuong-doi',
    name: 'Giường đôi 1m6',
    dimensionsLabel: '2.000 × 1.600 × 420 mm',
    fileSizeCaption: '12,4 MB',
    thumbnailAltText: 'Ảnh xem trước giường đôi',
    isHeavy: true,
  },
  {
    id: 'tu-quan-ao',
    name: 'Tủ quần áo ba cánh',
    dimensionsLabel: '1.620 × 600 × 2.200 mm',
    fileSizeCaption: '5,1 MB',
    thumbnailAltText: 'Ảnh xem trước tủ quần áo ba cánh',
  },
  {
    id: 'ghe-lam-viec',
    name: 'Ghế làm việc xoay',
    dimensionsLabel: '620 × 620 × 1.150 mm',
    fileSizeCaption: '1,9 MB',
    thumbnailAltText: 'Ảnh xem trước ghế làm việc xoay',
  },
  {
    id: 'bon-rua',
    name: 'Bồn rửa mặt treo tường',
    dimensionsLabel: '600 × 450 × 180 mm',
    fileSizeCaption: '0,9 MB',
    thumbnailAltText: 'Ảnh xem trước bồn rửa mặt treo tường',
  },
];

/**
 * Lịch so le của lưới lấy thẳng từ `staggerSchedule` — đúng hàm hook gọi thật,
 * nên bước `STAGGER_STEP_MS` và trần `STAGGER_BUDGET_MS` là của repo chứ không
 * phải hai con số story tự bịa (R-71).
 */
function cardsFor(
  seeds: readonly CardSeed[],
  options: { readonly locked?: boolean; readonly unavailableIds?: readonly string[] } = {},
): readonly FurnitureModelCardMotion[] {
  const locked = options.locked ?? false;
  const unavailable = options.unavailableIds ?? [];
  const schedule = staggerSchedule(seeds.length);

  return seeds.map((seed, index) => {
    const isUnavailable = unavailable.includes(seed.id);
    const step = schedule[index];

    return {
      card: {
        id: seed.id,
        name: seed.name,
        thumbnailUrl: isUnavailable ? null : THUMBNAIL_DATA_URI,
        thumbnailStatus: isUnavailable ? ('unavailable' as const) : ('ready' as const),
        thumbnailAltText: seed.thumbnailAltText,
        dimensionsLabel: seed.dimensionsLabel,
        fileSizeCaption: seed.fileSizeCaption,
        isUsedInProject: seed.isUsedInProject ?? false,
        isHeavy: seed.isHeavy ?? false,
        isLocked: locked,
        ...(locked ? {} : { onDragStart: noop }),
        onSelect: noop,
      },
      delayMs: step?.delayMs ?? 0,
      durationMs: step?.durationMs ?? 0,
    };
  });
}

const CHIPS: readonly FurnitureCategoryChip[] = (
  ['all', 'table', 'chair', 'bed', 'sofa', 'cabinet', 'sanitary', 'kitchen', 'equipment', 'mine'] as const
).map((id) => ({
  id,
  label: FURNITURE_CATEGORY_LABELS[id],
  isActive: id === 'all',
  onSelect: noop,
}));

function contentFor(
  overrides: Partial<FurnitureLibraryPanelContent> = {},
): FurnitureLibraryPanelContent {
  return {
    searchQuery: '',
    onSearchQueryChange: noop,
    categoryChips: CHIPS,
    detectedGroups: [
      { id: 'sofa', label: 'sofa (4)', onReplaceAll: noop },
      { id: 'chair', label: 'ghế (12)', onReplaceAll: noop },
    ],
    cards: cardsFor(CARD_SEEDS),
    replaceAllPreview: null,
    onUploadModel: noop,
    ...overrides,
  };
}

/** Bảy kịch bản, dùng chung giữa story và bài kiểm (R-70). */
export const FURNITURE_LIBRARY_PANEL_STORY_SCENARIOS: Readonly<
  Record<SevenState, FurnitureLibraryPanelState>
> = {
  empty: {
    kind: 'empty',
    variant: 'no-match',
    searchedFor: 'sofa da',
    onClearFilters: noop,
  },
  loading: { kind: 'loading' },
  partial: {
    kind: 'partial',
    ...contentFor({
      cards: cardsFor(CARD_SEEDS, { unavailableIds: ['giuong-doi', 'bon-rua'] }),
    }),
  },
  error: {
    kind: 'error',
    message: 'Máy chủ không trả về được danh sách mô hình. Kiểm tra mạng rồi thử lại.',
    onRetry: noop,
  },
  success: { kind: 'success', ...contentFor() },
  forbidden: {
    kind: 'forbidden',
    ...contentFor({ cards: cardsFor(CARD_SEEDS, { locked: true }), onUploadModel: null }),
  },
  collapsed: { kind: 'collapsed', ...contentFor() },
};

/** Props của một trạng thái, dùng chung giữa story và bài kiểm (R-70). */
export function scenarioFor(state: SevenState): FurnitureLibraryPanelProps {
  return { state: FURNITURE_LIBRARY_PANEL_STORY_SCENARIOS[state] };
}

const meta = {
  title: 'Screens/Viewer/FurnitureLibraryPanel',
  component: FurnitureLibraryPanel,
  parameters: { layout: 'fullscreen' },
  /* Bốn export dưới đây là khung nền, dữ liệu và hàm dùng chung — KHÔNG phải
     story. Thiếu dòng này thì Storybook nhận nhầm chúng là story và cả file ra
     trắng. */
  excludeStories: [
    'PANEL_FRAME_CLASS',
    'FURNITURE_LIBRARY_PANEL_STORY_SCENARIOS',
    'REPLACE_ALL_PREVIEW_SCENARIO',
    'scenarioFor',
  ],
  decorators: [
    (Story): JSX.Element => (
      <div className={PANEL_FRAME_CLASS}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FurnitureLibraryPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — không mô hình nào khớp: nhắc lại nguyên văn chữ vừa tìm, cho xoá bộ lọc. */
export const Rong: Story = { args: scenarioFor('empty') };

/** 2. Đang tải — đúng tám ô khung xương vuông bằng thẻ thật, xếp đúng lưới hai cột. */
export const DangTai: Story = { args: scenarioFor('loading') };

/** 3. Một phần — hai mô hình chưa dựng được ảnh: biểu tượng trung tính, không ảnh vỡ. */
export const MotPhan: Story = { args: scenarioFor('partial') };

/** 4. Lỗi — không tải được thư viện, có nút thử lại. */
export const Loi: Story = { args: scenarioFor('error') };

/** 5. Xong — đủ chip, đủ mục "Đã phát hiện", lưới hai cột, có nút tải lên. */
export const Xong: Story = { args: scenarioFor('success') };

/** 6. Không có quyền — mọi thẻ khoá, không nút tải lên, vẫn xem và lọc được. */
export const KhongCoQuyen: Story = { args: scenarioFor('forbidden') };

/** 7. Thu gọn — tấm trượt đáy, một hàng thẻ cuộn ngang thay cho lưới hai cột. */
export const ThuGon: Story = { args: scenarioFor('collapsed') };

/**
 * Hộp xem trước "Thay thế tất cả" KHÔNG có story thứ tám: nó là một biến thể
 * của `success`, không phải trạng thái thứ tám của A11, và bảy story ở trên là
 * bảy trạng thái đúng như R-63 đếm. Kịch bản của nó xuất ra dưới dạng DỮ LIỆU
 * (nằm trong `excludeStories`) để bài kiểm dựng đúng hộp thoại ấy mà số story
 * không đổi.
 */
export const REPLACE_ALL_PREVIEW_SCENARIO: FurnitureLibraryPanelState = {
  kind: 'success',
  ...contentFor({
    replaceAllPreview: {
      detectedGroupId: 'sofa',
      groupLabel: 'Thay thế tất cả — sofa (4)',
      items: [
        { id: 'sofa-1', description: 'sofa phòng khách → Sofa góc chữ L' },
        { id: 'sofa-2', description: 'sofa phòng sinh hoạt → Sofa góc chữ L' },
        { id: 'sofa-3', description: 'sofa ban công → Sofa góc chữ L' },
        { id: 'sofa-4', description: 'sofa phòng ngủ lớn → Sofa góc chữ L' },
      ],
      onConfirm: noop,
      onCancel: noop,
    },
  }),
};
