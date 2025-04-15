import logger from "./logger";

interface RequiredEnv {
  GITHUB_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  LOG_LEVEL?: string;
}

export function validateEnv(required: RequiredEnv): void {
  const missing: string[] = [];
  const invalid: string[] = [];

  // Check for missing variables
  Object.entries(required).forEach(([key, value]) => {
    if (!value) {
      missing.push(key);
    }
  });

  // Validate GitHub token length
  if (required.GITHUB_TOKEN && required.GITHUB_TOKEN.length < 40) {
    invalid.push("GITHUB_TOKEN (must be at least 40 characters)");
  }

  // Log validation results
  if (missing.length > 0) {
    logger.error({ missingVariables: missing }, "Missing required environment variables");
  }

  if (invalid.length > 0) {
    logger.error({ invalidVariables: invalid }, "Invalid environment variables");
  }

  // Throw error if validation fails
  if (missing.length > 0 || invalid.length > 0) {
    throw new Error(
      `Environment validation failed:\nMissing: ${missing.join(", ")}\nInvalid: ${invalid.join(", ")}`
    );
  }

  logger.info({ context: "Environment" }, "Environment variables validated successfully");
}
