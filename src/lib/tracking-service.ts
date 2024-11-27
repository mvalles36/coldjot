import { EmailTrackingMetadata, EmailTracking } from "@/types/sequences";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/utils/email-utils";

export async function createEmailTracking(
  metadata: EmailTrackingMetadata
): Promise<EmailTracking> {
  try {
    // Validate required fields
    const requiredFields = [
      "email",
      "userId",
      "sequenceId",
      "stepId",
      "contactId",
    ];
    const missingFields = requiredFields.filter(
      (field) => !metadata[field as keyof EmailTrackingMetadata]
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required metadata fields: ${missingFields.join(", ")}`
      );
    }

    const hash = await createHash("sha256")
      .update(
        `${metadata.sequenceId}:${metadata.contactId}:${metadata.stepId}:${metadata.userId}`
      )
      .digest("hex");

    const eventData = {
      hash,
      email: metadata.email,
      userId: metadata.userId,
      sequenceId: metadata.sequenceId,
      stepId: metadata.stepId,
      contactId: metadata.contactId,
      openCount: 0,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    const trackingEvent = await prisma.emailTrackingEvent.create({
      data: {
        ...eventData,
      },
    });

    const tracking: EmailTracking = {
      metadata: { ...metadata, hash },
      type: "sequence",
      pixel: generateTrackingPixel(hash),
      wrappedLinks: true,
    };

    return tracking;
  } catch (error) {
    console.error("Error creating email tracking:", error);
    throw new Error(
      `Failed to create email tracking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function recordEmailOpen(hash: string): Promise<void> {
  try {
    await prisma.emailTrackingEvent.update({
      where: { hash },
      data: {
        openCount: {
          increment: 1,
        },
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error recording email open:", error);
    throw new Error(
      `Failed to record email open: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function recordLinkClick(
  trackingId: string,
  url: string
): Promise<void> {
  try {
    await prisma.linkClickEvent.create({
      data: {
        trackingId,
        url,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error recording link click:", error);
    throw new Error(
      `Failed to record link click: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export function addTrackingToEmail(
  content: string,
  tracking: EmailTracking
): string {
  try {
    if (!content || !tracking) {
      throw new Error("Content and tracking information are required");
    }

    let trackedContent = content;

    if (tracking.wrappedLinks) {
      trackedContent = wrapLinksWithTracking(
        trackedContent,
        tracking.metadata.hash!
      );
    }

    // Add development tracking link
    if (process.env.NODE_ENV === "development") {
      const baseUrl = getBaseUrl();
      const trackingUrl = new URL(
        `${baseUrl}/api/track/${tracking.metadata.hash}`
      );
      const devTrackingInfo = `
        <div style="background: #f0f0f0; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 12px;">
          <p><strong>Development Tracking Info:</strong></p>
          <p>Tracking Hash: ${tracking.metadata.hash}</p>
          <p>Tracking URL: ${trackingUrl.toString()}</p>
          <p>Email: ${tracking.metadata.email}</p>
        </div>
      `;
      trackedContent = devTrackingInfo + trackedContent;
    }

    trackedContent += tracking.pixel;

    return trackedContent;
  } catch (error) {
    console.error("Error adding tracking to email:", error);
    throw new Error(
      `Failed to add tracking to email: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function generateTrackingPixel(hash: string): string {
  try {
    if (!hash) {
      throw new Error("Hash is required for tracking pixel generation");
    }

    const baseUrl = getBaseUrl();
    const trackingUrl = new URL(`${baseUrl}/api/track/${hash}.png`);
    return `<img src="${trackingUrl.toString()}" alt="" style="display:none" width="1" height="1" />`;
  } catch (error) {
    console.error("Error generating tracking pixel:", error);
    throw new Error(
      `Failed to generate tracking pixel: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function wrapLinksWithTracking(content: string, hash: string): string {
  try {
    if (!content || !hash) {
      throw new Error("Content and hash are required for link tracking");
    }

    const baseUrl = getBaseUrl();
    const trackingBaseUrl = `${baseUrl}/api/track/${hash}/click`;

    return content.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, quote, url) => {
        try {
          if (!url.trim()) {
            return match; // Skip empty URLs
          }

          const trackingUrl = new URL(trackingBaseUrl);
          trackingUrl.searchParams.set("url", url);
          return `<a href="${trackingUrl.toString()}"`;
        } catch (error) {
          console.error("Error wrapping individual link with tracking:", error);
          return match; // Return original link if tracking fails
        }
      }
    );
  } catch (error) {
    console.error("Error in link tracking:", error);
    throw new Error(
      `Failed to wrap links with tracking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}
