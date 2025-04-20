export class GitHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

export class GitHubAuthenticationError extends GitHubError {
  constructor() {
    super("GitHub authentication failed");
    this.name = "GitHubAuthenticationError";
  }
}

export class GitHubRateLimitError extends GitHubError {
  constructor(retryAfter?: number) {
    super("GitHub API rate limit exceeded");
    this.name = "GitHubRateLimitError";
    if (retryAfter) {
      this.message += ` - Retry after ${retryAfter} seconds`;
    }
  }
}

export class GitHubNotFoundError extends GitHubError {
  constructor(resource: string) {
    super(`GitHub resource not found: ${resource}`);
    this.name = "GitHubNotFoundError";
  }
}

export class GitHubValidationError extends GitHubError {
  constructor(message: string) {
    super(`GitHub validation error: ${message}`);
    this.name = "GitHubValidationError";
  }
}
