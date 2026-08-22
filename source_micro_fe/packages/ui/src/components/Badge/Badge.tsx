'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@nexus/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        danger: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        info: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      },
      size: {
        sm: 'px-2 py-0.5 text-[10px]',
        md: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export const Badge = ({ variant, size, children, className, dot }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant, size }), className)}>
    {dot && (
      <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', {
        'bg-gray-500': variant === 'default',
        'bg-blue-500': variant === 'primary',
        'bg-emerald-500': variant === 'success',
        'bg-amber-500': variant === 'warning',
        'bg-red-500': variant === 'danger',
        'bg-cyan-500': variant === 'info',
      })} />
    )}
    {children}
  </span>
);
