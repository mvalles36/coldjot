import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordEmailOpen, recordLinkClick } from "@/lib/tracking-service";

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
    },
  });

  if (!existingEvent) {
    console.error(`❌ No tracking event found for hash: ${hash}`);
    throw new Error("Invalid tracking hash");
  }

  console.log(`✉️ Found email tracking event:`, {
    email: existingEvent.email,
    currentOpens: existingEvent.openCount,
  });

  await recordEmailOpen(hash);
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
  console.log(`✅ Recorded link click for ${trackedLink.originalUrl}`);

  // In development, show debug info
  if (process.env.NODE_ENV === "development") {
    console.log(`🛠️ Showing debug info in development`);
    const debugHtml = `
      <html>
        <head>
          <title>Link Click Debug</title>
          <style>
            body { 
              font-family: system-ui; 
              padding: 20px; 
              border-radius: 8px;
              overflow-x: auto;
            }
            pre { 
              background: #f0f0f0; 
              padding: 15px; 
              border-radius: 8px;
              overflow-x: auto;
            }
            .debug-info {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .redirect-info {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              padding: 15px;
              border-radius: 8px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <h1>🔍 Link Click Tracking Debug</h1>
          <div class="debug-info">
            <h2>📊 Tracking Information</h2>
            <p><strong>Hash:</strong> ${hash}</p>
            <p><strong>Email:</strong> ${existingEvent.email}</p>
            <p><strong>Link ID:</strong> ${linkId}</p>
            <p><strong>Click Count:</strong> ${trackedLink.clickCount + 1}</p>
            <p><strong>Original URL:</strong> ${trackedLink.originalUrl}</p>
          </div>
          <div class="redirect-info">
            <p>⏳ Redirecting in 3 seconds...</p>
          </div>
          <script>
            console.log('🔄 Starting redirect countdown...');
            setTimeout(() => {
              console.log('↪️ Redirecting to:', '${trackedLink.originalUrl}');
              window.location.href = "${trackedLink.originalUrl}";
            }, 3000);
          </script>
        </body>
      </html>
    `;
    return new NextResponse(debugHtml, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // In production, redirect immediately
  console.log(`↪️ Redirecting to: ${trackedLink.originalUrl}`);
  return NextResponse.redirect(trackedLink.originalUrl, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

// Main route handler
export async function GET(
  request: NextRequest,
  { params }: { params: { slug?: string[] } }
) {
  try {
    console.log(`\n🎯 New tracking request received`);
    console.log(`📝 Raw params:`, await params);

    // Parse the slug to get hash and action
    const slug = (await params.slug) || [];
    let hash = slug[0] || "";
    const action = slug[1] || "";

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
