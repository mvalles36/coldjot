import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { fetchVapiApi } from "@/lib/vapi/auth";

/**
 * GET handler for /api/vapi/voices/[voiceId]/preview
 * Fetches audio preview for a specific voice from the Vapi API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { voiceId: string } }
) {
  try {
    // Extract voice ID from URL params
    const { voiceId } = params;
    if (!voiceId) {
      return NextResponse.json(
        { error: "Voice ID is required" },
        { status: 400 }
      );
    }

    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch voice preview from Vapi API
    const response = await fetchVapiApi(
      userId,
      `/voices/${voiceId}/preview`,
      { method: "GET" }
    );

    if (!response.ok) {
      // Try to parse error if possible
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`Error fetching voice preview for ${voiceId}:`, errorText);
      
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Invalid Vapi API credentials" },
          { status: 401 }
        );
      }
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Voice preview not found" },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to fetch voice preview" },
        { status: response.status }
      );
    }

    // Get the audio data and content type
    const audioBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "audio/mpeg";

    // Return the audio data with appropriate headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Error in voice preview API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
