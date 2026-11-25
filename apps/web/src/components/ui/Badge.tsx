import type { ReactNode } from 'react';

type BadgeTone = 'neutral' | 'online' | 'danger' | 'warn' | 'accent';

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-elevated border-border-default text-text-secondary',
  online: 'bg-online-bg border-online/30 text-online',
  danger: 'bg-danger-bg border-danger/30 text-danger',
  warn: 'bg-warn-bg border-warn/30 text-warn',
  accent: 'bg-accent-muted border-accent-border text-accent',
};

export function Badge({ tone = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
