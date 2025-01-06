import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@coldjot/database";
import type { EmailEventType } from "@coldjot/types";
import { getUserAgent } from "@/lib/user-agent";
import { getIpLocation } from "@/lib/ip-location";
// import { trackingClient } from "@/lib/queue/tracking-client";

const TRANSPARENT_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

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

    try {
      // Track the event through the queue service
      // await trackingClient.trackEmailEvent({
      //   emailId,
      //   eventType: eventType as EmailEventType,
      //   metadata: {
      //     userAgent: userAgent.userAgent,
      //     ipAddress,
      //     location: JSON.stringify(location),
      //     deviceType: userAgent.device,
      //   },
      // });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Failed to track email event:", error);
      return NextResponse.json(
        { error: "Failed to track email event" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(`❌ Error processing event request:`, error);
    return NextResponse.json(
      { error: "Failed to process event request" },
      { status: 500 }
    );
  }
}
