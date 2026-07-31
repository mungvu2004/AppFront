import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThicknessField } from './ThicknessField';

describe('ThicknessField', () => {
  it('renders 4 options in radiogroup', () => {
    render(<ThicknessField />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '110' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '220' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '330' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Cột BTCT' })).toBeInTheDocument();
  });

  it('marks selected option as checked', () => {
    render(<ThicknessField value="220" />);
    expect(screen.getByRole('radio', { name: '220' })).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onChange when option clicked', () => {
    const onChange = vi.fn();
    render(<ThicknessField value="110" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: '330' }));
    expect(onChange).toHaveBeenCalledWith('330');
  });

  it('shows AI original caption', () => {
    render(<ThicknessField value="220" aiOriginalMm={215} />);
    expect(screen.getByText(/Giá trị AI gốc/)).toBeInTheDocument();
    expect(screen.getByText(/215 mm/)).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<ThicknessField value="110" error="Không khớp thiết kế" />);
    expect(screen.getByText('Không khớp thiết kế')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    const { container } = render(<ThicknessField isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('is disabled when readOnly', () => {
    render(<ThicknessField value="220" isReadOnly />);
    // All radio buttons should be disabled
    const radios = screen.getAllByRole('radio');
    radios.forEach((r) => expect(r).toBeDisabled());
  });
});
