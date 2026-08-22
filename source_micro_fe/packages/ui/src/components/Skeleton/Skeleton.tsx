'use client';

import { cn } from '@nexus/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const skeletonVariants = cva('animate-pulse rounded-md bg-gray-200 dark:bg-gray-700', {
  variants: {
    variant: {
      text: 'h-4 w-full',
      title: 'h-6 w-3/4',
      avatar: 'h-10 w-10 rounded-full',
      card: 'h-32 w-full rounded-xl',
      button: 'h-10 w-24',
      image: 'h-48 w-full rounded-lg',
    },
  },
  defaultVariants: { variant: 'text' },
});

interface SkeletonProps extends VariantProps<typeof skeletonVariants> {
  className?: string;
  count?: number;
}

export const Skeleton = ({ variant, className, count = 1 }: SkeletonProps) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={cn(skeletonVariants({ variant }), className)} />
    ))}
  </>
);
