import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Select } from './Select';

const options = [
  { label: 'Tầng 1', value: 'f1' },
  { label: 'Tầng 2', value: 'f2' },
  { label: 'Tầng 3', value: 'f3' },
];

describe('Select', () => {
  it('renders trigger button', () => {
    render(<Select options={options} placeholder="Chọn..." />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows placeholder when no value', () => {
    render(<Select options={options} placeholder="Chọn tầng..." />);
    expect(screen.getByText('Chọn tầng...')).toBeInTheDocument();
  });

  it('shows selected label', () => {
    render(<Select options={options} value="f2" />);
    expect(screen.getByText('Tầng 2')).toBeInTheDocument();
  });

  it('opens listbox on click', () => {
    render(<Select options={options} />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('calls onChange when option selected', async () => {
    const onChange = vi.fn();
    render(<Select options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Tầng 3' }));
    expect(onChange).toHaveBeenCalledWith('f3');
  });

  it('is disabled when prop set', () => {
    render(<Select options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('renders loading skeleton', () => {
    const { container } = render(<Select options={options} isLoading />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Select options={options} />);
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  /** Đặt trigger ở `top..top+40` trong khung nhìn cao `window.innerHeight`. */
  function openAt(top: number) {
    render(<Select options={options} />);
    const trigger = screen.getByRole('combobox');
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(16, top, 320, 40),
    );
    fireEvent.click(trigger);
    return screen.getByRole('listbox');
  }

  it('opens downward, height clamped to the room below, when there is room (BUG-484)', () => {
    const list = openAt(100);
    expect(list.style.top).toBe('144px');
    expect(list.style.bottom).toBe('');
    expect(list.style.maxHeight).toBe('300px');
  });

  it('flips up above the trigger when the room below is too short (BUG-484)', () => {
    const list = openAt(window.innerHeight - 60);
    expect(list.style.top).toBe('');
    expect(list.style.bottom).toBe('64px');
    expect(list.style.maxHeight).toBe('300px');
  });
});
