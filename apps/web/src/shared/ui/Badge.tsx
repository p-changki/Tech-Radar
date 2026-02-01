import { memo, type ReactNode } from 'react';

type BadgeVariant = 'default' | 'muted' | 'danger' | 'warning' | 'success' | 'info';

type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

const variantClass: Record<BadgeVariant, string> = {
  default: '',
  muted: 'badge-inactive',
  danger: 'badge-danger',
  warning: 'badge-warning',
  success: 'badge-active',
  info: 'badge-source'
};

function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={['badge', variantClass[variant], className].filter(Boolean).join(' ')}>
      {children}
    </span>
  );
}

export default memo(Badge);
