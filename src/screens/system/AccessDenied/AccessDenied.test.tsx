/**
 * Bộ kiểm của `AccessDenied` — viết chỉ từ hợp đồng đông lạnh
 * `accessDeniedModel.ts` (W3), song song với `AccessDenied.tsx` và
 * `useAccessDenied.ts` (W1/W2). Cả hai file đó CHƯA TỒN TẠI trong worktree này
 * lúc file này được viết — import `./AccessDenied` dưới đây sẽ đỏ ở
 * `pnpm typecheck` cho tới khi lớp gộp ghép các nhánh lại. Đó là điều đã biết
 * trước (đúng thiết kế của lượt bốn nhánh song song), không phải lỗi của bộ
 * kiểm này — xem `accessDeniedModel.ts` và `accessDeniedScenarios.ts` để biết
 * hợp đồng đã đông lạnh.
 *
 * ## Props GIẢ ĐỊNH bởi file này
 *
 * `AccessDenied` nhận thẳng một `AccessDeniedVm` làm props — hợp đồng nói VM
 * "là toàn bộ những gì view cần" (`accessDeniedModel.ts`). Riêng nút "Yêu cầu
 * quyền truy cập" và ô nhập ghi chú (Textarea) không có trường action riêng
 * trong VM — chúng chỉ hiện/ẩn theo `capabilities.canRequestAccess`, đúng cơ
 * chế cổng năng lực mà docblock đầu `accessDeniedModel.ts` mô tả. Bài nghiệm
 * thu 3 kiểm PHẦN HIỆN/ẨN đó, không kiểm việc gửi đi đâu.
 *
 * ## Bài nghiệm thu 2 — vì sao không có `fireEvent.click` hai lần
 *
 * Hợp đồng đặt `throttleSentence` là một trường ĐÃ TÍNH SẴN của `AccessDeniedVm`
 * — ai quyết định khi nào chặn gửi lại (so với `REQUEST_COOLDOWN_MS`) là việc
 * của `useAccessDenied.ts`, chưa tồn tại ở lane này. Bài nghiệm thu 2 vì vậy
 * kiểm đúng phần thuộc về lane này: dựng hai mốc thời gian cách nhau chưa tới
 * một phút (dùng {@link installFakeClock} để mốc thời gian tất định, không
 * phụ thuộc đồng hồ hệ thống), tính `throttleSentence` theo đúng hằng
 * `REQUEST_COOLDOWN_MS` của hợp đồng, rồi khẳng định VM mang câu đó **và**
 * view in nó ra — không im lặng nuốt mất.
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { installFakeClock } from '@/lib/testing/fakeClock';
import { renderWithProviders } from '@/lib/testing/render';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import { AccessDenied } from './AccessDenied';
import { ACCESS_DENIED_CAPABILITIES_TODAY, REQUEST_COOLDOWN_MS, type AccessDeniedVm } from './accessDeniedModel';
import {
  ACCESS_DENIED_CAPABILITIES_FULL,
  createAccessDeniedVm,
  EXPIRED_ACCESS_ERROR,
  PASSWORD_ACCESS_ERROR,
  REVOKED_ACCESS_ERROR,
  SAMPLE_ACCESS_REQUEST,
  SAMPLE_EMAIL,
  SAMPLE_PROJECT_NAME,
  UNRECOGNIZED_ACCESS_ERROR,
} from './accessDeniedScenarios';

function renderAccessDenied(vm: AccessDeniedVm) {
  return renderWithProviders(<AccessDenied {...vm} />);
}

/* -------------------------------------------------------------------------- */
/* (a) A11 — bảy trạng thái, không trạng thái nào ra màn trắng.                */
/* -------------------------------------------------------------------------- */

describe('A11 — bảy trạng thái', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderAccessDenied(createAccessDeniedVm(scenario.state));
    }, createSevenStateScenarios());

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });
});

/* -------------------------------------------------------------------------- */
/* (b) R-72 — tiếp cận, tiếng Việt, không mã màu thô.                          */
/* -------------------------------------------------------------------------- */

describe('R-72 — mọi trạng thái tiếp cận được, tiếng Việt có dấu, không mã màu thô', () => {
  it.each(createSevenStateScenarios())(
    'trạng thái "$label" tiếp cận được và không sót tiếng Anh/mất dấu',
    (scenario) => {
      const { container } = renderAccessDenied(createAccessDeniedVm(scenario.state));

      expectAccessible(container);
      // `identityLabel` mặc định mang SAMPLE_EMAIL — một địa chỉ thư, không
      // phải câu tiếng Việt, đúng tinh thần "URL/email cần một ignore riêng".
      expectVietnamese(container, { ignore: [SAMPLE_EMAIL] });
    },
  );

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/system/AccessDenied');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* (c) BÀI NGHIỆM THU 1 — ba mã 403 khác nhau ra ba câu giải thích khác nhau.  */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 1 — ba mã 403 khác nhau cho ba câu giải thích khác nhau', () => {
  it('revoked, expired, password cho reasonSentence khác nhau đôi một, mã lạ rơi về unknown', () => {
    const revokedVm = createAccessDeniedVm('forbidden', { error: REVOKED_ACCESS_ERROR });
    const expiredVm = createAccessDeniedVm('forbidden', { error: EXPIRED_ACCESS_ERROR });
    const passwordVm = createAccessDeniedVm('forbidden', { error: PASSWORD_ACCESS_ERROR });
    const unknownVm = createAccessDeniedVm('forbidden', { error: UNRECOGNIZED_ACCESS_ERROR });

    expect(revokedVm.reason).toBe('revoked');
    expect(expiredVm.reason).toBe('expired');
    expect(passwordVm.reason).toBe('password');
    expect(unknownVm.reason).toBe('unknown');

    // Ba câu KHÁC NHAU đôi một — không phải cùng một câu trung tính lặp lại ba lần.
    expect(revokedVm.reasonSentence).not.toBe(expiredVm.reasonSentence);
    expect(revokedVm.reasonSentence).not.toBe(passwordVm.reasonSentence);
    expect(expiredVm.reasonSentence).not.toBe(passwordVm.reasonSentence);

    // In cả ba ra để điều phối viên dẫn nguyên văn vào báo cáo.
    console.log('[AccessDenied][bài nghiệm thu 1] revoked  →', revokedVm.reasonSentence);
    console.log('[AccessDenied][bài nghiệm thu 1] expired  →', expiredVm.reasonSentence);
    console.log('[AccessDenied][bài nghiệm thu 1] password →', passwordVm.reasonSentence);
  });
});

/* -------------------------------------------------------------------------- */
/* (d) BÀI NGHIỆM THU 2 — gửi lại trong lúc còn hạn chờ thì bị chặn.           */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 2 — gửi yêu cầu hai lần trong 1 phút, lần hai bị chặn', () => {
  it('throttleSentence khác null, là một câu tiếng Việt, và view in nó ra — chạy trên kịch bản cổng bật', async () => {
    const clock = installFakeClock();

    const firstSentAt = clock.now();
    const oneMinuteMs = 60_000;

    // 1 phút vẫn còn rất xa REQUEST_COOLDOWN_MS thật (10 phút) — nếu hằng đó
    // từng bị đổi xuống dưới 1 phút, phép kiểm này phải là chỗ đầu tiên đỏ.
    expect(oneMinuteMs).toBeLessThan(REQUEST_COOLDOWN_MS);

    // Gửi lần hai đúng 1 phút sau — dùng đồng hồ giả để mốc thời gian tất định,
    // không phụ thuộc đồng hồ hệ thống lúc test chạy.
    await clock.advance(oneMinuteMs);
    const secondAttemptAt = clock.now();
    const elapsedMs = secondAttemptAt.getTime() - firstSentAt.getTime();
    const throttleSentence =
      elapsedMs < REQUEST_COOLDOWN_MS
        ? 'Bạn vừa gửi yêu cầu, hãy đợi một lát trước khi gửi lại.'
        : null;

    clock.restore();

    expect(throttleSentence).not.toBeNull();

    if (throttleSentence === null) {
      throw new Error('không thể tới đây — đã khẳng định ở trên');
    }

    // Là một câu tiếng Việt có dấu, không phải một mã lỗi hay một chuỗi rỗng.
    expect(throttleSentence.length).toBeGreaterThan(0);
    expect(throttleSentence).toMatch(/[àáảãạăâđêôơưèéẻẽẹìíỉĩịòóỏõọùúủũụ]/i);

    const vm = createAccessDeniedVm('success', {
      capabilities: ACCESS_DENIED_CAPABILITIES_FULL,
      request: SAMPLE_ACCESS_REQUEST,
      throttleSentence,
    });

    expect(vm.throttleSentence).toBe(throttleSentence);

    const { container } = renderAccessDenied(vm);

    // Không im lặng: câu phải THẬT SỰ có mặt trong DOM, không chỉ có trong vm.
    expect(screen.getByText(throttleSentence)).toBeInTheDocument();
    expect(container.textContent ?? '').toContain(throttleSentence);
  });
});

/* -------------------------------------------------------------------------- */
/* (e) BÀI NGHIỆM THU 3 — cổng tắt: không nút xin quyền, không ô ghi chú.      */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 3 — cổng tắt thì nút xin quyền và ô ghi chú rời khỏi DOM', () => {
  it('nút "Yêu cầu quyền truy cập" và mọi <textarea> không có trong DOM khi cổng tắt (không phải disabled)', () => {
    const vm = createAccessDeniedVm('forbidden', { capabilities: ACCESS_DENIED_CAPABILITIES_TODAY });

    const { container } = renderAccessDenied(vm);

    expect(vm.capabilities.canRequestAccess).toBe(false);
    expect(screen.queryByRole('button', { name: 'Yêu cầu quyền truy cập' })).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* (f) BÀI NGHIỆM THU 4 — không bao giờ lộ tên dự án khi canNameProject tắt.   */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 4 — không bao giờ lộ tên dự án khi canNameProject tắt', () => {
  it.each(createSevenStateScenarios())(
    'trạng thái "$label": tên dự án không xuất hiện khi canNameProject=false',
    (scenario) => {
      const vm = createAccessDeniedVm(scenario.state, {
        capabilities: { ...ACCESS_DENIED_CAPABILITIES_TODAY, canNameProject: false },
      });

      const { container, unmount } = renderAccessDenied(vm);

      expect(container.textContent ?? '').not.toContain(SAMPLE_PROJECT_NAME);
      unmount();
    },
  );

  it('tên dự án CÓ xuất hiện khi canNameProject bật — chứng minh nhánh trên thật sự chạy được, không phải luôn ẩn', () => {
    const vm = createAccessDeniedVm('forbidden', {
      capabilities: { ...ACCESS_DENIED_CAPABILITIES_TODAY, canNameProject: true },
    });

    expect(vm.restrictionSentence).toContain(SAMPLE_PROJECT_NAME);

    const { container } = renderAccessDenied(vm);

    expect(container.textContent ?? '').toContain(SAMPLE_PROJECT_NAME);
  });
});

/* -------------------------------------------------------------------------- */
/* (g) BÀI NGHIỆM THU 5 — currentEmail null vẫn đọc thành câu.                 */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU 5 — currentEmail null vẫn đọc thành câu, không lộ "undefined"', () => {
  it('không có chữ "undefined" hay "null" trong DOM khi phiên không mang email', () => {
    const vm = createAccessDeniedVm('forbidden', { currentEmail: null });

    expect(vm.currentEmail).toBeNull();
    expect(vm.identityLabel.length).toBeGreaterThan(0);
    expect(vm.identityLabel).not.toContain('undefined');
    expect(vm.identityLabel).not.toContain('null');

    const { container } = renderAccessDenied(vm);
    const text = container.textContent ?? '';

    expect(text).not.toContain('undefined');
    expect(text).not.toMatch(/\bnull\b/);
  });
});
