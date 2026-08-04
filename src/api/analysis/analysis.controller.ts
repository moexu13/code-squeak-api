import { Request, Response, NextFunction } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import { analyze, AnalysisParams } from "./analysis.service";
import { BadRequestError, NotFoundError } from "../../errors/http";
import logger from "../../utils/logger";
import { validateAndSanitizeParams } from "../../utils/validation";
import { AnalysisQueue } from "./analysis.queue";
import { getPullRequest } from "../../utils/github";
import { DEFAULT_QUEUE_CONFIG, PRAnalysisParams } from "./types/queue";

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

export async function analyzePR(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  logger.info({
    message: "analyzePR controller called",
    url: req.originalUrl,
    method: req.method,
    body: req.body,
  });

  try {
    const { owner, repo, pull_number } = req.body;

    if (!owner || !repo || !pull_number) {
      throw new BadRequestError(
        "Missing required parameters: owner, repo, pull_number"
      );
    }

    // Check if PR exists
    try {
      await getPullRequest(owner, repo, pull_number);
    } catch (error) {
      throw new NotFoundError(`Pull request #${pull_number} not found`);
    }

    const params: PRAnalysisParams = {
      owner,
      repo,
      pull_number,
      model: req.body.model,
      max_tokens: req.body.max_tokens,
      temperature: req.body.temperature,
    };

    const queue = AnalysisQueue.getInstance({
      ...DEFAULT_QUEUE_CONFIG,
      workerCount: parseInt(process.env.WORKER_COUNT || "1", 10),
    });

    const job = await queue.addJob(params);

    res.status(202).json({
      message: "PR analysis job added to queue",
      jobId: job.id,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  create: asyncErrorBoundary(create),
  analyzePR: asyncErrorBoundary(analyzePR),
};
