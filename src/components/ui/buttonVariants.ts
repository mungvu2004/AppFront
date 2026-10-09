import { cn } from '../../lib/utils';

export const buttonBaseStyles =
  'group relative inline-flex items-center justify-center rounded-lg font-medium outline-none transition-all duration-120 active:scale-[0.985] motion-reduce:transition-colors motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring aria-disabled:opacity-40 aria-disabled:cursor-not-allowed';

export const buttonVariants = {
  primary: 'bg-accent text-bg-surface border-transparent hover:bg-accent-hover active:bg-accent-active',
  secondary: 'bg-bg-surface text-text-primary border border-border-default hover:bg-bg-hover',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  danger: 'bg-danger-tint text-state-violation-text border border-danger-border',
};

export const buttonSizes = {
  sm: 'h-8 min-h-8 text-sm px-3',
  // 44 px under `sm` (640 px), like lg (BUG-048): md is the default size, so it is what dialog
  // footers, form submits and empty-state calls to action use on a phone. Toolbars and table
  // rows ask for `sm` and keep 32 px; icon-only buttons use `buttonIconOnlySizes`.
  md: 'h-11 min-h-11 sm:h-9 sm:min-h-9 text-sm px-4',
  // 44 px under `sm` (640 px): the touch-target size for phones (BUG-048).
  lg: 'h-11 min-h-11 sm:h-10 sm:min-h-10 text-base px-5',
};

export const buttonIconOnlySizes = {
  sm: 'h-8 w-8 px-0',
  md: 'h-9 w-9 px-0',
  lg: 'h-10 w-10 px-0',
};

export type ButtonVariant = keyof typeof buttonVariants;
export type ButtonSize = keyof typeof buttonSizes;

export interface GetButtonStylesProps {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  iconOnly?: boolean | undefined;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export function getButtonStyles({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  disabled = false,
  className,
}: GetButtonStylesProps) {
  return cn(
    buttonBaseStyles,
    buttonVariants[variant],
    iconOnly ? buttonIconOnlySizes[size] : buttonSizes[size],
    disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
    className
  );
}
