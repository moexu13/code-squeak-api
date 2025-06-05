import { Request, Response } from "express";
import asyncErrorBoundary from "../../errors/asyncErrorBoundary";

async function create(_req: Request, res: Response) {
  res.send({ data: "Hello World" });
}

export default {
  create: asyncErrorBoundary(create),
};
