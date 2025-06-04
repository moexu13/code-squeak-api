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
    const aiModel = getModel(model);
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
