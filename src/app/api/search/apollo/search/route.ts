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
    const { domain, titles } = await request.json();
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
        // person_titles: titles,
        // person_seniorities: [
        //   "founder",
        //   "vp",
        //   "executive",
        //   "senior",
        //   "director",
        // ],
        // q_keywords: "founder, ceo, cto",
        person_seniorities: [
          "c_suite",
          "founder",
          "owner",
          "vp",
          "partner",
          "head",
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Apollo API request failed");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Apollo search failed:", error);
    return NextResponse.json(
      { error: "Failed to search contacts" },
      { status: 500 }
    );
  }
}
