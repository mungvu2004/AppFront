import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Radio, RadioGroup } from './Radio';

describe('Radio', () => {
  it('renders radio inputs in group', () => {
    render(
      <RadioGroup value="a" onChange={() => {}}>
        <Radio.Item value="a" label="Lựa chọn A" />
        <Radio.Item value="b" label="Lựa chọn B" />
      </RadioGroup>
    );
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('marks correct item as checked', () => {
    render(
      <RadioGroup value="b" onChange={() => {}}>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </RadioGroup>
    );
    expect(screen.getByRole('radio', { name: 'B' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A' })).not.toBeChecked();
  });

  it('calls onChange when radio clicked', () => {
    const onChange = vi.fn();
    render(
      <RadioGroup value="a" onChange={onChange}>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </RadioGroup>
    );
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('disables all items when group is disabled', () => {
    render(
      <RadioGroup value="a" onChange={() => {}} disabled>
        <Radio.Item value="a" label="A" />
        <Radio.Item value="b" label="B" />
      </RadioGroup>
    );
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
  });

  it('renders description', () => {
    render(
      <RadioGroup value="a" onChange={() => {}}>
        <Radio.Item value="a" label="Tường mỏng" description="110 mm nội thất" />
      </RadioGroup>
    );
    expect(screen.getByText('110 mm nội thất')).toBeInTheDocument();
  });

  it('has group role=radiogroup', () => {
    render(
      <RadioGroup value="a" onChange={() => {}}>
        <Radio.Item value="a" label="A" />
      </RadioGroup>
    );
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });
});
