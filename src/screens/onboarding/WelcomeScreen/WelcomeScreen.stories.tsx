/**
 * Màn `ROUTES.onboarding` trong bảy trạng thái của bất biến A11.
 *
 * Mọi story dựng {@link WelcomeScreen} — view thuần — chứ không dựng
 * `WelcomeScreenContainer`: không truy vấn, không router, không `Toast.Provider`,
 * không `localStorage`. Đó là toàn bộ lý do mục D chia màn làm hai.
 *
 * `WelcomeScreen.test.tsx` cố ý KHÔNG nhập lại file này: bộ kiểm dẫn bảy `props`
 * của nó ra từ `createSevenStateScenarios()`, nên bộ kịch bản chung đổi hình thì
 * bộ kiểm đỏ — còn story thì minh hoạ, và minh hoạ được phép viết tay.
 *
 * Bảy story, đúng bảy trạng thái, không hơn: bảng ánh xạ ở mục 4 của hợp đồng
 * đông cứng nói mỗi trạng thái ba thẻ trông ra sao, và mỗi story dưới đây là một
 * dòng của bảng đó đọc được bằng mắt.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { WelcomeScreen } from './WelcomeScreen';
import type { OnboardingLink, OnboardingStepCard, WelcomeScreenProps } from './WelcomeScreen';

const meta = {
  title: 'Screens/Onboarding/WelcomeScreen',
  component: WelcomeScreen,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof WelcomeScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Chuỗi — bảng ở mục 3 của hợp đồng đông cứng, chép để story đọc được một mình.*/
/* -------------------------------------------------------------------------- */

const GREETING = 'Chào Minh, bắt đầu trong ba bước';

const INTRO =
  'AppFront đọc bản vẽ kiến trúc của bạn và dò ra trục, tường, phòng, ô mở. Ba bước dưới đây đưa bạn từ tệp bản vẽ tới mô hình không gian xem được.';

const SAMPLE_LINK: OnboardingLink = {
  label: 'Xem dự án mẫu',
  disabledReason: null,
  onActivate: noop,
};

const TUTORIAL_LINK: OnboardingLink = {
  label: 'Xem hướng dẫn 2 phút',
  disabledReason: 'Hướng dẫn hai phút chưa sẵn sàng.',
  onActivate: noop,
};

const SKIP_LINK: OnboardingLink = {
  label: 'Bỏ qua',
  disabledReason: null,
  onActivate: noop,
};

/* -------------------------------------------------------------------------- */
/* Ba thẻ, mỗi thẻ ở ba trạng thái nó có thể ở.                                */
/* -------------------------------------------------------------------------- */

function stepOne(state: OnboardingStepCard['state'], isPrimary: boolean): OnboardingStepCard {
  return {
    id: 'createProject',
    ordinal: '1',
    title: 'Tạo dự án',
    sentence: 'Khai báo tên công trình và danh sách tầng.',
    actionLabel: 'Tạo dự án',
    state,
    isPrimary,
    lockedReason: null,
    onActivate: noop,
  };
}

function stepTwo(state: OnboardingStepCard['state'], isPrimary: boolean): OnboardingStepCard {
  return {
    id: 'uploadDrawings',
    ordinal: '2',
    title: 'Tải bản vẽ theo từng tầng',
    sentence: 'Kéo ảnh quét hoặc tệp CAD vào từng tầng.',
    actionLabel: 'Tải bản vẽ',
    state,
    isPrimary,
    lockedReason: state === 'locked' ? 'Cần tạo dự án trước.' : null,
    onActivate: noop,
  };
}

function stepThree(state: OnboardingStepCard['state'], isPrimary: boolean): OnboardingStepCard {
  return {
    id: 'reviewAndBuild',
    ordinal: '3',
    title: 'Duyệt kết quả và dựng 3D',
    sentence: 'Kiểm tra tường, cửa, phòng rồi xem mô hình.',
    actionLabel: 'Duyệt kết quả',
    state,
    isPrimary,
    lockedReason: state === 'locked' ? 'Cần tải bản vẽ trước.' : null,
    onActivate: noop,
  };
}

/** Mọi trường không đổi giữa bảy trạng thái, một chỗ. */
const BASE: WelcomeScreenProps = {
  screenState: 'empty',
  isCollapsed: false,
  greeting: GREETING,
  intro: INTRO,
  cards: [stepOne('open', true), stepTwo('locked', false), stepThree('locked', false)],
  sampleProjectLink: SAMPLE_LINK,
  tutorialLink: TUTORIAL_LINK,
  skipLink: SKIP_LINK,
  errorMessage: null,
  onRetry: noop,
  finishLabel: null,
  onFinish: noop,
  isDissolving: false,
  skipNotice: 'Có thể xem lại hướng dẫn trong menu trợ giúp.',
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: chưa có dự án nào, thẻ 1 mở, hai thẻ sau khoá kèm lý do. */
export const Empty: Story = { args: BASE };

/** 2 — đang tải: ba khung xương đúng cỡ thẻ, không tiêu đề thẻ và không nút. */
export const Loading: Story = {
  args: { ...BASE, screenState: 'loading' },
};

/** 3 — một phần: đã có dự án, chưa dò ra tường nào, nên thẻ 2 là thẻ chính. */
export const Partial: Story = {
  args: {
    ...BASE,
    screenState: 'partial',
    cards: [stepOne('done', false), stepTwo('open', true), stepThree('locked', false)],
  },
};

/** 4 — lỗi: truy vấn danh sách dự án hỏng, nên màn không biết người này ở bước nào. */
export const ErrorState: Story = {
  args: {
    ...BASE,
    screenState: 'error',
    errorMessage: 'Chưa lấy được danh sách dự án nên chưa biết bạn đang ở bước nào.',
  },
};

/** 5 — thành công: cả ba bước xong, và nút đi tiếp hiện ra. */
export const Success: Story = {
  args: {
    ...BASE,
    screenState: 'success',
    cards: [stepOne('done', false), stepTwo('done', false), stepThree('done', false)],
    finishLabel: 'Vào danh sách dự án',
  },
};

/** 6 — không có quyền: vai Người xem, mảng thẻ còn ĐÚNG một phần tử — thẻ 3. */
export const Forbidden: Story = {
  args: {
    ...BASE,
    screenState: 'forbidden',
    cards: [stepThree('open', true)],
  },
};

/** 7 — thu gọn: dưới 1024 ba thẻ xếp dọc; story bật tay vì Storybook không đổi bề rộng. */
export const Collapsed: Story = {
  args: { ...BASE, screenState: 'collapsed', isCollapsed: true },
};
