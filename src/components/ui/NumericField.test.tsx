import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NumericField } from './NumericField';

describe('NumericField', () => {
  it('renders input with value', () => {
    render(<NumericField value={220} unit="mm" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('displays unit suffix', () => {
    render(<NumericField value={220} unit="mm" />);
    expect(screen.getByText('mm')).toBeInTheDocument();
  });

  it('displays m² unit', () => {
    render(<NumericField value={248.6} unit="m²" />);
    expect(screen.getByText('m²')).toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<NumericField value={0} unit="mm" isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('is disabled when prop set', () => {
    render(<NumericField value={220} unit="mm" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('shows error', () => {
    render(<NumericField value={-1} unit="mm" error="Giá trị âm không hợp lệ" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị âm không hợp lệ');
  });
});
