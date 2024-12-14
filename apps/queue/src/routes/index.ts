import { Router } from "express";
import sequenceRoutes from "./sequence";
import healthRoutes from "./health";
import metricsRoutes from "./metrics";
import trackingRoutes from "./tracking";

const router = Router();

// Mount route modules
router.use("/sequences", sequenceRoutes);
router.use("/health", healthRoutes);
router.use("/metrics", metricsRoutes);
router.use("/tracking", trackingRoutes);

export default router;
