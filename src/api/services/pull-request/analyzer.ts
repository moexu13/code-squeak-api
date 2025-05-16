import { GitHubService } from "../github/service";
import { ClaudeService } from "../claude/service";
import { Sanitizer } from "../../../utils/sanitizer";
import { DEFAULT_REVIEW_PROMPT } from "../../types";
import logger from "../../../utils/logger";

export interface AnalysisOptions {
  customPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnalysisResult {
  pullRequest: {
    title: string;
    body: string | null;
    user: string;
    state: string;
    url: string;
  };
  analysis: string;
}

export async function analyzePullRequest(
  owner: string,
  repoName: string,
  pullNumber: number,
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  const { customPrompt, maxTokens, temperature } = options;

  logger.info(
    {
      owner,
      repoName,
      pullNumber,
      hasCustomPrompt: !!customPrompt,
      maxTokens,
      temperature,
      context: "Pull Request Analyzer",
    },
    "Starting pull request analysis"
  );

  const githubService = new GitHubService();
  const claudeService = new ClaudeService();

  // Get pull request data
  const pullRequestData = await githubService.getPullRequest(owner, repoName, pullNumber);

  // Sanitize the data
  const sanitizedPullRequest = Sanitizer.sanitizePullRequestData(pullRequestData);

  // Format the prompt
  const formattedPrompt = customPrompt
    ? Sanitizer.sanitizePrompt(customPrompt)
    : DEFAULT_REVIEW_PROMPT.replace("{title}", sanitizedPullRequest.title)
        .replace("{description}", sanitizedPullRequest.body || "")
        .replace("{author}", sanitizedPullRequest.user)
        .replace("{state}", sanitizedPullRequest.state)
        .replace("{url}", sanitizedPullRequest.url)
        .replace("{diff}", sanitizedPullRequest.diff);

  // Get analysis from Claude
  const analysisResult = await claudeService.sendMessage(formattedPrompt, {
    maxTokens,
    temperature,
  });

  logger.debug(
    {
      owner,
      repoName,
      pullNumber,
      context: "Pull Request Analyzer",
    },
    "Successfully analyzed pull request"
  );

  return {
    pullRequest: {
      title: sanitizedPullRequest.title,
      body: sanitizedPullRequest.body,
      user: sanitizedPullRequest.user,
      state: sanitizedPullRequest.state,
      url: sanitizedPullRequest.url,
    },
    analysis: analysisResult,
  };
}
