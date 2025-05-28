/**
 * Sanitizes a diff string by removing sensitive information and limiting size
 * @param diff The diff string to sanitize
 * @returns The sanitized diff string
 */
export function sanitizeDiff(diff: string): string {
  // Remove sensitive patterns first
  const sensitivePatterns = [
    /api[_-]?key["']?\s*[:=]\s*["'][^"']+["']/gi,
    /secret["']?\s*[:=]\s*["'][^"']+["']/gi,
    /password["']?\s*[:=]\s*["'][^"']+["']/gi,
    /token["']?\s*[:=]\s*["'][^"']+["']/gi,
    /credential["']?\s*[:=]\s*["'][^"']+["']/gi,
  ];

  let filteredDiff = diff;
  sensitivePatterns.forEach((pattern) => {
    filteredDiff = filteredDiff.replace(pattern, "[REDACTED]");
  });

  // Then limit the diff size to 10KB
  const MAX_DIFF_SIZE = 10 * 1024;
  if (filteredDiff.length > MAX_DIFF_SIZE) {
    filteredDiff =
      filteredDiff.substring(0, MAX_DIFF_SIZE) + "\n... (diff truncated)";
  }

  return filteredDiff;
}

/**
 * Sanitizes an error message by removing sensitive information
 * @param message The error message to sanitize
 * @returns The sanitized error message
 */
export function sanitizeErrorMessage(message: string): string {
  const sensitivePatterns = [
    /api[_-]?key["']?\s*[:=]\s*["'][^"']+["']/gi,
    /secret["']?\s*[:=]\s*["'][^"']+["']/gi,
    /password["']?\s*[:=]\s*["'][^"']+["']/gi,
    /token["']?\s*[:=]\s*["'][^"']+["']/gi,
    /credential["']?\s*[:=]\s*["'][^"']+["']/gi,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email addresses
    /https?:\/\/[^\s]+/g, // URLs
    /\/[a-zA-Z0-9._/-]+/g, // File paths
  ];

  let sanitizedMessage = message;
  sensitivePatterns.forEach((pattern) => {
    sanitizedMessage = sanitizedMessage.replace(pattern, "[REDACTED]");
  });

  return sanitizedMessage;
}
