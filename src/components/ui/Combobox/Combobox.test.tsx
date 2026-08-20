import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Combobox } from './Combobox';

const options = [
  { label: 'Tường gạch 110mm', value: 'brick-110' },
  { label: 'Tường gạch 220mm', value: 'brick-220' },
  { label: 'Tường BTCT', value: 'concrete' },
];

describe('Combobox', () => {
  it('renders trigger button', () => {
    render(<Combobox options={options} placeholder="Chọn..." />);
    // Trigger is a button with aria-haspopup
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows placeholder when no value', () => {
    render(<Combobox options={options} placeholder="Chọn loại..." />);
    expect(screen.getByText('Chọn loại...')).toBeInTheDocument();
  });

  it('shows selected label', () => {
    render(<Combobox options={options} value="brick-220" />);
    expect(screen.getByText('Tường gạch 220mm')).toBeInTheDocument();
  });

  it('opens search dropdown on click', () => {
    render(<Combobox options={options} />);
    fireEvent.click(screen.getByRole('button'));
    // After open, listbox or options should appear
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('filters options by query', () => {
    render(<Combobox options={options} />);
    fireEvent.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Tìm kiếm...');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: '220' } });
      expect(screen.getByRole('option', { name: 'Tường gạch 220mm' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Tường gạch 110mm' })).not.toBeInTheDocument();
    }
  });

  it('shows empty message when no results', () => {
    render(<Combobox options={options} />);
    fireEvent.click(screen.getByRole('button'));
    const searchInput = screen.getByPlaceholderText('Tìm kiếm...');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'xyz không tồn tại' } });
      expect(screen.getByText(/Không tìm thấy/)).toBeInTheDocument();
    }
  });

  it('is disabled when prop set', () => {
    render(<Combobox options={options} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<Combobox options={options} isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
