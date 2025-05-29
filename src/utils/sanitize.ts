/**
 * Sanitizes a diff string by removing sensitive information and limiting size
 * @param diff The diff string to sanitize
 * @returns The sanitized diff string
 */
export function sanitizeDiff(diff: string): string {
  // Patterns for sensitive data
  const SENSITIVE_PATTERNS = [
    // Key-value pairs
    /(?:password|secret|key|token|auth)[=:]\s*["']?[^"'\s]+["']?/gi,
    /(?:api[_-]?key|access[_-]?token)[=:]\s*["']?[^"'\s]+["']?/gi,
    /(?:private[_-]?key|secret[_-]?key)[=:]\s*["']?[^"'\s]+["']?/gi,
    // Plain sensitive strings
    /\b(?:password|secret|key|token|auth)[0-9a-zA-Z_-]+\b/gi,
  ];

  if (!diff) return "";

  // Replace sensitive data with [REDACTED]
  let sanitized = diff;
  SENSITIVE_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, (match) => {
      // If it's a key-value pair, preserve the key
      if (match.includes("=") || match.includes(":")) {
        const [key] = match.split(/[=:]\s*/);
        return `${key}=[REDACTED]`;
      }
      // Otherwise just redact the whole thing
      return "[REDACTED]";
    });
  });

  // Then limit the diff size to 10KB
  const MAX_DIFF_SIZE = 10 * 1024;
  if (sanitized.length > MAX_DIFF_SIZE) {
    sanitized =
      sanitized.substring(0, MAX_DIFF_SIZE) + "\n... (diff truncated)";
  }

  return sanitized;
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
