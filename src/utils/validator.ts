import { Context, Next } from "hono";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const validateOwner = (owner: string): void => {
  if (!owner) {
    throw new ValidationError("Owner parameter is required");
  }
  if (owner.length > 39) {
    throw new ValidationError("Owner parameter must be 39 characters or less");
  }
  if (!/^[a-zA-Z0-9-]+$/.test(owner)) {
    throw new ValidationError(
      "Owner parameter can only contain alphanumeric characters and hyphens"
    );
  }
};

export const validateRepo = (repo: string): void => {
  if (!repo) {
    throw new ValidationError("Repository parameter is required");
  }
  if (repo.length > 100) {
    throw new ValidationError("Repository parameter must be 100 characters or less");
  }
  if (!/^[a-zA-Z0-9-_.]+$/.test(repo)) {
    throw new ValidationError(
      "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods"
    );
  }
};

export const validatePullRequestParams = async (c: Context, next: Next) => {
  try {
    const { owner, repoName, pullNumber } = c.req.param();
    validateOwner(owner);
    validateRepo(repoName);
    if (pullNumber) {
      validatePullRequestNumber(pullNumber);
    }

    await next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
};

export const validatePullRequestNumber = (pullNumber: string): void => {
  const pullNum = parseInt(pullNumber, 10);
  if (isNaN(pullNum) || pullNum <= 0) {
    throw new ValidationError("Invalid pull request number");
  }
};
