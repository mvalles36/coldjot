import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const emailId = searchParams.get("emailId");
    const userId = searchParams.get("userId");
    const sequenceId = searchParams.get("sequenceId");
    const url = searchParams.get("url");

    if (!emailId || !userId || !url) {
      return new NextResponse("Missing required parameters", { status: 400 });
    }

    // Record the click event
    await prisma.emailTracking.create({
      data: {
        emailId,
        userId,
        type: "click",
        metadata: {
          url,
          sequenceId: sequenceId || undefined,
          userAgent: request.headers.get("user-agent") || "unknown",
          timestamp: new Date().toISOString(),
          referer: request.headers.get("referer") || "unknown",
        },
      },
    });

    // Redirect to the original URL
    return NextResponse.redirect(url, {
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Error tracking email click:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
