import type * as React from 'react';
/** The glyph to print for a shortcut key on the current platform. */
declare function shortcutDisplayValue(value: string): string;
type ShortcutTokenProps = React.ComponentProps<'kbd'> & {
    value: string;
    displayValue?: string;
};
declare function ShortcutToken({ className, displayValue, value, ...props }: ShortcutTokenProps): React.JSX.Element;
export { ShortcutToken, shortcutDisplayValue };
//# sourceMappingURL=shortcut-token.d.ts.map