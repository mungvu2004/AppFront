import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { SelectionHalo } from './SelectionHalo';
import { useSelectionHalo } from '../../hooks/useSelectionHalo';

const meta: Meta<typeof SelectionHalo> = {
  title: 'Canvas / SelectionHalo',
  component: SelectionHalo,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

function SelectionHaloSelectedDemo() {
  const { isVisible, variant, hasEntered, select } = useSelectionHalo();
  useEffect(() => { select(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <div
        className="absolute bg-bg-sunken border border-border-default"
        style={{ left: 80, top: 80, width: 200, height: 120 }}
      />
      <SelectionHalo x={80} y={80} width={200} height={120} isVisible={isVisible} variant={variant} hasEntered={hasEntered} />
      <div className="absolute bottom-2 left-2 font-mono text-xs text-text-muted">Variant: {variant}</div>
    </div>
  );
}

function SelectionHaloHoverDemo() {
  const { isVisible, variant, hasEntered, hover } = useSelectionHalo();
  useEffect(() => { hover(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <div
        className="absolute bg-bg-sunken border border-border-default"
        style={{ left: 80, top: 80, width: 200, height: 120 }}
      />
      <SelectionHalo x={80} y={80} width={200} height={120} isVisible={isVisible} variant={variant} hasEntered={hasEntered} />
      <div className="absolute bottom-2 left-2 font-mono text-xs text-text-muted">Variant: {variant}</div>
    </div>
  );
}


export const Selected: StoryObj = {
  name: 'Selected',
  render: () => <SelectionHaloSelectedDemo />,
};

export const Hover: StoryObj = {
  name: 'Hover',
  render: () => <SelectionHaloHoverDemo />,
};
