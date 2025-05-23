import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";
import { list as listRepos } from "./github.service";

async function list(_req: Request, res: Response) {
  const data = await listRepos(_req.params.owner);
  res.json({ data });
}

async function read(_req: Request, res: Response) {
  res.send({ data: "Hello World" });
}

export default {
  list: asyncErrorBoundary(list),
  read: asyncErrorBoundary(read),
};
