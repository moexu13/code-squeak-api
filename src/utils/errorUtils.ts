/**
 * Sanitizes an error message to remove potentially sensitive information
 */
export function sanitizeErrorMessage(message: string): string {
  // First, replace all sensitive data with placeholders while preserving commas
  const patterns = [
    {
      regex: /(?:mongodb|postgresql|mysql|redis):\/\/[^@]+@[^/]+\/[^?\s]+/g,
      replacement: "[CONNECTION_STRING]",
    },
    {
      regex: /(?:api[_-]?key|token|secret|password)=[^&\s]+/gi,
      replacement: "[SENSITIVE_DATA]",
    },
    {
      regex: /\/[a-zA-Z0-9-_/]+\.(?:js|ts|json|env|config)(?=\s|$|,)/g,
      replacement: "[FILE_PATH]",
    },
    {
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: "[EMAIL]",
    },
  ];

  // First pass: replace all patterns and collect their positions
  const replacements: { start: number; end: number; replacement: string }[] =
    [];
  patterns.forEach(({ regex, replacement }) => {
    let match;
    while ((match = regex.exec(message)) !== null) {
      replacements.push({
        start: match.index,
        end: match.index + match[0].length,
        replacement,
      });
    }
  });

  // Sort replacements by start position
  replacements.sort((a, b) => a.start - b.start);

  // Second pass: build the new message with proper separators
  let result = "";
  let lastEnd = 0;

  replacements.forEach(({ start, end, replacement }, index) => {
    // Add the text before this replacement
    result += message.slice(lastEnd, start);

    // Add the replacement
    result += replacement;

    // Add a comma if this isn't the last replacement and there isn't already a comma
    if (index < replacements.length - 1) {
      const nextChar = message[end];
      if (nextChar !== ",") {
        result += ",";
      }
    }

    lastEnd = end;
  });

  // Add any remaining text
  result += message.slice(lastEnd);

  // Clean up any double commas
  result = result.replace(/,\s*,/g, ",");
  // Clean up any spaces before commas
  result = result.replace(/\s+,/g, ",");
  // Clean up any double spaces
  result = result.replace(/\s{2,}/g, " ");

  return result;
}

/**
 * Creates a sanitized error object for logging
 */
export function createSanitizedError(error: unknown, req: any) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message:
      error instanceof Error
        ? sanitizeErrorMessage(error.message)
        : "An unknown error occurred",
    stack: error instanceof Error ? error.stack : undefined,
    request: {
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      query: req.query,
      headers: {
        "content-type": req.headers["content-type"],
        "user-agent": req.headers["user-agent"],
      },
    },
  };
}
