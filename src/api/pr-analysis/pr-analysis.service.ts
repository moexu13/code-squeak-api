import logger from "../../utils/logger";
import { getDiff } from "../github/github.service";
import { analyze } from "../analysis/analysis.service";
import { create as createComment } from "../github/github.service";
import { StatusError } from "../../errors/status";

export interface PRAnalysisParams {
  owner: string;
  repo: string;
  pull_number: number;
  model?: string;
  max_tokens?: number;
  temperature?: number;
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
    // 1. Get the PR diff
    logger.info({
      message: "Fetching PR diff",
      owner,
      repo,
      pull_number,
    });
    const diff = await getDiff(owner, repo, pull_number);

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

    // 3. Post the analysis as a comment
    logger.info({
      message: "Posting analysis comment",
      owner,
      repo,
      pull_number,
    });
    await createComment(owner, repo, pull_number, analysis.completion);

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
