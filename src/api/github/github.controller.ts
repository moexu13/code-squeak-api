import { Request, Response } from "express";

async function list(_req: Request, res: Response) {
  res.send({ data: "Hello World" });
}

export default {
  list,
};
