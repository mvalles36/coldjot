import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordEmailOpen, recordLinkClick } from "@/lib/tracking-service";

const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    let { hash } = await params;
    hash = hash.replace(".png", "");
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get("url"); // Only needed for click tracking

    console.log("Tracking hash:", hash);

    // Look up existing tracking event
    const existingEvent = await prisma.emailTrackingEvent.findFirst({
      where: {
        hash,
      },
      select: {
        id: true,
        email: true,
        userId: true,
        sequenceId: true,
        stepId: true,
        contactId: true,
      },
    });

    if (!existingEvent) {
      throw new Error("Invalid tracking hash");
    }

    const isClickEvent = request.nextUrl.pathname.includes("/click");

    // Handle tracking based on event type
    if (isClickEvent) {
      if (!url) {
        throw new Error("Missing URL parameter for click tracking");
      }

      await recordLinkClick(existingEvent.id, url);

      // In development, show tracking info before redirect
      if (process.env.NODE_ENV === "development") {
        const debugHtml = `
          <html>
            <head>
              <title>Tracking Debug</title>
              <style>
                body { font-family: system-ui; padding: 20px; }
                pre { background: #f0f0f0; padding: 10px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <h1>Link Click Tracking</h1>
              <p><strong>Hash:</strong> ${hash}</p>
              <p><strong>Email:</strong> ${existingEvent.email}</p>
              <p><strong>Target URL:</strong> ${url}</p>
              <p>Redirecting in 3 seconds...</p>
              <script>
                setTimeout(() => { window.location.href = "${url}" }, 3000);
              </script>
            </body>
          </html>
        `;
        return new NextResponse(debugHtml, {
          headers: { "Content-Type": "text/html" },
        });
      }

      return NextResponse.redirect(url, {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    } else {
      // Handle email open
      await recordEmailOpen(hash);

      // Return transparent pixel
      return new NextResponse(TRANSPARENT_PIXEL, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }
  } catch (error) {
    console.error("Error tracking email event:", error);
    return new NextResponse(TRANSPARENT_PIXEL, {
      headers: { "Content-Type": "image/gif" },
    });
  }
}
