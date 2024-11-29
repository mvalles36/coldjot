import { EmailTrackingMetadata, EmailTracking } from "@/types/sequences";
import { nanoid } from "nanoid";
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

    const hash = await nanoid(48);

    const eventData = {
      hash,
      email: metadata.email,
      userId: metadata.userId,
      sequenceId: metadata.sequenceId,
      stepId: metadata.stepId,
      contactId: metadata.contactId,
      type: "CREATED",
      openCount: 0,
      timestamp: new Date(),
      createdAt: new Date(),
    };

    const trackingEvent = await prisma.emailTrackingEvent.create({
      data: eventData,
    });

    // id: string;
    // hash: string;
    // type: string;
    // wrappedLinks: boolean;
    // metadata: EmailTrackingMetadata;
    // pixel?: string;
    // trackingId?: string;

    const tracking: EmailTracking = {
      id: trackingEvent.id,
      hash,
      metadata: { ...metadata, hash },
      type: "sequence",
      pixel: generateTrackingPixel(hash),
      wrappedLinks: true,
      trackingId: trackingEvent.id, // Add tracking ID for link association
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
        type: "OPENED",
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

export async function recordLinkClick(linkId: string): Promise<void> {
  try {
    // Create click record and update click count in a transaction
    await prisma.$transaction(async (prisma) => {
      // Create click record
      await prisma.linkClick.create({
        data: {
          trackedLinkId: linkId,
          timestamp: new Date(),
        },
      });

      // Increment click count
      await prisma.trackedLink.update({
        where: { id: linkId },
        data: {
          clickCount: {
            increment: 1,
          },
          updatedAt: new Date(),
        },
      });
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

export async function createTrackedLink(
  emailTrackingId: string,
  originalUrl: string
): Promise<string> {
  try {
    const trackedLink = await prisma.trackedLink.create({
      data: {
        emailTrackingId,
        originalUrl,
        clickCount: 0,
      },
    });
    return trackedLink.id;
  } catch (error) {
    console.error("Error creating tracked link:", error);
    throw new Error(
      `Failed to create tracked link: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function addTrackingToEmail(
  content: string,
  tracking: EmailTracking
): Promise<string> {
  try {
    if (!content || !tracking) {
      throw new Error("Content and tracking information are required");
    }

    let trackedContent = content;

    if (tracking.wrappedLinks) {
      trackedContent = await wrapLinksWithTracking(
        trackedContent,
        tracking.metadata.hash!,
        tracking.trackingId!
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
          <p>Tracking ID: ${tracking.trackingId}</p>
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

async function wrapLinksWithTracking(
  content: string,
  hash: string,
  trackingId: string
): Promise<string> {
  try {
    if (!content || !hash || !trackingId) {
      throw new Error(
        "Content, hash, and tracking ID are required for link tracking"
      );
    }

    const baseUrl = getBaseUrl();
    const trackingBaseUrl = `${baseUrl}/api/track/${hash}/click`;

    // Use async replace to handle link creation
    const promises: Promise<string>[] = [];
    const matches: { match: string; url: string }[] = [];

    // Find all links and store them
    content.replace(
      /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi,
      (match, quote, url) => {
        if (url.trim()) {
          matches.push({ match, url });
        }
        return match;
      }
    );

    // Create tracked links for all URLs
    for (const { match, url } of matches) {
      const linkId = await createTrackedLink(trackingId, url);
      const trackingUrl = new URL(trackingBaseUrl);
      trackingUrl.searchParams.set("lid", linkId); // Use link ID instead of URL
      content = content.replace(match, `<a href="${trackingUrl.toString()}"`);
    }

    return content;
  } catch (error) {
    console.error("Error in link tracking:", error);
    throw new Error(
      `Failed to wrap links with tracking: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function updateTrackingWithMessageId(
  hash: string,
  messageId: string
): Promise<void> {
  await prisma.emailTrackingEvent.update({
    where: { hash },
    data: { messageId },
  });
}
