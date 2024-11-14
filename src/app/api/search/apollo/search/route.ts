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
    const { domain } = await request.json();
    const sanitizedDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");

    const response = await fetch(`${APOLLO_API_URL}/mixed_people/search`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "Cache-Control": "no-cache",
        "Content-Type": "application/json",
        "x-api-key": APOLLO_API_KEY,
      },
      body: JSON.stringify({
        q_organization_domains: sanitizedDomain,
        person_seniorities: [
          "c_suite",
          "founder",
          "owner",
          "vp",
          "partner",
          "head",
          "director",
        ],
        person_titles: [
          "CEO",
          "CTO",
          "Founder",
          "Co-Founder",
          "Chief Executive Officer",
          "Chief Technology Officer",
          "Managing Director",
          "Director",
          "VP",
          "Head",
        ],
        page: 1,
        per_page: 25,
        reveal_personal_emails: true,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Apollo API Error:", errorData);
      throw new Error("Apollo API request failed");
    }

    const data = await response.json();
    console.log("Apollo API Data:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Apollo search failed:", error);
    return NextResponse.json(
      { error: "Failed to search contacts" },
      { status: 500 }
    );
  }
}
