import { Router } from "express";
import controller from "./github.controller";
import { MethodNotAllowedHandler } from "../../errors/handlers";

const router = Router();

router
  .route("/:owner")
  .get(controller.list)
  .all(MethodNotAllowedHandler.handle);
router
  .route("/:owner/:repo")
  .get(controller.read)
  .all(MethodNotAllowedHandler.handle);
router
  .route("/:owner/:repo/pulls/:pull_number")
  .post(controller.create)
  .all(MethodNotAllowedHandler.handle);

export default router;
