import { Context, Next } from "hono";
import { validatePullRequestParams } from "../../utils/validator";
import { validateGitHubToken } from "../../utils/env";
import logger from "../../utils/logger";

export const validateParams = async (c: Context, next: Next) => {
  const startTime = Date.now();
  try {
    return await validatePullRequestParams(c, next);
  } catch (error: any) {
    logger.error(
      {
        errorType: error.name,
        context: "Validation Middleware",
      },
      "Error validating params"
    );
    return c.json({ error: "Invalid parameters" }, 400);
  } finally {
    const endTime = Date.now();
    logger.debug(
      {
        executionTime: `${endTime - startTime}ms`,
        context: "Validation Middleware",
      },
      `validateParams middleware executed in ${endTime - startTime}ms`
    );
  }
};

export const validateAnalyzeAndCommentBody = async (c: Context, next: Next) => {
  const requestBody = await c.req.json();

  // Validate postComment
  if (requestBody.postComment !== undefined && typeof requestBody.postComment !== "boolean") {
    return c.json({ error: "postComment must be a boolean value" }, 400);
  }

  // Validate prompt if provided
  if (requestBody.prompt !== undefined && typeof requestBody.prompt !== "string") {
    return c.json({ error: "prompt must be a string" }, 400);
  }

  // Validate maxTokens if provided
  if (requestBody.maxTokens !== undefined) {
    if (
      typeof requestBody.maxTokens !== "number" ||
      !Number.isInteger(requestBody.maxTokens) ||
      requestBody.maxTokens <= 0
    ) {
      return c.json({ error: "maxTokens must be a positive integer" }, 400);
    }
  }

  // Validate temperature if provided
  if (requestBody.temperature !== undefined) {
    if (
      typeof requestBody.temperature !== "number" ||
      requestBody.temperature < 0 ||
      requestBody.temperature > 1
    ) {
      return c.json({ error: "temperature must be a number between 0 and 1" }, 400);
    }
  }

  // Store the validated body in the context for the route handler to use
  c.set("validatedBody", requestBody);
  return next();
};

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
