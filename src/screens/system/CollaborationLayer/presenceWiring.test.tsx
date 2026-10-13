/**
 * #43 (F-15) — hiện diện trên canvas Pascal, đo qua ĐÚNG đường mà
 * `PascalViewer.container.tsx` gắn: `<CollaborationLayerContainer scene=… />`
 * làm lớp phủ cùng ô canvas, cổng mặc định, hook thật.
 *
 * Hôm nay không có nguồn con trỏ người khác: `src/api/endpoints.ts` không có
 * nhóm hiện diện, không `PresenceSchema`, `src/lib/realtime` chỉ có kênh thông
 * báo/tiến trình, và máy chủ không có API hiện diện. Nên cổng giữ
 * `presence: false` và lớp phủ chỉ hiện DANH SÁCH HIỆN DIỆN (chính bạn) — không
 * một con trỏ nào được chiếu qua camera Pascal, vì không có toạ độ nào để chiếu.
 * Khi cổng có dữ liệu, `CollaboratorVm.cursor` (hệ toạ độ canvas) đi thẳng vào
 * `PresenceOverlay`; bài dưới khoá cả hai chiều để ngày bật cờ không vỡ âm thầm.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SessionSnapshot } from '@/lib/auth/types';

import { CollaborationLayer } from './CollaborationLayer';
import { CollaborationLayerContainer } from './CollaborationLayer.container';
import { COLLABORATION_CAPABILITIES } from './collaborationGateway';
import type { CollaborationLayerProps, CollaboratorVm } from './types';

const SESSION: SessionSnapshot = {
  status: 'authenticated',
  user: { id: 'user-toi', name: 'Vũ Mừng' },
  roles: [],
} as unknown as SessionSnapshot;

const noop = (): void => undefined;

const SELF: CollaboratorVm = {
  id: 'user-toi',
  name: 'Vũ Mừng',
  initials: 'VM',
  floorLabel: 'đang ở tầng 1',
  selectionLabel: null,
  cursor: null,
  isSelf: true,
};

const AN: CollaboratorVm = {
  id: 'user-an',
  name: 'Nguyễn Văn An',
  initials: 'NA',
  floorLabel: 'đang ở tầng 1',
  selectionLabel: null,
  cursor: { x: 120, y: 80 },
  isSelf: false,
};

function viewProps(overrides: Partial<CollaborationLayerProps>): CollaborationLayerProps {
  return {
    capabilities: { presence: true, comments: false, locks: false, requestAccess: false },
    syncState: 'da-noi',
    collaborators: [SELF, AN],
    locks: [],
    conflict: null,
    comments: [],
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

describe('#43 — hiện diện trên canvas Pascal', () => {
  it('cổng hôm nay không có nguồn hiện diện: presence tắt', () => {
    expect(COLLABORATION_CAPABILITIES.presence).toBe(false);
  });

  it('container gắn như PascalViewer chỉ hiện chính bạn, không con trỏ nào', async () => {
    render(
      <CollaborationLayerContainer
        scene={null}
        readSession={() => SESSION}
        subscribeSession={() => noop}
      />,
    );

    expect(await screen.findByLabelText('Vũ Mừng')).not.toBeNull();
    expect(screen.queryByText(AN.name)).toBeNull();
  });

  it('có toạ độ con trỏ thì vẽ tên người khác tại đúng toạ độ canvas', () => {
    render(<CollaborationLayer {...viewProps({})} />);

    const label = screen.getByText(AN.name);
    const cursor = label.closest('[style*="translate"]') as HTMLElement | null;
    expect(cursor?.style.transform).toContain('120');
    expect(cursor?.style.transform).toContain('80');
  });

  it('người khác không có toạ độ thì không có con trỏ trên canvas', () => {
    render(<CollaborationLayer {...viewProps({ collaborators: [SELF, { ...AN, cursor: null }] })} />);

    expect(document.querySelector('[style*="translate"]')).toBeNull();
  });
});
