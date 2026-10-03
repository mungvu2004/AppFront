import * as SliderPrimitive from '@radix-ui/react-slider';
import { type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
declare const sliderVariants: (props?: ({
    variant?: "default" | "temperature" | null | undefined;
} & import("class-variance-authority/types").ClassProp) | undefined) => string;
type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & VariantProps<typeof sliderVariants>;
declare function Slider({ variant, className, ...props }: SliderProps): React.JSX.Element;
export { Slider };
//# sourceMappingURL=slider.d.ts.map