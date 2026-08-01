import type { Meta, StoryObj } from '@storybook/react';
import React, { useEffect } from 'react';
import { MeasurementLabel } from './MeasurementLabel';
import { useMeasurementLabel } from '../../hooks/useMeasurementLabel';

const meta: Meta<typeof MeasurementLabel> = {
  title: 'Canvas / MeasurementLabel',
  component: MeasurementLabel,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

function MeasurementLabelDemo({ autoCommit }: { autoCommit?: boolean }) {
  const { state, startPoint, currentPoint, midPoint, distanceFormatted, startMeasurement, updateMeasurement, commitMeasurement } =
    useMeasurementLabel();

  useEffect(() => {
    startMeasurement(100, 100);
    updateMeasurement(300, 200);
    if (autoCommit) commitMeasurement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 400 }}>
      <MeasurementLabel
        state={state}
        startPoint={startPoint}
        currentPoint={currentPoint}
        midPoint={midPoint}
        distanceFormatted={distanceFormatted}
      />
    </div>
  );
}

export const Measuring: StoryObj = {
  name: 'Đang đo',
  render: () => <MeasurementLabelDemo />,
};

export const Committed: StoryObj = {
  name: 'Đã xác nhận',
  render: () => <MeasurementLabelDemo autoCommit />,
};
