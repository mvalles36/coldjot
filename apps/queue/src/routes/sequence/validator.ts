import { Request, Response, NextFunction } from "express";

export function validateLaunch(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { userId, testMode } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  // Convert testMode to boolean if provided
  if (testMode !== undefined) {
    req.body.testMode = Boolean(testMode);
  }

  next();
}

export function validatePause(req: Request, res: Response, next: NextFunction) {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  next();
}

export function validateResume(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  next();
}

export function validateReset(req: Request, res: Response, next: NextFunction) {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  next();
}
