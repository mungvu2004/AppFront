import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TableActionBar } from './TableActionBar';

describe('TableActionBar', () => {
  it('không hiển thị khi selectedCount = 0', () => {
    const { container } = render(
      <div className="relative">
        <TableActionBar selectedCount={0} entityName="tường" />
      </div>
    );
    expect(container.querySelector('[role="toolbar"]')).not.toBeInTheDocument();
  });

  it('hiển thị khi selectedCount > 0', () => {
    render(
      <div className="relative">
        <TableActionBar selectedCount={3} entityName="tường" />
      </div>
    );
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('hiển thị số đúng và tên entity', () => {
    render(
      <div className="relative">
        <TableActionBar selectedCount={12} entityName="tường" />
      </div>
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/tường/)).toBeInTheDocument();
  });

  it('gọi onApprove khi nhấn Duyệt', () => {
    const onApprove = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onApprove={onApprove} />
      </div>
    );
    fireEvent.click(screen.getAllByText('Duyệt')[0]!);
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('gọi onReject khi nhấn Từ chối', () => {
    const onReject = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onReject={onReject} />
      </div>
    );
    fireEvent.click(screen.getAllByText('Từ chối')[0]!);
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('gọi onDeselect khi nhấn Bỏ chọn', () => {
    const onDeselect = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onDeselect={onDeselect} />
      </div>
    );
    fireEvent.click(screen.getAllByText('Bỏ chọn')[0]!);
    expect(onDeselect).toHaveBeenCalledOnce();
  });

  it('gọi onDeselect khi nhấn Escape', () => {
    const onDeselect = vi.fn();
    render(
      <div className="relative">
        <TableActionBar selectedCount={3} onDeselect={onDeselect} />
      </div>
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDeselect).toHaveBeenCalledOnce();
  });

  it('hiển thị nút Đổi độ dày khi có onChangeThickness', () => {
    render(
      <div className="relative">
        <TableActionBar selectedCount={1} onChangeThickness={() => {}} />
      </div>
    );
    expect(screen.getAllByText('Đổi độ dày')[0]).toBeInTheDocument();
  });
});
