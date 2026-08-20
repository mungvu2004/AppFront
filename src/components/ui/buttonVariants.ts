import { cn } from '../../lib/utils';

export const buttonBaseStyles =
  'group relative inline-flex items-center justify-center rounded-lg font-medium outline-none transition-all duration-120 active:scale-[0.985] motion-reduce:transition-colors motion-reduce:active:scale-100 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface focus-visible:animate-focus-ring';

export const buttonVariants = {
  primary: 'bg-accent text-bg-surface border-transparent hover:bg-accent-hover active:bg-accent-active',
  secondary: 'bg-bg-surface text-text-primary border border-border-default hover:bg-bg-hover',
  ghost: 'bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary',
  danger: 'bg-danger-tint text-state-violation-text border border-danger-border',
};

export const buttonSizes = {
  sm: 'h-8 min-h-8 text-sm px-3',
  md: 'h-9 min-h-9 text-sm px-4',
  lg: 'h-10 min-h-10 text-base px-5',
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
