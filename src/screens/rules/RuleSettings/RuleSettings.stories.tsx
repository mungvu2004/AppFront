/**
 * Bảy trạng thái của {@link RuleSettings} (A11 / R-63): rỗng, đang tải, một
 * phần, lỗi, xong, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args`
 * tĩnh, đúng khuôn `RuleReport.stories.tsx` (tên export ASCII, tiếng Anh — mục
 * B/E.11 của CLAUDE.md; nhãn tiếng Việt của từng trạng thái nằm trong chú thích
 * ngay trên mỗi story).
 *
 * Dữ liệu mẫu đến từ `ruleSettingsFixtures.ts` — số luật (25/23), tên luật và
 * số đối tượng bị ảnh hưởng tính từ sổ đăng ký thật và một lượt `runRules()`
 * thật, không viết tay ở đây (R-70). `RuleSettings.test.tsx` dùng đúng bộ dữ
 * liệu này, nên hai file không kể hai câu chuyện khác nhau về cùng một màn.
 */

import type { Meta, StoryObj } from '@storybook/react';

import {
  EDITABLE_CAPABILITIES,
  NOOP_RULE_SETTINGS_ACTIONS,
  READ_ONLY_CAPABILITIES,
  buildRuleSettingsModel,
} from './ruleSettingsFixtures';
import { RuleSettings } from './RuleSettings';
import type { RuleSettingsProps } from './types';

const meta = {
  title: 'Screens/Rules/RuleSettings',
  component: RuleSettings,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof RuleSettings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Props nền — mọi story ghi đè từ đây. */
const BASE_PROPS: RuleSettingsProps = {
  model: buildRuleSettingsModel({ status: 'empty' }),
  capabilities: EDITABLE_CAPABILITIES,
  ...NOOP_RULE_SETTINGS_ACTIONS,
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (tên export ASCII — mục B/E.11; nhãn tiếng Việt trong chú     */
/* thích, đúng khuôn RuleReport.stories.tsx).                                  */
/* -------------------------------------------------------------------------- */

/** 1 · rỗng — chưa có mô hình nào để đánh giá; mọi impactCaption là "Chưa có dữ liệu để đánh giá". */
export const Empty: Story = {
  args: { ...BASE_PROPS, model: buildRuleSettingsModel({ status: 'empty' }) },
};

/** 2 · đang tải — 25 luật đã biết, đang chờ tính lại số đối tượng bị ảnh hưởng. */
export const Loading: Story = {
  args: { ...BASE_PROPS, model: buildRuleSettingsModel({ status: 'loading' }) },
};

/** 3 · một phần — đang lưu cấu hình vừa đổi (A7: `saveState` = "saving"). */
export const Partial: Story = {
  args: { ...BASE_PROPS, model: buildRuleSettingsModel({ status: 'partial' }) },
};

/** 4 · lỗi — không tải được cài đặt bộ luật. */
export const ErrorState: Story = {
  args: { ...BASE_PROPS, model: buildRuleSettingsModel({ status: 'error' }) },
};

/**
 * 5 · xong — đủ 25 luật, 23 luật đang bật. `ROOM-HAS-DOOR` và `ROOM-MIN-AREA`
 * hiện ở độ mờ thấp, mỗi luật kèm `supersededBy` trỏ sang luật fuller hơn của
 * nhóm `function` (`ROOM-NO-DOOR`, `ROOM-AREA-BELOW-MINIMUM`).
 */
export const Ready: Story = {
  args: { ...BASE_PROPS, model: buildRuleSettingsModel({ status: 'ready' }) },
};

/** 6 · không có quyền — chỉ đọc; `readOnlyReason` nói rõ ai được đổi. */
export const Forbidden: Story = {
  args: {
    ...BASE_PROPS,
    model: buildRuleSettingsModel({ status: 'forbidden' }),
    capabilities: READ_ONLY_CAPABILITIES,
  },
};

/** 7 · thu gọn — vỏ ứng dụng báo màn đang hẹp. */
export const Collapsed: Story = {
  args: { ...BASE_PROPS, model: buildRuleSettingsModel({ status: 'collapsed' }) },
};
