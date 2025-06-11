import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import { analyzePullRequest, PRAnalysisParams } from "./pr-analysis.service";
import { BadRequestError } from "../../errors/http";
import logger from "../../utils/logger";

async function create(req: Request, res: Response) {
  const { owner, repo, pull_number } = req.params;
  const { model, max_tokens, temperature } = req.body || {};

  // Validate required parameters
  if (!owner || !repo || !pull_number) {
    throw new BadRequestError("Owner, repo, and pull number are required");
  }

  const params: PRAnalysisParams = {
    owner,
    repo,
    pull_number: parseInt(pull_number),
    model,
    max_tokens,
    temperature,
  };

  // Log request parameters
  logger.info({
    message: "Processing PR analysis request",
    params: {
      ...params,
      pull_number: params.pull_number.toString(), // Convert to string for logging
    },
  });

  await analyzePullRequest(params);
  res.json({ data: "Pull request analysis completed" });
}

export default {
  create: asyncErrorBoundary(create),
};
