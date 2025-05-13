import { Context, Next } from "hono";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export const validateOwner = (ownerName: string): void => {
  if (!ownerName) {
    throw new ValidationError("Owner parameter is required");
  }
  if (ownerName.length > 39) {
    throw new ValidationError("Owner parameter must be 39 characters or less");
  }
  if (!/^[a-zA-Z0-9-]+$/.test(ownerName)) {
    throw new ValidationError(
      "Owner parameter can only contain alphanumeric characters and hyphens"
    );
  }
};

export const validateRepo = (repositoryName: string): void => {
  if (!repositoryName) {
    throw new ValidationError("Repository parameter is required");
  }
  if (repositoryName.length > 100) {
    throw new ValidationError("Repository parameter must be 100 characters or less");
  }
  if (!/^[a-zA-Z0-9-_.]+$/.test(repositoryName)) {
    throw new ValidationError(
      "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods"
    );
  }
};

export const validatePullRequestParams = async (context: Context, next: Next) => {
  try {
    const {
      owner: ownerName,
      repoName: repositoryName,
      pullNumber: pullRequestNumber,
    } = context.req.param();
    validateOwner(ownerName);
    validateRepo(repositoryName);
    if (pullRequestNumber) {
      validatePullRequestNumber(pullRequestNumber);
    }

    await next();
  } catch (validationError) {
    if (validationError instanceof ValidationError) {
      return context.json({ error: validationError.message }, 400);
    }
    throw validationError;
  }
};

export const validatePullRequestNumber = (pullRequestNumber: string): void => {
  const numericPullRequestNumber = parseInt(pullRequestNumber, 10);
  if (isNaN(numericPullRequestNumber) || numericPullRequestNumber <= 0) {
    throw new ValidationError("Invalid pull request number");
  }
};
