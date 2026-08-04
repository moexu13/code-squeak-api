import { BadRequestError } from "../errors/http";
import { AnalysisParams } from "../api/analysis/analysis.service";
import { PRAnalysisParams } from "../api/analysis/types/queue";

// Constants for validation
export const MAX_DIFF_SIZE = 1024 * 1024; // 1MB
export const MAX_STRING_LENGTH = 1000;

/**
 * Validates and sanitizes analysis parameters
 * @throws {BadRequestError} if validation fails
 */
export function validateAndSanitizeParams(
  params: AnalysisParams | PRAnalysisParams
): AnalysisParams | PRAnalysisParams {
  if ("diff" in params) {
    const { diff, ...rest } = params as AnalysisParams;
    validateDiff(diff);
    const sanitizedRest = sanitizeStringParams(rest);
    return {
      ...sanitizedRest,
      diff: `[SCRUBBED: ${diff.length} chars]`,
    } as AnalysisParams;
  } else {
    const prParams = params as PRAnalysisParams;
    const sanitized = {
      owner: prParams.owner.slice(0, MAX_STRING_LENGTH),
      repo: prParams.repo.slice(0, MAX_STRING_LENGTH),
      pull_number: prParams.pull_number,
      model: prParams.model?.slice(0, MAX_STRING_LENGTH),
      max_tokens: prParams.max_tokens,
      temperature: prParams.temperature,
    };
    return sanitized as PRAnalysisParams;
  }
}

/**
 * Validates the diff parameter
 * @throws {BadRequestError} if validation fails
 */
function validateDiff(diff: string): void {
  if (typeof diff !== "string") {
    throw new BadRequestError("Diff must be a string");
  }

  if (diff.length > MAX_DIFF_SIZE) {
    throw new BadRequestError(
      `Diff size exceeds maximum allowed size of ${MAX_DIFF_SIZE} bytes`
    );
  }
}

/**
 * Sanitizes string parameters in the input object
 */
function sanitizeStringParams<T extends Record<string, unknown>>(params: T): T {
  return Object.entries(params).reduce((acc, [key, value]) => {
    if (typeof value === "string") {
      acc[key as keyof T] = value.slice(0, MAX_STRING_LENGTH) as T[keyof T];
    } else {
      acc[key as keyof T] = value as T[keyof T];
    }
    return acc;
  }, {} as T);
}
