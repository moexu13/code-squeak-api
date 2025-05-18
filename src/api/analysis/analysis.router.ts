import { Router } from "express";
import controller from "./analysis.controller";

const router = Router();

router.route("/").get(controller.list);

export default router;
