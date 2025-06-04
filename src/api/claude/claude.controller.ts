import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import { createCompletion } from "./claude.service";
import { StatusError } from "../../errors";

async function create(req: Request, res: Response) {
  const { prompt, max_tokens, temperature } = req.body;

  if (!prompt) {
    throw new StatusError("Prompt is required", 400, {
      path: req.originalUrl,
      method: req.method,
    });
  }

  try {
    const result = await createCompletion({
      prompt,
      max_tokens,
      temperature,
    });
    res.json({ data: result });
  } catch (error) {
    if (error instanceof StatusError) {
      throw error;
    }
    throw new StatusError("Error calling Claude API", 500, {
      path: req.originalUrl,
      method: req.method,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export default {
  create: asyncErrorBoundary(create),
};
