import { Router } from "express";
import * as controller from "./controller";

const router = Router();

// Metrics routes
router.get("/", controller.getSystemMetrics);
router.get("/sequences/:id/health", controller.getSequenceHealth);

export default router;
