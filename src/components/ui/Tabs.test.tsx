import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'walls', label: 'Tường', content: <div>Nội dung tường</div> },
  { id: 'objects', label: 'Đối tượng', content: <div>Nội dung đối tượng</div> },
  { id: 'dims', label: 'Kích thước', content: <div>Nội dung kích thước</div> },
];

describe('Tabs', () => {
  it('renders tab buttons', () => {
    render(<Tabs tabs={tabs} activeId="walls" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Tường' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Đối tượng' })).toBeInTheDocument();
  });

  it('marks correct tab as selected', () => {
    render(<Tabs tabs={tabs} activeId="objects" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Đối tượng' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tường' })).toHaveAttribute('aria-selected', 'false');
  });

  it('shows active panel content', () => {
    render(<Tabs tabs={tabs} activeId="walls" onChange={() => {}} />);
    expect(screen.getByText('Nội dung tường')).toBeInTheDocument();
  });

  it('calls onChange when tab clicked', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeId="walls" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Đối tượng' }));
    expect(onChange).toHaveBeenCalledWith('objects');
  });

  it('navigates with ArrowRight key', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeId="walls" onChange={onChange} />);
    const tab = screen.getByRole('tab', { name: 'Tường' });
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('objects');
  });

  it('navigates with ArrowLeft key', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} activeId="objects" onChange={onChange} />);
    const tab = screen.getByRole('tab', { name: 'Đối tượng' });
    fireEvent.keyDown(tab, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('walls');
  });

  it('renders badge on tab', () => {
    const tabsWithBadge = [
      { id: 'walls', label: 'Tường', badge: 48, content: <div /> },
    ];
    render(<Tabs tabs={tabsWithBadge} activeId="walls" onChange={() => {}} />);
    expect(screen.getByText('48')).toBeInTheDocument();
  });

  it('returns null for empty tabs', () => {
    const { container } = render(<Tabs tabs={[]} activeId="" onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('has tablist role', () => {
    render(<Tabs tabs={tabs} activeId="walls" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});
