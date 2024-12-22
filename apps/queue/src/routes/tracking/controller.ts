import { Request, Response } from "express";
import { logger } from "@/services/log/logger";
import { trackingService } from "@/services/track/tracking-service";

// Transparent pixel for email tracking
const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function handleEmailOpen(req: Request, res: Response) {
  try {
    const { hash } = req.params;
    const userAgent = req.headers["user-agent"] || "";
    const referer = req.headers.referer;

    // Skip tracking for Gmail compose/reply views
    const isGmailComposeView =
      referer?.includes("mail.google.com/mail/u/") &&
      (referer?.includes("/compose") ||
        referer?.includes("?compose=") ||
        referer?.includes("?reply=") ||
        referer?.includes("?forward="));

    if (isGmailComposeView) {
      logger.info("Skipping tracking for Gmail compose view");
      return res
        .status(307)
        .set({
          "Content-Type": "image/png",
          "Cache-Control": "max-age=60, private",
          "X-Frame-Options": "deny",
          "X-Robots-Tag": "noindex, nofollow",
          Location: req.url,
        })
        .send(TRANSPARENT_PIXEL);
    }

    // Skip tracking for Google/Gmail backend services
    if (
      userAgent.toLowerCase().includes("googlebot") ||
      userAgent.toLowerCase().includes("google-smtp-source") ||
      (referer && referer.includes("googleapis.com"))
    ) {
      logger.info("Skipping tracking for Google/Gmail services");
      return res
        .status(200)
        .set({
          "Content-Type": "image/png",
          "Cache-Control": "max-age=60, private",
          "X-Frame-Options": "deny",
          "X-Robots-Tag": "noindex, nofollow",
        })
        .send(TRANSPARENT_PIXEL);
    }

    await trackingService.handleEmailOpen(hash);

    res
      .set({
        "Content-Type": "image/png",
        "Cache-Control": "max-age=60, private",
        "X-Frame-Options": "deny",
        "X-Robots-Tag": "noindex, nofollow",
      })
      .send(TRANSPARENT_PIXEL);
  } catch (error) {
    logger.error("Error handling email open:", error);
    res.status(500).json({ error: "Failed to track email open" });
  }
}

export async function handleLinkClick(req: Request, res: Response) {
  try {
    const { hash } = req.params;
    const { lid: linkId } = req.query;

    if (!linkId) {
      return res.status(400).json({ error: "Link ID is required" });
    }

    const redirectUrl = await trackingService.handleLinkClick(
      hash,
      linkId as string
    );
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error("Error handling link click:", error);
    res.status(500).json({ error: "Failed to track link click" });
  }
}

export async function trackEmailEvent(req: Request, res: Response) {
  try {
    const { trackingId, eventType, metadata } = req.body;

    if (!trackingId || !eventType) {
      return res
        .status(400)
        .json({ error: "Email ID and event type are required" });
    }

    await trackingService.trackEmailEvent({ trackingId, eventType, metadata });
    res.json({ success: true });
  } catch (error) {
    logger.error("Error tracking email event:", error);
    res.status(500).json({ error: "Failed to track email event" });
  }
}
