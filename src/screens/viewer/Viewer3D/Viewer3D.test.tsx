/**
 * Bài kiểm của `Viewer3D` — view thuần, chỉ từ props (R-60, R-70).
 *
 * Không dựng store, không gọi mạng: mọi kịch bản đi qua `scenarioPropsFor` của
 * file story (R-70, cùng dữ liệu mẫu giữa story và bài kiểm).
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { createSevenStateScenarios, SEVEN_STATES } from '@/lib/testing/sevenStateScenarios';

import { Viewer3D } from './Viewer3D';
import { scenarioPropsFor } from './Viewer3D.stories';
import {
  NO_MATCH_MESSAGE,
  OPEN_SEARCH_LABEL,
  SEARCH_INPUT_LABEL,
  SEARCH_LIST_LABEL,
} from './ObjectSearch';
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

  /* Ca này trước đây khẳng định "công cụ sửa CÓ mặt và không bị disabled". Nút ấy
     là một nút CHẾT — `onClick` rỗng, vì không có lệnh sửa hình học nào ở tầng
     logic để nối vào (R-69, R-73) — nên nó đã được gỡ, và khẳng định cũ đang nói
     về một thứ không còn tồn tại. Khẳng định được sửa cho khớp việc gỡ, không bỏ
     ca đi. Vai nào được sửa hình học vẫn là câu hỏi của VỎ: `ViewerShell` lọc
     danh sách công cụ theo vai rồi mới đưa xuống `ViewerToolRail`. */
  it('không trạng thái nào dựng lại nút sửa hình học đã gỡ', () => {
    for (const state of SEVEN_STATES) {
      const { unmount } = render(<Viewer3D {...scenarioPropsFor(state)} />);

      expect(
        screen.queryByRole('button', { name: 'Sửa hình học đã chọn' }),
        `trạng thái ${state} dựng lại nút chết`,
      ).toBeNull();

      unmount();
    }
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

/* -------------------------------------------------------------------------- */
/* [Q2] Ô tìm đối tượng — tìm được một phòng.                                   */
/* -------------------------------------------------------------------------- */

/** Props của trạng thái `success` với ô tìm nối vào ba hàm theo dõi được. */
function searchProps(overrides: { readonly isOpen: boolean }) {
  const base = scenarioPropsFor('success');
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const onSelectRoom = vi.fn();

  return {
    props: {
      ...base,
      search: { ...base.search, ...overrides, onOpen, onClose, onSelectRoom },
    },
    onOpen,
    onClose,
    onSelectRoom,
  };
}

describe('[Q2] ô tìm đối tượng', () => {
  it('có một chỗ NHÌN THẤY ĐƯỢC để mở, không chỉ có phím tắt', () => {
    const { props, onOpen } = searchProps({ isOpen: false });
    render(<Viewer3D {...props} />);

    const trigger = screen.getByRole('button', { name: OPEN_SEARCH_LABEL });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('chưa mở thì không có ô chữ nào — lớp nổi không đè lên khung nhìn', () => {
    const { props } = searchProps({ isOpen: false });
    render(<Viewer3D {...props} />);

    expect(screen.queryByRole('combobox', { name: SEARCH_INPUT_LABEL })).toBeNull();
    expect(screen.queryByRole('listbox', { name: SEARCH_LIST_LABEL })).toBeNull();
  });

  it('không có phòng nào thì ô tìm không được vẽ (trạng thái rỗng)', () => {
    render(<Viewer3D {...scenarioPropsFor('empty')} />);

    expect(screen.queryByRole('button', { name: OPEN_SEARCH_LABEL })).toBeNull();
  });

  it('mở ra là thấy ngay mọi phòng, không phải một danh sách trắng', () => {
    const { props } = searchProps({ isOpen: true });
    render(<Viewer3D {...props} />);

    expect(screen.getAllByRole('option')).toHaveLength(props.search.rooms.length);
  });

  it('gõ KHÔNG DẤU vẫn lọc ra đúng phòng, rồi bấm chuột chọn được nó', () => {
    const { props, onSelectRoom, onClose } = searchProps({ isOpen: true });
    render(<Viewer3D {...props} />);

    fireEvent.change(screen.getByRole('combobox', { name: SEARCH_INPUT_LABEL }), {
      target: { value: 'phong ngu 4' },
    });

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Phòng ngủ 4');

    fireEvent.click(options[0] as HTMLElement);

    expect(onSelectRoom).toHaveBeenCalledWith('R-011');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('A12: mũi tên đổi dòng, Enter chọn — không cần chuột', () => {
    const { props, onSelectRoom } = searchProps({ isOpen: true });
    render(<Viewer3D {...props} />);

    const input = screen.getByRole('combobox', { name: SEARCH_INPUT_LABEL });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelectRoom).toHaveBeenCalledWith(props.search.rooms[1]?.id);
  });

  it('A12: Esc đóng ô tìm', () => {
    const { props, onClose } = searchProps({ isOpen: true });
    render(<Viewer3D {...props} />);

    fireEvent.keyDown(screen.getByRole('combobox', { name: SEARCH_INPUT_LABEL }), {
      key: 'Escape',
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('không khớp gì thì nói ra bằng một câu, không để danh sách trắng (A11)', () => {
    const { props } = searchProps({ isOpen: true });
    render(<Viewer3D {...props} />);

    fireEvent.change(screen.getByRole('combobox', { name: SEARCH_INPUT_LABEL }), {
      target: { value: 'khong co phong nao ten nhu vay' },
    });

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText(NO_MATCH_MESSAGE)).toBeInTheDocument();
  });

  it('ô tìm đang mở vẫn qua expectAccessible và expectVietnamese (R-72)', () => {
    const { props } = searchProps({ isOpen: true });
    const { container } = render(<Viewer3D {...props} />);

    expectAccessible(container);
    expectVietnamese(container);
  });
});

/* -------------------------------------------------------------------------- */
/* [V5-R1] Không lớp nào đứng chắn trước canvas.                               */
/* -------------------------------------------------------------------------- */

describe('[V5-R1] cú bấm phải tới được canvas', () => {
  /**
   * Một hồi quy đã đo bằng trình duyệt thật, không phải một lo xa.
   *
   * Ở trạng thái `success` view vẽ một khối phủ kín khung nhìn chỉ để mang một
   * câu cho trình đọc màn hình. Khối ấy nằm SAU `<canvas>` trong DOM nên đứng
   * trên nó khi dò trúng đích, và bộ bắt tia gắn listener trên chính canvas —
   * nên mọi cú bấm rơi vào khối chữ và không đối tượng nào được chọn.
   * `document.elementFromPoint` giữa khung trả về đúng khối ấy trước khi có
   * `pointer-events-none`, và trả về canvas sau khi có.
   */
  it.each(['success', 'forbidden'] as const)(
    'không nhận chuột ở lớp chữ phủ khung nhìn — trạng thái %s',
    (state) => {
      const { container } = render(<Viewer3D {...scenarioPropsFor(state)} />);

      const overlays = Array.from(container.querySelectorAll('div')).filter((element) =>
        element.querySelector(':scope > .sr-only') !== null,
      );

      expect(overlays.length).toBeGreaterThan(0);

      for (const overlay of overlays) {
        expect(overlay.className).toContain('pointer-events-none');
      }
    },
  );
});
