import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MiniMap } from './MiniMap';

describe('MiniMap', () => {
  it('jumps the viewport to the centre when Enter is pressed while focused', () => {
    const onViewportChange = vi.fn();
    render(
      <MiniMap
        initialViewport={{ x: 0, y: 0, width: 40, height: 30 }}
        onViewportChange={onViewportChange}
      />
    );

    const map = screen.getByRole('button', { name: 'Bấm để di chuyển vùng nhìn' });
    fireEvent.keyDown(map, { key: 'Enter' });

    // Tâm bản đồ là (50, 50); top-left của khung nhìn 40x30 phải dịch tới (30, 35).
    expect(onViewportChange).toHaveBeenCalledOnce();
    expect(onViewportChange).toHaveBeenCalledWith({ x: 30, y: 35, width: 40, height: 30 });
  });

  it('jumps the viewport to the centre when Space is pressed while focused', () => {
    const onViewportChange = vi.fn();
    render(
      <MiniMap
        initialViewport={{ x: 0, y: 0, width: 40, height: 30 }}
        onViewportChange={onViewportChange}
      />
    );

    const map = screen.getByRole('button', { name: 'Bấm để di chuyển vùng nhìn' });
    fireEvent.keyDown(map, { key: ' ' });

    expect(onViewportChange).toHaveBeenCalledOnce();
    expect(onViewportChange).toHaveBeenCalledWith({ x: 30, y: 35, width: 40, height: 30 });
  });

  it('does not jump on unrelated keys', () => {
    const onViewportChange = vi.fn();
    render(
      <MiniMap
        initialViewport={{ x: 0, y: 0, width: 40, height: 30 }}
        onViewportChange={onViewportChange}
      />
    );

    const map = screen.getByRole('button', { name: 'Bấm để di chuyển vùng nhìn' });
    fireEvent.keyDown(map, { key: 'Tab' });

    expect(onViewportChange).not.toHaveBeenCalled();
  });
});
