import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import {
  analyze,
  analyzePullRequest,
  AnalysisParams,
  PRAnalysisParams,
} from "./analysis.service";
import { BadRequestError } from "../../errors/http";
import logger from "../../utils/logger";
import { validateAndSanitizeParams } from "../../utils/validation";

async function create(req: Request, res: Response) {
  const {
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
  } = req.body;

  if (!diff) {
    throw new BadRequestError("Diff is required");
  }

  const params: AnalysisParams = {
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
  };

  // Log scrubbed parameters
  logger.info({
    message: "Processing analysis request",
    params: validateAndSanitizeParams(params),
  });

  const result = await analyze(params);
  res.json({ data: result });
}

async function analyzePR(req: Request, res: Response) {
  const { owner, repo, pull_number, model, max_tokens, temperature } = req.body;

  if (!owner || !repo || !pull_number) {
    throw new BadRequestError("Owner, repo, and pull_number are required");
  }

  const params: PRAnalysisParams = {
    owner,
    repo,
    pull_number,
    model,
    max_tokens,
    temperature,
  };

  logger.info({
    message: "Processing PR analysis request",
    params: validateAndSanitizeParams(params),
  });

  await analyzePullRequest(params);
  res.json({ data: "Pull request analysis completed" });
}

export default {
  create: asyncErrorBoundary(create),
  analyzePR: asyncErrorBoundary(analyzePR),
};
