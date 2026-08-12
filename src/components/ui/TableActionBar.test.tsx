import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TableActionBar } from './TableActionBar';

describe('TableActionBar', () => {
  it('does not render when selectedCount is 0', () => {
    const { container } = render(
      <div className="relative">
        <TableActionBar selectedCount={0} entityName="tường" />
      </div>
    );
    expect(container.querySelector('[role="toolbar"]')).not.toBeInTheDocument();
  });

  it('renders when selectedCount is greater than 0', () => {
    render(
      <div className="relative">
        <TableActionBar selectedCount={3} entityName="tường" />
      </div>
    );
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('renders the expected count and entity name', () => {
    render(
      <div className="relative">
        <TableActionBar selectedCount={12} entityName="tường" />
      </div>
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/tường/)).toBeInTheDocument();
  });

  it('calls onApprove when the approve button is pressed', () => {
    const onApprove = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onApprove={onApprove} />
      </div>
    );
    fireEvent.click(screen.getAllByText('Duyệt')[0]!);
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('calls onReject when the reject button is pressed', () => {
    const onReject = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onReject={onReject} />
      </div>
    );
    fireEvent.click(screen.getAllByText('Từ chối')[0]!);
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('calls onDeselect when the deselect button is pressed', () => {
    const onDeselect = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onDeselect={onDeselect} />
      </div>
    );
    fireEvent.click(screen.getAllByText('Bỏ chọn')[0]!);
    expect(onDeselect).toHaveBeenCalledOnce();
  });

  it('calls onDeselect when Escape is pressed', () => {
    const onDeselect = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={3} onDeselect={onDeselect} />
      </div>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDeselect).toHaveBeenCalledOnce();
  });

  it('renders the change thickness button when onChangeThickness is provided', () => {
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onChangeThickness={() => {}} />
      </div>
    );
    expect(screen.getAllByText('Đổi độ dày')[0]).toBeInTheDocument();
  });
});
