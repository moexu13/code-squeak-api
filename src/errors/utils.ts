/**
 * Utility functions for error handling
 */

/**
 * Sanitizes an error message to remove potentially sensitive information
 * @param message - The error message to sanitize
 * @returns A sanitized version of the error message
 */
export function sanitizeErrorMessage(message: string): string {
  // Remove any potential API keys, tokens, or secrets
  const sanitized = message
    // Remove API keys (common patterns)
    .replace(/[a-zA-Z0-9]{32,}/g, "[REDACTED]")
    // Remove tokens (common patterns)
    .replace(/[a-zA-Z0-9_-]{20,}/g, "[REDACTED]")
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED]")
    // Remove URLs with query parameters
    .replace(/https?:\/\/[^\s]+/g, "[REDACTED]")
    // Remove file paths
    .replace(/\/[a-zA-Z0-9._/-]+/g, "[REDACTED]");

  return sanitized;
}
