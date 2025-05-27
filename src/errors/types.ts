/**
 * Common error interfaces for the application.
 */

export interface HttpErrorInterface extends Error {
  status: number;
  context?: Record<string, unknown>;
}

export interface ErrorContext {
  originalError?: Error;
  stack?: string;
  [key: string]: unknown;
}
