import { Router } from "express";
import * as controller from "./controller";
import * as validator from "./validator";

const router = Router();

// Sequence routes
router.post("/:id/launch", validator.validateLaunch, controller.launchSequence);
router.post("/:id/pause", validator.validatePause, controller.pauseSequence);
router.post("/:id/resume", validator.validateResume, controller.resumeSequence);
router.post(
  "/:id/reset",
  validator.validateReset,
  controller.resetSequenceHandler
);

export default router;
