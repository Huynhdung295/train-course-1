// =============================================================================
// Nexus ERP — Core Domain Models
// Single source of truth for all API contracts between FE ↔ BE
// =============================================================================

// ─── RFC 7807 Problem Details (Spring Boot GlobalExceptionHandler) ────────────
export interface FieldError {
  field: string;
  message: string;
  rejectedValue?: unknown;
}

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  errors?: FieldError[];
  traceId?: string;
  timestamp?: string;
}

// ─── Pagination (Spring Data Page<T>) ─────────────────────────────────────────
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;           // current page (0-indexed)
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface PageParams {
  page?: number;
  size?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

// ─── Generic API State ─────────────────────────────────────────────────────────
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ApiState<T> {
  data: T | null;
  loading: LoadingState;
  error: ProblemDetail | null;
}

export function initialApiState<T>(): ApiState<T> {
  return { data: null, loading: 'idle', error: null };
}

// ─── Common Enums ──────────────────────────────────────────────────────────────
export enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  DELETED = 'DELETED',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}
