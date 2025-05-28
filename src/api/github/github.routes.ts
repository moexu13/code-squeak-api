import { Router } from "express";
import controller from "./github.controller";
import { MethodNotAllowedError } from "../../errors/http";

const router = Router();

const methodNotAllowed = (req: any, _res: any, next: any) => {
  next(
    new MethodNotAllowedError(
      `${req.method} not allowed for ${req.originalUrl}`
    )
  );
};

router.route("/:owner").get(controller.list).all(methodNotAllowed);
router.route("/:owner/:repo").get(controller.read).all(methodNotAllowed);
router
  .route("/:owner/:repo/:pull_number")
  .get(controller.getDiff)
  .post(controller.create)
  .all(methodNotAllowed);

export default router;
