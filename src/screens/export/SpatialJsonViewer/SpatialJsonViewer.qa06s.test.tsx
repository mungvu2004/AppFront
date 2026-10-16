/** QA-06 S data — [31-A-022] bấm "Sao chép nhánh" phải có phản hồi nhìn thấy (BUG-719), kể cả khi route không có Toast.Provider. */

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';

import { SpatialJsonViewer } from './SpatialJsonViewer';
import { useSpatialJsonViewer } from './useSpatialJsonViewer';

afterEach(cleanup);

const options = {
  canView: true,
  errorMessage: null,
  graph: createSampleBuilding(),
  isLoading: false,
  isNarrow: false,
  issues: [],
  onReopenFloors: () => undefined,
};

function Harness({ onCopy }: { readonly onCopy?: (text: string) => void }) {
  const [model, actions] = useSpatialJsonViewer({ ...options, ...(onCopy !== undefined ? { onCopy } : {}) });

  return <SpatialJsonViewer model={model} actions={actions} />;
}

describe('31-A-022 phản hồi sau khi chép nhánh', () => {
  it('[31-A-022] chép bằng clipboard: hiện thông báo role=status chứa "chép"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup({ delay: null }); // setup() thay navigator.clipboard, nên đặt mock sau nó

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<Harness />);
    expect(screen.queryAllByRole('status').some((node) => /chép/iu.test(node.textContent ?? ''))).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Sao chép nhánh đang chọn' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('status').some((node) => /chép/iu.test(node.textContent ?? ''))).toBe(true);
  });

  it('[31-A-022] cấp onCopy: vẫn gọi onCopy và hiện thông báo', async () => {
    const onCopy = vi.fn();

    render(<Harness onCopy={onCopy} />);
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Sao chép nhánh đang chọn' }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('status').some((node) => /chép/iu.test(node.textContent ?? ''))).toBe(true);
  });
});
