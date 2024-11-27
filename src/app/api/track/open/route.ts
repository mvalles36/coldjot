import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("emailId");
    const userId = searchParams.get("userId");
    const headersList = await headers();

    if (!emailId || !userId) {
      return new NextResponse("Missing required parameters", { status: 400 });
    }

    // Get detailed tracking information
    const trackingInfo = {
      emailId,
      userId,
      userAgent: request.headers.get("user-agent") || "unknown",
      timestamp: new Date().toISOString(),
      ip: headersList.get("x-forwarded-for") || "unknown",
      referer: request.headers.get("referer") || "unknown",
    };

    console.log("📧 Tracking email open:", trackingInfo);

    // Record the email open event
    await prisma.emailTracking.create({
      data: {
        emailId,
        userId,
        type: "open",
        metadata: trackingInfo,
      },
    });

    // For local testing, if Accept header includes text/html, return a visible confirmation
    const acceptHeader = request.headers.get("accept") || "";
    if (
      process.env.NODE_ENV === "development" &&
      acceptHeader.includes("text/html")
    ) {
      return new NextResponse(
        `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1>Email Open Tracked! 📧</h1>
            <pre style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
${JSON.stringify(trackingInfo, null, 2)}
            </pre>
          </body>
        </html>
        `,
        {
          headers: {
            "Content-Type": "text/html",
          },
        }
      );
    }

    // src="https://ci3.googleusercontent.com/meips/ADKq_NargL63mNOfIO0Fim8F_d0XjhD6WDF7Dx8_5fGo2VcnqmhRms9uSCnkGb4uMyglkv8hFO_lrVu34DIG3iEfo7xxJkmsu-mMoOa9xk5W9uUWpfwsR1FxGUo4nNzIvlYbwq2TsfCxWPi06Y-ePg=s0-d-e1-ft#https://mailtrack.io/trace/mail/17603f5e574de5eb20692eca21b73cc1c3cef769.png?u=7322549"

    // Return a 1x1 transparent GIF for normal tracking
    const TRANSPARENT_GIF_BUFFER = Buffer.from(
      "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      "base64"
    );

    return new NextResponse(TRANSPARENT_GIF_BUFFER, {
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
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
