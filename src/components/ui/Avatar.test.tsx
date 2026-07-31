import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Avatar, AvatarStack } from './Avatar';

describe('Avatar.Root', () => {
  it('renders initials (max 2 chars)', () => {
    render(<Avatar initials="Nguyễn An" />);
    // Should show only "Ng" (first 2 chars)
    expect(screen.getByText('Ng')).toBeInTheDocument();
  });

  it('renders exactly 2 initials characters', () => {
    render(<Avatar initials="AB" />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders image when src provided', () => {
    render(<Avatar src="https://example.com/a.png" alt="User" />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/a.png');
  });

  it('applies presence ring when presence=true', () => {
    const { container } = render(<Avatar initials="An" presence />);
    const inner = container.querySelector('.ring-accent');
    expect(inner).toBeInTheDocument();
  });

  it('has correct default size class (w-7 h-7 = 28px)', () => {
    const { container } = render(<Avatar initials="An" />);
    expect(container.firstChild).toHaveClass('w-7');
    expect(container.firstChild).toHaveClass('h-7');
  });

  it('has profile size class when size="profile"', () => {
    const { container } = render(<Avatar initials="An" size="profile" />);
    expect(container.firstChild).toHaveClass('w-16');
    expect(container.firstChild).toHaveClass('h-16');
  });
});

describe('Avatar.Stack', () => {
  const avatars = [
    { initials: 'An' },
    { initials: 'Bk' },
    { initials: 'Cv' },
    { initials: 'Dt' },
    { initials: 'Em' },
  ];

  it('renders max 3 avatars by default', () => {
    render(<AvatarStack avatars={avatars} max={3} />);
    // 3 visible + 1 overflow chip
    expect(screen.getAllByText(/^[A-Za-z]{2}$/)).toHaveLength(3);
  });

  it('renders overflow "+2" chip when avatars.length > max', () => {
    render(<AvatarStack avatars={avatars} max={3} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('does not render overflow chip when avatars.length <= max', () => {
    render(<AvatarStack avatars={avatars.slice(0, 3)} max={3} />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('has group role', () => {
    render(<AvatarStack avatars={avatars} />);
    expect(screen.getByRole('group')).toBeInTheDocument();
  });
});
