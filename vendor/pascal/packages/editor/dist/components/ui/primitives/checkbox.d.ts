import type { ButtonHTMLAttributes } from 'react';
interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
}
export declare function Checkbox({ checked, onCheckedChange, className, ...props }: CheckboxProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=checkbox.d.ts.map