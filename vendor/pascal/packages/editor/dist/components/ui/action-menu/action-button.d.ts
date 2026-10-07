import * as React from 'react';
import { Button } from './../../../components/ui/primitives/button';
interface ActionButtonProps extends React.ComponentProps<typeof Button> {
    label: string;
    shortcut?: string;
    isActive?: boolean;
    tooltipContent?: React.ReactNode;
    tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
}
export declare const ActionButton: React.ForwardRefExoticComponent<Omit<ActionButtonProps, "ref"> & React.RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=action-button.d.ts.map