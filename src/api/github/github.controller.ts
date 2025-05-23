import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import { list as listRepos } from "./github.service";

async function list(req: Request, res: Response) {
  const page = parseInt(req.query.page as string) || 1;
  const per_page = parseInt(req.query.per_page as string) || 10;

  const data = await listRepos(req.params.owner, { page, per_page });
  res.json(data);
}

async function read(_req: Request, res: Response) {
  res.send({ data: "Hello World" });
}

export default {
  list: asyncErrorBoundary(list),
  read: asyncErrorBoundary(read),
};
