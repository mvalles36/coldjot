import { Router } from "express";
import * as controller from "./controller";

const router = Router();

// Email tracking routes
router.get("/opens/:hash", controller.handleEmailOpen);
router.post("/clicks/:hash", controller.handleLinkClick);
router.post("/events", controller.trackEmailEvent);

export default router;
