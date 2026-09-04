/**
 * Bài kiểm của `Viewer3D` — view thuần, chỉ từ props (R-60, R-70).
 *
 * Không dựng store, không gọi mạng: mọi kịch bản đi qua `scenarioPropsFor` của
 * file story (R-70, cùng dữ liệu mẫu giữa story và bài kiểm).
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import { Viewer3D } from './Viewer3D';
import { scenarioPropsFor } from './Viewer3D.stories';
import type { ViewerScreenState } from '@/screens/viewer/ViewerShell/viewerShellTypes';

afterEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* [V5-1] Bảy trạng thái của A11.                                              */
/* -------------------------------------------------------------------------- */

describe('[V5-1] bảy trạng thái', () => {
  it('đi qua expectSevenStates, không trạng thái nào ra màn trắng', () => {
    let rendered = 0;

    expectSevenStates((scenario) => {
      const { container, unmount } = render(
        <Viewer3D {...scenarioPropsFor(scenario.state as ViewerScreenState)} />,
      );
      rendered += 1;

      return { container, unmount };
    }, createSevenStateScenarios());

    console.log(`[VIEWER3D][V5-1] expectSevenStates = ${rendered}/${SEVEN_STATES.length}`);

    expect(rendered).toBe(SEVEN_STATES.length);
    expect(rendered).toBe(7);
  });

  it('mỗi trạng thái vẫn còn vùng nội dung mô hình 3D', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = render(<Viewer3D {...scenarioPropsFor(state)} />);

      expect(
        screen.getByRole('region', { name: 'Nội dung mô hình 3D' }),
        `trạng thái ${state} ra màn trắng`,
      ).toBeInTheDocument();

      unmount();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* [V5-2] Nội dung riêng từng trạng thái.                                      */
/* -------------------------------------------------------------------------- */

describe('[V5-2] nội dung theo trạng thái', () => {
  it('rỗng: câu nguyên văn và nút quay lại QC', () => {
    render(<Viewer3D {...scenarioPropsFor('empty')} />);

    expect(
      screen.getByText('Mô hình 3D sẽ xuất hiện sau khi bạn duyệt lớp tường.'),
    ).toBeInTheDocument();

    const qcLink = screen.getByRole('link', { name: 'Quay lại xem lớp tường' });
    expect(qcLink).toHaveAttribute('href', scenarioPropsFor('empty').qcHref);
  });

  it('đang tải: hiện phần trăm thật lấy từ props', () => {
    render(<Viewer3D {...scenarioPropsFor('loading')} />);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('62%');
  });

  it('một phần: tầng chưa dựng xong vẽ khung dây kèm caption', () => {
    const props = scenarioPropsFor('partial');
    render(<Viewer3D {...props} />);

    const notReady = props.frame.visibleStoreyIds.filter(
      (id) => !props.readyStoreyIds.includes(id),
    );
    expect(notReady.length).toBeGreaterThan(0);

    for (const storeyId of notReady) {
      expect(screen.getByText(props.wireframeCaptionOf(storeyId))).toBeInTheDocument();
    }
  });

  it('lỗi không có WebGL: giải thích bằng tiếng thường, không mã lỗi trần', () => {
    render(<Viewer3D {...scenarioPropsFor('error')} webglUnavailable />);

    const region = screen.getByRole('region', { name: 'Nội dung mô hình 3D' });
    expect(region.textContent).not.toMatch(/webgl/i);
    expect(region.textContent).not.toMatch(/\b[A-Z_]{4,}\b/);

    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem bản 2D' })).toBeInTheDocument();
  });

  it('không có quyền: công cụ sửa KHÔNG có mặt trong DOM, không phải chỉ bị disabled', () => {
    render(<Viewer3D {...scenarioPropsFor('forbidden')} />);

    expect(screen.queryByRole('button', { name: 'Sửa hình học đã chọn' })).toBeNull();
  });

  it('được sửa: công cụ sửa CÓ mặt và không bị disabled', () => {
    render(<Viewer3D {...scenarioPropsFor('success')} />);

    const editButton = screen.getByRole('button', { name: 'Sửa hình học đã chọn' });
    expect(editButton).toBeInTheDocument();
    expect(editButton).not.toBeDisabled();
  });
});

/* -------------------------------------------------------------------------- */
/* R-72: khả năng tiếp cận và tiếng Việt, trên cả bảy trạng thái.              */
/* -------------------------------------------------------------------------- */

describe('R-72 — expectAccessible và expectVietnamese', () => {
  it('bảy trạng thái đều qua expectAccessible', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<Viewer3D {...scenarioPropsFor(state)} />);

      expectAccessible(container);

      unmount();
    }
  });

  it('bảy trạng thái đều qua expectVietnamese', () => {
    for (const state of SEVEN_STATES) {
      const { container, unmount } = render(<Viewer3D {...scenarioPropsFor(state)} />);

      expectVietnamese(container);

      unmount();
    }
  });
});
