import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import {
  create as createPullRequestComment,
  list as listRepos,
  read as readRepo,
  getDiff as getPullRequestDiff,
} from "./github.service";
import { StatusError } from "../../errors";

async function list(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const per_page = parseInt(req.query.per_page as string) || 10;

  const data = await listRepos(req.params.owner, { page, per_page });
  res.json(data);
}

async function read(req: Request, res: Response) {
  const data = await readRepo(req.params.owner, req.params.repo);
  res.json(data);
}

async function create(req: Request, res: Response) {
  const { owner, repo, pull_number } = req.params;
  const {
    data: { comment },
  } = req.body;

  if (!comment) {
    throw new StatusError("Comment is required", 400, {
      path: req.originalUrl,
      method: req.method,
    });
  }

  try {
    await createPullRequestComment(owner, repo, parseInt(pull_number), comment);
    res.send({ data: "Pull request comment created" });
  } catch (error) {
    if (error instanceof StatusError) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("Not Found")) {
      throw new StatusError("Pull request not found", 404, {
        path: req.originalUrl,
        method: req.method,
      });
    }
    throw error;
  }
}

async function getDiff(req: Request, res: Response) {
  const { owner, repo, pull_number } = req.params;

  try {
    const diff = await getPullRequestDiff(owner, repo, parseInt(pull_number));
    res.send({ data: diff });
  } catch (error) {
    if (error instanceof StatusError) {
      throw error;
    }
    if (error instanceof Error && error.message.includes("Not Found")) {
      throw new StatusError("Pull request not found", 404, {
        path: req.originalUrl,
        method: req.method,
      });
    }
    throw error;
  }
}

export default {
  list: asyncErrorBoundary(list),
  read: asyncErrorBoundary(read),
  create: asyncErrorBoundary(create),
  getDiff: asyncErrorBoundary(getDiff),
};
