/**
 * Extracts the retry-after time in milliseconds from an error message
 * @param message The error message to parse
 * @returns The retry-after time in milliseconds, or undefined if not found
 */
export function extractRetryAfter(message: string): number | undefined {
  const match = message.match(/retry after (\d+) seconds/i);
  if (match) {
    return parseInt(match[1], 10) * 1000;
  }
  return undefined;
}

/**
 * Extracts the maximum token limit from an error message
 * @param message The error message to parse
 * @param defaultMaxTokens The default value to return if no match is found
 * @returns The maximum token limit, or defaultMaxTokens if not found
 */
export function extractMaxTokens(message: string, defaultMaxTokens: number): number {
  const match = message.match(/max tokens: (\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  return defaultMaxTokens;
}
