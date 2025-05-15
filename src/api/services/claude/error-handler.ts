import {
  ClaudeError,
  ClaudeRateLimitError,
  ClaudeAuthenticationError,
  ClaudeTokenLimitError,
  ClaudeTimeoutError,
  ClaudeRequestError,
} from "../../../utils/claudeErrors";
import { extractRetryAfter, extractMaxTokens } from "../../../utils/claudeUtils";
import logger from "../../../utils/logger";

export const handleClaudeError = (
  error: unknown,
  context: string,
  defaultMaxTokens: number
): never => {
  if (error instanceof ClaudeError) {
    throw error;
  }

  if (error instanceof Error) {
    if (error.message.includes("rate limit")) {
      const retryAfter = extractRetryAfter(error.message);
      throw new ClaudeRateLimitError("Rate limit exceeded", retryAfter);
    }

    if (error.message.includes("authentication")) {
      throw new ClaudeAuthenticationError("Authentication failed");
    }

    if (error.message.includes("token limit")) {
      const maxTokens = extractMaxTokens(error.message, defaultMaxTokens);
      throw new ClaudeTokenLimitError("Token limit exceeded", maxTokens);
    }

    if (error.message.includes("timeout")) {
      throw new ClaudeTimeoutError("Request timed out");
    }
  }

  logger.error({ error, context }, "Unexpected error in Claude service");
  throw new ClaudeRequestError("Unexpected error occurred", 500);
};
