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

  it('shows what was just typed after the commit, not a count from the old value (BUG-198)', () => {
    // The count-up ran from 3,5 to the user's own "2", so a Tab straight back swapped "2,6" for "2" and lost the
    // keyboard select-all: "10" typed next became "210" (run-17, real keys).
    const props = { min: 2, max: 10, unit: 'm', 'aria-label': 'Chiều cao' } as const;
    let committed: number | undefined;
    const { rerender } = render(<NumericField {...props} value={3.5} onChange={(v) => (committed = v)} />);
    const field = screen.getByRole('textbox', { name: 'Chiều cao' });

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '2' } });
    fireEvent.blur(field);
    rerender(<NumericField {...props} value={committed} onChange={(v) => (committed = v)} />);

    expect(committed).toBe(2);
    expect(field).toHaveValue('2');
  });

  it('drops a refused text when resetKey changes, even if the value does not (review-1 #21)', () => {
    const props = { value: 3, min: 2, max: 10, unit: 'm', 'aria-label': 'Chiều cao', onChange: () => undefined } as const;
    const { rerender } = render(<NumericField {...props} resetKey={0} />);
    const field = screen.getByRole('textbox', { name: 'Chiều cao' });

    fireEvent.focus(field);
    fireEvent.change(field, { target: { value: '12' } });
    fireEvent.blur(field);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    rerender(<NumericField {...props} resetKey={1} />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(field).toHaveValue('3');
    // Same element: the caller no longer remounts the field to clear it.
    expect(screen.getByRole('textbox', { name: 'Chiều cao' })).toBe(field);
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
