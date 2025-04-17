export class ClaudeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeError";
  }
}

export class ClaudeRateLimitError extends ClaudeError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = "ClaudeRateLimitError";
  }
}

export class ClaudeAuthenticationError extends ClaudeError {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeAuthenticationError";
  }
}

export class ClaudeRequestError extends ClaudeError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "ClaudeRequestError";
  }
}

export class ClaudeTokenLimitError extends ClaudeError {
  constructor(
    message: string,
    public readonly maxTokens: number
  ) {
    super(message);
    this.name = "ClaudeTokenLimitError";
  }
}

export class ClaudeTimeoutError extends ClaudeError {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeTimeoutError";
  }
}
