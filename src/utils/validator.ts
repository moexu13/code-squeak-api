import { Context, Next } from "hono";
import { createErrorResponse } from "../api/utils/response";
import logger from "./logger.js";
import { validateGitHubToken, EnvValidationResult } from "./env";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ValidationRule {
  field: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  validate?: (value: any) => boolean;
  errorMessage?: string;
}

export const createValidationMiddleware = (rules: ValidationRule[]) => {
  return async (c: Context, next: Next) => {
    const requestBody = await c.req.json();

    for (const rule of rules) {
      const value = requestBody[rule.field];

      if (rule.required && value === undefined) {
        return c.json(createErrorResponse(`${rule.field} is required`), 400);
      }

      if (value !== undefined) {
        if (typeof value !== rule.type) {
          return c.json(createErrorResponse(`${rule.field} must be a ${rule.type}`), 400);
        }

        if (rule.validate && !rule.validate(value)) {
          return c.json(createErrorResponse(rule.errorMessage || `Invalid ${rule.field}`), 400);
        }
      }
    }

    c.set("validatedBody", requestBody);
    return next();
  };
};

export interface ValidationResult {
  isValid: boolean;
  error?: {
    message: string;
    details?: Record<string, any>;
  };
}

export const validateOwner = (ownerName: string): ValidationResult => {
  if (!ownerName) {
    return {
      isValid: false,
      error: {
        message: "Owner parameter is required",
      },
    };
  }
  if (ownerName.length > 39) {
    return {
      isValid: false,
      error: {
        message: "Owner parameter must be 39 characters or less",
      },
    };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(ownerName)) {
    return {
      isValid: false,
      error: {
        message: "Owner parameter can only contain alphanumeric characters and hyphens",
      },
    };
  }
  return { isValid: true };
};

export const validateRepo = (repositoryName: string): ValidationResult => {
  if (!repositoryName) {
    return {
      isValid: false,
      error: {
        message: "Repository parameter is required",
      },
    };
  }
  if (repositoryName.length > 100) {
    return {
      isValid: false,
      error: {
        message: "Repository parameter must be 100 characters or less",
      },
    };
  }
  if (!/^[a-zA-Z0-9-_.]+$/.test(repositoryName)) {
    return {
      isValid: false,
      error: {
        message:
          "Repository parameter can only contain alphanumeric characters, hyphens, underscores, and periods",
      },
    };
  }
  return { isValid: true };
};

export const validatePullRequestParams = async (context: Context, next: Next) => {
  try {
    const {
      owner: ownerName,
      repoName: repositoryName,
      pullNumber: pullRequestNumber,
    } = context.req.param();

    const ownerValidation = validateOwner(ownerName);
    if (!ownerValidation.isValid) {
      return context.json(
        createErrorResponse(ownerValidation.error?.message || "Invalid owner"),
        400
      );
    }

    const repoValidation = validateRepo(repositoryName);
    if (!repoValidation.isValid) {
      return context.json(
        createErrorResponse(repoValidation.error?.message || "Invalid repository"),
        400
      );
    }

    if (pullRequestNumber) {
      const prValidation = validatePullRequestNumber(pullRequestNumber);
      if (!prValidation.isValid) {
        return context.json(
          createErrorResponse(prValidation.error?.message || "Invalid pull request number"),
          400
        );
      }
    }

    await next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return context.json(createErrorResponse(error.message), 400);
    }
    throw error;
  }
};

export const validatePullRequestNumber = (pullRequestNumber: string): ValidationResult => {
  const numericPullRequestNumber = parseInt(pullRequestNumber, 10);
  if (isNaN(numericPullRequestNumber) || numericPullRequestNumber <= 0) {
    return {
      isValid: false,
      error: {
        message: "Invalid pull request number",
      },
    };
  }
  return { isValid: true };
};

export const validateParams = validatePullRequestParams;

export const validateAnalyzeAndCommentBody = createValidationMiddleware([
  { field: "postComment", type: "boolean" },
  { field: "prompt", type: "string" },
  {
    field: "maxTokens",
    type: "number",
    validate: (value) => Number.isInteger(value) && value > 0,
    errorMessage: "maxTokens must be a positive integer",
  },
  {
    field: "temperature",
    type: "number",
    validate: (value) => value >= 0 && value <= 1,
    errorMessage: "temperature must be between 0 and 1",
  },
]);

export const injectEnvironmentVariables = async (c: Context, next: Next) => {
  const githubToken = process.env.GITHUB_TOKEN;
  const validation = validateGitHubToken(githubToken);

  if (!validation.isValid) {
    logger.error(
      {
        ...validation.error?.details,
        context: "API Middleware",
      },
      validation.error?.message || "GitHub token validation failed"
    );
    return c.json(
      {
        error: validation.error?.message,
        details: validation.error?.details,
      },
      500
    );
  }

  c.set("apiKey", githubToken);
  await next();
};
