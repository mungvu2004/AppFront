import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FlowGate } from './FlowGate';
import { setFlowGateSlot, useFlowGateOwned } from './flowGateStore';

function Bar() {
  const owned = useFlowGateOwned();
  return (
    <nav>
      <div ref={setFlowGateSlot} />
      {owned ? null : <a href="#next">Tiếp: Mô hình 3D</a>}
    </nav>
  );
}

describe('FlowGate', () => {
  it('bay vào khe thanh bước và thay nút "Tiếp" mặc định', () => {
    const { rerender } = render(<Bar />);
    expect(screen.getByText('Tiếp: Mô hình 3D')).toBeInTheDocument();

    rerender(
      <>
        <Bar />
        <FlowGate conditions={[{ label: 'Tường', done: true }, { label: 'Cửa', done: false }]} done={2} total={81}>
          <button type="button">Duyệt tiếp</button>
        </FlowGate>
      </>,
    );
    expect(screen.queryByText('Tiếp: Mô hình 3D')).not.toBeInTheDocument();
    expect(screen.getByTestId('flow-gate')).toHaveTextContent('2/81');
    expect(screen.getByRole('button', { name: 'Duyệt tiếp' })).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '2');

    rerender(<Bar />);
    expect(screen.getByText('Tiếp: Mô hình 3D')).toBeInTheDocument();
  });
});
