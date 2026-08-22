'use client';

import { cn } from '@nexus/utils';
import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-6' };

export const Card = ({ children, className, hover = false, padding = 'md', ...props }: CardProps) => (
  <div
    className={cn(
      'rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
      hover && 'transition-shadow hover:shadow-md cursor-pointer',
      paddingClasses[padding],
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('pb-3 border-b border-gray-100 dark:border-gray-800', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-semibold text-gray-900 dark:text-gray-100', className)} {...props}>
    {children}
  </h3>
);

export const CardContent = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('pt-3', className)} {...props}>{children}</div>
);

export const CardFooter = ({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2', className)} {...props}>
    {children}
  </div>
);
