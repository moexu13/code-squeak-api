/**
 * GitHub API specific error handling
 */

export class GitHubError extends Error {
  constructor(
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GitHubError";
  }
}
