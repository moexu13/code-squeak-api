import {
  GitHubError,
  GitHubAuthenticationError,
  GitHubRateLimitError,
  GitHubNotFoundError,
  GitHubValidationError,
} from "../../../utils/githubErrors";
import logger from "../../../utils/logger";

export const handleGitHubError = (error: any, context: string): never => {
  logger.error({ error, context }, "GitHub API error occurred");

  if (error.status === 403 && error.message?.includes("rate limit")) {
    const retryAfter = error.response?.headers?.["retry-after"];
    throw new GitHubRateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
  }

  if (error.status === 401 || error.status === 403) {
    throw new GitHubAuthenticationError();
  }

  if (error.status === 404) {
    throw new GitHubNotFoundError(context);
  }

  if (error.status === 422) {
    throw new GitHubValidationError(error.message);
  }

  throw new GitHubError(error.message || "Unexpected GitHub API error");
};
