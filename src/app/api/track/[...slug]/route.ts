import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackEmailEvent } from "@/lib/tracking/tracking-service";
import type { EmailEventType } from "@/types";
import { getUserAgent } from "@/lib/user-agent";
import { getIpLocation } from "@/lib/ip-location";
import { updateSequenceStats } from "@/lib/stats/sequence-stats-service";
// import type { EmailEventType } from "@prisma/client";

import {
  recordEmailOpen,
  recordLinkClick,
} from "@/lib/tracking/tracking-service";
import { getGmailEmail, getGmailThread } from "@/lib/google/gmail";

const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Handle email opens
async function handleEmailOpen(hash: string) {
  console.log(`📨 Processing email open for hash: ${hash}`);

  const existingEvent = await prisma.emailTrackingEvent.findUnique({
    where: { hash },
    select: {
      id: true,
      email: true,
      openCount: true,
      sequenceId: true,
      contactId: true,
      messageId: true,
      userId: true,
      gmailThreadId: true,
    },
  });

  // get access token
  const account = await prisma.account.findFirst({
    where: { userId: existingEvent?.userId },
  });

  // const email = await getGmailEmail(
  //   account?.access_token!,
  //   existingEvent?.messageId!
  // );
  // console.log("Email", email);

  // const email = await getGmailThread(
  //   account?.access_token!,
  //   existingEvent?.gmailThreadId!
  // );
  // console.log("Email", email);

  if (!existingEvent) {
    console.error(`❌ No tracking event found for hash: ${hash}`);
    throw new Error("Invalid tracking hash");
  }

  // Check for existing open event
  const existingOpenEvent = await prisma.emailEvent.findFirst({
    where: {
      emailId: existingEvent.id,
      type: "OPENED",
      sequenceId: existingEvent.sequenceId,
    },
  });

  console.log(`✉️ Found email tracking event:`, {
    email: existingEvent.email,
    currentOpens: existingEvent.openCount,
  });

  // Only record the first open for stats
  const isFirstOpen = !existingOpenEvent;

  // Always increment the open count for tracking purposes
  await recordEmailOpen(hash);

  // Only update sequence stats for the first open
  if (isFirstOpen && existingEvent.sequenceId && existingEvent.contactId) {
    await updateSequenceStats(
      existingEvent.sequenceId,
      "opened",
      existingEvent.contactId
    );
  }

  console.log(`✅ Recorded email open for ${existingEvent.email}`);

  return new NextResponse(TRANSPARENT_PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

// Handle link clicks
async function handleLinkClick(hash: string, linkId: string | null) {
  console.log(`🔗 Processing link click - Hash: ${hash}, Link ID: ${linkId}`);

  if (!linkId) {
    console.error(`❌ No link ID provided in request`);
    throw new Error("Missing link ID for click tracking");
  }

  const existingEvent = await prisma.emailTrackingEvent.findFirst({
    where: { hash },
    select: {
      id: true,
      email: true,
      sequenceId: true,
      contactId: true,
      links: {
        where: { id: linkId },
        select: {
          id: true,
          originalUrl: true,
          clickCount: true,
        },
      },
    },
  });

  if (!existingEvent) {
    console.error(`❌ No tracking event found for hash: ${hash}`);
    throw new Error("Invalid tracking hash");
  }

  console.log(`📧 Found email tracking event for: ${existingEvent.email}`);

  const trackedLink = existingEvent.links[0];
  if (!trackedLink) {
    console.error(`❌ No link found with ID: ${linkId}`);
    throw new Error("Invalid link ID");
  }

  console.log(`🔍 Found tracked link:`, {
    url: trackedLink.originalUrl,
    currentClicks: trackedLink.clickCount,
  });

  await recordLinkClick(linkId);

  // Always update stats for clicks as we want to track all clicks
  if (existingEvent.sequenceId && existingEvent.contactId) {
    await updateSequenceStats(
      existingEvent.sequenceId,
      "clicked",
      existingEvent.contactId
    );
  }

  console.log(`✅ Recorded link click for ${trackedLink.originalUrl}`);

  return NextResponse.redirect(trackedLink.originalUrl);
}

// Main route handler
export async function GET(
  request: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  try {
    console.log(`\n🎯 New tracking request received`);
    console.log(`📝 Raw params:`, await params);
    console.log(`📝 Request headers:`, request.headers);

    // Parse the slug to get hash and action
    const { slug } = (await params) || [];
    let hash = slug![0] || "";
    const action = slug![1] || "";

    // Remove .png extension if present
    hash = hash.replace(".png", "");

    const searchParams = request.nextUrl.searchParams;
    const linkId = searchParams.get("lid");
    const isClickEvent = action === "click";

    console.log(`📝 Parsed request details:`, {
      hash,
      action,
      linkId,
      isClickEvent,
      url: request.url,
    });

    // Route to appropriate handler
    if (isClickEvent) {
      return await handleLinkClick(hash, linkId);
    } else {
      return await handleEmailOpen(hash);
    }
  } catch (error) {
    console.error(`❌ Error processing tracking request:`, error);

    if (process.env.NODE_ENV === "development") {
      return new NextResponse(
        `<html>
          <head>
            <title>Tracking Error</title>
            <style>
              body { 
                font-family: system-ui; 
                padding: 20px; 
                max-width: 800px;
                margin: 0 auto;
                line-height: 1.6;
              }
              .error-box {
                background: #fef2f2;
                border: 1px solid #fecaca;
                padding: 20px;
                border-radius: 8px;
                margin: 20px 0;
              }
              .error-message {
                color: #dc2626;
                font-weight: 500;
              }
              .error-details {
                margin-top: 15px;
                padding: 15px;
                background: #f8fafc;
                border-radius: 6px;
              }
            </style>
          </head>
          <body>
            <h1>❌ Tracking Error</h1>
            <div class="error-box">
              <p class="error-message">${
                error instanceof Error ? error.message : "Unknown error"
              }</p>
              <div class="error-details">
                <p><strong>Hash:</strong> ${params.slug?.[0] || "N/A"}</p>
                <p><strong>Action:</strong> ${params.slug?.[1] || "N/A"}</p>
                <p><strong>URL:</strong> ${request.url}</p>
              </div>
            </div>
          </body>
        </html>`,
        {
          headers: { "Content-Type": "text/html" },
          status: 400,
        }
      );
    }

    return new NextResponse(TRANSPARENT_PIXEL, {
      headers: { "Content-Type": "image/gif" },
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { eventType: string } }
) {
  try {
    const { emailId } = await req.json();
    const eventType = params.eventType.toUpperCase();

    if (!emailId) {
      return NextResponse.json(
        { error: "Email ID is required" },
        { status: 400 }
      );
    }

    const userAgent = getUserAgent(req);
    const ipAddress =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const location = await getIpLocation(ipAddress);

    const event = await trackEmailEvent(emailId, eventType as EmailEventType, {
      userAgent: userAgent.userAgent,
      ipAddress,
      location: JSON.stringify(location),
      deviceType: userAgent.device,
    });

    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error(`❌ Error tracking email event:`, error);
    return NextResponse.json(
      { error: "Failed to track email event" },
      { status: 500 }
    );
  }
}
