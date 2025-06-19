import logger from "../../utils/logger";
import { getCached, setCached, generateCacheKey } from "../../utils/cache";
import { DEFAULT_REVIEW_PROMPT } from "./prompts";
import { ModelConfig, ModelResponse } from "./models/base.model";
import { getModelSettings } from "./models/config";
import { ModelFactory } from "./models/factory";
import { getDiff, create as createComment } from "../github/github.service";
import { StatusError } from "../../errors/status";
import { PRAnalysisParams } from "./types/queue";

const CACHE_PREFIX = "analysis:diff";
const PR_ANALYSIS_CACHE_PREFIX = "analysis:pr";
const DIFF_CACHE_PREFIX = "diff:pr";
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || "claude-3-5-haiku-20241022";

// Custom error classes for retryable errors
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface AnalysisParams {
  diff: string;
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
  title?: string;
  description?: string;
  author?: string;
  state?: string;
  url?: string;
}

export type AnalysisResult = ModelResponse;

export async function analyze({
  diff,
  prompt = DEFAULT_REVIEW_PROMPT,
  max_tokens,
  temperature,
  model = DEFAULT_MODEL,
  title = "Pull Request",
  description = "",
  author = "Unknown",
  state = "open",
  url = "",
}: AnalysisParams): Promise<AnalysisResult> {
  const cacheKey = generateCacheKey(CACHE_PREFIX, {
    diff,
    prompt,
    max_tokens,
    temperature,
    model,
    title,
    description,
    author,
    state,
    url,
  });

  const cached = await getCached<AnalysisResult>(cacheKey);
  if (cached) {
    logger.info({
      message: "Cache hit for diff analysis",
      diff_length: diff.length,
    });
    return cached;
  }

  try {
    const settings = getModelSettings(model);
    const aiModel = ModelFactory.getInstance().createModel(model, settings);
    const formattedPrompt = prompt
      .replace("{diff}", diff)
      .replace("{title}", title)
      .replace("{description}", description)
      .replace("{author}", author)
      .replace("{state}", state)
      .replace("{url}", url);

    const config: ModelConfig = {
      max_tokens,
      temperature,
    };

    const result = await aiModel.analyze(formattedPrompt, config);
    await setCached(cacheKey, result);
    return result;
  } catch (error) {
    logger.error({
      message: "Error analyzing diff",
      error: error instanceof Error ? error.message : "Unknown error",
      diff_length: diff.length,
    });

    // Convert certain errors to retryable errors
    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("connection")
      ) {
        throw new NetworkError(error.message);
      }
      if (
        error.message.includes("timeout") ||
        error.message.includes("timed out")
      ) {
        throw new TimeoutError(error.message);
      }
      if (
        error.message.includes("rate limit") ||
        error.message.includes("too many requests")
      ) {
        throw new RateLimitError(error.message);
      }
    }

    throw error;
  }
}

export async function analyzePullRequest({
  owner,
  repo,
  pull_number,
  model,
  max_tokens,
  temperature,
}: PRAnalysisParams): Promise<void> {
  try {
    // Generate cache key for PR analysis
    const cacheKey = generateCacheKey(PR_ANALYSIS_CACHE_PREFIX, {
      owner,
      repo,
      pull_number,
      model,
      max_tokens,
      temperature,
    });

    // Check if we have a cached analysis
    const cachedAnalysis = await getCached<{ completion: string }>(cacheKey);
    if (cachedAnalysis) {
      logger.info({
        message: "Cache hit for PR analysis",
        owner,
        repo,
        pull_number,
      });

      // Post the cached analysis as a comment
      await createComment(owner, repo, pull_number, cachedAnalysis.completion);
      return;
    }

    // 1. Get the PR diff (with caching)
    logger.info({
      message: "Fetching PR diff",
      owner,
      repo,
      pull_number,
    });

    // Generate cache key for the diff
    const diffCacheKey = generateCacheKey(DIFF_CACHE_PREFIX, {
      owner,
      repo,
      pull_number,
    });

    // Try to get cached diff first
    let diff = await getCached<string>(diffCacheKey);
    if (!diff) {
      // If not in cache, fetch from GitHub
      try {
        diff = await getDiff(owner, repo, pull_number);
        // Cache the diff
        await setCached(diffCacheKey, diff);
        logger.info({
          message: "Cached PR diff",
          owner,
          repo,
          pull_number,
        });
      } catch (error) {
        if (error instanceof Error) {
          if (
            error.message.includes("network") ||
            error.message.includes("connection")
          ) {
            throw new NetworkError(error.message);
          }
          if (
            error.message.includes("timeout") ||
            error.message.includes("timed out")
          ) {
            throw new TimeoutError(error.message);
          }
          if (
            error.message.includes("rate limit") ||
            error.message.includes("too many requests")
          ) {
            throw new RateLimitError(error.message);
          }
        }
        throw error;
      }
    } else {
      logger.info({
        message: "Cache hit for PR diff",
        owner,
        repo,
        pull_number,
      });
    }

    // 2. Analyze the diff
    logger.info({
      message: "Analyzing PR diff",
      owner,
      repo,
      pull_number,
    });
    const analysis = await analyze({
      diff,
      model,
      max_tokens,
      temperature,
    });

    // Cache the analysis result
    await setCached(cacheKey, { completion: analysis.completion });

    // 3. Post the analysis as a comment
    logger.info({
      message: "Posting analysis comment",
      owner,
      repo,
      pull_number,
    });
    try {
      await createComment(owner, repo, pull_number, analysis.completion);
    } catch (error) {
      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("connection")
        ) {
          throw new NetworkError(error.message);
        }
        if (
          error.message.includes("timeout") ||
          error.message.includes("timed out")
        ) {
          throw new TimeoutError(error.message);
        }
        if (
          error.message.includes("rate limit") ||
          error.message.includes("too many requests")
        ) {
          throw new RateLimitError(error.message);
        }
      }
      throw error;
    }

    logger.info({
      message: "PR analysis completed successfully",
      owner,
      repo,
      pull_number,
    });
  } catch (error) {
    logger.error({
      message: "Failed to analyze pull request",
      error: error instanceof Error ? error.message : "Unknown error",
      owner,
      repo,
      pull_number,
    });

    if (error instanceof StatusError) {
      throw error;
    }

    throw new StatusError("Failed to analyze pull request", 500, {
      owner,
      repo,
      pull_number,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
