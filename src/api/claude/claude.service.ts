import { Anthropic } from "@anthropic-ai/sdk";
import logger from "../../utils/logger";
import { CircuitBreaker } from "../../utils/circuitBreaker";
import { getCached, setCached, generateCacheKey } from "../../utils/cache";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CACHE_PREFIX = "claude:completion";

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 10000,
  halfOpenTimeout: 5000,
  successThreshold: 2,
});

export interface ClaudeCompletionParams {
  prompt: string;
  max_tokens?: number;
  temperature?: number;
}

export interface ClaudeCompletion {
  completion: string;
  stop_reason: string | null;
  model: string;
}

export async function createCompletion({
  prompt,
  max_tokens = parseInt(process.env.CLAUDE_MAX_TOKENS || "1000"),
  temperature = parseFloat(process.env.CLAUDE_TEMPERATURE || "0.7"),
}: ClaudeCompletionParams): Promise<ClaudeCompletion> {
  // Generate cache key based on prompt and parameters
  const cacheKey = generateCacheKey(CACHE_PREFIX, {
    prompt,
    max_tokens,
    temperature,
  });

  // Try to get cached response
  const cached = await getCached<ClaudeCompletion>(cacheKey);
  if (cached) {
    logger.info({
      message: "Cache hit for Claude completion",
      prompt_length: prompt.length,
      max_tokens,
      temperature,
    });
    return cached;
  }

  try {
    const response = await fetchWithBreaker(circuitBreaker, () =>
      anthropic.messages.create({
        model: process.env.CLAUDE_MODEL || "claude-3-sonnet-20240229",
        max_tokens,
        temperature,
        messages: [{ role: "user", content: prompt }],
      })
    );

    const result = {
      completion:
        response.content[0].type === "text" ? response.content[0].text : "",
      stop_reason: response.stop_reason,
      model: response.model,
    };

    // Cache the result
    await setCached(cacheKey, result);

    return result;
  } catch (error) {
    logger.error({
      message: "Error calling Claude API",
      error: error instanceof Error ? error.message : "Unknown error",
      prompt_length: prompt.length,
    });
    throw error;
  }
}

async function fetchWithBreaker<T>(
  breaker: CircuitBreaker,
  apiCall: () => Promise<T>
): Promise<T> {
  return breaker.execute(apiCall);
}
