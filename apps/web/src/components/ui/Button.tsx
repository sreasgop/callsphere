import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-solid';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-cta hover:bg-cta-hover text-cta-text font-semibold',
  secondary:
    'bg-elevated hover:bg-hover border border-border-default text-text-primary font-medium',
  ghost:
    'bg-transparent text-text-secondary hover:bg-hover hover:text-text-primary font-medium',
  danger:
    'bg-danger-bg border border-danger/30 text-danger hover:bg-danger/20 font-medium',
  'danger-solid': 'bg-danger hover:bg-danger/90 text-white font-semibold',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-6 text-sm',
  icon: 'size-10 p-0',
};

export function Button({
  variant = 'primary',
  size = 'md',
  pill = false,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const radius = pill ? 'rounded-full' : 'rounded-md';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${radius} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
