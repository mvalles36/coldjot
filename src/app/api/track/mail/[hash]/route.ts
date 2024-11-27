import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Create a transparent 1x1 pixel
const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const hash = params.hash.replace(".png", "");
    const userId = request.nextUrl.searchParams.get("u");

    if (!userId || !hash) {
      throw new Error("Missing required tracking parameters");
    }

    // Store the tracking event in your database
    await prisma.emailTrackingEvent.create({
      data: {
        hash,
        userId,
        type: "OPEN",
        userAgent: request.headers.get("user-agent") || "",
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0] || "",
        timestamp: new Date(),
      },
    });

    // Return a transparent pixel
    return new NextResponse(TRANSPARENT_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error tracking email open:", error);
    return new NextResponse(TRANSPARENT_PIXEL, {
      headers: {
        "Content-Type": "image/gif",
      },
    });
  }
}
