import { Router } from "express";
import controller from "./github.controller";

const router = Router();

router.route("/").get(controller.list);

export default router;
