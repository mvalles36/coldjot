import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { fetchVapiApi } from "@/lib/vapi/auth";

/**
 * GET handler for /api/vapi/assistants
 * Fetches assistants from the Vapi API
 */
export async function GET() {
  try {
    // Get the authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch assistants from Vapi API
    const response = await fetchVapiApi(
      userId,
      "/assistants",
      { method: "GET" }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Error fetching Vapi assistants:", errorData);
      
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Invalid Vapi API credentials" },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to fetch assistants from Vapi" },
        { status: response.status }
      );
    }

    // Parse and return the assistants data
    const assistantsData = await response.json();
    
    return NextResponse.json({
      assistants: assistantsData.assistants || [],
    });
  } catch (error) {
    console.error("Error in Vapi assistants API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
