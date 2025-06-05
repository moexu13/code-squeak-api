import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import { analyze, AnalysisParams } from "./analysis.service";
import { BadRequestError } from "../../errors/http";

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

  const result = await analyze(params);
  res.json({ data: result });
}

export default {
  create: asyncErrorBoundary(create),
};
