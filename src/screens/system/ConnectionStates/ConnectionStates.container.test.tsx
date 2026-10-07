/**
 * `ConnectionStatesContainer` nối với hàng đợi thật (`lib/offline/queueStore`).
 *
 * NO-401: số "chờ đồng bộ" phải theo hàng đợi ngay khi hàng đợi đổi — ghi thêm
 * hay gỡ bớt một lệnh — không đợi tới lần mạng đổi trạng thái kế tiếp.
 */

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NetworkMonitor, NetworkMonitorStatus } from '@/lib/offline/networkMonitor';
import {
  addPendingCommand,
  deletePendingCommand,
  listPendingCommands,
  type PendingCommand,
  type QueueStoreError,
} from '@/lib/offline/queueStore';
import type { Result } from '@/lib/http';

import { ConnectionStatesContainer } from './ConnectionStates.container';
import { createConnectionStatesGateway } from './connectionStatesGateway';

vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ status: 'authenticated' }) }));

const PROJECT_ID = 'project-no-401';

const OFFLINE: NetworkMonitorStatus = { browserOnline: false, checkedAt: 0, online: false, pingOnline: false };

/** Mạng đứng yên ở "mất mạng" suốt bài: mọi lượt đọc lại hàng đợi phải đến từ chính hàng đợi. */
const offlineMonitor: NetworkMonitor = {
  checkNow: async () => OFFLINE,
  getStatus: () => OFFLINE,
  start: () => undefined,
  stop: () => undefined,
  subscribe: () => () => undefined,
};

async function clearQueue(): Promise<void> {
  const listed = await listPendingCommands(PROJECT_ID);

  for (const pending of listed.ok ? listed.data : []) {
    await deletePendingCommand(pending.id);
  }
}

function addCommand(label: string) {
  return addPendingCommand({ projectId: PROJECT_ID, command: { kind: 'renameRoom', label } });
}

/** jsdom không có `matchMedia`; `Drawer` hỏi nó — cùng bản `ConnectionStates.test.tsx` dựng. */
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
});

beforeEach(clearQueue);

afterEach(async () => {
  cleanup();
  await clearQueue();
});

describe('ConnectionStatesContainer — số "chờ đồng bộ" theo hàng đợi (NO-401)', () => {
  it('ghi thêm rồi gỡ bớt lệnh khi mạng không đổi: dải nói đúng số lệnh mới', async () => {
    await addCommand('Đổi tên phòng A');

    render(
      <ConnectionStatesContainer
        projectId={PROJECT_ID}
        gateway={createConnectionStatesGateway({ createMonitor: () => offlineMonitor })}
      />,
    );

    expect(await screen.findByText(/1 thay đổi/)).toBeInTheDocument();

    const second = await addCommand('Đổi tên phòng B');

    expect(await screen.findByText(/2 thay đổi/)).toBeInTheDocument();

    if (second.ok) {
      await deletePendingCommand(second.data.id);
    }

    expect(await screen.findByText(/1 thay đổi/)).toBeInTheDocument();
  });

  it('lượt đọc cũ về muộn hơn lượt đọc mới thì bị bỏ: dải nói theo lượt mới', async () => {
    type Read = Result<PendingCommand[], QueueStoreError>;
    const pendingOf = (count: number): Read => ({
      ok: true,
      data: Array.from({ length: count }, (_, index) => ({
        command: { kind: 'renameRoom', label: `Lệnh ${index + 1}` },
        createdAt: index,
        id: index + 1,
        isVolatile: true,
        projectId: PROJECT_ID,
        sizeBytes: 8,
      })),
    });
    const reads: ((result: Read) => void)[] = [];
    let queueChanged: () => void = () => undefined;

    render(
      <ConnectionStatesContainer
        projectId={PROJECT_ID}
        gateway={createConnectionStatesGateway({
          createMonitor: () => offlineMonitor,
          listPending: () =>
            new Promise<Read>((resolve) => {
              reads.push(resolve);
            }),
          watchPending: (listener) => {
            queueChanged = listener;
            return () => undefined;
          },
        })}
      />,
    );

    act(() => {
      queueChanged();
    });
    expect(reads).toHaveLength(2);

    await act(async () => {
      reads[1]?.(pendingOf(2));
    });
    expect(await screen.findByText(/2 thay đổi/)).toBeInTheDocument();

    await act(async () => {
      reads[0]?.(pendingOf(1));
    });
    expect(screen.getByText(/2 thay đổi/)).toBeInTheDocument();
    expect(screen.queryByText(/1 thay đổi/)).toBeNull();
  });
});
