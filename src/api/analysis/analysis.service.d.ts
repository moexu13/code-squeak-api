export interface PRAnalysisParams {
  owner: string;
  repo: string;
  pull_number: number;
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

export function analyzePullRequest(params: PRAnalysisParams): Promise<void>;
