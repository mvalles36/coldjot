import { Router } from "express";
import * as controller from "./controller";

const router = Router();

// Health check routes
router.get("/", controller.checkHealth);
router.get("/check", controller.checkHealthSimple);
router.get("/queues/status", controller.getQueueStatus);

export default router;
