import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TreeItem } from './TreeItem';

describe('TreeItem', () => {
  it('renders label', () => {
    render(<TreeItem label="Tầng 1" />);
    expect(screen.getByText('Tầng 1')).toBeInTheDocument();
  });

  it('renders count when provided', () => {
    render(<TreeItem label="Tường" count={21} />);
    expect(screen.getByText('21')).toBeInTheDocument();
  });

  it('applies selected class when selected=true', () => {
    render(<TreeItem label="Item" selected />);
    const item = screen.getByRole('treeitem');
    expect(item.className).toMatch(/bg-bg-selected/);
    expect(item).toHaveAttribute('aria-selected', 'true');
  });

  it('calls onClick when Enter key is pressed', () => {
    const onClick = vi.fn();
    render(<TreeItem label="Item" onClick={onClick} />);
    const item = screen.getByRole('treeitem');
    fireEvent.keyDown(item, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onClick when Space key is pressed', () => {
    const onClick = vi.fn();
    render(<TreeItem label="Item" onClick={onClick} />);
    const item = screen.getByRole('treeitem');
    fireEvent.keyDown(item, { key: ' ' });
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('calls onToggleExpand when expand button is clicked', () => {
    const onToggle = vi.fn();
    render(<TreeItem label="Item" hasChildren onToggleExpand={onToggle} />);
    const expandBtn = screen.getByLabelText('Mở rộng');
    fireEvent.click(expandBtn);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('shows Eye icon when visible=true', () => {
    render(<TreeItem label="Layer" visible onToggleVisible={() => {}} />);
    expect(screen.getByLabelText('Ẩn layer')).toBeInTheDocument();
  });

  it('shows EyeOff icon when visible=false', () => {
    render(<TreeItem label="Layer" visible={false} onToggleVisible={() => {}} />);
    expect(screen.getByLabelText('Hiện layer')).toBeInTheDocument();
  });

  it('indents by level', () => {
    render(<TreeItem label="Item" level={2} />);
    const item = screen.getByRole('treeitem');
    // paddingLeft = (2 * 16) + 8 = 40px
    expect(item).toHaveStyle({ paddingLeft: '40px' });
  });

  it('expand chevron rotates 90° when expanded', () => {
    render(<TreeItem label="Parent" hasChildren expanded />);
    const expandBtn = screen.getByLabelText('Thu gọn');
    const chevron = expandBtn.querySelector('svg');
    expect(chevron).toHaveClass('rotate-90');
  });

  it('has focus ring', () => {
    render(<TreeItem label="Item" />);
    const item = screen.getByRole('treeitem');
    expect(item.className).toMatch(/focus-visible:ring-2/);
  });
});
