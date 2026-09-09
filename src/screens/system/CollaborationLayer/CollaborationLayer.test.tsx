/**
 * Bộ kiểm của `CollaborationLayer` — lớp phủ cộng tác thời gian thực (S-11/D-09).
 *
 * Viết TRƯỚC KHI `CollaborationLayer.tsx` tồn tại: đối chiếu với hợp đồng kiểu ở
 * `./types.ts`, KHÔNG đối chiếu với bản dựng — bốn worker khác dựng view/hook/
 * gateway song song, không có trong worktree này. `import { CollaborationLayer }
 * from './CollaborationLayer'` do đó CHƯA chạy được ở đây; đó là dự kiến (xem
 * ghi chú khảo sát `notes-pattern.md`, `notes-ui.md`), không phải lỗi của bộ kiểm
 * này. Lớp gộp sẽ chạy bộ kiểm này khi cả bốn nhánh về cùng một nhánh.
 *
 * ## Giả định về DOM/aria mà bộ kiểm này đặt ra cho bản dựng
 *
 * `types.ts` chỉ khai hình dạng props, không khai cấu trúc DOM — nên để kiểm được
 * các bất biến "không có trong DOM" mà không đoán mò markup, bộ kiểm này đặt ra
 * (và ghi lại tường minh ở đây, để người dựng view sau đọc và khớp theo) một vài
 * quy ước tối thiểu, mỗi quy ước là hệ quả tự nhiên của chính hợp đồng:
 *
 * - Mỗi cộng tác viên KHÁC (`isSelf: false`) khi `presence` bật phải để lại dấu
 *   vết TEXT đọc được của `name` (nhãn tên đi kèm con trỏ, kiểu Figma) — không có
 *   nó thì không ai biết đang trỏ vào đâu là của ai.
 * - Mỗi ghim bình luận là một điều khiển có tên truy cập chứa từ "bình luận" (gọi
 *   `onFrameComment`) — bắt buộc bởi A12/A13, một nút không tên là nút mù.
 * - Ô nhập bình luận (khi `canWrite`) là một control `role="textbox"`.
 * - Nút "hoãn" xung đột có tên truy cập chứa từ "hoãn" (đúng chữ trong
 *   `types.ts:159`: "Panel xung đột hoãn lại được").
 *
 * Nếu bản dựng thật chọn từ khác, các khẳng định tương ứng cần sửa theo — đây là
 * hợp đồng thử nghiệm bổ sung, không phải bịa DOM ngoài hợp đồng.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import { SEVEN_STATES, createSevenStateScenarios } from '@/lib/testing/sevenStateScenarios';
import type { SevenStateRow, SevenStateScenario } from '@/lib/testing/sevenStateScenarios';

import { CollaborationLayer } from './CollaborationLayer';
import type {
  CollaborationLayerProps,
  CollaboratorVm,
  CommentPinVm,
  ConflictVm,
  LockVm,
} from './types';

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu.                                                                */
/* -------------------------------------------------------------------------- */

const SELF: CollaboratorVm = {
  id: 'u-self',
  name: 'Bạn',
  initials: 'B',
  floorLabel: 'đang ở tầng 1',
  selectionLabel: null,
  cursor: null,
  isSelf: true,
};

const MAI: CollaboratorVm = {
  id: 'u-mai',
  name: 'Trần Thị Mai',
  initials: 'TM',
  floorLabel: 'đang ở tầng 2',
  selectionLabel: 'đang chọn tường W-014',
  cursor: { x: 420, y: 260 },
  isSelf: false,
};

const LOCK_DOOR: LockVm = {
  objectId: 'D-004',
  holderName: 'Trần Thị Mai',
  heldSinceLabel: 'giữ từ 3 phút trước',
};

const COMMENT_OPEN: CommentPinVm = {
  id: 'c-1',
  objectId: 'W-014',
  at: { x: 420, y: 260 },
  isResolved: false,
  replyCount: 2,
};

const CONFLICT: ConflictVm = {
  entityId: 'W-014',
  entityType: 'wall',
  fieldLabel: 'độ dày',
  mine: { valueLabel: '110 mm', authorName: 'Bạn', atLabel: 'vừa xong' },
  theirs: { valueLabel: '220 mm', authorName: 'Trần Thị Mai', atLabel: '2 phút trước' },
};

/** Mọi trường không đổi giữa các bài kiểm, một chỗ (khuôn `EditorTour.test.tsx`). */
function baseProps(overrides: Partial<CollaborationLayerProps> = {}): CollaborationLayerProps {
  return {
    capabilities: { presence: true, comments: true, locks: true, requestAccess: true },
    syncState: 'da-noi',
    collaborators: [SELF, MAI],
    locks: [LOCK_DOOR],
    conflict: null,
    comments: [COMMENT_OPEN],
    isCollapsed: false,
    canWrite: true,
    onGoToCollaborator: noop,
    onRequestEditAccess: noop,
    onResolveConflict: noop,
    onDeferConflict: noop,
    onFrameComment: noop,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Ánh xạ bảy trạng thái → props (mục 6 của đặc tả — `SevenStateScenario` có     */
/* hình dạng riêng, không trùng `CollaborationLayerProps`).                    */
/* -------------------------------------------------------------------------- */

function collaboratorFromRow(row: SevenStateRow): CollaboratorVm {
  return {
    id: row.id,
    name: row.label,
    initials: row.label.slice(0, 2).toUpperCase(),
    floorLabel: 'đang ở tầng 1',
    selectionLabel: null,
    cursor: null,
    isSelf: false,
  };
}

/** Đúng bảng ánh xạ tài liệu ở `types.ts:56-61`. */
const SYNC_STATE_BY_SCENARIO: Record<SevenStateScenario['state'], CollaborationLayerProps['syncState']> = {
  empty: 'da-noi',
  loading: 'dang-noi',
  partial: 'dong-bo-cham',
  error: 'mat-ket-noi',
  success: 'da-noi',
  forbidden: 'da-noi',
  collapsed: 'da-noi',
};

function toProps(scenario: SevenStateScenario): CollaborationLayerProps {
  return baseProps({
    syncState: SYNC_STATE_BY_SCENARIO[scenario.state],
    collaborators: [SELF, ...scenario.rows.map(collaboratorFromRow)],
    isCollapsed: scenario.isCollapsed,
    canWrite: scenario.canView,
    conflict: null,
    comments: scenario.rows.length > 0 ? [COMMENT_OPEN] : [],
  });
}

/* -------------------------------------------------------------------------- */
/* (a) R-63 — bảy trạng thái.                                                  */
/* -------------------------------------------------------------------------- */

describe('R-63 — bảy trạng thái, đo trên cả màn', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', () => {
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return render(<CollaborationLayer {...toProps(scenario)} />);
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
      const { container } = render(<CollaborationLayer {...toProps(scenario)} />);

      expectAccessible(container, { ignoreSelector: '[role=dialog]' });
      expectVietnamese(container);
    },
  );

  it('không một mã màu thô nào trong cả thư mục màn', () => {
    expect(() => {
      expectNoRawColor('src/screens/system/CollaborationLayer');
    }).not.toThrow();
  });
});

/* -------------------------------------------------------------------------- */
/* (c) capabilities.comments === false — ghim và bóng rời khỏi DOM.            */
/* -------------------------------------------------------------------------- */

describe('capabilities.comments === false — ghim và bóng rời khỏi DOM', () => {
  it('ghim bình luận không còn trong DOM dù mảng comments vẫn mang dữ liệu', () => {
    render(
      <CollaborationLayer
        {...baseProps({
          capabilities: { presence: true, comments: false, locks: true, requestAccess: true },
          comments: [COMMENT_OPEN],
        })}
      />,
    );

    expect(screen.queryByText(/bình luận/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /bình luận/i })).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* (d) capabilities.presence === false — không con trỏ, không viền chọn khác.  */
/* -------------------------------------------------------------------------- */

describe('capabilities.presence === false — không con trỏ, không viền chọn người khác', () => {
  it('tên và lựa chọn của người khác không còn trong DOM dù collaborators vẫn mang dữ liệu', () => {
    render(
      <CollaborationLayer
        {...baseProps({
          capabilities: { presence: false, comments: true, locks: true, requestAccess: true },
          collaborators: [SELF, MAI],
        })}
      />,
    );

    expect(screen.queryByText(MAI.name)).toBeNull();
    expect(screen.queryByText(MAI.selectionLabel ?? '')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* (e) Panel xung đột — cả hai giá trị, cả hai tác giả, không phải hộp thoại.  */
/* -------------------------------------------------------------------------- */

describe('Panel xung đột — hiện cả hai giá trị và cả hai tác giả, không phải hộp thoại', () => {
  it('hiện đủ bốn mảnh: giá trị của tôi, tác giả của tôi, giá trị của họ, tác giả của họ', () => {
    const { container } = render(<CollaborationLayer {...baseProps({ conflict: CONFLICT })} />);

    expect(screen.getByText(CONFLICT.mine.valueLabel)).toBeInTheDocument();
    expect(screen.getByText(CONFLICT.mine.authorName)).toBeInTheDocument();
    expect(screen.getByText(CONFLICT.theirs.valueLabel)).toBeInTheDocument();
    expect(screen.getByText(CONFLICT.theirs.authorName)).toBeInTheDocument();

    // Cấm tuyệt đối: panel xung đột không bao giờ là hộp thoại (types.ts:159).
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('hoãn xung đột gọi onDeferConflict, KHÔNG gọi onResolveConflict', () => {
    const onResolveConflict = vi.fn();
    const onDeferConflict = vi.fn();

    render(
      <CollaborationLayer
        {...baseProps({ conflict: CONFLICT, onResolveConflict, onDeferConflict })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /hoãn/i }));

    expect(onDeferConflict).toHaveBeenCalledTimes(1);
    expect(onResolveConflict).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* (f) canWrite === false — ô nhập bình luận không có trong DOM.               */
/* -------------------------------------------------------------------------- */

describe('canWrite === false — ô nhập bình luận không có trong DOM', () => {
  it('không còn control nhập liệu nào khi canWrite=false (trạng thái 6: xem, không viết)', () => {
    render(<CollaborationLayer {...baseProps({ canWrite: false })} />);

    expect(screen.queryByRole('textbox')).toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* (g) isCollapsed === true — con trỏ người khác biến mất, ghim bình luận còn. */
/* -------------------------------------------------------------------------- */

describe('isCollapsed === true — con trỏ người khác biến mất, ghim bình luận còn lại', () => {
  it('tên người khác không còn trong DOM nhưng ghim bình luận vẫn còn (trạng thái 7)', () => {
    render(
      <CollaborationLayer
        {...baseProps({
          isCollapsed: true,
          collaborators: [SELF, MAI],
          comments: [COMMENT_OPEN],
        })}
      />,
    );

    expect(screen.queryByText(MAI.name)).toBeNull();
    expect(screen.getAllByRole('button', { name: /bình luận/i }).length).toBeGreaterThan(0);
  });
});
