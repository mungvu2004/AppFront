import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NumericField } from './NumericField';
import { expectAccessible } from '../../lib/testing/expectAccessible';
import { expectSentenceCase } from '../../lib/testing/expectSentenceCase';
import { renderWithProviders } from '../../lib/testing/render';

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

  it('refuses out of range in a sentence with the unit, and keeps the refused text in view (BUG-160)', () => {
    render(<NumericField value={3} min={2} max={10} unit="m" aria-label="Chiều cao" onChange={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'Chiều cao' });

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '10,5' } });
    fireEvent.blur(field);

    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị không quá 10 m.');
    expect(field).toHaveValue('10,5');

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '1,5' } });
    fireEvent.blur(field);
    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị không nhỏ hơn 2 m.');
  });

  it('keeps the refused text, not the stored value, when the field is focused again (BUG-198)', () => {
    render(<NumericField value={3} min={2} max={10} unit="m" aria-label="Chiều cao" onChange={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'Chiều cao' });

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.blur(field);
    fireEvent.focus(field);

    // The value and its refusal stay together: never "3" beside "Giá trị không quá 10 m.".
    expect(field).toHaveValue('12');
    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị không quá 10 m.');
  });

  it("shows its own refusal over the caller's error", () => {
    render(<NumericField value={3} min={2} unit="mm" aria-label="Chiều dài" error="Lỗi của hàng" onChange={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'Chiều dài' });

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '1' } });
    fireEvent.blur(field);

    expect(screen.getByRole('alert')).toHaveTextContent('Giá trị không nhỏ hơn 2 mm.');
  });

  it('passes expectAccessible on a bare field', () => {
    expectAccessible(
      renderWithProviders(<NumericField value={220} unit="mm" aria-label="Chiều dài" />),
    );
  });

  it('has no pointer-only stepper over the value; the arrow keys step it (BUG-158, BUG-163)', () => {
    const { container } = render(<NumericField value={220} unit="mm" aria-label="Chiều dài" onChange={() => undefined} />);
    const field = screen.getByRole('textbox', { name: 'Chiều dài' });

    expect(screen.queryByRole('button', { hidden: true })).not.toBeInTheDocument();
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'ArrowUp' });
    expect(field).toHaveValue('221');
    expectSentenceCase(container);
  });
});
