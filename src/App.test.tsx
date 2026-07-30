import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App.tsx';

describe('App', () => {
  it('renders success message', () => {
    render(<App />);
    expect(screen.getByText('Khởi tạo thành công')).toBeInTheDocument();
  });
});
