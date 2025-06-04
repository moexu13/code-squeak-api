import {
  ClaudeCompletion,
  createCompletion as createClaudeCompletion,
} from "../claude/claude.service";
import logger from "../../utils/logger";

export interface AnalysisParams {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export interface AnalysisResult {
  completion: string;
  stop_reason: string | null;
  model: string;
}

export async function analyze({
  prompt,
  model = "claude",
  max_tokens,
  temperature,
}: AnalysisParams): Promise<AnalysisResult> {
  logger.info({
    message: "Starting analysis",
    model,
    prompt_length: prompt.length,
  });

  try {
    switch (model.toLowerCase()) {
      case "claude":
        return await createClaudeCompletion({
          prompt,
          max_tokens,
          temperature,
        });
      // Add more models here
      // case "gpt4":
      //   return await createGPT4Completion({...});
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  } catch (error) {
    logger.error({
      message: "Error during analysis",
      model,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
