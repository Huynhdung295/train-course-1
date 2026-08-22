// ═══════════════════════════════════════════════════════════════
// @nexus/utils – Shared Utility Functions
// ═══════════════════════════════════════════════════════════════

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ProblemDetail } from '@nexus/types';

// ── Class Name Merge (clsx + tailwind-merge) ──────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Format Utilities ──────────────────────────────────────────

export const formatCurrency = (
  amount: number,
  currency = 'VND',
  locale = 'vi-VN',
): string => {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(amount);
};

export const formatDate = (
  date: string | Date,
  locale = 'vi-VN',
  options?: Intl.DateTimeFormatOptions,
): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return new Intl.DateTimeFormat(locale, options ?? defaultOptions).format(
    new Date(date),
  );
};

export const formatNumber = (num: number, locale = 'vi-VN'): string => {
  return new Intl.NumberFormat(locale).format(num);
};

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

// ── RFC 7807 Error Handler ────────────────────────────────────

export const handleRFC7807Errors = <T extends Record<string, unknown>>(
  problem: ProblemDetail,
  setError: (
    field: keyof T,
    error: { type: string; message: string },
  ) => void,
): void => {
  if (problem.errors) {
    Object.entries(problem.errors).forEach(([field, message]) => {
      setError(field as keyof T, { type: 'server', message });
    });
  }
};

export const extractProblemDetail = (error: unknown): ProblemDetail | null => {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    (error as Record<string, unknown>).response
  ) {
    const response = (error as Record<string, { data?: unknown }>).response;
    if (response?.data && typeof response.data === 'object') {
      return response.data as ProblemDetail;
    }
  }
  return null;
};

// ── Debounce & Throttle ───────────────────────────────────────

export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
  let timeout: ReturnType<typeof setTimeout>;
  const debounced = (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};

export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// ── Query String Helpers ──────────────────────────────────────

export const buildQueryString = (
  params: Record<string, unknown>,
): string => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        value.forEach((v) => search.append(key, String(v)));
      } else {
        search.set(key, String(value));
      }
    }
  });
  return search.toString();
};

// ── Local Storage (type-safe) ─────────────────────────────────

export const storage = {
  get: <T>(key: string): T | null => {
    try {
      if (typeof window === 'undefined') return null;
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : null;
    } catch {
      return null;
    }
  },
  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove: (key: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  },
  clear: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.clear();
  },
};

// ── UUID Generator ────────────────────────────────────────────

export const generateId = (): string => {
  return crypto.randomUUID();
};

// ── Sleep (for retry logic) ───────────────────────────────────

export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// ── Deep Clone ────────────────────────────────────────────────

export const deepClone = <T>(obj: T): T => {
  return structuredClone(obj);
};

// ── Truncate String ───────────────────────────────────────────

export const truncate = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};

// ── Capitalize ────────────────────────────────────────────────

export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
