import logger from "../../utils/logger";
import { getCached, setCached, generateCacheKey } from "../../utils/cache";
import { DEFAULT_REVIEW_PROMPT } from "./prompts";
import { AIModel, ModelConfig, ModelResponse } from "./models/base.model";
import { ClaudeModel } from "./models/claude.model";
import { getModelSettings } from "./models/config";

const CACHE_PREFIX = "analysis:diff";
const DEFAULT_MODEL = process.env.DEFAULT_AI_MODEL || "claude";

export interface AnalysisParams {
  diff: string;
  prompt?: string;
  max_tokens?: number;
  temperature?: number;
  model?: string;
}

export type AnalysisResult = ModelResponse;

export async function analyze({
  diff,
  prompt = DEFAULT_REVIEW_PROMPT,
  max_tokens,
  temperature,
  model = DEFAULT_MODEL,
}: AnalysisParams): Promise<AnalysisResult> {
  const cacheKey = generateCacheKey(CACHE_PREFIX, {
    diff,
    prompt,
    max_tokens,
    temperature,
    model,
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
    const aiModel = getModel(model);
    const formattedPrompt = prompt
      .replace("{diff}", diff)
      .replace("{title}", "Pull Request")
      .replace("{description}", "")
      .replace("{author}", "Unknown")
      .replace("{state}", "open")
      .replace("{url}", "");

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
    throw error;
  }
}

function getModel(model: string): AIModel {
  const settings = getModelSettings(model);

  switch (model.toLowerCase()) {
    case "claude":
      return new ClaudeModel(settings);
    default:
      throw new Error(`Unsupported model: ${model}`);
  }
}
