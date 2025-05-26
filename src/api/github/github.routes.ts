import { Router } from "express";
import controller from "./github.controller";
import methodNotAllowed from "../../errors/methodNotAllowed";

const router = Router();

router.route("/:owner").get(controller.list).all(methodNotAllowed);
router.route("/:owner/:repo").get(controller.read).all(methodNotAllowed);
router
  .route("/:owner/:repo/pulls/:pull_number/comments")
  .post(controller.create)
  .all(methodNotAllowed);

export default router;
