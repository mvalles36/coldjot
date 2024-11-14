import { auth } from "@/auth";
import { NextResponse } from "next/server";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_API_URL = "https://api.apollo.io/api/v1";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: "Apollo API key not configured" },
      { status: 500 }
    );
  }

  try {
    const { apolloContactId, domain, firstName, lastName } =
      await request.json();

    const url = `${APOLLO_API_URL}/people/match?name=${encodeURIComponent(
      `${firstName} ${lastName}`
    )}&domain=${encodeURIComponent(
      domain
    )}&reveal_personal_emails=true&reveal_phone_number=false`;
    const options = {
      method: "POST",
      headers: {
        accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
    };
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error("Apollo API request failed");
    }

    const data = await response.json();
    console.log("Apollo enrichment URL:", response);
    console.log("Apollo enrichment response:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Apollo enrichment failed:", error);
    return NextResponse.json(
      { error: "Failed to enrich contact" },
      { status: 500 }
    );
  }
}
