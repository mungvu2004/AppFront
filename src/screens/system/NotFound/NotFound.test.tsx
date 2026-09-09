/**
 * Bộ kiểm của `NotFound` — viết chỉ từ hợp đồng đông lạnh `notFoundModel.ts`
 * (T7), song song với `NotFound.tsx` và `useNotFound.ts`. Cả hai file đó CHƯA
 * TỒN TẠI trong worktree này lúc file này được viết — import `./NotFound` dưới
 * đây sẽ đỏ ở `pnpm typecheck` cho tới khi lớp gộp ghép bốn nhánh lại. Đó là
 * điều đã biết trước (đúng thiết kế của T7), không phải lỗi của bộ kiểm này.
 *
 * ## Props GIẢ ĐỊNH bởi file này
 *
 * `NotFound` nhận thẳng một `NotFoundVm` làm props — hợp đồng nói `NotFoundVm`
 * "là toàn bộ props của view" (`notFoundModel.ts`). Không có giả định nào khác
 * về props; mọi kịch bản dựng qua `createNotFoundVm` của `notFoundScenarios.ts`.
 *
 * ## Ghi chú khảo sát so với hợp đồng
 *
 * Không tìm thấy điểm nào hai bên nói khác nhau. Riêng cơ chế giữ đường dẫn
 * định đến khi bấm "Đăng nhập" (bài nghiệm thu 1) không nằm trong
 * `notFoundModel.ts` — model cố tình để `primaryAction.onActivate` là `() =>
 * void` đã nối sẵn, "view không biết nó đi đâu". Cơ chế cụ thể
 * (`navigate(ROUTES.login, { state: { from: path } })`) lấy từ ghi chú khảo
 * sát `01-data-auth.md` mục B.6 (cơ chế `safeDestination`/`location.state.from`
 * đã có sẵn ở `AuthScreen.container.tsx`) và được mô phỏng trong
 * `notFoundScenarios.createNotFoundVm` để bài nghiệm thu 1 có gì đó thật để
 * kiểm — xem docblock đầu file đó.
 *
 * ## Một bẫy đã tránh
 *
 * `errorCaption` chứa một đường dẫn (`/du-an/8f2a`) — chuỗi này ghép bằng dấu
 * gạch nối (`du-an`) nên `expectVietnamese` coi nó là MỘT từ và không nhận ra
 * hình dạng tiếng Việt của nó (khác biệt với việc tách `du`/`an` thành hai từ
 * riêng). Đây không phải lỗi chính tả — đó là một đoạn đường dẫn kỹ thuật,
 * không phải câu tiếng Việt — nên mọi lời gọi `expectVietnamese` trong file này
 * đều truyền `ignore: [/\//]` để bỏ qua đúng chuỗi caption có dấu gạch chéo,
 * đúng tinh thần "URL/email cần một biểu thức bỏ qua" đã áp dụng cho các màn
 * khác.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

import { NotFound } from './NotFound';
import { RECENT_PROJECT_LIMIT } from './notFoundModel';
import { createNotFoundVm, SAMPLE_RECENT_PROJECTS } from './notFoundScenarios';

/* -------------------------------------------------------------------------- */
/* (a) A11 — bảy trạng thái, không trạng thái nào ra màn trắng.                */
/* -------------------------------------------------------------------------- */

describe('A11 — bảy trạng thái', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<NotFound {...createNotFoundVm(scenario.state)} />);
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
      const { container } = render(<NotFound {...createNotFoundVm(scenario.state)} />);

      // Nếu một phần tử cụ thể của view làm bài này trượt vì lý do ngoài tầm
      // của bộ ba file test/story/scenario (ví dụ một control chưa có
      // ignoreSelector phù hợp), người ghép ghi lại và sửa ở view — bài kiểm
      // này không được nới điều kiện để né (R-70).
      expectAccessible(container);
      // `errorCaption` mang một đường dẫn kỹ thuật — bỏ qua đúng chuỗi đó,
      // xem "Một bẫy đã tránh" ở docblock đầu file.
      expectVietnamese(container, { ignore: [/\//] });
    },
  );

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/system/NotFound');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* (c) BÀI NGHIỆM THU 1 — chưa đăng nhập giữ đường dẫn định đến.               */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — chưa đăng nhập thì nút chính là "Đăng nhập" và giữ đường dẫn định đến', () => {
  it('nút chính đổi thành "Đăng nhập", kích hoạt điều hướng /login kèm state.from giữ nguyên đường dẫn', () => {
    const navigate = vi.fn();
    const path = '/du-an/8f2a/tang-2/tuong';
    const vm = createNotFoundVm('forbidden', { path, navigate });

    expect(vm.primaryAction.label).toBe('Đăng nhập');

    render(<NotFound {...vm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(ROUTES.login, { state: { from: path } });
  });
});

/* -------------------------------------------------------------------------- */
/* (d) BÀI NGHIỆM THU 2 — trạng thái lỗi vẫn đủ hai nút.                       */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — trạng thái lỗi vẫn đủ hai nút', () => {
  it('còn cả nút chính lẫn nút "Quay lại" khi state là "error"', () => {
    const vm = createNotFoundVm('error');

    render(<NotFound {...vm} />);

    expect(screen.getByRole('button', { name: vm.primaryAction.label })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: vm.secondaryAction.label })).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* (e) BÀI NGHIỆM THU 3 — khối gợi ý tối đa RECENT_PROJECT_LIMIT hàng, ẩn khi rỗng. */
/* -------------------------------------------------------------------------- */

describe(`BÀI NGHIỆM THU — khối gợi ý hiện tối đa ${String(RECENT_PROJECT_LIMIT)} hàng, ẩn hẳn khi rỗng`, () => {
  it(`hiện tối đa ${String(RECENT_PROJECT_LIMIT)} hàng dù dữ liệu đưa vào nhiều hơn`, () => {
    // Cố tình đưa nhiều hơn RECENT_PROJECT_LIMIT để bài này chứng minh view
    // CẮT bớt, không phải tình cờ nhận đúng số lượng (SAMPLE_RECENT_PROJECTS
    // có 5 mục, luôn nhiều hơn giới hạn hiện tại).
    expect(SAMPLE_RECENT_PROJECTS.length).toBeGreaterThan(RECENT_PROJECT_LIMIT);

    const vm = { ...createNotFoundVm('success'), recentProjects: SAMPLE_RECENT_PROJECTS };

    render(<NotFound {...vm} />);

    for (const project of SAMPLE_RECENT_PROJECTS.slice(0, RECENT_PROJECT_LIMIT)) {
      expect(screen.getByText(project.name)).toBeInTheDocument();
    }

    for (const project of SAMPLE_RECENT_PROJECTS.slice(RECENT_PROJECT_LIMIT)) {
      expect(screen.queryByText(project.name)).not.toBeInTheDocument();
    }
  });

  it('ẩn hẳn khối gợi ý (không còn tiêu đề của nó) khi recentProjects rỗng', () => {
    const vm = createNotFoundVm('empty');

    expect(vm.recentProjects).toHaveLength(0);

    render(<NotFound {...vm} />);

    expect(screen.queryByText(vm.recentHeading)).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* (f) BÀI NGHIỆM THU 4 — mã lỗi nhỏ, chọn được, không "404" khổng lồ.         */
/* -------------------------------------------------------------------------- */

describe('BÀI NGHIỆM THU — mã lỗi có mặt, chọn được, và không có "404" khổng lồ giữa màn', () => {
  it('caption mã lỗi hiện đủ, không mang class chặn bôi đen, và "404" chỉ xuất hiện đúng một lần trong cả màn', () => {
    const vm = createNotFoundVm('success');

    const { container } = render(<NotFound {...vm} />);

    const caption = screen.getByText(vm.errorCaption);

    expect(caption).toBeInTheDocument();

    // "Chọn được" ở ứng dụng này là KHÔNG mang class Tailwind `select-none`,
    // trên chính caption lẫn mọi tổ tiên của nó trong cây đã render (một tổ
    // tiên khoá bôi đen thì con bên trong cũng hết chọn được).
    for (let node: HTMLElement | null = caption; node !== null && node !== container; node = node.parentElement) {
      expect(node.classList.contains('select-none')).toBe(false);
    }

    // Không có chữ số "404" cỡ lớn giữa màn — kiểm rằng "404" chỉ xuất hiện
    // đúng một lần trong toàn bộ cây, tức chỉ trong caption.
    const occurrences = (container.textContent ?? '').match(/404/g) ?? [];

    expect(occurrences).toHaveLength(1);
  });
});
